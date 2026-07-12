import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChemicalRecommendations } from "./ChemicalRecommendations";

describe("ChemicalRecommendations", () => {
  it("shows balanced state when no recommendations", () => {
    render(
      <ChemicalRecommendations
        recommendations={[]}
        poolVolume={10_000}
        checked={{}}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Water is balanced")).toBeInTheDocument();
    expect(
      screen.getByText("No chemical additions needed"),
    ).toBeInTheDocument();
  });

  it("renders a list of chemical recommendations", () => {
    render(
      <ChemicalRecommendations
        recommendations={[
          {
            chemical: "Soda Ash",
            amount: 6,
            unit: "oz",
            reason: "Raise pH",
            severity: "moderate",
          },
          {
            chemical: "Liquid Chlorine",
            amount: 2,
            unit: "gal",
            reason: "Raise chlorine",
            severity: "minor",
          },
        ]}
        poolVolume={10_000}
        checked={{}}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Soda Ash")).toBeInTheDocument();
    expect(screen.getByText("Liquid Chlorine")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
  });

  it("renders partial drain recommendation for N/A chemicals", () => {
    render(
      <ChemicalRecommendations
        recommendations={[
          {
            chemical: "N/A",
            amount: 0,
            unit: "",
            reason: "Partially drain and refill pool water",
            severity: "critical",
          },
        ]}
        poolVolume={10_000}
        checked={{}}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Partial drain & refill"),
    ).toBeInTheDocument();
  });

  it("calls onToggle when a chemical checkbox is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <ChemicalRecommendations
        recommendations={[
          {
            chemical: "Soda Ash",
            amount: 6,
            unit: "oz",
            reason: "Raise pH",
            severity: "moderate",
          },
        ]}
        poolVolume={10_000}
        checked={{}}
        onToggle={onToggle}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledWith("Soda Ash");
  });

  it("shows checked state for added chemicals", () => {
    render(
      <ChemicalRecommendations
        recommendations={[
          {
            chemical: "Soda Ash",
            amount: 6,
            unit: "oz",
            reason: "Raise pH",
            severity: "moderate",
          },
        ]}
        poolVolume={10_000}
        checked={{ "Soda Ash": true }}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Soda Ash")).toBeInTheDocument();
  });
});
