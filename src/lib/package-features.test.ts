import { describe, expect, it } from "vitest";

import {
  getHealthScoringLevel,
  type CompanyPackageInfo,
  type PackageFeatures,
} from "./package-features";

const features = (healthScoring: PackageFeatures["health_scoring"]): PackageFeatures => ({
  max_pools: 5,
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
});

function makePackage(
  overrides: Partial<CompanyPackageInfo> = {},
): CompanyPackageInfo {
  return {
    package: {
      id: "pkg-1",
      slug: "basic",
      name: "Basic",
      price: 2900,
      features: features("basic"),
      sortOrder: 0,
    },
    status: "ACTIVE",
    trialStart: null,
    trialEnd: null,
    paidAt: new Date(),
    pendingPackage: null,
    pendingEffectiveAt: null,
    ...overrides,
  };
}

describe("getHealthScoringLevel", () => {
  it("returns basic for a null package", () => {
    expect(getHealthScoringLevel(null)).toBe("basic");
  });

  it("returns basic when the company has no package row (ACTIVE but package null)", () => {
    expect(getHealthScoringLevel(makePackage({ package: null }))).toBe("basic");
  });

  it("returns basic for an expired trial", () => {
    const expired = makePackage({
      status: "TRIAL",
      trialEnd: new Date(Date.now() - 1000),
    });
    expect(getHealthScoringLevel(expired)).toBe("basic");
  });

  it("returns advanced+lsi for an active trial", () => {
    const trial = makePackage({
      status: "TRIAL",
      trialEnd: new Date(Date.now() + 86_400_000),
    });
    expect(getHealthScoringLevel(trial)).toBe("advanced+lsi");
  });

  it("returns basic for a non-ACTIVE status", () => {
    expect(getHealthScoringLevel(makePackage({ status: "EXPIRED" }))).toBe(
      "basic",
    );
    expect(getHealthScoringLevel(makePackage({ status: "CANCELLED" }))).toBe(
      "basic",
    );
  });

  it("returns basic when the plan's health_scoring is basic", () => {
    const pkg = makePackage({
      package: {
        ...makePackage().package!,
        features: features("basic"),
      },
    });
    expect(getHealthScoringLevel(pkg)).toBe("basic");
  });

  it("returns advanced+lsi when the plan's health_scoring is advanced+lsi", () => {
    const pkg = makePackage({
      package: {
        ...makePackage().package!,
        features: features("advanced+lsi"),
      },
    });
    expect(getHealthScoringLevel(pkg)).toBe("advanced+lsi");
  });

  it("falls back to basic when an ACTIVE plan omits health_scoring", () => {
    const { max_pools, chemical_recs, service_reports, qr_code, scheduling, max_techs, priority_support, custom_branding, api_access, csv_import } = features("basic");
    const pkg = makePackage({
      package: {
        ...makePackage().package!,
        features: {
          max_pools,
          chemical_recs,
          service_reports,
          qr_code,
          scheduling,
          max_techs,
          priority_support,
          custom_branding,
          api_access,
          csv_import,
        } as unknown as PackageFeatures,
      },
    });
    expect(getHealthScoringLevel(pkg)).toBe("basic");
  });
});
