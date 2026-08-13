# src/lib/storage — object-storage layer

`import "server-only"` R2 helpers (Cloudflare bucket, S3-compatible via `@aws-sdk/client-s3`). No Prisma imports — pure object storage. Config lives in env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (no trailing slash) — see `.env.example`.

## Invariant — objects-always-keyed-by-visit-body

Photo objects are keyed `photos/{companyId}/{serviceVisitPoolId}/{uuid}.{ext}` — by the **`ServiceVisitPool` join row**, NEVER by legacy `visitId`. This matches the landed `VisitPhoto` schema (`serviceVisitPoolId` key). Build photo keys off `serviceVisitPoolId` or they'll orphan on multi-body visits. Logos use company-only keys (`logos/{companyId}/{uuid}.{ext}`); `photos/` namespaces the bucket away with zero extra config.

## API (signatures)

**r2-client.ts** (shared plumbing)
- `getR2Client() → S3Client` — throws if R2 env unset
- `getR2BucketName() → string` — throws if unset
- `buildPublicUrl(key) → string`
- `keyFromPublicUrl(url) → string | null` — recovers the key, or `null` for a non-R2 URL

**logos.ts**
- `uploadCompanyLogo(companyId, file) → Promise<string>` — key `logos/{companyId}/{uuid}.{ext}`; caller validates with `validateLogoFile` first
- `deleteCompanyLogoObject(publicUrl) → Promise<void>` — best-effort, never throws, logs via `@/lib/log`

**logo-validation.ts** (pure)
- `validateLogoFile(file) → LogoValidationResult` · `extensionForMimeType(mime) → string` · `MAX_LOGO_BYTES` · `ALLOWED_LOGO_MIME_TYPES`

**photo-format.ts** (pure)
- `extensionForPhotoMimeType(mime) → string` — `jpg` for `image/jpeg`, `png`, `webp`, else `bin`
- `validatePhotoFile(file) → PhotoValidationResult` — `{ ok:false }` for empty / >6MB / non-JPEG-PNG-WebP (mirrors `logo-validation.ts`)
- `MAX_PHOTO_BYTES = 6MB` (clears the 8mb `serverActions.bodySizeLimit` with multipart overhead) · `ALLOWED_PHOTO_MIME_TYPES` · `PhotoValidationResult`

**visit-photos.ts**
- `uploadVisitPhoto({ companyId, serviceVisitPoolId, file }) → Promise<string>` — key `photos/{companyId}/{serviceVisitPoolId}/{uuid}.{ext}`, `PutObjectCommand`, returns public URL. Storage stays dumb — no tenancy/ownership verification here (db-helper `addVisitPhoto` tenant-scopes the insert)
- `deleteVisitPhotoObject(publicUrl) → Promise<void>` — best-effort (mirrors logos delete), no-op for non-R2 URLs, logs failure via `@/lib/log`