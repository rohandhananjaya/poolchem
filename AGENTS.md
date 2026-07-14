<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PoolBench — repo-level facts an agent would miss

## Framework traps

- **Proxy** (NOT `middleware.ts`): `src/proxy.ts`, guards `/dashboard/*` `/admin/*`.
- **`cookies()` is async** — `createClient()` in `src/lib/supabase/server.ts` must be awaited.
- **Prisma 7:** no `url` in schema; client at `@/generated/prisma/client`.

## Skills (load with `skill` tool)

- **prisma-db** — Prisma schema, client, migrations
- **auth-tenancy** — auth, proxy, data-access code
- **solid-principles** — before any code change
- **testing-patterns** — when writing tests
- **chemistry-engine** — pool-chemistry logic
- **ui-design** — building/editing UI

## Codebase maps (read before searching)

- `src/lib/db/CLAUDE.md` — helper signatures + tenancy
- `src/app/CLAUDE.md` — route map, pages ↔ actions
- `src/components/CLAUDE.md` — component inventory
- `CLAUDE.md` (root) — overview + commands

Keep in sync when adding/removing exports, routes, or components.
