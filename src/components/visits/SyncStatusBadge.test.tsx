import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SyncStatusBadge } from "./SyncStatusBadge";

describe("SyncStatusBadge", () => {
  it("renders the synced label", () => {
    render(<SyncStatusBadge status="synced" />);
    expect(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("renders the pending label", () => {
    render(<SyncStatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders the offline label", () => {
    render(<SyncStatusBadge status="offline" />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("renders the syncing label", () => {
    render(<SyncStatusBadge status="syncing" />);
    expect(screen.getByText("Syncing")).toBeInTheDocument();
  });

  it("renders the failed label", () => {
    render(<SyncStatusBadge status="failed" />);
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });

  it("shows the pending count when provided", () => {
    render(
      <SyncStatusBadge
        status="pending"
        counts={{ pending: 3, failed: 0, dead: 0 }}
      />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("shows the unsynced count (failed + dead) when failed", () => {
    render(
      <SyncStatusBadge
        status="failed"
        counts={{ pending: 0, failed: 2, dead: 1 }}
      />,
    );
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("shows no count for synced", () => {
    const { container } = render(
      <SyncStatusBadge
        status="synced"
        counts={{ pending: 0, failed: 0, dead: 0 }}
      />,
    );
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(container.textContent).toBe("Synced");
  });
});
