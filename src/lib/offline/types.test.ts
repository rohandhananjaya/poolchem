import { describe, expect, it } from "vitest";

import {
  createClientMutationId,
  isPoolMutationAction,
  isVisitScopedAction,
  type CreatePoolPayload,
  type CreateVisitPayload,
  type DeletePoolPayload,
  type DraftVisitPayload,
  type QueuedMutation,
  type UpdatePoolPayload,
  type UpdateVisitStatusPayload,
} from "./types";

function draftPayload(
  overrides: Partial<DraftVisitPayload> = {},
): DraftVisitPayload {
  return {
    bodies: [
      {
        serviceVisitPoolId: "join-1",
        readings: { ph: 7.2 },
        chemicals: [{ name: "Chlorine", amount: 1, unit: "lb" }],
      },
    ],
    notes: "offline",
    clientMutationId: "cm-1",
    ...overrides,
  };
}

function base(id: string) {
  return {
    companyId: "c1",
    clientMutationId: id,
    status: "pending" as const,
    retryCount: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("offline types", () => {
  it("round-trips a saveDraft mutation through JSON", () => {
    const mutation: QueuedMutation = {
      ...base("cm-save"),
      action: "saveDraft",
      visitId: "v1",
      payload: draftPayload(),
    };

    const parsed = JSON.parse(JSON.stringify(mutation)) as QueuedMutation;
    expect(parsed.action).toBe("saveDraft");
    expect("visitId" in parsed && parsed.visitId).toBe("v1");
    if (parsed.action !== "saveDraft") throw new Error("expected saveDraft");
    expect(parsed.payload.notes).toBe("offline");
    expect(parsed.status).toBe("pending");
  });

  it("round-trips a createPool mutation through JSON, retaining failure meta", () => {
    const payload: CreatePoolPayload = {
      name: "Backyard",
      volume: 15000,
      notes: "deep",
    };
    const mutation: QueuedMutation = {
      ...base("cm-pool"),
      action: "createPool",
      payload,
      status: "failed",
      retryCount: 2,
      lastError: "boom",
      nextRetryAt: 5000,
    };

    const parsed = JSON.parse(JSON.stringify(mutation)) as QueuedMutation;
    expect(parsed.action).toBe("createPool");
    expect(parsed.payload).toMatchObject({ name: "Backyard", volume: 15000 });
    expect(parsed.retryCount).toBe(2);
    expect(parsed.lastError).toBe("boom");
    expect(parsed.nextRetryAt).toBe(5000);
    expect("visitId" in parsed).toBe(false);
  });

  it("covers every queued action variant", () => {
    const variants: QueuedMutation[] = [
      {
        ...base("a"),
        action: "saveDraft",
        visitId: "v",
        payload: draftPayload(),
      },
      {
        ...base("b"),
        action: "completeVisit",
        visitId: "v",
        payload: draftPayload(),
      },
      {
        ...base("c"),
        action: "updateVisitStatus",
        visitId: "v",
        payload: { status: "IN_PROGRESS" } satisfies UpdateVisitStatusPayload,
      },
      {
        ...base("d"),
        action: "createVisit",
        payload: {
          poolIds: ["p"],
          date: "2026-08-09",
          techId: "t",
          clientMutationId: "d",
        } satisfies CreateVisitPayload,
      },
      {
        ...base("e"),
        action: "createPool",
        payload: { name: "P", volume: 10 } satisfies CreatePoolPayload,
      },
      {
        ...base("f"),
        action: "updatePool",
        payload: {
          poolId: "p",
          name: "P",
          volume: 10,
          isActive: true,
        } satisfies UpdatePoolPayload,
      },
      {
        ...base("g"),
        action: "deletePool",
        payload: { poolId: "p" } satisfies DeletePoolPayload,
      },
    ];

    expect(variants.map((v) => v.action)).toEqual([
      "saveDraft",
      "completeVisit",
      "updateVisitStatus",
      "createVisit",
      "createPool",
      "updatePool",
      "deletePool",
    ]);
  });

  it("classifies visit-scoped vs pool actions", () => {
    expect(isVisitScopedAction("saveDraft")).toBe(true);
    expect(isVisitScopedAction("completeVisit")).toBe(true);
    expect(isVisitScopedAction("updateVisitStatus")).toBe(true);
    expect(isVisitScopedAction("createVisit")).toBe(false);
    expect(isVisitScopedAction("createPool")).toBe(false);

    expect(isPoolMutationAction("createPool")).toBe(true);
    expect(isPoolMutationAction("updatePool")).toBe(true);
    expect(isPoolMutationAction("deletePool")).toBe(true);
    expect(isPoolMutationAction("saveDraft")).toBe(false);
  });

  it("createClientMutationId returns unique non-empty keys", () => {
    const a = createClientMutationId();
    const b = createClientMutationId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
