# lite-hotmart — Design System

## North Star

> **The platform is the library, not the books.**

Lite-hotmart's own brand must feel quietly authoritative — like a great independent bookstore — and then *recede* on creator storefronts so each creator's identity drives the look. Editorial minimalism, not empty-card minimalism. Warm paper, ink-black serifs, and one signature accent used like a wax seal.

Two modes, one system:

- **Studio & marketing** — lite-hotmart's voice. Editorial. Heavy serif display, sharp grotesque body, off-white paper, burnt-orange accent ("Ember") used sparingly.
- **Public storefront** — creator's voice. Same typographic + spatial system, accent handed to `Creator.accentColor`. The platform's Ember disappears.

## Typography

| Role | Family | Usage |
|---|---|---|
| Display serif | **Fraunces** (variable) | Hero, large headlines, creator names. Optical sizing on for >40px. |
| UI body | **Schibsted Grotesk** | All UI text, buttons, descriptions. Replaces Inter everywhere. |
| Mono / metadata | **JetBrains Mono** | Prices, durations, counts, timestamps. |

Scale (rem, 16px root):

| Token | Size | Line-height | Use |
|---|---|---|---|
| `text-display` | 4.5rem / 72px | 0.95 | Marketing hero |
| `text-h1` | 3rem / 48px | 1.05 | Page H1 |
| `text-h2` | 2.25rem / 36px | 1.1 | Section H2 |
| `text-h3` | 1.5rem / 24px | 1.2 | Card titles |
| `text-body` | 1rem / 16px | 1.55 | Default |
| `text-small` | 0.875rem / 14px | 1.45 | Secondary |
| `text-eyebrow` | 0.75rem / 12px | 1.2 | Tracked 0.18em, uppercase |
| `text-mono-sm` | 0.75rem / 12px | 1.2 | Chips, metadata |

## Color (platform — "Mode A")

```
Ink         #0F0E0C   /* dominant text, mark, headlines */
Paper       #F6F2EA   /* page background, warm */
Stone       #E9E2D4   /* surface, dividers */
Bone        #D4CCBE   /* hairline borders */
Lichen      #6F6A60   /* muted text */
Char        #2A2823   /* dark surface */

Ember       #D14422   /* THE accent — wax seal */
Moss        #3F5E33   /* success */
Rust        #8B3A20   /* danger */
```

The Ember is rare. It appears on:
- The brand wordmark
- The primary CTA on the marketing landing
- The "Live" status pill in the studio
- Nowhere else on storefronts (creators get their own accent)

## Spacing

8px grid. Tokens used:

- `space-1` = 4
- `space-2` = 8
- `space-3` = 12
- `space-4` = 16
- `space-6` = 24
- `space-8` = 32
- `space-12` = 48
- `space-16` = 64
- `space-24` = 96
- `space-32` = 128

Containers: `max-w-section` = 1180px, `max-w-prose` = 680px. Studio content uses `max-w-section`; marketing uses asymmetric layouts (no central container — see hero).

## Radius

Two opinions, no rounded-md soup:

- `radius-xs` = 4px (chips, mono badges)
- `radius-sm` = 8px (inline inputs, small surfaces)
- `radius-lg` = 14px (cards, modals)
- `radius-xl` = 24px (hero panels)
- Pills = full

## Shadows

Editorial shadows are subtle and warm — never the standard `shadow-lg` gradient.

```
--shadow-sheet:   0 1px 0 rgba(15,14,12,0.04), 0 10px 24px -12px rgba(15,14,12,0.10);
--shadow-lifted:  0 20px 40px -20px rgba(15,14,12,0.20), 0 2px 0 rgba(15,14,12,0.04);
--shadow-inset:   inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(15,14,12,0.06);
```

## Borders

Hairline borders use `Bone` (not zinc). Cards use a 1px hairline + the shadow-sheet. Avoid `border-zinc-200` entirely.

## Motion

| Token | Curve | Use |
|---|---|---|
| `ease-editorial` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default; "swung gate" feel |
| `ease-snap` | `cubic-bezier(0.2, 0.9, 0.3, 1)` | Buttons, hovers |
| `ease-page` | `cubic-bezier(0.65, 0, 0.35, 1)` | Page-load reveals |

Durations: `fast` 160ms · `base` 240ms · `slow` 480ms · `epic` 800ms (only for hero choreography).

Hero reveals: paragraphs `clip-path: inset(100% 0 0 0)` → `inset(0)` over 800ms with 80ms stagger. Body text never animates after first paint.

## Atmosphere

Two recurring visual signatures across both modes:

1. **Paper grain** — a 1.2% noise overlay on Paper/Stone surfaces (`background-image: url(/grain.png)` with `mix-blend-mode: multiply`).
2. **Editorial rules** — 1px hairline rules drawn at the *baseline* of section headers, the full content width. They evoke print layout and signal hierarchy without resorting to oversized headers.

## Component primitives

| Component | Anatomy | Notes |
|---|---|---|
| `Button` | display serif italic for "primary editorial" variant, grotesque for "system" | 3 variants: `editorial` (cta), `system` (utility), `quiet` (link-like) |
| `Card` | Bone hairline + shadow-sheet + paper-grain on background | No `rounded-md` — only `radius-lg` |
| `Chip` | Mono small + Bone border + Stone fill | Used for tags, durations, prices |
| `Modal` | Paper background + max-w 480 + scale-in via `ease-editorial` | Always announces with display serif title |
| `Input` | Underline-only on focus (Ember underline 2px) | No bordered box. Hairline divider below the label. |

## Accessibility floor

- Min contrast 4.5:1 against Paper for Lichen text
- All `Ember` CTAs have visible focus rings (`outline: 2px Ember, offset 4px`)
- Reduced-motion: kills hero choreography, keeps state changes
- Touch targets ≥ 44px

## Anti-patterns (things we deliberately avoid)

- ❌ Pure white backgrounds (`#fff`) — use Paper instead
- ❌ Inter, Roboto, SF, system-ui — Schibsted Grotesk handles UI
- ❌ Purple/blue gradients — Ember is the only accent on platform surfaces
- ❌ `rounded-md` / `rounded-2xl` for everything — pick from the radius scale
- ❌ Drop shadows that look like cards floating — use shadow-sheet/lifted
- ❌ Emoji icons inline with body text — use Lucide or none
- ❌ Generic empty states ("No items yet") — every empty state has a creator-aware sentence and a single CTA

## Rollout plan

| Pass | Scope | Status |
|---|---|---|
| **P1** | Tokens, fonts, marketing landing, paywall modal | THIS commit |
| P2 | Storefront — landing, practice, class/series detail | next |
| P3 | Studio — overview, classes/series/courses, forms | next |
| P4 | Motion library, micro-interactions, photography style guide | next |
