---
name: auth-tenancy
description: PoolBench's auth flow (Supabase + Prisma bridge) and multi-tenancy invariant. Read BEFORE editing auth, proxy, or any data-access code. Triggers on: editing src/lib/auth.ts, src/proxy.ts, src/lib/supabase/, any src/lib/db/*.ts file, or src/app/*/actions.ts.
---

# Auth & Multi-tenancy

## Multi-tenancy (the central invariant)

Every record belongs to a `Company` (the tenant). **Nothing is queried without scoping to a `companyId`.**

- `Company → User → ServiceVisit`, and `Company → Pool → ServiceVisit`.
- A `ServiceVisit` has **no `companyId` of its own** — it is scoped through its pool (`visit.pool.companyId`). All visit queries in `src/lib/db/visits.ts` filter on `pool: { companyId }`, so a visit can never leak across tenants.
- Get the tenant with `getCompanyId()` / `requireAuth()` from `src/lib/auth.ts` and pass it into the `db/` helpers.
- Read helpers return `null` on a cross-tenant miss; write helpers throw.
- **Never bypass tenancy** — not for "admin" features, not for "quick" queries.

## Auth: Supabase for identity, Prisma `User` for app data

Two identity layers linked **by email**:

- **Supabase Auth** owns sessions/credentials (password + Google OAuth).
  - Client: `src/lib/supabase/client.ts` (browser)
  - Server: `src/lib/supabase/server.ts` (server, `await createClient()` — `cookies()` is async)
- **Prisma `User`** table carries `companyId`, `role`, `name`, etc.
- **Bridge:** `getCurrentUser()` in `src/lib/auth.ts`: `supabase.auth.getUser()` → `prisma.user.findUnique({ where: { email } })`. Wrapped in React `cache` so it hits the DB once per request.

### Key auth helpers (`src/lib/auth.ts`)

| Function | Returns | Throws |
|---|---|---|
| `getCurrentUser()` | `User \| null` | — |
| `requireAuth()` | `User` | `AuthError` |
| `requireRole(allowedRoles)` | `User` | `UnauthorizedError` |
| `requireOwner()` | `User` | `UnauthorizedError` |
| `requireTech()` | `User` | `UnauthorizedError` |
| `requireSuperAdmin()` | `User` | `UnauthorizedError` |
| `requireCompanyAccess(companyId)` | `User` | `UnauthorizedError` |
| `getCompanyId()` | `string \| null` | `AuthError` |

## Proxy (`src/proxy.ts` — NOT `middleware.ts`)

In Next.js 16, Middleware was renamed to **Proxy**. It lives in `src/proxy.ts`, exports `proxy(request)` with `config.matcher`.

Two jobs:
1. Refresh the Supabase session on every request (write rotated tokens back to response cookies).
2. Guard routes: `/dashboard/*` and `/admin/*` require a session; logged-in users are bounced off `/login`.

**Do not create `middleware.ts`.** Keep proxy config in `src/proxy.ts`.

## Data flow

Server Components / Server Actions → `db/` helpers → Prisma. There is **no REST/GraphQL API layer**. Mutations are Server Actions (e.g. `src/app/(dashboard)/visits/[visitId]/actions.ts`), which re-check auth, call a `db/` helper, then `revalidatePath`. Keep the `import "server-only"` guard on `db/`, `auth.ts`, and the chemistry types.
