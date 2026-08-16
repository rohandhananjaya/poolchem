import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VisitForm } from "./visit-form";

const CONFLICT_MESSAGE =
  "This visit was updated on another device. Refresh and re-apply your changes.";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

const { mockDrain, mockRetry } = vi.hoisted(() => ({
  mockDrain: vi.fn(),
  mockRetry: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Wiring imports VisitPhotoCapture → real photo-actions (server-only/auth
// deps) would break every test on import. Mock it like VisitPhotoCapture.test.
vi.mock("@/app/(dashboard)/visits/[visitId]/photo-actions", () => ({
  uploadVisitPhotoAction: vi.fn(),
  deleteVisitPhotoAction: vi.fn(),
}));

vi.mock("./actions", () => ({
  completeVisitAction: vi.fn(),
}));

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => ({ online: true, hydrated: true }),
}));

vi.mock("@/hooks/use-visit-sync-status", () => ({
  useVisitSyncStatus: () => ({
    status: "synced",
    counts: { pending: 0, failed: 0, dead: 0 },
    inFlight: false,
    drain: mockDrain,
    retry: mockRetry,
  }),
  // The photo processor reuses the form's permanent-failure classifier.
  classifyVisitError: () => false,
}));

vi.mock("@/lib/offline/draft-visits", () => ({
  saveDraft: vi.fn().mockResolvedValue({}),
  getDraft: vi.fn().mockResolvedValue(null),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/offline/mutation-queue", () => ({
  enqueue: vi.fn().mockResolvedValue({}),
  deleteEntriesForVisit: vi.fn().mockResolvedValue(undefined),
  deleteDeadForVisit: vi.fn().mockResolvedValue(undefined),
  // The shared processor (`useQueueProcessor`, wired through the form's photo
  // + mutation hooks) imports these — must exist on the mock or the module
  // graph breaks at import time.
  getDue: vi.fn().mockResolvedValue([]),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  markStatus: vi.fn().mockResolvedValue(undefined),
  countEntriesForVisit: vi.fn().mockResolvedValue(0),
}));

// This test file doesn't boot fake-indexeddb; the real photo queue (IndexedDB
// via Dexie) would reject on every mount. Mock it so both the live photo
// component tiles and the photo processor's sweep resolve to empty/no-ops.
vi.mock("@/lib/offline/photo-queue", () => ({
  enqueuePhoto: vi.fn().mockResolvedValue({}),
  deletePhotoEntry: vi.fn().mockResolvedValue(undefined),
  getPendingPhotosForBody: vi.fn().mockResolvedValue([]),
  getPhotoStats: vi.fn().mockResolvedValue({ pending: 0, processing: 0, failed: 0, dead: 0 }),
  getDuePhotos: vi.fn().mockResolvedValue([]),
  markPhotoStatus: vi.fn().mockResolvedValue(undefined),
}));

import { toast } from "sonner";
import { completeVisitAction } from "./actions";

const toastError = vi.mocked(toast.error);

function makeVisit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "visit-1",
    status: "IN_PROGRESS",
    notes: null,
    nextServiceDate: null,
    version: 3,
    pool: {
      name: "Test Pool",
      address: null,
      image: null,
      volume: 10_000,
    },
    waterReadings: [],
    chemicalsAdded: [],
    ...overrides,
  };
}

function renderForm() {
  return render(
    <VisitForm
      companyId="company-1"
      visit={makeVisit() as never}
      lastReadings={null}
      currentUser={{ id: "user-1", name: "Tech" }}
      techId="user-1"
      canUseLSI
    />,
  );
}

async function fillAllReadings() {
  const values: Array<[string, string]> = [
    ["readings.ph", "7.5"],
    ["readings.freeChlorine", "2"],
    ["readings.totalAlkalinity", "100"],
    ["readings.calciumHardness", "300"],
    ["readings.cyanuricAcid", "40"],
    ["readings.temperature", "80"],
  ];
  for (const [id, value] of values) {
    fireEvent.change(screen.getByLabelText(
      id.includes("readings.ph") ? "pH" : labelFor(id),
    ), { target: { value } });
  }
}

function labelFor(id: string): string {
  const map: Record<string, string> = {
    "readings.freeChlorine": "Free Chlorine",
    "readings.totalAlkalinity": "Total Alkalinity",
    "readings.calciumHardness": "Calcium Hardness",
    "readings.cyanuricAcid": "Cyanuric Acid",
    "readings.temperature": "Temperature",
  };
  return map[id] ?? id;
}

function makeMultiVisit(overrides: Partial<Record<string, unknown>> = {}) {
  return makeVisit({
    serviceVisitPools: [
      {
        id: "join-1",
        pool: {
          name: "Pool A",
          address: null,
          image: null,
          volume: 12_000,
        },
      },
      {
        id: "join-2",
        pool: {
          name: "Pool B",
          address: null,
          image: null,
          volume: 20_000,
        },
      },
    ],
    ...overrides,
  });
}

