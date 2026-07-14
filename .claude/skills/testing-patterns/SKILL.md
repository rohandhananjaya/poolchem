---
name: testing-patterns
description: PoolBench's test setup, patterns, and conventions. Read BEFORE writing tests. Covers vitest config, mocking, and the patterns used across DB, action, component, and pure-function tests. Triggers on: editing or creating any *.test.ts or *.test.tsx file in src/.
---

# Testing Patterns

## Setup

- **Framework:** Vitest with `happy-dom` environment (configured in `vitest.config.ts`).
- **Path alias:** `@/*` → `src/*`, `server-only` → `src/test/__mocks__/server-only.ts` (stubbed to avoid `import "server-only"` errors in tests).
- **Setup file:** `src/test/setup.ts` (run before every test file).
- **Coverage:** v8 provider, includes `src/**/*.ts` and `src/**/*.tsx`, excludes generated/, test files, and test helpers.

## Running tests

```bash
npm test                         # vitest run (one-shot)
npm run test:watch               # vitest watch mode
npx vitest run src/lib/pool-chemistry.test.ts   # single file
npx vitest run -t "reports a balanced pool"     # single test by name
```

## Test categories & patterns

### Pure function tests (e.g. `pool-chemistry.test.ts`)
- Simplest pattern: no mocking needed. Import the function, call with test inputs, assert outputs.
- 36 tests covering LSI, health score, chemical recommendations, ideal ranges.

### DB helper tests (e.g. `src/lib/db/*.test.ts`)
- Mock `@/lib/prisma` — stub `prisma` methods with `mockResolvedValue`/`mockRejectedValue`.
- Tests must stub `server-only` (handled by the vitest config alias).
- 60 tests across 7 files (visits, pools, users, company, reports, schedule, dashboard).

### Server Action tests (e.g. `src/app/*/actions.test.ts`)
- Mock `requireAuth()` / `getCurrentUser()` from `@/lib/auth` to return a fake user.
- Mock the `db/` helper the action calls.
- Assert the action returns the expected shape and calls `revalidatePath` (if applicable).

### Component tests (e.g. `src/components/*/*.test.tsx`)
- Render with `@testing-library/react`.
- Use `happy-dom` environment (no jsdom needed).
- Mock `next/navigation` hooks if needed (`useRouter`, `useParams`).

## Test inventory (191 tests across 22 files)

| Domain | File | Tests |
|---|---|---|
| Chemistry engine | `src/lib/pool-chemistry.test.ts` | 36 |
| Auth | `src/lib/auth.test.ts` | 16 |
| Errors | `src/lib/errors.test.ts` | 11 |
| DB: visits | `src/lib/db/visits.test.ts` | 17 |
| DB: pools | `src/lib/db/pools.test.ts` | 16 |
| DB: users | `src/lib/db/users.test.ts` | 11 |
| DB: company | `src/lib/db/company.test.ts` | 9 |
| DB: reports | `src/lib/db/reports.test.ts` | 3 |
| DB: schedule | `src/lib/db/schedule.test.ts` | 2 |
| DB: dashboard | `src/lib/db/dashboard.test.ts` | 2 |
| Reports | `src/lib/reports/generate-report.test.ts` | 5 |
| Actions: pools | `src/app/(dashboard)/pools/actions.test.ts` | 8 |
| Actions: profile | `src/app/(dashboard)/profile/actions.test.ts` | 10 |
| Actions: scan | `src/app/(dashboard)/scan/actions.test.ts` | 5 |
| Actions: schedule | `src/app/(dashboard)/schedule/actions.test.ts` | 4 |
| Actions: visits | `src/app/(dashboard)/visits/[visitId]/actions.test.ts` | 4 |
| Components: error-state | `src/components/ui/error-state.test.tsx` | 6 |
| Components: loading-skeleton | `src/components/ui/loading-skeleton.test.tsx` | 8 |
| Components: EmptyState | `src/components/dashboard/EmptyState.test.tsx` | 1 |
| Components: WaterHealthGauge | `src/components/visits/WaterHealthGauge.test.tsx` | 7 |
| Components: ChemicalRecommendations | `src/components/visits/ChemicalRecommendations.test.tsx` | 5 |
| Components: WaterReadingInput | `src/components/visits/WaterReadingInput.test.tsx` | 5 |
