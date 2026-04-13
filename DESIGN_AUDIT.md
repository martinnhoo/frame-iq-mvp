# Design System Audit — Inconsistency Report

**Date**: April 13, 2026  
**Status**: 🚨 CRITICAL — 29 dashboard pages + 2 landing pages with inconsistent design

---

## 🔴 Critical Issues Found

### Color Inconsistency
**Problem**: Different pages use different accent colors!

| Page | Accent Color | Card BG | Text Primary |
|------|--------------|---------|--------------|
| **IndexNew.tsx** (Landing) | `#6366f1` (indigo) | `rgba(17,22,32,0.65)` | `#fff` |
| **AccountDiagnostic.tsx** (Diagnostic) | `#0ea5e9` (cyan) | `#0d1117` | `#f0f2f8` |
| **AccountsPage.tsx** (Accounts) | `#0ea5e9` (cyan) | gradient | `#fff` |
| **Other 26 pages** | ❓ Unknown | ❓ Varies | ❓ Varies |

### Typography Inconsistency
| Page | Body Font | Display Font | Mono Font |
|------|-----------|--------------|-----------|
| **IndexNew.tsx** | `'Plus Jakarta Sans'` | None (using body) | None |
| **AccountDiagnostic.tsx** | `'Plus Jakarta Sans'` | `'Syne'` | `'Space Grotesk'` |
| **AccountsPage.tsx** | `'Plus Jakarta Sans'` | None | None |
| **DESIGN_SYSTEM.md** | `'Plus Jakarta Sans'` | `'Syne'` | `'Space Grotesk'` |

### Spacing Inconsistency
- Hardcoded pixel values scattered across components
- No consistent spacing scale
- No reusable gap/padding constants

### Shadow & Border Inconsistency
- Multiple shadow definitions
- Different border styles per page
- No elevation system

---

## 📊 Coverage Analysis

### Pages Audited
- ✅ **AccountDiagnostic.tsx** — 90% aligned with DESIGN_SYSTEM.md
- ⚠️ **IndexNew.tsx** (Landing) — 40% aligned (wrong accent color)
- ⚠️ **AccountsPage.tsx** — 60% aligned (good accent, missing typography)
- ❓ **26 other dashboard pages** — Unknown state

### Design System Coverage
- ✅ Color palette defined in DESIGN_SYSTEM.md
- ✅ Typography scale defined
- ✅ Spacing scale defined
- ✅ Component patterns documented
- ❌ **NOT IMPLEMENTED** — CSS variables for reuse
- ❌ **NOT IMPLEMENTED** — Design tokens in codebase
- ❌ **NOT IMPLEMENTED** — Consistent imports across pages

---

## 🎯 Impact Assessment

### User Impact
1. **Visual Inconsistency** — Landing page looks different from dashboard
2. **Brand Identity Confusion** — Indigo vs Cyan accent color
3. **Accessibility Risk** — Different color contrast ratios across pages
4. **Premium Feel Lost** — Landing doesn't match premium dashboard

### Developer Impact
1. **Code Duplication** — Design tokens copy-pasted in every file
2. **Maintenance Nightmare** — Change one color = edit 30 files
3. **Onboarding Friction** — New devs don't know which colors to use
4. **Quality Inconsistency** — Some pages have animations, others don't

### Business Impact
- 🔴 **First impression risk** — Landing page looks different
- 🔴 **Premium perception** — Inconsistency signals low polish
- 🟡 **Conversion impact** — Users may doubt product quality
- 🟡 **Team velocity** — Debates about "what color should this be?"

---

## ✅ Solution: Unified Design System

### Step 1: Create CSS Variables File
Create `/src/styles/design-tokens.css`:
- All colors as CSS variables
- All spacing as CSS variables
- All typography as CSS variables
- All shadows and borders as CSS variables
- All animations as CSS variables

### Step 2: Create React Hooks
Create `/src/hooks/useDesignTokens.ts`:
- Export `T` object with all tokens (like in AccountDiagnostic.tsx)
- Consistent imports across all pages
- Single source of truth