function renderMultiForm() {
  return render(
    <VisitForm
      companyId="company-1"
      visit={makeMultiVisit() as never}
      lastReadings={null}
      lastReadingsByJoinId={{}}
      currentUser={{ id: "user-1", name: "Tech" }}
      techId="user-1"
      canUseLSI
    />,
  );
}

const JOIN1_PHOTOS = [
  { id: "photo-a1", url: "https://r2.example/join-1-a.jpg" },
  { id: "photo-a2", url: "https://r2.example/join-1-b.jpg" },
];
const JOIN2_PHOTOS = [
  { id: "photo-b1", url: "https://r2.example/join-2-a.jpg" },
];

function renderMultiFormWithPhotos(
  photosByJoinId: Record<string, Array<{ id: string; url: string }>>,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return render(
    <VisitForm
      companyId="company-1"
      visit={makeMultiVisit(overrides) as never}
      lastReadings={null}
      lastReadingsByJoinId={{}}
      photosByJoinId={photosByJoinId}
      currentUser={{ id: "user-1", name: "Tech" }}
      techId="user-1"
      canUseLSI
    />,
  );
}

const READING_LABELS: Array<[string, string]> = [
  ["pH", "7.5"],
  ["Free Chlorine", "2"],
  ["Total Alkalinity", "100"],
  ["Calcium Hardness", "300"],
  ["Cyanuric Acid", "40"],
  ["Temperature", "80"],
];

/** Fills the currently-active tab's six reading inputs. */
function fillActiveTabReadings() {
  for (const [label, value] of READING_LABELS) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

function phInput() {
  return screen.getByLabelText("pH") as HTMLInputElement;
}

function completeButton() {
  return screen.getByRole("button", { name: /Complete & Send Report/i });
}

// The page-level Complete button only opens the confirmation dialog; the
// dialog's own confirm button (same label) actually submits. Once open, the
// page button is aria-hidden, so a second getByRole resolves to the dialog's
// confirm.
function openAndConfirmComplete() {
  fireEvent.click(completeButton());
  fireEvent.click(completeButton());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDrain.mockReset();
  mockRetry.mockReset();
});

describe("VisitForm handleComplete conflict branch", () => {
  it("shows the conflict toast and reloads server state on a stale-version rejection", async () => {
    vi.mocked(completeVisitAction).mockRejectedValue(
      new Error(CONFLICT_MESSAGE),
    );

    renderForm();
    await fillAllReadings();

    openAndConfirmComplete();

    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(CONFLICT_MESSAGE);
    expect(mockRefresh).toHaveBeenCalled();
    // Conflict path returns early — no success toast, no navigation.
    expect(toast.success).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps the generic failure toast for non-conflict errors", async () => {
    vi.mocked(completeVisitAction).mockRejectedValue(new Error("boom"));

    renderForm();
    await fillAllReadings();

    openAndConfirmComplete();

    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith("Failed to save. Please try again.");
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("re-bases the completion's expectedVersion from the refreshed prop after a conflict", async () => {
    // First completion hits the conflict (server version moved to 4), the form
    // refreshes, and the fresh serialized visit carries version 4. The re-apply
    // must send expectedVersion 4 — otherwise the recovery loops forever against
    // the stale revision.
    vi.mocked(completeVisitAction)
      .mockRejectedValueOnce(new Error(CONFLICT_MESSAGE))
      .mockResolvedValueOnce({ version: 4 });

    const { rerender } = renderForm();
    await fillAllReadings();

    openAndConfirmComplete();
    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(1));
    expect(mockRefresh).toHaveBeenCalled();
    expect(
      (vi.mocked(completeVisitAction).mock.calls[0][1] as { expectedVersion?: number })
        .expectedVersion,
    ).toBe(3);

    rerender(
      <VisitForm
        companyId="company-1"
        visit={makeVisit({ version: 4 }) as never}
        lastReadings={null}
        currentUser={{ id: "user-1", name: "Tech" }}
        techId="user-1"
        canUseLSI
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Complete & Send Report/i }));
    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(2));
    expect(
      (vi.mocked(completeVisitAction).mock.calls[1][1] as { expectedVersion?: number })
        .expectedVersion,
    ).toBe(4);
    expect(toast.success).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalled();
  });

  it("flushes queued saves before completing so expectedVersion is re-based", async () => {
    // handleComplete must drain the queue first: a completion racing an
    // in-flight saveDraft replay would send a stale expectedVersion and falsely
    // conflict against the version the replay is about to bump.
    vi.mocked(completeVisitAction).mockResolvedValue({ version: 4 });

    renderForm();
    await fillAllReadings();

    openAndConfirmComplete();
    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(1));

    expect(mockDrain).toHaveBeenCalled();
    expect(mockDrain.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(completeVisitAction).mock.invocationCallOrder[0],
    );
  });
});

