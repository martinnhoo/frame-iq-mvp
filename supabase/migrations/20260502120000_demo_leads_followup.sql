-- 20260502120000_demo_leads_followup.sql
--
-- Adiciona tracking pra demo-followup email.
--
-- demo_leads captura visitantes que rodam analyze-demo na /demo (com email
-- opcional). Hoje só usamos pra rate-limit por IP. O followup email está
-- escrito (send-demo-followup-email) mas nunca dispara porque não havia
-- coluna pra rastrear quem já recebeu — sem isso, o cron diário rodaria
-- e mandaria o mesmo email todo dia pra quem já recebeu uma vez.
--
-- Adiciona followup_sent_at: timestamp de quando o cron disparou o
-- demo-followup pra esse lead. NULL = ainda não recebeu, pode mandar.
-- Não-NULL = já mandou, pula.

ALTER TABLE public.demo_leads
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

-- Índice composto pro cron query: pega leads com email não-null + sem
-- followup ainda + criados na janela das últimas 26h. Ordenado por
-- created_at pra cron processar oldest-first.
CREATE INDEX IF NOT EXISTS idx_demo_leads_followup_pending
  ON public.demo_leads (created_at)
  WHERE email IS NOT NULL AND followup_sent_at IS NULL;
