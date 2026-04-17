// ── Chat types ────────────────────────────────────────────────────────────────

export type BlockType =
  | "insight" | "action" | "warning" | "hooks" | "navigate"
  | "tool_call" | "dashboard" | "meta_action" | "off_topic"
  | "dashboard_offer" | "limit_warning" | "text" | "trend_chart"
  | "proactive" | "pattern"
  | "credits_exhausted_free" | "credits_exhausted_paid";

export interface MetricItem {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}

export interface ChartData {
  type: "bar";
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface TrendData {
  dates: string[];
  ctr: number[];
  roas: number[];
  spend: number[];
}

export interface Block {
  type: BlockType;
  title: string;
  content?: string;
  items?: string[];
  // navigate
  route?: string;
  params?: Record<string, string>;
  cta?: string;
  // tool_call
  tool?: string;
  tool_params?: Record<string, string>;
  // meta_action
  meta_action?: string;
  target_id?: string;
  target_type?: string;
  target_name?: string;
  value?: string;
  // dashboard
  metrics?: MetricItem[];
  table?: { headers: string[]; rows: string[][] };
  chart?: ChartData;
  trend?: TrendData;
  // limit_warning
  remaining?: number;
  original_message?: string;
  will_hit_limit?: boolean;
  is_limit_warning?: boolean;
  // internal flags (not persisted)
  _pendingTool?: string;
  _toolParams?: Record<string, any>;
  _autoExec?: boolean;
  _synced?: boolean;
}

export interface AIMessage {
  id: number;
  ts: number;
  role: "user" | "assistant";
  userText?: string;
  blocks?: Block[];
  _synced?: boolean;
}

export type Lang = "pt" | "es" | "en";

export const LANG_LOCALE: Record<Lang, string> = {
  pt: "pt-BR",
  es: "es-MX",
  en: "en-US",
};
