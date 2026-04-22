-- ============================================================================
-- AdBrief — account_knowledge: typed, structured memory ontology
-- ============================================================================
-- Supersedes the flat chat_memory model for structured facts about an account.
-- chat_memory keeps working for free-form notes; account_knowledge captures
-- the 5 entity types the AI reasons over: product, audience, brand, playbook,
-- constraints.
--
-- Design rules (so the table doesn't rot):
--   1. Every row is typed (knowledge_type CHECK) — no generic blob dumping.
--   2. Shape validated by check constraint on data jsonb (is_object + has slug).
--   3. Singleton types (brand/playbook/constraints) always use slug='main'.
--   4. Multi types (product/audience) use a user-supplied slug for dedup.
--   5. Unique constraint per (user, persona, type, slug) — upsert by that.
--   6. Source is tracked so we can evict/refresh 'derived' rows without
--      touching user-provided ones.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_knowledge (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL persona_id = knowledge global to the user (rare — most rows belong to a persona)
  persona_id       uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  knowledge_type   text NOT NULL,
  slug             text NOT NULL DEFAULT 'main',
  data             jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence       numeric(3,2) NOT NULL DEFAULT 0.50,
  source           text NOT NULL DEFAULT 'chat',
  schema_version   integer NOT NULL DEFAULT 1,
  last_updated     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT account_knowledge_type_chk
    CHECK (knowledge_type IN ('product','audience','brand','playbook','constraints')),
  CONSTRAINT account_knowledge_source_chk
    CHECK (source IN ('chat','onboarding','derived','manual')),
  CONSTRAINT account_knowledge_confidence_chk
    CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT account_knowledge_slug_chk
    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  -- Data must be a JSON object (not array/scalar) — protects against Haiku
  -- occasionally emitting a raw string or array.
  CONSTRAINT account_knowledge_data_is_object
    CHECK (jsonb_typeof(data) = 'object')
);

-- Singleton upsert key: only one row per (user, persona, type, slug).
-- persona_id NULL treated as a distinct scope (the "global per user" bucket)
-- via COALESCE to a zero UUID.
CREATE UNIQUE INDEX IF NOT EXISTS account_knowledge_upsert_key
  ON public.account_knowledge (
    user_id,
    COALESCE(persona_id, '00000000-0000-0000-0000-000000000000'::uuid),
    knowledge_type,
    slug
  );

-- Bundle loader hot path: load all knowledge for a persona in one query,
-- ranked by confidence.
CREATE INDEX IF NOT EXISTS account_knowledge_persona_lookup
  ON public.account_knowledge (user_id, persona_id, knowledge_type, confidence DESC);

-- Recency index for UI "recently learned" sections.
CREATE INDEX IF NOT EXISTS account_knowledge_recent
  ON public.account_knowledge (user_id, last_updated DESC);

-- Enable RLS. Edge functions use service role and bypass; user-facing queries
-- are scoped to the authenticated user.
ALTER TABLE public.account_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_knowledge_own ON public.account_knowledge;
CREATE POLICY account_knowledge_own ON public.account_knowledge
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-bump last_updated on any UPDATE. Keeps the "recently learned" signal
-- honest even if the edge function forgets to set it.
CREATE OR REPLACE FUNCTION public.account_knowledge_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_knowledge_touch ON public.account_knowledge;
CREATE TRIGGER trg_account_knowledge_touch
  BEFORE UPDATE ON public.account_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.account_knowledge_touch();

COMMENT ON TABLE public.account_knowledge IS
  'Typed, structured ontology of what AdBrief knows about a user''s account. Rows: product/audience/brand/playbook/constraints. Consumed by the context bundle loader in adbrief-ai-chat.';
COMMENT ON COLUMN public.account_knowledge.slug IS
  'Stable identifier inside a type. Singletons (brand/playbook/constraints) use ''main''. Multi (product/audience) use a unique slug per entity.';
COMMENT ON COLUMN public.account_knowledge.source IS
  'Where the row was created: chat (extracted from conversation), onboarding (elicited upfront), derived (computed from ad data), manual (user edited directly).';
