// preview-action — read-only AI analysis of a proposed manual action.
//
// Flow (opposite of ai-campaign-comment, which runs AFTER execution):
//   1. User clicks Pausar/Duplicar/Ajustar budget in Gerenciador manual
//   2. Frontend calls this fn BEFORE sending the command to Meta
//   3. This fn pulls context (days running, spend, conversions, CTR, freq,
//      CPA vs goal, trend) and runs two layers of judgment:
//        a) Deterministic guardrails (fast, predictable) — catch the
//           obvious "nope, too early" cases without an AI call.
//        b) AI fallback for ambiguous cases — gives contextual reasoning.
//   4. Returns a verdict + reasoning + alternatives.
//   5. Frontend shows the analysis and asks the user to confirm.
//
// Input:
//   { user_id, persona_id, target_id, target_type: 'campaign'|'adset'|'ad',
//     proposed_action: 'pause'|'activate'|'duplicate'|'increase_budget'|'decrease_budget',
//     proposed_budget_cents?: number   // for budget changes
//   }
//
// Output:
//   {
//     verdict: 'recommend' | 'reject' | 'wait' | 'depends',
//     verdict_label: string,
//     headline: string,
//     reasoning: string,
//     context: {
//       days_running: number, spend_cents: number, clicks: number,
//       conversions: number, cpa_cents: number|null, ctr: number,
//       freq: number, status: string, name: string,
//     },
//     alternatives: string[],
//     target_cpa_cents?: number,
//   }
//
// Never writes to Meta or action_log. Pure preview.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://graph.facebook.com/v21.0";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

type ProposedAction =
  | "pause"
  | "activate"
  | "duplicate"
  | "increase_budget"
  | "decrease_budget";

type Verdict = "recommend" | "reject" | "wait" | "depends";

interface Context {
  days_running: number;
  days_with_spend: number;
  spend_cents: number;
  clicks: number;
  conversions: number;
  cpa_cents: number | null;
  ctr: number;          // percentage (e.g. 1.8 = 1.8%)
  freq: number;
  status: string;
  effective_status: string;
  name: string;
  trend: "up" | "down" | "flat" | null;  // CTR trend over period
}

// ── Conversion family (reuse from live-metrics) ─────────────────────────────
const CONVERSION_TYPES = [
  "lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped",
  "purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase",
  "complete_registration", "completed_registration",
  "offsite_conversion.fb_pixel_complete_registration",
  "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart",
  "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout",
  "contact", "offsite_conversion.fb_pixel_contact",
  "subscribe", "offsite_conversion.fb_pixel_subscribe",
  "schedule", "offsite_conversion.fb_pixel_schedule",
  "submit_application", "offsite_conversion.fb_pixel_submit_application",
];

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function fetchMeta(url: string, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const d = await r.json();
    if (!r.ok && !d?.error) throw new Error(`meta_http_${r.status}`);
    if (d?.error) {
      if (d.error.code === 190) throw new Error("meta_token_expired");
      throw new Error(`meta_api_error: ${d.error.message || "unknown"}`);
    }
    return d;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pull the last 30 days of insights for the target + its create/start time so
 * we can compute "days running". Tries object-level create_time first
 * (available for campaigns/adsets/ads), falls back to earliest date_start.
 */
async function buildContext(
  targetId: string,
  targetType: "campaign" | "adset" | "ad",
  token: string,
): Promise<Context> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const since7  = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];

  // Basic info — name + status + created_time
  const infoFields = targetType === "ad"
    ? "name,status,effective_status,created_time"
    : targetType === "adset"
      ? "name,status,effective_status,created_time"
      : "name,status,effective_status,created_time";
  const info = await fetchMeta(`${BASE}/${targetId}?fields=${infoFields}&access_token=${token}`);

  const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,date_start";
  const insightsUrl = (since: string, until: string, inc = "") =>
    `${BASE}/${targetId}/insights?fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}${inc ? `&time_increment=${inc}` : ""}&access_token=${token}`;

  // Daily breakdown (30d) to count days_with_spend and compute trend
  const daily = await fetchMeta(insightsUrl(since30, today, "1")).catch(() => ({ data: [] }));
  const period30 = await fetchMeta(insightsUrl(since30, today)).catch(() => ({ data: [] }));
  const last7 = await fetchMeta(insightsUrl(since7, today)).catch(() => ({ data: [] }));
  const prev7 = await fetchMeta(insightsUrl(since14, since7)).catch(() => ({ data: [] }));

  const agg = period30.data?.[0] || {};
  const spend_cents = Math.round((parseFloat(agg.spend || "0") || 0) * 100);
  const clicks = parseInt(agg.clicks || "0") || 0;
  const ctr = parseFloat(agg.ctr || "0") || 0;
  const freq = parseFloat(agg.frequency || "0") || 0;

  // Conversions across all alias types (matches our live-metrics logic)
  let conversions = 0;
  for (const a of (agg.actions || [])) {
    if (CONVERSION_TYPES.includes(a.action_type)) {
      conversions += parseFloat(a.value || "0") || 0;
    }
  }

  const cpa_cents = conversions > 0 ? Math.round(spend_cents / conversions) : null;

  // Days running — prefer created_time from Meta, fall back to first spending day
  let days_running = 0;
  if (info?.created_time) {
    const created = new Date(info.created_time).getTime();
    days_running = Math.max(0, Math.floor((now.getTime() - created) / 86400000));
  }
  const spendingDays = (daily.data || []).filter((d: any) => parseFloat(d.spend || "0") > 0);
  const days_with_spend = spendingDays.length;
  if (days_running === 0 && days_with_spend > 0) {
    // Fall back: earliest spend date
    const earliest = spendingDays.reduce((min: string, d: any) =>
      d.date_start < min ? d.date_start : min, spendingDays[0].date_start);
    days_running = Math.max(1, Math.floor((now.getTime() - new Date(earliest).getTime()) / 86400000));
  }

  // Trend: last7 CTR vs prev7 CTR
  const ctr7 = parseFloat(last7.data?.[0]?.ctr || "0") || 0;
  const ctrPrev = parseFloat(prev7.data?.[0]?.ctr || "0") || 0;
  let trend: "up" | "down" | "flat" | null = null;
  if (ctr7 > 0 && ctrPrev > 0) {
    const delta = (ctr7 - ctrPrev) / ctrPrev;
    trend = delta > 0.08 ? "up" : delta < -0.08 ? "down" : "flat";
  }

  return {
    days_running,
    days_with_spend,
    spend_cents,
    clicks,
    conversions,
    cpa_cents,
    ctr,
    freq,
    status: info?.status || "UNKNOWN",
    effective_status: info?.effective_status || info?.status || "UNKNOWN",
    name: info?.name || targetId,
    trend,
  };
}

