// send-activation-email v3 — redesign bold, sem Google Ads — fires 24h after signup if Meta not connected
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, { subject: string; preheader: string; headline: string; body1: string; bullets: string[]; body2: string; cta: string; ps: string; footer: string }> = {
  pt: {
    subject: "Você criou a conta. Mas ainda não conectou o Meta Ads.",
    preheader: "Sem conexão, você recebe respostas genéricas. Com ela, a IA sabe o que está acontecendo na sua conta.",
    headline: "Seus dados ainda não estão conectados.",
    body1: "Você criou a conta no AdBrief — mas sem o Meta Ads conectado, a IA responde com informações genéricas que qualquer ferramenta daria.",
    bullets: [
      "\"Quais dos meus anúncios estão em fadiga criativa agora?\"",
      "\"Por que meu ROAS caiu essa semana?\"",
      "\"Qual criativo devo pausar antes de perder mais dinheiro?\"",
    ],
    body2: "Essas perguntas só têm respostas reais com seus dados conectados. Leva 60 segundos.",
    cta: "Conectar Meta Ads agora →",
    ps: "Acesso somente leitura. Nunca tocamos nas suas campanhas.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "You signed up. But your Meta Ads isn't connected yet.",
    preheader: "Without a connection, you get generic answers. With it, the AI knows exactly what's happening in your account.",
    headline: "Your data isn't connected yet.",
    body1: "You created your AdBrief account — but without Meta Ads connected, the AI gives you generic answers that any tool would give.",
    bullets: [
      "\"Which of my ads are in creative fatigue right now?\"",
      "\"Why did my ROAS drop this week?\"",
      "\"Which creative should I pause before wasting more money?\"",
    ],
    body2: "These questions only have real answers with your data connected. Takes 60 seconds.",
    cta: "Connect Meta Ads now →",
    ps: "Read-only access. We never touch your campaigns.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Te registraste. Pero Meta Ads aún no está conectado.",
    preheader: "Sin conexión, obtienes respuestas genéricas. Con ella, la IA sabe exactamente qué pasa en tu cuenta.",
    headline: "Tus datos aún no están conectados.",
    body1: "Creaste tu cuenta en AdBrief — pero sin Meta Ads conectado, la IA da respuestas genéricas que cualquier herramienta daría.",
    bullets: [
      "\"¿Cuáles de mis anuncios están en fatiga creativa ahora mismo?\"",
      "\"¿Por qué bajó mi ROAS esta semana?\"",
      "\"¿Qué creativo debo pausar antes de perder más dinero?\"",
    ],
    body2: "Estas preguntas solo tienen respuestas reales con tus datos conectados. Toma 60 segundos.",
    cta: "Conectar Meta Ads ahora →",
    ps: "Acceso de solo lectura. Nunca tocamos tus campañas.",
    footer: "Te registraste en adbrief.pro",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  const bullets = t.bullets.map(b => `
    <tr><td style="padding:0 0 10px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="28" valign="top" style="padding-top:2px;">
          <div style="width:20px;height:20px;border-radius:6px;background:rgba(14,165,233,0.2);border:1px solid rgba(14,165,233,0.35);text-align:center;line-height:20px;font-size:11px;">→</div>
        </td>
        <td style="font-size:14px;color:rgba(200,215,240,0.8);line-height:1.55;font-family:${F};font-style:italic;">${b}</td>
      </tr></table>
    </td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${t.subject}</title></head>
<body style="margin:0;padding:0;background:#050811;-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050811;">
<tr><td align="center" style="padding:40px 16px 56px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:32px;">
    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:20px;font-weight:800;color:#0ea5e9;letter-spacing:-0.05em;font-family:${F};">brief</span>
  </td></tr>

  <!-- MAIN CARD -->
  <tr><td style="border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#0e1628 0%,#0a1020 100%);border:1px solid rgba(14,165,233,0.2);">
    <!-- top bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#f59e0b,#ef4444,#ec4899);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(245,158,11,0.06) 0%,transparent 50%);">
    <tr><td style="padding:36px 40px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${firstName},</p>
      <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${t.headline}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body1}</p>

      <!-- Questions block -->
      <div style="background:rgba(14,165,233,0.07);border:1px solid rgba(14,165,233,0.2);border-left:3px solid #0ea5e9;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 14px;font-size:10px;font-weight:800;color:#0ea5e9;letter-spacing:0.12em;text-transform:uppercase;font-family:${F};">PERGUNTAS QUE VOCÊ JÁ PODE FAZER</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${bullets}
        </table>
      </div>

      <p style="margin:0 0 32px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body2}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(14,165,233,0.1);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(14,165,233,0.06) 0%,transparent 100%);">
    <tr><td style="padding:28px 40px 36px;" align="center">
      <a href="${appUrl}/dashboard/accounts" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(14,165,233,0.4);">${t.cta}</a>
      <p style="margin:18px 0 0;font-size:12px;color:rgba(150,180,220,0.35);font-family:${F};">${t.ps}</p>
    </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:24px 8px 0;" align="center">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);font-family:${F};">${t.footer} · <a href="https://adbrief.pro" style="color:rgba(14,165,233,0.5);text-decoration:none;">adbrief.pro</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    // Internal only — called by cron, require service role
    const authH = req.headers.get("Authorization") ?? "";
    if (authH !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";
    const { email, name, language } = await req.json();
    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");
    const html = buildHtml(t, firstName, APP);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: t.subject, html }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, ...data }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
// redeploy 202603270100
