import { defineConfig, env } from "@prisma/config";

// Prisma 7 no longer auto-loads `.env` for the config file; load it ourselves.
// `process.loadEnvFile` is built into Node 20.12+/22, so no dotenv dependency.
try {
  process.loadEnvFile();
} catch {
  // No .env file present (e.g. CI where vars are already in the environment).
}

// Prisma 7 moved the datasource connection URL out of schema.prisma and into
// this config file (used by Migrate / introspection). At runtime, PrismaClient
// is instantiated with a driver adapter instead.
//
// The `provider` field in schema.prisma can't be driven by env() — it's tied
// to one SQL dialect (and one migration history) at a time. Local dev stays on
// SQLite (prisma/schema.prisma); production points at Postgres via a schema
// derived at build time (scripts/prepare-postgres-schema.mjs → schema.postgres.prisma).
// Picking the schema path off DATABASE_URL here means `prisma generate`/`db push`/
// `migrate` all target the right one automatically, no --schema flag needed.
const isPostgres = process.env.DATABASE_URL?.startsWith("postgres");

export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
