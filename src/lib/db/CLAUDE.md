# src/lib/db — data-access layer

`import "server-only"` Prisma helpers. **Every read/write is tenant-scoped by `companyId`** (see root CLAUDE.md → Multi-tenancy). Reads return `null` on a cross-tenant miss; writes throw. Server Components / Server Actions call these — never Prisma directly from a page/action.

Get the tenant with `getCompanyId()` / `requireAuth()` from [../auth.ts](../auth.ts) and pass it in.

## API (signatures)

**company.ts**
- `getCompanyById(companyId) → Company | null`
- `getCompanyBySubscriptionId(provider, subscriptionId) → Company | null` — finds the company whose *currently-recorded* subscription id matches; used by the payment webhook routes to disambiguate a stale/superseded cancellation
- `updateCompany(companyId, data: UpdateCompanyData) → Company`
- `createCompany(data: CreateCompanyData) → Company`
- `deleteCompany(companyId) → void` — cascades to users, pools, visits, etc.; throws if not found
- `getCompanyStats(companyId) → CompanyStats`
- `COMPANIES_PAGE_SIZE`
- `getCompaniesPaginated(page?) → { companies: CompanyWithCounts[]; total: number }` — **unscoped**, super-admin list view
- `getCompanyFromEmail(company) → string` — derives a display/contact email for a company record

**users.ts** — writes never allow editing `email` (the Supabase Auth ↔ Prisma link); `companyId: null` on scoped helpers means SUPER_ADMIN context (unscoped).
- `getUsersByCompany(companyId) → User[]`
- `getCompanyTechs(companyId) → Pick<User, id\|name\|email>[]` — TECH-role users for a company
- `getCompanyTechCount(companyId) → number` — enforces a plan's `max_techs`
- `updateUser(userId, companyId, data: UpdateUserData)`
- `updateUserRole(userId, companyId\|null, role) → User` — throws if not found for scope
- `getUserExportData(userId, companyId\|null) → UserExportData` — full GDPR data-portability export (Art. 20): profile, company, pools, visits with readings/chemicals
- `getAllUsers() → User[]` — **unscoped**, SUPER_ADMIN only, includes `company`
- `updateUserAdmin(userId, companyId\|null, data: UpdateUserAdminData) → User` — name/role/phone
- `createUser(data: CreateUserData) → User`
- `hasSuperAdmin() → boolean` — whether a SUPER_ADMIN exists yet; gates the `/setup` bootstrap wizard
- `deleteUser(userId, companyId\|null) → void`

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
- `generateQRCode(poolId) → string` — reissues a scan code; **unscoped**

**visits.ts** — a `ServiceVisit` has no `companyId`; it is scoped via `pool: { companyId }`.
- `getTodayVisits(companyId)`
- `getVisitById(visitId, companyId)`
- `createVisit(poolId, techId\|null, companyId, scheduledAt?)`
- `startVisit(visitId, companyId, techId?) → ServiceVisit | null` — marks a DRAFT visit as `IN_PROGRESS`; the starting tech becomes assigned
- `assertVisitAccess(visitId, companyId, userId) → ServiceVisitStatus` — throws unless the acting user may modify the visit (IN_PROGRESS visits require being the assigned tech)
- `updateVisitStatus(visitId, companyId, status) → ServiceVisit | null` — changes visit status
- `cancelVisit(visitId, companyId, reason) → ServiceVisit | null` — sets `CANCELLED` + stores `cancellationReason`
- `updateVisit(visitId, companyId, data: { scheduledAt?, techId? }) → { visit: ServiceVisit; previousTechId: string | null } | null` — reschedule/reassign; only DRAFT/IN_PROGRESS visits; throws on CANCELLED/COMPLETED or an out-of-company `techId`. Returns `previousTechId` so callers can notify the tech who lost the visit
- `completeVisit(visitId, readings: VisitReadings, chemicals: VisitChemical[], notes?, nextServiceDate?, opts?: VisitWriteOpts) → CompletedVisit & { applied, reportAlreadyNotified }` — replaces (not duplicates) readings/chemicals, bumps `version`, stores `clientMutationId`, stamps `reportNotifiedAt` once (a re-completion keeps the original stamp); `applied: false` on an already-applied replay (no tx, no next-visit scheduling, no report email) and `reportAlreadyNotified: true` when the report email had already gone out — the caller sends the email only when `applied && !reportAlreadyNotified`
- `saveDraftVisit(visitId, readings, chemicals, notes?, nextServiceDate?, opts?: VisitWriteOpts) → { visit, applied }` — idempotent replacement; throws on COMPLETED/CANCELLED visits; `applied: false` on an already-applied replay
- `getVisitByPublicToken(publicToken) → ServiceVisit | null` — **public, unscoped**; COMPLETED visits only, backs `report/[reportToken]`
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
- `toCompanyPackageInfo(cp: CompanyPackageWithRelations) → CompanyPackageInfo` — internal shaping helper, exported for reuse by callers that fetch their own `CompanyPackage` rows
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

