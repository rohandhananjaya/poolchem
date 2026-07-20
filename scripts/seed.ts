/**
 * Seed script — seeds the super admin user.
 *
 * Run with:  npm run db:seed
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI where vars are already in the environment).
}

const ADMIN_EMAIL = "admin@poolbench.com";
const ADMIN_PASSWORD = "admin-password-456";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

async function provisionAuthUser(
  email: string,
  password: string,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return (
      `SKIPPED — ${email} (no SUPABASE_SERVICE_ROLE_KEY).\n` +
      `     Create the login manually in the Supabase dashboard.`
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return `OK — auth user ${email} already existed (reused).`;
    }
    return `FAILED — ${error.message}. Create ${email} manually.`;
  }

  return `OK — created Supabase auth user ${email}.`;
}

async function main() {
  console.log("🌱 Seeding super admin…\n");

  // ---- SUPER_ADMIN (platform owner, no company) ----------------------------
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: "Platform Admin", role: "SUPER_ADMIN" },
    create: {
      email: ADMIN_EMAIL,
      name: "Platform Admin",
      role: "SUPER_ADMIN",
      companyId: null,
    },
  });
  console.log(`• Admin:    ${admin.name} <${admin.email}> (SUPER_ADMIN)`);

  // ---- Supabase auth user --------------------------------------------------
  console.log("\n• Provisioning Supabase auth login…");
  const authStatus = await provisionAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);

  // ---- Packages ------------------------------------------------------------
  const packages = [
    {
      slug: "starter",
      name: "Starter",
      price: 1900,
      features: JSON.stringify({
        max_pools: 5,
        health_scoring: "basic",
        chemical_recs: true,
        service_reports: false,
        qr_code: false,
        scheduling: false,
        multi_tech: false,
        priority_support: false,
        custom_branding: false,
        api_access: false,
        csv_import: false,
      }),
      sortOrder: 0,
    },
    {
      slug: "basic",
      name: "Basic",
      price: 2900,
      features: JSON.stringify({
        max_pools: 25,
        health_scoring: "advanced+lsi",
        chemical_recs: true,
        service_reports: true,
        qr_code: true,
        scheduling: true,
        multi_tech: false,
        priority_support: false,
        custom_branding: false,
        api_access: false,
        csv_import: false,
      }),
      sortOrder: 1,
    },
    {
      slug: "pro",
      name: "Pro",
      price: 3900,
      features: JSON.stringify({
        max_pools: -1, // unlimited
        health_scoring: "advanced+lsi",
        chemical_recs: true,
        service_reports: true,
        qr_code: true,
        scheduling: true,
        multi_tech: true,
        priority_support: true,
        custom_branding: true,
        api_access: true,
        csv_import: true,
      }),
      sortOrder: 2,
    },
  ];

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { slug: pkg.slug },
      update: pkg,
      create: pkg,
    });
    console.log(`• Package: ${pkg.name} ($${(pkg.price / 100).toFixed(2)})`);
  }

  // ---- Platform settings ----------------------------------------------------
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: { trialDays: 30 },
    create: { id: "singleton", trialDays: 30 },
  });
  console.log("• Platform trial length: 30 days");

  // ---- Summary -------------------------------------------------------------
  console.log("\n✅ Seed complete.\n");
  console.log("   Login");
  console.log(`     SUPER_ADMIN  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
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
