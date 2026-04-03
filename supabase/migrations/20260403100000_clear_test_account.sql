-- Clear test account data
-- user_id: e1f8594a-a0a7-4d83-8c55-094a0c21086d
-- persona_id: 198141ab-a0de-4542-93c3-c3d28685dd68
-- Run this ONCE to reset the AdBrief test account to a clean state

DO $$
DECLARE
  v_user_id uuid := 'e1f8594a-a0a7-4d83-8c55-094a0c21086d';
  v_persona_id uuid := '198141ab-a0de-4542-93c3-c3d28685dd68';
BEGIN
  DELETE FROM public.chat_memory       WHERE user_id = v_user_id;
  DELETE FROM public.chat_messages     WHERE user_id = v_user_id;
  DELETE FROM public.daily_snapshots   WHERE user_id = v_user_id;
  DELETE FROM public.learned_patterns  WHERE user_id = v_user_id;
  DELETE FROM public.creative_memory   WHERE user_id = v_user_id;
  DELETE FROM public.chat_examples     WHERE user_id = v_user_id;
  DELETE FROM public.account_alerts    WHERE user_id = v_user_id;
  DELETE FROM public.analyses          WHERE user_id = v_user_id;
  DELETE FROM public.creative_entries  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Test account cleared: %', v_user_id;
END $$;
