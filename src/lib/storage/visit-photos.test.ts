import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const PUBLIC_BASE = "https://photos.poolbench.com/";

vi.mock("./r2-client", () => ({
  getR2Client: vi.fn(() => ({ send: sendMock })),
  getR2BucketName: vi.fn(() => "test-bucket"),
  buildPublicUrl: vi.fn((key: string) => `${PUBLIC_BASE}${key}`),
  keyFromPublicUrl: vi.fn((url: string) =>
    url.startsWith(PUBLIC_BASE) ? url.slice(PUBLIC_BASE.length) : null,
  ),
}));

vi.mock("@/lib/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { uploadVisitPhoto, deleteVisitPhotoObject } = await import("./visit-photos");
const { logger } = await import("@/lib/log");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadVisitPhoto", () => {
  it("uploads to a serviceVisitPool-scoped key and returns the public URL", async () => {
    sendMock.mockResolvedValue({});
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    const url = await uploadVisitPhoto({
      companyId: "company-1",
      serviceVisitPoolId: "svp-1",
      file,
    });

    const keyPattern = /^photos\/company-1\/svp-1\/[0-9a-f-]{36}\.jpg$/;
    expect(url.startsWith(PUBLIC_BASE)).toBe(true);
    expect(url.slice(PUBLIC_BASE.length)).toMatch(keyPattern);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toMatch(keyPattern);
    expect(command.input.ContentType).toBe("image/jpeg");
  });
});

describe("deleteVisitPhotoObject", () => {
  it("deletes the object for an R2-hosted URL", async () => {
    sendMock.mockResolvedValue({});

    await deleteVisitPhotoObject(`${PUBLIC_BASE}photos/company-1/svp-1/old.jpg`);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "photos/company-1/svp-1/old.jpg",
    });
  });

  it("no-ops for a URL that isn't hosted in R2", async () => {
    await deleteVisitPhotoObject("https://example.com/legacy-photo.jpg");

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("swallows and logs a delete failure instead of throwing", async () => {
    sendMock.mockRejectedValue(new Error("network error"));

    await expect(
      deleteVisitPhotoObject(`${PUBLIC_BASE}photos/company-1/svp-1/old.jpg`),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});