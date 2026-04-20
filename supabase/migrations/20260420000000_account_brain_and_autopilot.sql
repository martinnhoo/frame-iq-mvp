-- ============================================================================
-- AdBrief — Account Brain + Autopilot + Creative Loop Drafts
-- Unifica memória semântica da conta, infra de autopilot opt-in, e pipeline
-- de drafts gerados pelo loop criativo fechado.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. account_facts — memória semântica unificada da conta
-- Cada "fato" é uma afirmação confiável sobre a conta, com fonte e confiança.
-- Ex: (hook_type=UGC, works_best_with, audience=BR-25-35, 0.87, source=pattern)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_facts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fact_type    TEXT NOT NULL,          -- 'pattern' | 'causal' | 'rule' | 'insight' | 'preference' | 'outcome'
  subject      TEXT NOT NULL,          -- ex: "hook:UGC" | "audience:BR-25-35" | "ad:1234"
  predicate    TEXT NOT NULL,          -- ex: "works_best_with" | "caused" | "prefers" | "drove_roas"
  object       TEXT NOT NULL,          -- ex: "audience:BR-25-35" | "ctr_drop_12pct" | "short_videos"
  confidence   NUMERIC NOT NULL DEFAULT 0.5,  -- 0-1
  evidence     JSONB NOT NULL DEFAULT '{}',    -- { sample_size, period, metrics, source_ids }
  source       TEXT NOT NULL,          -- 'pattern' | 'chat' | 'action' | 'decision' | 'import' | 'autopilot'
  source_id    TEXT,                   -- reference back to origin (pattern_id, decision_id, etc)
  active       BOOLEAN NOT NULL DEFAULT true,
  superseded_by UUID REFERENCES account_facts(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_facts_user_active ON account_facts(user_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_account_facts_user_type ON account_facts(user_id, fact_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_account_facts_subject ON account_facts(user_id, subject);

ALTER TABLE account_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_facts_own ON account_facts;
CREATE POLICY account_facts_own ON account_facts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. autopilot_settings — opt-in per user, threshold de confiança + valor
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autopilot_settings (
  user_id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  accepted_terms_at        TIMESTAMPTZ,
  min_confidence           NUMERIC NOT NULL DEFAULT 0.95,   -- só age em decisões com confidence >= isso
  min_amount_at_risk_brl   NUMERIC NOT NULL DEFAULT 500,    -- só age se o valor em risco >= isso
  daily_action_cap         INTEGER NOT NULL DEFAULT 5,       -- máximo de ações por dia (safety)
  allowed_action_types     TEXT[] NOT NULL DEFAULT ARRAY['pause'::text], -- 'pause' | 'scale_budget' | 'reject'
  notify_telegram          BOOLEAN NOT NULL DEFAULT true,
  notify_email             BOOLEAN NOT NULL DEFAULT true,
  undo_window_hours        INTEGER NOT NULL DEFAULT 24,
  paused_until             TIMESTAMPTZ,                       -- user pode pausar sem desativar
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE autopilot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS autopilot_settings_own ON autopilot_settings;
CREATE POLICY autopilot_settings_own ON autopilot_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. autopilot_action_log — append-only log de toda ação autônoma
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autopilot_action_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_id       UUID,                          -- ref to decisions table
  action_type       TEXT NOT NULL,                 -- 'pause' | 'scale_budget' | 'reject'
  target_kind       TEXT NOT NULL,                 -- 'ad' | 'adset' | 'campaign'
  target_id         TEXT NOT NULL,                 -- meta object id
  target_name       TEXT,
  reason            TEXT NOT NULL,                 -- human-readable explanation
  confidence        NUMERIC NOT NULL,
  amount_at_risk_brl NUMERIC,
  payload           JSONB NOT NULL DEFAULT '{}',   -- snapshot of before/after state
  meta_api_response JSONB,
  status            TEXT NOT NULL DEFAULT 'executed',  -- 'executed' | 'undone' | 'failed'
  undone_at         TIMESTAMPTZ,
  undone_by         TEXT,                          -- 'user' | 'auto-rollback' | 'admin'
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_undo_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_autopilot_log_user_date ON autopilot_action_log(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_log_status ON autopilot_action_log(status, expires_undo_at);

ALTER TABLE autopilot_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS autopilot_log_own_select ON autopilot_action_log;
CREATE POLICY autopilot_log_own_select ON autopilot_action_log
  FOR SELECT USING (auth.uid() = user_id);

-- UPDATE allowed (user can undo own actions)
DROP POLICY IF EXISTS autopilot_log_own_update ON autopilot_action_log;
CREATE POLICY autopilot_log_own_update ON autopilot_action_log
  FOR UPDATE USING (auth.uid() = user_id);

-- INSERT only via service role (edge functions)
DROP POLICY IF EXISTS autopilot_log_service_insert ON autopilot_action_log;
CREATE POLICY autopilot_log_service_insert ON autopilot_action_log
  FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. creative_loop_drafts — drafts do loop criativo fechado, aguardando review
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creative_loop_drafts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type      TEXT NOT NULL,                  -- 'pattern' | 'winning_ad' | 'decision_scale'
  source_id        TEXT NOT NULL,                  -- pattern_id, ad_id, decision_id
  source_snapshot  JSONB NOT NULL DEFAULT '{}',    -- what the source looked like when generated
  brief            TEXT,                           -- Haiku-generated brief
  angle            TEXT,                           -- core angle the variation explores
  copy_variants    JSONB NOT NULL DEFAULT '[]',    -- [{ headline, primary, cta, hook_type }, ...]
  image_variants   JSONB NOT NULL DEFAULT '[]',    -- [{ url, prompt, model }, ...]
  predicted_score  INTEGER,                        -- 0-1000, from predictive_scores logic
  predicted_ctr    NUMERIC,
  predicted_roas   NUMERIC,
  status           TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'launched'
  approved_variant_index INTEGER,
  launched_ad_id   TEXT,                           -- meta ad id after launch
  launched_at      TIMESTAMPTZ,
  performance_7d   JSONB,                          -- filled 7d after launch
  performance_14d  JSONB,                          -- filled 14d after launch
  credits_used     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_drafts_user_status ON creative_loop_drafts(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_drafts_launched ON creative_loop_drafts(launched_at) WHERE launched_at IS NOT NULL;

ALTER TABLE creative_loop_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creative_drafts_own ON creative_loop_drafts;
CREATE POLICY creative_drafts_own ON creative_loop_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper: brain_context(user_id) — retorna payload unificado para AI calls
-- Agrega learned_patterns (top), creative_memory (top), user_ai_profile,
-- chat_memory (high importance) e account_facts (high confidence)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION brain_context(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patterns JSONB;
  v_facts JSONB;
  v_profile JSONB;
  v_recent_actions JSONB;
  v_winning_creatives JSONB;
BEGIN
  -- Top 10 winning patterns
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.confidence DESC), '[]'::jsonb) INTO v_patterns
  FROM (
    SELECT pattern_key, variables, avg_ctr, avg_roas, sample_size, confidence, is_winner, insight_text
    FROM learned_patterns
    WHERE user_id = p_user_id AND is_winner = true
    ORDER BY confidence DESC
    LIMIT 10
  ) p;

  -- Top 15 active account facts
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb ORDER BY f.confidence DESC), '[]'::jsonb) INTO v_facts
  FROM (
    SELECT fact_type, subject, predicate, object, confidence, evidence, source
    FROM account_facts
    WHERE user_id = p_user_id AND active = true
    ORDER BY confidence DESC, last_confirmed_at DESC
    LIMIT 15
  ) f;

  -- user_ai_profile (single row)
  SELECT to_jsonb(uap) INTO v_profile
  FROM user_ai_profile uap
  WHERE uap.user_id = p_user_id
  LIMIT 1;

  -- Last 5 autopilot actions
  SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb ORDER BY a.executed_at DESC), '[]'::jsonb) INTO v_recent_actions
  FROM (
    SELECT action_type, target_name, reason, confidence, status, executed_at
    FROM autopilot_action_log
    WHERE user_id = p_user_id
    ORDER BY executed_at DESC
    LIMIT 5
  ) a;

  -- Top 10 winning creatives by ROAS
  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb ORDER BY c.roas DESC NULLS LAST), '[]'::jsonb) INTO v_winning_creatives
  FROM (
    SELECT hook_type, hook_angle, market, platform, ctr, roas, conversions, creative_type
    FROM creative_entries
    WHERE user_id = p_user_id AND roas IS NOT NULL
    ORDER BY roas DESC NULLS LAST
    LIMIT 10
  ) c;

  RETURN jsonb_build_object(
    'patterns', COALESCE(v_patterns, '[]'::jsonb),
    'facts', COALESCE(v_facts, '[]'::jsonb),
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'recent_autopilot', COALESCE(v_recent_actions, '[]'::jsonb),
    'winning_creatives', COALESCE(v_winning_creatives, '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION brain_context TO authenticated;
GRANT EXECUTE ON FUNCTION brain_context TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Helper: undo_autopilot_action — marca como desfeita + reverte no Meta
-- (a execução real do revert fica no edge function, isso só marca)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_autopilot_undone(p_action_id UUID, p_undone_by TEXT DEFAULT 'user')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row autopilot_action_log%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM autopilot_action_log WHERE id = p_action_id;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'action not found');
  END IF;

  IF v_row.status != 'executed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'action is not in executed state', 'current_status', v_row.status);
  END IF;

  IF v_row.expires_undo_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'undo window expired', 'expired_at', v_row.expires_undo_at);
  END IF;

  UPDATE autopilot_action_log
  SET status = 'undone',
      undone_at = now(),
      undone_by = p_undone_by
  WHERE id = p_action_id;

  RETURN jsonb_build_object('success', true, 'action_id', p_action_id);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_autopilot_undone TO authenticated;
