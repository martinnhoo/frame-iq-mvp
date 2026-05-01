-- 20260501100000_creative_memory_persona_scope.sql
--
-- Closes the last cross-persona context leak.
--
-- Background: creative_memory was only scoped by user_id, no persona_id.
-- A user with multiple personas (e.g. one for an e-commerce brand + one
-- for a B2B SaaS) would see hooks/scripts/winners from one persona
-- surface as AI context in the other. The adbrief-ai-chat code
-- comment (line ~1259) admitted the gap: "creative_memory doesn't have
-- persona_id yet — use all, AI persona context prevents
-- cross-contamination". The mitigation (persona context in the prompt)
-- is weak — semantically unrelated creatives still leaked through.
--
-- This migration:
--   1. Adds nullable persona_id column with FK to personas, ON DELETE CASCADE
--      (so deleting a persona automatically purges its creative memory).
--   2. Adds an index for (user_id, persona_id) — the read path's
--      filter pattern.
--
-- The column is nullable on purpose: existing rows pre-migration get
-- persona_id = null. The AI chat read path treats null as "global"
-- (visible to all personas of the user) — preserving behavior for
-- legacy rows. New writes (HookGenerator, analyze-video, meta-oauth
-- onboarding seed, generate-board) will populate persona_id when
-- available, and the read path will then filter strictly by persona.

ALTER TABLE public.creative_memory
  ADD COLUMN IF NOT EXISTS persona_id uuid
  REFERENCES public.personas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_creative_memory_user_persona
  ON public.creative_memory (user_id, persona_id);

-- RLS already enabled in 20260331000003_security_hardening.sql with the
-- standard "Users manage own creative memory" policy keyed off user_id;
-- adding persona_id doesn't loosen access — every row still requires
-- user_id = auth.uid() to read or write.
