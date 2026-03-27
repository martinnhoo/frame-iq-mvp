-- AdBrief pg_cron Schedules — reference doc (actual schedules in migrations)
-- Last updated: 2026-03-27

-- ── SCHEDULE 1: Daily Intelligence — 8h BRT (11h UTC) todo dia ───────────────
-- Puxa dados Meta Ads, gera insights, cria snapshots, envia email
-- adbrief-daily-intelligence | '0 11 * * *'

-- ── SCHEDULE 2: Market Intelligence — 8h30 BRT (11h30 UTC) todo dia ─────────
-- Google Trends + Meta Ads Library — roda logo após daily-intelligence
-- adbrief-market-intelligence | '30 11 * * *'

-- ── SCHEDULE 3: Creative Director — segunda-feira 8h BRT (11h UTC) ──────────
-- Decisões semanais: pausar/escalar/criar + hooks propostos
-- adbrief-creative-director | '0 11 * * 1'

-- ── SCHEDULE 4: Weekly Report — domingo 9h BRT (12h UTC) ─────────────────────
-- Email semanal de performance
-- adbrief-weekly-report | '0 12 * * 0'

-- ── SCHEDULE 5: Trend Watch — a cada 30min ────────────────────────────────────
-- Chama trend-WATCHER (não researcher) — busca Google Trends BR, analisa, salva em trend_intelligence
-- adbrief-trend-watch | '*/30 * * * *' → trend-watcher {mode:"auto",geo:"BR"}

-- ── SCHEDULE 6: Check Critical Alerts — a cada 6h ────────────────────────────
-- Verifica contas ativas: queda de CTR, frequência alta, gasto sem conversão
-- Envia email + Telegram quando cruza thresholds
-- adbrief-check-alerts | '0 0,6,12,18 * * *' → check-critical-alerts

-- ── SCHEDULE 7: Trend Matcher — 15min após trend-watcher ─────────────────────
-- Cruza trends ativas com todas as contas de usuários → Telegram alerts (fit >= 7)
-- adbrief-trend-matcher | '15,45 * * * *' → trend-matcher

-- ── Fly.io Cerebro (paralelo, se deployed) ────────────────────────────────────
-- fly-trend-watcher/main.py: a cada 15min
-- Google Trends → trend-researcher (Nitter/Reddit/Brave) → trend-matcher → Telegram
-- Complementar ao Loop B acima. Não obrigatório — sistema funciona sem ele.
