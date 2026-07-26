import { test, expect } from "@playwright/test";
import { login, dismissCookieConsent } from "./fixtures";

test.describe("SUPER_ADMIN admin flows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@poolbench.com", "admin-password-456");
    await dismissCookieConsent(page);
  });

  test("admin dashboard loads with platform KPIs", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Notifications" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Admin panel" }),
    ).toBeVisible();
  });

  test("admin companies page loads", async ({ page }) => {
    await page.goto("/admin/companies", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Companies" }).first(),
    ).toBeVisible();
  });

  test("admin packages page loads", async ({ page }) => {
    await page.goto("/admin/packages", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Packages" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Plan Definitions" }),
    ).toBeVisible();
  });

  test("admin diagnostics page loads", async ({ page }) => {
    await page.goto("/admin/diagnostics", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Diagnostics" }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("admin users page loads", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Users" }).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
