import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-keys/auth", () => ({
  authenticateApiKey: vi.fn(),
}));
vi.mock("@/lib/db/reports", () => ({
  getCompanyReportData: vi.fn(),
}));

const { authenticateApiKey } = await import("@/lib/api-keys/auth");
const { getCompanyReportData } = await import("@/lib/db/reports");
const { GET } = await import("./route");

const rateLimit = { allowed: true, remaining: 59, limit: 60, resetAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticateApiKey).mockResolvedValue({
    companyId: "company-1",
    apiKey: {} as never,
    rateLimit,
  });
});

describe("GET /api/v1/visits", () => {
  it("defaults to page 1 and returns the report data", async () => {
    vi.mocked(getCompanyReportData).mockResolvedValue({ recentVisits: [], total: 0 });

    const res = await GET(new NextRequest("http://localhost/api/v1/visits"));

    expect(res.status).toBe(200);
    expect(getCompanyReportData).toHaveBeenCalledWith("company-1", 1, {
      poolId: undefined,
      fromDate: undefined,
      toDate: undefined,
    });
  });

  it("passes through valid page and date filters", async () => {
    vi.mocked(getCompanyReportData).mockResolvedValue({ recentVisits: [], total: 0 });

    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/visits?page=3&fromDate=2026-07-01&toDate=2026-07-21&poolId=pool-1",
      ),
    );

    expect(res.status).toBe(200);
    expect(getCompanyReportData).toHaveBeenCalledWith("company-1", 3, {
      poolId: "pool-1",
      fromDate: "2026-07-01",
      toDate: "2026-07-21",
    });
  });

  it("returns 400 for a malformed date filter", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/v1/visits?fromDate=not-a-date"),
    );

    expect(res.status).toBe(400);
    expect(getCompanyReportData).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-positive page", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/visits?page=0"));

    expect(res.status).toBe(400);
  });
});
