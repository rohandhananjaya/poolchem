import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

/** Constructs an S3 client pointed at the configured R2 account/bucket. */
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set. Add them to your environment variables.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/** Name of the R2 bucket objects are stored in. */
export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not set. Add it to your environment variables.");
  }
  return bucket;
}

/** Base public URL objects are read back through (no trailing slash). */
function getR2PublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) {
    throw new Error("R2_PUBLIC_URL is not set. Add it to your environment variables.");
  }
  return url.replace(/\/$/, "");
}

/** Builds the public URL an uploaded object is read back through. */
export function buildPublicUrl(key: string): string {
  return `${getR2PublicUrl()}/${key}`;
}

/**
 * Recovers the object key from a previously-built public URL, or `null` if
 * `url` isn't hosted under the configured R2 public URL (e.g. a legacy
 * external logo URL entered before uploads existed).
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = `${getR2PublicUrl()}/`;
  return url.startsWith(base) ? url.slice(base.length) : null;
}
