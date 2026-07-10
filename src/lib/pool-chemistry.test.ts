import { describe, expect, it } from "vitest";

import {
  calculateLSI,
  getChemicalRecommendations,
  getIdealRange,
  getWaterHealthScore,
  type WaterReadingInput,
} from "@/lib/pool-chemistry";

/** A perfectly balanced set of readings — every parameter mid-range. */
const idealReadings: WaterReadingInput = {
  ph: 7.5,
  freeChlorine: 2,
  totalAlkalinity: 100,
  calciumHardness: 300,
  cyanuricAcid: 40,
  temperature: 80,
};

describe("calculateLSI", () => {
  it("reports a balanced pool near zero", () => {
    const result = calculateLSI(7.5, 80, 300, 100);
    expect(result.status).toBe("BALANCED");
    expect(Math.abs(result.lsi)).toBeLessThanOrEqual(0.3);
  });

  it("reports corrosive water when pH/alkalinity/hardness are low", () => {
    const result = calculateLSI(6.8, 60, 100, 50);
    expect(result.lsi).toBeLessThan(-0.3);
    expect(result.status).toBe("CORROSIVE");
    expect(result.description).toMatch(/corrosive/i);
  });

  it("reports scaling water when pH/alkalinity/hardness are high", () => {
    const result = calculateLSI(8.2, 95, 600, 220);
    expect(result.lsi).toBeGreaterThan(0.3);
    expect(result.status).toBe("SCALING");
    expect(result.description).toMatch(/scale/i);
  });

  it("interpolates the temperature factor between breakpoints", () => {
    // 80°F sits between 76→0.6 and 84→0.7 → 0.65.
    const low = calculateLSI(7.5, 76, 300, 100).lsi;
    const mid = calculateLSI(7.5, 80, 300, 100).lsi;
    const high = calculateLSI(7.5, 84, 300, 100).lsi;
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(high);
    expect(mid - low).toBeCloseTo(0.05, 2);
  });

  it("uses the high-TDS constant for high dissolved solids", () => {
    const normal = calculateLSI(7.5, 80, 300, 100, 500).lsi;
    const highTds = calculateLSI(7.5, 80, 300, 100, 2000).lsi;
    expect(highTds).toBeCloseTo(normal - 0.1, 2);
  });
});

describe("getWaterHealthScore", () => {
  it("scores ideal water 100 / EXCELLENT with no issues", () => {
    const result = getWaterHealthScore(idealReadings);
    expect(result.score).toBe(100);
    expect(result.status).toBe("EXCELLENT");
    expect(result.issues).toEqual([]);
  });

  it("drops the score and flags a single out-of-range parameter", () => {
    const result = getWaterHealthScore({ ...idealReadings, ph: 7.9 });
    expect(result.score).toBeLessThan(100);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("pH is high (7.9)");
    expect(result.issues[0]).toContain("7.4");
  });

  it("returns POOR when several key parameters are far out of range", () => {
    const result = getWaterHealthScore({
      ph: 8.6,
      freeChlorine: 0,
      totalAlkalinity: 20,
      calciumHardness: 50,
      cyanuricAcid: 150,
    });
    expect(result.status).toBe("POOR");
    expect(result.score).toBeLessThan(50);
    expect(result.issues).toHaveLength(5);
  });
});

describe("getChemicalRecommendations", () => {
  it("returns no recommendations for balanced water", () => {
    expect(getChemicalRecommendations(idealReadings, 10_000)).toEqual([]);
  });

  it("recommends Soda Ash for low pH and scales the dose with volume", () => {
    const readings = { ...idealReadings, ph: 7.3 };
    const small = getChemicalRecommendations(readings, 10_000);
    const large = getChemicalRecommendations(readings, 20_000);

    expect(small).toHaveLength(1);
    expect(small[0].chemical).toBe("Soda Ash");
    expect(small[0].unit).toBe("oz");
    expect(small[0].amount).toBeGreaterThan(0);
    // pH 7.3 → midpoint 7.5 is +0.2 → exactly 6 oz per 10k gal.
    expect(small[0].amount).toBeCloseTo(6, 2);
    expect(large[0].amount).toBeCloseTo(12, 2);
  });

  it("recommends Muriatic Acid for high pH", () => {
    const [rec] = getChemicalRecommendations(
      { ...idealReadings, ph: 7.7 },
      10_000,
    );
    expect(rec.chemical).toBe("Muriatic Acid");
    expect(rec.unit).toBe("fl oz");
    expect(rec.amount).toBeCloseTo(12, 2);
  });

  it("recommends a partial drain for high cyanuric acid", () => {
    const [rec] = getChemicalRecommendations(
      { ...idealReadings, cyanuricAcid: 90 },
      10_000,
    );
    expect(rec.chemical).toBe("N/A");
    expect(rec.amount).toBe(0);
    expect(rec.unit).toBe("");
    expect(rec.reason).toBe("Partially drain and refill pool water");
  });

  it("recommends bicarbonate, calcium chloride, chlorine and CYA for low readings", () => {
    const recs = getChemicalRecommendations(
      {
        ph: 7.5,
        freeChlorine: 0,
        totalAlkalinity: 60,
        calciumHardness: 100,
        cyanuricAcid: 10,
      },
      10_000,
    );
    const byChemical = Object.fromEntries(recs.map((r) => [r.chemical, r]));
    expect(byChemical["Sodium Bicarbonate"]).toBeDefined();
    expect(byChemical["Calcium Chloride"]).toBeDefined();
    expect(byChemical["Liquid Chlorine"]).toBeDefined();
    expect(byChemical["Cyanuric Acid"]).toBeDefined();
    expect(byChemical["Cyanuric Acid"].unit).toBe("lbs");
  });
});

describe("getIdealRange", () => {
  it("returns bounds for canonical keys", () => {
    expect(getIdealRange("ph")).toEqual({ min: 7.4, max: 7.6, unit: "" });
    expect(getIdealRange("freeChlorine")).toEqual({
      min: 1,
      max: 3,
      unit: "ppm",
    });
  });

  it("accepts aliases and alternate casing", () => {
    expect(getIdealRange("pH")).toEqual(getIdealRange("ph"));
    expect(getIdealRange("chlorine")).toEqual(getIdealRange("freeChlorine"));
    expect(getIdealRange("CYA")).toEqual(getIdealRange("cyanuricAcid"));
  });

  it("throws for an unknown parameter", () => {
    expect(() => getIdealRange("salinity")).toThrow(/unknown/i);
  });
});
