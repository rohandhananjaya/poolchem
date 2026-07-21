import * as fs from "fs";
import * as path from "path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Walks a brand-new trial account through every feature listed on
 * /account/package (FEATURE_LABELS in src/lib/package-features.ts). Runs as
 * ONE test with independent try/catch'd steps so a single broken feature
 * doesn't hide the results for the rest. Findings are written to
 * e2e/trial-feature-results.json for a follow-up step to turn into a
 * human-readable report.
 */

const stamp = `${Date.now()}`;
const COMPANY_NAME = `QA Pool Co ${stamp}`;
const OWNER_NAME = "QA Owner";
const EMAIL = `qa-owner-${stamp}@example.com`;
const PASSWORD = "TestPass123!";
const TECH_NAME = "QA Tech";
const TECH_EMAIL = `qa-tech-${stamp}@example.com`;
const TECH_PASSWORD = "TestPass123!";
const POOL_NAME = `QA Pool ${stamp}`;

interface Finding {
  feature: string;
  status: "pass" | "fail" | "info";
  detail: string;
  screenshot?: string;
}

const findings: Finding[] = [];
const pageErrors: string[] = [];

async function shot(page: Page, name: string): Promise<string> {
  const rel = `e2e/screenshots/trial-check/${name}.png`;
  await page.screenshot({ path: rel, fullPage: true }).catch(() => {});
  return rel;
}

