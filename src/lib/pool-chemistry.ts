/**
 * Pool chemistry engine.
 *
 * Pure, dependency-free calculations that turn raw water-test readings into
 * actionable output:
 *  - {@link calculateLSI}                — Langelier Saturation Index (water balance)
 *  - {@link getWaterHealthScore}         — a 0–100 health score with issues
 *  - {@link getChemicalRecommendations}  — specific chemical doses to correct water
 *  - {@link getIdealRange}               — the target range for a single parameter
 *
 * Every function here is a pure function of its inputs: no I/O, no imports, no
 * shared mutable state. This keeps the engine trivially testable and reusable
 * from server components, route handlers, or client code alike.
 *
 * Input field names intentionally mirror the Prisma `WaterReading` model
 * (`ph`, `freeChlorine`, `totalAlkalinity`, `calciumHardness`, `cyanuricAcid`,
 * `temperature`) so a persisted reading can be passed in directly — but this
 * module has no dependency on Prisma or any generated type.
 *
 * All concentrations are in ppm (mg/L), temperature in °F, and pool volume in
 * US gallons. Dosing outputs use the imperial units common on US chemical
 * labels (oz, fl oz, lbs, gallons).
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A single set of water-chemistry readings.
 *
 * `temperature` is optional because it is only required by {@link calculateLSI};
 * scoring and dosing do not need it.
 */
export interface WaterReadingInput {
  /** Acidity/basicity on the pH scale (unitless). */
  ph: number;
  /** Free available chlorine, ppm. */
  freeChlorine: number;
  /** Total alkalinity, ppm as CaCO₃. */
  totalAlkalinity: number;
  /** Calcium hardness, ppm as CaCO₃. */
  calciumHardness: number;
  /** Cyanuric acid (stabilizer), ppm. */
  cyanuricAcid: number;
  /** Water temperature, °F. Required for LSI, optional otherwise. */
  temperature?: number;
}

/** Water-balance verdict from the Langelier Saturation Index. */
export type LSIStatus = "BALANCED" | "CORROSIVE" | "SCALING";

/** Overall water-quality band from the health score. */
export type WaterHealthStatus = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

/** Result of a Langelier Saturation Index calculation. */
export interface LSIResult {
  /** The computed index, rounded to two decimals. Near 0 is balanced. */
  lsi: number;
  /** Categorical verdict derived from {@link lsi}. */
  status: LSIStatus;
  /** Human-readable explanation of the verdict. */
  description: string;
}

/** Result of a weighted water-health assessment. */
export interface WaterHealthResult {
  /** Overall score, 0–100 (higher is better). */
  score: number;
  /** Categorical band derived from {@link score}. */
  status: WaterHealthStatus;
  /** One message per out-of-range parameter (empty when all are ideal). */
  issues: string[];
}

/** A single recommended chemical addition. */
export interface ChemicalRecommendation {
  /** Product/chemical name, or `"N/A"` when no dosing applies. */
  chemical: string;
  /** Amount to add in {@link unit}. `0` when no dosing applies. */
  amount: number;
  /** Unit for {@link amount} (e.g. `"oz"`, `"fl oz"`, `"lbs"`, `"gal"`). */
  unit: string;
  /** Why this addition is recommended. */
  reason: string;
}

/** The ideal (target) range for a single parameter. */
export interface IdealRange {
  /** Lower bound of the ideal range. */
  min: number;
  /** Upper bound of the ideal range. */
  max: number;
  /** Unit the bounds are expressed in. */
  unit: string;
}

/* -------------------------------------------------------------------------- */
/* Ideal ranges                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Canonical ideal ranges for each measured parameter, keyed by the
 * {@link WaterReadingInput} field name. Consumed by {@link getWaterHealthScore},
 * {@link getChemicalRecommendations}, and {@link getIdealRange}.
 */
const IDEAL_RANGES = {
  ph: { min: 7.4, max: 7.6, unit: "" },
  freeChlorine: { min: 1, max: 3, unit: "ppm" },
  totalAlkalinity: { min: 80, max: 120, unit: "ppm" },
  calciumHardness: { min: 200, max: 400, unit: "ppm" },
  cyanuricAcid: { min: 30, max: 50, unit: "ppm" },
} as const satisfies Record<string, IdealRange>;

