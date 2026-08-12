/**
 * Client-safe structural types for the offline layer.
 *
 * These mirror the Server Action payload shapes (`VisitFormValues` in
 * `src/app/(dashboard)/visits/[visitId]/actions.ts`, the schedule/pool action
 * inputs) and the data shapes in `src/lib/db/visits.ts`. Those modules are
 * `server-only` and cannot be imported client-side, so the offline layer
 * declares its own structural equivalents (LSP). Keep field names in sync with
 * the server-side types.
 *
 * `QueuedMutation` is a discriminated union on `action`: every queued write the
 * tech can make offline (visit draft/complete/status, schedule a visit, pool
 * CRUD) carries an action-typed `payload` mirroring its Server Action's input
 * shape, so the replay layer can route each entry to the right action
 * unchanged. Visit-scoped actions (`saveDraft`, `completeVisit`,
 * `updateVisitStatus`) also carry `visitId`; the rest carry nothing beyond
 * their payload. Extensible: adding a new offline-capable action means adding
 * its literal to `MutationAction` + a payload interface here.
 *
 * Pure types + `createClientMutationId()` only — no I/O.
 */

/**
 * A full set of water-test readings — mirrors the Server Action's optional
 * `ReadingsInput` shape. Fields are optional so a local draft payload stays
 * faithful to what the tech actually entered (a blank field is not coerced to
 * 0 until the server boundary normalizes it). Replays verbatim.
 */
export interface OfflineReadings {
  ph?: number;
  freeChlorine?: number;
  totalAlkalinity?: number;
  calciumHardness?: number;
  cyanuricAcid?: number;
  temperature?: number;
}

/** A single chemical the tech added during a visit — mirrors `VisitChemical`. */
export interface OfflineChemical {
  name: string;
  amount: number;
  unit: string;
}

/**
 * One body of water's form state — mirrors `VisitBodyFormValues` in the visit
 * form's Server Actions. Keyed to a `ServiceVisitPool` join row of the visit.
 */
export interface OfflineVisitBody {
  serviceVisitPoolId: string;
  readings: OfflineReadings;
  chemicals: OfflineChemical[];
}

/**
 * A visit form payload ready to replay to the server — mirrors
 * `VisitFormValues`. Stored verbatim by the offline layer so a queued mutation
 * can be replayed to the matching Server Action unchanged. `bodies` holds one
 * entry per body of water the visit serves (mirrors the per-body replacement
 * contract of `completeVisit`/`saveDraftVisit`).
 */
export interface DraftVisitPayload {
  bodies: OfflineVisitBody[];
  notes: string;
  /** YYYY-MM-DD string, or undefined to leave unset. */
  nextServiceDate?: string;
  /** Device-generated idempotency key for offline replay. Optional. */
  clientMutationId?: string;
  /**
   * Revision the client last observed from the server. Replayed with the payload
   * so a replayed `completeVisit` is rejected (version conflict) instead of
   * clobbering a visit updated on another device. Drafts stay last-write-wins.
   */
  expectedVersion?: number;
}

/** A locally stored draft of an in-progress visit (one per visit per tenant). */
export interface OfflineDraftVisit {
  /** Dexie auto-increment primary key. */
  id?: number;
  visitId: string;
  companyId: string;
  techId: string;
  payload: DraftVisitPayload;
  /** Last `version` known from the server, when one was seen. */
  serverVersion?: number;
  updatedAt: number;
}

/** Lifecycle of a queued offline mutation. */
export type MutationStatus = "pending" | "processing" | "failed" | "dead";

/** Client-safe mirror of Prisma's `ServiceVisitStatus` enum. */
export type OfflineServiceVisitStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Every offline-capable Server Action the queue can replay. Extensible: a new
 * action literal here + a payload interface below is all a new offline-capable
 * mutation needs.
 */
export type MutationAction =
  | "saveDraft"
  | "completeVisit"
  | "updateVisitStatus"
  | "createVisit"
  | "createPool"
  | "updatePool"
  | "deletePool";

/**
 * Actions whose queue entry carries a `visitId`. Only these can have a local
 * visit draft (the processor's success-cleanup deletes the draft once no
 * entries remain for a visit). `createVisit` is deliberately excluded — the
 * visit doesn't exist yet when the mutation is enqueued.
 */
export type VisitScopedAction = "saveDraft" | "completeVisit" | "updateVisitStatus";

/** Every visit-related action (whether or not a visitId is known yet). */
export type VisitMutationAction = VisitScopedAction | "createVisit";

