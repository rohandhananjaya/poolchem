import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the empty state message", () => {
    render(<EmptyState />);
    expect(
      screen.getByText("No visits scheduled for today."),
    ).toBeInTheDocument();
  });
});
