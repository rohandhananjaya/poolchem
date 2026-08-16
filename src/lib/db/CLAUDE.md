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
- `PoolWithLastVisit = Pool & { lastVisitAt: Date | null; property: { id, name } | null }` — both list reads `include` the pool's property (id + name) so rows can show a property badge and prefill the edit dialog's Location select
- `getAllPoolsForExport(companyId) → Pool[]` — active + inactive, for CSV export
- `getPoolById(poolId, companyId) → Pool | null`
- `createPool(data: CreatePoolData, companyId) → Pool` — `CreatePoolData` may include `propertyId?: string | null`; throws unless the property belongs to the same company (tenant-FK guard)
- `createPoolsBulk(rows: CreatePoolData[], companyId) → { created: Pool[]; failed: { index, error }[] }` — per-row isolated, for CSV import
- `updatePool(poolId, data: UpdatePoolData, companyId) → Pool` — accepts optional `data.propertyId` (same-company guard as create)
- `deletePool(poolId, companyId) → void`
- `getPoolByQR(qrCode) → Pool | null`
- `getPoolByPublicToken(publicToken, visitLimit)` — **public, unscoped**; homeowner share link
- `generateQRCode(poolId) → string` — reissues a scan code; **unscoped**

**properties.ts** — optional multi-body grouping of pools at a location. Every pool's `propertyId` is optional (single-pool customers have none); deleting a Property detaches its pools (`SetNull`), never cascades.
- `getPropertiesByCompany(companyId) → PropertyWithPools[]` — each with its active `pools` (inactive excluded, like `getPoolsByCompany`)
- `getPropertyById(propertyId, companyId) → Property | null`
- `createProperty(data: CreatePropertyData, companyId) → Property`
- `updateProperty(propertyId, data: UpdatePropertyData, companyId) → Property`
- `deleteProperty(propertyId, companyId) → void` — pools detach (SetNull), no cascade
- `setPoolProperty(poolId, propertyId | null, companyId) → Pool` — attach/detach a pool; the tenant-FK guard (property must resolve to the same company as the pool, else throws)

**service-visit-pools.ts** — the `ServiceVisitPool` join rows linking a visit to each pool (body of water) it serves. `companyId` is stored directly on the join so tenancy filters stay indexed; a join row's `companyId` MUST equal its pool's `companyId` (write-time invariant enforced by `assertPoolsBelongToCompany`, called from the createVisit rework in `visits.ts`).
- `getServiceVisitPoolsByVisit(visitId, companyId) → ServiceVisitPoolWithPool[]` — join rows with `pool` attached; `[]` on a cross-tenant visit id
- `getPoolsByVisit(visitId, companyId) → Pool[]` — convenience wrapper (the "bodies" of a visit)
- `getVisitsByPool(poolId, companyId, limit?) → ServiceVisit[]` — multi-body-safe pool-scoped history (join-row scoped, body-scoped readings/chemicals), newest first; **landed** — `getVisitHistory`/`getLastVisitReadings` now delegate to the same join-row + body-filter shape
- `assertPoolsBelongToCompany(poolIds, companyId) → void` — tenant-FK guard; throws unless EVERY pool resolves to `companyId`, and on an empty `poolIds`
- **Legacy data backfill** ships as a standalone script, NOT a migration: `npm run db:backfill:service-visit-pools` (dry-run default, `--apply` to write). It creates one join row per existing visit from the legacy `ServiceVisit.poolId` and backfills `serviceVisitPoolId` on readings/chemicals. **MUST run before the createVisit/completeVisit rework cards deploy** (those assume a join row exists for every visit). Validate on a full prod-data copy first — the card's Prod-cutover steps.

