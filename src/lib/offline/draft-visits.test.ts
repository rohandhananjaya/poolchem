import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import {
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft,
} from "./draft-visits";
import type { DraftVisitPayload } from "./types";

function payload(overrides: Partial<DraftVisitPayload> = {}): DraftVisitPayload {
  return {
    readings: {
      ph: 7.2,
      freeChlorine: 1.5,
      totalAlkalinity: 90,
      calciumHardness: 250,
      cyanuricAcid: 30,
      temperature: 78,
    },
    chemicals: [{ name: "Chlorine", amount: 1.0, unit: "lb" }],
    notes: "field notes",
    ...overrides,
  };
}

describe("draft-visits", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("saves and reads back a draft", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());

    const draft = await getDraft("company-1", "visit-1");

    expect(draft).not.toBeNull();
    expect(draft!.visitId).toBe("visit-1");
    expect(draft!.techId).toBe("tech-1");
    expect(draft!.companyId).toBe("company-1");
    expect(draft!.payload.readings.ph).toBe(7.2);
    expect(draft!.payload.chemicals).toHaveLength(1);
  });

  it("returns null when no draft exists for a visit", async () => {
    await expect(getDraft("company-1", "missing")).resolves.toBeNull();
  });

  it("upserts: a second save replaces the stored draft, not duplicates it", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await saveDraft(
      "company-1",
      "tech-1",
      "visit-1",
      payload({ notes: "updated notes" }),
    );

    const draft = await getDraft("company-1", "visit-1");
    expect(draft!.payload.notes).toBe("updated notes");
    expect(await db.draftVisits.count()).toBe(1);
  });

  it("stores the serverVersion when one is provided", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload(), 3);

    const draft = await getDraft("company-1", "visit-1");
    expect(draft!.serverVersion).toBe(3);
  });

  it("leaves serverVersion unset when none is provided", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());

    const draft = await getDraft("company-1", "visit-1");
    expect(draft!.serverVersion).toBeUndefined();
  });

  it("keeps the same visit's drafts separate across tenants", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await saveDraft(
      "company-2",
      "tech-9",
      "visit-1",
      payload({ notes: "other tenant" }),
    );

    const a = await getDraft("company-1", "visit-1");
    const b = await getDraft("company-2", "visit-1");

    expect(a!.payload.notes).toBe("field notes");
    expect(b!.payload.notes).toBe("other tenant");
    expect(a!.id).not.toBe(b!.id);
  });

  it("lists a tenant's drafts most recently updated first", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await saveDraft("company-1", "tech-1", "visit-2", payload());
    await saveDraft("company-1", "tech-1", "visit-3", payload());

    const drafts = await listDrafts("company-1");
    expect(drafts.map((d) => d.visitId)).toEqual(["visit-3", "visit-2", "visit-1"]);
  });

  it("lists only the tenant's own drafts", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await saveDraft("company-2", "tech-9", "visit-2", payload());

    const drafts = await listDrafts("company-1");
    expect(drafts.map((d) => d.visitId)).toEqual(["visit-1"]);
  });

  it("deletes a draft", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await deleteDraft("company-1", "visit-1");

    await expect(getDraft("company-1", "visit-1")).resolves.toBeNull();
  });

  it("deleting a non-existent draft is a no-op", async () => {
    await expect(deleteDraft("company-1", "visit-1")).resolves.toBeUndefined();
  });
});
