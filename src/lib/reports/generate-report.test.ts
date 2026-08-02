import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/visits", () => ({
  getVisitById: vi.fn(),
  getVisitHistory: vi.fn(),
  getPoolNextScheduledVisit: vi.fn(),
}));
vi.mock("@/lib/db/company", () => ({
  getCompanyById: vi.fn(),
}));
vi.mock("@/lib/db/packages", () => ({
  getCompanyPackage: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const { getVisitById, getVisitHistory, getPoolNextScheduledVisit } = await import("@/lib/db/visits");
const { getCompanyById } = await import("@/lib/db/company");
const { getCompanyPackage } = await import("@/lib/db/packages");
const { headers } = await import("next/headers");
const { generateServiceReport } = await import("./generate-report");

const companyId = "company-1";
const visitId = "visit-1";

const mockPool = {
  id: "pool-1",
  name: "Test Pool",
  address: "123 Pool St",
  volume: 10_000,
  publicToken: "tok_abc",
};

const mockCompany = {
  id: companyId,
  name: "Test Company",
  email: "test@company.com",
  logo: null,
  phone: null,
  address: null,
  active: true,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subscriptionStatus: null,
  paypalSubscriptionId: null,
  paypalPlanId: null,
  fromEmail: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockReadings = [
  {
    ph: 7.5,
    freeChlorine: 2,
    totalAlkalinity: 100,
    calciumHardness: 300,
    cyanuricAcid: 40,
    temperature: 80,
  },
];

const mockVisit = {
  id: visitId,
  pool: mockPool,
  tech: { name: "Tech 1" },
  waterReadings: mockReadings,
  chemicalsAdded: [{ name: "Chlorine", amount: 1, unit: "gal" }],
  status: "COMPLETED",
  notes: "All good",
  createdAt: new Date("2026-07-11T10:00:00Z"),
  poolId: mockPool.id,
  publicToken: "report_tok_123",
  nextServiceDate: null,
};

const mockCompanyPackage = (healthScoring: "basic" | "advanced+lsi") => ({
  package: {
    id: "pkg-1",
    slug: "basic",
    name: "Basic",
    price: 2900,
    features: {
      max_pools: 25,
      health_scoring: healthScoring,
      chemical_recs: true,
      service_reports: true,
      qr_code: true,
      scheduling: true,
      max_techs: 1,
      priority_support: false,
      custom_branding: false,
      api_access: false,
      csv_import: false,
    },
    sortOrder: 1,
  },
  status: "ACTIVE",
  trialStart: null,
  trialEnd: null,
  paidAt: new Date(),
  pendingPackage: null,
  pendingEffectiveAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCompanyPackage).mockResolvedValue(
    mockCompanyPackage("advanced+lsi") as never,
  );
});

describe("generateServiceReport", () => {
  it("returns a fully populated report when all data exists", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit);
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany);
    vi.mocked(getVisitHistory).mockResolvedValue([
      {
        createdAt: new Date("2026-07-04"),
        waterReadings: mockReadings,
      },
    ]);
    vi.mocked(getPoolNextScheduledVisit).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(
      new Map([["host", "example.com"], ["x-forwarded-proto", "https"]]) as never,
    );

    const result = await generateServiceReport(visitId, companyId);

    expect(result).not.toBeNull();
    expect(result!.visit.id).toBe(visitId);
    expect(result!.company.name).toBe("Test Company");
    expect(result!.pool.name).toBe("Test Pool");
    expect(result!.tech.name).toBe("Tech 1");
    expect(result!.waterHealth!.score).toBe(100);
    expect(result!.lsi!.status).toBe("BALANCED");
    expect(result!.parameters).toHaveLength(6);
    expect(result!.chemicalsAdded).toEqual([
      { name: "Chlorine", amount: 1, unit: "gal" },
    ]);
    expect(result!.scoreHistory).toHaveLength(1);
    expect(result!.nextServiceDate).toBeNull();
    expect(result!.homeownerUrl).toContain("example.com");
    expect(result!.homeownerUrl).toContain("/pool/tok_abc");
    expect(result!.reportUrl).toContain("example.com");
    expect(result!.reportUrl).toContain("/report/report_tok_123");
  });

  it("returns null when visit is not found", async () => {
    vi.mocked(getVisitById).mockResolvedValue(null);

    const result = await generateServiceReport(visitId, companyId);

    expect(result).toBeNull();
  });

  it("returns null water health and lsi when visit has no reading", async () => {
    vi.mocked(getVisitById).mockResolvedValue({
      ...mockVisit,
      waterReadings: [],
    });
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany);
    vi.mocked(getVisitHistory).mockResolvedValue([]);
    vi.mocked(getPoolNextScheduledVisit).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(
      new Map([["host", "localhost:3000"]]) as never,
    );

    const result = await generateServiceReport(visitId, companyId);

    expect(result).not.toBeNull();
    expect(result!.waterHealth).toBeNull();
    expect(result!.lsi).toBeNull();
    expect(result!.parameters).toEqual([]);
  });

  it("returns lsi null on a basic health-scoring plan even with readings", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit);
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany);
    vi.mocked(getCompanyPackage).mockResolvedValue(
      mockCompanyPackage("basic") as never,
    );
    vi.mocked(getVisitHistory).mockResolvedValue([]);
    vi.mocked(getPoolNextScheduledVisit).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(
      new Map([["host", "example.com"]]) as never,
    );

    const result = await generateServiceReport(visitId, companyId);

    expect(result).not.toBeNull();
    expect(result!.waterHealth).not.toBeNull();
    expect(result!.lsi).toBeNull();
  });

  it("builds score history from newest to oldest (reversed)", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit);
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany);
    vi.mocked(getVisitHistory).mockResolvedValue([
      {
        createdAt: new Date("2026-07-10"), // newest
        waterReadings: mockReadings,
      },
      {
        createdAt: new Date("2026-07-04"), // oldest
        waterReadings: mockReadings,
      },
    ]);
    vi.mocked(getPoolNextScheduledVisit).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(
      new Map([["host", "example.com"]]) as never,
    );

    const result = await generateServiceReport(visitId, companyId);

    expect(result!.scoreHistory).toHaveLength(2);
    expect(result!.scoreHistory[0].date).toBe("2026-07-04T00:00:00.000Z");
    expect(result!.scoreHistory[1].date).toBe("2026-07-10T00:00:00.000Z");
  });

  it("computes per-parameter status correctly", async () => {
    vi.mocked(getVisitById).mockResolvedValue({
      ...mockVisit,
      waterReadings: [
        {
          ph: 8.2,
          freeChlorine: 0,
          totalAlkalinity: 200,
          calciumHardness: 500,
          cyanuricAcid: 100,
          temperature: 90,
        },
      ],
    });
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany);
    vi.mocked(getVisitHistory).mockResolvedValue([]);
    vi.mocked(getPoolNextScheduledVisit).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue(
      new Map([["host", "example.com"]]) as never,
    );

    const result = await generateServiceReport(visitId, companyId);

    const phParam = result!.parameters.find((p) => p.key === "ph");
    const fcParam = result!.parameters.find((p) => p.key === "freeChlorine");

    expect(phParam?.status).toBe("high");
    expect(fcParam?.status).toBe("low");
  });
});
