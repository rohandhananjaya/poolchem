---
name: verify
description: Poolbench-specific build/launch/drive/screenshot recipe using the project's existing Playwright e2e harness. Read before running, testing, or driving the app end-to-end.
---

# Verifying Poolbench end-to-end

Poolbench is driven with **Playwright directly** — `chromium-cli` is not
installed in this environment, but this project already ships its own
e2e harness (`e2e/fixtures.ts`, `e2e/global-setup.ts` /
`global-teardown.ts`, `e2e/01-smoke.spec.ts`), so there's no need to
build a separate driver. The dev server is **HTTPS-only**
(`next dev --experimental-https`, self-signed cert) — every health
check and fetch needs to account for that.

## Launch

```bash
npm run db:seed                    # resets Package pricing/features + PlatformSettings to baseline
(npm run dev > /tmp/dev-server.log 2>&1 & echo $! > /tmp/dev-server.pid)
sleep 8
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:3000/login   # sanity check — note -k, server is HTTPS-only
```

Always track the PID in a file and stop **only that PID** (plus whatever else is bound to :3000) when done:

```bash
PID=$(cat /tmp/dev-server.pid)
powershell -Command "Stop-Process -Id $PID -Force -ErrorAction SilentlyContinue"
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }"
```

**Never `taskkill /F /IM node.exe /T`** — it kills every Node process on the machine, including unrelated tools.

## Drive it (agent path)

Playwright is already set up (`npx playwright test --config=playwright.config.ts`), chromium only, `baseURL: https://localhost:3000`, `ignoreHTTPSErrors: true`. Every invocation runs `e2e/global-setup.ts` (re-seeds the DB, health-checks the server) and `e2e/global-teardown.ts` (deletes stray Supabase test users) automatically — you don't need to seed/check manually if you're going through `playwright test`.

- **Proof-of-life:** `npx playwright test --config=playwright.config.ts e2e/01-smoke.spec.ts` — landing page, login form, unauthenticated redirects, `/setup` redirect, 404 handling. 5 tests, ~12s, passes against a freshly seeded DB.
- **Building blocks:** `e2e/fixtures.ts` exports `login(page, email, password)`, `signup(page, companyName, name, email, password)`, `dismissCookieConsent(page)`. Use these instead of hand-rolling a login flow (see Gotchas).
- **A real interaction + screenshot:** write a throwaway spec under `e2e/`, e.g.:

  ```ts
  import { test } from "@playwright/test";
  import { login } from "./fixtures";

  test("admin dashboard screenshot", async ({ page }) => {
    await login(page, "admin@poolbench.com", "admin-password-456");
    await page.screenshot({ path: "e2e/screenshots/driver-check.png", fullPage: true });
  });
  ```

  Run it with `npx playwright test --config=playwright.config.ts e2e/<name>.spec.ts`, inspect the PNG, then delete the spec + `e2e/screenshots/*` + `test-results/` — this repo has no e2e specs meant to persist across sessions unless the user asks for them.

  Seeded login: `admin@poolbench.com` / `admin-password-456` (SUPER_ADMIN) → lands on `/dashboard`, a platform-overview screen (company/user/pool/visit counts, live CPU/memory server-health widgets) — confirmed by running the above.

- **Deeper flows:** `e2e/screenshots.spec.ts` is a full signup → onboarding → add pool → add tech → schedule visit → complete visit → public homeowner-report walkthrough. It writes marketing screenshots into `../website/public/images/screenshots/` — a **sibling repo**, not part of this one. It'll fail with `ENOENT` unless that `website` checkout exists alongside `app/`. Only run it if you know that path is present.

## Drive it (human path)

`npm run dev`, open `https://localhost:3000` in a browser, accept the self-signed-cert warning once. Ctrl-C to stop. Useless for a headless agent — no browser to click through.

## Gotchas discovered

