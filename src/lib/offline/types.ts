/**
 * Client-safe structural types for the offline layer.
 *
 * These mirror the Server Action payload shape (`VisitFormValues` in
 * `src/app/(dashboard)/visits/[visitId]/actions.ts`) and the data shapes
 * persisted by `src/lib/db/visits.ts`. That module is `server-only` and cannot
 * be imported client-side, so the offline layer declares its own structural
 * equivalents (LSP). Keep field names in sync with the server-side types.
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
 * A visit form payload ready to replay to the server — mirrors
 * `VisitFormValues`. Stored verbatim by the offline layer so a queued mutation
 * can be replayed to the matching Server Action unchanged.
 */
export interface DraftVisitPayload {
  readings: OfflineReadings;
  chemicals: OfflineChemical[];
  notes: string;
  /** YYYY-MM-DD string, or undefined to leave unset. */
  nextServiceDate?: string;
  /** Device-generated idempotency key for offline replay. Optional. */
  clientMutationId?: string;
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

/** Server Action a queued mutation will replay. Extensible for future actions. */
export type MutationAction = "saveDraft" | "completeVisit";

/** A queued offline mutation awaiting (or retrying) a server replay. */
export interface QueuedMutation {
  /** Dexie auto-increment primary key. */
  id?: number;
  companyId: string;
  /** `MutationAction` this entry replays. */
  action: MutationAction;
  visitId: string;
  payload: DraftVisitPayload;
  /**
   * Idempotency key passed to the Server Action so a replayed mutation is a
   * no-op server-side. Unique per tenant — a re-enqueued mutation is dropped.
   */
  clientMutationId: string;
  status: MutationStatus;
  retryCount: number;
  /** Last failure message, for diagnostics. */
  lastError?: string;
  createdAt: number;
  updatedAt: number;
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