/** A canonical parameter key. */
type ParameterKey = keyof typeof IDEAL_RANGES;

/**
 * Maps common aliases/casings for a parameter onto its canonical key so callers
 * can pass `"pH"`, `"chlorine"`, `"cya"`, etc.
 */
const PARAMETER_ALIASES: Record<string, ParameterKey> = {
  ph: "ph",
  freechlorine: "freeChlorine",
  chlorine: "freeChlorine",
  fc: "freeChlorine",
  totalalkalinity: "totalAlkalinity",
  alkalinity: "totalAlkalinity",
  ta: "totalAlkalinity",
  calciumhardness: "calciumHardness",
  hardness: "calciumHardness",
  ch: "calciumHardness",
  cyanuricacid: "cyanuricAcid",
  cya: "cyanuricAcid",
  stabilizer: "cyanuricAcid",
};

/** Human-friendly label for each parameter, used in messages. */
const PARAMETER_LABELS: Record<ParameterKey, string> = {
  ph: "pH",
  freeChlorine: "Free chlorine",
  totalAlkalinity: "Total alkalinity",
  calciumHardness: "Calcium hardness",
  cyanuricAcid: "Cyanuric acid",
};

/** Relative importance of each parameter in the health score (sums to 100). */
const PARAMETER_WEIGHTS: Record<ParameterKey, number> = {
  ph: 30,
  freeChlorine: 30,
  totalAlkalinity: 15,
  calciumHardness: 12,
  cyanuricAcid: 13,
};

/**
 * Resolves a parameter name (any supported alias/casing) to its canonical key.
 *
 * @param parameter - Parameter name, e.g. `"pH"`, `"ph"`, `"chlorine"`.
 * @returns The canonical key.
 * @throws {Error} If the name is not a recognised parameter.
 */
function resolveParameterKey(parameter: string): ParameterKey {
  const normalized = parameter.toLowerCase().replace(/[\s_-]/g, "");
  const key = PARAMETER_ALIASES[normalized];
  if (!key) {
    throw new Error(`Unknown water parameter: "${parameter}"`);
  }
  return key;
}

/**
 * Returns the ideal (target) range for a water parameter.
 *
 * @param parameter - Parameter name; accepts canonical keys and common aliases
 *   (e.g. `"ph"`, `"pH"`, `"freeChlorine"`, `"chlorine"`, `"ta"`).
 * @returns The `{ min, max, unit }` ideal range.
 * @throws {Error} If the parameter is not recognised.
 *
 * @example
 * getIdealRange("pH");           // { min: 7.4, max: 7.6, unit: "" }
 * getIdealRange("chlorine");     // { min: 1, max: 3, unit: "ppm" }
 */
export function getIdealRange(parameter: string): IdealRange {
  const range = IDEAL_RANGES[resolveParameterKey(parameter)];
  return { min: range.min, max: range.max, unit: range.unit };
}

/* -------------------------------------------------------------------------- */
/* Langelier Saturation Index                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Temperature factor (TF) breakpoints for the LSI, keyed by °F. Standard
 * published values; intermediate temperatures are linearly interpolated by
 * {@link lookupFactor}.
 */
