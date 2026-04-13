# AdBrief Design System

A premium, accessible design system inspired by UI UX Pro Max, Web Design Guidelines, Emil Kowalski, shadcn/ui, and modern interaction design principles.

## Design Philosophy

**From a tool that analyzes to a tool that executes** — the interface should feel decisive, powerful, and action-first. Every interaction should move the user toward decision execution, not analysis paralysis.

---

## Color Palette

### Core Colors
- **Surface 0**: `#070d1a` (deepest background)
- **Surface 1**: `#0d1117` (primary background)
- **Surface 2**: `#111620` (elevated surface)
- **Surface 3**: `#161c2a` (highest elevation)
- **Accent**: `#0ea5e9` (sky blue, for secondary actions)
- **Red**: `#ef4444` (action/warning/pause)
- **Green**: `#22c55e` (success/positive)
- **Amber**: `#eab308` (info)

### Usage Rules
- **Backgrounds**: Always use Surface palette — never pure black or white
- **Text**: Use Text Primary for headings, Text Secondary for body, Text Muted for labels
- **Accent**: Red for destructive/urgent actions (pause, delete), Green for positive outcomes, Amber for informational states
- **Glows**: All glows use `{color}20` opacity (e.g., `#ef444420` for red glow)

---

## Typography

### Font Families
```
Display Headlines: 'Syne', 'Plus Jakarta Sans', system-ui, sans-serif
  Weight: 700–800 | Letter spacing: -0.02em

Body Text: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
  Weight: 400–600 | Line height: 1.6

Numbers/Mono: 'Space Grotesk', 'DM Mono', monospace
  Weight: 400–700 | Letter spacing: -0.03em | Font variant: tabular-nums
```

### Size Scale
- **Label**: 10px, 600–700 weight, uppercase, letter-spacing: 0.05–0.15em
- **Body**: 13px, 400 weight, line-height: 1.6
- **Caption**: 11px, 500 weight, color: textSecondary
- **Heading 3**: 15px, 700 weight
- **Heading 2**: 17–19px, 700–800 weight
- **Heading 1**: 24–28px, 800 weight
- **Display**: 56–72px, 700–800 weight (Syne font)

### Rules
- Always use `tabular-nums` on numbers for alignment
- Use `letter-spacing: -0.02em` to -0.03em on headlines
- Use `text-transform: uppercase` only on labels (10px)
- Never use more than 2 font families per screen

---

## Spacing & Layout

### Base Unit: 4px

- **Padding**: 8px, 12px, 16px, 20px, 24px, 28px, 32px, 40px
- **Gaps**: 4px, 6px, 8px, 12px, 14px, 16px, 18px, 20px, 24px
- **Margins**: 8px, 12px, 16px, 20px, 24px, 28px, 32px

### Grid & Containers
- **Max width**: 680px (diagnostic page, similar single-column views)
- **Padding**: 24px horizontal, 20px on mobile
- **Column layouts**: Grid with 1fr, 2fr ratios (never equal width unless balanced)

---

## Components

### Card (Elevation Levels)

```typescript
// Level 1: Primary cards, hero panels
{
  background: Surface1,
  border: "1px solid borderSubtle",
  borderRadius: 12,
  boxShadow: "inset 0 1px 0 0 borderTopLight, 0 2px 8px rgba(0,0,0,0.25)"
}

// Level 2: Nested cards, secondary panels
{
  background: Surface2,
  border: "1px solid borderSubtle",
  borderRadius: 12,
  boxShadow: "inset 0 1px 0 0 borderTopLight, 0 2px 8px rgba(0,0,0,0.25)"
}

// Level 3: Tertiary, minimal elevation
{
  background: Surface3,
  border: "1px solid borderSubtle",
  borderRadius: 12,
  boxShadow: "inset 0 1px 0 0 borderTopLight, 0 2px 8px rgba(0,0,0,0.25)"
}
```

**Accent borders**: Add `1.5px solid {color}20` for emphasized cards
**Glow effect**: `radial-gradient(circle, {color}15 0%, transparent 70%)`

### Buttons

#### Primary (Destructive/Urgent)
- **Background**: `linear-gradient(135deg, {color}, darker)`
- **Color**: `#fff`
- **Border**: `1px solid {color}40`
- **Shadow**: `0 0 30px {color}40, 0 8px 24px {color}20, inset 0 1px 0 rgba(255,255,255,0.25)`
- **Hover**: Scale up (transform: translateY(-3px)), increase shadow
- **Padding**: 16px 24px | Border radius: 12px | Font weight: 700

#### Secondary
- **Background**: `linear-gradient(135deg, Surface2 88%, Surface3 88%)`
- **Color**: Text Secondary (hover: Text Primary)
- **Border**: `1.5px solid borderLight`
- **Shadow**: `0 4px 12px rgba(0,0,0,0.2)`
- **Hover**: Lift (translateY(-2px)), brighten border
- **Padding**: 16px 20px | Border radius: 12px | Font weight: 600

#### Icon buttons
- **Padding**: 6px 10px
- **Font size**: 10px–13px
- **Border radius**: 7px–8px
- **Background**: Surface 2 or subtle
- **No shadow** on small buttons

### Tooltips
- **Background**: Surface 3
- **Border**: 1px solid borderLight
- **Padding**: 10px 12px
- **Font size**: 11px
- **Line height**: 1.55
- **Trigger**: Hover or click, auto-dismiss on mouse leave
- **Positioning**: Above/below element, centered

---

## Animations & Interactions

