-- ═══════════════════════════════════════════════════════════════════════════
-- ci_import_runs: um status para "terminou sem trazer nada"
--
-- Faltava vocabulário para o desfecho mais traiçoeiro de todos: a execução que
-- não deu erro nenhum e mesmo assim não trouxe anúncio. Sem um nome próprio,
-- ela era gravada como 'completed' — o mesmo status de uma importação que deu
-- certo. Foi exatamente assim que a primeira importação real desta base passou
-- despercebida: 200 na resposta, "concluída" no banco, zero anúncios.
--
-- 'empty' não é erro. A marca pode realmente não ter anúncio naquele filtro, e
-- isso é uma resposta legítima. O ponto é que quem lê precisa CONSEGUIR
-- distinguir "não achamos nada" de "achamos e importamos".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ci_import_runs
  drop constraint if exists ci_import_runs_status_check;

alter table public.ci_import_runs
  add constraint ci_import_runs_status_check
  check (status in ('queued','running','completed','failed','cancelled','partial','empty'));


-- ── Conferência ────────────────────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definicao
  from pg_constraint
 where conrelid = 'public.ci_import_runs'::regclass
   and contype  = 'c'
   and conname  = 'ci_import_runs_status_check';
