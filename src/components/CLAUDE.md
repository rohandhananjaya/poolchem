# src/components — component inventory

Feature components grouped by domain; shadcn/ui primitives in [ui/](ui/) (style `radix-nova`, see [../../components.json](../../components.json)). Most feature components are Client Components (`"use client"`); pages fetch via `db/` helpers and pass data down. Check the top of a file for `"use client"` before assuming.

## ui/ — shadcn primitives (don't hand-edit generated ones; re-add via CLI)
`avatar` `button` `dialog` `dropdown-menu` `error-state` `input` `label` `loading-skeleton` `shell` `sonner`
- `shell` = page frame used by every dashboard page; `sonner` = toast host; `error-state` / `loading-skeleton` = shared error/loading UI.

## dashboard/
`StatsRow` (KPI tiles) · `VisitCard` (list item) · `EmptyState` · `ScanFab` (floating scan button) · `RefreshButton` · `DashboardSkeleton`

## visits/
`WaterReadingInput` (test-strip scan button = "coming soon") · `ChemicalRecommendations` · `AddChemicalDialog` (manual chemical entry popup; `onAdd(VisitChemical)`) · `WaterHealthGauge` · `VisitNotes` (voice recording = "coming soon")

## reports/
`ReportRow` · `ScoreSparkline` (inline SVG water-health trend)

## schedule/
`ScheduleVisitCard` · `ScheduleVisitForm` (Dialog popup with pool/date/tech-search; posts to `schedule/actions.ts`)

## profile/
`ProfileForms` (account + company forms, posts to `profile/actions.ts`)

## homeowner/
`share-button` (copies/shares the public pool link)

## layout/
`PublicHeader` (shared public site header; accepts `children` for custom nav/actions slot) · `PublicFooter` (shared public site footer; `showSocial` toggles social icons)

## navigation/
`main-nav` (sidebar + mobile bottom-nav shell)
