import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  assertVisitAccess: vi.fn().mockResolvedValue("DRAFT"),
}));
vi.mock("@/lib/db/visit-photos", () => ({
  addVisitPhoto: vi.fn(),
  deleteVisitPhoto: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  uploadVisitPhoto: vi.fn(),
  deleteVisitPhotoObject: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const { requireTech } = await import("@/lib/auth");
const { assertVisitAccess } = await import("@/lib/db/visits");
const { addVisitPhoto, deleteVisitPhoto } = await import("@/lib/db/visit-photos");
const { uploadVisitPhoto, deleteVisitPhotoObject } = await import("@/lib/storage");
const { revalidatePath } = await import("next/cache");
const {
  uploadVisitPhotoAction,
  deleteVisitPhotoAction,
} = await import("./photo-actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };
const visitId = "visit-1";
const serviceVisitPoolId = "svp-1";
const visitPhotoId = "photo-1";

const mockPhoto = {
  id: visitPhotoId,
  serviceVisitPoolId,
  companyId: "company-1",
  url: "https://r2.example.com/photos/company-1/svp-1/abc.jpg",
  category: "EQUIPMENT",
  sortOrder: 0,
  createdAt: new Date(),
};

const photoFile = new File(["photo-bytes"], "photo.jpg", {
  type: "image/jpeg",
});

function formWith(file: File | null): FormData {
  const form = new FormData();
  if (file) form.set("photo", file);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadVisitPhotoAction", () => {
  it("rejects with no file and never touches storage or db", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await uploadVisitPhotoAction(
      visitId,
      serviceVisitPoolId,
      formWith(null),
    );

    expect(result).toEqual({ ok: false, error: "No photo selected." });
    expect(uploadVisitPhoto).not.toHaveBeenCalled();
    expect(addVisitPhoto).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an empty file without touching storage or db", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await uploadVisitPhotoAction(
      visitId,
      serviceVisitPoolId,
      formWith(new File([], "empty.jpg", { type: "image/jpeg" })),
    );

    expect(result).toEqual({ ok: false, error: "No photo selected." });
    expect(uploadVisitPhoto).not.toHaveBeenCalled();
    expect(addVisitPhoto).not.toHaveBeenCalled();
  });

  it("uploads, inserts, revalidates and returns the created photo", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(uploadVisitPhoto).mockResolvedValue(mockPhoto.url);
    vi.mocked(addVisitPhoto).mockResolvedValue(mockPhoto);

    const result = await uploadVisitPhotoAction(
      visitId,
      serviceVisitPoolId,
      formWith(photoFile),
    );

    expect(assertVisitAccess).toHaveBeenCalledWith(visitId, "company-1", "user-1");
    expect(uploadVisitPhoto).toHaveBeenCalledWith({
      companyId: "company-1",
      serviceVisitPoolId,
      file: photoFile,
    });
    expect(addVisitPhoto).toHaveBeenCalledWith(
      { serviceVisitPoolId, url: mockPhoto.url },
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
    expect(result).toEqual({ ok: true, photo: mockPhoto });
  });

  it("cleans up the R2 object when the db insert throws", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(uploadVisitPhoto).mockResolvedValue(mockPhoto.url);
    vi.mocked(addVisitPhoto).mockRejectedValue(new Error("DB down"));

    await expect(
      uploadVisitPhotoAction(visitId, serviceVisitPoolId, formWith(photoFile)),
    ).rejects.toThrow("DB down");
    expect(deleteVisitPhotoObject).toHaveBeenCalledWith(mockPhoto.url);
  });

  it("does not clean up when the insert succeeds", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(uploadVisitPhoto).mockResolvedValue(mockPhoto.url);
    vi.mocked(addVisitPhoto).mockResolvedValue(mockPhoto);

    await uploadVisitPhotoAction(visitId, serviceVisitPoolId, formWith(photoFile));

    expect(deleteVisitPhotoObject).not.toHaveBeenCalled();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      uploadVisitPhotoAction(visitId, serviceVisitPoolId, formWith(photoFile)),
    ).rejects.toThrow("Auth required");
  });

  it("throws when the user has no company", async () => {
    vi.mocked(requireTech).mockResolvedValue({
      id: "user-1",
      companyId: null,
      role: "SUPER_ADMIN",
    } as never);

    await expect(
      uploadVisitPhotoAction(visitId, serviceVisitPoolId, formWith(photoFile)),
    ).rejects.toThrow("No company affiliation.");
  });
});

describe("deleteVisitPhotoAction", () => {
  it("deletes the row, then the object (authoritative url), and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(deleteVisitPhoto).mockResolvedValue(mockPhoto);

    const result = await deleteVisitPhotoAction(visitId, visitPhotoId);

    expect(assertVisitAccess).toHaveBeenCalledWith(visitId, "company-1", "user-1");
    expect(deleteVisitPhoto).toHaveBeenCalledWith(visitPhotoId, "company-1");
    expect(deleteVisitPhotoObject).toHaveBeenCalledWith(mockPhoto.url);
    expect(
      vi.mocked(deleteVisitPhoto).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(deleteVisitPhotoObject).mock.invocationCallOrder[0],
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
    expect(result).toEqual({ ok: true });
  });

  it("returns not-found and never touches the object when the row is missing/foreign", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(deleteVisitPhoto).mockResolvedValue(null);

    const result = await deleteVisitPhotoAction(visitId, visitPhotoId);

    expect(result).toEqual({ ok: false, error: "Photo not found." });
    expect(deleteVisitPhotoObject).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      deleteVisitPhotoAction(visitId, visitPhotoId),
    ).rejects.toThrow("Auth required");
  });
});