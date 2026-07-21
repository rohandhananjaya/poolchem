import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockExportPoolsAction, mockToast } = vi.hoisted(() => ({
  mockExportPoolsAction: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/app/(dashboard)/pools/actions", () => ({
  exportPoolsAction: () => mockExportPoolsAction(),
}));
vi.mock("sonner", () => ({ toast: mockToast }));

import { ExportPoolsButton } from "./ExportPoolsButton";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExportPoolsButton", () => {
  it("renders a locked hint when the plan does not include csv_import", () => {
    render(<ExportPoolsButton canImportExport={false} />);
    expect(screen.getByText(/available on paid plans/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it("exports pools and shows a success toast", async () => {
    const user = userEvent.setup();
    mockExportPoolsAction.mockResolvedValue({
      ok: true,
      data: [{ name: "Pool", volume: 10000 }],
    });

    render(<ExportPoolsButton canImportExport={true} />);
    await user.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(mockExportPoolsAction).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Pools exported.");
    });
  });

  it("shows an error toast when the action fails", async () => {
    const user = userEvent.setup();
    mockExportPoolsAction.mockResolvedValue({
      ok: false,
      error: "CSV export is not available on your plan.",
    });

    render(<ExportPoolsButton canImportExport={true} />);
    await user.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "CSV export is not available on your plan.",
      );
    });
  });
});
