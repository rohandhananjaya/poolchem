import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 has no `url` in schema.prisma — the runtime client is instantiated
// with a driver adapter. We're on SQLite for local dev; swap this adapter for
// `@prisma/adapter-pg` (pointed at the Supabase connection string) when the DB
// migrates to Supabase Postgres.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  });

// Reuse a single client across hot reloads in dev to avoid exhausting handles.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