/**
 * Deterministic pre-AI rules. Returns a verdict + reasoning when the
 * situation is unambiguous (e.g. "pause a 1-day campaign" is always wait,
 * no judgment call required). Returns null to let the AI handle it.
 */
function evaluateRules(
  ctx: Context,
  action: ProposedAction,
  targetCpaCents: number | null,
): {
  verdict: Verdict;
  headline: string;
  reasoning: string;
  alternatives: string[];
} | null {
  const daysActual = Math.max(ctx.days_running, ctx.days_with_spend);
  const brl = (c: number) => (c / 100).toFixed(2).replace(".", ",");

  // ── PAUSE rules ────────────────────────────────────────────────────────
  if (action === "pause") {
    // Fresh campaign — don't pause, attribution still stabilizing
    if (daysActual > 0 && daysActual < 3) {
      return {
        verdict: "wait",
        headline: `Muito cedo pra pausar — rodando há ${daysActual} dia${daysActual === 1 ? "" : "s"}`,
        reasoning:
          `A janela de atribuição do Meta (24-72h) ainda não fechou. Pausar agora significa descartar a fase de aprendizado inteira — o algoritmo mal começou a calibrar.`,
        alternatives: [
          "Aguardar mais 2-3 dias e reavaliar com dados estabilizados",
          "Ajustar budget em vez de pausar, se o problema é ritmo de gasto",
          "Abrir o chat da IA pra diagnosticar o que você tá vendo que incomoda",
        ],
      };
    }

    // Performing — converting AND CPA within target (if defined)
    if (ctx.conversions >= 3 && ctx.cpa_cents !== null) {
      const withinTarget = targetCpaCents === null || ctx.cpa_cents <= targetCpaCents;
      if (withinTarget) {
        return {
          verdict: "reject",
          headline: `Campanha performando — pausar é jogar resultado fora`,
          reasoning:
            `CPA em R$ ${brl(ctx.cpa_cents)}${targetCpaCents ? ` (meta: R$ ${brl(targetCpaCents)})` : ""} com ${ctx.conversions.toFixed(0)} conversões em ${ctx.days_with_spend} dia(s) de entrega. Isso é uma campanha saudável.`,
          alternatives: [
            `Aumentar budget em 20-30% pra escalar o que já funciona`,
            `Duplicar com novo criativo em paralelo pra evitar fadiga`,
            `Só pausar se há motivo não-performance (saturação de público, rotatividade)`,
          ],
        };
      }
    }

    // Clear failure: 7+ days, material spend, 0 conversions
    if (daysActual >= 7 && ctx.spend_cents > 50000 && ctx.conversions === 0) {
      return {
        verdict: "recommend",
        headline: `Pode pausar — ${daysActual} dias, R$ ${brl(ctx.spend_cents)} e zero conversão`,
        reasoning:
          `Passou da fase de aprendizado e não entregou resultado. Frequência em ${ctx.freq.toFixed(1)}x e CTR ${ctx.ctr.toFixed(2)}% confirmam que o criativo não está conectando.`,
        alternatives: [
          "Pausar e criar variação com novo hook",
          "Analisar se o público tá mal segmentado antes de descartar o criativo",
        ],
      };
    }
  }

  // ── INCREASE BUDGET rules ──────────────────────────────────────────────
  if (action === "increase_budget") {
    if (daysActual > 0 && daysActual < 3) {
      return {
        verdict: "wait",
        headline: `Cedo demais pra escalar — ${daysActual} dia${daysActual === 1 ? "" : "s"} de entrega`,
        reasoning:
          `Escalar antes da fase de aprendizado terminar (3-5 dias) costuma inflar CPA em 40-80% porque o algoritmo perde a calibração e reentra em aprendizado. Dinheiro perdido.`,
        alternatives: [
          "Aguardar CPA estabilizar por pelo menos 3 dias antes de escalar",
          "Duplicar o conjunto com +budget em vez de editar — preserva o aprendizado",
        ],
      };
    }

    // If conversions=0 and we're in learning
    if (ctx.conversions === 0 && ctx.spend_cents > 30000) {
      return {
        verdict: "reject",
        headline: `Zero conversão — escalar vai multiplicar o erro`,
        reasoning:
          `Com ${daysActual} dia(s) e R$ ${brl(ctx.spend_cents)} gastos sem converter, aumentar budget é apostar mais fichas num criativo/público que ainda não performou.`,
        alternatives: [
          "Diagnosticar o motivo das 0 conversões (tracking? público? hook?) antes de escalar",
          "Testar variação de criativo em paralelo em vez de aumentar o existente",
        ],
      };
    }
  }

  // ── DECREASE BUDGET rules ──────────────────────────────────────────────
  if (action === "decrease_budget") {
    if (ctx.conversions >= 3 && ctx.cpa_cents !== null &&
        (targetCpaCents === null || ctx.cpa_cents <= targetCpaCents)) {
      return {
        verdict: "reject",
        headline: `Está performando — reduzir budget corta resultado`,
        reasoning:
          `CPA em R$ ${brl(ctx.cpa_cents)} com ${ctx.conversions.toFixed(0)} conversões. Reduzir budget aqui é voluntariamente entregar menos resultado.`,
        alternatives: [
          "Manter budget se a meta está sendo batida",
          "Pausar outros conjuntos ruins em vez de cortar esse",
        ],
      };
    }
  }

  // ── DUPLICATE is almost always safe ────────────────────────────────────
  if (action === "duplicate") {
    return {
      verdict: "recommend",
      headline: `Duplicar preserva o original e testa a variação em paralelo`,
      reasoning:
        `Duplicar é ação de baixo risco — Meta isola as duas cópias em aprendizado separado. Bom pra estender vida útil de vencedor ou testar nova audiência sem arriscar o que já funciona.`,
      alternatives: [],
    };
  }

  // ── ACTIVATE is low-risk if paused recently ────────────────────────────
  if (action === "activate") {
    return {
      verdict: "recommend",
      headline: `Reativar é seguro — Meta retoma onde parou`,
      reasoning:
        `Reativar uma campanha pausada restaura o estado anterior. Se ficou pausada por pouco tempo, o aprendizado do algoritmo costuma ser recuperado rapidamente.`,
      alternatives: [],
    };
  }

  // Unhandled combo → let AI decide
  return null;
}

