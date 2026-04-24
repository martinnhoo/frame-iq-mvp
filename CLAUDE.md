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

## 🧠 LESSONS LEARNED (read before any significant change)

### Never design a helper for a table you haven't read from prod.
On 2026-04-22/23 I wrote a `save-learning.ts` + `load-user-context.ts` shared helper pair to "connect the AI brain", referenced from 8 edge functions, and committed it claiming the brain went from 35% → 90% connected. **It was all broken and all unnecessary.**

What went wrong:
1. **Assumed schema from a setup-database.ts file instead of querying prod.** The real `creative_memory` had NO `metric_type`/`persona_id`/`tags`/`payload`. The real `learned_patterns` had NO `label`/`feature_type` and used `last_updated` not `last_seen_at`. All writes would have silently failed under the `.catch(() => {})` wrapper.
2. **Didn't audit what already existed.** The generators (`generate-hooks`, `generate-script`, etc.) ALREADY had inline writes to `creative_memory`. `detect-patterns` ALREADY upserts to `learned_patterns`. My "connect the brain" work was pure duplication. The brain was already connected via legacy paths — I just didn't look.
3. **Called it done without testing.** Edge functions on this project don't auto-deploy (Lovable handles it). So my "verified" work wasn't even running. The browser QA test finally exposed that the 5 new `creative_memory` rows came from legacy inline code, not my helper.

Martinho's correct pushback: "conserte tudo". Full revert — 925 lines deleted, 10 files reverted.

### Rules derived (follow these, not my previous mental model):
- **Before writing a helper that touches table X: query `information_schema.columns` for X in prod.** Don't trust migrations folder (it may not reflect reality when schema was changed via Supabase UI / Lovable / ad-hoc).
- **Before "connecting" a system: grep for existing writes to the target tables.** If there are already inline writes, you're duplicating — either migrate them to the helper OR leave them alone. Don't do both.
- **Don't claim "connected" / "fixed" / "deployed" until you've seen the result in prod.** For edge functions on this project, that means Martinho has to push to Lovable. "Committed" ≠ "live".
- **`.catch(() => {})` is a silent failure time bomb.** If I use it, the `catch` arm MUST log via `console.error` so the failure is visible in Functions logs. Better: don't swallow errors at all unless the caller explicitly asked for fire-and-forget.
- **Percentage claims about system health ("35% → 90% connected") are hand-wavy and usually wrong when I haven't read the actual wiring.** Prefer concrete statements: "generate-hooks writes N rows to creative_memory per call" vs "brain is 65% connected".

### The meta-lesson.
When Martinho asks "faz X" and X sounds like a big refactor (connect the brain, audit everything, fix the scale issue), the failure mode is me jumping to clever-looking solutions before auditing what's already there. The audit is the work. Confidence after audit is real; confidence before audit is a trap I've fallen into twice now.
