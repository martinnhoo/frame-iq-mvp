# AdBrief.pro — Developer Context & Design Bible

## MISSION: Ship this SaaS to paying customers.

Every change must bring us closer to launch. No generic UI. No shortcuts. Premium quality only.

---

## What is this?
AI-powered Meta Ads intelligence platform. Connects to Meta Ads accounts, acts as a senior media buyer — analyzes performance, generates creatives, provides strategic recommendations.

**Tech Stack**: React 18 + Vite + TypeScript + Tailwind + shadcn/ui (Vercel) · Supabase (Postgres + 40+ Edge Functions in Deno) · Claude Haiku 4.5 (AI engine) · Stripe (payments) · Meta Ads API v21.0

**GitHub**: `martinnhoo/frame-iq-mvp` (main branch, Vercel auto-deploys)

---

## ⛔ DESIGN SYSTEM — MANDATORY

### BEFORE ANY UI WORK: Read the actual page code first. Copy the existing style.

### Design Tokens (every dashboard page uses these)
```typescript
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

const T = {
  bg0: '#080B11',        // page background (deepest)
  bg1: '#0D1117',        // card surface (lifted)
  bg2: '#161B22',        // elevated / hover
  bg3: '#1C2128',        // active / pressed

  border0: 'rgba(240,246,252,0.04)',  // barely visible
  border1: 'rgba(240,246,252,0.07)',  // default card border
  border2: 'rgba(240,246,252,0.12)',  // emphasized

  text1: '#F0F6FC',                     // primary (headings)
  text2: 'rgba(240,246,252,0.72)',      // secondary (body)
  text3: 'rgba(240,246,252,0.48)',      // tertiary (captions)

  blue: '#0ea5e9',         // CTAs, links
  blueHover: '#0c8bd0',
  green: '#4ADE80',        // success, scale
  red: '#F87171',          // error, stop
  yellow: '#FBBF24',       // warning
  purple: '#A78BFA',       // intelligence, patterns
  labelColor: 'rgba(240,246,252,0.40)',
};
```

### NEVER DO:
- ❌ Generic boxed cards with thick borders (Martinho hates this)
- ❌ Gray-on-gray buttons — every button needs clear contrast
- ❌ Stagger animation delays on real content (`animationDelay: ${i * 0.05}s`)
- ❌ Generic SaaS template look
- ❌ Emoji overuse — use colored dots (●) and SVG icons
- ❌ Loading that blocks the whole page — sections load independently
- ❌ Passive data display — drive ACTION
- ❌ "Dados insuficientes" without actionable guidance

### ALWAYS DO:
- ✅ Cinematic dark mode — deep #080B11 backgrounds, layered surfaces
- ✅ Minimal, functional — Linear/Notion/Vercel aesthetic
- ✅ Action-oriented microcopy — decisive, confident, slightly aggressive
- ✅ Status dots — 5-7px colored circles for health indicators
- ✅ borderLeft accent — 2-3px colored left border on type-coded cards
- ✅ Hover: translateY(-1px), subtle box-shadow
- ✅ Color coding: Green=scale, Red=stop, Blue=explore, Yellow=warning, Purple=intelligence

### Typography:
- Labels: 9-10px, weight 700, spacing 0.08em, uppercase, `T.labelColor`
- Headings: 14-18px, weight 700-800, `T.text1`
- Body: 12-13px, weight 400-600, `T.text2`
- Captions: 10-11px, weight 500, `T.text3`

### Icons: `lucide-react` ONLY
Sidebar: Feed=`Layers`, AI Chat=`MessageSquare`, History=`Clock`, Accounts=`Building2`

---

## Architecture

### Layout
- **Sidebar**: `src/components/dashboard/DashboardSidebar.tsx` — Nav items, persona selector, plan badge
- **Layout**: `src/components/dashboard/DashboardLayout.tsx` — Wraps all `/dashboard/*` routes with `<Outlet>`
- Legacy `AppLayout.tsx` may exist — DashboardSidebar is the current production sidebar

