# Tajmer · Live Ads — Design system

The bar: a world-class product that reads as the same family as
**nordbirkvej.vercel.app**, with the restraint of **newarc.io** and the motion of
**Arc UI (uiarc.dev)**. Dark is default; light must work. No AI-template look —
no gradient blobs, no purple, no glass, no emoji in headings except the one wave
in the greeting.

## Tokens

All colours are CSS variables defined in `client/src/index.css` as `R G B`
triplets, consumed through Tailwind (`bg-page`, `text-ink`, …). The theme toggle
only flips a `.light` / `.dark` class on `<html>`.

| Token        | Dark            | Light           | Use                                   |
| ------------ | --------------- | --------------- | ------------------------------------- |
| `--page`     | `#0e0e0f`       | `#f7f7f8`       | Page background                       |
| `--card`     | `#161618`       | `#ffffff`       | Cards, one step lighter than the page |
| `--card-2`   | `#1c1c1f`       | `#f8f8f9`       | Hover / nested surfaces, inputs       |
| `--hairline` | `rgba(255,255,255,.06)` | `rgba(10,10,15,.08)` | 1px borders — never shadows   |
| `--ink`      | `#ededf0`       | `#18181b`       | Primary text                          |
| `--muted`    | grey            | grey            | Secondary text                        |
| `--faint`    | dim grey        | dim grey        | Tertiary text, icons                  |
| `--accent`   | `#f0a050`       | `#d67e2a`       | The single warm-orange accent         |
| `--success`  | green           | green           | "Good" (results, biggest spender)     |
| `--warning`  | amber           | amber           | Flags (Dublet, Tjek copy)             |

**One accent (orange), one success (green), one warning (amber). Everything else
is greys.**

## Rules

- **Radius:** `16px` cards (`rounded-card`), `14px` tiles/previews (`rounded-tile`),
  pills are `rounded-full`.
- **Borders, not shadows:** every surface is a 1px hairline. No drop shadows, no
  gradients, no glass.
- **Spacing:** 8px grid. Max content width `1500px`, 32px page padding (`md:px-8`),
  20–24px card gaps.
- **Type:** Inter everywhere, generous line-height. Negative letter-spacing on
  large numbers and headings (`tracking-tightest`). **Tabular numerals** for all
  money/metrics (`.tnum`). Money is `da-DK` DKK → `44,14 kr.`
- **Layout:** 240px left sidebar — project badge, uppercase grey section labels
  (`KUNSTNERE`, `VÆRKTØJ`), nav items (active = rounded orange outline), user +
  theme toggle pinned bottom. Collapses to a top bar with scrolling chips on
  mobile.
- **KPI cards:** small grey label, very large tight value (≈38px), one grey helper
  line, tiny `↗` top-right. Orange for the headline number, green for "good".
- **Chips (newarc):** pill-shaped, muted idle, solid-ink when active — used for
  the range toggle and the mobile artist switcher.
- **Ad cards (light-on-dark):** the Meta preview is intentionally a white
  Facebook-feed card so creatives pop against the dark UI. Ad name sits above the
  card as `TYPE | navn`; metrics line and "Åbn i Ads Manager" below.

## Motion (Arc UI)

Implemented in `client/src/components/ui/Button.tsx` and `Chip.tsx`:

- Press scales to **~0.97 on a snappy spring** (`stiffness 520, damping 30`).
- Hover styles only on hover-capable fine pointers (Tailwind `hover:` gating).
- `prefers-reduced-motion` respected — press scale is dropped, transitions near-zero
  (global rule in `index.css`).
- Loading uses `aria-busy` / `aria-disabled`, not the `disabled` attribute, so
  keyboard focus is preserved.
- Variants: `primary` / `secondary` / `ghost` / `danger`. Sizes: `sm` / `md` / `lg`.
