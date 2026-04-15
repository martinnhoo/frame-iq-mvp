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
  ad_id: string;
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
  // State
  status: DecisionStatus;
  acted_at: string | null;
  dismissed_at: string | null;
  created_at: string;
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
