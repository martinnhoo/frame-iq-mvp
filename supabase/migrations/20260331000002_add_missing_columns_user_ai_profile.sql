-- Add missing columns to user_ai_profile that cause 400 errors
-- These columns are queried by DashboardLayout, UserProfilePanel, PreflightCheck, ScriptGenerator

ALTER TABLE public.user_ai_profile 
  ADD COLUMN IF NOT EXISTS pain_point text,
  ADD COLUMN IF NOT EXISTS avg_hook_score numeric,
  ADD COLUMN IF NOT EXISTS creative_style text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_recommendations jsonb DEFAULT '[]';

-- Add missing columns to creative_entries
ALTER TABLE public.creative_entries
  ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS creative_entries_persona 
  ON public.creative_entries(user_id, persona_id);

-- Add missing columns to daily_snapshots  
ALTER TABLE public.daily_snapshots
  ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS daily_snapshots_persona 
  ON public.daily_snapshots(user_id, persona_id, date DESC);

-- Ensure RLS on user_ai_profile is correct
ALTER TABLE public.user_ai_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own AI profile" ON public.user_ai_profile;
CREATE POLICY "Users manage own AI profile" 
  ON public.user_ai_profile FOR ALL TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);
