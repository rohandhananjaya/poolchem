---
name: verify
description: Poolbench-specific build/launch/drive recipe for runtime verification. Read before driving the app end-to-end.
---

# Verifying Poolbench end-to-end

## Launch

```bash
npm run db:seed                    # resets Package pricing/features + PlatformSettings to baseline
(npm run dev > /tmp/dev-server.log 2>&1 & echo $! > /tmp/dev-server.pid)
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # sanity check
```

Always track the PID in a file and stop **only that PID** (plus whatever else is bound to :3000) when done:

```bash
PID=$(cat /tmp/dev-server.pid)
powershell -Command "Stop-Process -Id $PID -Force -ErrorAction SilentlyContinue"
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }"
```

**Never `taskkill /F /IM node.exe /T`** — it kills every Node process on the machine, including unrelated tools.

## Drive it

Playwright is already set up (`npx playwright test --config=playwright.config.ts`), chromium only, `baseURL: http://localhost:3000`. Write a throwaway spec under `e2e/`, run it, then delete the spec + `e2e/screenshots/*` + `test-results/` when done — this repo has no e2e specs meant to persist across sessions unless the user asks for them.

Seeded login: `admin@poolbench.com` / `admin-password-456` (SUPER_ADMIN).

## Gotchas discovered

- **`/login` and `/signup` redirect an already-authenticated session straight to `/dashboard`.** Any test helper that logs in a second user mid-test must `page.context().clearCookies()` first, or the goto("/login") just bounces.
- **`/account/package` redirects SUPER_ADMIN to `/dashboard`** (no `companyId` → no company package). Don't check tenant-facing pricing/plan state while logged in as the platform admin — log in as a real company user.
- **Fire-and-forget Server Action forms** (plain `<form action={fn}>`, no `useActionState`) don't give the client a promise to await. `page.waitForLoadState("networkidle")` immediately after `.click()` can resolve *before* the POST even starts, so a following `page.reload()` races the mutation. Use `Promise.all([page.waitForResponse(...), locator.click()])` instead when you need the mutation to have landed before reloading.
- **sonner toasts stack** — after N rapid submissions there are N `"Pool created."` (etc.) nodes in the DOM. Use `.last()`, not a bare `getByText(...)`.
- **`PayNowDialog`'s "Done" button calls `router.refresh()`** while closing the dialog — clicking it right after the payment succeeds can race Playwright's actionability retry and time out. The DB mutation is already committed by the time the "Payment successful!" screen renders, so just navigate away directly instead of clicking Done.
- Occasional full-page **"Something went wrong" crashes with a `Primitive.button failed to slot onto its children` console error** showed up once on a long-lived dev server that had survived many hot edits across many files. Restarting the dev server made it disappear and it didn't reproduce again — treat as Turbopack Fast Refresh staleness, not a real bug, and restart the server before trusting a crash like this.
- Every full test run creates real rows (companies via signup, pool records, etc.) in the local SQLite dev DB — clean up test-created companies (and re-run `npm run db:seed`) after a verification session so leftover state doesn't pollute the next one.
