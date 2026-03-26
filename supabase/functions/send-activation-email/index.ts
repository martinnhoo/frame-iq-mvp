// send-activation-email v2 — fires 24h after signup if Meta not connected
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
  const M = "'Helvetica Neue',Arial,sans-serif";

  const bullets = t.bullets.map(b => `
    <tr><td style="padding:0 0 8px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="20" valign="top" style="padding-top:1px;">
          <span style="display:block;width:6px;height:6px;border-radius:50%;background:#0ea5e9;margin-top:5px;"></span>
        </td>
        <td style="font-size:14px;color:rgba(238,240,246,0.75);line-height:1.55;font-family:${M};">${b}</td>
      </tr></table>
    </td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${t.subject}</title></head>
<body style="margin:0;padding:0;background:#080c12;font-family:${M};-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;‌&nbsp;‌&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080c12;">
<tr><td align="center" style="padding:48px 16px 64px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:36px;">
    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:22px;font-weight:800;color:#0ea5e9;letter-spacing:-0.05em;font-family:${F};">brief</span>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background:#0d1320;border-radius:20px;border:1px solid rgba(255,255,255,0.09);padding:40px;">
    <p style="margin:0 0 6px;font-size:14px;color:rgba(238,240,246,0.45);font-family:${M};">${firstName},</p>
    <h1 style="margin:0 0 24px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${t.headline}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(238,240,246,0.65);line-height:1.70;font-family:${M};">${t.body1}</p>

    <!-- Bullets with cyan dots -->
    <div style="background:rgba(14,165,233,0.06);border:1px solid rgba(14,165,233,0.15);border-radius:12px;padding:18px 20px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${bullets}
      </table>
    </div>

    <p style="margin:0 0 32px;font-size:15px;color:rgba(238,240,246,0.65);line-height:1.70;font-family:${M};">${t.body2}</p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <a href="${appUrl}/dashboard/accounts" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.30);">${t.cta}</a>
    </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:rgba(238,240,246,0.28);text-align:center;font-family:${M};">${t.ps}</p>
  </td></tr>

  <tr><td style="padding:24px 4px 0;text-align:center;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);font-family:${M};">${t.footer} · <a href="https://adbrief.pro" style="color:rgba(255,255,255,0.25);text-decoration:none;">adbrief.pro</a></p>
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
