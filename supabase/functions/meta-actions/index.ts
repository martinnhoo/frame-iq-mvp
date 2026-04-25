// meta-actions v2 — pause/activate/budget/publish/duplicate via Meta Marketing API v21
// Now also writes to action_log so every action appears in Histórico
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchSnapshot as fetchSharedSnapshot,
  snapshotToJsonb as sharedSnapshotToJsonb,
  type MetricsSnapshot as SharedSnapshot,
} from "../_shared/action-outcomes.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";

function ok(data: object) {
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
}
function errResp(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Map meta-actions action names to action_log action_type format
// `intent` is the frontend-provided refinement: for budget changes, tells
// us whether the user chose to increase or decrease. Without it we can't
// tell from the payload alone (old budget isn't required by Meta API).
function mapActionType(action: string, targetType: string, intent?: string | null): string {
  const t = targetType || "ad";
  switch (action) {
    case "pause": return `pause_${t}`;
    case "enable":
    case "publish": return `reactivate_${t}`;
    case "update_budget":
      if (intent === "decrease_budget") return "decrease_budget";
      if (intent === "increase_budget") return "increase_budget";
      return "change_budget"; // unknown diff — caller didn't pass intent
    case "duplicate": return `duplicate_${t}`;
    default: return action;
  }
}

// Fetch target info from Meta API
async function fetchTargetInfo(targetId: string, targetType: string, token: string): Promise<{ name: string | null; daily_budget: number | null }> {
  try {
    const fields = targetType === "ad" ? "name,adset_id" : "name,daily_budget";
    const r = await fetch(`${BASE}/${targetId}?fields=${fields}&access_token=${token}`);
    const d = await r.json();
    const budget = d.daily_budget ? Number(d.daily_budget) / 100 : null; // cents → reais
    return { name: d.name || null, daily_budget: budget };
  } catch {
    return { name: null, daily_budget: null };
  }
}

// Local alias to the shared snapshot type, plus a thin wrapper that calls
// the shared `fetchSnapshot` with a 7-day window — what meta-actions has
// always used at action time. Crons use different windows (24h, 72h)
// against taken_at; the shared helper covers both cases via parameters.
type MetricsSnapshot = SharedSnapshot;

async function fetchRecentMetricsSnapshot(targetId: string, targetType: string, token: string): Promise<MetricsSnapshot | null> {
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  return fetchSharedSnapshot(targetId, targetType, since, today, token, 7);
}

function snapshotToJsonb(snapshot: MetricsSnapshot | null): Record<string, any> {
  return sharedSnapshotToJsonb(snapshot);
}

// Old inline snapshot/parse/aggregate/jsonb implementations removed —
// moved to _shared/action-outcomes.ts so both meta-actions and the
// 24h/72h crons reuse the exact same logic. Wrappers above preserve
// the existing call-site signatures.

// ── action_outcomes helpers ──────────────────────────────────────────────
// Map runtime action+target_type to the canonical action_type_enum value
// stored in action_outcomes. Returns null when the action is read-only or
// unsupported by the enum (we skip writing outcomes for those).
function buildActionTypeEnum(
  action: string,
  targetType: string,
  oldValue?: number | null,
  newValue?: number | null,
): string | null {
  const t = (targetType || "ad").toLowerCase();
  if (action === "list_campaigns") return null;
  if (action === "publish") return null; // not a perf-impacting action; skip outcome row
  if (action === "pause" || action === "enable") {
    if (!["ad", "adset", "campaign"].includes(t)) return null;
    return `${action}_${t}`;
  }
  if (action === "update_budget") {
    if (oldValue != null && newValue != null) {
      return newValue > oldValue ? "budget_increase" : "budget_decrease";
    }
    return "budget_increase"; // default when intent unknown — flag for review
  }
  if (action === "duplicate") return "duplicate_ad";
  return null;
}

// Soft heuristic to derive a structured hypothesis from free-form
// ai_reasoning when the chat didn't pass one explicitly. Returns null
// for primary_cause when no signal matches — better to be honest about
// uncertainty than to write "unknown" that pollutes the learning dataset
// (per Martinho's Phase 2a refinement: pattern_candidate must depend on
// having a real cause, not on existence of a row).
function parseHypothesisFromReasoning(reasoning: string | null, action: string): {
  primary_cause: string | null;
  expected_effect: string | null;
  confidence: number | null;
} {
  const lc = (reasoning || "").toLowerCase();
  let primary_cause: string | null = null;
  if (/fadiga|frequ[êe]ncia|cansa[çc]o|saturad/.test(lc)) primary_cause = "creative_fatigue";
  else if (/hook|primeiros segundos|abertura|gancho/.test(lc)) primary_cause = "low_hook_strength";
  else if (/p[úu]blico|audi[êe]ncia|targeting|segmenta/.test(lc)) primary_cause = "wrong_audience";
  else if (/budget|or[çc]amento/.test(lc) && /baix|insuficient|sub-?escal/.test(lc)) primary_cause = "budget_starvation";
  else if (/track|pixel|atribui/.test(lc) && /(zero|sem|n[ãa]o\s+(?:est[áa]|h[áa])|0\b|gap|falh)/.test(lc)) primary_cause = "tracking_gap";
  else if (/cpa|custo\s+por/.test(lc) && /alto|acima|elevado|caro/.test(lc)) primary_cause = "high_cpa";
  else if (/ctr|cliques?|engajament/.test(lc) && /baix|caiu|abaixo|fraco/.test(lc)) primary_cause = "low_ctr";
  else if (/roas|retorno/.test(lc) && /baix|caiu|abaixo|fraco/.test(lc)) primary_cause = "low_roas";
  else if (/desperd[ií]cio|sangran|queim/.test(lc)) primary_cause = "spend_waste";
  else if (/winner|escal|performand/.test(lc) && /(bem|alto|forte|acima)/.test(lc)) primary_cause = "winning_signal";

  // expected_effect: deterministic from action — always set when action is known.
  let expected_effect: string | null = null;
  if (action === "pause") expected_effect = "stop_waste";
  else if (action === "enable") expected_effect = "scale_winner";
  else if (action === "update_budget") expected_effect = "improve_efficiency";
  else if (action === "duplicate") expected_effect = "scale_winner";

  return { primary_cause, expected_effect, confidence: null };
}

// Insert ONE row into action_outcomes. Fail-safe: never throws, never
// blocks the calling action. Logs errors for ops visibility.
async function writeActionOutcome(
  supabase: any,
  params: {
    user_id: string;
    persona_id?: string | null;
    action: string;          // raw action name from request
    target_type: string;     // ad|adset|campaign
    target_id: string;
    target_name?: string | null;
    source?: string | null;  // 'chat'|'feed'|'autopilot'|'manual'
    alert_id?: string | null;
    ai_reasoning?: string | null;
    hypothesis?: any | null; // chat-passed structured hypothesis takes precedence
    impact_snapshot?: number | null;
    metrics_before: any;     // already a JSONB object — see fetchRecentMetricsSnapshot
    old_budget?: number | null; // for update_budget direction inference
    new_budget?: number | null;
  },
): Promise<void> {
  try {
    const action_type = buildActionTypeEnum(
      params.action,
      params.target_type,
      params.old_budget,
      params.new_budget,
    );
    if (!action_type) return; // skip read-only / unsupported actions

    const target_level = (["ad", "adset", "campaign"].includes(params.target_type) ? params.target_type : "ad") as "ad" | "adset" | "campaign";

    // Hypothesis: prefer chat-passed structured one; fall back to heuristic.
    const hypothesis = (params.hypothesis && typeof params.hypothesis === "object" && params.hypothesis.primary_cause)
      ? params.hypothesis
      : parseHypothesisFromReasoning(params.ai_reasoning || null, params.action);

    // pattern_candidate triple gate — every row MUST clear all three to
    // be eligible for learned_patterns aggregation. Anything missing →
    // false → row still saved (for audit/history) but ignored by the
    // pattern aggregator. We err on the side of EXCLUDING here: a thin
    // dataset that we trust beats a fat dataset we don't.
    //
    // 1) Source must be human-driven. 'autopilot' would feed the AI its
    //    own recipes back as evidence — strict no. 'manager_manual'
    //    (clicked in the Manager UI), 'feed' (clicked from an alert
    //    card) and 'chat' (executed via AI chat) are all real human
    //    decisions and equally valid signal. 'manual' kept for legacy.
    const HUMAN_DRIVEN_SOURCES = new Set([
      "chat",
      "feed",
      "manager_manual",
      "manual",
    ]);
    const isHumanDriven =
      typeof params.source === "string" && HUMAN_DRIVEN_SOURCES.has(params.source);
    // 2) Hypothesis must name a concrete cause. We treat null/empty as
    //    "no signal" (correct — the parser returns null when nothing
    //    matched). We also explicitly reject 'unknown' because legacy
    //    code may still return that string; treating it as valid would
    //    poison the aggregation with rows we can't reason about.
    const hasValidCause =
      hypothesis &&
      typeof hypothesis === "object" &&
      typeof hypothesis.primary_cause === "string" &&
      hypothesis.primary_cause.length > 0 &&
      hypothesis.primary_cause !== "unknown";
    // 3) Snapshot at action time must contain real Meta data. Both an
    //    empty object (legacy fallback when fetch failed) and the
    //    explicit {no_data: true} marker (current shared helper) are
    //    rejected — without baseline metrics the 24h/72h delta is
    //    meaningless.
    const metricsBefore = params.metrics_before || {};
    const hasRealMetrics =
      metricsBefore &&
      typeof metricsBefore === "object" &&
      Object.keys(metricsBefore).length > 0 &&
      !(metricsBefore as any).no_data;
    const pattern_candidate = isHumanDriven && !!hasValidCause && !!hasRealMetrics;

    const row = {
      user_id: params.user_id,
      persona_id: params.persona_id || null,
      action_type,
      target_level,
      target_id: params.target_id,
      target_name: params.target_name || null,
      source: params.source || null,
      alert_id: params.alert_id || null,
      ai_reasoning: params.ai_reasoning || null,
      hypothesis,
      metrics_before: params.metrics_before || {},
      metrics_window: "d7",
      impact_snapshot: params.impact_snapshot ?? null,
      // metrics_after_*, delta_*, evaluation_metric, improved, recovery_pct
      // intentionally left null — crons populate them at 24h / 72h.
      pattern_candidate,
      // taken_at uses default now()
    };

    const { error } = await supabase.from("action_outcomes").insert(row);
    if (error) {
      console.error("[action_outcomes] insert failed:", error.message || error);
    } else {
      console.log("[action_outcomes] inserted", { action_type, target_id: params.target_id, source: params.source || null });
    }
  } catch (e) {
    console.error("[action_outcomes] writeActionOutcome threw:", (e as any)?.message || e);
  }
}

// For ads: estimate proportional daily impact from parent adset
async function estimateAdDailyImpact(targetId: string, token: string): Promise<number | null> {
  try {
    // Get parent adset_id
    const r1 = await fetch(`${BASE}/${targetId}?fields=adset_id&access_token=${token}`);
    const d1 = await r1.json();
    if (!d1.adset_id) return null;

    // Get adset daily_budget + count active ads
    const [budgetRes, adsRes] = await Promise.all([
      fetch(`${BASE}/${d1.adset_id}?fields=daily_budget&access_token=${token}`),
      fetch(`${BASE}/${d1.adset_id}/ads?fields=effective_status&limit=50&access_token=${token}`),
    ]);
    const budgetData = await budgetRes.json();
    const adsData = await adsRes.json();

    if (!budgetData.daily_budget) return null;
    const adsetBudget = Number(budgetData.daily_budget) / 100;
    const activeAds = (adsData.data || []).filter((a: any) => a.effective_status === "ACTIVE").length;
    if (activeAds <= 0) return null;

    return Math.round((adsetBudget / activeAds) * 100) / 100; // proportional share
  } catch {
    return null;
  }
}

// Write to action_log so it appears in Histórico de Ações
//
// The row is intentionally "fat" — History needs to show WHY an action
// happened, not just WHAT. We record:
//   • previous_state + new_state : both sides of the diff
//   • _ai_reasoning              : headline + reasoning shown in the Preview
//                                   panel before the user confirmed. This
//                                   is what turns History into a story
//                                   ("IA: sinais de fadiga, rotacionar
//                                   criativo") vs. a raw event log.
//   • _source                    : 'manager_manual' / 'autopilot' / …
//   • _intent                    : refined action (increase vs decrease
//                                   budget, for example)
//   • _action_label              : human-readable label ("Aumentar budget")
//   • _confirmed_at              : timestamp the user clicked Confirm
async function logToActionHistory(
  supabase: any,
  userId: string,
  action: string,
  targetId: string,
  targetType: string,
  targetName: string | null,
  previousState: object | null,
  newState: object | null,
  estimatedDailyImpact: number | null = null,
  aiReasoning: string | null = null,
  source: string | null = null,
  intent: string | null = null,
  actionLabel: string | null = null,
) {
  try {
    // Get user's ad_account id (our internal UUID)
    const { data: adAccount } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!adAccount?.id) {
      console.warn("[meta-actions] No ad_account found for user, skipping action_log");
      return;
    }

    const actionType = mapActionType(action, targetType, intent);

    // Enriched new_state includes the AI reasoning shown to the user before
    // they confirmed + where they clicked from + the user's refined
    // intent. Stored inline (JSONB) so no schema migration required.
    const enrichedNewState: Record<string, any> = { ...(newState || {}) };
    if (aiReasoning) enrichedNewState._ai_reasoning = aiReasoning;
    if (source) enrichedNewState._source = source;
    if (intent) enrichedNewState._intent = intent;
    if (actionLabel) enrichedNewState._action_label = actionLabel;
    enrichedNewState._confirmed_at = new Date().toISOString();

    const row: Record<string, any> = {
      account_id: adAccount.id,
      user_id: userId,
      action_type: actionType,
      target_type: targetType || "ad",
      target_meta_id: targetId,
      target_name: targetName,
      previous_state: previousState || {},
      new_state: enrichedNewState,
      result: "success",
      executed_at: new Date().toISOString(),
      rollback_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    if (estimatedDailyImpact && estimatedDailyImpact > 0) {
      row.estimated_daily_impact = estimatedDailyImpact;
    }
    await supabase.from("action_log").insert(row);
  } catch (e) {
    // Never block the response because of logging failure
    console.error("[meta-actions] Failed to write action_log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const {
      action, user_id, persona_id, account_id,
      target_id, target_type, value, old_value,
      ai_reasoning, source, intent,
      // action_outcomes inputs (Phase 2a):
      //  alert_id        — ties this action back to a Feed metric alert
      //  hypothesis      — structured AI reasoning (chat-emitted; may be null)
      //  impact_snapshot — R$ at risk from the alert system (frontend computes)
      alert_id, hypothesis, impact_snapshot,
    } = body;

    if (!user_id || !action) return errResp("missing user_id or action");

    // ── JWT auth — prevent user_id spoofing on write actions ──────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errResp("unauthorized", 401);
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.slice(7));
    if (!authUser || authUser.id !== user_id) return errResp("unauthorized", 401);

    // Get token — scoped to persona if provided, with fallback to any active connection
    let conn: any = null;
    if (persona_id) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token, ad_accounts")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active").eq("persona_id", persona_id)
        .maybeSingle();
      conn = data;
    }
    // Fallback: try without persona filter (covers persona mismatch or legacy connections)
    if (!conn?.access_token) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token, ad_accounts")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active")
        .limit(1).maybeSingle();
      conn = data;
    }

    if (!conn?.access_token) return errResp("Meta Ads não conectado. Conecte sua conta em Contas.");
    const token = conn.access_token;

    const post = async (path: string, payload: object) => {
      const r = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: token }),
      });
      return r.json();
    };

    // get — Meta Graph GET with 15s timeout. Returns the parsed JSON as-is;
    // caller is responsible for checking `.error` (all the list_* paths do).
    // We used to swallow timeouts silently, which produced the agency-
    // scenario "conjuntos não aparecem" bug: the frontend got an empty
    // adset list and assumed the campaign had none, instead of surfacing
    // that Meta timed out.
    const get = async (path: string) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(`${BASE}/${path}&access_token=${token}`, { signal: ctrl.signal });
        const d = await r.json();
        if (!r.ok && !d?.error) {
          // Response was non-2xx but body doesn't carry a Meta error — synthesize one
          return { error: { message: `HTTP ${r.status}`, code: r.status } };
        }
        return d;
      } catch (e: any) {
        return { error: { message: e?.name === "AbortError" ? "Meta API timeout (15s)" : (e?.message || "fetch failed") } };
      } finally {
        clearTimeout(tid);
      }
    };

    // ── Validate target_id for write actions ────────────────────────────
    const WRITE_ACTIONS = ["pause", "enable", "update_budget", "publish", "duplicate"];
    if (WRITE_ACTIONS.includes(action) && (!target_id || target_id === "undefined" || target_id === "null")) {
      return errResp(`target_id obrigatório para ação "${action}". Peça ao usuário identificar o item ou use list_campaigns primeiro.`);
    }

    // ── Write actions (pause, enable, budget, publish, duplicate) ────────

    if (action === "pause" || action === "enable") {
      const status = action === "pause" ? "PAUSED" : "ACTIVE";
      const tType = target_type || "ad";

      // Fetch info before action
      const info = await fetchTargetInfo(target_id, tType, token);
      const targetName = body.target_name || info.name;

      // Snapshot is needed both for the pause safety guard AND for the
      // action_outcomes row. Fetch it once here so we don't double-call
      // Meta in the common pause path. enable also gets it (cheap, one
      // request) so the outcome row has full multi-metric context.
      let metricsSnapshot = await fetchRecentMetricsSnapshot(target_id, tType, token);

      // ── Pause safety guard ────────────────────────────────────────────────
      // Block pause when the target had real conversions in the last 7 days
      // unless the caller explicitly passed force:true. This prevents the AI
      // (or a hasty user) from killing a "low CTR but converting" winner —
      // small qualified audience, exactly the kind of ad that should NOT be
      // pausing on a CTR-only signal. Caller can override by re-sending the
      // request with force:true after seeing the snapshot.
      if (action === "pause" && !body.force) {
        const snapshot = metricsSnapshot;
        if (snapshot && snapshot.conversions > 0) {
          return ok({
            success: false,
            blocked: true,
            requires_force: true,
            target_id,
            target_name: targetName,
            snapshot,
            // Human-readable summary the frontend can show in the
            // override-confirmation modal.
            warning: `Esse anúncio teve ${snapshot.conversions.toFixed(0)} conversões em ${snapshot.days}d (R$ ${snapshot.spend.toFixed(2)} gastos${snapshot.cpa ? `, CPA R$ ${snapshot.cpa.toFixed(2)}` : ''}${snapshot.roas ? `, ROAS ${snapshot.roas.toFixed(2)}x` : ''}). CTR baixo + conversão = audiência pequena qualificada, geralmente é WINNER. Pausar mesmo assim?`,
            message: "Pause bloqueado por segurança — anúncio está convertendo. Reenvie com force:true pra confirmar.",
          }, 200);
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      // Estimate daily impact for pause actions
      let dailyImpact: number | null = null;
      if (action === "pause") {
        if (tType === "ad") {
          dailyImpact = await estimateAdDailyImpact(target_id, token);
        } else {
          dailyImpact = info.daily_budget; // campaign/adset: direct budget
        }
      }

      const d = await post(target_id, { status });
      if (d.error) return errResp(d.error.message);

      // Log to action_log (non-blocking) — includes AI reasoning shown before confirm
      const actionLabel = action === "pause" ? "Pausar" : "Ativar";
      logToActionHistory(supabase, user_id, action, target_id, tType, targetName,
        { status: action === "pause" ? "ACTIVE" : "PAUSED" },
        { status },
        dailyImpact,
        ai_reasoning || null,
        source || null,
        null,
        actionLabel,
      );

      // ── Phase 2a: write to action_outcomes (causal-memory dataset) ──
      // Fire-and-forget; never blocks the action. Crons populate
      // metrics_after_24h / 72h and compute deltas.
      writeActionOutcome(supabase, {
        user_id,
        persona_id,
        action,
        target_type: tType,
        target_id,
        target_name: targetName,
        source,
        alert_id,
        ai_reasoning,
        hypothesis,
        impact_snapshot,
        metrics_before: snapshotToJsonb(metricsSnapshot),
      });

      const label = target_type === "campaign" ? "Campanha" : target_type === "adset" ? "Conjunto" : "Anúncio";
      return ok({ success: true, status, target_id, message: `${label} ${action === "pause" ? "pausado" : "ativado"} com sucesso.` });
    }

    if (action === "update_budget") {
      if (!value) return errResp("value required");
      const cents = Math.round(parseFloat(String(value)) * 100);
      const oldCents = old_value !== undefined && old_value !== null
        ? Math.round(parseFloat(String(old_value)) * 100)
        : null;
      const budgetField = (body.budget_type === "lifetime") ? "lifetime_budget" : "daily_budget";
      const info = await fetchTargetInfo(target_id, target_type || "campaign", token);
      const targetName = body.target_name || info.name;
      const d = await post(target_id, { [budgetField]: cents });
      if (d.error) return errResp(d.error.message);

      // Human-readable label for the history row. The intent is what the
      // user chose in the UI (↑ or ↓) — we trust it. If the caller didn't
      // pass intent, derive it from the diff.
      const resolvedIntent = intent
        || (oldCents !== null && cents > oldCents ? "increase_budget"
            : oldCents !== null && cents < oldCents ? "decrease_budget"
            : "change_budget");
      const actionLabel = resolvedIntent === "increase_budget" ? "Aumentar budget"
        : resolvedIntent === "decrease_budget" ? "Reduzir budget"
        : "Ajustar budget";

      // previous_state now carries the real old value so Histórico can
      // show "R$50,00/dia → R$80,00/dia" (the old "{}" was useless).
      const prevState: Record<string, any> = {};
      if (oldCents !== null) prevState[budgetField] = oldCents;

      logToActionHistory(supabase, user_id, action, target_id, target_type || "campaign", targetName,
        prevState,
        { [budgetField]: cents },
        null,
        ai_reasoning || null,
        source || null,
        resolvedIntent,
        actionLabel,
      );

      // ── Phase 2a: action_outcomes for budget change ──
      // Fetch metrics snapshot here (we don't have one yet at this branch).
      // Pass old/new budget so buildActionTypeEnum picks the right enum
      // value (budget_increase vs budget_decrease).
      const budgetSnapshot = await fetchRecentMetricsSnapshot(target_id, target_type || "campaign", token);
      const budgetMetrics = snapshotToJsonb(budgetSnapshot);
      // Always include both budget sides for the diff, even when snapshot failed.
      (budgetMetrics as any).old_budget_cents = oldCents;
      (budgetMetrics as any).new_budget_cents = cents;
      writeActionOutcome(supabase, {
        user_id,
        persona_id,
        action,
        target_type: target_type || "campaign",
        target_id,
        target_name: targetName,
        source,
        alert_id,
        ai_reasoning,
        hypothesis,
        impact_snapshot,
        old_budget: oldCents,
        new_budget: cents,
        metrics_before: budgetMetrics,
      });

      const label = budgetField === "lifetime_budget" ? "vitalício" : "/dia";
      return ok({ success: true, target_id, new_budget: value, message: `Orçamento atualizado para R$${value}${label}.` });
    }

    if (action === "publish") {
      const info = await fetchTargetInfo(target_id, target_type || "ad", token);
      const targetName = body.target_name || info.name;
      const d = await post(target_id, { status: "ACTIVE" });
      if (d.error) return errResp(d.error.message);

      logToActionHistory(supabase, user_id, action, target_id, target_type || "ad", targetName,
        { status: "PAUSED" },
        { status: "ACTIVE" },
        null,
        ai_reasoning || null,
        source || null,
        null,
        "Publicar",
      );

      return ok({ success: true, target_id, message: `Publicado e definido como ATIVO.` });
    }

    if (action === "duplicate") {
      const info = await fetchTargetInfo(target_id, target_type || "ad", token);
      const targetName = body.target_name || info.name;
      const copyEndpoint = `${target_id}/copies`;
      const d = await post(copyEndpoint, { deep_copy: true, status_option: "PAUSED" });
      if (d.error) return errResp(d.error.message);
      // Meta returns different id field per level:
      //   campaign → copied_campaign_id
      //   adset    → copied_adset_id
      //   ad       → copied_ad_id
      const newId = d.copied_campaign_id || d.copied_adset_id || d.copied_ad_id || d.id;

      logToActionHistory(supabase, user_id, action, target_id, target_type || "ad", targetName,
        {},
        { new_id: newId, status: "PAUSED" },
        null,
        ai_reasoning || null,
        source || null,
        null,
        "Duplicar",
      );

      // ── Phase 2a: action_outcomes for duplicate ──
      // Snapshot is the SOURCE ad's metrics — the duplicated copy starts
      // fresh, but we want to know what we cloned from for later analysis
      // ("user duplicates winners 80% of the time" type insights).
      const dupSnapshot = await fetchRecentMetricsSnapshot(target_id, target_type || "ad", token);
      const dupMetrics = snapshotToJsonb(dupSnapshot);
      (dupMetrics as any).copied_to_id = newId;
      writeActionOutcome(supabase, {
        user_id,
        persona_id,
        action,
        target_type: target_type || "ad",
        target_id,                       // SOURCE id, not the new copy
        target_name: targetName,
        source,
        alert_id,
        ai_reasoning,
        hypothesis,
        impact_snapshot,
        metrics_before: dupMetrics,
      });

      return ok({ success: true, new_id: newId, message: `Duplicado e pausado. Novo ID: ${newId}` });
    }

    // ── Read-only actions (no logging needed) ────────────────────────────

    if (action === "list_campaigns") {
      const accs = (conn.ad_accounts as any[]) || [];

      // Prefer the account_id passed in the body (respects the user's selected
      // account in the dashboard). Fall back to first-active for legacy callers
      // (AI chat tool-calls don't pass account_id).
      let acc: any = null;
      if (account_id) {
        const wantedRaw = String(account_id);
        const wanted = wantedRaw.startsWith("act_") ? wantedRaw.slice(4) : wantedRaw;
        acc = accs.find((a: any) => {
          const aid = String(a?.id ?? a?.account_id ?? "");
          const bare = aid.startsWith("act_") ? aid.slice(4) : aid;
          return bare === wanted;
        });
        // Soft-fail: if the caller requested an account that isn't in this
        // connection's list, don't silently return a different account's
        // campaigns — tell them.
        if (!acc) {
          return errResp(`account_id ${account_id} não está vinculado a esta conexão Meta.`);
        }
      } else {
        acc = accs.find((a: any) => a.account_status === 1) || accs[0];
        if (!acc) return errResp("No active ad account");
      }

      const rawId = String(acc.id ?? acc.account_id ?? "");
      const accId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
      const d = await get(`${accId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, campaigns: d.data || [] });
    }

    if (action === "list_adsets") {
      const d = await get(`${target_id}/adsets?fields=id,name,status,daily_budget,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, adsets: d.data || [] });
    }

    if (action === "list_ads") {
      const d = await get(`${target_id}/ads?fields=id,name,status,effective_status&limit=30`);
      if (d.error) return errResp(d.error.message);
      return ok({ success: true, ads: d.data || [] });
    }

    return errResp(`Unknown action: ${action}`);

  } catch (e: any) {
    return errResp(e.message || "internal error");
  }
});
