import { test, expect } from "@playwright/test";
import {
  signup,
  login,
  dismissCookieConsent,
  writeState,
} from "./fixtures";

test.describe("Signup & Onboarding", () => {
  const stamp = `${Date.now()}`;
  const COMPANY_NAME = `QA Pool Co ${stamp}`;
  const OWNER_NAME = "QA Owner";
  const EMAIL = `qa-owner-${stamp}@example.com`;
  const PASSWORD = "TestPass123!";
  const POOL_NAME = `QA Pool ${stamp}`;

  test("signup creates company and owner, then onboarding completes setup", async ({ page }) => {
    test.setTimeout(90_000);

    await page.context().clearCookies();

    await signup(page, COMPANY_NAME, OWNER_NAME, EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/login\?signup=success/, { timeout: 15000 });

    writeState({
      companyName: COMPANY_NAME,
      ownerEmail: EMAIL,
      ownerPassword: PASSWORD,
      poolName: POOL_NAME,
    });

    await login(page, EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    dismissCookieConsent(page);

    await page.goto("/onboarding", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Welcome to Poolbench/ }),
    ).toBeVisible();

    await page.getByLabel("Phone").fill("555-0100");
    await page.locator("#address").fill("123 Pool St");
    await page.getByRole("button", { name: "Save details" }).click();

    await page.getByLabel("Pool name").fill(POOL_NAME);
    await page.getByLabel("Volume (gallons)").fill("15000");
    await page.getByLabel("Address (optional)").fill("1 QA Test Way");
    await page.getByRole("button", { name: "Add pool" }).click();

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    await expect(page.getByText(COMPANY_NAME).first()).toBeVisible({ timeout: 5000 });
  });
});
