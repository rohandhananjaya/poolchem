# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical version notes

This project uses **Next.js 16, React 19, Prisma 7, Tailwind v4, and Zod v4** — all with breaking changes from older versions. Specific traps:
- **Middleware → Proxy:** `src/proxy.ts` exports `proxy(request)` with `config.matcher` — do not create `middleware.ts`.
- **`cookies()` is async:** `createClient()` in `src/lib/supabase/server.ts` must be awaited.
- **Prisma 7:** no `url` in `schema.prisma`; client at `src/generated/prisma/` (import from `@/generated/prisma/client`). Never edit generated files by hand.
- **`prisma-client` generator** (not `prisma-client-js`) requires explicit `output` path — already set.
- **Tailwind v4:** CSS-first config (no `tailwind.config`), `@/*` → `src/*`.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build (runs prisma generate then next build)
npm run lint         # eslint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
npx vitest run -t "reports a balanced pool"   # single test by name
npx prisma generate  # regenerate client into src/generated/prisma
npx prisma migrate dev --name <x>  # create + apply a migration
```

Environment: copy [.env.example](.env.example) → `.env`. Required: `DATABASE_URL` (SQLite `file:./dev.db` for local dev), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Codebase maps (read these before searching)

These save time by inventorying every export:
- [src/lib/db/CLAUDE.md](src/lib/db/CLAUDE.md) — data-access helper signatures + tenancy rules
- [src/app/CLAUDE.md](src/app/CLAUDE.md) — route map, pages ↔ helpers ↔ Server Actions
- [src/components/CLAUDE.md](src/components/CLAUDE.md) — component inventory by domain

Keep in sync when adding/removing an exported helper, route, or component.

## Architecture summary

Poolbench is a **multi-tenant SaaS** for pool-service companies. Techs record water-test readings during service visits; the app scores water health and recommends chemical doses.

**Data flow:** Server Components / Server Actions → `db/` helpers → Prisma. No REST/GraphQL API layer — all mutations are Server Actions that re-check auth, call a `db/` helper, then `revalidatePath`.

**Multi-tenancy:** Every record belongs to a `Company`. Nothing is queried without `companyId`. `ServiceVisit` has no `companyId` of its own — scoped via `visit.pool.companyId`.

**Auth:** Supabase (identity, sessions) bridged to Prisma `User` (app data, role, `companyId`) **by email**. `getCurrentUser()` is React-cached — hits DB once per request.

**Framework:** Next.js 16 App Router, `(dashboard)` route group with sidebar/bottom-nav shell. shadcn/ui style `radix-nova`, Tailwind v4, `@/*` → `src/*`.

**Database:** SQLite for local dev; target is Supabase Postgres. Keep schema field types portable. (See **prisma-db** skill for Prisma 7 specifics.)
