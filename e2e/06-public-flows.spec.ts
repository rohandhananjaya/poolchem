import { test, expect } from "@playwright/test";
import { readState } from "./fixtures";

test.describe("Public and API flows", () => {
  test("/api/public/packages returns valid JSON", async ({ request }) => {
    const resp = await request.get("/api/public/packages");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("packages");
    expect(Array.isArray(body.packages)).toBe(true);
  });

  test("homeowner dashboard at /pool/[token] loads", async ({ page }) => {
    const poolId = readState().poolId;
    if (!poolId) test.skip("No pool created yet");

    await page.context().clearCookies();

    const resp = await page.goto(`/pool/${poolId}`, {
      waitUntil: "networkidle",
    });
    expect(resp?.status()).toBeLessThan(500);
  });

  test("shareable report at /report/[token] loads", async ({ page }) => {
    const visitId = readState().visitId;
    if (!visitId) test.skip("No completed visit yet");

    await page.context().clearCookies();

    const resp = await page.goto(`/report/${visitId}`, {
      waitUntil: "networkidle",
    });
    expect(resp?.status()).toBeLessThan(500);
  });
});
