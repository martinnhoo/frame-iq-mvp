-- ═══════════════════════════════════════════════════════════════════════════
-- Fechar os buracos que deixavam o cliente se dar créditos — 04/08/2026
--
-- Uma auditoria de segurança achou caminhos pelos quais um usuário logado, do
-- próprio navegador, escrevia direto nas tabelas que decidem quanto ele pode
-- gastar. Nenhum deles exigia mais do que a anon key, que é pública por
-- design e está no bundle do site.
--
-- Os itens são independentes: fechar um não fecha os outros.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Policies FOR ALL nas tabelas de consumo ──────────────────────────────
--
-- `for all using (auth.uid() = user_id)` protege a LINHA, não as COLUNAS.
-- O dono da linha podia dar UPDATE em qualquer campo dela:
--
--   supabase.from('user_credits')
--     .update({ used_credits: 0, total_credits: 999999 })
--     .eq('user_id', meu_id)
--
-- Créditos infinitos em tudo que passa por _shared/deductCredits.ts. Em
-- free_usage, zerar chat_count dava chat ilimitado no plano gratuito.
--
-- A escrita legítima nunca veio do cliente: vem da RPC deduct_credits, que é
-- SECURITY DEFINER, e do service_role nas edge functions. Nenhum dos dois
-- passa por RLS. Trocar FOR ALL por FOR SELECT não quebra esses caminhos.

drop policy if exists user_credits_own on public.user_credits;
create policy user_credits_own on public.user_credits
  for select using (auth.uid() = user_id);

drop policy if exists free_usage_own on public.free_usage;
create policy free_usage_own on public.free_usage
  for select using (auth.uid() = user_id);

drop policy if exists upgrade_events_own on public.upgrade_events;
create policy upgrade_events_own on public.upgrade_events
  for select using (auth.uid() = user_id);

drop policy if exists usage_own on public.usage;
create policy usage_own on public.usage
  for select using (auth.uid() = user_id);

-- user_preferences é a exceção: é preferência de UI, o próprio usuário deve
-- escrever, e nada ali decide gasto. Mantém escrita, mas ganha WITH CHECK —
-- sem ele dava para inserir linha com o user_id de outra pessoa.
drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 2. RPCs de crédito executáveis por qualquer um ──────────────────────────
--
-- Em Postgres, função nasce com EXECUTE para PUBLIC. O `grant execute to
-- service_role` que já existia não revoga esse default — só soma. As duas são
-- SECURITY DEFINER e ficam expostas pelo PostgREST:
--
--   supabase.rpc('add_bonus_credits',
--                { p_user_id: meu_id, p_credits: 999999, p_reason: 'referral' })
--
-- hub_reserve_credits faz o revoke corretamente; estas são de uma migration
-- anterior a esse padrão e ficaram para trás.
--
-- O laço percorre por nome porque as assinaturas têm defaults e reescrevê-las
-- à mão aqui é como se erra um revoke.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('deduct_credits', 'add_bonus_credits')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;


-- ── 3. hub_plan_config sem RLS ──────────────────────────────────────────────
--
-- Era a única tabela do schema sem RLS habilitada. Sem RLS, anon e
-- authenticated ficam com ALL por default — leitura E escrita.
--
-- É a tabela que hub_credit_balance() consulta para saber quantos créditos
-- cada plano dá:
--
--   supabase.from('hub_plan_config')
--     .update({ monthly_credits: 500000 }).eq('plan', 'free')
--
-- Isso são US$ 5.000 de custo de provider por conta gratuita.
--
-- A UI de planos e a landing só precisam ler.

alter table public.hub_plan_config enable row level security;

drop policy if exists hub_plan_config_read on public.hub_plan_config;
create policy hub_plan_config_read on public.hub_plan_config
  for select to authenticated, anon using (true);


