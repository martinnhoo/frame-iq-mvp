-- Fix: chat_memory and chat_examples had no RLS policies
-- Any anon request could read all users' conversation memories

-- chat_memory
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat memory" ON public.chat_memory;
CREATE POLICY "Users manage own chat memory"
  ON public.chat_memory
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chat_examples
ALTER TABLE public.chat_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat examples" ON public.chat_examples;
CREATE POLICY "Users manage own chat examples"
  ON public.chat_examples
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
