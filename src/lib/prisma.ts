import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 has no `url` in schema.prisma — the runtime client is instantiated
// with a driver adapter. Local dev runs SQLite (file:./dev.db); production runs
// Supabase Postgres. The schema/migrations behind each are picked the same way
// in prisma.config.ts — keep the two in sync.
const createPrismaClient = () => {
  const url = process.env.DATABASE_URL!;
  return new PrismaClient({
    adapter: url.startsWith("postgres")
      ? new PrismaPg({ connectionString: url })
      : new PrismaBetterSqlite3({ url }),
  });
};

// Reuse a single client across hot reloads in dev to avoid exhausting handles.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
