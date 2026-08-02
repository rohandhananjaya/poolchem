import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const PUBLIC_BASE = "https://logos.poolbench.com/";

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

const { uploadCompanyLogo, deleteCompanyLogoObject } = await import("./logos");
const { logger } = await import("@/lib/log");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadCompanyLogo", () => {
  it("uploads to a company-scoped key and returns the public URL", async () => {
    sendMock.mockResolvedValue({});
    const file = new File(["x"], "logo.png", { type: "image/png" });

    const url = await uploadCompanyLogo("company-1", file);

    const keyPattern = /^logos\/company-1\/[0-9a-f-]{36}\.png$/;
    expect(url.startsWith(PUBLIC_BASE)).toBe(true);
    expect(url.slice(PUBLIC_BASE.length)).toMatch(keyPattern);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toMatch(keyPattern);
    expect(command.input.ContentType).toBe("image/png");
  });
});

describe("deleteCompanyLogoObject", () => {
  it("deletes the object for an R2-hosted URL", async () => {
    sendMock.mockResolvedValue({});

    await deleteCompanyLogoObject(`${PUBLIC_BASE}logos/company-1/old.png`);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "logos/company-1/old.png",
    });
  });

  it("no-ops for a URL that isn't hosted in R2", async () => {
    await deleteCompanyLogoObject("https://example.com/legacy-logo.png");

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("swallows and logs a delete failure instead of throwing", async () => {
    sendMock.mockRejectedValue(new Error("network error"));

    await expect(
      deleteCompanyLogoObject(`${PUBLIC_BASE}logos/company-1/old.png`),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
