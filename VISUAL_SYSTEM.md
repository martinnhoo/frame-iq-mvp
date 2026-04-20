# AdBrief Visual System — Unification Plan

## Current State

Design tokens exist at `src/styles/design-tokens.css` but most components use hardcoded inline values. This document defines the canonical visual language.

## Canonical Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#0ea5e9` | Primary action, focus, links |
| `--color-surface-0` | `#070d1a` | Deepest BG (layout) |
| `--color-surface-1` | `#0d1117` | Primary BG |
| `--color-surface-2` | `#111620` | Elevated cards |
| `--color-surface-3` | `#161c2a` | Highest elevation |
| `--color-text-primary` | `#f0f2f8` | Headings |
| `--color-text-secondary` | `rgba(255,255,255,0.65)` | Body text |
| `--color-text-muted` | `rgba(255,255,255,0.45)` | Labels, hints |
| `--color-border-subtle` | `rgba(255,255,255,0.04)` | Minimal |
| `--color-border-light` | `rgba(255,255,255,0.08)` | Standard |

### Typography
- **Display/Logo**: `Syne` 800
- **Body**: `Plus Jakarta Sans` — all UI text
- **Mono/Metrics**: `DM Mono` — KPI numbers, tabular data

### Button Rules
1. **Primary**: solid `#0ea5e9` bg, `#fff` text
2. **Secondary**: `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.55)` text
3. **Ghost**: transparent bg, `rgba(255,255,255,0.45)` text, visible on hover
4. **NEVER**: gray bg + gray text (low contrast)

### Card Pattern
- Background: `rgba(255,255,255,0.025)` or `var(--color-surface-2)`
- Border: `1px solid rgba(255,255,255,0.07)`
- Radius: `14px` (cards), `8px` (small elements), `99px` (pills)
- No heavy box-shadow — use subtle `0 1px 0 rgba(255,255,255,0.04)` inset

### Animation Rules
- All page elements appear together (no stagger delays)
- Single page-level `fadeUp 0.25s ease` on mount
- Hover transitions: `0.15s ease`
- No animation on individual list items

### AI Voice
- Portuguese: Direct, confident, uses "você". No filler words.
- Pattern: Observation → Insight → Action suggestion
- Numbers always with context ("+12% vs semana passada")
- Never invent metrics

## Migration Priority
1. ✅ Buttons contrast (done)
2. ✅ Progressive rendering (done)
3. Migrate remaining hardcoded colors to CSS vars (gradual)
4. Standardize card patterns across pages
5. Unify font usage (remove `DM Sans` references, use `Plus Jakarta Sans`)