### Timing Functions
- **Standard ease**: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy)
- **Fast transitions**: 0.2s–0.3s
- **Medium transitions**: 0.55s (entry animations)
- **Slow animations**: 0.8s (counting/data loading)

### Keyframe Library
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes countUp {
  from { opacity: 0; filter: blur(6px); }
  to { opacity: 1; filter: blur(0); }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}

@keyframes successPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

### Button Interactions
- **Hover lift**: `transform: translateY(-2px) to translateY(-3px)`
- **Shadow intensification**: Increase glow and shadow on hover
- **Color shifts**: Subtle color adjustment (opacity increase)
- **Disabled state**: opacity: 0.7, cursor: not-allowed

### Accessibility
- **Respect prefers-reduced-motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
  ```
- **Keyboard navigation**: All buttons and links must be focusable (tab index)
- **ARIA labels**: Use aria-live for async updates, aria-label for icon buttons
- **Color contrast**: Minimum WCAG AA (4.5:1 for body text, 3:1 for large text)
- **Hit targets**: Minimum 44px × 44px for touch-friendly interactions

---

## Premium Design Patterns

### Hero Panels
1. **Background glow**: Radial gradient above card, positioned at top center
2. **Accent bar**: 3px gradient bar at the very top (transparent → color → transparent)
3. **Large impact number**: 72px with text-shadow and animation
4. **Breakdown grid**: 2-column layout with colored backgrounds below main metric
5. **Call-to-action**: 2:1 button grid (primary large, secondary small)

### Metric Cards
- **Icon box**: 40px × 40px, border-radius: 10px, subtle background glow
- **Icon size**: 20px
- **Label**: 10px, uppercase, letter-spacing: 0.05em
- **Value**: 13px–20px, monospace, tabular-nums
- **Flow**: Icon + text on left, value on right (flex, space-between)

### Status Cards
- **Success**: Green accent, green text, green icon
- **Warning**: Amber accent, amber text
- **Error**: Red accent, red text
- **Info**: Accent (sky blue) color

### Data Lists
- **Borders between items**: `1px solid borderSubtle`, not bottom only
- **Hover state**: Subtle background lift (`background: {color}08`)
- **Striping**: Not recommended; use spacing instead
- **Density**: Minimum 40px row height for touch targets

---

## Anti-Patterns (Don't Do This)

❌ Pure black (#000) or pure white (#fff) — use Surface/Text palette  
❌ Shadows without proper color (avoid gray shadows) — use rgba(0,0,0,x)  
❌ Animations without easing (linear motion feels robotic)  
❌ Buttons without hover states  
❌ Gloss/skeuomorphism (old-school 3D shading)  
❌ Text over complex images without high contrast  
❌ More than 3 accent colors on one screen  
❌ Animations on every interaction (use sparingly for impact)  
❌ Hardcoded values (use CSS variables)  
❌ Disabled state with low contrast (must still meet AA standards)  

---

## Implementation Checklist

- [ ] All backgrounds use Surface palette (0–3)
- [ ] All text uses Text color palette (Primary, Secondary, Muted)
- [ ] Cards have proper elevation (level 1, 2, or 3)
- [ ] All buttons have hover states with transform + shadow change
- [ ] Numbers use Space Grotesk with tabular-nums
- [ ] Headlines use Syne font with -0.02em letter-spacing
- [ ] Hero panels have background glow, accent bar, and impact number
- [ ] All interactive elements respect prefers-reduced-motion
- [ ] Minimum 44px × 44px hit targets for buttons
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Animations use cubic-bezier easing, not linear
- [ ] Tooltips appear on hover/click with proper positioning
- [ ] Disabled states clearly indicated (opacity + cursor)
- [ ] Loading states show spinner with animation
- [ ] Success states show green check with pop animation

---

## Sources & References

1. **UI UX Pro Max** — 50+ design styles, 161 color palettes, 57 font pairings
   - Reference: https://ui-ux-pro-max-skill.nextlevelbuilder.io/

2. **Web Design Guidelines (Vercel Labs)** — Interaction patterns, accessibility, animation best practices
   - Reference: https://vercel.com/design/guidelines

3. **Emil Kowalski** — Premium minimalist design aesthetic
   - Reference: https://emilkowal.ski/

4. **shadcn/ui** — Component architecture, Tailwind integration
   - Reference: https://ui.shadcn.com/

5. **Impeccable** — Design system principles and patterns
   - Reference: https://impeccable.style/

6. **Modern Interaction Design Principles** — User-centered, forgiving interactions, generous hit targets

7. **WCAG 2.1 Guidelines** — Accessibility, color contrast, keyboard navigation
   - Reference: https://www.w3.org/WAI/WCAG21/quickref/

---

## How to Apply This System

### For new components:
1. Start with the color palette — choose background (Surface X), text (Text X), accent
2. Use the card elevation system (Level 1/2/3)
3. Add a button if it's interactive — use primary or secondary pattern
4. Include hover states — use cubic-bezier timing
5. Test keyboard navigation and color contrast

### For existing components:
1. Audit against the anti-patterns list
2. Update colors to use Surface/Text palette
3. Add missing hover states
4. Ensure animations respect prefers-reduced-motion
5. Check hit targets are ≥ 44px

### For hero panels:
1. Use the exact template: glow + accent bar + large number + breakdown grid + CTA buttons
2. Use red for urgent/destructive actions
3. Use green for positive outcomes
4. Add a premium metric card below (ROAS projection, savings, etc.)

---

**Last updated**: April 13, 2026  
**Version**: 1.0  
**Status**: Active — use for all new development in AdBrief
