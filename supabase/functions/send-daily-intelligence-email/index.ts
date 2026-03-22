// send-daily-intelligence-email — fires daily at 12h UTC for users with Meta connected
// Called by: daily-intelligence edge function after saving snapshot
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const LABELS: Record<Lang, {
  subject: (account: string, ctr: string, spend: string) => string;
  preheader: (insight: string) => string;
  scale: string; pause: string; fatigue: string; yesterday: string;
  cta: string; footer: string; noData: string;
  spendLabel: string; ctrLabel: string; activeLabel: string;
}> = {
  pt: {
    subject: (a, ctr, spend) => `${a}: CTR ${ctr}% · R$${spend} esta semana`,
    preheader: (i) => i || "Sua inteligência de campanha de hoje está pronta.",
    scale: "↑ Escalar agora", pause: "⏸ Pausar", fatigue: "⚠️ Fadiga criativa",
    yesterday: "Ontem",
    cta: "Abrir AdBrief e agir →",
    footer: "Você recebe isso pq tem Meta Ads conectado no AdBrief.",
    noData: "Sem campanhas ativas esta semana. Hora de criar novos criativos?",
    spendLabel: "Spend 7d", ctrLabel: "CTR médio", activeLabel: "Ads ativos",
  },
  en: {
    subject: (a, ctr, spend) => `${a}: ${ctr}% CTR · $${spend} this week`,
    preheader: (i) => i || "Your daily campaign intelligence is ready.",
    scale: "↑ Scale now", pause: "⏸ Pause", fatigue: "⚠️ Creative fatigue",
    yesterday: "Yesterday",
    cta: "Open AdBrief and act →",
    footer: "You receive this because you have Meta Ads connected in AdBrief.",
    noData: "No active campaigns this week. Time to create new creatives?",
    spendLabel: "7d Spend", ctrLabel: "Avg CTR", activeLabel: "Active ads",
  },
  es: {
    subject: (a, ctr, spend) => `${a}: CTR ${ctr}% · $${spend} esta semana`,
    preheader: (i) => i || "Tu inteligencia de campaña de hoy está lista.",
    scale: "↑ Escalar ahora", pause: "⏸ Pausar", fatigue: "⚠️ Fatiga creativa",
    yesterday: "Ayer",
    cta: "Abrir AdBrief y actuar →",
    footer: "Recibes esto porque tienes Meta Ads conectado en AdBrief.",
    noData: "Sin campañas activas esta semana. ¿Hora de crear nuevos creativos?",
    spendLabel: "Gasto 7d", ctrLabel: "CTR prom.", activeLabel: "Anuncios activos",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(
  l: typeof LABELS["pt"], firstName: string, snap: any, appUrl: string, lang: Lang
): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";
  const M = "'Helvetica Neue',Arial,sans-serif";

  const topAds = (snap.top_ads || []) as any[];
  const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 3);
  const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 2);
  const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 2);
  const actions = (snap.raw_period?.actions || []) as any[];
  const hasData = snap.total_spend > 0;
  const ctrColor = snap.avg_ctr >= 0.02 ? "#34d399" : snap.avg_ctr >= 0.01 ? "#fbbf24" : "#f87171";

  const adRow = (ad: any, badge: string, badgeColor: string) => `
    <tr><td style="padding:0 0 8px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07);">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td>
              <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:rgba(238,240,246,0.80);font-family:${F};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${ad.name?.slice(0, 45) || "—"}</p>
              <p style="margin:0;font-size:11px;color:rgba(238,240,246,0.35);font-family:${M};">CTR ${(ad.ctr * 100)?.toFixed(2)}% ${ad.spend ? `· ${lang === "pt" ? "R$" : "$"}${ad.spend?.toFixed(0)}` : ""}</p>
            </td>
            <td align="right" style="white-space:nowrap;padding-left:10px;">
              <span style="font-size:10px;font-weight:700;color:${badgeColor};font-family:${F};letter-spacing:0.02em;">${badge}</span>
            </td>
          </tr></table>
        </td>
      </tr>
      </table>
    </td></tr>`;

  const adRows = [
    ...toScale.map((a: any) => adRow(a, l.scale, "#34d399")),
    ...toPause.map((a: any) => adRow(a, l.pause, "#f87171")),
    ...fatigued.filter((a: any) => !toPause.find((p: any) => p.id === a.id)).map((a: any) => adRow(a, l.fatigue, "#fbbf24")),
  ].join("");

  const insightSection = snap.ai_insight ? `
    <tr><td style="padding:0 0 28px;">
      <div style="background:rgba(14,165,233,0.06);border-left:3px solid #0ea5e9;border-radius:0 10px 10px 0;padding:14px 16px;">
        <p style="margin:0;font-size:14px;color:rgba(238,240,246,0.75);line-height:1.65;font-family:${M};">💡 ${snap.ai_insight}</p>
      </div>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/></head>
<body style="margin:0;padding:0;background:#080c12;font-family:${M};-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${l.preheader(snap.ai_insight || "")}&nbsp;‌&nbsp;‌&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080c12;">
<tr><td align="center" style="padding:48px 16px 64px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:36px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);width:34px;height:34px;border-radius:9px;text-align:center;vertical-align:middle;">
        <span style="font-size:16px;font-weight:900;color:#fff;font-family:${F};display:block;line-height:34px;letter-spacing:-0.05em;">ab</span>
      </td>
      <td style="padding-left:10px;vertical-align:middle;">
        <span style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-0.04em;font-family:${F};">ad</span><span style="font-size:19px;font-weight:800;color:#0ea5e9;letter-spacing:-0.04em;font-family:${F};">brief</span>
      </td>
      <td align="right" style="padding-left:20px;">
        <span style="font-size:11px;color:rgba(238,240,246,0.25);font-family:${M};">${snap.date || ""}</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background:#0d1320;border-radius:20px;border:1px solid rgba(255,255,255,0.09);padding:40px;">
    <p style="margin:0 0 4px;font-size:14px;color:rgba(238,240,246,0.40);font-family:${M};">${firstName} — ${snap.account_name || ""}</p>
    
    ${!hasData ? `
      <p style="margin:8px 0 28px;font-size:22px;font-weight:800;color:rgba(238,240,246,0.60);letter-spacing:-0.03em;font-family:${F};">${l.noData}</p>
    ` : `
      <!-- Stats row -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0 28px;">
      <tr>
        <td width="33%" style="text-align:center;padding:14px 8px;background:rgba(255,255,255,0.03);border-radius:10px;">
          <p style="margin:0;font-size:28px;font-weight:900;color:#eef0f6;letter-spacing:-0.05em;font-family:${F};">${lang === "pt" ? "R$" : "$"}${(snap.total_spend || 0).toFixed(0)}</p>
          <p style="margin:3px 0 0;font-size:10px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.spendLabel}</p>
        </td>
        <td width="4px"></td>
        <td width="33%" style="text-align:center;padding:14px 8px;background:rgba(255,255,255,0.03);border-radius:10px;">
          <p style="margin:0;font-size:28px;font-weight:900;color:${ctrColor};letter-spacing:-0.05em;font-family:${F};">${((snap.avg_ctr || 0) * 100).toFixed(2)}%</p>
          <p style="margin:3px 0 0;font-size:10px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.ctrLabel}</p>
        </td>
        <td width="4px"></td>
        <td width="33%" style="text-align:center;padding:14px 8px;background:rgba(255,255,255,0.03);border-radius:10px;">
          <p style="margin:0;font-size:28px;font-weight:900;color:#eef0f6;letter-spacing:-0.05em;font-family:${F};">${snap.active_ads || 0}</p>
          <p style="margin:3px 0 0;font-size:10px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.activeLabel}</p>
        </td>
      </tr>
      </table>

      <!-- Ad actions -->
      ${adRows ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">${adRows}</table>` : ""}
    `}

    <!-- AI Insight -->
    ${insightSection}

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.30);">${l.cta}</a>
    </td></tr>
    </table>

  </td></tr>

  <tr><td style="padding:24px 4px 0;text-align:center;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);font-family:${M};">${l.footer}</p>
    <p style="margin:6px 0 0;font-size:11px;font-family:${M};"><a href="https://adbrief.pro" style="color:rgba(255,255,255,0.25);text-decoration:none;">adbrief.pro</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";

    // Can be called with: { user_id } to send for that user
    // or { email, name, language, snapshot } directly (for test)
    const body = await req.json();

    let email: string, name: string, language: string, snapshot: any;

    if (body.user_id) {
      const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: profile } = await sb.from("profiles").select("name, email, preferred_language").eq("id", body.user_id).single();
      if (!profile?.email) return new Response(JSON.stringify({ error: "no email" }), { status: 400, headers: cors });
      email = profile.email;
      name = profile.name || "";
      language = profile.preferred_language || "pt";
      const today = new Date().toISOString().split("T")[0];
      const { data: snap } = await sb.from("daily_snapshots" as any)
        .select("*").eq("user_id", body.user_id).eq("date", today).maybeSingle();
      snapshot = snap;
    } else {
      email = body.email;
      name = body.name || "";
      language = body.language || "pt";
      snapshot = body.snapshot || {};
    }

    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: cors });

    const lang = detectLang(language);
    const l = LABELS[lang];
    const firstName = name.split(" ")[0] || (lang === "pt" ? "gestor" : "there");
    const snap = snapshot || { total_spend: 0, avg_ctr: 0, active_ads: 0, top_ads: [], ai_insight: "", account_name: "sua conta", date: new Date().toISOString().split("T")[0] };
    const ctrStr = ((snap.avg_ctr || 0) * 100).toFixed(2);
    const spendStr = (snap.total_spend || 0).toFixed(0);
    const subject = l.subject(snap.account_name || "AdBrief", ctrStr, spendStr);
    const html = buildHtml(l, firstName, snap, APP, lang);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, html }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, ...data }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
// redeploy 202603262000
