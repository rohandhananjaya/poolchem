# src/components — component inventory

Feature components grouped by domain; shadcn/ui primitives in [ui/](ui/) (style `radix-nova`, see [../../components.json](../../components.json)). Most feature components are Client Components (`"use client"`); pages fetch via `db/` helpers and pass data down. Check the top of a file for `"use client"` before assuming.

## ui/ — shadcn primitives (don't hand-edit generated ones; re-add via CLI)
`avatar` `button` `dialog` `alert-dialog` `dropdown-menu` `tabs` `card` `card-row` `badge` `error-state` `empty-state` `input` `label` `password-input` `loading-skeleton` `pagination` `stat-tile` `shell` `sonner`
- `shell` = page frame used by every dashboard page; `sonner` = toast host; `error-state` / `empty-state` / `loading-skeleton` = shared error/empty/loading UI; `card-row` = the list-row idiom used across pools/visits/reports; `stat-tile` = KPI tile used on dashboard + admin analytics.

## dashboard/
`StatsRow` (KPI tiles) · `DashboardHeader` (greeting + realtime notification bell, reads `NotificationContext`) · `EmptyState` · `ScanFab` (floating scan button) · `RefreshButton` · `DashboardSkeleton`

## pools/
`AddPoolDialog` / `EditPoolDialog` / `DeletePoolDialog` (create/edit/delete forms, post to `pools/actions.ts`) · `PoolRow` (list card, opens `EditPoolDialog`) · `PoolActions` (edit/delete menu) · `PoolsFilters` (search/status bar) · `PoolAnalysis` (trend/detail view for `pools/[poolId]`; shows the pool's tech-scan QR inline in the pool info card — right column under the Homeowner Dashboard button — with a copy-link button, no reissue) · `ImportPoolsDialog` (CSV bulk-import: file picker, client-side preview, per-row skip/reason summary; gated by `canImportExport`) · `ExportPoolsButton` (CSV download via client-side Blob; gated by `canImportExport`) — both import/export gated behind the `csv_import` plan feature (`checkFeatureAccess`), showing a locked upsell hint when unavailable.

## visits/
`VisitCard` (dashboard list item) · `WaterReadingInput` (test-strip scan button = "coming soon") · `ChemicalRecommendations` · `AddChemicalDialog` (manual chemical entry popup; `onAdd(VisitChemical)`) · `WaterHealthGauge` · `VisitNotes` (voice recording = "coming soon") · `CancelVisitDialog` (reason-select + custom-reason confirmation UI)

## reports/
`ReportRow` · `ScoreSparkline` (inline SVG water-health trend) · `WaterHealthSummary` (gauge + at-a-glance callout, used by both report pages) · `ReportsFilters` (pool/date-range filter bar)

## schedule/
`ScheduleVisitForm` (Dialog popup with pool/date/tech-search; posts to `schedule/actions.ts`) · `ScheduleFilters` (pool filter bar)
## profile/

`ProfileForms` (account + company forms, posts to `settings/actions.ts`) — links out to `/account/api-keys` for owners · `SignOutButton` (signs out via Supabase + redirects to `/login`; on native only, unregisters the device push token first via `unregisterPushDeviceAction`)

## account/
`ApiKeysManager` (list/generate/revoke API keys for the `api_access` plan feature; one-time secret reveal on generation; locked upsell hint when `canUseApiKeys` is false — same idiom as `csv_import`/`custom_branding`) · `DownloadPostmanButton` (downloads a Postman collection pre-wired to `/api/v1` via `downloadPostmanCollectionAction`; rendered in the `ApiKeysManager` header)

## feedback/
`FeedbackForm` (client; type-segmented submit form, posts to `/feedback/actions.ts` via `submitFeedbackAction`) · `FeedbackList` (server; a user's own submissions with type/status badges) · `FeedbackStatusSelect` (client; per-row triage `<select>` on `/admin/feedback`, calls `updateFeedbackStatusAction`) · `feedback-badges` (type/status label + style maps, `FeedbackTypeBadge`, `FeedbackStatusBadge`, `formatFeedbackDate`)

## homeowner/
`share-button` (copies/shares the public pool link)

## shared/
`CompanyLogo` (Server Component; renders a company logo, used on both dashboard and public report/homeowner pages) — R2-hosted logos (origin matches `R2_PUBLIC_URL`) go through `next/image`; anything else (e.g. a legacy externally-hosted URL from before uploads existed) falls back to a plain `<img>` so an unconfigured remote host never crashes the page

## package/
`PackageBadge` / `PackageBadgeLink` (status pill: Trial/Active/Expired/Cancelled, colored; `package` may be `null` while on trial with no plan chosen) · `PayNowDialog` (first-time subscribe checkout dialog) · `SwitchPlanDialog` (shown instead of `PayNowDialog` once already on an active paid plan; upgrade = immediate + provider-prorated, downgrade = scheduled for period-end) · `PendingDowngradeNotice` (inline banner + cancel button shown when a downgrade is scheduled) · `TrialBanner` (dismissible-by-state urgency banner, rendered once in `(dashboard)/layout.tsx`) · `package-feature-fields` (`PackageFeatureFields` — admin package-form feature checkboxes, `/admin/packages`)

## admin/ — SUPER_ADMIN analytics/diagnostics dashboards (all client components, all Recharts-backed where charting)
`PlatformKPIs` (top-line stat tiles + refresh) · `RegistrationChart` (14-day user/company signups, bar) · `VisitActivityChart` (14-day completed-visit trend, area) · `SubscriptionBreakdown` (status pie chart) · `RecentRegistrations` (latest-10 signups list) — together render `getAdminDashboardData()` on the SUPER_ADMIN's `dashboard/` view (a SUPER_ADMIN has no company, so `dashboard/page.tsx` renders this platform overview instead of the normal tech/owner dashboard).
`DiagnosticsTabs` (tab shell for `admin/diagnostics`, composes the rest of this list) · `LiveServerCharts` (live CPU/memory line chart, client-polled) · `ServerHealthSummary` (compact stat tiles for the admin overview) · `ServerHealthDetails` (full server/CPU/memory/uptime stat tiles) · `LogSummaryCards` (error/warning/info count tiles) · `SystemLogViewer` (unscoped recent `SystemLog` list) · `TenantLogViewer` (per-company audit log list, `AuditLogWithUser`).

## notifications/
`NotificationProvider` (wraps the dashboard shell; drives `useRealtimeVisits(userId)`, exposes `NotificationContext` for unread count / mark-all-read, shows a dismissible new-visit alert toast) · `PushRegistration` (native-only: registers the device with `@capacitor/push-notifications`, persists the token to `localStorage["poolbench:pushToken"]`, posts it via `registerPushDeviceAction`, and routes push taps to `/visits/{id}`; mounted in `(dashboard)/layout.tsx`, no-ops in the browser)

## navigation/
`main-nav` (sidebar + mobile bottom-nav shell)

## top-level (no domain folder)
`cookie-consent-banner` (`CookieConsentBanner` — localStorage-backed consent banner, cross-tab synced via a custom event) · `upgrade-dialog` (`UpgradeDialog` — generic locked-feature upsell dialog, links to `/account/package` by default; used wherever a plan-gated feature needs a click-through prompt instead of an inline hint) · `pwa-provider` (`PwaProvider` — client wrapper around `SerwistProvider` that only registers the service worker when the origin can actually host one: secure context AND (localhost in dev, or production). Prevents the SecurityError on phones hitting the dev server over a LAN IP with the self-signed cert)
