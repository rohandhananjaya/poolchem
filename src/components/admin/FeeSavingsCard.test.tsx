import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FeeSavingsCard } from "@/components/admin/FeeSavingsCard";
import type { FeeSavingsData } from "@/lib/db/fee-savings";

const data: FeeSavingsData = {
  monthToDateFeesCents: 800,
  monthToDateOldModelCents: 10000,
  monthToDateSavingsCents: 9200,
  trend: [
    { month: "Mar", feesCents: 400, oldModelCents: 10000 },
    { month: "Apr", feesCents: 800, oldModelCents: 10000 },
  ],
  legacyPerPoolRate: 2500,
  activePools: 4,
};

describe("FeeSavingsCard", () => {
  it("renders MTD fees, old-model cost, and estimated savings", () => {
    render(<FeeSavingsCard data={data} />);

    expect(screen.getByText("Fee vs. Old-Model Cost")).toBeDefined();
    expect(screen.getByText("$8.00")).toBeDefined();
    expect(screen.getByText("$100.00")).toBeDefined();
    expect(screen.getByText("$92.00")).toBeDefined();
    expect(screen.getByText(/4 active pools/)).toBeDefined();
  });
});
