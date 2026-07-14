---
name: chemistry-engine
description: PoolBench's pure pool-chemistry domain logic. Read BEFORE editing src/lib/pool-chemistry.ts or any reading/dosing code. This module has no I/O, no Prisma imports — keep it pure. Triggers on: editing src/lib/pool-chemistry.ts, src/lib/pool-chemistry.test.ts, or any file importing from pool-chemistry.
---

# Chemistry Engine

## Contract

`src/lib/pool-chemistry.ts` is a **pure, dependency-free module** with no I/O, no Prisma imports, no shared mutable state. Every function is a pure function of its inputs. This is the **only unit-tested domain file** — keep it that way; never add I/O here.

All concentrations are in **ppm (mg/L)**, temperature in **°F**, pool volume in **US gallons**. Dosing outputs use imperial units common on US chemical labels (oz, fl oz, lbs, gallons).

## Types

| Type | Fields |
|---|---|
| `WaterReadingInput` | `ph`, `freeChlorine`, `totalAlkalinity`, `calciumHardness`, `cyanuricAcid`, `temperature?` — mirrors Prisma `WaterReading` field names |
| `LSIStatus` | `"BALANCED" \| "CORROSIVE" \| "SCALING"` |
| `WaterHealthStatus` | `"EXCELLENT" \| "GOOD" \| "FAIR" \| "POOR"` |
| `LSIResult` | `{ lsi, status, description }` |
| `WaterHealthResult` | `{ score (0–100), status, issues[] }` |
| `ChemicalRecommendation` | `{ chemical, amount, unit, reason }` |
| `IdealRange` | `{ min, max, unit }` |

## Exported functions

| Function | Input | Output |
|---|---|---|
| `calculateLSI(readings)` | `WaterReadingInput` (temperature required) | `LSIResult` |
| `getWaterHealthScore(readings)` | `WaterReadingInput` | `WaterHealthResult` |
| `getChemicalRecommendations(readings, poolVolumeGal)` | `WaterReadingInput` + pool volume | `ChemicalRecommendation[]` |
| `getIdealRange(parameter)` | parameter name or alias | `IdealRange` |

## Ideal ranges (source of truth, hardcoded in module)

| Parameter | Min | Max | Unit |
|---|---|---|---|
| pH | 7.4 | 7.6 | — |
| Free Chlorine | 1 | 3 | ppm |
| Total Alkalinity | 80 | 120 | ppm |
| Calcium Hardness | 200 | 400 | ppm |
| Cyanuric Acid | 30 | 50 | ppm |

## Score bands

| Score | Status | Color |
|---|---|---|
| ≥ 90 | EXCELLENT | emerald |
| ≥ 75 | GOOD | lime |
| ≥ 50 | FAIR | amber |
| < 50 | POOR | red |

## Rules

- **No Prisma imports.** Not now, not ever. `WaterReadingInput` field names intentionally mirror the Prisma `WaterReading` model for pass-through compatibility — but this module has zero dependency on Prisma or any generated type.
- **No file I/O, no network, no `crypto`.** Pure math only.
- **Trivially testable.** See `src/lib/pool-chemistry.test.ts` (36 tests).
- `VisitReadings` (in `src/lib/db/visits.ts`) extends `WaterReadingInput` (minus `temperature`) for persisted readings.
