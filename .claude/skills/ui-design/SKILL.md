---
name: ui-design
description: PoolChem's UI design system — the canonical rules for building or editing any UI in this app. Read this BEFORE writing a page, component, card, list item, dialog, badge, gauge, stat tile, empty/loading/error state, nav, or before choosing any color, spacing, radius, or typography. Covers Tailwind v4 tokens, the Shell/CardRow layout idioms, the shadcn radix-nova primitives, and the water-brand + score-band color contract that lives OUTSIDE the token layer. Triggers on: build/style a page or component, add a card/badge/dialog/gauge/skeleton, dashboard UI, pick chart or status colors, spacing/typography/dark-mode questions in PoolChem.
---

# PoolChem UI Design System

PoolChem is a mobile-first, multi-tenant pool-service SaaS. Techs use it one-handed, outdoors, in glare; owners view it on desktop. The visual system is **neutral grayscale chrome** (shadcn `radix-nova`, OKLCH tokens) with **teal "water" brand accents** and a **4-band water-health color scale** applied as raw Tailwind utilities. Match the existing idioms below exactly — this app has a consistent look and every new surface should be indistinguishable from what's already there.

Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 (CSS-first, **no `tailwind.config`**) · shadcn style `radix-nova`, base color `neutral`, icons `lucide-react` ([components.json](../../../components.json)).

## Golden rules (do these every time)