### Key Pages (`src/pages/dashboard/`)
| Page | File | Purpose |
|------|------|---------|
| Feed / Command Center | `FeedPage.tsx` | AI Decision Command Center — TopPriorityBar, FlowSection, IntelligencePanel |
| AI Chat | `AdBriefAI.tsx` | AI media buyer chat with inline skills |
| History | `HistoryPage.tsx` | Action history |
| Accounts | `AccountsPage.tsx` | Persona/account management + Meta OAuth |
| Performance | `PerformanceDashboard.tsx` | Real-time metrics dashboard |
| Landing | `IndexNew.tsx` | Marketing page with cinematic hero demo |

### Feed Page Structure (recently redesigned)
Layer 0: TopPriorityBar (sticky) → Layer 1: Header → Layer 2: IntelligencePanel → Layer 3: Alerts → Layer 4: Tracking → Layer 5: Decision Stack + FlowSection → Layer 6: PerformancePulse (KPIs) → Layer 7: Patterns + Telegram

State machine: `demo → full → no-critical → few-data → single-ad → no-ads → loading`

### Key Components (`src/components/`)
- `dashboard/PatternsPanel.tsx` — Learned patterns display
- `feed/MoneyBar.tsx` — Financial waste/opportunity bar
- `feed/SummaryBar.tsx` — Decision summary
- `feed/DecisionCard.tsx` — Individual decision card
- `feed/GoalSetup.tsx` — Goal configuration

### Custom Events
- `meta-account-changed` — Meta account switched
- `persona-updated` — Persona created/edited/deleted
- `meta-oauth-complete` — OAuth callback done

### Key Hooks
- `useDecisions(accountId)` — Fetch decisions
- `useMoneyTracker(accountId)` — Financial tracking
- `useActions()` — Execute Meta API actions
- `useLanguage()` — i18n (7 languages: en, pt, es, zh, fr, de, ar)

---

## Supabase Edge Functions (Key)
- `adbrief-ai-chat` — Main AI chat (Claude Haiku 4.5)
- `sync-meta-data` — Import from Meta API
- `run-decision-engine` — Generate KILL/FIX/SCALE decisions
- `live-metrics` — Real-time performance data
- `meta-oauth` — OAuth flow
- `meta-actions` — Pause/activate/budget via Meta API
- `check-critical-alerts` — 6-hourly alerts
- `daily-intelligence` — Daily intelligence cron
- `capture-learning` — Learning capture

---

## Database (Key Tables)
- `users`, `user_profiles`, `user_ai_profile`
- `ad_accounts` (has `goal_objective`, `goal_primary_metric`, `goal_target_value`)
- `campaigns`, `ads`, `ad_metrics`
- `decisions` — Decision engine output
- `account_alerts` — Critical alerts
- `daily_snapshots` — Daily aggregated metrics
- `action_log` — Executed actions history
- `chat_memory`, `ai_memory`, `learned_patterns`, `creative_memory`
- `personas` — Both direct columns AND `result` JSONB AND `brand_kit` JSONB

### Personas Data Pattern
```ts
// Always check both direct columns and JSONB:
const name = p.name || p.result?.name;
const logo = p.logo_url || p.brand_kit?.logo_data_url;
```

### Supabase Type Workaround
Many tables aren't in generated types:
```ts
const { data } = await (supabase.from('ad_accounts' as any).select('*').eq('id', id) as any);
```

---

## Pricing
| Plan | Chats/day | Accounts | Price |
|------|----------|----------|-------|
| Free | 3 | 0 | $0 |
| Maker | 50 | 1 | $19/mo |
| Pro | 200 | 3 | $49/mo |
| Studio | Unlimited | Unlimited | $149/mo |

---

## Build & Git
```bash
npx tsc --noEmit --skipLibCheck  # Must pass before commit
npx vite build                    # Must build before push
git add <specific files>           # Never git add -A
git push                          # Vercel auto-deploys frontend
```

---

## 🚨 DEPLOY WORKFLOW — MARTINHO HANDLES SUPABASE VIA LOVABLE

**Claude does NOT run `supabase functions deploy`, `supabase db push`, or touch any Supabase CLI. Martinho publishes everything through Lovable himself.**

### After any change, surface what needs deploying:

