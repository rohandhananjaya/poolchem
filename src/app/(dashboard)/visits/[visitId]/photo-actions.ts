"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { assertVisitAccess } from "@/lib/db/visits";
import { addVisitPhoto, deleteVisitPhoto } from "@/lib/db/visit-photos";
import {
  deleteVisitPhotoObject,
  uploadVisitPhoto,
} from "@/lib/storage";

export interface UploadVisitPhotoResult {
  ok: boolean;
  photo?: Awaited<ReturnType<typeof addVisitPhoto>>;
  error?: string;
}

/**
 * Uploads a visit photo for one body of water (`serviceVisitPoolId`). The file
 * is put in R2 by the storage helper; only then is the DB row created. If the
 * insert fails the freshly-uploaded object is cleaned up best-effort so R2
 * objects never outlive their DB row.
 *
 * `clientMutationId` (optional) makes a replay idempotent end-to-end: it is
 * used as the R2 object key seed (stable key, so a crash between PUT and insert
 * doesn't orphan a second object) AND forwarded to `addVisitPhoto`, which
 * returns the existing row on a duplicate. Both halves are load-bearing — pass
 * it for offline-queue replays, omit it for live online uploads.
 */
export async function uploadVisitPhotoAction(
  visitId: string,
  serviceVisitPoolId: string,
  formData: FormData,
  clientMutationId?: string,
): Promise<UploadVisitPhotoResult> {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No photo selected." };
  }

  const url = await uploadVisitPhoto({
    companyId: user.companyId,
    serviceVisitPoolId,
    file,
    ...(clientMutationId !== undefined ? { keySeed: clientMutationId } : {}),
  });

  let photo;
  try {
    photo = await addVisitPhoto(
      { serviceVisitPoolId, url, ...(clientMutationId !== undefined ? { clientMutationId } : {}) },
      user.companyId,
    );
  } catch (err) {
    await deleteVisitPhotoObject(url);
    throw err;
  }

  revalidatePath(`/visits/${visitId}`);
  return { ok: true, photo };
}

export interface DeleteVisitPhotoResult {
  ok: boolean;
  error?: string;
}

/**
 * Deletes a visit photo. The R2 object is removed using the AUTHORITATIVE url
 * from the DB row (never a client-supplied one), after the row is gone — so a
 * foreign or missing photo id returns before any object is touched.
 */
export async function deleteVisitPhotoAction(
  visitId: string,
  visitPhotoId: string,
): Promise<DeleteVisitPhotoResult> {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);

  const deleted = await deleteVisitPhoto(visitPhotoId, user.companyId);
  if (!deleted) {
    return { ok: false, error: "Photo not found." };
  }

  await deleteVisitPhotoObject(deleted.url);

  revalidatePath(`/visits/${visitId}`);
  return { ok: true };
}