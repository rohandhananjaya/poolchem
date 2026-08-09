/**
 * Role-scoped list of static-shape dashboard routes to warm into the SW's
 * runtime cache right after login, so an offline navigation to a page the
 * tech hasn't actually visited yet still resolves from cache instead of
 * hitting the SW's navigation fallback.
 *
 * Deliberately excludes any route with a dynamic id segment
 * (`pools/[poolId]`, `visits/[visitId]`, `admin/companies/[companyId]`) —
 * those have their own dedicated read caches (`pool-cache.ts`,
 * `visit-cache.ts`) fed by per-page cache mirrors instead.
 *
 * Pure, no I/O — the caller supplies the role and does the actual fetching.
 */

import type { UserRole } from "@/generated/prisma/client";

const TENANT_ROUTES = [
  "/dashboard",
  "/pools",
  "/schedule",
  "/reports",
  "/settings",
  "/feedback",
  "/scan",
  "/account/package",
] as const;

const OWNER_ONLY_ROUTES = ["/team", "/account/api-keys"] as const;

const SUPER_ADMIN_ROUTES = [
  "/admin",
  "/admin/companies",
  "/admin/users",
  "/admin/diagnostics",
  "/admin/packages",
  "/admin/feedback",
] as const;

export function getPrecacheRoutes(role: UserRole): string[] {
  if (role === "SUPER_ADMIN") return [...SUPER_ADMIN_ROUTES];
  if (role === "OWNER") return [...TENANT_ROUTES, ...OWNER_ONLY_ROUTES];
  return [...TENANT_ROUTES];
}
