import { test, expect } from "@playwright/test";

test.describe("Poolbench smoke tests", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/Poolbench/);
  });

  test("login page renders form elements", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin/companies", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/);
  });

  test("setup redirects to login when SUPER_ADMIN exists", async ({ page }) => {
    await page.goto("/setup", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/);
  });

  test("404 page for unknown routes", async ({ page }) => {
    const resp = await page.goto("/this-route-does-not-exist", {
      waitUntil: "networkidle",
    });
    expect(resp?.status()).toBe(404);
  });
});
