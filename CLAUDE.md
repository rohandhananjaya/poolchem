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
npm run dev          # dev server (https://localhost:3000, self-signed cert via --experimental-https)
npm run build        # production build (runs prisma generate then next build)
npm run lint         # eslint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
npm start            # start production server (after build)
npm run test:e2e     # Playwright e2e tests
npm run test:e2e:ui  # Playwright e2e tests, headed
npm run db:migrate   # prisma migrate deploy (production migrations)
npm run db:seed      # tsx scripts/seed.ts
npm run cap:sync     # Capacitor: copy web assets + bake config into android/ & ios/
npm run cap:android  # Capacitor: open the Android project in Android Studio
npm run cap:ios      # Capacitor: open the iOS project in Xcode (requires macOS)
npm run assets:generate  # regenerate native icons/splashes from assets/logo.png (android+ios only; do NOT use --pwa — it clobbers src/app/manifest.ts)
npx vitest run -t "reports a balanced pool"   # single test by name
npx prisma generate  # regenerate client into src/generated/prisma
npx prisma migrate dev --name <x>  # create + apply a migration
```

Environment: copy [.env.example](.env.example) → `.env`. Required: `DATABASE_URL` (SQLite `file:./dev.db` for local dev), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Codebase maps (read these before searching)

These save time by inventorying every export:
- [src/lib/db/CLAUDE.md](src/lib/db/CLAUDE.md) — data-access helper signatures + tenancy rules
- [src/lib/offline/CLAUDE.md](src/lib/offline/CLAUDE.md) — client-side Dexie/IndexedDB offline persistence (drafts + mutation queue)
- [src/app/CLAUDE.md](src/app/CLAUDE.md) — route map, pages ↔ helpers ↔ Server Actions
- [src/components/CLAUDE.md](src/components/CLAUDE.md) — component inventory by domain

Keep in sync when adding/removing an exported helper, route, or component.

## Architecture summary

Poolbench is a **multi-tenant SaaS** for pool-service companies. Techs record water-test readings during service visits; the app scores water health and recommends chemical doses.

**Data flow:** Server Components / Server Actions → `db/` helpers → Prisma. All mutations are Server Actions that re-check auth, call a `db/` helper, then `revalidatePath` — no internal REST/GraphQL layer for the dashboard itself. A separate read-only `api/v1` REST API (bearer-token auth) exists for external integrations gated behind the `api_access` plan feature; see `src/app/CLAUDE.md`.

**Multi-tenancy:** Every record belongs to a `Company`. Nothing is queried without `companyId`. `ServiceVisit` has no `companyId` of its own — scoped via `visit.pool.companyId`.

**Auth:** Supabase (identity, sessions) bridged to Prisma `User` (app data, role, `companyId`) **by email**. `getCurrentUser()` is React-cached — hits DB once per request.

**Framework:** Next.js 16 App Router, `(dashboard)` route group with sidebar/bottom-nav shell. shadcn/ui style `radix-nova`, Tailwind v4, `@/*` → `src/*`.

**Database:** SQLite for local dev; target is Supabase Postgres. Keep schema field types portable. (See **prisma-db** skill for Prisma 7 specifics.)

## Mobile (Capacitor shell)

The Android/iOS apps are a thin Capacitor WebView (`android/`, `ios/`, `capacitor.config.ts`) that loads the **deployed Next.js app** via `server.url` — the app is server-rendered, so it can't be bundled. Config is resolved at `cap sync` time: set `POOLBENCH_NATIVE_URL` to the production Vercel URL (or a live https dev server) before syncing, then re-sync after changing it. Native icon/splash sources live in `assets/logo.png` (regenerate with `npm run assets:generate`).

## Native push

Visit-assignment notifications are delivered natively (FCM on Android, APNs on iOS) when the app is backgrounded/killed; in-app realtime alerts (`useRealtimeVisits`) remain the foreground channel.

**Pipeline:** `schedule/actions.ts` → `notifyVisitAssigned` (`src/lib/push/notify.ts`) → `sendPush` (`src/lib/push/index.ts`) → provider (`fcm.ts`/`apns.ts`) → platform token from `pushDevices`. Providers are **env-gated and lazily constructed** — with no credentials configured they no-op silently (`sendPush` never throws).

- Device tokens: `registerPushDeviceAction`/`unregisterPushDeviceAction` (`src/app/(dashboard)/push/actions.ts`) → `src/lib/db/push-devices.ts`. Registration fires from `src/components/notifications/PushRegistration.tsx` (native only, token cached in `localStorage["poolbench:pushToken"]`, unregistered on sign-out).
- `updateVisit` (`src/lib/db/visits.ts`) returns `{ visit, previousTechId } | null` so callers can detect tech reassignment (the only case where a notification should also fire for the *previous* tech).
- Env: `FCM_SERVICE_ACCOUNT_JSON`, `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_KEY` (base64 p8), `APNS_TOPIC` (default `com.poolbench.app`), `APNS_SANDBOX`. See `.env.example`.
- Tests: `src/lib/push/jwt.test.ts` (RS256/ES256 known-vector), `notify.test.ts`, `src/lib/db/push-devices.test.ts`, `src/app/(dashboard)/push/actions.test.ts`, plus `schedule/actions.test.ts` and `visits.test.ts` for the reassignment shape.
