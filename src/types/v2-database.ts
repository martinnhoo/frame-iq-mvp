// ================================================================
// ADBRIEF V2 — DATABASE TYPES
// Auto-maps to Supabase schema
// ================================================================

export type DecisionType = 'kill' | 'fix' | 'scale' | 'pattern' | 'alert' | 'insight';
export type DecisionStatus = 'pending' | 'acted' | 'dismissed' | 'expired';
export type ImpactType = 'waste' | 'savings' | 'revenue' | 'learning';
export type ImpactConfidence = 'high' | 'medium' | 'low';
export type AccountMaturity = 'new' | 'establishing' | 'mature';
export type ActionType =
  | 'pause_ad' | 'pause_adset' | 'pause_campaign'
  | 'reactivate_ad' | 'reactivate_adset'
  | 'increase_budget' | 'decrease_budget'
  | 'duplicate_ad' | 'generate_hook' | 'generate_variation';
export type ActionResult = 'pending' | 'success' | 'error' | 'rolled_back';
export type NotificationChannel = 'telegram' | 'email' | 'push' | 'in_app';
export type Trend = 'up' | 'down' | 'stable';

// ================================================================
// CORE ENTITIES
// ================================================================

export interface AdAccount {
  id: string;
  user_id: string;
  meta_account_id: string;
  name: string;
  currency: string;
  timezone: string;
  status: 'active' | 'paused' | 'disconnected' | 'error';
  last_fast_sync_at: string | null;
  last_full_sync_at: string | null;
  total_ads_synced: number;
  total_spend_30d: number;
  created_at: string;
}

export interface AccountBaseline {
  id: string;
  account_id: string;
  period_days: 7 | 30 | 90;
  ctr_p25: number;
  ctr_median: number;
  ctr_p75: number;
  ctr_p95: number;
  cpa_p25: number;
  cpa_median: number;
  cpa_p75: number;
  roas_p25: number;
  roas_median: number;
  roas_p75: number;
  spend_daily_avg: number;
  maturity: AccountMaturity;
  sample_size: number;
  calculated_at: string;
}

export interface Campaign {
  id: string;
  account_id: string;
  meta_campaign_id: string;
  name: string;
  objective: string | null;
  status: string;
  daily_budget: number | null;
}

export interface AdSet {
  id: string;
  campaign_id: string;
  account_id: string;
  meta_adset_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  targeting: Record<string, unknown>;
}

export interface Ad {
  id: string;
  ad_set_id: string;
  account_id: string;
  meta_ad_id: string;
  name: string;
  status: string;
  creative_id: string | null;
  effective_status: string | null;
}

export interface AdMetrics {
  id: string;
  ad_id: string;
  account_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number; // centavos
  conversions: number;
  revenue: number; // centavos
  ctr: number;
  cpc: number; // centavos
  cpa: number; // centavos
  roas: number;
  frequency: number;
  reach: number;
  video_views_3s: number;
  video_views_thruplay: number;
}

// ================================================================
// DECISION ENGINE
// ================================================================

export interface DecisionMetric {
  key: string;      // e.g., "CTR"
  value: string;    // e.g., "0.8%"
  context: string;  // e.g., "62% abaixo da média"
  trend: Trend;
}

export interface DecisionAction {
  id: string;
  label: string;           // e.g., "🛑 PARAR AGORA"
  type: 'destructive' | 'constructive' | 'neutral';
  requires_confirmation: boolean;
  meta_api_action?: string;
  params?: Record<string, unknown>;
}

export interface Decision {
  id: string;
  account_id: string;
  // ad_id is NULLABLE in reality — chat-emitted decisions (source='ai_chat')
  // can be created without a specific ad attached (e.g. broad strategy
  // recommendations). Engine-emitted decisions always have it. Kept the
  // joined `ad?:` field optional so handlers walk the chain defensively.
  ad_id: string | null;
  type: DecisionType;
  score: number;
  priority_rank: number;
  headline: string;
  reason: string;
  // Financial impact
  impact_type: ImpactType;
  impact_daily: number; // centavos
  impact_7d: number;
  impact_confidence: ImpactConfidence;
  impact_basis: string;
  // Structured
  metrics: DecisionMetric[];
  actions: DecisionAction[];
  // AI-generated recommendations
  action_recommendation: string | null;
  group_note: string | null;
  // State
  status: DecisionStatus;
  acted_at: string | null;
  dismissed_at: string | null;
  created_at: string;

  // ── Pipeline v2 fields ──
  // Financial verdict from the pipeline
  pipeline_approved?: boolean;
  financial_verdict?: 'profitable' | 'break_even' | 'losing' | 'unknown';
  break_even_roas?: number | null;
  margin_of_safety?: number | null;    // % above/below break-even
  // Risk & confidence (pipeline-computed)
  risk_level?: 'safe' | 'moderate' | 'high';
  data_confidence?: number;            // 0.0 to 1.0 (pipeline-computed)
  confidence_gate?: string;            // do_not_act | caution_only | moderate | high
  // Safety layer
  safety_status?: 'approved' | 'queued' | 'rejected' | 'needs_gradual';
  cooldown_active?: boolean;
  gradual_step?: number | null;
  rollback_plan?: string | null;
  // Explanation chain (transparent reasoning)
  explanation_chain?: {
    data_point: string;
    threshold: string;
    financial_check: string;
    safety_check: string;
    verdict: string;
  } | null;
  // Pipeline mode indicator
  pipeline_mode?: 'v1' | 'v2_shadow' | 'v2_active';

