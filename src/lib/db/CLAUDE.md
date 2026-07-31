# src/lib/db — data-access layer

`import "server-only"` Prisma helpers. **Every read/write is tenant-scoped by `companyId`** (see root CLAUDE.md → Multi-tenancy). Reads return `null` on a cross-tenant miss; writes throw. Server Components / Server Actions call these — never Prisma directly from a page/action.

Get the tenant with `getCompanyId()` / `requireAuth()` from [../auth.ts](../auth.ts) and pass it in.

## API (signatures)

**company.ts**
- `getCompanyById(companyId) → Company | null`
- `getCompanyBySubscriptionId(provider, subscriptionId) → Company | null` — finds the company whose *currently-recorded* subscription id matches; used by the payment webhook routes to disambiguate a stale/superseded cancellation
- `updateCompany(companyId, data: UpdateCompanyData) → Company`
- `getCompanyStats(companyId) → CompanyStats`
- `getCompaniesPaginated(page?) → { companies: CompanyWithCounts[]; total: number }` — **unscoped**, super-admin list view

**users.ts**
- `updateUser(userId, companyId, data: UpdateUserData)`
- `getCompanyTechs(companyId) → Pick<User, id\|name\|email>[]` — TECH-role users for a company
- `hasSuperAdmin() → boolean` — whether a SUPER_ADMIN exists yet; gates the `/setup` bootstrap wizard

**pools.ts**
- `getPoolCount(companyId) → number`
- `getPoolsPaginated(companyId, page, filters?) → { pools: PoolWithLastVisit[]; total: number }`
- `getPoolsByCompany(companyId) → PoolWithLastVisit[]`
- `getAllPoolsForExport(companyId) → Pool[]` — active + inactive, for CSV export
- `getPoolById(poolId, companyId) → Pool | null`
- `createPool(data: CreatePoolData, companyId) → Pool`
- `createPoolsBulk(rows: CreatePoolData[], companyId) → { created: Pool[]; failed: { index, error }[] }` — per-row isolated, for CSV import
- `updatePool(poolId, data: UpdatePoolData, companyId) → Pool`
- `deletePool(poolId, companyId) → void`
- `getPoolByQR(qrCode) → Pool | null`
- `getPoolByPublicToken(publicToken, visitLimit)` — **public, unscoped**; homeowner share link
- `generateQRCode(poolId) → string`

**visits.ts** — a `ServiceVisit` has no `companyId`; it is scoped via `pool: { companyId }`.
- `getTodayVisits(companyId)`
- `getVisitById(visitId, companyId)`
- `createVisit(poolId, techId\|null, companyId, scheduledAt?)`
- `startVisit(visitId, companyId) → ServiceVisit | null` — marks a DRAFT visit as `IN_PROGRESS`
- `updateVisitStatus(visitId, companyId, status) → ServiceVisit | null` — changes visit status
- `completeVisit(visitId, readings: VisitReadings, chemicals: VisitChemical[], notes?, nextServiceDate?) → CompletedVisit`
- `saveDraftVisit(visitId, readings, chemicals, notes?, nextServiceDate?)`
- `getVisitHistory(poolId, limit)`
- `getLastVisitReadings(poolId) → VisitReadings | null`
- `getPoolNextScheduledVisit(poolId) → Date | null` — latest future scheduled non-cancelled visit date for a pool

**dashboard.ts**
- `getDashboardData(companyId) → DashboardData`

**reports.ts**
- `getCompanyReportData(companyId, limit=DEFAULT_LIMIT) → CompanyReportData`

**schedule.ts**
- `getScheduleData(companyId) → ScheduledVisit[]`

