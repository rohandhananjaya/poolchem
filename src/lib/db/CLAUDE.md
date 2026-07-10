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

**pools.ts**
- `getPoolsByCompany(companyId) → PoolWithLastVisit[]`
- `getPoolById(poolId, companyId) → Pool | null`
- `createPool(data: CreatePoolData, companyId) → Pool`
- `updatePool(poolId, data: UpdatePoolData, companyId) → Pool`
- `getPoolByQR(qrCode) → Pool | null`
- `getPoolByPublicToken(publicToken, visitLimit)` — **public, unscoped**; homeowner share link
- `generateQRCode(poolId) → string`

**visits.ts** — a `ServiceVisit` has no `companyId`; it is scoped via `pool: { companyId }`.
- `getTodayVisits(companyId)`
- `getVisitById(visitId, companyId)`
- `createVisit(poolId, techId, companyId, scheduledAt?)`
- `completeVisit(visitId, readings: VisitReadings, chemicals: VisitChemical[], notes?) → CompletedVisit`
- `saveDraftVisit(visitId, readings, chemicals, notes?)`
- `getVisitHistory(poolId, limit)`
- `getLastVisitReadings(poolId) → VisitReadings | null`

**dashboard.ts**
- `getDashboardData(companyId) → DashboardData`

**reports.ts**
- `getCompanyReportData(companyId, limit=DEFAULT_LIMIT) → CompanyReportData`

**schedule.ts**
- `getScheduleData(companyId) → ScheduledVisit[]`

## Notes
- `VisitReadings` / `VisitChemical` types live in visits.ts; `VisitReadings` extends `WaterReadingInput` (from [../pool-chemistry.ts](../pool-chemistry.ts)) minus `temperature`.
- Report/homeowner aggregation logic (not raw queries) lives in [../reports/](../reports/), not here.
