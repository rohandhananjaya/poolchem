import "server-only";

import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { logger } from "@/lib/log";

import { extensionForPhotoMimeType } from "./photo-format";
import { buildPublicUrl, getR2BucketName, getR2Client, keyFromPublicUrl } from "./r2-client";

/**
 * Uploads a visit photo to R2 and returns its public URL. Objects are keyed
 * per body of water (`serviceVisitPoolId`), matching the landed `VisitPhoto`
 * schema. Caller is responsible for tenancy/validation (the db-helper card's
 * `addVisitPhoto` tenant-scopes the insert).
 */
export async function uploadVisitPhoto(input: {
  companyId: string;
  serviceVisitPoolId: string;
  file: File;
}): Promise<string> {
  const { companyId, serviceVisitPoolId, file } = input;
  const key = `photos/${companyId}/${serviceVisitPoolId}/${randomUUID()}.${extensionForPhotoMimeType(file.type)}`;
  const body = new Uint8Array(await file.arrayBuffer());

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: file.type,
    }),
  );

  return buildPublicUrl(key);
}

/**
 * Best-effort delete of a previously-uploaded visit-photo object. Never
 * throws — a failed cleanup must not block whatever save already succeeded.
 * No-ops for a URL that isn't hosted in R2.
 */
export async function deleteVisitPhotoObject(publicUrl: string): Promise<void> {
  const key = keyFromPublicUrl(publicUrl);
  if (!key) return;

  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("R2 visit-photo delete failed", {
      context: "storage.deleteVisitPhotoObject",
      metadata: { key, error: message },
    });
  }
}