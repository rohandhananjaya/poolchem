# PoolChem — To-Do

MVP launch priorities for the US market, assessed 2026-07-11.

## P0 — Blocking launch (must ship)

- [ ] **Self-service sign-up** — no registration page exists. Users cannot create an account without admin intervention. Need: `/sign-up` page, company creation, initial OWNER user setup, Supabase Auth user creation from client. URL: `src/app/login/page.tsx`
- [ ] **Password reset** — no "forgot password?" link or reset flow. Supabase supports `resetPasswordForEmail()` but there's no UI or route. URL: `src/app/login/page.tsx`
- [ ] **Transactional email** — zero email infrastructure. Three concrete gaps:
  - Report auto-send (currently `mailto:`). URL: `src/app/(dashboard)/visits/[visitId]/report/report-actions.tsx`
  - Password reset emails
  - Team invitation emails
  - Recommended: Resend or SendGrid
- [ ] **SQLite → Supabase Postgres** — swap `@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` in `src/lib/prisma.ts`, update `prisma.config.ts`, verify schema portability
- [ ] **Production environment** — configure real Supabase project, Vercel project env vars, set `NEXT_PUBLIC_APP_URL`, CI/CD (GitHub Actions)

## P1 — High priority (ship soon after launch)

- [ ] **Stripe billing integration** — schema has fields (`stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`) but zero implementation. Need: pricing page, checkout, webhooks, subscription gating.
- [ ] **Privacy Policy & Terms of Service** — required for US market SaaS. Static pages or legal-reference links in footer. URL: `src/app/`
- [ ] **Error monitoring** — no Sentry or equivalent. Critical for catching production bugs.
- [ ] **Analytics** — no Plausible/PostHog/GA4. Need to understand usage patterns.

## P2 — Polish

- [ ] **OG image / social preview** — meta tags for the landing page. URL: `src/app/layout.tsx`
- [ ] **robots.txt / sitemap.xml** — SEO basics for public pages.
- [ ] **Rate limiting on Server Actions** — no protection against abuse on mutation endpoints.

## Coming-soon features (deferred from original to-do)

- [ ] **Test-strip scanning** — disabled button in `src/components/visits/WaterReadingInput.tsx`
- [ ] **Voice recording for notes** — disabled in `src/components/visits/VisitNotes.tsx`
- [ ] **Self-hosted QR generation** — currently uses external `qrserver.com` API in `src/app/(dashboard)/visits/[visitId]/report/page.tsx`
- [ ] **E2E tests** — no Playwright/Cypress tests

## Already shipped (items from previous to-do that are done)

- [x] **Schedule page** — full implementation with buckets, cards, scheduling form
- [x] **Reports page** — filters, pagination, report rows
- [x] **Profile page** — account + company settings with role-based editing
- [x] **DB helper tests** — 60 tests across 7 files in `src/lib/db/` (plus 131 more across app)
