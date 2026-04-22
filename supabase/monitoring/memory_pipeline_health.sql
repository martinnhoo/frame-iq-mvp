-- Memory + Likes pipeline health dashboard
-- Run these queries in Supabase SQL Editor after deploying
-- extract-chat-memory + capture-learning. Each is self-contained.
--
-- Expected healthy baselines after 24h:
--   • chat_memory: +N rows per active user (N = 1-5 per conversation)
--   • chat_examples: +N rows per user who liked a response
--   • ai_memory: +N learnings from capture-learning pipeline
--
-- If counts are flat → pipeline is still broken.

-- ── 1. New memories in last 24 hours, grouped by user ────────────────────────
SELECT
  user_id,
  COUNT(*) AS new_memories,
  COUNT(*) FILTER (WHERE memory_type = 'preference') AS preferences,
  COUNT(*) FILTER (WHERE memory_type = 'decision')   AS decisions,
  COUNT(*) FILTER (WHERE memory_type = 'rule')       AS rules,
  COUNT(*) FILTER (WHERE memory_type = 'context')    AS context,
  MIN(created_at) AS first_memory,
  MAX(created_at) AS last_memory
FROM chat_memory
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY new_memories DESC
LIMIT 20;

-- ── 2. New liked-response examples (chat_examples) in last 24 hours ──────────
SELECT
  user_id,
  COUNT(*) AS new_likes,
  AVG(quality_score) AS avg_quality,
  MIN(created_at) AS first_like,
  MAX(created_at) AS last_like
FROM chat_examples
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY new_likes DESC
LIMIT 20;

-- ── 3. Daily funnel — how many chats produced memory extraction ──────────────
-- If chats >> memories_extracted, pipeline is leaking.
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS memories_saved
FROM chat_memory
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;

-- ── 4. ai_memory growth (learnings captured cross-session) ──────────────────
SELECT
  DATE_TRUNC('day', created_at) AS day,
  memory_type,
  COUNT(*) AS learnings_captured
FROM ai_memory
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day, memory_type
ORDER BY day DESC, learnings_captured DESC;

-- ── 5. Top users by total intelligence accumulated ───────────────────────────
-- A user who uses the AI heavily should have all four streams populated.
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(mem.cnt, 0) AS memories,
  COALESCE(ex.cnt, 0)  AS liked_examples,
  COALESCE(pat.cnt, 0) AS patterns,
  COALESCE(kno.cnt, 0) AS knowledge
FROM auth.users u
LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM chat_memory       GROUP BY user_id) mem ON mem.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM chat_examples     GROUP BY user_id) ex  ON ex.user_id  = u.id
LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM learned_patterns  GROUP BY user_id) pat ON pat.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM account_knowledge GROUP BY user_id) kno ON kno.user_id = u.id
WHERE (mem.cnt > 0 OR ex.cnt > 0 OR pat.cnt > 0 OR kno.cnt > 0)
ORDER BY (COALESCE(mem.cnt,0)+COALESCE(ex.cnt,0)+COALESCE(pat.cnt,0)+COALESCE(kno.cnt,0)) DESC
LIMIT 15;

-- ── 6. Pipeline health diagnostic — is anything stuck? ───────────────────────
-- If the counts below are all 0, the edge-function deploy didn't land
-- or adbrief-ai-chat isn't invoking the extractor at all.
SELECT
  (SELECT COUNT(*) FROM chat_memory   WHERE created_at > NOW() - INTERVAL '1 hour') AS memories_last_hour,
  (SELECT COUNT(*) FROM chat_examples WHERE created_at > NOW() - INTERVAL '1 hour') AS likes_last_hour,
  (SELECT COUNT(*) FROM ai_memory     WHERE created_at > NOW() - INTERVAL '1 hour') AS ai_memory_last_hour;