- **`chromium-cli` isn't installed here.** Use `npx playwright test` — the project's own harness (fixtures + global setup/teardown) already covers what a custom driver would.
- **Dev server is HTTPS-only.** A plain `http://localhost:3000` request doesn't get refused or redirected — it hangs and then fails with `net::ERR_EMPTY_RESPONSE`. Always use `https://` (`-k` for curl, `NODE_TLS_REJECT_UNAUTHORIZED=0` for a raw Node `fetch`; Playwright already has `ignoreHTTPSErrors: true` in the config).
- **`e2e/smoke-test.spec.ts` is stale and broken** — it hardcodes `http://localhost:3000` against this HTTPS-only server, so all 4 of its tests fail with `net::ERR_EMPTY_RESPONSE`. Use `e2e/01-smoke.spec.ts` instead (relative paths through the configured HTTPS `baseURL`; actually passes).
- **Don't hand-roll a login wait.** `page.goto("/login")` → fill → click "Sign in" → `page.waitForLoadState("networkidle")` can resolve while the button still reads "Signing in..." and the page hasn't navigated yet — same class of race as the fire-and-forget-form issue below, but on the login form itself. Use `fixtures.ts`'s `login()`, which correctly waits on `toHaveURL(/\/dashboard/)`.
- **`/login` and `/signup` redirect an already-authenticated session straight to `/dashboard`.** Any test helper that logs in a second user mid-test must `page.context().clearCookies()` first, or the goto("/login") just bounces.
- **`/account/package` redirects SUPER_ADMIN to `/dashboard`** (no `companyId` → no company package). Don't check tenant-facing pricing/plan state while logged in as the platform admin — log in as a real company user.
- **Fire-and-forget Server Action forms** (plain `<form action={fn}>`, no `useActionState`) don't give the client a promise to await. `page.waitForLoadState("networkidle")` immediately after `.click()` can resolve *before* the POST even starts, so a following `page.reload()` races the mutation. Use `Promise.all([page.waitForResponse(...), locator.click()])` instead when you need the mutation to have landed before reloading.
- **sonner toasts stack** — after N rapid submissions there are N `"Pool created."` (etc.) nodes in the DOM. Use `.last()`, not a bare `getByText(...)`.
- **`PayNowDialog`'s "Done" button calls `router.refresh()`** while closing the dialog — clicking it right after the payment succeeds can race Playwright's actionability retry and time out. The DB mutation is already committed by the time the "Payment successful!" screen renders, so just navigate away directly instead of clicking Done.
- Occasional full-page **"Something went wrong" crashes with a `Primitive.button failed to slot onto its children` console error** showed up once on a long-lived dev server that had survived many hot edits across many files. Restarting the dev server made it disappear and it didn't reproduce again — treat as Turbopack Fast Refresh staleness, not a real bug, and restart the server before trusting a crash like this.
- **`global-teardown.ts`'s screenshot cleanup didn't actually delete `e2e/screenshots/`** in this environment, despite printing no error (it wraps the `fs.rmSync` in a swallowed try/catch). Don't rely on it — delete `e2e/screenshots/*` yourself after a driver run.
- Every full test run creates real rows (companies via signup, pool records, etc.) in the local SQLite dev DB — clean up test-created companies (and re-run `npm run db:seed`) after a verification session so leftover state doesn't pollute the next one.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `net::ERR_EMPTY_RESPONSE` hitting `localhost:3000` | You used `http://` against the HTTPS-only dev server. Switch to `https://` with `-k`/`ignoreHTTPSErrors`. |
| `e2e/smoke-test.spec.ts` fails on every test | It's stale (see Gotchas) — run `e2e/01-smoke.spec.ts` instead. |
| Login spec times out waiting for `/dashboard` | Confirm the DB was seeded (`npm run db:seed`) — `npx playwright test` does this automatically via `global-setup.ts`, but a hand-run script against a stale/empty DB won't find the seeded user. |
