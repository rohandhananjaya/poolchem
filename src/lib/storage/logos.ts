import "server-only";

import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { logger } from "@/lib/log";

import { extensionForMimeType } from "./logo-validation";
import { buildPublicUrl, getR2BucketName, getR2Client, keyFromPublicUrl } from "./r2-client";

/**
 * Uploads a validated company logo to R2 and returns its public URL.
 * Caller is responsible for validating `file` first (see `validateLogoFile`).
 */
export async function uploadCompanyLogo(
  companyId: string,
  file: File,
): Promise<string> {
  const key = `logos/${companyId}/${randomUUID()}.${extensionForMimeType(file.type)}`;
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
 * Best-effort delete of a previously-uploaded logo object. Never throws — a
 * failed cleanup must not block whatever save already succeeded. No-ops for
 * a URL that isn't hosted in R2 (e.g. a legacy external logo URL).
 */
export async function deleteCompanyLogoObject(publicUrl: string): Promise<void> {
  const key = keyFromPublicUrl(publicUrl);
  if (!key) return;

  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("R2 logo delete failed", {
      context: "storage.deleteCompanyLogoObject",
      metadata: { key, error: message },
    });
  }
}
