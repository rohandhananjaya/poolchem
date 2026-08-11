# src/components — component inventory

Feature components grouped by domain; shadcn/ui primitives in [ui/](ui/) (style `radix-nova`, see [../../components.json](../../components.json)). Most feature components are Client Components (`"use client"`); pages fetch via `db/` helpers and pass data down. Check the top of a file for `"use client"` before assuming.

## ui/ — shadcn primitives (don't hand-edit generated ones; re-add via CLI)
`avatar` `button` `dialog` `alert-dialog` `dropdown-menu` `tabs` `card` `card-row` `badge` `error-state` `empty-state` `input` `label` `password-input` `loading-skeleton` `pagination` `stat-tile` `shell` `sonner` `turnstile-widget`
- `shell` = page frame used by every dashboard page; `sonner` = toast host; `error-state` / `empty-state` / `loading-skeleton` = shared error/empty/loading UI; `card-row` = the list-row idiom used across pools/visits/reports; `stat-tile` = KPI tile used on dashboard + admin analytics; `turnstile-widget` = `TurnstileWidget` + `isTurnstileEnabled()`, Cloudflare Turnstile bot-check used on `/signup` and `/login` (renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, or when `NEXT_PUBLIC_TURNSTILE_ENABLED="false"` — an explicit master off-switch that doesn't require removing the keys — see `src/lib/turnstile.ts` for the server-side verification half).

## dashboard/
`StatsRow` (KPI tiles) · `DashboardHeader` (greeting + realtime notification bell, reads `NotificationContext`) · `EmptyState` · `ScanFab` (floating scan button) · `RefreshButton` · `DashboardSkeleton`

## pools/
`AddPoolDialog` / `EditPoolDialog` / `DeletePoolDialog` (create/edit/delete forms, post to `pools/actions.ts`) · `PoolRow` (list card, opens `EditPoolDialog`) · `PoolActions` (edit/delete menu) · `PoolsFilters` (search/status bar) · `PoolAnalysis` (trend/detail view for `pools/[poolId]`; shows the pool's tech-scan QR inline in the pool info card — right column under the Homeowner Dashboard button — with a copy-link button, no reissue) · `ImportPoolsDialog` (CSV bulk-import: file picker, client-side preview, per-row skip/reason summary; gated by `canImportExport`) · `ExportPoolsButton` (CSV download via client-side Blob; gated by `canImportExport`) — both import/export gated behind the `csv_import` plan feature (`checkFeatureAccess`), showing a locked upsell hint when unavailable.

## properties/
`AddPropertyDialog` / `EditPropertyDialog` (create/edit forms, post to `properties/actions.ts`) · `DeletePropertyDialog` (confirm-name-match; warns pools stay and become ungrouped — SetNull detach, never cascade) · `PropertyRow` (CardRow: name, address, mono `N pool(s)` count badge, trailing `PropertyActions` dropdown) · `PropertyActions` (edit/delete dropdown menu) · `PropertyPoolsManager` (per-property attach/detach surface: attached-pool chips with detach ×, "Add pools" dialog with a searchable scrollable checkbox list of the company's **ungrouped** pools; submits `setPoolPropertyAction` per pool)

## visits/
`VisitCard` (dashboard list item) · `WaterReadingInput` (test-strip scan button = "coming soon") · `ChemicalRecommendations` · `AddChemicalDialog` (manual chemical entry popup; `onAdd(VisitChemical)`) · `WaterHealthGauge` · `VisitNotes` (voice recording = "coming soon") · `CancelVisitDialog` (reason-select + custom-reason confirmation UI) · `SyncStatusBadge` (presentational offline-sync indicator — pending/syncing/failed/offline/synced with tone colors + lucide icon + optional counts; driven by `useVisitSyncStatus` in the visit form)
- `visit-form.tsx` (in `(dashboard)/visits/[visitId]/`, not here) renders a **per-body segmented tab control** on multi-body visits: one tab per body (pool name + volume + `n/6` fill marker, check icon when complete), readings/analysis/chemicals per tab, notes/next-service-date visit-level below. Legacy single-body visits render tab-free.

## reports/
`ReportRow` · `ScoreSparkline` (inline SVG water-health trend) · `WaterHealthSummary` (gauge + at-a-glance callout, used by both report pages) · `ReportsFilters` (pool/date-range filter bar)

## schedule/
`ScheduleVisitForm` (Dialog popup with property-aware multi-pool selection — Location select + pool checkboxes when Properties exist, falling back to the current single-pool select over ungrouped pools — plus date/tech-search; posts to `schedule/actions.ts`) · `ScheduleFilters` (pool filter bar)
## profile/

`ProfileForms` (account + company forms, posts to `settings/actions.ts`) — links out to `/account/api-keys` for owners · `SignOutButton` (signs out via Supabase + redirects to `/login`; on native only, unregisters the device push token first via `unregisterPushDeviceAction`)

## account/
`ApiKeysManager` (list/generate/revoke API keys for the `api_access` plan feature; one-time secret reveal on generation; locked upsell hint when `canUseApiKeys` is false — same idiom as `csv_import`/`custom_branding`) · `DownloadPostmanButton` (downloads a Postman collection pre-wired to `/api/v1` via `downloadPostmanCollectionAction`; rendered in the `ApiKeysManager` header)

## feedback/
`FeedbackForm` (client; type-segmented submit form, posts to `/feedback/actions.ts` via `submitFeedbackAction`) · `FeedbackList` (server; a user's own submissions with type/status badges) · `FeedbackStatusSelect` (client; per-row triage `<select>` on `/admin/feedback`, calls `updateFeedbackStatusAction`) · `feedback-badges` (type/status label + style maps, `FeedbackTypeBadge`, `FeedbackStatusBadge`, `formatFeedbackDate`)

## homeowner/
`share-button` (copies/shares the public pool link)

## shared/
`CompanyLogo` (Server Component; renders a company logo, used on both dashboard and public report/homeowner pages) — R2-hosted logos (origin matches `R2_PUBLIC_URL`) go through `next/image`; anything else (e.g. a legacy externally-hosted URL from before uploads existed) falls back to a plain `<img>` so an unconfigured remote host never crashes the page · `AppVersion` (Client Component; fixed bottom-right overlay badge `v{package.json.version}`, `pointer-events-none` so it never blocks, hidden on `/login`/`/signup`; mounted once in the root `layout.tsx`, baked at build time — bump with `npm version patch|minor|major`) · `RealtimeVisitsRefresh` (Client Component, renders nothing; subscribes to `service_visits` `postgres_changes` and debounce-calls `router.refresh()` so add/cancel/reschedule/reassign from another session shows up live — mounted in `dashboard/page.tsx` and `schedule/page.tsx`)

## package/
`PackageBadge` / `PackageBadgeLink` (status pill: Trial/Active/Expired/Cancelled, colored; `package` may be `null` while on trial with no plan chosen) · `PayNowDialog` (first-time subscribe checkout dialog) · `SwitchPlanDialog` (shown instead of `PayNowDialog` once already on an active paid plan; upgrade = immediate + provider-prorated, downgrade = scheduled for period-end) · `PendingDowngradeNotice` (inline banner + cancel button shown when a downgrade is scheduled) · `TrialBanner` (dismissible-by-state urgency banner, rendered once in `(dashboard)/layout.tsx`) · `package-feature-fields` (`PackageFeatureFields` — admin package-form feature checkboxes, `/admin/packages`)

## admin/ — SUPER_ADMIN analytics/diagnostics dashboards (all client components, all Recharts-backed where charting)
`PlatformKPIs` (top-line stat tiles + refresh) · `RegistrationChart` (14-day user/company signups, bar) · `VisitActivityChart` (14-day completed-visit trend, area) · `SubscriptionBreakdown` (status pie chart) · `RecentRegistrations` (latest-10 signups list) — together render `getAdminDashboardData()` on the SUPER_ADMIN's `dashboard/` view (a SUPER_ADMIN has no company, so `dashboard/page.tsx` renders this platform overview instead of the normal tech/owner dashboard).
`DiagnosticsTabs` (tab shell for `admin/diagnostics`, composes the rest of this list) · `LiveServerCharts` (live CPU/memory line chart, client-polled) · `ServerHealthSummary` (compact stat tiles for the admin overview) · `ServerHealthDetails` (full server/CPU/memory/uptime stat tiles) · `LogSummaryCards` (error/warning/info count tiles) · `SystemLogViewer` (unscoped recent `SystemLog` list) · `TenantLogViewer` (per-company audit log list, `AuditLogWithUser`).

## notifications/
`NotificationProvider` (wraps the dashboard shell; drives `useRealtimeVisits(userId)`, exposes `NotificationContext` for unread count / mark-all-read, shows a dismissible new-visit alert toast) · `PushRegistration` (native-only: registers the device with `@capacitor/push-notifications`, persists the token to `localStorage["poolbench:pushToken"]`, posts it via `registerPushDeviceAction`, and routes push taps to `/visits/{id}`; mounted in `(dashboard)/layout.tsx`, no-ops in the browser)

## offline/
`OfflineRouteView` (client; **unified offline fallback** rendered by both the `/offline` page and the root `error.tsx`'s offline branch — when offline on `/pools` with a cached snapshot it renders the saved pool rows via `PoolRow`, and on `/visits/{id}` with a cached snapshot it renders the cached visit (draft edits overlaid); else the standard offline screen; reloads on reconnect) · `PoolsCacheMirror` (client, renders nothing; mounted in the server-rendered `/pools` page, persists the last-observed pools snapshot into IndexedDB for the offline view) · `VisitsCacheMirror` (client, renders nothing; mounted in the server-rendered `/visits/{id}` page, persists the last-observed visit snapshot into IndexedDB for the offline view) · `OfflineStatus` (client; offline-view actions — pending-mutation count via `getStats`, a Retry button that `drainOnce`s the queue, dashboard link; tenant-scoped by `getCachedCompanyId()` since the fallback page can't `requireTech()`) · `IdleRoutePrefetch` (client, renders nothing; mirrors the tenant into localStorage via `setCachedCompanyId` and prefetches the main nav routes during idle while online so their RSC payloads land in the router + SW runtime caches; mounted in `(dashboard)/layout.tsx`)

## navigation/
`main-nav` (sidebar + mobile bottom-nav shell)

## top-level (no domain folder)
`cookie-consent-banner` (`CookieConsentBanner` — localStorage-backed consent banner, cross-tab synced via a custom event) · `upgrade-dialog` (`UpgradeDialog` — generic locked-feature upsell dialog, links to `/account/package` by default; used wherever a plan-gated feature needs a click-through prompt instead of an inline hint) · `pwa-provider` (`PwaProvider` — client wrapper around `SerwistProvider` that only registers the service worker when the origin can actually host one: secure context AND (localhost in dev, or production). Prevents the SecurityError on phones hitting the dev server over a LAN IP with the self-signed cert)
