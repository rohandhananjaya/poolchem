/**
 * Backfills nine weekly historical COMPLETED visits (trending from a
 * neglected FAIR score up to the score of the given visit) for the pool
 * behind `visitId`, so the marketing pool-analysis screenshot shows a real
 * score/parameter trend instead of a single data point.
 *
 * Invoked from e2e/screenshots.spec.ts via execSync/tsx (not imported
 * directly) because Playwright's own TS loader can't load the generated
 * Prisma client's ESM output.
 *
 * Usage: tsx scripts/seed-screenshot-trend.ts <visitId>
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";

try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI where vars are already in the environment).
}

const HISTORICAL_READINGS = [
  { daysBefore: 63, ph: 7.1, freeChlorine: 1.2, totalAlkalinity: 65, calciumHardness: 170, cyanuricAcid: 20, temperature: 78 },
  { daysBefore: 56, ph: 7.15, freeChlorine: 1.4, totalAlkalinity: 70, calciumHardness: 180, cyanuricAcid: 24, temperature: 79 },
  { daysBefore: 49, ph: 7.2, freeChlorine: 1.6, totalAlkalinity: 78, calciumHardness: 195, cyanuricAcid: 27, temperature: 80 },
  { daysBefore: 42, ph: 7.25, freeChlorine: 1.9, totalAlkalinity: 85, calciumHardness: 210, cyanuricAcid: 30, temperature: 80 },
  { daysBefore: 35, ph: 7.3, freeChlorine: 2.1, totalAlkalinity: 90, calciumHardness: 225, cyanuricAcid: 33, temperature: 81 },
  { daysBefore: 28, ph: 7.35, freeChlorine: 2.4, totalAlkalinity: 95, calciumHardness: 240, cyanuricAcid: 36, temperature: 81 },
  { daysBefore: 21, ph: 7.4, freeChlorine: 2.6, totalAlkalinity: 98, calciumHardness: 250, cyanuricAcid: 39, temperature: 82 },
  { daysBefore: 14, ph: 7.4, freeChlorine: 2.8, totalAlkalinity: 100, calciumHardness: 260, cyanuricAcid: 42, temperature: 82 },
  { daysBefore: 7, ph: 7.4, freeChlorine: 2.9, totalAlkalinity: 100, calciumHardness: 268, cyanuricAcid: 44, temperature: 82 },
];

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

async function main() {
  const latestVisitId = process.argv[2];
  if (!latestVisitId) {
    throw new Error("Usage: tsx scripts/seed-screenshot-trend.ts <visitId>");
  }

  const latestVisit = await prisma.serviceVisit.findUniqueOrThrow({
    where: { id: latestVisitId },
  });
  const poolId = latestVisit.poolId;
  const techId = latestVisit.techId!;
  const latestVisitDate = latestVisit.createdAt;

  for (const r of HISTORICAL_READINGS) {
    const visitDate = new Date(
      latestVisitDate.getTime() - r.daysBefore * 24 * 60 * 60 * 1000,
    );
    const readingDate = new Date(visitDate.getTime() + 15 * 60 * 1000);
    await prisma.serviceVisit.create({
      data: {
        poolId,
        techId,
        status: "COMPLETED",
        scheduledAt: visitDate,
        createdAt: visitDate,
        updatedAt: readingDate,
        waterReadings: {
          create: {
            ph: r.ph,
            freeChlorine: r.freeChlorine,
            totalAlkalinity: r.totalAlkalinity,
            calciumHardness: r.calciumHardness,
            cyanuricAcid: r.cyanuricAcid,
            temperature: r.temperature,
            createdAt: readingDate,
          },
        },
      },
    });
  }

  console.log(`Seeded ${HISTORICAL_READINGS.length} historical visits for pool ${poolId}.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed historical visits:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
