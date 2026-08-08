# src/lib/offline — client-side offline persistence

IndexedDB storage for the offline visit flow, backed by **Dexie v4**. Runs in the browser and the Capacitor WebView (`client-only` guard — never bundled server-side). Kept deliberately separate from `src/lib/db/` (which is `server-only` Prisma).

## Why Dexie

Capacitor Preferences has a ~1MB soft key cap; Dexie/IndexedDB has no practical cap and behaves identically in the PWA and the native WebView.

## Modules

- `types.ts` — pure client-safe types + `createClientMutationId()`. Mirrors the Server Action payload shape `VisitFormValues` (`src/app/(dashboard)/visits/[visitId]/actions.ts`) and the data shapes in `src/lib/db/visits.ts`, which are `server-only` and can't be imported client-side. Keep field names in sync with those server-side types.
- `db.ts` — `import "client-only"`; the `poolbench-offline` Dexie schema (v1):
  - `draftVisits: "++id, &[companyId+visitId], companyId, updatedAt"` — one draft per visit per tenant.
  - `mutationQueue: "++id, &[companyId+clientMutationId], companyId, [companyId+status], createdAt"` — unique queue entry per tenant; FIFO drain via `[companyId+status]` + `createdAt`.
- `draft-visits.ts` — `saveDraft` (upsert by `[companyId+visitId]`), `getDraft`, `listDrafts` (newest first), `deleteDraft`.
- `mutation-queue.ts` — `enqueue` (mints/reuses `clientMutationId`; drops duplicates), `getPending` (FIFO, optional limit), `getPendingForVisit` (pending entries for one visit), `getByClientMutationId`, `markStatus` (status + optional `retryCount`/`lastError`), `deleteEntry` (single-entry removal after a successful flush), `deleteEntriesForVisit` (all entries for a visit — used when a visit is completed/cancelled locally so stale `saveDraft` entries aren't replayed), `clearCompanyData` (drafts + queue, for sign-out/tenant switch).
- `flush.ts` — `flushPending(companyId, replay, { limit? })` — client (`import "client-only"`), DIP (injected `replay` fn, no action imports). FIFO-drains `getPending`; per entry `replay(entry)` (success → `deleteEntry`; deletes the visit's draft only when no pending entries remain for that visit, so a draft replaced by a newer save mid-flush survives; failure → leaves entry `pending` for the queue processor). Returns `{clientMutationId, status:"synced"|"failed"}[]`. The visit form injects `replay = (entry) => saveDraftAction(entry.visitId, entry.payload)`.

## Tenancy

Same invariant as the server DB layer: every read/write is scoped by `companyId`. Cross-tenant rows can't collide because both unique keys are compound on `companyId`. `clearCompanyData(companyId)` is the sign-out/tenant-switch wipe.

## Tests

`draft-visits.test.ts` + `mutation-queue.test.ts` + `flush.test.ts` — use `fake-indexeddb` (happy-dom has no IndexedDB): `import "fake-indexeddb/auto"` then `db.delete()` + `db.open()` in `beforeEach`. No Prisma mocking.

## Status

Write-through draft save is wired into `VisitForm` (`src/app/(dashboard)/visits/[visitId]/visit-form.tsx`): Save Draft persists to Dexie immediately (`saveDraft` + `enqueue`), flushes the queue when online, and drains it again when `useOnlineStatus()` reports online after hydration (`src/hooks/use-online-status.ts` — the single source of truth for connectivity, replacing inline `navigator.onLine` reads; `online` is gated by its `hydrated` flag so the optimistic first-paint snapshot can't fire a flush against an actually-offline device). The Server Action is only invoked via the flush replay. Readings are optional in the payload and normalized to 0 at the server boundary (`actions.ts` `normalizeReadings`). Completing a visit clears its local draft + queued entries. Queue processor/backoff, SW/precache, sync-status UI, and conflict resolution are later cards.
