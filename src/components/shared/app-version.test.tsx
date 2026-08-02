import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUsePathname = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { AppVersion } from "./app-version";

describe("AppVersion", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it("renders the package version with a v prefix", () => {
    render(<AppVersion />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();
  });

  it("does not render on /login", () => {
    mockUsePathname.mockReturnValue("/login");
    render(<AppVersion />);
    expect(screen.queryByText(/^v\d+\.\d+\.\d+$/)).not.toBeInTheDocument();
  });

  it("does not render on /signup", () => {
    mockUsePathname.mockReturnValue("/signup");
    render(<AppVersion />);
    expect(screen.queryByText(/^v\d+\.\d+\.\d+$/)).not.toBeInTheDocument();
  });
});
