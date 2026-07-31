# src/components — component inventory

Feature components grouped by domain; shadcn/ui primitives in [ui/](ui/) (style `radix-nova`, see [../../components.json](../../components.json)). Most feature components are Client Components (`"use client"`); pages fetch via `db/` helpers and pass data down. Check the top of a file for `"use client"` before assuming.

## ui/ — shadcn primitives (don't hand-edit generated ones; re-add via CLI)
`avatar` `button` `dialog` `dropdown-menu` `error-state` `input` `label` `loading-skeleton` `shell` `sonner`
- `shell` = page frame used by every dashboard page; `sonner` = toast host; `error-state` / `loading-skeleton` = shared error/loading UI.

## dashboard/
`StatsRow` (KPI tiles) · `VisitCard` (list item) · `EmptyState` · `ScanFab` (floating scan button) · `RefreshButton` · `DashboardSkeleton`

## pools/
`AddPoolDialog` / `EditPoolDialog` / `DeletePoolDialog` (create/edit/delete forms, post to `pools/actions.ts`) · `PoolRow` (list card, opens `EditPoolDialog`) · `PoolActions` (edit/delete menu) · `PoolsFilters` (search/status bar) · `PoolAnalysis` · `ImportPoolsDialog` (CSV bulk-import: file picker, client-side preview, per-row skip/reason summary; gated by `canImportExport`) · `ExportPoolsButton` (CSV download via client-side Blob; gated by `canImportExport`) — both import/export gated behind the `csv_import` plan feature (`checkFeatureAccess`), showing a locked upsell hint when unavailable.

## visits/
`WaterReadingInput` (test-strip scan button = "coming soon") · `ChemicalRecommendations` · `AddChemicalDialog` (manual chemical entry popup; `onAdd(VisitChemical)`) · `WaterHealthGauge` · `VisitNotes` (voice recording = "coming soon")

## reports/
`ReportRow` · `ScoreSparkline` (inline SVG water-health trend) · `WaterHealthSummary` (gauge + at-a-glance callout, used by both report pages)

## schedule/
`ScheduleVisitCard` · `ScheduleVisitForm` (Dialog popup with pool/date/tech-search; posts to `schedule/actions.ts`)
## profile/

`ProfileForms` (account + company forms, posts to `settings/actions.ts`) — links out to `/account/api-keys` for owners

## account/
`ApiKeysManager` (list/generate/revoke API keys for the `api_access` plan feature; one-time secret reveal on generation; locked upsell hint when `canUseApiKeys` is false — same idiom as `csv_import`/`custom_branding`)

## homeowner/
`share-button` (copies/shares the public pool link)

## package/
`PackageBadge` / `PackageBadgeLink` (status pill: Trial/Active/Expired/Cancelled, colored; `package` may be `null` while on trial with no plan chosen) · `PayNowDialog` (first-time subscribe checkout dialog) · `SwitchPlanDialog` (shown instead of `PayNowDialog` once already on an active paid plan; upgrade = immediate + provider-prorated, downgrade = scheduled for period-end) · `PendingDowngradeNotice` (inline banner + cancel button shown when a downgrade is scheduled) · `TrialBanner` (dismissible-by-state urgency banner, rendered once in `(dashboard)/layout.tsx`)

## layout/
`PublicHeader` (shared public site header; accepts `children` for custom nav/actions slot; default nav is pathname-aware via `PublicNavLinks`) · `PublicNavLinks` (client component; reads `usePathname()` to serve page-specific nav links) · `PublicFooter` (shared public site footer; `showSocial` toggles social icons)

## navigation/
`main-nav` (sidebar + mobile bottom-nav shell)
