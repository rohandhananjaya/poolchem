import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { db } from "@/lib/offline/db";
import { enqueuePhoto, getPhotoVisitStats } from "@/lib/offline/photo-queue";
import { _resetSweepGuardForTests } from "@/lib/offline/processor";
import { usePhotoQueueProcessor } from "./use-photo-queue-processor";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// The hook's default replay reaches `uploadVisitPhotoAction` through a lazy
// import — mocking the module here makes the dynamic import resolve to the mock.
vi.mock("@/app/(dashboard)/visits/[visitId]/photo-actions", () => ({
  uploadVisitPhotoAction: vi.fn(),
}));

const { uploadVisitPhotoAction } = await import(
  "@/app/(dashboard)/visits/[visitId]/photo-actions"
);
const uploadMock = vi.mocked(uploadVisitPhotoAction);

const photoFile = new File(["photo-bytes"], "photo.jpg", {
  type: "image/jpeg",
});

let originalOnLine: PropertyDescriptor | undefined;

function setNavigatorOnline(online: boolean) {
  originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

function restoreNavigatorOnline() {
  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete (navigator as { onLine?: boolean }).onLine;
  }
  originalOnLine = undefined;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  _resetSweepGuardForTests();
  setNavigatorOnline(true);
  vi.clearAllMocks();
});

afterEach(() => {
  restoreNavigatorOnline();
  vi.restoreAllMocks();
});

describe("usePhotoQueueProcessor", () => {
  it("drains queued photos through uploadVisitPhotoAction with a rebuilt File and the idempotency key", async () => {
    const entry = await enqueuePhoto("c1", "v1", "svp-1", photoFile);
    uploadMock.mockResolvedValue({
      ok: true,
      photo: { id: "p1", url: "https://r2.example/p1.jpg" },
    } as never);

    renderHook(() => usePhotoQueueProcessor({ companyId: "c1" }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));

    const [visitId, svpId, fd, cm] = uploadMock.mock.calls[0];
    expect(visitId).toBe("v1");
    expect(svpId).toBe("svp-1");
    expect(cm).toBe(entry.clientMutationId);
    // The stored Blob is rebuilt as a labelled File…
    const file = fd.get("photo");
    expect(file).toBeInstanceOf(File);
    expect((file as File).type).toBe("image/jpeg");
    expect((file as File).name).toBe(`photo-${entry.clientMutationId}.jpg`);
    // …and the idempotent replay removes the queue entry.
    await waitFor(async () =>
      expect(await getPhotoVisitStats("c1", "v1")).toEqual({
        pending: 0,
        failed: 0,
        dead: 0,
      }),
    );
  });

  it("does not drain while offline", async () => {
    await enqueuePhoto("c1", "v1", "svp-1", photoFile);
    setNavigatorOnline(false);

    renderHook(() => usePhotoQueueProcessor({ companyId: "c1" }));

    // Give the sweep interval a beat to (not) fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("exposes drain() for an immediate sweep", async () => {
    // Injected replay gives the sweep full control. The mount auto-sweep runs
    // against an empty queue (no-op); the entry enqueued below flushes only
    // when drain() fires.
    const replay = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() =>
      usePhotoQueueProcessor({ companyId: "c1", replay }),
    );

    const entry = await enqueuePhoto("c1", "v1", "svp-1", photoFile);
    const drainResult = await result.current.drain();

    expect(drainResult).toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    await waitFor(() => expect(result.current.inFlight).toBe(false));
  });

  it("is inert when disabled", async () => {
    await enqueuePhoto("c1", "v1", "svp-1", photoFile);
    uploadMock.mockResolvedValue({
      ok: true,
      photo: { id: "p1", url: "https://r2.example/p1.jpg" },
    } as never);

    renderHook(() =>
      usePhotoQueueProcessor({ companyId: "c1", enabled: false }),
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(uploadMock).not.toHaveBeenCalled();
  });
});