  // ── Decision Layer fields (chat-emitted decisions) ──
  /** Where the decision came from. Defaults to 'engine' for the legacy
   *  pipeline; AI-chat decisions get 'ai_chat'. Lets the Feed filter or
   *  badge by origin without mixing channels. */
  source?: 'engine' | 'ai_chat' | 'auto_pilot';
  /** Single-sentence falsifier — the condition under which this decision
   *  stops making sense. Mandatory on AI-chat decisions to force the
   *  model to commit to a measurable assumption. Example: "Se o CTR
   *  subir acima de 1.8% nas próximas 48h, esta recomendação se invalida."
   *  Surfaced verbatim in the DecisionCard so the user can sanity-check
   *  the logic before clicking. */
  invalidator?: string;
  /** Meta API target id at the level the decision targets (ad / adset /
   *  campaign). Chat-emitted decisions carry this in-memory but it is
   *  NOT persisted to the decisions table (no column). Click handlers
   *  read it as a fallback when the joined ad chain is absent. */
  target_meta_id?: string | null;
  target_id?: string | null;
  /** Optional human-readable name of the targeted entity. Used by the
   *  click handler's name-based lookup as final-resort recovery when
   *  target_meta_id is missing. Same caveat: not persisted to DB. */
  target_name?: string | null;

  // ── Narrative fields (chat-emitted enrichment) ──
  // These ride on the in-memory Decision object for richer cards but are NOT
  // persisted to the decisions table. The DecisionCard reads them when
  // present and falls back gracefully when absent (engine-emitted rows).

  /** Past-pattern hook: "users who saw X and acted got Y%". Surfaced as a
   *  purple-bordered evidence block above the reason text. */
  pattern_ref?: {
    impact_pct?: string;
    is_winner?: boolean;
    insight?: string;
  } | null;
  /** Forward-looking hook: current → expected, with a money tag. Surfaced as
   *  a cyan-bordered evidence block. */
  prediction?: {
    current_value?: string;
    expected_value?: string;
    estimated_impact?: string;
  } | null;
  /** 1-based rank within the day's queue. Card highlights #1 with a gold
   *  "ação mais importante agora" line and shows #2/#3 as a small ordinal. */
  priority_position?: number | null;
  /** Soft-urgency line emitted by the model — e.g. "spend acelerando, age
   *  até 18h". Rendered as a red micro-line under the evidence blocks. */
  urgency?: { message: string } | null;
  /** One-line plain-language gloss of the money math. Rendered as muted
   *  caption under the reason. */
  money_explanation?: string | null;
  /** Soft criticality tag set by chat decisions (engine uses priority_rank
   *  numerically; this string lets a chat decision flag itself as 'critical'
   *  even when the rank isn't yet computed). */
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;

  // Joined data (from queries)
  ad?: Ad & {
    ad_set?: AdSet & { campaign?: Campaign };
    creative?: Creative;
    latest_metrics?: AdMetrics;
  };
}

export interface Creative {
  id: string;
  account_id: string;
  meta_creative_id: string | null;
  format: 'image' | 'video' | 'carousel' | 'collection' | 'unknown';
  thumbnail_url: string | null;
  body: string | null;
  title: string | null;
  has_hook: boolean;
  hook_rate: number | null;
  has_cta: boolean;
}

// ================================================================
// ACTION LOG
// ================================================================

export interface ActionLog {
  id: string;
  user_id: string;
  account_id: string;
  decision_id: string | null;
  action_type: ActionType;
  target_type: 'ad' | 'adset' | 'campaign';
  target_meta_id: string;
  target_name: string | null;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  estimated_daily_impact: number | null;
  actual_impact_48h: number | null;
  result: ActionResult;
  error_message: string | null;
  rollback_available: boolean;
  rollback_expires_at: string | null;
  executed_at: string;
  validated_at: string | null;
}

// ================================================================
// MONEY TRACKER (retention anchor)
// ================================================================

export interface MoneyTracker {
  id: string;
  account_id: string;
  total_saved: number;           // centavos, lifetime, ONLY GOES UP
  total_revenue_captured: number;
  total_actions_taken: number;
  saved_today: number;
  revenue_today: number;
  leaking_now: number;           // current daily waste rate
  capturable_now: number;        // current daily opportunity
  active_days_streak: number;
  last_active_date: string | null;
  longest_streak: number;
}

// ================================================================
// PATTERNS
// ================================================================

export interface AccountPattern {
  id: string;
  account_id: string;
  pattern_type: string;
  title: string;
  description: string;
  sample_size: number;
  strength: number; // 0-1
  impact_percentage: number | null;
  status: 'active' | 'weak' | 'invalidated';
  discovered_at: string;
}

// ================================================================
// USER SETTINGS
// ================================================================

export interface UserSettings {
  id: string;
  user_id: string;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  email_notifications: boolean;
  sounds_enabled: boolean;
  auto_mode_enabled: boolean;
  auto_mode_kill_threshold: number;
  auto_mode_scale_threshold: number;
  language: string;
  onboarding_completed: boolean;
  first_scan_completed: boolean;
  first_action_completed: boolean;
}