/** Pool CRUD actions — no visitId, replayed against `pools/actions.ts`. */
export type PoolMutationAction = "createPool" | "updatePool" | "deletePool";

/** True when `action` is visit-scoped (the entry carries `visitId`). */
export function isVisitScopedAction(action: MutationAction): action is VisitScopedAction {
  return (
    action === "saveDraft" ||
    action === "completeVisit" ||
    action === "updateVisitStatus"
  );
}

/** True when `action` replays a pool mutation. */
export function isPoolMutationAction(action: MutationAction): action is PoolMutationAction {
  return action === "createPool" || action === "updatePool" || action === "deletePool";
}

/**
 * Payload for `updateVisitStatus` — mirrors `updateVisitStatusAction(visitId,
 * status)`. The status transition is naturally idempotent (replaying the same
 * status is a no-op), so it carries no idempotency key.
 */
export interface UpdateVisitStatusPayload {
  status: OfflineServiceVisitStatus;
}

/**
 * Payload for `createVisit` (schedule a new visit) — mirrors the logical input
 * of `scheduleVisitAction` (poolIds + date + resolved techId), stored as a
 * JSON-friendly object instead of `FormData`. `clientMutationId` rides along so
 * a replayed schedule dedupes against the ServiceVisit's unique key.
 */
export interface CreateVisitPayload {
  /** The pools the visit serves; the server pins the legacy FK to the first. */
  poolIds: string[];
  /** YYYY-MM-DD string; the server interprets it at local noon. */
  date: string;
  /** Tech to assign, or `null`/absent for unassigned (TECH users self-assign server-side). */
  techId?: string | null;
  clientMutationId?: string;
}

/** Payload for `createPool` — mirrors `CreatePoolData` in `src/lib/db/pools.ts`. */
export interface CreatePoolPayload {
  name: string;
  volume: number;
  address?: string;
  homeownerEmail?: string;
  homeownerPhone?: string;
  notes?: string;
  /** Idempotency key; `Pool.clientMutationId` dedupes replays (added Phase 3). */
  clientMutationId?: string;
}

/** Payload for `updatePool` — mirrors `updatePoolAction`'s fields. */
export interface UpdatePoolPayload {
  poolId: string;
  name: string;
  volume: number;
  address?: string;
  homeownerEmail?: string;
  homeownerPhone?: string;
  notes?: string;
  isActive: boolean;
  clientMutationId?: string;
}

/** Payload for `deletePool` — only the target id; deletes are idempotent. */
export interface DeletePoolPayload {
  poolId: string;
}

