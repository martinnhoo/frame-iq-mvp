-- Google Ads integration + cross-platform learning

-- Add persona_id to learned_patterns for cross-platform scoping
ALTER TABLE public.learned_patterns ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS learned_patterns_persona ON public.learned_patterns(user_id, persona_id);

-- Add google to platform_connections constraint if not already done
-- (platform_connections already has 'google' in check constraint from earlier migration)

-- Index for cross-platform pattern lookups
CREATE INDEX IF NOT EXISTS learned_patterns_cross_platform
  ON public.learned_patterns(user_id, pattern_key)
  WHERE pattern_key LIKE 'cross_%';