-- ── 4. hub_credit_balance lia uma tabela que não existe ─────────────────────
--
-- A função consultava public.user_profiles. Essa tabela não é criada por
-- nenhuma migration — é a única ocorrência do nome no repositório inteiro.
-- Todo o resto do código usa public.profiles.
--
-- Dependendo do estado do banco isso é uma de duas coisas: ou a função levanta
-- erro, o reserveCredits falha fechado e NENHUMA geração funciona para
-- ninguém; ou a tabela existe por fora sem a coluna plan e todo cliente
-- pagante é tratado como free, com 80 créditos.
--
-- Corpo idêntico ao original em 20260802120000, trocando só a tabela.

create or replace function public.hub_credit_balance(p_user uuid)
returns table (balance int, plan_credits int, pack_credits int, used int)
language plpgsql security definer set search_path = public as $$
declare
  v_plan  text;
  v_pool  int;
  v_packs int;
  v_used  int;
  v_cycle_start timestamptz := date_trunc('month', now());
begin
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p where p.id = p_user;

  select c.monthly_credits into v_pool
    from public.hub_plan_config c where c.plan = coalesce(v_plan, 'free');
  v_pool := coalesce(v_pool, 0);

  select coalesce(sum(k.credits), 0) into v_packs
    from public.hub_credit_packs k
    where k.user_id = p_user and k.expires_at > now();

  -- Reservas contam como gasto: só voltam se forem estornadas.
  select coalesce(sum(l.credits), 0) into v_used
    from public.hub_credit_ledger l
    where l.user_id = p_user
      and l.state in ('reserved', 'confirmed')
      and l.created_at >= v_cycle_start;

  return query select (v_pool + v_packs - v_used)::int, v_pool, v_packs::int, v_used;
end $$;

revoke all on function public.hub_credit_balance(uuid) from public, anon;
grant execute on function public.hub_credit_balance(uuid) to authenticated, service_role;


-- ── 5. RPCs de campanha aceitavam o uuid do alvo ────────────────────────────
--
-- hub_validate_campaign(text, uuid) e hub_video_usage(uuid) recebem o usuário
-- por parâmetro e estavam liberadas para `authenticated`. Passando o uuid de
-- outra pessoa dava para descobrir se ela já resgatou determinado cupom e
-- quantos vídeos gerou no mês. Vazamento de metadado, sem impacto financeiro.
--
-- Elas continuam existindo para o service_role — as edge functions
-- (video-limits.ts, create-checkout) chamam com o id já verificado no JWT.
-- O que sai é o acesso direto do navegador.

revoke all on function public.hub_video_usage(uuid)              from public, anon, authenticated;
revoke all on function public.hub_validate_campaign(text, uuid)  from public, anon, authenticated;
grant execute on function public.hub_video_usage(uuid)             to service_role;
grant execute on function public.hub_validate_campaign(text, uuid) to service_role;

-- Versões sem alvo, para o cliente chamar direto: quem manda é o auth.uid().
create or replace function public.hub_validate_my_campaign(p_code text)
returns jsonb
language sql security definer set search_path = public as $$
  select public.hub_validate_campaign(p_code, auth.uid());
$$;

revoke all on function public.hub_validate_my_campaign(text) from public, anon;
grant execute on function public.hub_validate_my_campaign(text) to authenticated, service_role;


-- ── 6. Storage: anon conseguia LISTAR os arquivos de todo mundo ─────────────
--
-- A policy dizia apenas `bucket_id = 'hub-images'`, sem restringir prefixo. O
-- comentário justificava "leitura pública pra <img> carregar sem auth" — mas a
-- mesma policy governa a API de list:
--
--   POST /storage/v1/object/list/hub-images
--
-- devolvia o índice de todos os objetos, e daí todo criativo, logo e vídeo de
-- todos os clientes ficava baixável com a anon key.
--
-- Os buckets são public = true, e é isso que faz a tag <img> funcionar via
-- /object/public/. A policy em storage.objects não é necessária para isso.

drop policy if exists hub_images_public_read   on storage.objects;
drop policy if exists hub_captions_public_read on storage.objects;
