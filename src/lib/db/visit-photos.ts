/**
 * Data access for {@link VisitPhoto} — a photo taken during a service visit,
 * keyed per body of water via the `ServiceVisitPool` join row. `companyId` is
 * stored directly on the row (matching the ServiceVisitPool/Property
 * precedent) so tenancy filters stay indexed; the invariant that a photo's
 * `companyId` MUST equal its body's `companyId` is enforced at write time by
 * `assertServiceVisitPoolOwnedByCompany`.
 */
import "server-only";

import type { VisitPhoto, VisitPhotoCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

/**
 * Tenant-FK guard: throws unless the body of water (`serviceVisitPoolId`)
 * resolves to `companyId`. Load-bearing: `serviceVisitPoolId` is the one
 * caller-supplied untrusted input in this module; `companyId` always comes
 * from the session, never the input.
 *
 * @throws {NotFoundError} When the body is missing or owned by another company.
 */
export async function assertServiceVisitPoolOwnedByCompany(
  serviceVisitPoolId: string,
  companyId: string,
): Promise<void> {
  const body = await prisma.serviceVisitPool.findFirst({
    where: { id: serviceVisitPoolId, companyId },
    select: { id: true },
  });
  if (!body) {
    throw new NotFoundError(
      `Body of water "${serviceVisitPoolId}" not found for this company.`,
    );
  }
}

/** Input to {@link addVisitPhoto}. `category`/`sortOrder` are optional. */
export interface AddVisitPhotoInput {
  serviceVisitPoolId: string;
  url: string;
  category?: VisitPhotoCategory;
  sortOrder?: number;
  /** Device-generated idempotency key for offline-queue replay. */
  clientMutationId?: string;
}

/**
 * Adds a photo to a body of water, tenant-guarded. When `sortOrder` is
 * omitted it is auto-appended (max existing + 1) so new photos land at the
 * end of the ordering.
 *
 * When `clientMutationId` is present, a prior row with the same key (and
 * company) is returned instead of inserting a duplicate — a replayed offline
 * upload resolves to the original photo.
 *
 * @throws {NotFoundError} When the body is missing or owned by another company.
 */
export async function addVisitPhoto(
  input: AddVisitPhotoInput,
  companyId: string,
): Promise<VisitPhoto> {
  await assertServiceVisitPoolOwnedByCompany(input.serviceVisitPoolId, companyId);

  // Replay dedupe: an already-applied upload with the same idempotency key
  // returns the existing row instead of inserting a duplicate.
  if (input.clientMutationId !== undefined) {
    const existing = await prisma.visitPhoto.findFirst({
      where: { clientMutationId: input.clientMutationId, companyId },
    });
    if (existing) return existing;
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.visitPhoto.findFirst({
      where: { serviceVisitPoolId: input.serviceVisitPoolId, companyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  return prisma.visitPhoto.create({
    data: {
      serviceVisitPoolId: input.serviceVisitPoolId,
      companyId,
      url: input.url,
      ...(input.category !== undefined ? { category: input.category } : {}),
      sortOrder,
      ...(input.clientMutationId !== undefined
        ? { clientMutationId: input.clientMutationId }
        : {}),
    },
  });
}

/**
 * Returns a body of water's photos, `sortOrder` then `createdAt` ascending.
 * Cross-tenant body id yields `[]`.
 */
export async function listVisitPhotos(
  serviceVisitPoolId: string,
  companyId: string,
): Promise<VisitPhoto[]> {
  return prisma.visitPhoto.findMany({
    where: { serviceVisitPoolId, companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Deletes a photo, scoped to `companyId`, and returns the deleted row.
 *
 * Returns `null` when the photo is missing or owned by another company. Callers
 * use the returned row's AUTHORITATIVE `url` to clean up the backing R2 object
 * — never trust a client-supplied url, since `deleteVisitPhotoObject` accepts
 * any public URL. Row-first ordering means a foreign `visitPhotoId` resolves to
 * `null` before any object is touched.
 */
export async function deleteVisitPhoto(
  visitPhotoId: string,
  companyId: string,
): Promise<VisitPhoto | null> {
  const existing = await prisma.visitPhoto.findFirst({
    where: { id: visitPhotoId, companyId },
  });
  if (!existing) {
    return null;
  }
  return prisma.visitPhoto.delete({ where: { id: visitPhotoId } });
}

/**
 * Applies a caller-provided ordering to a body's photos, atomically. Every id
 * in `orderedIds` must resolve to a photo of the SAME body and company, else
 * nothing is written.
 *
 * @throws {NotFoundError} When the body is foreign, or any photo id is
 * missing/owned by another company.
 */
export async function reorderVisitPhotos(
  serviceVisitPoolId: string,
  companyId: string,
  orderedIds: string[],
): Promise<void> {
  await assertServiceVisitPoolOwnedByCompany(serviceVisitPoolId, companyId);

  const owned = await prisma.visitPhoto.findMany({
    where: { id: { in: orderedIds }, serviceVisitPoolId, companyId },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((photo) => photo.id));
  const foreign = orderedIds.filter((id) => !ownedSet.has(id));
  if (foreign.length > 0) {
    throw new NotFoundError(
      `Photo(s) ${foreign.join(", ")} not found for this body of water or company.`,
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.visitPhoto.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  );
}