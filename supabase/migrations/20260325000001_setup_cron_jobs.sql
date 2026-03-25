-- AdBrief pg_cron setup
-- Roda automaticamente via Lovable quando publicado

-- Extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Função helper que usa a service role key do ambiente
-- Chamada pelo pg_cron sem expor a key no SQL
create or replace function adbrief_invoke_function(fn_name text, body_json text default '{}')
returns void
language plpgsql
security definer
as $$
declare
  base_url text;
  service_key text;
begin
  -- Pega URL e key do ambiente do banco (setado pelo Supabase automaticamente)
  base_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- Fallback: tenta via configuração alternativa do Supabase
  if base_url is null then
    base_url := 'https://mtrovtowcpttdqygtrwq.supabase.co';
  end if;

  if service_key is not null then
    perform net.http_post(
      url := base_url || '/functions/v1/' || fn_name,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := body_json::jsonb
    );
  end if;
end;
$$;

-- Remove schedules antigos se existirem
do $$
begin
  perform cron.unschedule(jobname)
  from cron.job
  where jobname like 'adbrief-%';
exception when others then null;
end $$;

-- Schedule 1: Daily Intelligence — 8h BRT (11h UTC) todo dia
select cron.schedule(
  'adbrief-daily-intelligence',
  '0 11 * * *',
  $$select adbrief_invoke_function('daily-intelligence', '{}')$$
);

-- Schedule 2: Market Intelligence — 8h30 BRT (11h30 UTC) todo dia
select cron.schedule(
  'adbrief-market-intelligence',
  '30 11 * * *',
  $$select adbrief_invoke_function('market-intelligence', '{}')$$
);

-- Schedule 3: Creative Director — segunda 8h BRT (11h UTC)
select cron.schedule(
  'adbrief-creative-director',
  '0 11 * * 1',
  $$select adbrief_invoke_function('creative-director', '{}')$$
);

-- Schedule 4: Weekly Report — domingo 9h BRT (12h UTC)
select cron.schedule(
  'adbrief-weekly-report',
  '0 12 * * 0',
  $$select adbrief_invoke_function('weekly-report', '{}')$$
);

-- Schedule 5: Trend Watch — a cada 30min
select cron.schedule(
  'adbrief-trend-watch',
  '*/30 * * * *',
  $$select adbrief_invoke_function('trend-researcher', '{"geo":"BR"}')$$
);