**push-devices.ts** — registered native app tokens (FCM/APNs) for visit-assignment push. Every token is tenant + user scoped; a token can only be registered/unregistered against the authenticated user's own `companyId`/`userId`.
- `registerPushDevice({ companyId, userId, token, platform }) → PushDevice` — upsert by `token` (re-registering the same token updates owner/platform), `platform: "ANDROID" | "IOS"`
- `unregisterPushDevice({ companyId, userId, token }) → number` — deleteMany scoped to user+token; returns deleted count
- `getPushDevicesForUser(companyId, userId) → PushDevice[]`

**api-keys.ts** — credentials for the `/api/v1` REST API (`api_access` plan feature) and their rate-limit counters.
- `getApiKeysByCompany(companyId) → ApiKeySummary[]` — never includes `keyHash`
- `createApiKey(companyId, name) → { key: ApiKeySummary; plaintextSecret: string }` — secret shown once, only its hash is persisted
- `revokeApiKey(keyId, companyId) → void` — throws `NotFoundError` if not found/already revoked
- `findActiveApiKeyByHash(keyHash)` — **public, unscoped**; how a request's company is discovered from its bearer secret
- `touchApiKeyLastUsed(keyId) → void`
- `checkAndIncrementRateLimit(apiKeyId, limitPerMinute) → RateLimitResult` — fixed 1-minute-window counter, no external cache/queue

**feedback.ts** — user-submitted support requests (bug reports / feature requests / general issues), triaged by super-admins. `companyId` is nullable (company-less SUPER_ADMIN submitters) and always comes from the authenticated session.
- `createFeedback(data, userId, companyId) → Feedback` — tenant-scoped write; `companyId` passed from the session, never from request input
- `getFeedbackByUser(userId, companyId) → Feedback[]` — a user's own submissions, scoped to user + tenant, newest first
- `getAllFeedback({ page?, type?, status? }) → { feedback: FeedbackWithSubmitter[]; total }` — **unscoped**, super-admin list view with submitter/company names
- `updateFeedbackStatus(feedbackId, status) → Feedback` — **unscoped** super-admin triage; throws if not found
- `FEEDBACK_PAGE_SIZE`

**invitations.ts** — pending invites for a tech to join a company by setting their own password.
- `createInvitation(data: CreateInvitationData) → Invitation` — 7-day expiry
- `getValidInvitation(token) → Invitation | null` — not accepted, not expired; includes `company`
- `acceptInvitation(token) → Invitation`
- `getInvitationsByCompany(companyId) → Invitation[]` — pending, non-expired only
- `getPendingTechInvitationCount(companyId) → number` — enforces a plan's `max_techs` alongside actual TECH users
- `deleteInvitation(id, companyId) → void` — throws if not found in company

**admin-dashboard.ts** — SUPER_ADMIN platform overview.
- `getAdminDashboardData() → AdminDashboardData` — **unscoped**; totals, today's counts, 14-day registration/visit trends, 10 most recent users, subscription-status breakdown

**admin-audit.ts** — `AuditLog` reads (writes happen inline wherever an audited action occurs, not centralized here).
- `getCompanyAuditLogs(companyId, limit=50) → AuditLogWithUser[]`
- `getAllAuditLogs(limit=50) → AuditLogWithUser[]` — **unscoped**
- `getAuditSummary(companyId?) → AuditSummary` — total + grouped by-action counts; unscoped when `companyId` omitted

**admin-diagnostics.ts** — SUPER_ADMIN server/DB health, backed by `os`/`process` plus `SystemLog`/`AuditLog`.
- `getServerDiagnostics() → DiagnosticsData` — full page: server info, DB connectivity + row counts, log summary, 50 recent logs, company list, audit logs
- `getServerHealthSummary() → { server; logSummary }` — lightweight subset for the admin dashboard overview

**payment-settings.ts** — single-row (`platformSettings`, id `"singleton"`) platform-wide payment toggles.
- `getPaymentSettings() → PaymentSettings` — `{ stripeEnabled, paypalEnabled, paymentDevMode }`; upserts the row if missing
- `updatePaymentSettings(data: Partial<PaymentSettings>) → PaymentSettings`

## Tests (145+ tests across 10 files)

All DB tests mock `@/lib/prisma` and require `server-only` to be stubbed (handled by the Vitest config alias). Tests are in the same directory with `.test.ts` suffix:
- `visits.test.ts` — 38 tests · `company.test.ts` — 12 · `pools.test.ts` — 20 · `packages.test.ts` — 27
- `users.test.ts` — 14 · `reports.test.ts` — 3 · `schedule.test.ts` — 8 · `dashboard.test.ts` — 2 · `api-keys.test.ts` — 12 · `feedback.test.ts` — 9 · `push-devices.test.ts` — 5

No tests yet for `admin-dashboard.ts`, `admin-audit.ts`, `admin-diagnostics.ts`, `payment-settings.ts`, or `invitations.ts` — a real coverage gap, not just a doc omission.

## Notes
- `VisitReadings` / `VisitChemical` types live in visits.ts; `VisitReadings` extends `WaterReadingInput` (from [../pool-chemistry.ts](../pool-chemistry.ts)) minus `temperature`.
- Report/homeowner aggregation logic (not raw queries) lives in [../reports/](../reports/), not here.
