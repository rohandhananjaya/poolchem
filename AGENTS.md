<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Poolbench — repo-level facts an agent would miss

## Framework traps

- **Proxy** (NOT `middleware.ts`): `src/proxy.ts`, guards `/dashboard/*` `/admin/*`.
- **`cookies()` is async** — `createClient()` in `src/lib/supabase/server.ts` must be awaited.
- **Prisma 7:** no `url` in schema; client at `@/generated/prisma/client`.
- **Capacitor shell:** `capacitor.config.ts` + `android/` + `ios/`. The native apps load the deployed Next.js app remotely (`server.url`, from `POOLBENCH_NATIVE_URL`); baked at `cap sync` time. Never run `@capacitor/assets` with `--pwa` (clobbers `src/app/manifest.ts`).
- **Native push:** `src/lib/push/*` (FCM + APNs, env-gated no-op providers) + `src/lib/db/push-devices.ts` + `src/app/(dashboard)/push/actions.ts`. Fires from `schedule/actions.ts` via `notifyVisitAssigned`. `updateVisit` returns `{ visit, previousTechId } | null` to detect reassignment.

## Skills (load with `skill` tool)

- **prisma-db** — Prisma schema, client, migrations
- **auth-tenancy** — auth, proxy, data-access code
- **solid-principles** — before any code change
- **testing-patterns** — when writing tests
- **chemistry-engine** — pool-chemistry logic
- **ui-design** — building/editing UI

## Codebase maps (read before searching)

- `src/lib/db/CLAUDE.md` — helper signatures + tenancy
- `src/lib/offline/CLAUDE.md` — client-side Dexie/IndexedDB offline persistence (drafts + mutation queue)
- `src/app/CLAUDE.md` — route map, pages ↔ actions
- `src/components/CLAUDE.md` — component inventory
- `CLAUDE.md` (root) — overview + commands

## Commands (slash commands available in opencode)

- **`/implement <key>`** — fetches a Jira issue (e.g., `KAN-123`) or board (`KAN`) and implements the described feature. Defined in `.opencode/commands/implement.md`.

Keep in sync when adding/removing exports, routes, or components.

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