**Frontend only** (`src/**`, `public/**`, `index.html`, etc.) → git push, Vercel auto-deploys. No deploy list needed.

**Supabase changes** → Claude MUST produce an explicit deploy list at the end of the response:

```
📦 PRECISA DEPLOY NO LOVABLE:
  • Edge function: <function-name> — <what changed, 1 line>
  • Migration: <filename> — <what it does>
  • Secret: <KEY_NAME> — <where/why>
  • Cron/schedule: <name> — <change>
```

Categories that always trigger a deploy list:
- `supabase/functions/**` → per-function deploy
- `supabase/migrations/**` → db push
- Any env var / secret change
- Cron or scheduled task edits

If the commit mixes frontend + backend, separate them in the summary so Martinho knows which part is live and which is waiting on him.

---

## What's Left to Ship
1. Polish all pages to match design system
2. Fix broken flows (signup → connect → decisions → action)
3. Landing page final conversion polish
4. Stripe checkout integration
5. Onboarding flow (< 30 seconds to first insight)
6. Performance optimization
7. Error handling everywhere
8. Mobile responsive on every page

---

## About the User
**Martinho** (martinhovff@gmail.com) — Founder. Portuguese speaker. Thinks visually. Strong design opinions. When he says "faz do zero" = rebuild from scratch. When he shares screenshots = analyze carefully, that's what needs to change. He wants premium, cinematic quality — never generic templates.

---

## ⛔ DEPLOY & INFRASTRUCTURE — HARD RULES

The founder has been burned multiple times by Claude blaming
infrastructure when the real cause was code. These rules are
non-negotiable. Read them before saying anything about deploys or
edge functions.

### Rule 1: Lovable auto-deploys EVERY push to `main`
Lovable rebuilds and ships almost instantly on every push. **It only
fails when there is an actual error in the code** (tsc/build/lint
failure). If the user reports something is "not changing" or "still
broken" after a push:

- ❌ DO NOT say "it's deploy lag, wait a few minutes"
- ❌ DO NOT say "Lovable hasn't picked it up yet"
- ❌ DO NOT suggest hard-refresh as the first answer
- ✅ ASSUME the bug is in your code
- ✅ Investigate the running app via Chrome MCP (DOM, computed
  styles, scrollTop chain, console errors, network tab) before
  pointing at infra
- ✅ If you genuinely need to verify deploy state, fetch the live
  JS bundle and grep for your specific changes — that's proof.
  Anything short of that is guessing.

### Rule 2: Edge functions auto-deploy when modified
Existing Supabase edge functions ship automatically when their files
change in a push to `main`. **Manual `supabase functions deploy`
is only required the FIRST time a NEW function is created.**

- ❌ DO NOT tell the user to run `supabase functions deploy <name>`
  for an existing function unless you have positive evidence the
  auto-deploy failed
- ✅ Modifying an existing function ships with the next git push

### Rule 3: When the user says "it's your code", believe them
The founder has live access to the running app. When he reports a
visible regression after a push, treat it as a real code bug until
proven otherwise. Asking him to "clear cache" or "wait longer" as
the first response erodes trust fast.

### Rule 4: Diagnose before defending
Fast path when something looks broken:

1. Connect via chrome MCP to the live site
2. Inspect the actual rendered DOM (`getBoundingClientRect`,
   computed styles, scrollTop chain, console errors, network tab)
3. Compare what you wrote vs what is running
4. Identify the root cause IN CODE
5. Fix and ship

### Real example (2026-04-30): the LivePanel bug
After a chat layout migration, the founder reported the LivePanel
disappeared. Claude blamed Lovable deploy lag for an hour. The user
forced Claude into chrome MCP, where one query revealed:

- LivePanel WAS in the DOM, with correct height (58px)
- It was at `y: -12` (above the viewport)
- The page wrap had `scrollTop: 64` — `scrollIntoView()` from a new
  message had bubbled up past `messages` (overflow:auto) into the
  page wrap (which had `overflow: hidden`, still programmatically
  scrollable)

Fix was a one-line change: `overflow: hidden` → `overflow: clip`
on the page wrap. Lost an hour of trust because Claude defended
infra instead of inspecting.

**This rule exists because of that hour.**
