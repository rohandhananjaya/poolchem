/**
 * Client-side mirror of the active tenant's company id.
 *
 * The `/offline` page and offline banner are rendered by the service worker
 * (offline) or as a public route (online) — neither can call `requireTech()`.
 * The app instead stashes the company id the dashboard layout already resolved
 * into `localStorage` under `COMPANY_ID_KEY`; `/offline` reads it back to scope
 * mutation-queue stats to the right tenant.
 *
 * All functions are no-ops outside the browser (server render / SW import),
 * so this module is safe to import from anywhere.
 */
export const COMPANY_ID_KEY = "poolbench:companyId";

export function getCachedCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(COMPANY_ID_KEY);
}

export function setCachedCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPANY_ID_KEY, companyId);
}

export function clearCachedCompanyId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COMPANY_ID_KEY);
}