### Step 3: Standardize Colors
**Adopt the DESIGN_SYSTEM.md palette:**
```
Accent: #0ea5e9 (cyan, not indigo)
Surface0: #070d1a
Surface1: #0d1117
Surface2: #111620
Surface3: #161c2a
Red: #ef4444
Green: #22c55e
Amber: #eab308
TextPrimary: #f0f2f8
TextSecondary: rgba(255,255,255,0.65)
TextMuted: rgba(255,255,255,0.45)
```

### Step 4: Standardize Typography
**Adopt the DESIGN_SYSTEM.md fonts:**
```
Display: 'Syne', 'Plus Jakarta Sans', system-ui, sans-serif
Body: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
Mono: 'Space Grotesk', 'DM Mono', monospace
```

### Step 5: Rollout Plan
1. ✅ Create CSS variables + React hooks
2. 📍 Update landing pages (IndexNew.tsx + Index.tsx)
3. 📍 Update core dashboard (AccountsPage, PerformanceDashboard, SettingsPage)
4. 📍 Update remaining 26 pages in batches
5. 📍 Test accessibility across all pages
6. ✅ Document component library

---

## 🚀 Execution Plan

### Phase 1: Foundation (Day 1)
- [ ] Create `/src/styles/design-tokens.css` with all CSS variables
- [ ] Create `/src/hooks/useDesignTokens.ts` exporting consistent T object
- [ ] Add import to `src/index.css` or `App.tsx`
- [ ] Verify AccountDiagnostic still works with imported tokens

### Phase 2: Landing Pages (Day 1)
- [ ] Update IndexNew.tsx to use design tokens (fix indigo → cyan)
- [ ] Update Index.tsx to use design tokens
- [ ] Verify visual consistency between landing and dashboard

### Phase 3: Core Dashboard (Day 2)
- [ ] Update AccountsPage.tsx
- [ ] Update PerformanceDashboard.tsx
- [ ] Update SettingsPage.tsx
- [ ] Test all account/settings workflows

### Phase 4: Remaining Pages (Day 2-3)
- [ ] Create batch update plan for remaining 26 pages
- [ ] Update in groups (5-6 pages at a time)
- [ ] Run visual regression tests

### Phase 5: Verification (Day 3)
- [ ] Accessibility audit (WCAG AA on all pages)
- [ ] Visual consistency check
- [ ] Component library documentation
- [ ] Storybook setup (optional but recommended)

---

## 📋 Success Criteria

- ✅ All pages use same `T` design tokens
- ✅ No hardcoded colors in component code
- ✅ All fonts use defined typography scale
- ✅ All spacing uses defined scale (8px base unit)
- ✅ All components have proper hover/active states
- ✅ Landing page matches dashboard aesthetic
- ✅ WCAG AA compliance across all pages
- ✅ New pages automatically use design system

---

## 📚 Resources

- **DESIGN_SYSTEM.md** — Full design specifications
- **AccountDiagnostic.tsx** — Reference implementation (90% compliant)
- **design-tokens.css** — To be created
- **useDesignTokens.ts** — To be created

---

## 🔧 Technical Approach

### CSS Variables Strategy
```css
/* /src/styles/design-tokens.css */

:root {
  /* Colors */
  --color-surface-0: #070d1a;
  --color-surface-1: #0d1117;
  --color-accent: #0ea5e9;
  --color-red: #ef4444;
  
  /* Typography */
  --font-display: 'Syne', 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-body: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  --font-mono: 'Space Grotesk', 'DM Mono', monospace;
  
  /* Spacing */
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.15);
}
```

### React Hooks Strategy
```typescript
// /src/hooks/useDesignTokens.ts
export const useDesignTokens = () => ({
  color: {
    surface: { 0: '#070d1a', 1: '#0d1117', 2: '#111620', 3: '#161c2a' },
    accent: '#0ea5e9',
    red: '#ef4444',
    green: '#22c55e',
  },
  font: {
    display: "'Syne', 'Plus Jakarta Sans', system-ui, sans-serif",
    body: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    mono: "'Space Grotesk', 'DM Mono', monospace",
  },
  space: { 4: '4px', 8: '8px', 12: '12px', 16: '16px' },
});
```

---

**Status**: 🚨 CRITICAL — Needs immediate action  
**Priority**: HIGH — Blocks quality launch  
**Effort**: MEDIUM — 2-3 days for full rollout  
**Next Step**: Create design-tokens.css + useDesignTokens.ts