describe("VisitForm multi-body tab UI", () => {
  it("renders one tab per body with pool names, only the active body's editor", () => {
    renderMultiForm();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole("tab", { name: /Pool A/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Pool B/ })).toBeInTheDocument();

    // Inactive tabs are unmounted — only the active body's inputs exist.
    expect(screen.getAllByLabelText("pH")).toHaveLength(1);
  });

  it("switches the visible editor per tab and preserves in-progress input", () => {
    renderMultiForm();

    fireEvent.change(phInput(), { target: { value: "7.5" } });

    // Radix Tabs triggers select on mousedown (not click), so fire mouseDown.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pool B/ }));
    // Tab B starts empty (its own editor is mounted now, A's is unmounted).
    expect(phInput().value).toBe("");

    // Back to A: the typed value survives because RHF state, not the hidden
    // tab's DOM, owns the value.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pool A/ }));
    expect(phInput().value).toBe("7.5");
  });

  it("blocks completion until every body is filled and submits a per-body payload", async () => {
    vi.mocked(completeVisitAction).mockResolvedValue({ version: 4 });
    renderMultiForm();

    // Fill only tab A → completion stays disabled, action never fires.
    fillActiveTabReadings();
    expect(completeButton()).toBeDisabled();
    fireEvent.click(completeButton());
    expect(completeVisitAction).not.toHaveBeenCalled();

    // Fill tab B → enabled; the payload carries both bodies keyed by join id.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pool B/ }));
    fillActiveTabReadings();
    expect(completeButton()).toBeEnabled();

    openAndConfirmComplete();
    await waitFor(() => expect(completeVisitAction).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(completeVisitAction).mock.calls[0] as unknown as [
      string,
      {
        bodies: Array<{
          serviceVisitPoolId: string;
          readings: Record<string, number | undefined>;
        }>;
      },
    ];
    expect(payload.bodies).toHaveLength(2);
    expect(payload.bodies[0].serviceVisitPoolId).toBe("join-1");
    expect(payload.bodies[0].readings.ph).toBe(7.5);
    expect(payload.bodies[1].serviceVisitPoolId).toBe("join-2");
    expect(payload.bodies[1].readings.ph).toBe(7.5);
  });

  it("shows a per-tab completion marker that reflects filled state", () => {
    renderMultiForm();

    const tabA = () => screen.getByRole("tab", { name: /Pool A/ });
    expect(tabA().textContent).toContain("0/6");

    fireEvent.change(phInput(), { target: { value: "7.5" } });
    expect(tabA().textContent).toContain("1/6");

    fillActiveTabReadings();
    // All six filled → the tab swaps its n/6 count for a check icon.
    expect(tabA().textContent).not.toContain("/6");
    expect(tabA().querySelector("svg")).not.toBeNull();
  });

  it("renders no tab bar for a legacy single-body visit", () => {
    renderForm();

    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByLabelText("pH")).toHaveLength(1);
    expect(screen.getByText("Log Readings")).toBeInTheDocument();
  });
});

describe("VisitForm Photos card", () => {
  it("renders no Photos card on a legacy single-body visit (no join rows)", () => {
    renderForm();

    expect(screen.queryByText("Photos")).toBeNull();
    expect(screen.queryByAltText("")).toBeNull();
    expect(screen.queryByLabelText(/add photo/i)).toBeNull();
  });

  it("renders the active body's photo tiles and switches sets per tab", () => {
    renderMultiFormWithPhotos({
      "join-1": JOIN1_PHOTOS,
      "join-2": JOIN2_PHOTOS,
    });

    // Active tab (Pool A / join-1) shows its own tiles only — inactive tabs
    // are unmounted.
    expect(screen.getAllByAltText("")).toHaveLength(JOIN1_PHOTOS.length);
    expect(screen.getAllByAltText("")[0].getAttribute("src")).toBe(
      "https://r2.example/join-1-a.jpg",
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pool B/ }));
    expect(screen.getAllByAltText("")).toHaveLength(JOIN2_PHOTOS.length);
    expect(screen.getAllByAltText("")[0].getAttribute("src")).toBe(
      "https://r2.example/join-2-a.jpg",
    );
  });

  it("shows the empty hint and Add photo button when a body has no photos", () => {
    renderMultiFormWithPhotos({});

    expect(
      screen.getByText("No photos yet — add equipment or issue shots."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/add photo/i)).toBeInTheDocument();
  });

  it("renders photo tiles read-only on a completed visit", () => {
    renderMultiFormWithPhotos(
      { "join-1": JOIN1_PHOTOS, "join-2": JOIN2_PHOTOS },
      { status: "COMPLETED" },
    );

    expect(screen.getAllByAltText("")).toHaveLength(JOIN1_PHOTOS.length);
    expect(screen.queryByLabelText(/add photo/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /delete photo/i })).toBeNull();
  });
});
