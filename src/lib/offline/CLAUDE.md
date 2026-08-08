# src/lib/offline — client-side offline persistence

IndexedDB storage for the offline visit flow, backed by **Dexie v4**. Runs in the browser and the Capacitor WebView (`client-only` guard — never bundled server-side). Kept deliberately separate from `src/lib/db/` (which is `server-only` Prisma).

## Why Dexie

Capacitor Preferences has a ~1MB soft key cap; Dexie/IndexedDB has no practical cap and behaves identically in the PWA and the native WebView.

## Modules

- `types.ts` — pure client-safe types + `createClientMutationId()`. Mirrors the Server Action payload shape `VisitFormValues` (`src/app/(dashboard)/visits/[visitId]/actions.ts`) and the data shapes in `src/lib/db/visits.ts`, which are `server-only` and can't be imported client-side. Keep field names in sync with those server-side types. `QueuedMutation` carries `status: pending|processing|failed|dead`, `retryCount`, `lastError`, and `nextRetryAt` (backoff schedule, persisted so a reload resumes it).
- `db.ts` — `import "client-only"`; the `poolbench-offline` Dexie schema (v1):
  - `draftVisits: "++id, &[companyId+visitId], companyId, updatedAt"` — one draft per visit per tenant.
  - `mutationQueue: "++id, &[companyId+clientMutationId], companyId, [companyId+status], createdAt"` — unique queue entry per tenant; FIFO drain via `[companyId+status]` + `createdAt`. `nextRetryAt` is an unindexed field — no Dexie version bump needed.
- `backoff.ts` — **pure, no I/O**: `MAX_RETRIES` (6), `nextDelayMs(attempt, {base=2000, multiplier=2, cap=300000, jitter=0.2})`, `computeNextRetryAt(now, attempt)`. Tunable schedule consumed only by the processor.
- `draft-visits.ts` — `saveDraft` (upsert by `[companyId+visitId]`), `getDraft`, `listDrafts` (newest first), `deleteDraft`.
- `mutation-queue.ts` — `enqueue` (mints/reuses `clientMutationId`; drops duplicates), `getPending` (FIFO, optional limit), `getPendingForVisit` (pending entries for one visit), `getByClientMutationId`, `markStatus` (status + optional `retryCount`/`lastError`/`nextRetryAt`), `deleteEntry` (single-entry removal after a successful flush), `deleteEntriesForVisit` (all entries for a visit), `getDue(companyId, {now, limit})` (pending + failed entries whose `nextRetryAt` is due or unset, FIFO — queried via the `[companyId+status]` index), `getDead` / `getDeadForVisit` (dead-lettered entries), `countEntriesForVisit` (all-status count — keeps the draft while any entry still holds unsynced edits), `deleteDeadForVisit` (drop a visit's dead entries on re-save), `retryDead` (dead → pending, retryCount 0, schedule cleared), `getStats(companyId) → {pending, processing, failed, dead}` (feeds the sync-status UI), `clearCompanyData` (drafts + queue, for sign-out/tenant switch).
- `processor.ts` — **queue processor** (`import "client-only"`): `drainOnce(companyId, replay, {now?, limit?, classifyError?, scheduleRetry?, replayTimeoutMs?, onDead?})`. Retry-aware sweep over `getDue`: `replay(entry)` (in-flight tracked in a module-local set, never persisted — a killed app drops it while the entry stays `pending` in IndexedDB, so a reload re-attempts it) → success deletes the entry (and the visit's draft once no entries remain) → transient failure `failed` + `retryCount+1` + `nextRetryAt`; budget exhausted (`>= MAX_RETRIES`) or `classifyError`-permanent → `dead` + `onDead(entry)`. Guards: no-op while `navigator.onLine === false` (offline spell never consumes retry budget), single-flight (concurrent sweeps skip), and `replayTimeoutMs` (default 30s) bounds each `replay` so a hung fetch can't wedge the guard. `_resetSweepGuardForTests` is the test-only guard reset.
- `src/hooks/use-queue-processor.ts` — `useQueueProcessor({companyId, replay, classifyError?, onDead?, sweepIntervalMs?, enabled?})` — wires the processor's triggers: `useOnlineStatus` (online+hydrated), `visibilitychange` → visible (covers Capacitor WebView resume + PWA tab return), 5s sweep interval; injects `replay`/`classifyError`/`onDead`; `enabled: false` (used on completed/other-tech pages) silences every trigger and makes `drain` a no-op; returns `drain` for an immediate sweep (e.g. after `retryDead`).

## Tenancy

Same invariant as the server DB layer: every read/write is scoped by `companyId`. Cross-tenant rows can't collide because both unique keys are compound on `companyId`. `clearCompanyData(companyId)` is the sign-out/tenant-switch wipe.

## Tests

`draft-visits.test.ts` + `mutation-queue.test.ts` + `processor.test.ts` + `backoff.test.ts` — use `fake-indexeddb` (happy-dom has no IndexedDB): `import "fake-indexeddb/auto"` then `db.delete()` + `db.open()` in `beforeEach`. No Prisma mocking. `backoff.test.ts` pins `Math.random` for deterministic jitter; `processor.test.ts` pins it too and toggles `navigator.onLine` for the offline-gate case. The processor's module-level single-flight guard is reset via `_resetSweepGuardForTests()` in `beforeEach`.

## Status

Write-through draft save is wired into `VisitForm` (`src/app/(dashboard)/visits/[visitId]/visit-form.tsx`): Save Draft persists to Dexie immediately (`saveDraft` + `enqueue`), then drains the queue via `useQueueProcessor` — `replay = (entry) => saveDraftAction(entry.visitId, entry.payload)` — with `classifyError` mapping Zod/access errors (deleted visit, other tech's visit) to permanent so they dead-letter immediately. A re-save calls `deleteDeadForVisit` so a newer save supersedes stale dead entries. A minimal dead-letter chip (per-visit dead count + Retry → `retryDead` + immediate `drain`) is shown above the form actions; full sync-status UI (badges/toasts) is the next card and consumes `getStats`. Completing a visit still clears its local draft + all queued entries. SW/precache and conflict resolution remain later cards.