/** Fields every queued mutation shares, regardless of action. */
export interface QueuedMutationBase {
  /** Dexie auto-increment primary key. */
  id?: number;
  companyId: string;
  /** Idempotency key passed to the Server Action (unique per tenant). */
  clientMutationId: string;
  status: MutationStatus;
  retryCount: number;
  /** Last failure message, for diagnostics. */
  lastError?: string;
  /**
   * Epoch-ms before which the entry must not be retried (backoff schedule). Set
   * when a transient failure schedules the next attempt; absent on entries that
   * have never failed or are retried immediately (e.g. after `retryDead`).
   */
  nextRetryAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SaveDraftMutation extends QueuedMutationBase {
  action: "saveDraft";
  visitId: string;
  payload: DraftVisitPayload;
}

export interface CompleteVisitMutation extends QueuedMutationBase {
  action: "completeVisit";
  visitId: string;
  payload: DraftVisitPayload;
}

export interface UpdateVisitStatusMutation extends QueuedMutationBase {
  action: "updateVisitStatus";
  visitId: string;
  payload: UpdateVisitStatusPayload;
}

export interface CreateVisitMutation extends QueuedMutationBase {
  action: "createVisit";
  payload: CreateVisitPayload;
}

export interface CreatePoolMutation extends QueuedMutationBase {
  action: "createPool";
  payload: CreatePoolPayload;
}

export interface UpdatePoolMutation extends QueuedMutationBase {
  action: "updatePool";
  payload: UpdatePoolPayload;
}

export interface DeletePoolMutation extends QueuedMutationBase {
  action: "deletePool";
  payload: DeletePoolPayload;
}

/**
 * A queued offline mutation awaiting (or retrying) a server replay. Discriminated
 * on `action` so a typed replay layer can route each entry to its Server Action.
 */
export type QueuedMutation =
  | SaveDraftMutation
  | CompleteVisitMutation
  | UpdateVisitStatusMutation
  | CreateVisitMutation
  | CreatePoolMutation
  | UpdatePoolMutation
  | DeletePoolMutation;

/** Action → payload map — the single source of truth for payload typing. */
export interface ActionPayloadMap {
  saveDraft: DraftVisitPayload;
  completeVisit: DraftVisitPayload;
  updateVisitStatus: UpdateVisitStatusPayload;
  createVisit: CreateVisitPayload;
  createPool: CreatePoolPayload;
  updatePool: UpdatePoolPayload;
  deletePool: DeletePoolPayload;
}

/** The payload union over every queued action. */
export type QueuedMutationPayload = ActionPayloadMap[MutationAction];

/** Action → concrete mutation variant map — types `enqueue`'s return. */
export interface QueuedMutationByAction {
  saveDraft: SaveDraftMutation;
  completeVisit: CompleteVisitMutation;
  updateVisitStatus: UpdateVisitStatusMutation;
  createVisit: CreateVisitMutation;
  createPool: CreatePoolMutation;
  updatePool: UpdatePoolMutation;
  deletePool: DeletePoolMutation;
}

/** A tenant's last-sync bookmark — drives the offline banner's timestamp. */
export interface SyncMeta {
  /** Tenant id — the table's primary key (one row per tenant). */
  companyId: string;
  /** Epoch-ms of the last successful sync sweep for the tenant. */
  lastSyncedAt: number;
}

/**
 * A cached pool row for the offline pools list — mirrors the fields of
 * `PoolWithLastVisit` (in `src/lib/db/pools.ts`) that the client renders
 * (`PoolRow`). `lastVisitAt` is stored as an ISO string so the snapshot stays
 * JSON-safe in IndexedDB (kept deliberately parallel to the other offline
 * payloads). Keep field names in sync with the server-side type.
 */
export interface CachedPool {
  id: string;
  name: string;
  volume: number;
  address: string | null;
  homeownerEmail: string | null;
  homeownerPhone: string | null;
  notes: string | null;
  propertyId: string | null;
  propertyName: string | null;
  isActive: boolean;
  lastVisitAt: string | null;
}

/**
 * A tenant's last-observed snapshot of the `/pools` list, captured client-side
 * whenever the page renders successfully (`<PoolsCacheMirror>`). Rendered
 * offline (via `<OfflineRouteView>`) in place of the generic "You're offline"
 * fallback so a tech still sees their pools without a connection.
 */
export interface PoolCacheSnapshot {
  /** Tenant id — the table's primary key (one row per tenant). */
  companyId: string;
  /** The pools shown on the page at snapshot time (page 1 of the current filter). */
  pools: CachedPool[];
  /** Total matching pools across pages (mirrors `getPoolsPaginated`). */
  total: number;
  /** Epoch-ms of when the snapshot was captured. */
  cachedAt: number;
}

/**
 * A cached visit row for the offline `/visits/{id}` view — mirrors the rendered
 * fields of `getVisitById` (`ServiceVisit` + `pool` + `waterReadings` +
 * `chemicalsAdded` + `tech`) plus the pool's `lastReadings`. Stored per
 * (tenant, visit) so the offline fallback can render the last-observed visit
 * instead of the generic "You're offline" page. `scheduledAt` is an ISO string
 * and `cachedAt` is epoch-ms so the snapshot stays JSON-safe in IndexedDB. Keep
 * field names in sync with the server-side types.
 */
export interface CachedVisit {
  /** Dexie auto-increment primary key (not part of the business key). */
  id?: number;
  /** Visit id — half of the compound unique key (with `companyId`). */
  visitId: string;
  /** Tenant id — the other half of the compound unique key. */
  companyId: string;
  /** The visit's pool — what the visit header renders. */
  pool: {
    id: string;
    name: string;
    address: string | null;
    volume: number;
    image: string | null;
  };
  status: OfflineServiceVisitStatus;
  cancellationReason: string | null;
  /** ISO string of the scheduled time, when the visit has one. */
  scheduledAt: string | null;
  /**
   * The readings the form would show at snapshot time: the visit's own
   * `waterReadings[0]` when present, else the pool's `lastReadings`.
   */
  lastReadings: OfflineReadings | null;
  chemicals: OfflineChemical[];
  notes: string | null;
  /** Epoch-ms of when the snapshot was captured — stamped by `saveVisitCache`. */
  cachedAt?: number;
}

/** Mints a client-side idempotency key (RFC 4122 v4 UUID). */
export function createClientMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // `crypto.randomUUID()` requires a secure context (https or localhost); fall
  // back to a time+random key when served over plain http (LAN dev, Capacitor
  // `server.url` pointed at a non-TLS host).
  return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
