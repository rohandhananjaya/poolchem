---
name: solid-principles
description: PoolChem's SOLID-first architecture — read BEFORE modifying any code file. Every change must follow SRP, OCP, LSP, ISP, and DIP as detailed below. Triggers on: creating or editing any .ts or .tsx file in src/.
---

# SOLID Principles & Scalability Rules

These aren't abstract — they are the only way to keep this app scalable as it grows.

## 1. SRP — One reason to change per module

- `src/lib/pool-chemistry.ts` = pure domain logic (no I/O, no Prisma). Keep it pure.
- Each `src/lib/db/` file owns exactly one entity (`pools.ts`, `visits.ts`, …).
- Server Actions do three things and three things only: re-check auth → call a `db/` helper → `revalidatePath`. Never add business logic here.
- Components render. They do not fetch. Pages fetch and pass data down.

## 2. OCP — Open for extension, closed for modification

- New query → add to the relevant `db/` file — never touch existing functions.
- New Server Action → add beside the page — never modify other actions.
- New component → add in its domain folder — existing components stay unchanged.
- New route → own folder in `src/app` with `page.tsx` + `actions.ts` — zero changes elsewhere.

## 3. LSP — Types must be substitutable

- `WaterReadingInput` mirrors Prisma `WaterReading` fields so a persisted reading passes directly into the chemistry engine.
- `VisitReadings` extends `WaterReadingInput` (minus `temperature`) — any function that accepts a reading accepts either type.
- Server Action return types match what the calling component expects — never change a return shape without updating every consumer.

## 4. ISP — Small, focused interfaces, not god-objects

- Each `db/` function takes exactly the data it needs, not a bloated params object.
- Component props are minimal — pass primitives or small aggregates, never the entire Prisma model.
- Don't create a catch-all "utility" file; put helpers in the module that uses them.

## 5. DIP — Depend on abstractions, not concretions

- `db/` helpers are the **only** code that imports from `@/generated/prisma/client`. Pages, actions, and components import from `@/lib/db/*` — never from Prisma directly.
- `pool-chemistry.ts` imports nothing from Prisma (and never will).
- If you need a new data-access pattern, extend the `db/` layer; do not inline Prisma calls in a page or action.

## Scalability rules (derive from SOLID)

- **The `db/` layer is the single chokepoint** for all data access. If you need caching, observability, or read-replicas later, you add it here — not in 50 places.
- **Keep Server Actions thin.** Every action body should read like: `requireAuth()` → call one `db/` helper → `revalidatePath(path)`. If an action exceeds ~10 lines, extract logic into a `db/` helper or the `reports/` layer.
- **Business logic lives in pure functions** (`pool-chemistry.ts`) or the reports layer (`src/lib/reports/`). Never in a page, action, or component.
- **Tenancy is invariant, not optional.** Every `db/` helper receives `companyId`. Cross-tenant writes throw; reads return `null`. Never bypass this — not for "admin" features, not for "quick" queries.
- **Components are dumb.** They receive props and render. No data fetching, no `useEffect` for data. Client Components may hold UI state (open/closed, input values) but never fetch from the server directly.
- **New domain → new file.** A new entity (e.g., "invoices") gets its own `src/lib/db/invoices.ts`, its own `src/app/(dashboard)/invoices/` route folder, its own `src/components/invoices/` component folder. Never stuff it into an existing file.
