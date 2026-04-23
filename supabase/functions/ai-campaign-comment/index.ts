/**
 * ai-campaign-comment — REAL analysis of a campaign/adset/ad after an action.
 *
 * When the user pauses, activates, edits budget, or duplicates something from
 * the CampaignsManager page, the UI calls this function to get an inline
 * comment from the AI. The comment is grounded on 30d + 7d Meta insights for
 * the specific object. No hallucinated numbers — Haiku only writes prose
 * around values we pulled from Meta.
 *
 * Request body:
 *   {
 *     user_id: string,
 *     persona_id?: string,
 *     target_id: string,          // meta campaign/adset/ad id
 *     target_type: 'campaign' | 'adset' | 'ad',
 *     action: 'pause' | 'activate' | 'update_budget' | 'duplicate',
 *     context?: { old_budget?, new_budget?, new_id? }   // optional extras
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     comment: string,                  // 1-3 sentence inline comment
 *     metrics: {                        // raw numbers the AI saw
 *       period_30d: { spend, impressions, clicks, ctr, cpm, cpc, purchases, revenue, roas },
 *       period_7d:  { same fields },
 *       delta_7d_vs_prev7: { ctr_pct, cpc_pct, roas_pct }
 *     },
 *     target: { id, name, status }
 *   }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";

const parseN = (v: any) => parseFloat(String(v ?? "0")) || 0;
const pct = (curr: number, prev: number) => (prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null);

function ok(data: object) {
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Extract purchase-event metrics from Meta insights actions array
function extractConversions(row: any): { purchases: number; revenue: number } {
  const actions: any[] = row?.actions || [];
  const values: any[] = row?.action_values || [];
  const purchaseTypes = new Set(["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);

  const purchases = actions
    .filter((a) => purchaseTypes.has(a?.action_type))
    .reduce((sum, a) => sum + parseN(a?.value), 0);
  const revenue = values
    .filter((v) => purchaseTypes.has(v?.action_type))
    .reduce((sum, v) => sum + parseN(v?.value), 0);
  return { purchases, revenue };
}

interface Period {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;        // %
  cpm: number;
  cpc: number;
  purchases: number;
  revenue: number;
  roas: number | null;
}

function aggregateInsights(rows: any[]): Period {
  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += parseN(r?.spend);
      acc.impressions += parseN(r?.impressions);
      acc.clicks += parseN(r?.clicks);
      const { purchases, revenue } = extractConversions(r);
      acc.purchases += purchases;
      acc.revenue += revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 },
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const roas = totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null;

  return {
    spend: Math.round(totals.spend * 100) / 100,
    impressions: Math.round(totals.impressions),
    clicks: Math.round(totals.clicks),
    ctr: Math.round(ctr * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    cpc: Math.round(cpc * 100) / 100,
    purchases: Math.round(totals.purchases),
    revenue: Math.round(totals.revenue * 100) / 100,
    roas: roas !== null ? Math.round(roas * 100) / 100 : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

  try {
    const body = await req.json();
    const { user_id, persona_id, target_id, target_type, action, context } = body || {};

    if (!user_id || !target_id || !target_type || !action) {
      return err("missing user_id, target_id, target_type, or action");
    }
    if (!["campaign", "adset", "ad"].includes(target_type)) {
      return err(`invalid target_type: ${target_type}`);
    }
    if (!["pause", "activate", "update_budget", "duplicate"].includes(action)) {
      return err(`invalid action: ${action}`);
    }

    if (!(await isUserAuthorized(req, sbAuth, user_id))) return unauthorizedResponse(cors);

    // ── Get Meta token ────────────────────────────────────────────────
    let conn: any = null;
    if (persona_id) {
      const { data } = await supabase
        .from("platform_connections" as any)
        .select("access_token")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active").eq("persona_id", persona_id)
        .maybeSingle();
      conn = data;
    }
    if (!conn?.access_token) {
      const { data } = await supabase
        .from("platform_connections" as any)
        .select("access_token")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active")
        .limit(1).maybeSingle();
      conn = data;
    }
    if (!conn?.access_token) {
      return ok({
        success: true,
        comment: "Ação registrada. (Conecte o Meta Ads em Contas para análise com dados reais.)",
        metrics: null,
        target: { id: target_id },
      });
    }
    const token = conn.access_token;

    // ── Fetch helper — 15s timeout + Meta error surfacing ──────────────
    // Meta Graph frequently returns HTTP 200 with { error: { code, message } }
    // in the body. Raw fetch() doesn't know this is an error. Without the
    // error check below we'd blindly call aggregateInsights([]) and tell
    // the user "sem dados" when the real issue is an expired token or a
    // rate limit — confusing during a client demo.
    async function fetchMeta(url: string, timeoutMs = 15000): Promise<any> {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) {
          throw new Error(`meta_http_${r.status}`);
        }
        const d = await r.json();
        if (d?.error) {
          const code = d.error.code ?? "?";
          const msg = String(d.error.message || "unknown").slice(0, 200);
          // Code 190 = OAuthException (expired / invalid token) — most
          // common failure mode. Label it so the caller can react.
          if (code === 190 || String(d.error.type || "").includes("OAuthException")) {
            throw new Error("meta_token_expired");
          }
          throw new Error(`meta_api_error_${code}: ${msg}`);
        }
        return d;
      } finally {
        clearTimeout(t);
      }
    }

    // ── Fetch target name + status ────────────────────────────────────
    let targetName: string | null = null;
    let targetStatus: string | null = null;
    try {
      const d = await fetchMeta(`${BASE}/${target_id}?fields=name,status,effective_status&access_token=${token}`);
      targetName = d?.name || null;
      targetStatus = d?.effective_status || d?.status || null;
    } catch {
      /* non-critical — continue without name/status */
    }

    // ── Fetch 30d + 7d insights for this specific object ──────────────
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const today = fmt(now);
    const since30 = fmt(new Date(now.getTime() - 30 * 86400000));
    const since7 = fmt(new Date(now.getTime() - 7 * 86400000));
    const sincePrev7 = fmt(new Date(now.getTime() - 14 * 86400000));
    const untilPrev7 = since7;

    const fields =
      "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,date_start";

    const insightsUrl = (since: string, until: string) =>
      `${BASE}/${target_id}/insights?fields=${fields}&time_range=${encodeURIComponent(
        JSON.stringify({ since, until }),
      )}&access_token=${token}`;

    // Parallel fetch with timeout + error surfacing. If Meta is down,
    // rate-limiting, or token expired, we throw a specific error up so
    // the client sees "reconecta Meta" or "tente de novo em 30s" —
    // not a silently-wrong "sem dados pra analisar".
    let d30: any, d7: any, dPrev7: any;
    try {
      [d30, d7, dPrev7] = await Promise.all([
        fetchMeta(insightsUrl(since30, today)),
        fetchMeta(insightsUrl(since7, today)),
        fetchMeta(insightsUrl(sincePrev7, untilPrev7)),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "meta_token_expired") {
        return new Response(
          JSON.stringify({
            error: "meta_token_expired",
            user_message: "Token do Meta Ads expirou. Reconecta a conta em Contas → Meta Ads.",
          }),
          { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          error: msg,
          user_message: "Não foi possível puxar dados do Meta agora. Tenta novamente em 30 segundos.",
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const period30 = aggregateInsights(d30?.data || []);
    const period7 = aggregateInsights(d7?.data || []);
    const periodPrev7 = aggregateInsights(dPrev7?.data || []);

    const delta = {
      ctr_pct: pct(period7.ctr, periodPrev7.ctr),
      cpc_pct: pct(period7.cpc, periodPrev7.cpc),
      roas_pct:
        period7.roas !== null && periodPrev7.roas !== null
          ? pct(period7.roas, periodPrev7.roas)
          : null,
      spend_pct: pct(period7.spend, periodPrev7.spend),
    };

    // Short-circuit: no spend at all in 30d → we can't say anything meaningful
    const hasSignal = period30.spend > 0 || period30.impressions > 0;

    // ── Generate Haiku comment ────────────────────────────────────────
    let comment = "";
    const label =
      target_type === "campaign" ? "campanha" : target_type === "adset" ? "conjunto" : "anúncio";
    const actionLabel =
      action === "pause" ? "pausada" :
      action === "activate" ? "ativada" :
      action === "update_budget" ? "com orçamento ajustado" :
      action === "duplicate" ? "duplicada" : "alterada";

    if (!hasSignal) {
      // Honest baseline — no data to analyze
      comment = `${capitalize(label)} ${actionLabel}. Ainda não há dados suficientes (gasto ou impressões) nos últimos 30 dias para avaliar o impacto.`;
    } else if (!ANTHROPIC) {
      // Deterministic fallback if key missing
      comment = buildDeterministicComment(label, actionLabel, period30, period7, delta, action, context);
    } else {
      const ctx = {
        target_type,
        target_name: targetName,
        action,
        action_context: context || null,
        period_30d: period30,
        period_7d: period7,
        period_prev_7d: periodPrev7,
        delta_7d_vs_prev_7d: delta,
      };

      const systemPrompt = `Você é um media buyer sênior do AdBrief.pro. O usuário acabou de executar uma ação numa ${label} no gerenciador.
Sua missão: escrever um comentário curto (1 a 3 frases, máximo 320 caracteres) explicando o impacto real dessa ação baseado APENAS nos números fornecidos.

REGRAS ABSOLUTAS:
- Nunca invente números. Só use os valores presentes no contexto.
- Seja direto, profissional e útil — evite jargão vazio.
- Se a ação foi "pause": avalie se foi uma boa decisão (ROAS baixo? CPC alto? frequência alta?) e diga por quê.
- Se a ação foi "activate": avalie o potencial (histórico recente, ROAS, tendência).
- Se a ação foi "update_budget": comente se o novo orçamento faz sentido dado o ROAS e a tendência.
- Se a ação foi "duplicate": comente o que deve ser testado de diferente na cópia.
- Se não tem dados suficientes, diga isso honestamente em uma frase.
- Sempre em português brasileiro.
- NUNCA use markdown, emojis ou quebras de linha. Texto corrido apenas.

Responda APENAS com o comentário, sem aspas, sem prefixo.`;

      try {
        const haikuRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 250,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: `Dados reais da ${label} (Meta Ads):\n${JSON.stringify(ctx, null, 2)}\n\nEscreva o comentário.`,
              },
            ],
          }),
        });

        if (haikuRes.ok) {
          const haikuData = await haikuRes.json();
          comment = (haikuData.content?.[0]?.text || "").trim();
        }
      } catch {
        /* fall through to deterministic */
      }

      if (!comment) {
        comment = buildDeterministicComment(label, actionLabel, period30, period7, delta, action, context);
      }
    }

    return ok({
      success: true,
      comment,
      metrics: {
        period_30d: period30,
        period_7d: period7,
        period_prev_7d: periodPrev7,
        delta_7d_vs_prev_7d: delta,
      },
      target: { id: target_id, name: targetName, status: targetStatus },
    });
  } catch (e: any) {
    return err(e?.message || "internal error", 500);
  }
});

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Deterministic fallback comment when Haiku is unavailable.
// Uses simple thresholds — this should rarely run, but guarantees a useful
// response even if the AI key is missing or the call fails.
function buildDeterministicComment(
  label: string,
  actionLabel: string,
  p30: Period,
  p7: Period,
  delta: { ctr_pct: number | null; cpc_pct: number | null; roas_pct: number | null; spend_pct: number | null },
  action: string,
  context: any,
): string {
  const parts: string[] = [`${capitalize(label)} ${actionLabel}.`];

  if (action === "pause") {
    if (p30.roas !== null && p30.roas < 1) {
      parts.push(`ROAS de ${p30.roas.toFixed(2)} em 30 dias justifica a pausa — gasto de R$${p30.spend.toFixed(0)} com retorno abaixo do breakeven.`);
    } else if (p7.roas !== null && delta.roas_pct !== null && delta.roas_pct < -20) {
      parts.push(`ROAS caiu ${Math.abs(delta.roas_pct).toFixed(0)}% nos últimos 7 dias (${p7.roas.toFixed(2)}) — pausa faz sentido para cortar prejuízo.`);
    } else if (p30.ctr < 0.8 && p30.impressions > 1000) {
      parts.push(`CTR baixo (${p30.ctr.toFixed(2)}%) em ${p30.impressions.toLocaleString("pt-BR")} impressões sugere fadiga — bom momento para pausar e testar novo criativo.`);
    } else if (p30.spend === 0) {
      parts.push("Sem gasto registrado no período — pausa é operacional, sem impacto financeiro.");
    } else {
      parts.push(`Verifique antes de escalar substituto: ROAS 30d foi ${p30.roas?.toFixed(2) ?? "n/d"}, CTR ${p30.ctr.toFixed(2)}%.`);
    }
  } else if (action === "activate") {
    if (p30.roas !== null && p30.roas >= 2) {
      parts.push(`Histórico forte: ROAS ${p30.roas.toFixed(2)} em 30 dias. Reativação tem base.`);
    } else if (p30.spend === 0) {
      parts.push("Sem histórico recente — monitore os próximos 3 dias de perto para validar performance.");
    } else {
      parts.push(`Histórico mediano (ROAS ${p30.roas?.toFixed(2) ?? "n/d"}, CTR ${p30.ctr.toFixed(2)}%) — defina um teto de gasto diário enquanto valida.`);
    }
  } else if (action === "update_budget") {
    const oldB = context?.old_budget;
    const newB = context?.new_budget;
    if (oldB && newB) {
      const ratio = newB / oldB;
      if (ratio > 1.5 && (p30.roas ?? 0) >= 2) {
        parts.push(`Aumento de ${((ratio - 1) * 100).toFixed(0)}% em cima de ROAS ${p30.roas?.toFixed(2)} faz sentido — mas monitore frequência e CPM nos próximos 3 dias.`);
      } else if (ratio > 1.5 && (p30.roas ?? 0) < 1.5) {
        parts.push(`Cuidado: escalou ${((ratio - 1) * 100).toFixed(0)}% em cima de ROAS ${p30.roas?.toFixed(2) ?? "n/d"}. O algoritmo pode gastar mais sem retorno proporcional.`);
      } else if (ratio < 0.8) {
        parts.push(`Redução de ${((1 - ratio) * 100).toFixed(0)}% — boa prática quando o ROAS está frágil. Próximo passo: diagnosticar por que o criativo não está escalando.`);
      } else {
        parts.push(`Ajuste moderado. Com ROAS atual de ${p30.roas?.toFixed(2) ?? "n/d"}, espere 2 a 3 dias antes de julgar o impacto.`);
      }
    } else {
      parts.push(`ROAS 30d: ${p30.roas?.toFixed(2) ?? "n/d"}. Aguarde 48h para validar a nova curva de performance.`);
    }
  } else if (action === "duplicate") {
    if (p30.ctr < 0.8) {
      parts.push(`CTR original (${p30.ctr.toFixed(2)}%) está baixo — na cópia, teste novo hook ou formato, não só ajuste de segmentação.`);
    } else if (p30.roas !== null && p30.roas >= 2) {
      parts.push(`Histórico forte (ROAS ${p30.roas.toFixed(2)}) — use a cópia para explorar novo público ou aumentar teto de orçamento.`);
    } else {
      parts.push("Aproveite para testar uma variável de cada vez na cópia — público, criativo ou orçamento — para saber o que moveu o resultado.");
    }
  }

  return parts.join(" ");
}