/**
 * Build a prompt for the AI fallback and run it through Claude Haiku.
 * We give it the full context and ask for a structured verdict.
 */
async function aiFallback(
  ctx: Context,
  action: ProposedAction,
  targetCpaCents: number | null,
  proposedBudgetCents: number | null,
) {
  const brl = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const contextBlock = `
CONTEXTO:
- Nome: ${ctx.name}
- Status: ${ctx.effective_status}
- Rodando há: ${ctx.days_running} dia(s)  (dias com entrega: ${ctx.days_with_spend})
- Gasto (30d): R$ ${brl(ctx.spend_cents)}
- Cliques: ${ctx.clicks}
- Conversões: ${ctx.conversions}
- CPA: ${ctx.cpa_cents !== null ? `R$ ${brl(ctx.cpa_cents)}` : "sem dados"}
- CPA meta: ${targetCpaCents !== null ? `R$ ${brl(targetCpaCents)}` : "não configurada"}
- CTR: ${ctx.ctr.toFixed(2)}%
- Frequência: ${ctx.freq.toFixed(2)}x
- Tendência (CTR 7d vs 7d anterior): ${ctx.trend || "sem dados"}
${proposedBudgetCents ? `- Novo budget proposto: R$ ${brl(proposedBudgetCents)}` : ""}

AÇÃO PROPOSTA: ${action}
`.trim();

  const system = `Você é o AdBrief AI — media buyer sênior analisando uma ação manual antes de confirmar.

Sua tarefa: avaliar se a ação proposta faz sentido agora, dado o contexto real.

REGRAS DE OURO:
1. Respeite a idade da campanha. Nunca recomende pausar ou escalar campanha com menos de 3 dias — janela de atribuição ainda não fechou.
2. Se há conversões e CPA está dentro da meta, raramente é boa ideia pausar ou reduzir budget.
3. Se há 0 conversões depois de 7+ dias e R$500+, pausar é sensato.
4. Escalar budget antes de 3 dias sempre quebra aprendizado.

RETORNE APENAS JSON VÁLIDO no formato:
{
  "verdict": "recommend" | "reject" | "wait" | "depends",
  "headline": "uma linha curta e direta, tom de media buyer brasileiro",
  "reasoning": "2-3 frases explicando o motivo, citando números específicos do contexto",
  "alternatives": ["1-3 ações alternativas concretas, ou lista vazia se recommend"]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: contextBlock }],
      }),
    });
    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    // Extract JSON from response (model sometimes wraps in ```json)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no_json_in_response");
    const parsed = JSON.parse(match[0]);
    return {
      verdict: (parsed.verdict || "depends") as Verdict,
      headline: String(parsed.headline || "Análise indisponível"),
      reasoning: String(parsed.reasoning || ""),
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3).map(String) : [],
    };
  } catch (_e) {
    // AI failed — return a safe depends verdict
    return {
      verdict: "depends" as Verdict,
      headline: "Não consegui analisar com confiança agora",
      reasoning: "A análise da IA falhou. Revise o contexto visível e confirme se fizer sentido pra você.",
      alternatives: [],
    };
  }
}

