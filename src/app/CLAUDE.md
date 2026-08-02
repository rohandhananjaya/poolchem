# src/app — routes (App Router)

Next.js 16 App Router. Pattern: **Server Component page → `db/` helper → render**; mutations are **Server Actions** (`actions.ts`) that re-check auth, call a `db/` helper, then `revalidatePath`. No REST/GraphQL layer. Each route folder also has `loading.tsx` / `error.tsx` where present (Suspense + error boundaries) — omitted below.

## Auth boundary
[../proxy.ts](../proxy.ts) (NOT `middleware.ts`) refreshes the Supabase session and guards `/dashboard/*`. OAuth lands at `auth/callback/route.ts`.

## Public routes
- `page.tsx` — marketing/landing
- `setup/page.tsx` — one-time platform-admin bootstrap wizard; redirects to `/login` once a SUPER_ADMIN exists. `actions.ts`: `setupAction`
- `login/page.tsx` — password + Google OAuth; redirects to `/setup` while no SUPER_ADMIN exists
- `signup/page.tsx` — creates a Company + OWNER user; redirects to `/setup` while no SUPER_ADMIN exists
- `pool/[poolToken]/page.tsx` — **public** homeowner dashboard (no auth); reads via `getPoolByPublicToken` / `getHomeownerDashboard`
- `report/[reportToken]/page.tsx` — **public** shareable service report (no auth); reads via `getPublicReport`
- `onboarding/page.tsx` — post-signup setup wizard (needs a session but sits outside `(dashboard)`); prompts to fill in company phone/address and add a first pool if either is missing. `actions.ts`: `updateCompanyDetailsAction`, `createFirstPoolAction`
- `invite/[token]/page.tsx` — accept-invitation page; 404s via `getValidInvitation` if the token is invalid/expired/already accepted. `actions.ts`: `acceptInvitationAction`
- `not-found.tsx`, `error.tsx`, `layout.tsx` (root)
- `sw.ts` — **PWA service worker** (Serwist via `@serwist/turbopack`); compiled and served through `serwist/[path]/route.ts` (`createSerwistRoute`) at `/serwist/sw.js`
- `manifest.ts` — **PWA web manifest** served at `/manifest.webmanifest` (name, standalone display, theme/background color, 192/512 icons in `public/icons/`)
- `serwist/[path]/route.ts` — Route Handler backing the service worker; wired in [../next.config.ts](../next.config.ts) via `withSerwist` from `@serwist/turbopack` and registered client-side by `<SerwistProvider>` in `layout.tsx`
- `icon.tsx` — 32×32 favicon (the PWA/Apple icons are static PNGs in `public/icons/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)

### (public)/ — **stale**: these routes don't exist yet
This section previously listed a `(public)/` route group (blog, about-us, services, contact-us, features, pricing, documentation) — none of it exists in the repo (confirmed via glob). Don't assume any of these pages are there; build them if/when actually needed.

## (dashboard)/ — auth-required route group, shared `layout.tsx` (nav shell)
- `dashboard/` — home; `getDashboardData(companyId)`. For SUPER_ADMIN (no `companyId`), renders a platform-overview dashboard instead via `getAdminDashboardData()` + `getServerHealthSummary()` (`<PlatformKPIs>`, `<ServerHealthSummary>`, `<LiveServerCharts>`, etc.)
- `pools/`, `pools/[poolId]/` — pool list (`getPoolsPaginated`, CSV import/export, filters) + `PoolAnalysis` detail/trend page (`requireTech`; `getPoolById` + `getVisitHistory` + `getWaterHealthScore`). `actions.ts`: `createPoolAction`, `updatePoolAction`, `deletePoolAction`, `importPoolsAction`, `exportPoolsAction`
- `team/` — OWNER-only per-company user + invitation management (`requireOwner`; `getUsersByCompany` + `getInvitationsByCompany`) — distinct from `admin/users`, which is cross-tenant/SUPER_ADMIN. `actions.ts`: `createTeamUserAction`, `updateTeamUserAction`, `deleteTeamUserAction`, `inviteTeamUserAction`
- `scan/` — QR scan entry. `actions.ts`: `startVisitFromScan`
- `visits/[visitId]/` — the visit form. `page.tsx` → `visit-form.tsx` (client), `status-dropdown.tsx`.
  `actions.ts`: `saveDraftAction`, `completeVisitAction`, `startVisitAction`, `updateVisitStatusAction`
  - `report/` — generated service report. `page.tsx` uses `generateServiceReport`; `report-actions.tsx` (mailto send + external QR — both MVP placeholders, see [../../to-do.md](../../to-do.md))
- `schedule/` — upcoming visits; `getScheduleData`. `actions.ts`: `scheduleVisitAction`
- `reports/` — water-health report history; `getCompanyReportData`
- `settings/` — account + company settings. `actions.ts`: `updateAccountAction`, `updateCompanyAction`
- `feedback/` — user-submitted support requests (bug reports / feature requests / general issues). `page.tsx` → `getFeedbackByUser` + `<FeedbackForm>` / `<FeedbackList>`. `actions.ts`: `submitFeedbackAction` (re-auth → validate → `createFeedback` → `revalidatePath`). Reachable from a "Report a problem" link on the Settings page.
- `account/package/` — tenant's own plan page (trial status, feature checklist, compare/pay/switch plans). `actions.ts`: `createPaymentAction`/`confirmPayPalSubscriptionAction` (first-time subscribe), `switchPackageAction`/`cancelScheduledDowngradeAction` (upgrade immediately or schedule a downgrade for period-end, once already on a paid plan), `confirmPayPalUpgradeAction` (completes an upgrade PayPal sent the subscriber off to re-approve — called from `page.tsx`'s render on the `?paypal_upgrade=1&package=` return leg, same pattern as `confirmPayPalSubscriptionAction`), `payNowAction`/`simulateSwitchAction` (dev/no-provider stand-ins, not wired to any button), `startTrialAction`, `getCurrentPackageAction`
- `account/api-keys/` — OWNER-only API key management (`api_access` plan feature), gated the same way as `custom_branding`/`csv_import`. `page.tsx` → `getApiKeysByCompany` + `<ApiKeysManager>`. `actions.ts`: `createApiKeyAction` (re-checks `api_access`, returns the plaintext secret once), `revokeApiKeyAction`, `downloadPostmanCollectionAction` (builds a Postman collection for `/api/v1` rooted at `NEXT_PUBLIC_APP_URL`)

### admin/ — SUPER_ADMIN-only (each page calls `requireSuperAdmin()` itself; no shared `admin/layout.tsx` gate)
- `admin/page.tsx` — trivial redirect to `/dashboard`
- `admin/companies/`, `admin/companies/[companyId]/` — company list + detail/edit. `admin/companies/[companyId]/invitation-actions.ts`: `sendInvitationAction` (separate actions file beside the detail page's own `actions.ts`)
- `admin/users/` — cross-tenant user management
- `admin/diagnostics/` — server health / system log viewer
- `admin/packages/` — plan catalog CRUD (pricing/features/sort order) + platform trial-length setting + per-company plan/status override. `actions.ts`: `createPackageAction`, `updatePackageAction`, `deletePackageAction`, `adminSetCompanyPackageAction`, `updateTrialDaysAction`
- `admin/feedback/` — all user feedback submissions across tenants, with type/status filters + pagination and per-row triage. `page.tsx` → `getAllFeedback` + `<FeedbackStatusSelect>`. `actions.ts`: `updateFeedbackStatusAction`

## src/app/api/v1/ — REST API for the `api_access` plan feature
Bearer-token auth (`Authorization: Bearer <key>`), NOT Supabase cookies — see `authenticateApiKey` in [../lib/api-keys/auth.ts](../lib/api-keys/auth.ts). Excluded from `proxy.ts`'s matcher entirely. Read-only (GET) in v1; each handler re-checks `api_access` live and enforces a per-key rate limit (`checkAndIncrementRateLimit`) before calling the same `db/` helpers the dashboard uses.
- `pools/route.ts`, `pools/[poolId]/route.ts`
- `visits/route.ts` (paginated/filterable via `getCompanyReportData`), `visits/[visitId]/route.ts`
- `schedule/route.ts`

## src/app/api/public/ — public, unauthenticated, read-only endpoints for external sites
No Bearer token, no CORS headers — meant to be called server-to-server (e.g. a Next.js `rewrites()` proxy on another site), not directly from a browser.
- `packages/route.ts` — `GET` → `{ packages: PackageInfo[] }` via `getAllPackages()`; backs the website's live pricing table

## src/app/api/stats/live/ and src/app/api/webhooks/ — standalone, not part of `api/v1`
- `stats/live/route.ts` — pre-existing, unauthenticated server-stats endpoint (unrelated to API keys); lives at `api/stats/live`, **not** under `api/v1`
- `webhooks/stripe/route.ts`, `webhooks/paypal/route.ts` — `POST` handlers for provider payment events; verify the provider signature, then call `handlePaymentSuccess` / `handleSubscriptionCancelled` (`db/packages.ts`) — see `getCompanyBySubscriptionId` in `db/company.ts` for stale-cancellation disambiguation

## Conventions
- Server Actions live beside the page in `actions.ts` / `*-actions.tsx`; always re-auth inside the action (don't trust the client).
- Data helpers are in [../lib/db/](../lib/db/); aggregation/report building in [../lib/reports/](../lib/reports/).
