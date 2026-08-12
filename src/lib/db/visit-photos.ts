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
}

/**
 * Adds a photo to a body of water, tenant-guarded. When `sortOrder` is
 * omitted it is auto-appended (max existing + 1) so new photos land at the
 * end of the ordering.
 *
 * @throws {NotFoundError} When the body is missing or owned by another company.
 */
export async function addVisitPhoto(
  input: AddVisitPhotoInput,
  companyId: string,
): Promise<VisitPhoto> {
  await assertServiceVisitPoolOwnedByCompany(input.serviceVisitPoolId, companyId);

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
 * Deletes a photo, scoped to `companyId`.
 *
 * @throws {NotFoundError} When the photo is missing or owned by another company.
 */
export async function deleteVisitPhoto(
  visitPhotoId: string,
  companyId: string,
): Promise<void> {
  const { count } = await prisma.visitPhoto.deleteMany({
    where: { id: visitPhotoId, companyId },
  });
  if (count === 0) {
    throw new NotFoundError(
      `Photo "${visitPhotoId}" not found for this company.`,
    );
  }
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