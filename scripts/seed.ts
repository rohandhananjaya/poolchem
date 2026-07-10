/**
 * Seed script — populates a fresh database with a demo tenant so the whole app
 * flow is walkable immediately after setup.
 *
 * Creates:
 *   - 1 demo company (the tenant)
 *   - 1 demo user / login  →  tech@demo.com / password123
 *   - 3 demo pools
 *   - 5 completed service visits, each with a water reading + chemicals
 *
 * Run with:  npm run db:seed
 *
 * IMPORTANT — how login works here:
 *   Identity is split across two systems linked by email (see CLAUDE.md):
 *     • Supabase Auth owns the password/session.
 *     • Our Prisma `User` row owns companyId / role / name.
 *   So creating the Prisma user alone is NOT enough to log in — a Supabase Auth
 *   user with the same email must also exist. If SUPABASE_SERVICE_ROLE_KEY (and
 *   NEXT_PUBLIC_SUPABASE_URL) are set, this script provisions that auth user for
 *   you via the Admin API. If not, it seeds the Prisma data and prints
 *   instructions for creating the auth user manually.
 *
 * Prisma 7 note: there is no `url` in schema.prisma, so the client is built with
 * a driver adapter here — same pattern as src/lib/prisma.ts. This uses the
 * SQLite adapter; when the app moves to Supabase Postgres, swap the adapter for
 * `@prisma/adapter-pg` (mirroring the change in src/lib/prisma.ts).
 */
import { randomUUID } from "node:crypto";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

// Prisma's config file loads .env for Migrate, but a standalone script does not
// get that for free — load it ourselves (built into Node 20.12+/22).
try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI where vars are already in the environment).
}

const DEMO = {
  companyEmail: "demo@poolchem.app",
  loginEmail: "tech@demo.com",
  loginPassword: "password123",
} as const;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

/** Deletes any previous demo tenant so the seed is idempotent (re-runnable). */
async function clearDemoTenant(companyId: string) {
  // Delete children before parents: ServiceVisit.tech is onDelete: Restrict, so
  // a plain company cascade can fail depending on delete order. Be explicit.
  await prisma.waterReading.deleteMany({
    where: { visit: { pool: { companyId } } },
  });
  await prisma.chemicalAdded.deleteMany({
    where: { visit: { pool: { companyId } } },
  });
  await prisma.serviceVisit.deleteMany({ where: { pool: { companyId } } });
  await prisma.pool.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

/**
 * Provisions the Supabase Auth user for the demo login, if the service-role key
 * is configured. Returns a human-readable status for the summary.
 */
async function provisionAuthUser(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return (
      "SKIPPED — no SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL.\n" +
      "     Create the login manually in the Supabase dashboard\n" +
      "     (Authentication → Users → Add user):\n" +
      `        email:    ${DEMO.loginEmail}\n` +
      `        password: ${DEMO.loginPassword}   (mark email as confirmed)`
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email: DEMO.loginEmail,
    password: DEMO.loginPassword,
    email_confirm: true,
  });

  if (error) {
    // Most common: the user already exists from a previous seed — that's fine.
    if (/already been registered|already exists/i.test(error.message)) {
      return `OK — auth user ${DEMO.loginEmail} already existed (reused).`;
    }
    return `FAILED — ${error.message}. Create ${DEMO.loginEmail} manually.`;
  }

  return `OK — created Supabase auth user ${DEMO.loginEmail}.`;
}

