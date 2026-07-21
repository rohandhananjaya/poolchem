import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockImportPoolsAction = vi.fn();
vi.mock("@/app/(dashboard)/pools/actions", () => ({
  importPoolsAction: (...args: unknown[]) => mockImportPoolsAction(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ImportPoolsDialog } from "./ImportPoolsDialog";

function csvFile(contents: string): File {
  return new File([contents], "pools.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ImportPoolsDialog", () => {
  it("renders a locked hint when the plan does not include csv_import", () => {
    render(<ImportPoolsDialog canImportExport={false} />);
    expect(screen.getByText(/available on paid plans/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import/i })).not.toBeInTheDocument();
  });

  it("opens the dialog and previews a selected CSV", async () => {
    const user = userEvent.setup();
    render(<ImportPoolsDialog canImportExport={true} />);

    await user.click(screen.getByRole("button", { name: /import/i }));
    expect(screen.getByText("Import pools from CSV")).toBeInTheDocument();

    const file = csvFile("name,volume\nBackyard Pool,10000\n");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText("1 row detected")).toBeInTheDocument();
    });
  });

  it("submits parsed rows and shows the imported/skipped summary", async () => {
    const user = userEvent.setup();
    mockImportPoolsAction.mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: [{ row: 3, reason: "name is required" }],
    });

    render(<ImportPoolsDialog canImportExport={true} />);
    await user.click(screen.getByRole("button", { name: /import/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, csvFile("name,volume\nPool,10000\n"));
    await waitFor(() => expect(screen.getByText("1 row detected")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText("Imported 1 pool.")).toBeInTheDocument();
    });
    expect(screen.getByText(/Row 3: name is required/)).toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("does not refresh when nothing was imported", async () => {
    const user = userEvent.setup();
    mockImportPoolsAction.mockResolvedValue({ ok: true, imported: 0, skipped: [] });

    render(<ImportPoolsDialog canImportExport={true} />);
    await user.click(screen.getByRole("button", { name: /import/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, csvFile("name,volume\n,\n"));
    await waitFor(() => expect(screen.getByText("1 row detected")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(screen.getByText("Imported 0 pools.")).toBeInTheDocument();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
