-- Allow learned_patterns to have user_id=null for global benchmark patterns
-- These are anonymous aggregates from aggregate-intelligence — no PII, no user data

-- 1. Make user_id nullable
ALTER TABLE public.learned_patterns
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update unique index that included user_id — needs to handle nulls
DROP INDEX IF EXISTS public.learned_patterns_user_pattern_key;
CREATE UNIQUE INDEX IF NOT EXISTS learned_patterns_user_pattern_key
  ON public.learned_patterns(user_id, pattern_key)
  WHERE user_id IS NOT NULL;

-- Separate unique index for global patterns (user_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS learned_patterns_global_pattern_key
  ON public.learned_patterns(pattern_key)
  WHERE user_id IS NULL;

-- 3. Add RLS policy so authenticated users can READ global patterns (user_id IS NULL)
-- They cannot write them — only service role (aggregate-intelligence) can
DROP POLICY IF EXISTS "Users read global patterns" ON public.learned_patterns;
CREATE POLICY "Users read global patterns"
  ON public.learned_patterns FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

-- 4. Existing "Users manage own learned patterns" policy remains for user-owned rows
-- user_id = auth.uid() — unchanged
