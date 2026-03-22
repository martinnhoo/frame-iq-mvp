// check-critical-alerts v1 — roda a cada 6h, dispara email IMEDIATO para eventos críticos
// Eventos: frequência > 4, CTR caiu > 40% em 24h, ad gastou > $50 sem conversão, ROAS < 0.5
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <alertas@adbrief.pro>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Get all active Meta connections
    const { data: conns } = await sb.from("platform_connections" as any)
      .select("user_id, persona_id, access_token, ad_accounts, selected_account_id")
      .eq("platform", "meta").eq("status", "active");

    if (!conns?.length) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let alertsFired = 0;
    const now = new Date();
    const alertKey = `critical_${now.toISOString().slice(0, 13)}`; // hourly dedup key

    for (const conn of conns) {
      try {
        // Dedup: skip if already alerted this hour for this user
        const { data: profile } = await sb.from("profiles")
          .select("email, name, usage_alert_flags")
          .eq("id", conn.user_id).maybeSingle();
        if (!profile?.email) continue;

        const flags: Record<string, boolean> = (profile.usage_alert_flags as any) || {};
        if (flags[alertKey]) continue; // already alerted this hour

        const accounts = (conn.ad_accounts as any[]) || [];
        const selId = conn.selected_account_id;
        const account = (selId && accounts.find((a: any) => a.id === selId)) || accounts[0];
        if (!account?.id) continue;

        const token = conn.access_token;
        const today = now.toISOString().split("T")[0];
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
        const d2 = new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0];

        const fields = "ad_id,ad_name,campaign_name,spend,ctr,cpc,cpm,frequency,actions,impressions";

        // Fetch last 24h and previous 24h in parallel
        const [todayRes, prevRes] = await Promise.all([
          fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${yesterday}","until":"${today}"}&sort=spend_descending&limit=30&access_token=${token}`),
          fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d2}","until":"${yesterday}"}&sort=spend_descending&limit=30&access_token=${token}`),
        ]);

        const [todayData, prevData] = await Promise.all([todayRes.json(), prevRes.json()]);
        if (todayData.error) continue;

        const curr: any[] = todayData.data || [];
        const prev: any[] = prevData.data || [];
        const prevMap: Record<string, any> = {};
        prev.forEach((a: any) => { prevMap[a.ad_id || a.ad_name] = a; });

        const parseN = (v: any) => parseFloat(v || "0");
        const getConv = (ad: any) => {
          const actions = (ad.actions || []) as any[];
          const c = actions.find((a: any) => ["purchase", "lead", "complete_registration", "app_install"].includes(a.action_type));
          return c ? parseFloat(c.value || "0") : 0;
        };

        // Detect critical events
        const alerts: Array<{type: string; ad: string; campaign: string; detail: string; urgency: "🔴" | "🟡"}> = [];

        for (const ad of curr) {
          const ctr = parseN(ad.ctr);
          const spend = parseN(ad.spend);
          const freq = parseN(ad.frequency);
          const conv = getConv(ad);
          const prevAd = prevMap[ad.ad_id || ad.ad_name];
          const prevCtr = prevAd ? parseN(prevAd.ctr) : null;

          // 🔴 Frequência > 4 — queimando audiência agora
          if (freq >= 4) {
            alerts.push({
              type: "FADIGA CRÍTICA",
              ad: ad.ad_name?.slice(0, 50) || "Sem nome",
              campaign: ad.campaign_name?.slice(0, 40) || "",
              detail: `Frequência ${freq.toFixed(1)}x — audiência esgotada. Pause hoje ou troque o criativo.`,
              urgency: "🔴",
            });
          }

          // 🔴 CTR caiu > 40% em 24h
          if (prevCtr !== null && prevCtr > 0.005 && ctr < prevCtr * 0.6) {
            const drop = (((prevCtr - ctr) / prevCtr) * 100).toFixed(0);
            alerts.push({
              type: "CTR COLAPSOU",
              ad: ad.ad_name?.slice(0, 50) || "Sem nome",
              campaign: ad.campaign_name?.slice(0, 40) || "",
              detail: `CTR caiu ${drop}% em 24h (${(prevCtr*100).toFixed(2)}% → ${(ctr*100).toFixed(2)}%). Criativo perdendo força.`,
              urgency: "🔴",
            });
          }

          // 🔴 Gastou > $50 sem nenhuma conversão
          if (spend > 50 && conv === 0) {
            alerts.push({
              type: "SPEND SEM RETORNO",
              ad: ad.ad_name?.slice(0, 50) || "Sem nome",
              campaign: ad.campaign_name?.slice(0, 40) || "",
              detail: `R$${spend.toFixed(0)} gastos hoje, 0 conversões. Pause agora e revise o criativo.`,
              urgency: "🔴",
            });
          }

          // 🟡 Ad escalável subaproveitado (CTR alto, budget baixo)
          if (ctr > 0.025 && spend < 30 && spend > 5) {
            alerts.push({
              type: "OPORTUNIDADE",
              ad: ad.ad_name?.slice(0, 50) || "Sem nome",
              campaign: ad.campaign_name?.slice(0, 40) || "",
              detail: `CTR ${(ctr*100).toFixed(2)}% — alto desempenho com apenas R$${spend.toFixed(0)}. Aumente o budget agora.`,
              urgency: "🟡",
            });
          }
        }

        if (!alerts.length) continue;

        // Limit to top 4 most urgent alerts
        const sorted = [...alerts].sort((a, b) => (a.urgency === "🔴" ? -1 : 1) - (b.urgency === "🔴" ? -1 : 1));
        const top = sorted.slice(0, 4);
        const urgent = top.filter(a => a.urgency === "🔴").length;

        // Build email
        const subject = urgent > 0
          ? `⚠️ ${urgent} alerta${urgent > 1 ? "s" : ""} crítico${urgent > 1 ? "s" : ""} na sua conta — AdBrief`
          : `💡 Oportunidade detectada na sua conta — AdBrief`;

        const F = "'Inter', Arial, sans-serif";
        const alertsHtml = top.map(a => `
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #1a1a2e;">
              <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:${a.urgency === "🔴" ? "#f87171" : "#fbbf24"};font-family:${F};text-transform:uppercase;letter-spacing:0.08em;">
                ${a.urgency} ${a.type}
              </p>
              <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#eef0f6;font-family:${F};">${a.ad}</p>
              <p style="margin:0 0 2px;font-size:11px;color:rgba(238,240,246,0.45);font-family:${F};">${a.campaign}</p>
              <p style="margin:0;font-size:12px;color:rgba(238,240,246,0.7);font-family:${F};line-height:1.4;">${a.detail}</p>
            </td>
          </tr>`).join("");

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07080f;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#0d0d1a;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e;max-width:560px;">
      
      <!-- Header -->
      <tr><td style="padding:24px 24px 16px;background:linear-gradient(135deg,#0d0d1a,#12122a);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:11px;font-weight:700;color:#0ea5e9;font-family:${F};text-transform:uppercase;letter-spacing:0.12em;">AdBrief AI</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#eef0f6;font-family:${F};letter-spacing:-0.03em;">
                ${urgent > 0 ? `${urgent} alerta${urgent > 1 ? "s" : ""} crítico${urgent > 1 ? "s" : ""}` : "Oportunidade detectada"}
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(238,240,246,0.4);font-family:${F};">
                ${account.name || account.id} · ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
              </p>
            </td>
            <td align="right" style="vertical-align:top;">
              <div style="width:44px;height:44px;border-radius:12px;background:${urgent > 0 ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)"};display:flex;align-items:center;justify-content:center;font-size:22px;line-height:44px;text-align:center;">
                ${urgent > 0 ? "⚠️" : "💡"}
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Alerts -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${alertsHtml}
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:20px 24px 24px;">
        <a href="https://adbrief.pro/dashboard/ai" style="display:block;text-align:center;padding:13px 24px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#000;font-family:${F};font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;">
          Ver conta e agir agora →
        </a>
        <p style="margin:12px 0 0;text-align:center;font-size:11px;color:rgba(238,240,246,0.25);font-family:${F};">
          Detectado automaticamente pelo AdBrief AI · Dados do Meta Ads em tempo real
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

        // Send email
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [profile.email], subject, html }),
        });

        if (emailRes.ok) {
          alertsFired++;
          // Mark as alerted this hour
          await sb.from("profiles").update({
            usage_alert_flags: { ...flags, [alertKey]: true },
          } as any).eq("id", conn.user_id);
        }

      } catch (e) {
        console.error("Alert check error for user:", conn.user_id, String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: conns.length, alerts_fired: alertsFired }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
// redeploy 202603262400
