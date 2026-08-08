/**
 * Client-side draft-visit persistence (IndexedDB via Dexie).
 *
 * Holds a tech's unsaved visit form per visit per tenant so work survives an
 * offline spell or a reload. The payload is stored verbatim — the same shape a
 * Server Action expects — so a draft can later be replayed or re-submitted.
 *
 * All helpers are tenant-scoped by `companyId`; a visit's draft can never leak
 * across companies (compound unique key `[companyId+visitId]`).
 */
import { db } from "./db";
import type { DraftVisitPayload, OfflineDraftVisit } from "./types";

/**
 * Upserts a draft for a visit. One draft per visit per tenant — a second save
 * for the same visit replaces the stored one.
 *
 * @param serverVersion - Latest visit `version` known from the server, when one
 *   was observed; enables stale-write detection later (conflict-resolution work).
 */
export async function saveDraft(
  companyId: string,
  techId: string,
  visitId: string,
  payload: DraftVisitPayload,
  serverVersion?: number,
): Promise<OfflineDraftVisit> {
  // Check + upsert in a single readwrite transaction so two concurrent saves
  // of the same `[companyId+visitId]` can't both pass the existence check and
  // one hit the unique index with a ConstraintError.
  return db.transaction("rw", db.draftVisits, async () => {
    const existing = await db.draftVisits
      .where("[companyId+visitId]")
      .equals([companyId, visitId])
      .first();

    const updatedAt = Date.now();
    const row: OfflineDraftVisit = {
      visitId,
      companyId,
      techId,
      payload,
      ...(serverVersion !== undefined ? { serverVersion } : {}),
      updatedAt,
    };

    if (existing) {
      await db.draftVisits.update(existing.id!, {
        companyId,
        techId,
        payload,
        ...(serverVersion !== undefined ? { serverVersion } : {}),
        updatedAt,
      });
      return { ...row, id: existing.id };
    }
    const id = await db.draftVisits.add(row);
    return { ...row, id };
  });
}

/** Returns a visit's draft for a tenant, or `null` when none exists. */
export async function getDraft(
  companyId: string,
  visitId: string,
): Promise<OfflineDraftVisit | null> {
  return (
    (await db.draftVisits
      .where("[companyId+visitId]")
      .equals([companyId, visitId])
      .first()) ?? null
  );
}

/** Lists a tenant's drafts, most recently updated first. */
export async function listDrafts(companyId: string): Promise<OfflineDraftVisit[]> {
  return db.draftVisits.where("companyId").equals(companyId).reverse().sortBy("updatedAt");
}

/** Removes a visit's draft for a tenant. No-op when none exists. */
export async function deleteDraft(
  companyId: string,
  visitId: string,
): Promise<void> {
  await db.draftVisits
    .where("[companyId+visitId]")
    .equals([companyId, visitId])
    .delete();
}