**service-visit-pool-backfill.ts** — pure plan-builder (no I/O, no `server-only`, no Prisma runtime) feeding `scripts/backfill-service-visit-pools.ts`. Unit-testable in vitest.
- `buildServiceVisitPoolBackfillPlan(input) → ServiceVisitPoolBackfillPlan` — input: `visits` (`{id, poolId, createdAt}`), `poolCompanyIdByPoolId`, `existingJoins` (`{id, serviceVisitId, poolId}`), `unbackfilledReadings`/`unbackfilledChemicals` (`{id, visitId}`). Output: `{ joinsToCreate, readingsToUpdate, chemicalsToUpdate, orphanVisits, skippedVisits, summary }`. `companyId` on every new join is always derived from its pool (invariant can't drift); orphan visits (pool missing) are collected, never guessed. **Partial-run healing:** child batches carry the visit's join id when it already exists, so a crash between join-create and child-update self-heals on re-run.

**visit-photos.ts** — a photo taken during a service visit, keyed per body of water via the `ServiceVisitPool` join row. `companyId` is stored **directly on the row** (matching the ServiceVisitPool/Property precedent) so tenancy filters stay indexed; a photo's `companyId` MUST equal its body's `companyId` (write-time invariant enforced by `assertServiceVisitPoolOwnedByCompany`, which runs before every write).
- `assertServiceVisitPoolOwnedByCompany(serviceVisitPoolId, companyId) → void` — tenant-FK guard; throws `NotFoundError` unless the body resolves to `companyId`. Load-bearing: `serviceVisitPoolId` is the only caller-supplied untrusted input; `companyId` always comes from the session
- `addVisitPhoto({ serviceVisitPoolId, url, category?, sortOrder?, clientMutationId? }, companyId) → VisitPhoto` — guard first; **auto-appends `sortOrder`** (max existing + 1) when omitted, so new photos land at the end. When `clientMutationId` is present it dedupes: a prior row with the same key (scoped by `companyId`) returns the existing photo instead of inserting a duplicate — the offline photo queue's idempotent replay path
- `listVisitPhotos(serviceVisitPoolId, companyId) → VisitPhoto[]` — scoped, `sortOrder` then `createdAt` ascending; `[]` on a cross-tenant body
- `deleteVisitPhoto(visitPhotoId, companyId) → VisitPhoto | null` — scoped `findFirst`, then `delete`; returns `null` (no throw) when missing or foreign. Returns the deleted row so callers can remove the backing R2 object with the authoritative url (never a client-supplied one)
- `reorderVisitPhotos(serviceVisitPoolId, companyId, orderedIds) → void` — guard body; every id must resolve to a photo of the SAME body + company (else `NotFoundError`, no tx); then one `sortOrder: i` update per index in a `$transaction`

**visits.ts** — a `ServiceVisit` has no `companyId`; it is scoped via `pool: { companyId }`. `poolId` (on the visit) and `visitId` (on readings/chemicals) keying stays in place until the Multi-Body rework cards land — `ServiceVisitPool` join rows are additive alongside them (`service-visit-pools.ts`). **Prerequisite for the rework:** the legacy-`poolId` backfill script (`npm run db:backfill:service-visit-pools`) must have run first so a join row exists for every visit.
- `getTodayVisits(companyId)`
- `getVisitById(visitId, companyId)`
- `createVisit(poolIds: string[], techId\|null, companyId, scheduledAt?)` — creates a DRAFT visit for one or more pools transactionally: validates every pool against `companyId` via `assertPoolsBelongToCompany` (dedupes input, throws on empty/foreign/missing pools), then creates the visit + one `ServiceVisitPool` join row per pool. **Legacy `ServiceVisit.poolId` = first pool in the array** until the poolId-removal card; a multi-pool visit surfaces under its first pool only in legacy views
- `startVisit(visitId, companyId, techId?) → ServiceVisit | null` — marks a DRAFT visit as `IN_PROGRESS`; the starting tech becomes assigned
- `assertVisitAccess(visitId, companyId, userId) → ServiceVisitStatus` — throws unless the acting user may modify the visit (IN_PROGRESS visits require being the assigned tech)
- `updateVisitStatus(visitId, companyId, status) → ServiceVisit | null` — changes visit status
- `cancelVisit(visitId, companyId, reason) → ServiceVisit | null` — sets `CANCELLED` + stores `cancellationReason`
- `updateVisit(visitId, companyId, data: { scheduledAt?, techId? }) → { visit: ServiceVisit; previousTechId: string | null } | null` — reschedule/reassign; only DRAFT/IN_PROGRESS visits; throws on CANCELLED/COMPLETED or an out-of-company `techId`. Returns `previousTechId` so callers can notify the tech who lost the visit
- `completeVisit(visitId, readings: VisitReadings, chemicals: VisitChemical[], notes?, nextServiceDate?, opts?: VisitWriteOpts) → CompletedVisit & { applied }` — replaces (not duplicates) readings/chemicals, bumps `version`, stores `clientMutationId`; **does not stamp `reportNotifiedAt`** (the caller claims/releases the send slot — see below); `applied: false` on an already-applied replay (no tx, no next-visit scheduling); read `reportNotifiedAt` on the returned visit to know whether the report email had already gone out. **Stale-write guard:** when `opts.expectedVersion` is set and the stored `version` differs, throws `VisitVersionConflictError` (409) — a racing completion from another device is never silently overwritten. The guard is **atomic**: the write is a conditional `updateMany` filtered on the expected revision, so two devices that both read the same version can't both pass a check-then-write race (the pre-check is a fast path, not the guarantee). The replay short-circuit runs before the guard, so an already-applied `clientMutationId` stays idempotent regardless of drift. `saveDraftVisit` ignores `expectedVersion` (drafts are last-write-wins)
- `claimReportNotification(visitId, companyId) → boolean` — atomically claims the report-email slot (`updateMany` on `reportNotifiedAt: null`, scoped via `pool: { companyId }`); `true` = this caller won and owns the send, `false` = a concurrent retry won, skip. The stamp is cleared only by `releaseReportNotification` from the same request on failure; a crash after claim leaves it set permanently (at-most-once tradeoff)
- `releaseReportNotification(visitId, companyId) → void` — clears the claim after a confirmed send failure so a later retry re-sends; scoped via `pool: { companyId }`
- `saveDraftVisit(visitId, readings, chemicals, notes?, nextServiceDate?, opts?: VisitWriteOpts) → { visit, applied }` — idempotent replacement; throws on COMPLETED/CANCELLED visits; `applied: false` on an already-applied replay
- `getVisitByPublicToken(publicToken) → ServiceVisit | null` — **public, unscoped**; COMPLETED visits only, backs `report/[reportToken]`
- `getVisitHistory(poolId, companyId, limit)` — tenant-scoped via the `ServiceVisitPool` join rows (`serviceVisitPools: { some: { poolId, companyId } }`) + body-scoped on the returned readings/chemicals (`waterReadings`/`chemicalsAdded` filtered by `serviceVisitPool: { poolId }`): a multi-pool visit contributes only THIS pool's readings/chemicals to its history row
- `getLastVisitReadings(poolId, companyId) → VisitReadings | null`
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

## Tests (212 tests across 14 files)

All DB tests mock `@/lib/prisma` and require `server-only` to be stubbed (handled by the Vitest config alias) — EXCEPT `service-visit-pool-backfill.test.ts`, which is pure (no prisma mock). Tests are in the same directory with `.test.ts` suffix:
- `visits.test.ts` — 54 tests · `company.test.ts` — 12 · `pools.test.ts` — 29 · `packages.test.ts` — 31
- `users.test.ts` — 14 · `reports.test.ts` — 3 · `schedule.test.ts` — 8 · `dashboard.test.ts` — 2 · `api-keys.test.ts` — 12 · `feedback.test.ts` — 9 · `push-devices.test.ts` — 5 · `properties.test.ts` — 13 · `visit-photos.test.ts` — 11 · `service-visit-pool-backfill.test.ts` — 9

No tests yet for `admin-dashboard.ts`, `admin-audit.ts`, `admin-diagnostics.ts`, `payment-settings.ts`, or `invitations.ts` — a real coverage gap, not just a doc omission.

## Notes
- `VisitReadings` / `VisitChemical` types live in visits.ts; `VisitReadings` extends `WaterReadingInput` (from [../pool-chemistry.ts](../pool-chemistry.ts)) minus `temperature`.
- Report/homeowner aggregation logic (not raw queries) lives in [../reports/](../reports/), not here.
