import { test, expect } from "@playwright/test";
import { login, readState, writeState, dismissCookieConsent } from "./fixtures";

test.describe("Owner flows", () => {
  const stamp = `${Date.now()}`;
  const TECH_EMAIL = `qa-tech-${stamp}@example.com`;
  const TECH_PASSWORD = "TestPass123!";
  const TECH_NAME = "QA Tech";

  let state: ReturnType<typeof readState>;

  test.beforeEach(async ({ page }) => {
    state = readState();
    await login(page, state.ownerEmail!, state.ownerPassword!);
    await dismissCookieConsent(page);
  });

  test("create a pool", async ({ page }) => {
    const poolName = state.poolName!;

    await page.goto("/pools", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add Pool" }).click();

    await page.locator("#name").fill(poolName);
    await page.locator("#volume").fill("15000");
    await page.locator("#address").fill("1 QA Test Way");

    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(poolName).first()).toBeVisible({ timeout: 15000 });

    const href = await page
      .getByRole("link", { name: "Analysis" })
      .first()
      .getAttribute("href");
    const poolId = href?.split("/pools/")[1];
    if (!poolId) throw new Error("Could not extract pool id from Analysis link");
    writeState({ poolId });
  });

  test("view pool analysis", async ({ page }) => {
    const poolId = state.poolId;
    if (!poolId) return test.skip("No pool created");

    await page.goto(`/pools/${poolId}`, { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: state.poolName }),
    ).toBeVisible();
  });

  test("add a technician", async ({ page }) => {
    await page.goto("/team", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add User" }).click();

    await page.locator("#create-name").fill(TECH_NAME);
    await page.locator("#create-email").fill(TECH_EMAIL);
    await page.locator("#create-role").selectOption("TECH");
    await page.locator("#create-password").fill(TECH_PASSWORD);

    await page.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText(TECH_NAME)).toBeVisible({ timeout: 15000 });
    writeState({
      techName: TECH_NAME,
      techEmail: TECH_EMAIL,
      techPassword: TECH_PASSWORD,
    });
  });

  test("schedule a visit", async ({ page }) => {
    const poolName = state.poolName;
    if (!poolName) return test.skip("No pool created");
    const today = new Date().toISOString().split("T")[0];

    await page.goto("/schedule", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Schedule a visit" }).click();

    await page.locator("#schedule-pool").selectOption({ label: poolName });
    await page.locator("#schedule-date").fill(today);

    await page.getByRole("button", { name: "Schedule visit" }).click();

    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: "networkidle" });

    await expect(
      page.locator("h3").filter({ hasText: poolName }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("account package page shows trial info", async ({ page }) => {
    await page.goto("/account/package", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Your Plan" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Free Trial" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Company" }),
    ).toBeVisible();
  });

  test("scan page loads without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/scan", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const crashed = await page
      .getByText("Something went wrong")
      .isVisible()
      .catch(() => false);

    if (crashed || errors.length > 0) {
      throw new Error(
        `Scan page crashed: ${errors[0] ?? "error boundary shown"}`,
      );
    }

    await expect(
      page
        .getByPlaceholder("Enter QR code manually")
        .or(page.getByText(/Point the camera/i)),
    ).toBeVisible({ timeout: 5000 });
  });

  test("csv import button visible on pools page", async ({ page }) => {
    await page.goto("/pools", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("button", { name: /import/i }),
    ).toBeVisible({ timeout: 5000 });
  });
});
