-- Add persona_id to boards so each board is scoped to an account (persona)
-- Existing boards get persona_id = NULL (global/unscoped — still visible when no filter)

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL;

-- Index for fast lookup by user + persona
CREATE INDEX IF NOT EXISTS boards_user_persona
  ON public.boards (user_id, persona_id);

-- Update RLS policy to still allow user to see all their boards
-- (including ones without persona_id — legacy/migrated boards)
DROP POLICY IF EXISTS "Users manage own boards" ON public.boards;
CREATE POLICY "Users manage own boards"
  ON public.boards FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
