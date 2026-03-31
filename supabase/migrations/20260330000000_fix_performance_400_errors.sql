-- Fix 400 errors on PerformanceDashboard queries

-- 1. user_ai_profile: add missing columns
ALTER TABLE public.user_ai_profile ADD COLUMN IF NOT EXISTS pain_point text;
ALTER TABLE public.user_ai_profile ADD COLUMN IF NOT EXISTS avg_hook_score numeric;
ALTER TABLE public.user_ai_profile ADD COLUMN IF NOT EXISTS creative_style text;

-- 2. creative_entries: add persona_id column so dashboard filter works
ALTER TABLE public.creative_entries ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS creative_entries_persona ON public.creative_entries(user_id, persona_id);

-- 3. daily_snapshots: ensure persona_id exists (query filters by it)
ALTER TABLE public.daily_snapshots ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS daily_snapshots_persona ON public.daily_snapshots(user_id, persona_id, date DESC);
