<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PoolChem — repo-level facts an agent would miss

## Framework traps (critical — never miss these)

- **Next.js 16 Proxy** (NOT `middleware.ts`). File is `src/proxy.ts`, exports `proxy(request)` with `config.matcher`. Guards `/dashboard/*` and `/admin/*`. Do not create `middleware.ts`.
- **`cookies()` is async** — `createClient()` in `src/lib/supabase/server.ts` must be awaited.
- **Prisma 7:** no `url` in `schema.prisma`; client generated to `src/generated/prisma/` (import from `@/generated/prisma/client`).

## Available skills (load the relevant one before deeper work)

Load with the `skill` tool when your task matches:
- **prisma-db** — load when touching Prisma schema, client, or migrations
- **auth-tenancy** — load when editing auth, proxy, or data-access code
- **solid-principles** — load before any code change
- **testing-patterns** — load when writing tests
- **chemistry-engine** — load when editing pool-chemistry logic
- **ui-design** — load when building/editing UI

## Pre-existing codebase maps (read these before searching)

These save substantial time — they inventory every exported helper, route, and component:
- `src/lib/db/CLAUDE.md` — data-access helper signatures + tenancy rules
- `src/app/CLAUDE.md` — route map, pages ↔ helpers ↔ Server Actions
- `src/components/CLAUDE.md` — component inventory by domain
- `CLAUDE.md` (root) — critical version notes, commands, overview

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
