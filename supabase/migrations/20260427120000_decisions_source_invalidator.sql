-- Decision Layer — extend `decisions` table with source + invalidator.
--
-- Additive only. Existing engine-pipeline writes are untouched (they get
-- the default 'engine' source). New AI-chat-emitted decisions populate
-- both fields when inserted via the Decision Layer flow.
--
-- WHY:
-- The chat assistant can now produce first-class structured decisions
-- (not just free-text recommendations or one-off meta_action blocks).
-- These decisions are persisted to the same `decisions` table the Feed
-- reads from, but tagged with source='ai_chat' so we can filter, badge,
-- or analyze them separately when needed.
--
-- The invalidator field forces the AI to commit to a falsifiable
-- assumption alongside every recommendation: "this stops making sense
-- if X happens". Surfaced verbatim in the DecisionCard so the user can
-- sanity-check the logic before clicking. Without this, recommendations
-- read as opinions; with it, they're testable hypotheses.

-- Source: where the decision originated.
--   'engine'    → legacy run-decision-engine pipeline (default)
--   'ai_chat'   → emitted by adbrief-ai-chat as a Block payload
--   'auto_pilot' → emitted by autopilot-executor (future)
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'engine';

-- Invalidator: single-sentence falsifier. NULL allowed because legacy
-- engine rows pre-date this field; AI-chat inserts always populate it.
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS invalidator TEXT;

-- Light index — Feed query may want to filter by source in future
-- (e.g. "show only engine decisions" toggle). Cheap to maintain since
-- source has very low cardinality.
CREATE INDEX IF NOT EXISTS idx_decisions_source ON decisions (source);
