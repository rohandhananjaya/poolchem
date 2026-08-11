import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { WaterReadingInput } from "./WaterReadingInput";

vi.mock("@/lib/pool-chemistry", () => ({
  getIdealRange: vi.fn().mockReturnValue({ min: 7.4, max: 7.6, unit: "" }),
}));

function renderWithForm(
  ui: React.ReactElement,
): ReturnType<typeof render> {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const { control } = useForm({ defaultValues: { ph: undefined } });
    return (
      <>
        {React.cloneElement(children as React.ReactElement<{ control?: unknown }>, {
          control,
        })}
      </>
    );
  }
  return render(<Wrapper>{ui}</Wrapper>);
}

describe("WaterReadingInput", () => {
  it("renders label and input", () => {
    renderWithForm(
      <WaterReadingInput name="ph" label="pH" unit="" control={undefined as never} />,
    );
    expect(screen.getByText("pH")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("renders the unit suffix", () => {
    renderWithForm(
      <WaterReadingInput
        name="freeChlorine"
        label="Free Chlorine"
        unit="ppm"
        control={undefined as never}
      />,
    );
    expect(screen.getByText("ppm")).toBeInTheDocument();
  });

  it("shows the last reading as a label when provided and no value is set", () => {
    renderWithForm(
      <WaterReadingInput
        name="ph"
        label="pH"
        unit=""
        lastReading={7.5}
        control={undefined as never}
      />,
    );
    expect(screen.getByText(/Last read/)).toBeInTheDocument();
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Last read/i })).not.toBeInTheDocument();
  });

  it("hides the last-reading label when disabled", () => {
    renderWithForm(
      <WaterReadingInput
        name="ph"
        label="pH"
        unit=""
        lastReading={7.5}
        disabled
        control={undefined as never}
      />,
    );
    expect(screen.queryByText(/Last read/)).not.toBeInTheDocument();
  });

  it("does not error for an unknown parameter label", () => {
    renderWithForm(
      <WaterReadingInput
        name="unknown"
        label="Unknown"
        unit=""
        control={undefined as never}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
