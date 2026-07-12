---
name: prisma-db
description: PoolChem's Prisma 7 schema, connection, and migration patterns. Breaking changes from Prisma 5/6 are enumerated. Triggers on: editing prisma/schema.prisma, src/lib/prisma.ts, prisma.config.ts, or any file importing from @/generated/prisma/client.
---

# Prisma 7 Database Layer

## Breaking changes from Prisma 5/6

- **No `url` in `schema.prisma`.** Connection string lives in `prisma.config.ts` (for Migrate) and is passed via driver adapter at runtime in `src/lib/prisma.ts`.
- **Client generated to `src/generated/prisma/`**, not `node_modules`. Import from `@/generated/prisma/client`. After schema changes: run `npx prisma generate` (runs automatically via `postinstall`).
- **Default generator is `prisma-client`** (successor to `prisma-client-js`) and requires an explicit `output` path — already set in `prisma/schema.prisma`.
- **`prisma.config.ts`** no longer auto-loads `.env`; the config file calls `process.loadEnvFile()` explicitly.

## Runtime client (`src/lib/prisma.ts`)

```ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- SQLite locally with `@prisma/adapter-better-sqlite3`.
- To migrate to Supabase Postgres: swap adapter to `@prisma/adapter-pg` pointed at the Supabase connection string.
- Singleton pattern: reused across hot reloads via `globalThis`.

## Migration

```bash
npx prisma migrate dev --name <x>   # create + apply migration
npx prisma generate                 # regenerate client into src/generated/prisma
```

- In development, the SQLite DB file is `dev.db` (set via `DATABASE_URL=file:./dev.db`).
- Keep schema field types portable — avoid SQLite-only tricks since the target is Postgres.
