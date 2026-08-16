import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const { onlineState } = vi.hoisted(() => ({ onlineState: { online: true } }));

vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("@/app/(dashboard)/visits/[visitId]/photo-actions", () => ({
  uploadVisitPhotoAction: vi.fn(),
  deleteVisitPhotoAction: vi.fn(),
}));
vi.mock("@/lib/storage/photo-format", () => ({
  validatePhotoFile: vi.fn(),
}));
vi.mock("@/lib/offline/photo-queue", () => ({
  enqueuePhoto: vi.fn(),
  deletePhotoEntry: vi.fn(),
  getPendingPhotosForBody: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => ({
    online: onlineState.online,
    hydrated: true,
  }),
}));

import { VisitPhotoCapture } from "./VisitPhotoCapture";
import {
  uploadVisitPhotoAction,
  deleteVisitPhotoAction,
} from "@/app/(dashboard)/visits/[visitId]/photo-actions";
import { validatePhotoFile } from "@/lib/storage/photo-format";
import {
  enqueuePhoto,
  deletePhotoEntry,
} from "@/lib/offline/photo-queue";

const uploadMock = vi.mocked(uploadVisitPhotoAction);
const deleteMock = vi.mocked(deleteVisitPhotoAction);
const validateMock = vi.mocked(validatePhotoFile);
const enqueueMock = vi.mocked(enqueuePhoto);
const deleteEntryMock = vi.mocked(deletePhotoEntry);

const baseProps = {
  companyId: "company-1",
  visitId: "visit-1",
  serviceVisitPoolId: "svp-1",
  photos: [
    { id: "photo-1", url: "https://r2.example/photo-1.jpg" },
    { id: "photo-2", url: "https://r2.example/photo-2.jpg" },
  ],
};

const serverPhoto = {
  id: "photo-3",
  serviceVisitPoolId: "svp-1",
  companyId: "company-1",
  url: "https://r2.example/photo-3.jpg",
  category: "EQUIPMENT" as const,
  sortOrder: 0,
  clientMutationId: null,
  createdAt: new Date(),
};

const jpeg = new File(["x"], "photo.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
  onlineState.online = true;
});

describe("VisitPhotoCapture", () => {
  it("renders existing photo tiles and an add button", () => {
    render(<VisitPhotoCapture {...baseProps} />);

    expect(screen.getAllByAltText("")).toHaveLength(2);
    expect(screen.getByLabelText(/add photo/i)).toBeInTheDocument();
  });

  it("shows the empty hint when no photos exist", () => {
    render(<VisitPhotoCapture {...baseProps} photos={[]} />);

    expect(screen.getByText(/no photos yet/i)).toBeInTheDocument();
  });

  it("uploads a valid photo and appends it to the grid", async () => {
    validateMock.mockReturnValue({ ok: true });
    uploadMock.mockResolvedValue({ ok: true, photo: serverPhoto });
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.upload(screen.getByLabelText(/add photo/i), jpeg);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(1);
      const [visitId, svpId, fd] = uploadMock.mock.calls[0];
      expect(visitId).toBe("visit-1");
      expect(svpId).toBe("svp-1");
      expect(fd.get("photo")).toBe(jpeg);
    });
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith("Photo added.");
    await waitFor(() => {
      expect(screen.getAllByAltText("")).toHaveLength(3);
    });
    expect(
      screen
        .getAllByAltText("")
        .some((img) => img.getAttribute("src") === "https://r2.example/photo-3.jpg"),
    ).toBe(true);
  });

  it("shows a toast and skips the action for an invalid photo", async () => {
    validateMock.mockReturnValue({
      ok: false,
      error: "Photo must be 6MB or smaller.",
    });
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.upload(screen.getByLabelText(/add photo/i), jpeg);

    expect(mockToast.error).toHaveBeenCalledWith("Photo must be 6MB or smaller.");
    expect(uploadMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues immediately when offline and shows a queued tile", async () => {
    onlineState.online = false;
    validateMock.mockReturnValue({ ok: true });
    enqueueMock.mockResolvedValue({
      clientMutationId: "cm-queued-1",
      blob: jpeg,
    } as never);
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.upload(screen.getByLabelText(/add photo/i), jpeg);

    await waitFor(() => {
      expect(enqueueMock).toHaveBeenCalledWith(
        "company-1",
        "visit-1",
        "svp-1",
        jpeg,
      );
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalledWith(
      "Photo saved offline — will upload when back online.",
    );
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it("degrades to the queue when the upload action throws", async () => {
    validateMock.mockReturnValue({ ok: true });
    uploadMock.mockRejectedValue(new Error("network down"));
    enqueueMock.mockResolvedValue({
      clientMutationId: "cm-queued-1",
      blob: jpeg,
    } as never);
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.upload(screen.getByLabelText(/add photo/i), jpeg);

    await waitFor(() => {
      expect(enqueueMock).toHaveBeenCalledTimes(1);
    });
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it("deletes a server photo and removes its tile on success", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.click(
      screen.getAllByRole("button", { name: /delete photo/i })[0],
    );

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("visit-1", "photo-1");
    });
    await waitFor(() => {
      expect(screen.getAllByAltText("")).toHaveLength(1);
    });
  });

  it("deletes a queued tile by removing its queue entry (no server action)", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    enqueueMock.mockResolvedValue({
      clientMutationId: "cm-queued-1",
      blob: jpeg,
    } as never);
    validateMock.mockReturnValue({ ok: true });
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.upload(screen.getByLabelText(/add photo/i), jpeg);
    await waitFor(() => {
      expect(screen.getByText(/queued/i)).toBeInTheDocument();
    });
    // Server tiles render first, queued tile last — the third delete button.
    await user.click(
      screen.getAllByRole("button", { name: /delete photo/i })[2],
    );

    await waitFor(() => {
      expect(deleteEntryMock).toHaveBeenCalledWith("company-1", "cm-queued-1");
    });
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
  });

  it("keeps the tile and toasts when delete fails", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "Photo not found." });
    const user = userEvent.setup();
    render(<VisitPhotoCapture {...baseProps} />);

    await user.click(
      screen.getAllByRole("button", { name: /delete photo/i })[0],
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Photo not found.");
    });
    expect(screen.getAllByAltText("")).toHaveLength(2);
  });

  it("hides add and delete affordances when disabled", () => {
    render(<VisitPhotoCapture {...baseProps} disabled />);

    expect(screen.queryByLabelText(/add photo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete photo/i })).not.toBeInTheDocument();
    expect(screen.getAllByAltText("")).toHaveLength(2);
  });
});
