import * as fs from "fs";
import * as path from "path";
import { expect, type Page } from "@playwright/test";

const STATE_PATH = path.join(__dirname, "test-state.json");

export interface TestState {
  companyName: string;
  ownerEmail: string;
  ownerPassword: string;
  poolId: string;
  poolName: string;
  techName: string;
  techEmail: string;
  techPassword: string;
  visitId: string;
}

export function readState(): Partial<TestState> {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export function writeState(updates: Partial<TestState>): void {
  const current = readState();
  const next = { ...current, ...updates };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
}

export function clearState(): void {
  try {
    fs.unlinkSync(STATE_PATH);
  } catch {}
}

export async function login(
  page: Page,
  email: string,
  password: string,
) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export async function signup(
  page: Page,
  companyName: string,
  name: string,
  email: string,
  password: string,
) {
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function dismissCookieConsent(page: Page) {
  await page
    .getByRole("button", { name: "Got it" })
    .click({ timeout: 2000 })
    .catch(() => {});
}
