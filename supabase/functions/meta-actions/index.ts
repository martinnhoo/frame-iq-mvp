// meta-actions v2 — pause/activate/budget/publish/duplicate via Meta Marketing API v21
// Now also writes to action_log so every action appears in Histórico
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Safety snapshot: last-7-days metrics for the target. Used by the pause
// guard so we don't blindly pause an ad that's actually converting (low CTR
// but generating leads/sales is a winning audience pattern, not a loser).
async function fetchRecentMetricsSnapshot(targetId: string, targetType: string, token: string): Promise<{
  conversions: number;
  spend: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
  days: number;
} | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const fields = "spend,clicks,impressions,ctr,actions,action_values,website_purchase_roas";
    // Same insights endpoint Meta uses for adset/ad/campaign — works at all 3 levels.
    const r = await fetch(`${BASE}/${targetId}/insights?fields=${fields}&time_range={"since":"${since}","until":"${today}"}&access_token=${token}`);
    const d = await r.json();
    const row = (d.data || [])[0];
    if (!row) return null;
    const spend = parseFloat(row.spend || "0");
    const ctr = parseFloat(row.ctr || "0") / 100; // Meta returns CTR as percentage already
    // Sum conversion-like actions
    const actions = (row.actions || []) as any[];
    const convTypes = ["purchase", "lead", "complete_registration", "app_install", "submit_application", "subscribe"];
    const conversions = actions
      .filter((a: any) => convTypes.includes(a.action_type))
      .reduce((s, a) => s + parseFloat(a.value || "0"), 0);
    const cpa = conversions > 0 ? spend / conversions : null;
    const roasArr = (row.website_purchase_roas || []) as any[];
    const roas = roasArr[0]?.value ? parseFloat(roasArr[0].value) : null;
    return { conversions, spend, ctr, cpa, roas, days: 7 };
  } catch {
    return null;
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

      // ── Pause safety guard ────────────────────────────────────────────────
      // Block pause when the target had real conversions in the last 7 days
      // unless the caller explicitly passed force:true. This prevents the AI
      // (or a hasty user) from killing a "low CTR but converting" winner —
      // small qualified audience, exactly the kind of ad that should NOT be
      // pausing on a CTR-only signal. Caller can override by re-sending the
      // request with force:true after seeing the snapshot.
      if (action === "pause" && !body.force) {
        const snapshot = await fetchRecentMetricsSnapshot(target_id, tType, token);
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
