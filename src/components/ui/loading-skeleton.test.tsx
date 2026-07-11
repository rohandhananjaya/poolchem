import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Skeleton,
  CardSkeleton,
  CardListSkeleton,
  StatsSkeleton,
  TableSkeleton,
  FormSkeleton,
} from "./loading-skeleton";

describe("Skeleton", () => {
  it("renders with animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("animate-pulse");
  });
});

describe("CardSkeleton", () => {
  it("renders skeleton placeholders", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(4);
  });
});

describe("CardListSkeleton", () => {
  it("renders the default count of card skeletons", () => {
    const { container } = render(<CardListSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(16); // 4 cards × 4 pulses
  });

  it("renders a custom count", () => {
    const { container } = render(<CardListSkeleton count={2} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(8); // 2 × 4
  });
});

describe("StatsSkeleton", () => {
  it("renders the default count of stat tiles", () => {
    const { container } = render(<StatsSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(6); // 3 tiles × 2
  });

  it("renders a custom count", () => {
    const { container } = render(<StatsSkeleton count={4} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(8); // 4 × 2
  });
});

describe("TableSkeleton", () => {
  it("renders the default grid", () => {
    const { container } = render(<TableSkeleton />);
    // header = 4 pulses, body = 5 rows × 4 = 20, total = 24
    expect(container.querySelectorAll(".animate-pulse").length).toBe(24);
  });
});

describe("FormSkeleton", () => {
  it("renders form fields with default count", () => {
    const { container } = render(<FormSkeleton />);
    // 4 field groups × 2 (label + input) = 8, plus button = 9
    expect(container.querySelectorAll(".animate-pulse").length).toBe(9);
  });
});
