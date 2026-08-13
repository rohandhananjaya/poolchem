import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("@/app/(dashboard)/visits/[visitId]/photo-actions", () => ({
  uploadVisitPhotoAction: vi.fn(),
  deleteVisitPhotoAction: vi.fn(),
}));
vi.mock("@/lib/storage/photo-format", () => ({
  validatePhotoFile: vi.fn(),
}));

import { VisitPhotoCapture } from "./VisitPhotoCapture";
import {
  uploadVisitPhotoAction,
  deleteVisitPhotoAction,
} from "@/app/(dashboard)/visits/[visitId]/photo-actions";
import { validatePhotoFile } from "@/lib/storage/photo-format";

const uploadMock = vi.mocked(uploadVisitPhotoAction);
const deleteMock = vi.mocked(deleteVisitPhotoAction);
const validateMock = vi.mocked(validatePhotoFile);

const baseProps = {
  visitId: "visit-1",
  serviceVisitPoolId: "svp-1",
  photos: [
    { id: "photo-1", url: "https://r2.example/photo-1.jpg" },
    { id: "photo-2", url: "https://r2.example/photo-2.jpg" },
  ],
};

const jpeg = new File(["x"], "photo.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
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
    uploadMock.mockResolvedValue({
      ok: true,
      photo: { id: "photo-3", url: "https://r2.example/photo-3.jpg" },
    });
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
  });

  it("deletes a photo and removes its tile on success", async () => {
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