1. **Compose classes with `cn()`** from [@/lib/utils](../../../src/lib/utils.ts) so a `className` prop can always override. Every component takes `className` and merges it last.
2. **Use semantic tokens, never raw grays.** `bg-card` / `text-card-foreground` / `bg-muted` / `text-muted-foreground` / `text-foreground` / `border-border` / `bg-primary` / `text-primary-foreground` / `focus-visible:ring-ring/50`. This gives automatic dark mode. The **only** exceptions are the brand/status colors in [The color contract](#the-color-contract) — those are deliberately raw utilities.
3. **Every dashboard page wraps in `<Shell>`.** It owns max-width and padding. Don't set your own page container.
4. **Numeric data is `font-mono tabular-nums`** (pH, LSI, doses, scores, counts, gallons) so digits align. JetBrains Mono is reserved for exactly this — never for prose.
5. **Mobile-first.** Single column by default; expand at `sm:`/`md:`. Protect long text with `truncate` + `min-w-0`; keep controls `shrink-0`. Tap targets ≥ `min-h-14` (56px) on the mobile nav.
6. **Icons are lucide-react only,** sized with `size-*` (`size-3.5` inline metadata, `size-4` standard, `size-5` nav, `size-8` empty/error badges). Inside `<Button>` icons auto-size to `size-4`.

## Foundations — tokens ([src/app/globals.css](../../../src/app/globals.css))

Tailwind v4 CSS-first config. Class-based dark mode: `@custom-variant dark (&:is(.dark *))` — a `.dark` ancestor toggles it, **not** `prefers-color-scheme`.

- **Palette is OKLCH neutral grayscale** (chroma 0). Background is a light gray `oklch(0.96 0 0)`, cards are pure white `oklch(1 0 0)`, primary is near-black. `--destructive` (red) is the **only** chromatic semantic token. Full light + dark blocks are defined; consume via `bg-*`/`text-*` utilities, never hardcode oklch.
- **Radius** derives from one base `--radius: 0.625rem`: `--radius-sm/md/lg/xl/2xl/…`. In practice: `rounded-xl` for cards/tiles/inputs-containers, `rounded-lg` for buttons/inputs/icon-buttons, `rounded-full` for badges/avatars/FAB.
- **Fonts:** `--font-sans` = Inter (also `--font-heading`), `--font-mono` = JetBrains Mono (numeric data only). Set in [src/app/layout.tsx](../../../src/app/layout.tsx) via `next/font`.
- **Fluid type scale:** `text-xs … text-4xl` are redefined with `clamp()` so they scale mobile→desktop automatically — no per-breakpoint text overrides needed. Base never drops below 16px (accessibility floor).
- **Body weight bumps to `500` under 768px** (glare legibility) and desktop body is 18px/1.6. Headings get `line-height: 1.2`. A print block resets to white paper and preserves score colors — hide app chrome with `print:hidden` at the component level.
- **Sidebar has its own token namespace:** `bg-sidebar`, `border-sidebar-border`, `bg-sidebar-accent`, `text-sidebar-foreground`, `ring-sidebar-ring`. Use these for nav chrome, not the main tokens.

## Layout & spacing

**`Shell`** ([src/components/ui/shell.tsx](../../../src/components/ui/shell.tsx)) is the page frame — the single source of truth for width and padding:

```tsx
<div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
```

Pass `title` to render the page `<h1 className="text-2xl font-semibold tracking-tight text-foreground">`, and optional `backHref`/`backLabel` for an `ArrowLeft` back button. There is **no separate `PageHeader`** — either use `Shell`'s `title`, or render your own `<header className="mb-6 flex items-...">` when you need right-aligned actions (see the dashboard home).

**Canonical page skeleton:**

```tsx
<Shell title="Schedule">
  <div className="space-y-3">
    {/* controls / form */}
    <div className="rounded-xl border border-border bg-card p-4">{/* filters */}</div>
    <hr className="border-border" />
    <section>
      <h2 className="mb-3 text-sm font-medium text-foreground">{group.title}</h2>
      <div className="space-y-3">{/* list items */}</div>
    </section>
  </div>
</Shell>
```

**Spacing rhythm** (3/4 step): `space-y-3` for lists/stacks, `gap-2`/`gap-3`/`gap-4` in rows, `mt-6`/`mt-8` between major sections, `mb-3`/`mb-6` under headings.

**Heading scale:** page `h1` = `text-2xl font-semibold tracking-tight`; section `h2` = `text-base font-semibold` (dashboard) or `text-sm font-medium` (schedule buckets); micro-labels `text-xs uppercase tracking-wider`.

**Shell offsets for the nav:** the dashboard `<main>` uses `pb-20 md:pb-0 md:pl-64 print:pb-0 print:pl-0` to clear the fixed bottom-bar (mobile) / sidebar (desktop).

## Component idioms

Reuse these primitives before writing new ones. Quote the class strings verbatim when you can't use the component.

- **Button** — [src/components/ui/button.tsx](../../../src/components/ui/button.tsx). cva with variants `default | outline | secondary | ghost | destructive | link` and sizes `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`. Supports `asChild` (wrap a `next/link`). Focus ring is built in (`focus-visible:ring-3 focus-visible:ring-ring/50`). `destructive` is a tinted `bg-destructive/10 text-destructive`, not solid red.
- **Card / CardRow** — the dominant list-item wrapper ([src/components/ui/card-row.tsx](../../../src/components/ui/card-row.tsx)):
  ```tsx
  "flex items-center gap-4 rounded-xl border border-border bg-card p-4"  // + hover:bg-muted transition-colors when interactive
  ```
  `CardRow` gives you a `min-w-0 flex-1` content region and a trailing `shrink-0` `actions` slot (e.g. a dropdown). `Card` ([card.tsx](../../../src/components/ui/card.tsx)) uses `ring-1` instead of a border. Cards rely on border/ring, not shadow.
- **Stat tile** — [src/components/dashboard/StatsRow.tsx](../../../src/components/dashboard/StatsRow.tsx): `rounded-xl border border-border bg-card p-4`, label `text-xs font-medium text-muted-foreground`, value `font-mono text-2xl font-bold tabular-nums text-card-foreground`, grid `grid grid-cols-1 gap-3 sm:grid-cols-3`.
- **Badge (no component — inline span).** There is no `badge.tsx`; badges are ad-hoc: `shrink-0 rounded-full px-2 py-0.5 text-xs font-medium` (health badges add `font-mono font-semibold tabular-nums`). Empty variant: `bg-muted text-muted-foreground`. Status chips are `inline-flex items-center gap-1.5 text-sm font-medium` + a colored lucide icon.
- **Empty / Error state** — identical dashed-panel template ([EmptyState.tsx](../../../src/components/dashboard/EmptyState.tsx), [error-state.tsx](../../../src/components/ui/error-state.tsx)):
  ```tsx
  "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
  // round icon badge: "flex size-16 items-center justify-center rounded-full ..." (empty = bg-muted text-muted-foreground; error = bg-destructive/10 text-destructive), icon size-8
  // title: "mt-4 text-sm font-medium text-foreground"; desc: "mt-1 text-sm text-muted-foreground"
  ```
  `ErrorState` adds `role="alert"` and an optional `onRetry` button. Prefer these components over re-rolling the markup.
- **Loading** — [loading-skeleton.tsx](../../../src/components/ui/loading-skeleton.tsx). Base `Skeleton` = `animate-pulse rounded-md bg-muted`, plus presets (`CardSkeleton`, `CardListSkeleton`, `StatsSkeleton`, `TableSkeleton`, `FormSkeleton`) that **mirror the real component's wrapper classes**. A route's `loading.tsx` should render the matching skeleton.
- **Gauge / charts** — [WaterHealthGauge.tsx](../../../src/components/visits/WaterHealthGauge.tsx) is a hand-rolled SVG radial gauge (no chart lib): rotated `svg`, two `<circle>`s (track `stroke-muted`, progress via `strokeDasharray`/`strokeDashoffset` + `transition-all duration-500`), center readout `font-mono text-3xl font-bold tabular-nums`. Recharts is used only for trends ([ScoreSparkline.tsx](../../../src/components/reports/ScoreSparkline.tsx)) and **reads CSS vars at runtime** (`var(--color-border)`, `var(--color-muted-foreground)`) — except the brand line, a fixed teal `#0d9488`.
- **Dialogs & toasts** — shadcn `Dialog` (`DialogHeader/Title/Description` + `DialogFooter` with `gap-2 sm:justify-between`), controlled `open`, reset-on-close. Toasts via `sonner` (`toast.success` / `toast.error`). Server-action buttons use `useTransition` to show a pending label ("Cancelling…") and disable while pending.
- **Nav shell / FAB** — [main-nav.tsx](../../../src/components/navigation/main-nav.tsx) renders two mutually exclusive navs: desktop `fixed … w-64 … bg-sidebar … md:flex print:hidden`; mobile bottom tab bar `fixed inset-x-0 bottom-0 … md:hidden`, each tab `min-h-14`, with `pb-[env(safe-area-inset-bottom)]` for iOS. Active = `bg-sidebar-accent …` (sidebar) / `text-primary` (mobile). Nav items carry `roles?: UserRole[]` for RBAC. The FAB ([ScanFab.tsx](../../../src/components/dashboard/ScanFab.tsx)) is `fixed right-4 bottom-24 … size-14 rounded-full bg-primary text-primary-foreground shadow-lg md:right-8 md:bottom-8`, rendered as a sibling of `Shell`.

## The color contract

**These are NOT tokens** — they're raw Tailwind palette utilities, duplicated across files with no shared helper. When adding UI, reuse the exact thresholds and class strings below so everything stays consistent. (Don't invent new hues or shades.)

