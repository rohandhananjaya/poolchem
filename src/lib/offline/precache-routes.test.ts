import { describe, expect, it } from "vitest";

import { getPrecacheRoutes } from "./precache-routes";

describe("getPrecacheRoutes", () => {
  it("returns the base tenant routes for a TECH", () => {
    const routes = getPrecacheRoutes("TECH");
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/pools");
    expect(routes).not.toContain("/team");
    expect(routes).not.toContain("/admin");
  });

  it("adds owner-only routes for OWNER", () => {
    const routes = getPrecacheRoutes("OWNER");
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/team");
    expect(routes).toContain("/account/api-keys");
    expect(routes).not.toContain("/admin");
  });

  it("returns only the admin route set for SUPER_ADMIN", () => {
    const routes = getPrecacheRoutes("SUPER_ADMIN");
    expect(routes).toContain("/admin");
    expect(routes).toContain("/admin/companies");
    expect(routes).not.toContain("/dashboard");
    expect(routes).not.toContain("/pools");
  });

  it("never contains a dynamic-segment route", () => {
    const allRoutes = [
      ...getPrecacheRoutes("TECH"),
      ...getPrecacheRoutes("OWNER"),
      ...getPrecacheRoutes("SUPER_ADMIN"),
    ];
    for (const route of allRoutes) {
      expect(route).not.toMatch(/\[.+\]/);
    }
  });
});
