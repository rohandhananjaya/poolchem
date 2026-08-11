/**
 * Legacy `ServiceVisit.poolId` → `ServiceVisitPool` data backfill.
 *
 * For every existing ServiceVisit, creates one ServiceVisitPool join row from
 * the legacy `poolId` and backfills `serviceVisitPoolId` on existing
 * readings/chemicals (which are null everywhere pre-backfill).
 *
 * HIGHEST RISK — IRREVERSIBLE against real prod. ALWAYS validate on a full
 * prod-data copy before running for real (see the card's Prod-cutover steps).
 * Default is a DRY-RUN; pass `--apply` to write.
 *
 * Run with:  npm run db:backfill:service-visit-pools [-- --apply]
 *
 * Mirror of scripts/seed.ts adapter setup: driver adapter chosen off
 * `DATABASE_URL`, `process.loadEnvFile()`.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  buildServiceVisitPoolBackfillPlan,
  type BackfillChildBatch,
  type ServiceVisitPoolBackfillPlan,
} from "../src/lib/db/service-visit-pool-backfill";

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI where vars are already in the environment).
}

const APPLY = process.argv.includes("--apply");

const databaseUrl = process.env.DATABASE_URL!;
const prisma = new PrismaClient({
  adapter: databaseUrl.startsWith("postgres")
    ? new PrismaPg({ connectionString: databaseUrl })
    : new PrismaBetterSqlite3({ url: databaseUrl }),
});

function printReport(visits: number, summary: ServiceVisitPoolBackfillPlan["summary"]) {
  console.log(`  Visits:             ${visits}`);
  console.log(`  Joins to create:    ${summary.joinsToCreate}`);
  console.log(`  Readings to update: ${summary.readingsToUpdate}`);
  console.log(`  Chemicals to update:${summary.chemicalsToUpdate}`);
  console.log(`  Skipped (joined):   ${summary.skippedVisits}`);
  console.log(`  Orphans (no pool):  ${summary.orphanVisits}`);
}

/** Resolves each child batch to a real join id (existing, or post-create). */
async function buildJoinIdByVisit(batches: BackfillChildBatch[]): Promise<Map<string, string>> {
  const involved = [...new Set(batches.map((batch) => batch.serviceVisitId))];
  const rows = await prisma.serviceVisitPool.findMany({
    where: { serviceVisitId: { in: involved } },
    select: { id: true, serviceVisitId: true },
  });
  return new Map(rows.map((row) => [row.serviceVisitId, row.id]));
}

async function verifyAfterApply(visits: Array<{ id: string }>) {
  const joins = await prisma.serviceVisitPool.findMany({
    select: {
      id: true,
      serviceVisitId: true,
      companyId: true,
      pool: { select: { companyId: true } },
    },
  });

  const visitIds = new Set(visits.map((visit) => visit.id));
  const covered = new Set(joins.map((join) => join.serviceVisitId));
  const uncovered = [...visitIds].filter((id) => !covered.has(id));
  if (uncovered.length > 0) {
    throw new Error(
      `VERIFICATION FAILED: ${uncovered.length} visit(s) have no join row (${uncovered.join(", ")}).`,
    );
  }

  const drifted = joins.filter((join) => join.companyId !== join.pool.companyId);
  if (drifted.length > 0) {
    throw new Error(
      `VERIFICATION FAILED: ${drifted.length} join row(s) have companyId != their pool's companyId.`,
    );
  }

  const nullReadings = await prisma.waterReading.count({
    where: { serviceVisitPoolId: null },
  });
  const nullChemicals = await prisma.chemicalAdded.count({
    where: { serviceVisitPoolId: null },
  });
  if (nullReadings > 0 || nullChemicals > 0) {
    throw new Error(
      `VERIFICATION FAILED: ${nullReadings} reading(s) and ${nullChemicals} chemical(s) still have serviceVisitPoolId = null.`,
    );
  }

  console.log(`  Verified: every visit has ≥1 join; every join.companyId == pool.companyId; no null serviceVisitPoolId rows remain.`);
}

