import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";

import { useOnlineStatus } from "./use-online-status";

let originalOnLine: PropertyDescriptor | undefined;

function setNavigatorOnline(online: boolean) {
  originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

function restoreNavigatorOnline() {
  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete (navigator as { onLine?: boolean }).onLine;
  }
  originalOnLine = undefined;
}

afterEach(() => {
  cleanup();
  restoreNavigatorOnline();
  vi.restoreAllMocks();
});

describe("useOnlineStatus", () => {
  it("is hydrated and online after mount when navigator is online", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.hydrated).toBe(true);
    expect(result.current.online).toBe(true);
  });

  it("reflects an offline navigator after mount (not the optimistic snapshot)", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.hydrated).toBe(true);
    expect(result.current.online).toBe(false);
  });

  it("flips to false on the offline window event", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.online).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("flips back to true on the online window event", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.online).toBe(true);
  });

  it("removes window listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
