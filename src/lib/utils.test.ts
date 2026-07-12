import { describe, expect, it } from "vitest";
import { cn, formText, formOptionalText, cssVar, initials, formatUptime } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });
});

describe("formText", () => {
  it("reads a trimmed string value", () => {
    const fd = new FormData();
    fd.append("name", "  John  ");
    expect(formText(fd, "name")).toBe("John");
  });

  it("returns empty string for missing key", () => {
    expect(formText(new FormData(), "missing")).toBe("");
  });

  it("returns empty string for non-string value", () => {
    const fd = new FormData();
    fd.append("file", new Blob());
    expect(formText(fd, "file")).toBe("");
  });
});

describe("formOptionalText", () => {
  it("returns trimmed string when present", () => {
    const fd = new FormData();
    fd.append("phone", "  555-0100  ");
    expect(formOptionalText(fd, "phone")).toBe("555-0100");
  });

  it("returns null for missing key", () => {
    expect(formOptionalText(new FormData(), "missing")).toBeNull();
  });

  it("returns null for empty string", () => {
    const fd = new FormData();
    fd.append("phone", "  ");
    expect(formOptionalText(fd, "phone")).toBeNull();
  });
});

describe("cssVar", () => {
  it("returns fallback when document is undefined", () => {
    expect(cssVar("--color", "red")).toBe("red");
  });
});

describe("initials", () => {
  it("returns first two letters for single name", () => {
    expect(initials("John")).toBe("JO");
  });

  it("returns first and last initial", () => {
    expect(initials("John Doe")).toBe("JD");
  });

  it("ignores middle names", () => {
    expect(initials("John Michael Doe")).toBe("JD");
  });

  it("returns ? for empty string", () => {
    expect(initials("")).toBe("?");
  });

  it("returns ? for whitespace-only", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("formatUptime", () => {
  it('formats days when d > 0', () => {
    expect(formatUptime(90000)).toBe("1d 1h 0m");
  });

  it('formats hours when d === 0 and h > 0', () => {
    expect(formatUptime(4000)).toBe("1h 6m");
  });

  it('formats minutes only', () => {
    expect(formatUptime(120)).toBe("2m");
  });

  it("includes seconds when requested", () => {
    expect(formatUptime(3665, true)).toBe("1h 1m 5s");
  });

  it("shows seconds-only for < 60s", () => {
    expect(formatUptime(45, true)).toBe("45s");
  });

  it("returns 0m for 0 seconds", () => {
    expect(formatUptime(0)).toBe("0m");
  });
});
