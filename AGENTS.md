<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PoolChem — repo-level facts an agent would miss

## Framework traps

- **Next.js 16 Proxy** (NOT `middleware.ts`). File is `src/proxy.ts`, exports `proxy(request)` with `config.matcher`. Guards `/dashboard/*` and `/admin/*`. Do not create `middleware.ts`.
- **`cookies()` is async** — `createClient()` in `src/lib/supabase/server.ts` must be awaited.

## Prisma 7 (breaking changes from 5/6)

- **No `url` in `schema.prisma`.** Connection string lives in `prisma.config.ts` (for Migrate) and passed via driver adapter at runtime in `src/lib/prisma.ts`.
- **Client generated to `src/generated/prisma/`**, not `node_modules`. Import from `@/generated/prisma/client`. After schema changes: `npx prisma generate` (runs automatically via `postinstall`).
- SQLite locally — swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in `src/lib/prisma.ts` for Postgres.

## Architecture

- **Multi-tenancy invariant:** every query scoped by `companyId`. `ServiceVisit` has no `companyId` — scoped via `visit.pool.companyId`. All `db/` helpers enforce this; reads return `null` on cross-tenant miss, writes throw.
- **Auth:** Supabase (identity, sessions) bridged to Prisma `User` (app data, role, companyId) **by email**. `getCurrentUser()` in `src/lib/auth.ts` is React-cached — hits DB once per request.
- **No REST/GraphQL** — all mutations are Server Actions that re-check auth, call a `db/` helper, then `revalidatePath`. Only exception: `GET /api/stats/live` for server polling.
- Data flow: Server Components / Server Actions → `db/` helpers (`src/lib/db/`) → Prisma singleton (`src/lib/prisma.ts`). `import "server-only"` on `db/`, `auth.ts`, and chemistry types.
- **`src/lib/pool-chemistry.ts` is pure** — no I/O, no Prisma imports. Only unit-tested file (`src/lib/pool-chemistry.test.ts`). Keep it pure.

## Pre-existing codebase maps (read these before searching)

These save substantial time — they inventory every exported helper, route, and component:
- `src/lib/db/CLAUDE.md` — data-access helper signatures + tenancy rules
- `src/app/CLAUDE.md` — route map, pages ↔ helpers ↔ Server Actions
- `src/components/CLAUDE.md` — component inventory by domain
- `CLAUDE.md` (root) — architecture deep-dive, env setup, full command reference

Keep these in sync when adding/removing exports, routes, or components.

## Quick commands

```bash
npm run dev              # dev server on localhost:3000
npm run build            # runs prisma generate then next build
npm test                 # vitest run
npx vitest run -t "pattern"   # single test by name
npx prisma migrate dev --name <x>  # create + apply migration
```

Env: copy `.env.example` → `.env`. Required: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
