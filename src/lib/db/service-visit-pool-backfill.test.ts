import { describe, expect, it } from "vitest";

import { buildServiceVisitPoolBackfillPlan } from "@/lib/db/service-visit-pool-backfill";

const poolId = "pool-1";
const companyId = "company-1";

const visit = {
  id: "visit-1",
  poolId,
  createdAt: new Date("2026-01-15T10:00:00Z"),
};

describe("buildServiceVisitPoolBackfillPlan", () => {
  it("creates a join row with the pool's companyId and the visit's createdAt", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan.joinsToCreate).toEqual([
      {
        serviceVisitId: visit.id,
        poolId,
        companyId,
        createdAt: visit.createdAt,
      },
    ]);
    expect(plan.orphanVisits).toEqual([]);
    expect(plan.skippedVisits).toEqual([]);
  });

  it("skips a visit that already has a join row instead of duplicating it", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [{ id: "svp-existing", serviceVisitId: visit.id, poolId }],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan.joinsToCreate).toEqual([]);
    expect(plan.skippedVisits).toEqual([{ id: visit.id, poolId }]);
    expect(plan.summary.skippedVisits).toBe(1);
  });

  it("maps a null-serviceVisitPoolId reading to the EXISTING join id (partial-run healing)", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [{ id: "svp-existing", serviceVisitId: visit.id, poolId }],
      unbackfilledReadings: [{ id: "reading-1", visitId: visit.id }],
      unbackfilledChemicals: [],
    });

    expect(plan.readingsToUpdate).toEqual([
      { serviceVisitId: visit.id, joinId: "svp-existing", ids: ["reading-1"] },
    ]);
  });

  it("leaves a reading with a non-null serviceVisitPoolId untouched", () => {
    // Only unbackfilled (null) rows are fed to the builder; a backfilled row is
    // simply absent from the input and must not appear in the plan.
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan.readingsToUpdate).toEqual([]);
    expect(plan.chemicalsToUpdate).toEqual([]);
  });

  it("collects an orphan visit (pool missing from the map) and creates no join", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: {},
      existingJoins: [],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan.joinsToCreate).toEqual([]);
    expect(plan.orphanVisits).toEqual([{ id: visit.id, poolId }]);
  });

  it("excludes children of an orphan visit from the update batches", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: {},
      existingJoins: [],
      unbackfilledReadings: [{ id: "reading-1", visitId: visit.id }],
      unbackfilledChemicals: [{ id: "chem-1", visitId: visit.id }],
    });

    expect(plan.readingsToUpdate).toEqual([]);
    expect(plan.chemicalsToUpdate).toEqual([]);
    expect(plan.orphanVisits).toEqual([{ id: visit.id, poolId }]);
  });

  it("returns an empty plan without throwing for empty inputs", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [],
      poolCompanyIdByPoolId: {},
      existingJoins: [],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan).toEqual({
      joinsToCreate: [],
      readingsToUpdate: [],
      chemicalsToUpdate: [],
      orphanVisits: [],
      skippedVisits: [],
      summary: {
        visits: 0,
        joinsToCreate: 0,
        readingsToUpdate: 0,
        chemicalsToUpdate: 0,
        orphanVisits: 0,
        skippedVisits: 0,
      },
    });
  });

  it("groups a new-join visit's readings and chemicals into batches with a null joinId", () => {
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [],
      unbackfilledReadings: [
        { id: "reading-1", visitId: visit.id },
        { id: "reading-2", visitId: visit.id },
      ],
      unbackfilledChemicals: [{ id: "chem-1", visitId: visit.id }],
    });

    expect(plan.joinsToCreate).toHaveLength(1);
    expect(plan.readingsToUpdate).toEqual([
      { serviceVisitId: visit.id, joinId: null, ids: ["reading-1", "reading-2"] },
    ]);
    expect(plan.chemicalsToUpdate).toEqual([
      { serviceVisitId: visit.id, joinId: null, ids: ["chem-1"] },
    ]);
    expect(plan.summary.readingsToUpdate).toBe(2);
    expect(plan.summary.chemicalsToUpdate).toBe(1);
  });

  it("creates one join per visit even when two visits share a pool", () => {
    const secondVisit = {
      id: "visit-2",
      poolId,
      createdAt: new Date("2026-01-16T10:00:00Z"),
    };
    const plan = buildServiceVisitPoolBackfillPlan({
      visits: [visit, secondVisit],
      poolCompanyIdByPoolId: { [poolId]: companyId },
      existingJoins: [],
      unbackfilledReadings: [],
      unbackfilledChemicals: [],
    });

    expect(plan.joinsToCreate).toHaveLength(2);
    expect(plan.joinsToCreate.map((join) => join.serviceVisitId)).toEqual([
      "visit-1",
      "visit-2",
    ]);
  });
});