GRANT EXECUTE ON FUNCTION mark_autopilot_undone TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Auto-update timestamps
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_autopilot_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_autopilot_settings_updated ON autopilot_settings;
CREATE TRIGGER trg_autopilot_settings_updated
  BEFORE UPDATE ON autopilot_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_autopilot_settings();

CREATE OR REPLACE FUNCTION update_updated_at_creative_drafts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_creative_drafts_updated ON creative_loop_drafts;
CREATE TRIGGER trg_creative_drafts_updated
  BEFORE UPDATE ON creative_loop_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_creative_drafts();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Sync trigger: toda vez que um pattern vira winner, cria um account_fact
-- Isso une os dois sistemas de aprendizado sem dupla escrita manual.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_pattern_to_account_fact()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only propagate when pattern becomes a winner (transition false→true) or confidence jumps
  IF (TG_OP = 'INSERT' AND NEW.is_winner = true)
     OR (TG_OP = 'UPDATE' AND NEW.is_winner = true AND (OLD.is_winner IS DISTINCT FROM true OR NEW.confidence > COALESCE(OLD.confidence, 0) + 0.1)) THEN
    INSERT INTO account_facts (user_id, fact_type, subject, predicate, object, confidence, evidence, source, source_id)
    VALUES (
      NEW.user_id,
      'pattern',
      NEW.pattern_key,
      'is_winner',
      COALESCE(NEW.insight_text, 'performs above account average'),
      NEW.confidence,
      jsonb_build_object('avg_ctr', NEW.avg_ctr, 'avg_roas', NEW.avg_roas, 'sample_size', NEW.sample_size, 'variables', NEW.variables),
      'pattern',
      NEW.id::text
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pattern_fact ON learned_patterns;
CREATE TRIGGER trg_sync_pattern_fact
  AFTER INSERT OR UPDATE ON learned_patterns
  FOR EACH ROW EXECUTE FUNCTION sync_pattern_to_account_fact();
