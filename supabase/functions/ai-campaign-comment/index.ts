// ai-campaign-comment — gera comentário do Estrategista após uma ação
// Usa Claude Haiku 4.5 com insights 30d + 7d do Meta Ads.
// Fallback determinístico quando ANTHROPIC_API_KEY não está disponível.
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

async function fetchInsights(targetId: string, token: string, datePreset: string) {
  try {
    const fields = "spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas,frequency";
    const r = await fetch(`${BASE}/${targetId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${token}`);
    const d = await r.json();
    if (d.error || !d.data?.[0]) return null;
    const row = d.data[0];
    const purchases = (row.actions || []).find((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")?.value;
    const purchaseValue = (row.action_values || []).find((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")?.value;
    const roas = row.purchase_roas?.[0]?.value || (purchaseValue && row.spend ? Number(purchaseValue) / Number(row.spend) : null);
    return {
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      frequency: Number(row.frequency || 0),
      purchases: purchases ? Number(purchases) : 0,
      revenue: purchaseValue ? Number(purchaseValue) : 0,
      roas: roas ? Number(roas) : null,
    };
  } catch {
    return null;
  }
}

function deterministicComment(action: string, targetType: string, m30: any, m7: any): string {
  const roas30 = m30?.roas?.toFixed(2) ?? "-";
  const roas7 = m7?.roas?.toFixed(2) ?? "-";
  const ctr30 = m30?.ctr?.toFixed(2) ?? "-";
  const spend7 = m7?.spend?.toFixed(0) ?? "-";
  const verb = action === "pause" ? "Pausada" : action === "enable" ? "Reativada" : action === "duplicate" ? "Duplicada" : "Ajustada";
  const trend = m7?.roas && m30?.roas
    ? m7.roas < m30.roas * 0.8 ? "tendência de queda" : m7.roas > m30.roas * 1.2 ? "tendência de alta" : "estável"
    : "sem sinal claro";
  return `${verb}. ROAS 30d: ${roas30} · 7d: ${roas7} · CTR 30d: ${ctr30}% · Gasto 7d: R$${spend7} · ${trend}.`;
}

async function aiComment(action: string, targetType: string, targetName: string, m30: any, m7: any): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return deterministicComment(action, targetType, m30, m7);

  const prompt = `Você é o Estrategista, um media buyer sênior. Acabou de ser executada a ação "${action}" no ${targetType} "${targetName}".

Métricas dos últimos 30 dias:
${JSON.stringify(m30, null, 2)}

Métricas dos últimos 7 dias:
${JSON.stringify(m7, null, 2)}

Escreva UM comentário curto (máx 2 frases, 220 caracteres) explicando se a ação faz sentido e o que monitorar agora. Use números reais (ROAS, CTR, gasto). Direto, sem floreio. Em português.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20250929",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    const text = d?.content?.[0]?.text?.trim();
    return text || deterministicComment(action, targetType, m30, m7);
  } catch {
    return deterministicComment(action, targetType, m30, m7);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { user_id, persona_id, target_id, target_type, target_name, action } = body;
    if (!user_id || !target_id || !action) return errResp("missing user_id, target_id or action");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errResp("unauthorized", 401);
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.slice(7));
    if (!authUser || authUser.id !== user_id) return errResp("unauthorized", 401);

    // Get token
    let conn: any = null;
    if (persona_id) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active").eq("persona_id", persona_id)
        .maybeSingle();
      conn = data;
    }
    if (!conn?.access_token) {
      const { data } = await supabase.from("platform_connections" as any)
        .select("access_token")
        .eq("user_id", user_id).eq("platform", "meta").eq("status", "active")
        .limit(1).maybeSingle();
      conn = data;
    }
    if (!conn?.access_token) return errResp("Meta Ads não conectado.");

    const [m30, m7] = await Promise.all([
      fetchInsights(target_id, conn.access_token, "last_30d"),
      fetchInsights(target_id, conn.access_token, "last_7d"),
    ]);

    const comment = await aiComment(action, target_type || "campaign", target_name || target_id, m30, m7);

    return ok({ success: true, comment, metrics_30d: m30, metrics_7d: m7 });
  } catch (e: any) {
    return errResp(e.message || "internal error", 500);
  }
});
