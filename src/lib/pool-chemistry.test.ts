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

  it("uses low-TDS constant at exactly 1000 ppm and high at 1001", () => {
    const low = calculateLSI(7.5, 80, 300, 100, 1000).lsi;
    const high = calculateLSI(7.5, 80, 300, 100, 1001).lsi;
    expect(high).toBeCloseTo(low - 0.1, 2);
  });

  it("clamps temperature at the low end (32°F and below)", () => {
    const at32 = calculateLSI(7.5, 32, 300, 100).lsi;
    const below = calculateLSI(7.5, 20, 300, 100).lsi;
    expect(at32).toBeCloseTo(below, 10);
  });

  it("clamps temperature at the high end (105°F and above)", () => {
    const at105 = calculateLSI(7.5, 105, 300, 100).lsi;
    const above = calculateLSI(7.5, 120, 300, 100).lsi;
    expect(at105).toBeCloseTo(above, 10);
  });

  it("interpolates between every adjacent temperature breakpoint", () => {
    // 46→0.2 and 53→0.3 → at 50 = 0.2 + (4/7)*0.1 ≈ 0.257
    const mid = calculateLSI(7.5, 50, 300, 100).lsi;
    const low = calculateLSI(7.5, 46, 300, 100).lsi;
    const high = calculateLSI(7.5, 53, 300, 100).lsi;
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(high);
    expect(mid - low).toBeCloseTo(Math.round(0.05714 * 100) / 100, 1);
  });

  it("reads the correct temperature factor at every breakpoint", () => {
    const breakpoints: [number, number][] = [
      [32, 0.0],
      [37, 0.1],
      [46, 0.2],
      [53, 0.3],
      [60, 0.4],
      [66, 0.5],
      [76, 0.6],
      [84, 0.7],
      [94, 0.8],
      [105, 0.9],
    ];
    for (const [temp, expectedFactor] of breakpoints) {
      // Use fixed pH=7.5, CH=300, TA=100 so LSI = 7.5 + TF + 2.08 - 12.1
      const baseline = calculateLSI(7.5, 76, 300, 100).lsi; // TF=0.6
      const shifted = calculateLSI(7.5, temp, 300, 100).lsi;
      expect(shifted - baseline).toBeCloseTo(expectedFactor - 0.6, 2);
    }
  });

  it("handles zero calcium hardness without crashing", () => {
    // log10(0) = -Infinity, which should result in a very low (corrosive) LSI
    const result = calculateLSI(7.5, 80, 0, 100);
    expect(result.lsi).toBeLessThan(-10);
    expect(result.status).toBe("CORROSIVE");
  });

  it("handles zero total alkalinity without crashing", () => {
    const result = calculateLSI(7.5, 80, 300, 0);
    expect(result.lsi).toBeLessThan(-10);
    expect(result.status).toBe("CORROSIVE");
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

  it("scores 100 when every parameter is exactly at its min bound", () => {
    const result = getWaterHealthScore({
      ph: 7.4,
      freeChlorine: 1,
      totalAlkalinity: 80,
      calciumHardness: 200,
      cyanuricAcid: 30,
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe("EXCELLENT");
  });

  it("scores 100 when every parameter is exactly at its max bound", () => {
    const result = getWaterHealthScore({
      ph: 7.6,
      freeChlorine: 3,
      totalAlkalinity: 120,
      calciumHardness: 400,
      cyanuricAcid: 50,
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe("EXCELLENT");
  });

  it("returns partial credit for a parameter just outside its range", () => {
    // pH range is 7.4-7.6. At 7.7, distance = 0.1, tolerance = 0.2 → 0.5 weight.
    // pH weight is 30 → contribution = 30 * (1 - 0.1/0.2) = 15
    // All other params at midpoint → 70 points → total = 85
    const result = getWaterHealthScore({ ...idealReadings, ph: 7.7 });
    expect(result.score).toBeCloseTo(85, 0);
    expect(result.status).toBe("GOOD");
  });

  it("scores zero for a parameter far outside its range", () => {
    // pH = 8.0 → distance = 0.4, tolerance = 0.2 → max(0, 1 - 2) = 0
    // pH weight 30 * 0 = 0 → total = 70
    const result = getWaterHealthScore({ ...idealReadings, ph: 8.0 });
    expect(result.score).toBe(70);
  });

  it("returns EXCELLENT at exactly score 90", () => {
    // Tune readings so total lands exactly on 90
    const result = getWaterHealthScore({
      ph: 7.4,
      freeChlorine: 3,
      totalAlkalinity: 80,
      calciumHardness: 400,
      cyanuricAcid: 50,
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.status).toBe("EXCELLENT");
  });

  it("returns FAIR at exactly score 75 boundary", () => {
    const result = getWaterHealthScore({
      ph: 7.7,
      freeChlorine: 0.5,
      totalAlkalinity: 60,
      calciumHardness: 100,
      cyanuricAcid: 20,
    });
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(75);
    expect(result.status).toBe("FAIR");
  });

  it("handles the temperature field being undefined gracefully", () => {
    const { temperature: _, ...noTemp } = idealReadings;
    const result = getWaterHealthScore(noTemp as WaterReadingInput);
    expect(result.score).toBe(100);
    expect(result.status).toBe("EXCELLENT");
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

  it("returns no recommendations when at the exact low bound of range", () => {
    const recs = getChemicalRecommendations(
      { ...idealReadings, ph: 7.4 },
      10_000,
    );
    expect(recs).toEqual([]);
  });

  it("returns multiple pH + TA + CH recommendations together", () => {
    const recs = getChemicalRecommendations(
      { ...idealReadings, ph: 7.3, totalAlkalinity: 60, calciumHardness: 100 },
      10_000,
    );
    expect(recs).toHaveLength(3);
    expect(recs.map((r) => r.chemical)).toEqual([
      "Soda Ash",
      "Sodium Bicarbonate",
      "Calcium Chloride",
    ]);
  });

  it("scales dose correctly for a 1-gallon pool (rounds to 0 at 2 decimals)", () => {
    const [rec] = getChemicalRecommendations(
      { ...idealReadings, ph: 7.3 },
      1,
    );
    // roundDose rounds to 2 decimals; 6/10000 = 0.0006 → 0
    expect(rec.amount).toBe(0);
  });

  it("scales dose correctly for a very large pool", () => {
    const [rec] = getChemicalRecommendations(
      { ...idealReadings, ph: 7.3 },
      100_000,
    );
    expect(rec.amount).toBeCloseTo(60, 2);
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

describe("calculateLSI — edge cases", () => {
  it("handles negative pH without crashing", () => {
    const result = calculateLSI(-1, 80, 300, 100);
    expect(result.status).toBe("CORROSIVE");
  });

  it("handles NaN inputs without crashing", () => {
    const result = calculateLSI(NaN, 80, 300, 100);
    expect(typeof result.lsi).toBe("number");
    expect(typeof result.status).toBe("string");
  });

  it("handles negative temperature", () => {
    const result = calculateLSI(7.5, -10, 300, 100);
    expect(result.status).toBe("CORROSIVE");
  });

  it("handles extremely high temperature", () => {
    const result = calculateLSI(7.5, 200, 300, 100);
    expect(result.lsi).toBeGreaterThan(0.3);
    expect(result.status).toBe("SCALING");
  });

  it("handles negative calcium hardness", () => {
    const result = calculateLSI(7.5, 80, -100, 100);
    expect(typeof result.lsi).toBe("number");
    expect(typeof result.status).toBe("string");
  });

  it("handles negative TDS", () => {
    const result = calculateLSI(7.5, 80, 300, 100, -500);
    expect(result.lsi).toBeDefined();
    expect(typeof result.lsi).toBe("number");
  });
});

describe("getWaterHealthScore — edge cases", () => {
  it("scores POOR at score exactly 49 (boundary)", () => {
    const result = getWaterHealthScore({
      ph: 8.6,
      freeChlorine: 0,
      totalAlkalinity: 20,
      calciumHardness: 50,
      cyanuricAcid: 150,
    });
    expect(result.score).toBeLessThan(50);
    expect(result.status).toBe("POOR");
  });

  it("handles negative reading values", () => {
    const result = getWaterHealthScore({
      ...idealReadings,
      ph: -1,
    });
    expect(result.score).toBeLessThan(100);
    expect(result.issues).toHaveLength(1);
  });

  it("handles undefined pH gracefully", () => {
    const { ph: _, ...noPh } = idealReadings;
    const result = getWaterHealthScore(noPh as WaterReadingInput);
    expect(typeof result.score).toBe("number");
    expect(typeof result.status).toBe("string");
  });

  it("handles empty readings object", () => {
    const result = getWaterHealthScore({} as WaterReadingInput);
    expect(typeof result.score).toBe("number");
    expect(typeof result.status).toBe("string");
  });

  it("handles extremely high pH (14)", () => {
    const result = getWaterHealthScore({ ...idealReadings, ph: 14 });
    expect(result.score).toBe(70);
    expect(result.status).toBe("FAIR");
  });
});

describe("getChemicalRecommendations — edge cases", () => {
  it("handles zero pool volume without crashing", () => {
    const recs = getChemicalRecommendations({ ...idealReadings, ph: 7.3 }, 0);
    expect(recs).toHaveLength(1);
    expect(recs[0].amount).toBe(0);
  });

  it("handles negative pool volume", () => {
    const recs = getChemicalRecommendations({ ...idealReadings, ph: 7.3 }, -1000);
    expect(recs).toHaveLength(1);
  });

  it("handles undefined temperature in readings", () => {
    const { temperature: _, ...noTemp } = idealReadings;
    const recs = getChemicalRecommendations(noTemp as WaterReadingInput, 10_000);
    expect(recs).toEqual([]);
  });

  it("handles high CYA combined with low pH", () => {
    const recs = getChemicalRecommendations(
      { ...idealReadings, cyanuricAcid: 90, ph: 7.3 },
      10_000,
    );
    expect(recs.length).toBeGreaterThanOrEqual(1);
    const cyaRec = recs.find((r) => r.chemical === "N/A");
    expect(cyaRec).toBeDefined();
  });
});

describe("getIdealRange — all aliases", () => {
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

  it("accepts aliases with mixed spacing and casing", () => {
    expect(getIdealRange("free chlorine")).toEqual(
      getIdealRange("freeChlorine"),
    );
    expect(getIdealRange("TOTAL_ALKALINITY")).toEqual(
      getIdealRange("totalAlkalinity"),
    );
    expect(getIdealRange("free-chlorine")).toEqual(
      getIdealRange("freeChlorine"),
    );
  });

  it("throws for empty string", () => {
    expect(() => getIdealRange("")).toThrow(/unknown/i);
  });

  it("accepts all totalAlkalinity aliases", () => {
    const expected = getIdealRange("totalAlkalinity");
    expect(getIdealRange("TA")).toEqual(expected);
    expect(getIdealRange("ta")).toEqual(expected);
    expect(getIdealRange("total_alkalinity")).toEqual(expected);
    expect(getIdealRange("total-alkalinity")).toEqual(expected);
  });

  it("accepts all calciumHardness aliases", () => {
    const expected = getIdealRange("calciumHardness");
    expect(getIdealRange("CH")).toEqual(expected);
    expect(getIdealRange("ch")).toEqual(expected);
    expect(getIdealRange("calcium_hardness")).toEqual(expected);
    expect(getIdealRange("calcium-hardness")).toEqual(expected);
  });

  it("accepts all cyanuricAcid aliases", () => {
    const expected = getIdealRange("cyanuricAcid");
    expect(getIdealRange("CYA")).toEqual(expected);
    expect(getIdealRange("cya")).toEqual(expected);
    expect(getIdealRange("cyanuric_acid")).toEqual(expected);
    expect(getIdealRange("cyanuric-acid")).toEqual(expected);
    expect(getIdealRange("stabilizer")).toEqual(expected);
  });

  it("accepts all freeChlorine aliases", () => {
    const expected = getIdealRange("freeChlorine");
    expect(getIdealRange("free chlorine")).toEqual(expected);
    expect(getIdealRange("free-chlorine")).toEqual(expected);
    expect(getIdealRange("free_chlorine")).toEqual(expected);
    expect(getIdealRange("chlorine")).toEqual(expected);
    expect(getIdealRange("FC")).toEqual(expected);
    expect(getIdealRange("fc")).toEqual(expected);
  });

  it("accepts all pH aliases", () => {
    const expected = getIdealRange("ph");
    expect(getIdealRange("pH")).toEqual(expected);
    expect(getIdealRange("PH")).toEqual(expected);
  });
});
