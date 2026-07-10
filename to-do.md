# PoolChem — To-Do

Generated from a project scan on 2026-07-10. Groups outstanding work by area:
stubbed pages, "coming soon" features, placeholder integrations, and
infrastructure follow-ups noted in the codebase and docs.

## Stubbed pages (placeholder content only)

These render a `<Shell>` with a single "will appear here" line and need real
implementations.

- [ ] **Schedule** — [src/app/(dashboard)/schedule/page.tsx](<src/app/(dashboard)/schedule/page.tsx>): list upcoming service visits for the tech/company.
- [ ] **Reports** — [src/app/(dashboard)/reports/page.tsx](<src/app/(dashboard)/reports/page.tsx>): water-health reports and visit history.
- [ ] **Profile** — [src/app/(dashboard)/profile/page.tsx](<src/app/(dashboard)/profile/page.tsx>): account + company details.

## "Coming soon" features

- [ ] **Test-strip scanning** — button is disabled/`title="coming soon"` in [src/components/visits/WaterReadingInput.tsx:106](src/components/visits/WaterReadingInput.tsx#L106). Wire up camera capture + reading extraction.
- [ ] **Voice recording for notes** — disabled in [src/components/visits/VisitNotes.tsx:46](src/components/visits/VisitNotes.tsx#L46). Add recording + transcription.

## Placeholder integrations

- [ ] **Report auto-send email** — currently opens the user's mail client via `mailto:` in [src/app/(dashboard)/visits/[visitId]/report/report-actions.tsx:36](<src/app/(dashboard)/visits/[visitId]/report/report-actions.tsx#L36>). Replace with a server-side transactional send.
- [ ] **Homeowner dashboard QR** — uses an external QR service as an MVP placeholder in [src/app/(dashboard)/visits/[visitId]/report/page.tsx:333](<src/app/(dashboard)/visits/[visitId]/report/page.tsx#L333>). Move to a self-hosted/local QR generator.

## Infrastructure & platform

- [ ] **SQLite → Supabase Postgres migration** — per [CLAUDE.md](CLAUDE.md): swap the driver adapter in [src/lib/prisma.ts](src/lib/prisma.ts) to `@prisma/adapter-pg` and update the datasource `provider`. Keep schema field types portable.
- [ ] **Test coverage beyond chemistry** — only [src/lib/pool-chemistry.test.ts](src/lib/pool-chemistry.test.ts) has unit tests. Consider tests for `db/` helpers (multi-tenant scoping) and Server Actions.

## Notes

- The dashboard layout/nav design is documented in [docs/superpowers/specs/2026-07-10-dashboard-layout-nav-design.md](docs/superpowers/specs/2026-07-10-dashboard-layout-nav-design.md); its explicit non-goals (real page content, theme toggle) overlap with the stubbed pages above.
