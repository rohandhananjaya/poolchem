# src/lib/db — data-access layer

`import "server-only"` Prisma helpers. **Every read/write is tenant-scoped by `companyId`** (see root CLAUDE.md → Multi-tenancy). Reads return `null` on a cross-tenant miss; writes throw. Server Components / Server Actions call these — never Prisma directly from a page/action.

Get the tenant with `getCompanyId()` / `requireAuth()` from [../auth.ts](../auth.ts) and pass it in.

## API (signatures)

**company.ts**
- `getCompanyById(companyId) → Company | null`
- `updateCompany(companyId, data: UpdateCompanyData) → Company`
- `getCompanyStats(companyId) → CompanyStats`

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
- `getCompanyPackage(companyId) → CompanyPackageInfo | null` — lazily flips an overdue `TRIAL` to `EXPIRED` on read
- `getOrCreateCompanyPackage(companyId) → CompanyPackageInfo` — starts a trial if the company has no row yet
- `startTrial(companyId)` — full feature access, no plan chosen, for `PlatformSettings.trialDays`
- `simulatePayment(companyId, packageSlug)` — sets `ACTIVE` + records an `Invoice` (simulated, no real billing)
- `expireTrial(companyId)` / `checkAndExpireTrials()` — manual/batch expiry (not wired to a cron; expiry normally happens lazily via `getCompanyPackage`)
- `adminSetPackage(companyId, packageId, status)` — super-admin override
- `getCompanyInvoices(companyId)` · `getAllCompaniesWithPackages()`
- `createPackage(data)` · `updatePackage(id, data)` · `deletePackage(id)` · `countCompaniesOnPackage(packageId)` — plan-catalog CRUD for `/admin/packages`

**platform-settings.ts** — single-row platform config.
- `getPlatformSettings() → { trialDays }` · `updateTrialDays(days) → { trialDays }`

## Tests (64 tests across 7 files)

All DB tests mock `@/lib/prisma` and require `server-only` to be stubbed (handled by the Vitest config alias). Tests are in the same directory with `.test.ts` suffix:
- `visits.test.ts` — 17 tests · `company.test.ts` — 9 · `pools.test.ts` — 20
- `users.test.ts` — 11 · `reports.test.ts` — 3 · `schedule.test.ts` — 2 · `dashboard.test.ts` — 2

## Notes
- `VisitReadings` / `VisitChemical` types live in visits.ts; `VisitReadings` extends `WaterReadingInput` (from [../pool-chemistry.ts](../pool-chemistry.ts)) minus `temperature`.
- Report/homeowner aggregation logic (not raw queries) lives in [../reports/](../reports/), not here.
