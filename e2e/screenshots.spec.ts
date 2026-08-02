import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { test, expect } from "@playwright/test";
import { signup, login, dismissCookieConsent } from "./fixtures";

const SCREENSHOT_DIR = path.join(
  __dirname,
  "..",
  "..",
  "website",
  "public",
  "images",
  "screenshots",
);

function shotPath(name: string) {
  return path.join(SCREENSHOT_DIR, name);
}

// Backfills nine weekly historical COMPLETED visits (trending up to the score
// of `latestVisitId`) so the pool-analysis screenshot shows a real
// score/parameter trend instead of a single data point. Shelled out to a
// separate tsx script (rather than importing PrismaClient here) because
// Playwright's own TS loader can't load the generated Prisma client's ESM
// output — see scripts/seed-screenshot-trend.ts.
function seedHistoricalVisits(latestVisitId: string) {
  execFileSync(
    "npx",
    ["tsx", "scripts/seed-screenshot-trend.ts", latestVisitId],
    { stdio: "inherit", cwd: path.join(__dirname, ".."), shell: true },
  );
}

test.describe("Marketing screenshots", () => {
  test("capture marketing screenshots from a fresh, healthy company", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    const stamp = `${Date.now()}`;
    const companyName = "Sparkle Pool Co";
    const ownerName = "Jordan Rivera";
    const ownerEmail = `shots-owner-${stamp}@example.com`;
    const ownerPassword = "ShotsPass123!";
    const poolName = "Sunset Villa Pool";
    const techName = "Casey Nguyen";
    const techEmail = `shots-tech-${stamp}@example.com`;
    const techPassword = "ShotsPass123!";

    // --- Signup + onboarding ------------------------------------------------
    await page.context().clearCookies();
    await signup(page, companyName, ownerName, ownerEmail, ownerPassword);
    await expect(page).toHaveURL(/\/login\?signup=success/, { timeout: 15000 });

    await login(page, ownerEmail, ownerPassword);
    await dismissCookieConsent(page);

    await page.goto("/onboarding", { waitUntil: "networkidle" });
    await page.getByLabel("Phone").fill("555-0142");
    await page.locator("#address").fill("48 Ocean Breeze Drive");
    await page.getByRole("button", { name: "Save details" }).click();

    await page.getByLabel("Pool name").fill(poolName);
    await page.getByLabel("Volume (gallons)").fill("18000");
    await page.getByLabel("Address (optional)").fill("48 Ocean Breeze Drive");
    await page.getByRole("button", { name: "Add pool" }).click();
    // Wait for the create-pool Server Action to actually resolve before
    // navigating away — otherwise the in-flight request can be cancelled by
    // the goto below, leaving no pool created (flaky "No pools yet" on /pools).
    await expect(page.getByText("Pool created!")).toBeVisible({ timeout: 10000 });

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await dismissCookieConsent(page);

    // --- Add a tech ----------------------------------------------------------
    await page.goto("/team", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add User" }).click();
    await page.locator("#create-name").fill(techName);
    await page.locator("#create-email").fill(techEmail);
    await page.locator("#create-role").selectOption("TECH");
    await page.locator("#create-password").fill(techPassword);
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(techName)).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(4000); // let the "User created" toast auto-dismiss
    await page.screenshot({ path: shotPath("team.png"), fullPage: true });

    // --- Find the pool id ------------------------------------------------------
    await page.goto("/pools", { waitUntil: "networkidle" });
    const analysisHref = await page
      .getByRole("link", { name: "Analysis" })
      .first()
      .getAttribute("href");
    const poolId = analysisHref?.split("/pools/")[1];
    if (!poolId) throw new Error("Could not find pool id");

    // --- Schedule a visit for today --------------------------------------------
    const today = new Date().toISOString().split("T")[0];
    await page.goto("/schedule", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Schedule a visit" }).click();
    await page.locator("#schedule-pool").selectOption({ label: poolName });
    await page.locator("#schedule-date").fill(today);
    await page.getByRole("button", { name: "Schedule visit" }).click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shotPath("schedule.png"), fullPage: true });

    // --- Switch to tech, complete the visit with balanced readings -------------
    await login(page, techEmail, techPassword);
    await dismissCookieConsent(page);

    await page.goto("/schedule", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Start Visit" }).first().click();
    await expect(page).toHaveURL(/\/visits\/[^/]+$/, { timeout: 15000 });
    const visitId = page.url().split("/visits/")[1].split("?")[0];

    await page.getByLabel("pH").fill("7.4");
    await page.getByLabel("Free Chlorine").fill("3");
    await page.getByLabel("Total Alkalinity").fill("100");
    await page.getByLabel("Calcium Hardness").fill("275");
    await page.getByLabel("Cyanuric Acid").fill("45");
    await page.getByLabel("Temperature").fill("82");
    await expect(page.getByText("Water Analysis")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Chemical Recommendations")).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    await page
      .getByRole("button", { name: /Complete.*Send Report/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Complete.*Send Report/i }),
    ).not.toBeVisible({ timeout: 15000 });

    await page.goto(`/visits/${visitId}/report`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    // Viewport-only (not fullPage) so this matches the 1440x900 aspect ratio
    // of the other screenshots — the health score/gauge is what matters most.
    await page.screenshot({ path: shotPath("visit-report.png") });

    // The public report lives at /report/[publicToken] — a separate,
    // auto-generated uuid, not the visit id. Grab it off the "Share Report"
    // button (it copies the link to the clipboard) via a clipboard shim.
    await page.evaluate(() => {
      // @ts-expect-error - test-only shim, no real clipboard needed
      navigator.clipboard.writeText = async (text: string) => {
        (window as unknown as { __copiedText?: string }).__copiedText = text;
      };
    });
    await page.getByRole("button", { name: "Share Report" }).click();
    const reportUrl = await page.evaluate(
      () => (window as unknown as { __copiedText?: string }).__copiedText,
    );
    const reportToken = reportUrl?.split("/report/")[1];
    if (!reportToken) throw new Error("Could not extract public report token");

    // Backfill nine weekly historical visits (trending up to the just-completed
    // one) so the pool-analysis screenshot shows a real score/parameter trend
    // instead of a single data point.
    seedHistoricalVisits(visitId);

    // Pool analysis reflects the just-completed visit's score/trend.
    await page.goto(`/pools/${poolId}`, { waitUntil: "networkidle" });
    // Recharts animates each Line's draw-in over ~1.5s on mount; wait for it
    // to finish or the parameter-trend lines get screenshotted mid-animation
    // (cut off partway across the chart).
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shotPath("pool-analysis.png"), fullPage: true });

    // Owner's dashboard now shows real activity (completed visit, active pool).
    await login(page, ownerEmail, ownerPassword);
    await dismissCookieConsent(page);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: shotPath("dashboard.png"), fullPage: true });

    // --- Public homeowner report (logged out) ----------------------------------
    await page.context().clearCookies();
    await page.goto(`/report/${reportToken}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: shotPath("homeowner-report.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: shotPath("homeowner-report-mobile.png"),
      fullPage: true,
    });
  });
});
