# Dashboard Layout & Navigation — Design

**Date:** 2026-07-10

## Goal

Provide the authenticated app shell and navigation for pool-service technicians:
an auth-gated layout, responsive navigation (mobile bottom bar / desktop
sidebar), and a reusable page shell.

## Routing

`/login` already redirects to `/dashboard` after sign-in. Authenticated pages
live under a `(dashboard)` route group (parentheses → not part of the URL) so
they share one layout.

Navigation destinations:

| Item     | Route        | Icon (lucide)  |
| -------- | ------------ | -------------- |
| Home     | `/dashboard` | `House`        |
| Schedule | `/schedule`  | `Calendar`     |
| Reports  | `/reports`   | `FileText`     |
| Profile  | `/profile`   | `User`         |

## Components

### `app/(dashboard)/layout.tsx` (Server Component)
- `getCurrentUser()` (existing, `server-only`, React-cached). If `null` →
  `redirect("/login")` from `next/navigation`.
- `getCompanyById(user.companyId)` for company name + logo.
- Renders `<MainNav user={...} company={...}>` and a `<main>` region.
- Desktop: sidebar occupies a left column; content sits to its right.
- Mobile: content gets bottom padding so the fixed bottom tab bar never
  overlaps it.

### `components/navigation/main-nav.tsx` (`"use client"`)
- Single component renders **both** presentations, switched by Tailwind
  breakpoints only (no JS screen detection, avoids hydration mismatch):
  - `hidden md:flex` left **sidebar**: company logo/name at top, nav links,
    user dropdown pinned at bottom.
  - `md:hidden fixed bottom-0` **bottom tab bar**: 4 icon+label tabs.
- Active state via `usePathname()`: a link is active when the pathname equals
  its href or starts with `href + "/"`.
- User **avatar dropdown** (top-right on desktop; the Profile tab covers mobile)
  with the user's name/email and a **Sign Out** item. Sign-out is client-side
  `supabase.auth.signOut()` then `router.push("/login")` + `router.refresh()`,
  matching the existing login-page pattern.
- Props are plain serializable data (name, email, companyName, logo) — no
  Prisma objects across the server/client boundary.

### `components/ui/shell.tsx` (Server Component)
- Reusable page wrapper: consistent `max-w-*` + responsive padding.
- Optional header: `title` and an optional `backHref` rendering an
  `ArrowLeft` `<Link>` back button.

### Supporting UI primitives (new, shadcn-style)
- `components/ui/avatar.tsx` and `components/ui/dropdown-menu.tsx` wrapping the
  already-installed `radix-ui` package, consistent with the existing `ui/`
  folder and the `cn()` helper.

### Placeholder pages
Minimal `page.tsx` stubs for `/dashboard`, `/schedule`, `/reports`, `/profile`
(each wrapped in `<Shell>`) so navigation is fully clickable and runnable now.
Real content arrives in later tasks.

## Styling
- Mobile-first; dark mode via Tailwind `dark:` classes using the existing
  shadcn design tokens (`sidebar`, `card`, `muted`, `accent`, `border`, …).
- No theme toggle in scope — the spec only requires `dark:` support.

## Non-goals
- Real page content for the four sections.
- Theme switching UI.
- Route protection via middleware/proxy (layout-level auth gate is sufficient
  for this task and matches the existing `getCurrentUser` pattern).