async function main() {
  console.log(
    `${APPLY ? "🚨 APPLYING" : "🔍 DRY-RUN"} — ServiceVisitPool backfill${APPLY ? "" : " (pass --apply to write)"}\n`,
  );

  const visits = await prisma.serviceVisit.findMany({
    select: { id: true, poolId: true, createdAt: true },
  });
  const pools = await prisma.pool.findMany({
    select: { id: true, companyId: true },
  });
  const existingJoins = await prisma.serviceVisitPool.findMany({
    select: { id: true, serviceVisitId: true, poolId: true },
  });
  const unbackfilledReadings = await prisma.waterReading.findMany({
    where: { serviceVisitPoolId: null },
    select: { id: true, visitId: true },
  });
  const unbackfilledChemicals = await prisma.chemicalAdded.findMany({
    where: { serviceVisitPoolId: null },
    select: { id: true, visitId: true },
  });

  const plan = buildServiceVisitPoolBackfillPlan({
    visits,
    poolCompanyIdByPoolId: Object.fromEntries(pools.map((pool) => [pool.id, pool.companyId])),
    existingJoins,
    unbackfilledReadings,
    unbackfilledChemicals,
  });

  printReport(visits.length, plan.summary);

  if (plan.orphanVisits.length > 0) {
    console.error(
      `\n❌ Aborting: ${plan.orphanVisits.length} visit(s) reference a missing pool. ` +
        `A companyId must never be guessed — resolve these before running.`,
    );
    process.exitCode = 1;
    return;
  }

  if (plan.summary.joinsToCreate === 0 && plan.summary.readingsToUpdate === 0 && plan.summary.chemicalsToUpdate === 0) {
    console.log("\n  Nothing to do — every visit already has a join row and every child is mapped.");
    return;
  }

  if (!APPLY) {
    console.log("\n  Dry-run complete. Re-run with --apply to write.");
    return;
  }

  console.log("\n  Applying…");
  await prisma.$transaction(async (tx) => {
    if (plan.joinsToCreate.length > 0) {
      // Prisma 7's createMany dropped `skipDuplicates`. Replay safety is covered
      // by the builder: it excludes visits with an existing join row (loaded
      // fresh each run), and the @@unique([serviceVisitId, poolId]) constraint
      // fails loudly on a concurrent-writer race rather than silently duping.
      const created = await tx.serviceVisitPool.createMany({
        data: plan.joinsToCreate,
      });
      console.log(`  Created ${created.count} join row(s).`);
    }

    const joinIdByVisit = await buildJoinIdByVisit([
      ...plan.readingsToUpdate,
      ...plan.chemicalsToUpdate,
    ]);

    const byJoin = new Map<string, { readings: string[]; chemicals: string[] }>();
    const push = (batch: BackfillChildBatch, kind: "readings" | "chemicals") => {
      const joinId = batch.joinId ?? joinIdByVisit.get(batch.serviceVisitId);
      if (!joinId) {
        throw new Error(
          `No join row found for visit ${batch.serviceVisitId} — cannot map its ${kind}.`,
        );
      }
      const entry = byJoin.get(joinId) ?? { readings: [], chemicals: [] };
      entry[kind] = [...entry[kind], ...batch.ids];
      byJoin.set(joinId, entry);
    };
    plan.readingsToUpdate.forEach((batch) => push(batch, "readings"));
    plan.chemicalsToUpdate.forEach((batch) => push(batch, "chemicals"));

    for (const [joinId, { readings, chemicals }] of byJoin) {
      if (readings.length > 0) {
        const result = await tx.waterReading.updateMany({
          where: { id: { in: readings }, serviceVisitPoolId: null },
          data: { serviceVisitPoolId: joinId },
        });
        console.log(`  Mapped ${result.count} reading(s) → join ${joinId}`);
      }
      if (chemicals.length > 0) {
        const result = await tx.chemicalAdded.updateMany({
          where: { id: { in: chemicals }, serviceVisitPoolId: null },
          data: { serviceVisitPoolId: joinId },
        });
        console.log(`  Mapped ${result.count} chemical(s) → join ${joinId}`);
      }
    }
  });

  await verifyAfterApply(visits);
  console.log("\n✅ Backfill applied and verified.");
  console.log("   Re-run without --apply to confirm idempotency (expect \"Nothing to do\").");
}

main()
  .catch((error) => {
    console.error("\n❌ Backfill failed:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