async function main() {
  console.log("🌱 Seeding PoolChem demo data…\n");

  // ---- Reset any existing demo tenant --------------------------------------
  const existing = await prisma.company.findFirst({
    where: { email: DEMO.companyEmail },
  });
  if (existing) {
    console.log("• Removing previous demo tenant…");
    await clearDemoTenant(existing.id);
  }

  // ---- Company -------------------------------------------------------------
  const company = await prisma.company.create({
    data: {
      name: "Demo Pool Services",
      email: DEMO.companyEmail,
      phone: "(555) 012-3456",
      address: "100 Poolside Ave, Scottsdale, AZ 85251",
      subscriptionStatus: "active",
    },
  });
  console.log(`• Company:  ${company.name}`);

  // ---- User (the servicing tech) -------------------------------------------
  const tech = await prisma.user.create({
    data: {
      email: DEMO.loginEmail,
      name: "Alex Rivera",
      role: "TECH",
      companyId: company.id,
    },
  });
  console.log(`• User:     ${tech.name} <${tech.email}>`);

  // ---- Pools ---------------------------------------------------------------
  const poolSeeds = [
    {
      name: "The Hendersons",
      address: "42 Sunset Blvd, Scottsdale, AZ",
      volume: 18000,
      notes: "Gate code 4821. Dog is friendly.",
    },
    {
      name: "Vista Verde HOA",
      address: "900 Community Dr, Tempe, AZ",
      volume: 45000,
      notes: "Commercial pool — heavy bather load on weekends.",
    },
    {
      name: "Marlowe Residence",
      address: "17 Cactus Wren Ct, Mesa, AZ",
      volume: 12500,
      notes: "Saltwater system.",
    },
  ];

  const pools = [];
  for (const seed of poolSeeds) {
    pools.push(
      await prisma.pool.create({
        // qrCode has no schema default — it's minted in code (see db/pools.ts).
        // publicToken defaults to a uuid in the schema.
        data: { ...seed, qrCode: `POOL-${randomUUID()}`, companyId: company.id },
      }),
    );
  }
  console.log(`• Pools:    ${pools.map((p) => p.name).join(", ")}`);

  // ---- Service visits (with readings + chemicals) --------------------------
  // Spread across recent days so trend charts have history; the two most recent
  // are dated "today" so they appear on the dashboard's route.
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const visitSeeds = [
    {
      pool: pools[0],
      daysAgo: 0,
      reading: {
        ph: 7.4,
        freeChlorine: 2.8,
        totalAlkalinity: 100,
        calciumHardness: 280,
        cyanuricAcid: 45,
        temperature: 82,
      },
      chemicals: [{ name: "Liquid Chlorine", amount: 16, unit: "fl oz" }],
    },
    {
      pool: pools[1],
      daysAgo: 0,
      reading: {
        ph: 7.9,
        freeChlorine: 1.1,
        totalAlkalinity: 140,
        calciumHardness: 320,
        cyanuricAcid: 70,
        temperature: 86,
      },
      chemicals: [
        { name: "Muriatic Acid", amount: 32, unit: "fl oz" },
        { name: "Cal Hypo (73%)", amount: 12, unit: "oz" },
      ],
    },
    {
      pool: pools[2],
      daysAgo: 3,
      reading: {
        ph: 7.2,
        freeChlorine: 3.5,
        totalAlkalinity: 80,
        calciumHardness: 200,
        cyanuricAcid: 30,
        temperature: 80,
      },
      chemicals: [{ name: "Sodium Bicarbonate", amount: 2, unit: "lbs" }],
    },
    {
      pool: pools[0],
      daysAgo: 7,
      reading: {
        ph: 7.6,
        freeChlorine: 2.2,
        totalAlkalinity: 110,
        calciumHardness: 300,
        cyanuricAcid: 50,
        temperature: 79,
      },
      chemicals: [{ name: "Liquid Chlorine", amount: 12, unit: "fl oz" }],
    },
    {
      pool: pools[1],
      daysAgo: 10,
      reading: {
        ph: 8.1,
        freeChlorine: 0.6,
        totalAlkalinity: 150,
        calciumHardness: 340,
        cyanuricAcid: 90,
        temperature: 84,
      },
      chemicals: [
        { name: "Muriatic Acid", amount: 40, unit: "fl oz" },
        { name: "Liquid Chlorine", amount: 32, unit: "fl oz" },
      ],
    },
  ];

  for (const seed of visitSeeds) {
    const createdAt = new Date(now - seed.daysAgo * day);
    await prisma.serviceVisit.create({
      data: {
        poolId: seed.pool.id,
        techId: tech.id,
        status: "COMPLETED",
        createdAt,
        updatedAt: createdAt,
        notes: "Water tested and balanced. Skimmed surface, emptied baskets.",
        waterReadings: { create: { ...seed.reading, createdAt } },
        chemicalsAdded: {
          create: seed.chemicals.map((c) => ({ ...c, createdAt })),
        },
      },
    });
  }
  console.log(`• Visits:   ${visitSeeds.length} completed visits with readings`);

  // ---- Supabase auth user (so the demo login actually works) ---------------
  console.log("\n• Provisioning Supabase auth login…");
  const authStatus = await provisionAuthUser();

  // ---- Summary -------------------------------------------------------------
  console.log("\n✅ Seed complete.\n");
  console.log("   Demo login");
  console.log(`     email:    ${DEMO.loginEmail}`);
  console.log(`     password: ${DEMO.loginPassword}`);
  console.log(`   Auth: ${authStatus}\n`);
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