const TEMPERATURE_FACTORS: ReadonlyArray<readonly [number, number]> = [
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

/**
 * Calcium hardness factor (CF) breakpoints for the LSI, keyed by ppm as CaCO₃.
 * Provided as a documented cross-check for the closed-form
 * `log10(calciumHardness) - 0.4` used at runtime.
 */
const CALCIUM_FACTORS: ReadonlyArray<readonly [number, number]> = [
  [25, 1.0],
  [50, 1.3],
  [75, 1.5],
  [100, 1.6],
  [150, 1.8],
  [200, 1.9],
  [300, 2.1],
  [400, 2.2],
  [800, 2.5],
];

/**
 * Total alkalinity factor (AF) breakpoints for the LSI, keyed by ppm as CaCO₃.
 * Documented cross-check for the closed-form `log10(totalAlkalinity)` used at
 * runtime.
 */
const ALKALINITY_FACTORS: ReadonlyArray<readonly [number, number]> = [
  [25, 1.4],
  [50, 1.7],
  [75, 1.9],
  [100, 2.0],
  [150, 2.2],
  [200, 2.3],
  [300, 2.5],
  [400, 2.6],
  [800, 2.9],
];

/**
 * Total dissolved solids factor (TDSF) constant for the LSI. `12.1` corresponds
 * to typical pool TDS (< ~1000 ppm); `12.2` is used for higher-TDS water.
 */
const TDS_FACTOR_LOW = 12.1;
const TDS_FACTOR_HIGH = 12.2;

/**
 * Looks up a factor for `value` in an ascending breakpoint table, linearly
 * interpolating between neighbours and clamping at the table's ends.
 *
 * @param table - Ascending `[input, factor]` breakpoints.
 * @param value - The input to look up.
 * @returns The interpolated (or clamped) factor.
 */
function lookupFactor(
  table: ReadonlyArray<readonly [number, number]>,
  value: number,
): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (value <= first[0]) {
    return first[1];
  }
  if (value >= last[0]) {
    return last[1];
  }
  for (let i = 0; i < table.length - 1; i++) {
    const [lowInput, lowFactor] = table[i];
    const [highInput, highFactor] = table[i + 1];
    if (value >= lowInput && value <= highInput) {
      const ratio = (value - lowInput) / (highInput - lowInput);
      return lowFactor + ratio * (highFactor - lowFactor);
    }
  }
  // Unreachable given the clamps above, but keeps the function total.
  return last[1];
}

/**
 * Calculates the Langelier Saturation Index (LSI), the standard measure of
 * whether pool water is balanced, corrosive, or scale-forming.
 *
 * Formula: `LSI = pH + TF + CF + AF − TDSF`, where
 *  - `TF` is the temperature factor (interpolated from {@link TEMPERATURE_FACTORS}),
 *  - `CF` is the calcium hardness factor, `log10(calciumHardness) − 0.4`,
 *  - `AF` is the total alkalinity factor, `log10(totalAlkalinity)`,
 *  - `TDSF` is the total-dissolved-solids constant ({@link TDS_FACTOR_LOW} for
 *    typical pools, {@link TDS_FACTOR_HIGH} for high-TDS water).
 *
 * Interpretation: `LSI ≈ 0` is balanced; below −0.3 the water is corrosive
 * (dissolves plaster/metal); above +0.3 it is scaling (deposits calcium).
 *
 * @param ph - Water pH.
 * @param temperature - Water temperature, °F.
 * @param calciumHardness - Calcium hardness, ppm as CaCO₃ (must be > 0).
 * @param totalAlkalinity - Total alkalinity, ppm as CaCO₃ (must be > 0).
 * @param tds - Total dissolved solids, ppm. When `> 1000`, the high-TDS
 *   constant is used. Defaults to `0` (typical pool constant).
 * @returns The index, its categorical status, and a description.
 *
 * @example
 * calculateLSI(7.5, 80, 300, 100); // ~0.13 → BALANCED
 */
export function calculateLSI(
  ph: number,
  temperature: number,
  calciumHardness: number,
  totalAlkalinity: number,
  tds = 0,
): LSIResult {
  const temperatureFactor = lookupFactor(TEMPERATURE_FACTORS, temperature);
  const calciumFactor = Math.log10(calciumHardness) - 0.4;
  const alkalinityFactor = Math.log10(totalAlkalinity);
  const tdsFactor = tds > 1000 ? TDS_FACTOR_HIGH : TDS_FACTOR_LOW;

  const raw =
    ph + temperatureFactor + calciumFactor + alkalinityFactor - tdsFactor;
  const lsi = Math.round(raw * 100) / 100;

  let status: LSIStatus;
  let description: string;
  if (lsi < -0.3) {
    status = "CORROSIVE";
    description =
      "Water is corrosive and can etch plaster and damage metal fixtures. " +
      "Raise pH, alkalinity, or calcium hardness to bring the index toward 0.";
  } else if (lsi > 0.3) {
    status = "SCALING";
    description =
      "Water is scale-forming and can deposit calcium on surfaces and " +
      "equipment. Lower pH or alkalinity to bring the index toward 0.";
  } else {
    status = "BALANCED";
    description =
      "Water is well balanced — neither corrosive nor scale-forming.";
  }

  return { lsi, status, description };
}

