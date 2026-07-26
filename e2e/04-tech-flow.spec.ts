import { test, expect } from "@playwright/test";
import { login, readState, writeState, dismissCookieConsent } from "./fixtures";

test.describe("Tech flows — water readings, analysis, report", () => {
  let state: ReturnType<typeof readState>;

  test.beforeEach(async ({ page }) => {
    state = readState();
    if (!state.techEmail || !state.techPassword) {
      test.skip("No tech credentials available");
    }
    await login(page, state.techEmail!, state.techPassword!);
    await dismissCookieConsent(page);
  });

  test("start a scheduled visit from schedule page", async ({ page }) => {
    const poolName = state.poolName;
    if (!poolName) return test.skip("No pool created");

    await page.goto("/schedule", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Start Visit" }).first().click();

    await expect(page).toHaveURL(/\/visits\/[^/]+$/, { timeout: 15000 });
    const visitId = page.url().split("/visits/")[1];
    writeState({ visitId });
  });

  test("enter water readings and view analysis", async ({ page }) => {
    const visitId = state.visitId;
    if (!visitId) return test.skip("No visit started");

    await page.goto(`/visits/${visitId}`);

    await page.getByLabel("pH").fill("7.2");
    await page.getByLabel("Free Chlorine").fill("2");
    await page.getByLabel("Total Alkalinity").fill("90");
    await page.getByLabel("Calcium Hardness").fill("250");
    await page.getByLabel("Cyanuric Acid").fill("40");
    await page.getByLabel("Temperature").fill("80");

    await expect(page.getByText("Water Analysis")).toBeVisible({ timeout: 5000 });
  });

  test("chemical recommendations card is present", async ({ page }) => {
    const visitId = state.visitId;
    if (!visitId) return test.skip("No visit started");

    await page.goto(`/visits/${visitId}`);

    const ph = page.getByLabel("pH");
    const hasValue = await ph
      .inputValue()
      .then((v) => v !== "")
      .catch(() => false);
    if (!hasValue) {
      await ph.fill("7.2");
      await page.getByLabel("Free Chlorine").fill("2");
      await page.getByLabel("Total Alkalinity").fill("90");
      await page.getByLabel("Calcium Hardness").fill("250");
      await page.getByLabel("Cyanuric Acid").fill("40");
      await page.getByLabel("Temperature").fill("80");
    }

    await expect(
      page.getByText("Chemical Recommendations"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("complete visit and view report", async ({ page }) => {
    const visitId = state.visitId;
    if (!visitId) return test.skip("No visit started");

    await page.goto(`/visits/${visitId}`);

    const ph = page.getByLabel("pH");
    const hasValue = await ph
      .inputValue()
      .then((v) => v !== "")
      .catch(() => false);
    if (!hasValue) {
      await ph.fill("7.2");
      await page.getByLabel("Free Chlorine").fill("2");
      await page.getByLabel("Total Alkalinity").fill("90");
      await page.getByLabel("Calcium Hardness").fill("250");
      await page.getByLabel("Cyanuric Acid").fill("40");
      await page.getByLabel("Temperature").fill("80");
    }

    await page
      .getByRole("button", { name: /Complete.*Send Report/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Complete.*Send Report/i }),
    ).not.toBeVisible({ timeout: 15000 });

    await page.goto(`/visits/${visitId}/report`);
    await expect(
      page.getByText(state.poolName!).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("visit appears in company report history", async ({ page }) => {
    const poolName = state.poolName;
    if (!poolName) return test.skip("No pool created");

    await page.goto("/reports", { waitUntil: "networkidle" });
    await expect(
      page.locator("h3").filter({ hasText: poolName }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
