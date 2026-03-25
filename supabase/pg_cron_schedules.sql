-- AdBrief pg_cron Schedules
-- Execute no Supabase SQL Editor (Lovable Cloud > SQL Editor)
-- Requer extensão pg_cron (disponível no Supabase)

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Remover schedules antigos se existirem ───────────────────────────────────
SELECT cron.unschedule('adbrief-daily-intelligence') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-daily-intelligence');
SELECT cron.unschedule('adbrief-market-intelligence') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-market-intelligence');
SELECT cron.unschedule('adbrief-creative-director') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-creative-director');
SELECT cron.unschedule('adbrief-weekly-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-weekly-report');
SELECT cron.unschedule('adbrief-trend-watch') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'adbrief-trend-watch');

-- ── SCHEDULE 1: Daily Intelligence — 8h BRT (11h UTC) todo dia ───────────────
-- Puxa dados Meta Ads, gera insights, cria alertas proativos, auto-pilot
SELECT cron.schedule(
  'adbrief-daily-intelligence',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/daily-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── SCHEDULE 2: Market Intelligence — 8h30 BRT (11h30 UTC) todo dia ─────────
-- Google Trends + Meta Ads Library — roda logo após daily-intelligence
SELECT cron.schedule(
  'adbrief-market-intelligence',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/market-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── SCHEDULE 3: Creative Director — segunda-feira 8h BRT (11h UTC) ──────────
-- Decisões semanais: pausar/escalar/criar + hooks propostos
SELECT cron.schedule(
  'adbrief-creative-director',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/creative-director',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── SCHEDULE 4: Weekly Report + Memory Consolidation — domingo 9h BRT (12h UTC)
-- Email semanal + prune de patterns + promoção de canônicos
SELECT cron.schedule(
  'adbrief-weekly-report',
  '0 12 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── SCHEDULE 5: Trend Watch — a cada 30min (fallback do Fly.io) ─────────────
-- O Fly.io roda a cada 15min. Este é o fallback caso o Fly.io esteja down.
-- Apenas detecta e pesquisa trends — não substitui o Fly.io para tempo real
SELECT cron.schedule(
  'adbrief-trend-watch',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/trend-researcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('geo', 'BR')
  );
  $$
);

-- ── Configurar variáveis da app (substitua pelos valores reais) ──────────────
-- Execute uma vez após criar os schedules:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://mtrovtowcpttdqygtrwq.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'sua-service-role-key';

-- ── Verificar schedules criados ──────────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
