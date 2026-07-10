# src/app — routes (App Router)

Next.js 16 App Router. Pattern: **Server Component page → `db/` helper → render**; mutations are **Server Actions** (`actions.ts`) that re-check auth, call a `db/` helper, then `revalidatePath`. No REST/GraphQL layer. Each route folder also has `loading.tsx` / `error.tsx` where present (Suspense + error boundaries) — omitted below.

## Auth boundary
[../proxy.ts](../proxy.ts) (NOT `middleware.ts`) refreshes the Supabase session and guards `/dashboard/*`. OAuth lands at `auth/callback/route.ts`.

## Public routes
- `page.tsx` — marketing/landing
- `login/page.tsx` — password + Google OAuth
- `pool/[poolToken]/page.tsx` — **public** homeowner dashboard (no auth); reads via `getPoolByPublicToken` / `getHomeownerDashboard`
- `not-found.tsx`, `error.tsx`, `layout.tsx` (root)

## (dashboard)/ — auth-required route group, shared `layout.tsx` (nav shell)
- `dashboard/` — home; `getDashboardData(companyId)`
- `scan/` — QR scan entry. `actions.ts`: `startVisitFromScan`
- `visits/[visitId]/` — the visit form. `page.tsx` → `visit-form.tsx` (client).
  `actions.ts`: `saveDraftAction`, `completeVisitAction`
  - `report/` — generated service report. `page.tsx` uses `generateServiceReport`; `report-actions.tsx` (mailto send + external QR — both MVP placeholders, see [../../to-do.md](../../to-do.md))
- `schedule/` — upcoming visits; `getScheduleData`. `actions.ts`: `scheduleVisitAction`
- `reports/` — water-health report history; `getCompanyReportData`
- `profile/` — account + company settings. `actions.ts`: `updateAccountAction`, `updateCompanyAction`

## Conventions
- Server Actions live beside the page in `actions.ts` / `*-actions.tsx`; always re-auth inside the action (don't trust the client).
- Data helpers are in [../lib/db/](../lib/db/); aggregation/report building in [../lib/reports/](../lib/reports/).