/* -------------------------------------------------------------------------- */
/* Water health score                                                         */
/* -------------------------------------------------------------------------- */

/**
 * How much a reading may stray beyond its ideal range before it scores zero,
 * expressed as a multiple of the range width. Within the range → full credit;
 * up to this multiple past an edge → linear falloff; beyond → zero.
 */
const HEALTH_FALLOFF_MULTIPLE = 1;

/**
 * Scores a single reading from 1 (inside the ideal range) down to 0 (far
 * outside), with a linear falloff in between.
 */
function scoreParameter(value: number, range: IdealRange): number {
  if (value >= range.min && value <= range.max) {
    return 1;
  }
  const width = range.max - range.min;
  const tolerance = width * HEALTH_FALLOFF_MULTIPLE || 1;
  const distance = value < range.min ? range.min - value : value - range.max;
  return Math.max(0, 1 - distance / tolerance);
}

/**
 * Computes a weighted 0–100 water-health score and lists every out-of-range
 * parameter.
 *
 * Each parameter contributes up to its weight (pH and free chlorine matter most
 * — see {@link PARAMETER_WEIGHTS}). A reading inside its ideal range earns full
 * weight; readings just outside earn partial credit via a linear falloff; far
 * out-of-range readings earn nothing.
 *
 * @param readings - The water readings (`temperature` is ignored here).
 * @returns The score, a categorical status, and one issue message per
 *   out-of-range parameter.
 *
 * @example
 * getWaterHealthScore({ ph: 7.5, freeChlorine: 2, totalAlkalinity: 100,
 *   calciumHardness: 300, cyanuricAcid: 40 });
 * // { score: 100, status: "EXCELLENT", issues: [] }
 */
export function getWaterHealthScore(
  readings: WaterReadingInput,
): WaterHealthResult {
  const keys = Object.keys(IDEAL_RANGES) as ParameterKey[];
  const issues: string[] = [];
  let earned = 0;

  for (const key of keys) {
    const value = readings[key];
    const range = IDEAL_RANGES[key];
    earned += scoreParameter(value, range) * PARAMETER_WEIGHTS[key];

    if (value < range.min || value > range.max) {
      const direction = value < range.min ? "low" : "high";
      const unit = range.unit ? ` ${range.unit}` : "";
      issues.push(
        `${PARAMETER_LABELS[key]} is ${direction} (${value}${unit}); ` +
          `ideal ${range.min}–${range.max}${unit}`,
      );
    }
  }

  const score = Math.round(earned);

  let status: WaterHealthStatus;
  if (score >= 90) {
    status = "EXCELLENT";
  } else if (score >= 75) {
    status = "GOOD";
  } else if (score >= 50) {
    status = "FAIR";
  } else {
    status = "POOR";
  }

  return { score, status, issues };
}

/* -------------------------------------------------------------------------- */
/* Chemical recommendations                                                   */
/* -------------------------------------------------------------------------- */

