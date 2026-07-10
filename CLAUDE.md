# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical version notes

This project uses **Next.js 16, React 19, Prisma 7, Tailwind v4, and Zod v4** — all with breaking changes from older versions. Verify against `node_modules/next/dist/docs/` (per AGENTS.md) before writing framework code. Specific traps already handled in this repo:

- **Middleware is now "Proxy".** The auth/session logic lives in [src/proxy.ts](src/proxy.ts), exporting a `proxy(request)` function — not `middleware.ts`/`middleware()`.
- **`cookies()` is async.** `createClient()` in [src/lib/supabase/server.ts](src/lib/supabase/server.ts) is async — always `await` it.
- **Prisma 7 has no `url` in `schema.prisma`.** The connection string lives in [prisma.config.ts](prisma.config.ts) (for Migrate) and is passed to `PrismaClient` via a **driver adapter** at runtime ([src/lib/prisma.ts](src/lib/prisma.ts)).
- **Prisma client is generated to [src/generated/prisma/](src/generated/prisma/)**, not `node_modules`. Import types/client from `@/generated/prisma/client`. This directory is generated — never edit it by hand; run `npx prisma generate` after schema changes.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build
npm run lint         # eslint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode

# run a single test file / test by name
npx vitest run src/lib/pool-chemistry.test.ts
npx vitest run -t "reports a balanced pool"

# Prisma (after editing prisma/schema.prisma)
npx prisma generate                 # regenerate client into src/generated/prisma
npx prisma migrate dev --name <x>   # create + apply a migration (dev.db)
```

Environment: copy the keys in [.env](.env) — `DATABASE_URL` (SQLite `file:./dev.db` for local dev) plus `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Architecture

PoolChem is a **multi-tenant SaaS** for pool-service companies. Techs record water-test readings during service visits; the app scores water health and recommends chemical doses.

### Multi-tenancy (the central invariant)
Every record belongs to a `Company` (the tenant). **Nothing is queried without scoping to a `companyId`.**
- `Company → User → ServiceVisit`, and `Company → Pool → ServiceVisit`. A `ServiceVisit` has **no `companyId` of its own** — it is scoped through its pool (`visit.pool.companyId`). All visit queries in [src/lib/db/visits.ts](src/lib/db/visits.ts) filter on `pool: { companyId }`, so a visit can never leak across tenants.
- Get the tenant with `getCompanyId()` / `requireAuth()` from [src/lib/auth.ts](src/lib/auth.ts) and pass it into the `db/` helpers. Read helpers return `null` on a cross-tenant miss; write helpers throw.

### Auth: Supabase for identity, Prisma `User` for app data
Two identity layers linked **by email**:
- Supabase Auth owns sessions/credentials (password + Google OAuth). Clients: [src/lib/supabase/client.ts](src/lib/supabase/client.ts) (browser) and [src/lib/supabase/server.ts](src/lib/supabase/server.ts) (server).
- Our Prisma `User` table carries `companyId`, `role`, `name`. `getCurrentUser()` in [src/lib/auth.ts](src/lib/auth.ts) bridges them: `supabase.auth.getUser()` → `prisma.user.findUnique({ where: { email } })`. It is wrapped in React `cache` so it hits the DB once per request.
- [src/proxy.ts](src/proxy.ts) refreshes the Supabase session on every request **and** guards routes (`/dashboard/*` requires a session; logged-in users are bounced off `/login`). OAuth redirects land at [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts).

### Data flow
Server Components / Server Actions → `db/` helpers ([src/lib/db/](src/lib/db/)) → Prisma. There is **no REST/GraphQL API layer**; mutations are Server Actions (e.g. [src/app/(dashboard)/visits/[visitId]/actions.ts](src/app/(dashboard)/visits/%5BvisitId%5D/actions.ts)), which re-check auth, call a `db/` helper, then `revalidatePath`. Keep the `import "server-only"` guard on `db/`, `auth.ts`, and the chemistry types.

### The chemistry engine — [src/lib/pool-chemistry.ts](src/lib/pool-chemistry.ts)
The domain core: **pure, dependency-free functions** (no I/O, no Prisma import) — `calculateLSI`, `getWaterHealthScore`, `getChemicalRecommendations`, `getIdealRange`. Its `WaterReadingInput` field names deliberately mirror the Prisma `WaterReading` model so a persisted reading passes in directly. Because it is pure it is the one thing with unit tests ([src/lib/pool-chemistry.test.ts](src/lib/pool-chemistry.test.ts)) — keep it that way; don't add I/O here.

### UI
App Router with a `(dashboard)` route group under [src/app/(dashboard)/](src/app/%28dashboard%29/) that shares [layout.tsx](src/app/%28dashboard%29/layout.tsx) (sidebar/bottom-nav shell). Components: shadcn/ui primitives in [src/components/ui/](src/components/ui/) (style `radix-nova`, configured in [components.json](components.json)), feature components elsewhere under [src/components/](src/components/). Tailwind v4 (config in CSS, not `tailwind.config`). `@/*` maps to `src/*`.

### Database migration note
Currently **SQLite** for local dev; intended to move to **Supabase Postgres**. Keep schema field types portable (avoid SQLite-only tricks). To migrate: swap the driver adapter in [src/lib/prisma.ts](src/lib/prisma.ts) to `@prisma/adapter-pg` and update the datasource `provider`.
