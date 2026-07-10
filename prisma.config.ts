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
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