/** Rounds a dose to two decimals for display. */
function roundDose(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Computes chemical additions needed to bring out-of-range readings back to the
 * middle of their ideal range.
 *
 * Doses use standard label rates, scaled linearly by pool volume
 * (`poolVolumeGallons / 10_000`) and by the gap between the reading and its
 * ideal midpoint:
 *  - pH low  → Soda Ash (6 oz / 10k gal per +0.2 pH)
 *  - pH high → Muriatic Acid (12 fl oz / 10k gal per −0.2 pH)
 *  - TA low  → Sodium Bicarbonate (1.5 lbs / 10k gal per +10 ppm)
 *  - CH low  → Calcium Chloride (1.25 lbs / 10k gal per +10 ppm)
 *  - FC low  → Liquid Chlorine (1 gal / 10k gal per +10 ppm)
 *  - CYA low → Cyanuric Acid (4 lbs / 10k gal per +30 ppm)
 *  - CYA high → no dosing; recommends partial drain & refill
 *
 * Only out-of-range parameters produce a recommendation, so balanced water
 * yields an empty array. Note there is no chemical dose for high pH-adjacent
 * parameters other than pH itself; TA/CH/FC/CYA that read *high* (except CYA)
 * are surfaced by {@link getWaterHealthScore} rather than dosed here.
 *
 * @param readings - The water readings (`temperature` is ignored here).
 * @param poolVolumeGallons - Pool volume in US gallons.
 * @returns One recommendation per actionable out-of-range parameter.
 */
export function getChemicalRecommendations(
  readings: WaterReadingInput,
  poolVolumeGallons: number,
): ChemicalRecommendation[] {
  const recommendations: ChemicalRecommendation[] = [];
  const volumeFactor = poolVolumeGallons / 10_000;
  const mid = (key: ParameterKey): number =>
    (IDEAL_RANGES[key].min + IDEAL_RANGES[key].max) / 2;

  // pH
  if (readings.ph < IDEAL_RANGES.ph.min) {
    const delta = mid("ph") - readings.ph;
    recommendations.push({
      chemical: "Soda Ash",
      amount: roundDose((delta / 0.2) * 6 * volumeFactor),
      unit: "oz",
      reason: `Raise pH from ${readings.ph} toward ${mid("ph")} (6 oz per 10k gal raises pH ~0.2).`,
    });
  } else if (readings.ph > IDEAL_RANGES.ph.max) {
    const delta = readings.ph - mid("ph");
    recommendations.push({
      chemical: "Muriatic Acid",
      amount: roundDose((delta / 0.2) * 12 * volumeFactor),
      unit: "fl oz",
      reason: `Lower pH from ${readings.ph} toward ${mid("ph")} (12 fl oz per 10k gal lowers pH ~0.2).`,
    });
  }

  // Total alkalinity (low)
  if (readings.totalAlkalinity < IDEAL_RANGES.totalAlkalinity.min) {
    const delta = mid("totalAlkalinity") - readings.totalAlkalinity;
    recommendations.push({
      chemical: "Sodium Bicarbonate",
      amount: roundDose((delta / 10) * 1.5 * volumeFactor),
      unit: "lbs",
      reason: `Raise total alkalinity from ${readings.totalAlkalinity} toward ${mid("totalAlkalinity")} ppm (1.5 lbs per 10k gal raises TA ~10 ppm).`,
    });
  }

  // Calcium hardness (low)
  if (readings.calciumHardness < IDEAL_RANGES.calciumHardness.min) {
    const delta = mid("calciumHardness") - readings.calciumHardness;
    recommendations.push({
      chemical: "Calcium Chloride",
      amount: roundDose((delta / 10) * 1.25 * volumeFactor),
      unit: "lbs",
      reason: `Raise calcium hardness from ${readings.calciumHardness} toward ${mid("calciumHardness")} ppm (1.25 lbs per 10k gal raises CH ~10 ppm).`,
    });
  }

  // Free chlorine (low)
  if (readings.freeChlorine < IDEAL_RANGES.freeChlorine.min) {
    const delta = mid("freeChlorine") - readings.freeChlorine;
    recommendations.push({
      chemical: "Liquid Chlorine",
      amount: roundDose((delta / 10) * 1 * volumeFactor),
      unit: "gal",
      reason: `Raise free chlorine from ${readings.freeChlorine} toward ${mid("freeChlorine")} ppm (1 gal per 10k gal raises FC ~10 ppm).`,
    });
  }

  // Cyanuric acid (low or high)
  if (readings.cyanuricAcid < IDEAL_RANGES.cyanuricAcid.min) {
    const delta = mid("cyanuricAcid") - readings.cyanuricAcid;
    recommendations.push({
      chemical: "Cyanuric Acid",
      amount: roundDose((delta / 30) * 4 * volumeFactor),
      unit: "lbs",
      reason: `Raise cyanuric acid from ${readings.cyanuricAcid} toward ${mid("cyanuricAcid")} ppm (4 lbs per 10k gal raises CYA ~30 ppm).`,
    });
  } else if (readings.cyanuricAcid > IDEAL_RANGES.cyanuricAcid.max) {
    recommendations.push({
      chemical: "N/A",
      amount: 0,
      unit: "",
      reason: "Partially drain and refill pool water",
    });
  }

  return recommendations;
}