**Brand accent = teal / sky / cyan (the "water" identity).** Primary CTAs use `bg-teal-600 hover:bg-teal-700`. Marketing ([src/app/page.tsx](../../../src/app/page.tsx)) leans sky; the public homeowner dashboard ([src/app/pool/[poolToken]/page.tsx](../../../src/app/pool/%5BpoolToken%5D/page.tsx)) uses teal/cyan/sky gradients. The recharts brand line is `#0d9488` (teal-600).

**Water-health score bands** — source of truth is `getWaterHealthScore` in [src/lib/pool-chemistry.ts](../../../src/lib/pool-chemistry.ts) (`EXCELLENT | GOOD | FAIR | POOR`):

| Score | Status | Color |
|---|---|---|
| ≥ 90 | EXCELLENT | `emerald` |
| ≥ 75 | GOOD | `lime` |
| ≥ 50 | FAIR | `amber` |
| else | POOR | `red` |

- **Badge:** `bg-<c>-100 text-<c>-700 dark:bg-<c>-950 dark:text-<c>-300`
- **Gauge arc:** `stroke-<c>-500`
- **Status label text:** `text-<c>-600 dark:text-<c>-400`
- **Trend delta** (ScoreSparkline): up = emerald, down = rose, flat = muted.

**Admin / log severity:** red = error, amber = warn, blue = info, green = healthy — same `bg-<c>-50 text-<c>-700 border-<c>-200 dark:…` pattern.

> If you find yourself re-typing the score→color mapping, that's the known duplication — copy the exact thresholds above rather than approximating.

## Data flow (so your UI slots in correctly)

Pages are **async Server Components**: authenticate with `requireTech()` (redirect non-company users to `/admin`), fetch via `@/lib/db/*` helpers (batch with `Promise.all`), then pass **plain data as props** to mostly-client feature components under `@/components/<domain>/`. Mutations are **Server Actions** in a sibling `actions.ts` that re-check auth, call a `db/` helper, then `revalidatePath`. There is no REST/GraphQL layer. Keep this split: fetch in the page, render in the component.

## Before you ship

- Re-check every color against [The color contract](#the-color-contract) — no invented hues, and status colors use the exact band thresholds.
- Confirm dark mode works (you get it free from tokens; verify any raw utility has a `dark:` variant).
- Numeric values are `font-mono tabular-nums`; long text is `truncate`+`min-w-0`.
- The page is wrapped in `Shell`; spacing follows the `space-y-3` / `mt-8` rhythm.
