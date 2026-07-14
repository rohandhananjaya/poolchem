import { test, expect } from "@playwright/test";

test.describe("PoolBench smoke tests", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    const title = await page.title();
    expect(title).toContain("PoolBench");
    await page.screenshot({ path: "e2e/screenshots/landing-page.png", fullPage: true });
  });

  test("login page renders and has form elements", async ({ page }) => {
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/login-page.png", fullPage: true });
  });

  test("dashboard redirects to login (unauthenticated)", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/.*login.*/);
  });

  test("admin redirects to login (unauthenticated)", async ({ page }) => {
    await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/.*login.*/);
  });
});