function verdictLabel(v: Verdict): string {
  switch (v) {
    case "recommend": return "Recomendo";
    case "reject": return "Não recomendo";
    case "wait": return "Muito cedo";
    case "depends": return "Depende";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const { user_id, persona_id, target_id, target_type, proposed_action, proposed_budget_cents } = body;
    if (!user_id || !target_id || !target_type || !proposed_action) {
      return err("missing_required_fields");
    }

    // Fetch Meta access token
    let tokenRow: any = null;
    if (persona_id) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token").eq("user_id", user_id).eq("platform", "meta")
        .eq("persona_id", persona_id).eq("status", "active").maybeSingle();
      tokenRow = data;
    }
    if (!tokenRow?.access_token) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token").eq("user_id", user_id).eq("platform", "meta")
        .eq("status", "active").limit(1).maybeSingle();
      tokenRow = data;
    }
    if (!tokenRow?.access_token) {
      return err("meta_not_connected", 400);
    }
    const token = tokenRow.access_token;

    // Fetch target CPA (if configured)
    let targetCpaCents: number | null = null;
    try {
      const { data: goal } = await supabase.from("account_goal" as any)
        .select("target_cpa").eq("user_id", user_id).limit(1).maybeSingle();
      if ((goal as any)?.target_cpa) {
        const v = parseFloat((goal as any).target_cpa);
        if (isFinite(v) && v > 0) targetCpaCents = Math.round(v * 100);
      }
    } catch { /* optional */ }

    // Build context from Meta
    let ctx: Context;
    try {
      ctx = await buildContext(target_id, target_type, token);
    } catch (e: any) {
      const msg = e?.message === "meta_token_expired"
        ? "Token do Meta expirou. Reconecte em Contas."
        : `Não consegui puxar dados do Meta: ${e?.message || "erro"}`;
      return ok({
        verdict: "depends",
        verdict_label: "Não foi possível analisar",
        headline: msg,
        reasoning: "",
        context: null,
        alternatives: [],
      });
    }

    // 1) Deterministic rules
    let result = evaluateRules(ctx, proposed_action as ProposedAction, targetCpaCents);

    // 2) AI fallback for ambiguous cases
    if (!result) {
      result = await aiFallback(
        ctx,
        proposed_action as ProposedAction,
        targetCpaCents,
        proposed_budget_cents ?? null,
      );
    }

    return ok({
      verdict: result.verdict,
      verdict_label: verdictLabel(result.verdict),
      headline: result.headline,
      reasoning: result.reasoning,
      alternatives: result.alternatives,
      context: ctx,
      target_cpa_cents: targetCpaCents,
    });
  } catch (e: any) {
    return err(e?.message || "internal_error", 500);
  }
});