**packages.ts** — subscription/trial system. `Package` (plan definitions, platform-wide, not tenant-scoped) vs `CompanyPackage` (one per company; `packageId` is `null` while on trial with no plan chosen yet).
- `getAllPackages() → PackageInfo[]` · `getPackageBySlug(slug)` · `getPackageById(id)`
- `getCheckoutPlanRef(packageSlug, providerName, devMode) → string | undefined` — PayPal only; resolves (and caches) the plan a first-time checkout must reuse so it lands on the same plan/product later upgrade/downgrade revises target. Returns `undefined` for Stripe (its checkout prices inline, no shared-product constraint)
- `getCompanyPackage(companyId) → CompanyPackageInfo | null` — lazily flips an overdue `TRIAL` to `EXPIRED`, and applies a due scheduled downgrade (see `scheduleDowngrade`), on read
- `getOrCreateCompanyPackage(companyId) → CompanyPackageInfo` — starts a trial if the company has no row yet
- `startTrial(companyId)` — full feature access, no plan chosen, for `PlatformSettings.trialDays`
- `handlePaymentSuccess(companyId, packageSlug, provider, providerSubscriptionId, providerCustomerId)` — activates a plan from a webhook/first-checkout; also cancels a live subscription on the *other* provider if one exists (payment-method switch)
- `upgradeCompanyPackage(companyId, targetPackageSlug, returnUrls?) → UpgradeOutcome` — revises the company's existing subscription to a pricier plan immediately, provider-prorated. Returns `{status: "applied", companyPackage, prorationAmount?}` normally, or `{status: "requires_approval", approvalUrl}` if PayPal demands the subscriber re-approve (nothing is written to the DB in that case — `returnUrls` is where PayPal sends them back)
- `confirmPendingUpgrade(companyId, targetPackageSlug) → CompanyPackageInfo` — completes an upgrade left pending by `requires_approval`, called from the account page once the subscriber is redirected back; polls PayPal briefly for the plan to actually match before applying
- `handlePlanRevisionConfirmed(companyId, providerPlanId) → CompanyPackageInfo` — webhook counterpart to `confirmPendingUpgrade` (looks the Package up by its cached plan ref since the webhook's `custom_id` still reflects the original signup package); both funnel through the same idempotent apply, so whichever fires first wins and the other is a no-op
- `scheduleDowngrade(companyId, targetPackageSlug) → { companyPackage, effectiveAt }` — schedules a move to a cheaper plan for the end of the current paid period; current plan/features stay active until then
- `cancelPendingDowngrade(companyId)` — cancels a scheduled-but-not-yet-applied downgrade; idempotent no-op if nothing pending
- `handleSubscriptionCancelled(companyId)` — sets `status: CANCELLED`, called from the payment webhook routes
- `simulateSwitch(companyId, targetPackageSlug)` — dev/no-provider stand-in for upgrade/downgrade, mirrors `simulatePayment`
- `simulatePayment(companyId, packageSlug)` — sets `ACTIVE` + records an `Invoice` (simulated, no real billing)
- `expireTrial(companyId)` / `checkAndExpireTrials()` — manual/batch expiry (not wired to a cron; expiry normally happens lazily via `getCompanyPackage`)
- `getCompanyInvoices(companyId)`
- `createPackage(data)` · `updatePackage(id, data)` · `deletePackage(id)` · `countCompaniesOnPackage(packageId)` — plan-catalog CRUD for `/admin/packages`; counts a package as "in use" if any company has it as current OR pending

**platform-settings.ts** — single-row platform config.
- `getPlatformSettings() → { trialDays }` · `updateTrialDays(days) → { trialDays }`

**api-keys.ts** — credentials for the `/api/v1` REST API (`api_access` plan feature) and their rate-limit counters.
- `getApiKeysByCompany(companyId) → ApiKeySummary[]` — never includes `keyHash`
- `createApiKey(companyId, name) → { key: ApiKeySummary; plaintextSecret: string }` — secret shown once, only its hash is persisted
- `revokeApiKey(keyId, companyId) → void` — throws `NotFoundError` if not found/already revoked
- `findActiveApiKeyByHash(keyHash)` — **public, unscoped**; how a request's company is discovered from its bearer secret
- `touchApiKeyLastUsed(keyId) → void`
- `checkAndIncrementRateLimit(apiKeyId, limitPerMinute) → RateLimitResult` — fixed 1-minute-window counter, no external cache/queue

## Tests (64+ tests across 8 files)

All DB tests mock `@/lib/prisma` and require `server-only` to be stubbed (handled by the Vitest config alias). Tests are in the same directory with `.test.ts` suffix:
- `visits.test.ts` — 17 tests · `company.test.ts` — 12 · `pools.test.ts` — 20
- `users.test.ts` — 11 · `reports.test.ts` — 3 · `schedule.test.ts` — 2 · `dashboard.test.ts` — 2 · `api-keys.test.ts` — 13

## Notes
- `VisitReadings` / `VisitChemical` types live in visits.ts; `VisitReadings` extends `WaterReadingInput` (from [../pool-chemistry.ts](../pool-chemistry.ts)) minus `temperature`.
- Report/homeowner aggregation logic (not raw queries) lives in [../reports/](../reports/), not here.
