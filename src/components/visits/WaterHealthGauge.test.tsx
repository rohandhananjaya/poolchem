import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WaterHealthGauge } from "./WaterHealthGauge";

describe("WaterHealthGauge", () => {
  it("renders the score and EXCELLENT status", () => {
    render(<WaterHealthGauge score={100} status="EXCELLENT" />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("renders GOOD status", () => {
    render(<WaterHealthGauge score={80} status="GOOD" />);
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders FAIR status", () => {
    render(<WaterHealthGauge score={60} status="FAIR" />);
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it("renders POOR status", () => {
    render(<WaterHealthGauge score={20} status="POOR" />);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
  });

  it("shows LSI when provided", () => {
    render(
      <WaterHealthGauge
        score={100}
        status="EXCELLENT"
        lsi={{ lsi: 0.05, status: "BALANCED", description: "Balanced" }}
      />,
    );
    expect(screen.getByText(/LSI/)).toBeInTheDocument();
    expect(screen.getByText("0.05")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });

  it("does not show LSI section when not provided", () => {
    render(<WaterHealthGauge score={100} status="EXCELLENT" />);
    expect(screen.queryByText(/LSI/)).not.toBeInTheDocument();
  });

  it("renders CORROSIVE and SCALING LSI labels", () => {
    const { rerender } = render(
      <WaterHealthGauge
        score={50}
        status="FAIR"
        lsi={{ lsi: -0.5, status: "CORROSIVE", description: "Corrosive" }}
      />,
    );
    expect(screen.getByText("Corrosive")).toBeInTheDocument();

    rerender(
      <WaterHealthGauge
        score={50}
        status="FAIR"
        lsi={{ lsi: 0.5, status: "SCALING", description: "Scaling" }}
      />,
    );
    expect(screen.getByText("Scaling")).toBeInTheDocument();
  });
});
