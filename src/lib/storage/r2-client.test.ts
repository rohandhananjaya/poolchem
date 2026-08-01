import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";

import {
  buildPublicUrl,
  getR2BucketName,
  getR2Client,
  keyFromPublicUrl,
} from "./r2-client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getR2Client", () => {
  it("throws when credentials are missing", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");

    expect(() => getR2Client()).toThrow(/R2_ACCOUNT_ID/);
  });

  it("builds an S3Client pointed at the R2 endpoint when configured", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct-1");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key-1");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-1");

    expect(getR2Client()).toBeInstanceOf(S3Client);
  });
});

describe("getR2BucketName", () => {
  it("throws when unset", () => {
    vi.stubEnv("R2_BUCKET_NAME", "");
    expect(() => getR2BucketName()).toThrow(/R2_BUCKET_NAME/);
  });

  it("returns the configured bucket name", () => {
    vi.stubEnv("R2_BUCKET_NAME", "my-bucket");
    expect(getR2BucketName()).toBe("my-bucket");
  });
});

describe("buildPublicUrl / keyFromPublicUrl", () => {
  it("round-trips a key through the public URL", () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://logos.poolbench.app");

    const url = buildPublicUrl("logos/company-1/abc.png");

    expect(url).toBe("https://logos.poolbench.app/logos/company-1/abc.png");
    expect(keyFromPublicUrl(url)).toBe("logos/company-1/abc.png");
  });

  it("returns null for a URL not hosted under R2_PUBLIC_URL", () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://logos.poolbench.app");

    expect(keyFromPublicUrl("https://example.com/logo.png")).toBeNull();
  });

  it("throws building a public URL when R2_PUBLIC_URL is unset", () => {
    vi.stubEnv("R2_PUBLIC_URL", "");

    expect(() => buildPublicUrl("logos/x.png")).toThrow(/R2_PUBLIC_URL/);
  });
});
