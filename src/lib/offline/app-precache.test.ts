import { describe, expect, it, vi } from "vitest";

import { precacheRoutes } from "./app-precache";

function fakeFetch(failing: Set<string> = new Set()): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const route = String(input);
    const ok = !failing.has(route);
    return { ok } as Response;
  }) as unknown as typeof fetch;
}

describe("precacheRoutes", () => {
  it("fetches each route twice (document + RSC shape) and reports success", async () => {
    const fetchImpl = fakeFetch();
    const summary = await precacheRoutes(["/dashboard", "/pools"], undefined, fetchImpl);

    expect(summary).toEqual({ total: 2, failedRoutes: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl).toHaveBeenCalledWith("/dashboard");
    expect(fetchImpl).toHaveBeenCalledWith("/dashboard", { headers: { RSC: "1" } });
  });

  it("reports a route as failed when either fetch shape fails", async () => {
    const fetchImpl = fakeFetch(new Set(["/pools"]));
    const summary = await precacheRoutes(["/dashboard", "/pools"], undefined, fetchImpl);

    expect(summary.failedRoutes).toEqual(["/pools"]);
  });

  it("treats a thrown fetch (offline) as a failed route instead of throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const summary = await precacheRoutes(["/dashboard"], undefined, fetchImpl);

    expect(summary.failedRoutes).toEqual(["/dashboard"]);
  });

  it("reports incremental progress as each route completes", async () => {
    const fetchImpl = fakeFetch();
    const progressCalls: number[] = [];

    await precacheRoutes(["/dashboard", "/pools", "/schedule"], (progress) => {
      progressCalls.push(progress.completed);
    }, fetchImpl);

    expect(progressCalls).toEqual([1, 2, 3]);
  });
});