async function record(page: Page, feature: string, fn: () => Promise<void>) {
  await test.step(feature, async () => {
    const errorsBefore = pageErrors.length;
    try {
      await fn();
      const screenshot = await shot(page, feature.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
      const newErrors = pageErrors.slice(errorsBefore);
      findings.push({
        feature,
        status: "pass",
        detail: newErrors.length ? `OK, but a page error fired during this step: ${newErrors[0]}` : "OK",
        screenshot,
      });
    } catch (err) {
      const screenshot = await shot(page, `FAILED-${feature.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
      const newErrors = pageErrors.slice(errorsBefore);
      const msg = err instanceof Error
        // eslint-disable-next-line no-control-regex
        ? err.message.replace(/\x1b\[[0-9;]*m/g, "").split("\n").slice(0, 6).join(" | ")
        : String(err);
      findings.push({
        feature,
        status: "fail",
        detail: newErrors.length ? `${msg} | page error: ${newErrors[0]}` : msg,
        screenshot,
      });
    }
  });
}

test("Trial account walks every listed package feature", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (err) => pageErrors.push(err.message));

  let poolId = "";
  let visitId = "";

  await record(page, "Signup (create trial company)", async () => {
    await page.goto("/signup", { waitUntil: "networkidle" });
    await page.getByLabel("Company name").fill(COMPANY_NAME);
    await page.getByLabel("Your name").fill(OWNER_NAME);
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login\?signup=success/, { timeout: 15000 });
  });

  await record(page, "Login with new trial account", async () => {
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  // The cookie-consent banner is `fixed bottom-0 z-50` and stays up until
  // dismissed — it can overlap bottom-anchored primary buttons (e.g. Complete
  // & Send Report on a long visit form). Dismiss it once, like a real user
  // would, so the rest of the walkthrough isn't blocked by it. Whether a new
  // trial user notices and dismisses it before it blocks a click is itself
  // one of the findings.
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 5000 }).catch(() => {});

  await record(page, "Account-package page shows unlocked trial", async () => {
    await page.goto("/account/package", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Free Trial" })).toBeVisible();
    await expect(
      page.getByText(/All features are unlocked during your trial/i),
    ).toBeVisible();
  });

  await record(page, "max_pools - create a pool", async () => {
    await page.goto("/pools", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add Pool" }).click();
    await page.getByLabel("Pool name").fill(POOL_NAME);
    await page.getByLabel("Volume (gallons)").fill("15000");
    await page.getByLabel("Address").fill("1 QA Test Way");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(POOL_NAME)).toBeVisible({ timeout: 10000 });

    const poolCard = page.locator('[role="button"]', { hasText: POOL_NAME });
    await poolCard.getByRole("link", { name: "Analysis" }).click();
    await expect(page).toHaveURL(/\/pools\/[^/]+$/);
    poolId = page.url().split("/pools/")[1];
    if (!poolId) throw new Error("Could not extract pool id from URL");
  });

  await record(page, "multi_tech - add a technician from Team", async () => {
    await page.goto("/team", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByLabel("Name").fill(TECH_NAME);
    await page.getByLabel("Email").fill(TECH_EMAIL);
    await page.locator("#create-role").selectOption("TECH");
    await page.getByLabel("Password").fill(TECH_PASSWORD);
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(TECH_NAME)).toBeVisible({ timeout: 10000 });
  });

  await record(page, "scheduling - schedule a visit", async () => {
    await page.goto("/schedule", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Schedule a visit" }).click();
    await page.locator("#schedule-pool").selectOption({ label: POOL_NAME });
    const today = new Date().toISOString().split("T")[0];
    await page.locator("#schedule-date").fill(today);
    await page.getByRole("button", { name: "Schedule visit" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(POOL_NAME)).toBeVisible({ timeout: 10000 });
  });

  await record(page, "qr_code - scan page loads without crashing", async () => {
    const errorsBefore = pageErrors.length;
    await page.goto("/scan", { waitUntil: "networkidle" });
    // Give the camera lifecycle effect time to settle into scanning /
    // denied / no-camera, or to crash.
    await page.waitForTimeout(4000);
    const crashed = await page.getByText("Something went wrong").isVisible().catch(() => false);
    const newErrors = pageErrors.slice(errorsBefore);
    if (crashed || newErrors.length > 0) {
      throw new Error(
        `Scan page hit an error boundary or threw an uncaught error: ${newErrors[0] ?? "error boundary shown"}`,
      );
    }
    await expect(
      page.getByPlaceholder("Enter QR code manually").or(page.getByText(/Point the camera/i)),
    ).toBeVisible({ timeout: 10000 });
  });

  await record(page, "Start a scheduled visit (via Schedule page)", async () => {
    await page.goto("/schedule", { waitUntil: "networkidle" });
    const visitCard = page.locator('[class*="cursor-pointer"]', { hasText: POOL_NAME }).first();
    await visitCard.getByRole("button", { name: /Start Visit/i }).click();
    await expect(page).toHaveURL(/\/visits\/[^/]+$/, { timeout: 15000 });
    visitId = page.url().split("/visits/")[1];
    if (!visitId) throw new Error("Could not extract visit id from URL");
  });

  await record(page, "health_scoring - water analysis renders from readings", async () => {
    if (!visitId) throw new Error("No visit id available (previous step failed)");
    await page.getByLabel("pH").fill("7.2");
    await page.getByLabel("Free Chlorine").fill("2");
    await page.getByLabel("Total Alkalinity").fill("90");
    await page.getByLabel("Calcium Hardness").fill("250");
    await page.getByLabel("Cyanuric Acid").fill("40");
    await page.getByLabel("Temperature").fill("80");
    await expect(page.getByText("Water Analysis")).toBeVisible();
  });

  await record(page, "chemical_recs - recommendations card present", async () => {
    await expect(page.getByText("Chemical Recommendations")).toBeVisible();
  });

  await record(page, "service_reports - complete visit and view report", async () => {
    if (!visitId) throw new Error("No visit id available (previous step failed)");
    await page.getByRole("button", { name: /Complete.*Send Report/i }).click();
    await expect(page).toHaveURL(/\/visits\/[^/]+$/, { timeout: 15000 });
    await page.goto(`/visits/${visitId}/report`, { waitUntil: "networkidle" });
    await expect(page.getByText(POOL_NAME)).toBeVisible({ timeout: 10000 });
  });

  await record(page, "reports - visit appears in company report history", async () => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    await expect(page.getByText(POOL_NAME)).toBeVisible({ timeout: 10000 });
  });

  await record(page, "custom_branding - logo/branding control exists on Profile", async () => {
    await page.goto("/profile", { waitUntil: "networkidle" });
    const logoControl = page
      .getByLabel(/logo/i)
      .or(page.getByRole("button", { name: /logo|branding|upload/i }));
    const count = await logoControl.count();
    if (count === 0) {
      throw new Error("No logo/branding upload control found on the Profile/Company page");
    }
  });

  await record(page, "csv_import - import control exists on Pools", async () => {
    await page.goto("/pools", { waitUntil: "networkidle" });
    const importControl = page
      .getByRole("button", { name: /import/i })
      .or(page.getByText(/csv/i));
    const count = await importControl.count();
    if (count === 0) {
      throw new Error("No CSV import control found on the Pools page");
    }
  });

  await record(page, "api_access - documented API surface exists", async () => {
    const resp = await page.request.get("/api", { failOnStatusCode: false }).catch(() => null);
    if (!resp || resp.status() === 404) {
      throw new Error("No /api route found; api_access has no discoverable surface to test");
    }
  });

  const outDir = path.join(process.cwd(), "e2e");
  fs.writeFileSync(
    path.join(outDir, "trial-feature-results.json"),
    JSON.stringify(
      { company: COMPANY_NAME, email: EMAIL, poolId, visitId, findings, pageErrors },
      null,
      2,
    ),
  );

  console.log("\n=== FEATURE CHECK RESULTS ===");
  for (const f of findings) {
    console.log(`${f.status.toUpperCase().padEnd(5)} ${f.feature} — ${f.detail}`);
  }
});
