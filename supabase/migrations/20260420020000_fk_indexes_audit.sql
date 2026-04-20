-- Foreign-key indexes identified in the 2026-04-20 audit.
-- These columns are filtered on in hot edge-function queries (capture-learning,
-- creative-loop, adbrief-ai-chat). Without indexes, a 1M-row table becomes a
-- sequential scan on every invocation. All indexes are IF NOT EXISTS so it's
-- safe to re-run.

create index concurrently if not exists idx_personas_user_id
  on public.personas (user_id);

create index concurrently if not exists idx_creative_memory_user_id
  on public.creative_memory (user_id);

create index concurrently if not exists idx_learned_patterns_user_id
  on public.learned_patterns (user_id);

create index concurrently if not exists idx_learned_patterns_persona_id
  on public.learned_patterns (persona_id)
  where persona_id is not null;

-- Composite index that matches the most common read pattern:
-- SELECT ... WHERE user_id = $1 AND is_winner ORDER BY confidence DESC LIMIT N
create index concurrently if not exists idx_learned_patterns_user_winner_confidence
  on public.learned_patterns (user_id, is_winner, confidence desc);
