# AdBrief.pro — Developer Context

## What is this?
AI-powered Meta Ads copilot. Feed shows financial decisions (KILL/FIX/SCALE), Chat is an AI media buyer. React 18 + Vite + TypeScript + Tailwind frontend on Vercel, Supabase backend (Postgres + Edge Functions in Deno).

## Critical Architecture Facts

### Sidebar: AppLayout is THE sidebar (NOT DashboardSidebar)
- **Production sidebar** → `src/components/layout/AppLayout.tsx` (700+ lines)
- `DashboardSidebar.tsx` exists but is NOT used in production
- `DashboardLayout.tsx` also exists but is NOT used — it was the old layout
- AppLayout renders: persona selector, nav items, CreditBar, and the `<Outlet>` for all `/dashboard/*` routes

### Deployment: Lovable (NOT auto-deploy from GitHub)
- Code is pushed to GitHub (`martinnhoo/frame-iq-mvp`)
- Lovable must **Pull** from GitHub then **Deploy** — it does NOT auto-deploy on push
- After pushing, always tell the user to Pull + Deploy in Lovable

### Database: Personas have data in MULTIPLE places
- `personas.name`, `personas.logo_url`, `personas.website`, `personas.description` — direct columns
- `personas.result` — JSONB with `name`, `website`, `biz_description`, `industry`, `niche`, `preferred_market`
- `personas.brand_kit` — JSONB with `logo_data_url`
- Always read BOTH direct columns AND jsonb fields with fallback: `p.logo_url || p.brand_kit?.logo_data_url`

### Custom Events (inter-component communication)
- `meta-account-changed` — fired when Meta ad account is switched. Listened by `useActiveAccount` hook
- `persona-updated` — fired when persona is created/edited/deleted/logo uploaded. Listened by AppLayout to refresh sidebar
- `meta-oauth-complete` — fired after OAuth callback completes

### Key Hooks
- `useActiveAccount(userId, personaId)` — resolves persona → platform_connections → Meta ad account → v2 ad_accounts row
- `useDesignTokens()` — returns DESIGN_TOKENS (DT) for consistent styling
- `useLanguage()` — i18n context, 7 languages supported

## File Map

### Core Layout
- `src/components/layout/AppLayout.tsx` — THE production sidebar + layout
- `src/App.tsx` — Routes, lazy loading, providers

### Main Pages (the 4 nav items)
- `src/pages/dashboard/FeedPage.tsx` — Money-first decisions feed (KILL/FIX/SCALE)
- `src/pages/dashboard/AdBriefAI.tsx` — AI Chat with 5 inline skills (hooks, script, brief, competitor, persona)
- `src/pages/dashboard/HistoryPage.tsx` — Action history
- `src/pages/dashboard/AccountsPage.tsx` — Persona/account management + Meta OAuth

### Decision Engine
- `supabase/functions/run-decision-engine/` — Generates KILL/FIX/SCALE decisions
- `supabase/functions/execute-action/` — Executes decisions via Meta API
- `supabase/functions/sync-ad-diary/` — Daily ad data sync
- Decisions sorted by `impact_daily` (biggest money loss first)

### Diagnostics
- `/dashboard/debug` — Internal diagnostics page (owner-only, martinhovff@gmail.com)
- `src/components/ErrorBoundary.tsx` — React crash handler, logs to `error_logs` table

## Supabase Edge Functions
79 edge functions in `supabase/functions/`. Key ones:
- `adbrief-ai-chat` — Main AI chat endpoint (Claude Haiku)
- `meta-oauth` — Meta OAuth flow + connection management
- `sync-meta-data` — Pulls ad data from Meta API
- `run-decision-engine` — Generates financial decisions
- `execute-action` — Pause/activate/adjust budget via Meta API
- `check-usage` — Usage limits enforcement
- `daily-intelligence` — Daily cron intelligence
- `check-critical-alerts` — 6-hourly alert check

## Common Patterns

### Styling
All inline styles using `style={{}}`. Design tokens from `DESIGN_TOKENS` (imported as `DT`).
Font: `"'Plus Jakarta Sans', sans-serif"` stored as `const F`.
Dark theme: background `#060709`, text `rgba(255,255,255,0.65)`, accent `#0ea5e9`.

### Supabase Type Workaround
Many tables aren't in generated types. Use `as any` pattern:
```ts
const { data } = await (supabase.from('ad_accounts' as any) as any).select('*').eq('user_id', userId);
```

### i18n Pattern
Each page has its own `T` object with translations per language key:
```ts
const T = { pt: { title: '...' }, en: { title: '...' }, es: { title: '...' } };
const t = T[language as keyof typeof T] || T.en;
```

## Build & Dev
```bash
npm run dev          # Vite dev server
npx tsc --noEmit     # Type check (always run before pushing)
npx vite build       # Production build
```

## Git Workflow
1. Make changes
2. `npx tsc --noEmit` — must pass with zero errors
3. `git add <specific files>` + `git commit`
4. `git push` — if rejected, `git pull --rebase` then retry
5. Tell user to Pull + Deploy in Lovable

## Known Gotchas
- Lovable sometimes auto-commits to the repo — always `git pull --rebase` before pushing
- `personas` table columns vs jsonb fields — always check both
- Edge functions need separate deployment via Supabase CLI or Lovable
- Meta API rate limits — safety layer has daily action caps
- Free tier = 15 credits, everything unlocked (not 3 chats)
