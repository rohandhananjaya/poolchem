import "fake-indexeddb/auto";

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { db } from "./db";
import {
  enqueuePhoto,
  getDuePhotos,
  getPhotoStats,
  getPhotoVisitStats,
  getPendingPhotosForBody,
  markPhotoStatus,
  deletePhotoEntry,
  countPendingPhotosForBody,
} from "./photo-queue";
import { computeNextRetryAt, MAX_RETRIES } from "./backoff";

/** Deterministic backoff schedule for assertions (jitter pinned to 0). */
function pinBackoff() {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
}

const photoFile = new File(["photo-bytes"], "photo.jpg", {
  type: "image/jpeg",
});

describe("photo-queue", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    pinBackoff();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("enqueuePhoto", () => {
    it("stores a pending entry with the tenant + body + visit scoping", async () => {
      const entry = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
      );

      expect(entry).toMatchObject({
        companyId: "company-1",
        visitId: "visit-1",
        serviceVisitPoolId: "svp-1",
        kind: "upload",
        status: "pending",
        retryCount: 0,
      });
      expect(entry.blob).toBe(photoFile);
      expect(entry.mimeType).toBe("image/jpeg");

      const reloaded = await getPendingPhotosForBody("company-1", "svp-1");
      expect(reloaded.map((e) => e.clientMutationId)).toEqual([
        entry.clientMutationId,
      ]);
    });

    it("drops a duplicate clientMutationId (idempotent re-enqueue)", async () => {
      const first = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
        "photo-cm-1",
      );
      const second = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
        "photo-cm-1",
      );

      expect(second.clientMutationId).toBe(first.clientMutationId);
      expect(await countPendingPhotosForBody("company-1", "svp-1")).toBe(1);
    });

    it("scopes entries per tenant and per body", async () => {
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await enqueuePhoto("company-1", "visit-1", "svp-2", photoFile);
      await enqueuePhoto("company-2", "visit-9", "svp-1", photoFile, "cm-x");

      expect(await countPendingPhotosForBody("company-1", "svp-1")).toBe(1);
      expect(await countPendingPhotosForBody("company-1", "svp-2")).toBe(1);
      expect(await countPendingPhotosForBody("company-2", "svp-1")).toBe(1);
    });

    it("mints a unique clientMutationId per call when none is supplied", async () => {
      const a = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      const b = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      expect(a.clientMutationId).not.toBe(b.clientMutationId);
    });
  });

  describe("getDuePhotos", () => {
    it("returns pending + due failed entries FIFO, excluding retry windows", async () => {
      const now = 1_000_000;
      const old = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
        "cm-old",
      );
      const windowed = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
        "cm-window",
      );
      const due = await enqueuePhoto(
        "company-1",
        "visit-1",
        "svp-1",
        photoFile,
        "cm-due",
      );

      // Simulate a failure schedule: windowed is still backing off, due is ready.
      await markPhotoStatus("company-1", windowed.clientMutationId, "failed", {
        retryCount: 1,
        nextRetryAt: computeNextRetryAt(now, 0),
      });
      await markPhotoStatus("company-1", due.clientMutationId, "failed", {
        retryCount: 1,
        nextRetryAt: now - 1,
      });

      const result = await getDuePhotos("company-1", { now });

      // FIFO by createdAt: old (pending) first, then due. windowed is skipped.
      expect(result.map((e) => e.clientMutationId)).toEqual([
        old.clientMutationId,
        due.clientMutationId,
      ]);
      expect(result[1].nextRetryAt).toBe(now - 1);
    });

    it("honors the limit", async () => {
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile, "cm-1");
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile, "cm-2");

      const result = await getDuePhotos("company-1", { limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe("stats and deletion", () => {
    it("getPhotoStats tallies per-tenant counts by status", async () => {
      const e = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await markPhotoStatus("company-1", e.clientMutationId, "failed", {
        nextRetryAt: Date.now() + 1000,
      });

      expect(await getPhotoStats("company-1")).toEqual({
        pending: 0,
        processing: 0,
        failed: 1,
        dead: 0,
      });
      expect(await getPhotoStats("company-2")).toEqual({
        pending: 0,
        processing: 0,
        failed: 0,
        dead: 0,
      });
    });

    it("getPhotoVisitStats counts one visit's photos by status", async () => {
      const a = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile, "cm-b");
      const c = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile, "cm-c");

      await markPhotoStatus("company-1", a.clientMutationId, "failed", {
        retryCount: 1,
        nextRetryAt: Date.now() + 1000,
      });
      await markPhotoStatus("company-1", c.clientMutationId, "dead");

      expect(await getPhotoVisitStats("company-1", "visit-1")).toEqual({
        pending: 1,
        failed: 1,
        dead: 1,
      });
      // Other visits are untouched.
      await enqueuePhoto("company-1", "visit-2", "svp-1", new File([""], "b.jpg"));
      expect((await getPhotoVisitStats("company-1", "visit-2")).pending).toBe(1);
    });

    it("dead-lettering respects MAX_RETRIES via markPhotoStatus", async () => {
      const e = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await markPhotoStatus("company-1", e.clientMutationId, "failed", {
        retryCount: MAX_RETRIES,
      });
      const reloaded = await getPendingPhotosForBody("company-1", "svp-1");
      expect(reloaded[0].retryCount).toBe(MAX_RETRIES);
      expect(reloaded[0].status).toBe("failed");
    });

    it("deletePhotoEntry removes a single queued photo by tenant + key", async () => {
      const e = await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile);
      await enqueuePhoto("company-1", "visit-1", "svp-1", photoFile, "cm-keep");
      // A different tenant holding the same cm must be left alone.
      await enqueuePhoto("company-2", "visit-9", "svp-1", photoFile, e.clientMutationId);

      await deletePhotoEntry("company-1", e.clientMutationId);

      expect(await countPendingPhotosForBody("company-1", "svp-1")).toBe(1);
      expect(await countPendingPhotosForBody("company-2", "svp-1")).toBe(1);
    });
  });
});