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
- `mutation-queue.ts` — `enqueue` (mints/reuses `clientMutationId`; drops duplicates), `getPending` (FIFO, optional limit), `getByClientMutationId`, `markStatus` (status + optional `retryCount`/`lastError`), `clearCompanyData` (drafts + queue, for sign-out/tenant switch).

## Tenancy

Same invariant as the server DB layer: every read/write is scoped by `companyId`. Cross-tenant rows can't collide because both unique keys are compound on `companyId`. `clearCompanyData(companyId)` is the sign-out/tenant-switch wipe.

## Tests

`draft-visits.test.ts` + `mutation-queue.test.ts` — use `fake-indexeddb` (happy-dom has no IndexedDB): `import "fake-indexeddb/auto"` then `db.delete()` + `db.open()` in `beforeEach`. No Prisma mocking.

## Status

Storage only. Write-through wiring, queue processor/backoff, `useOnlineStatus`, SW/precache, sync-status UI, and conflict resolution are later cards.
