// send-trial-expiring-email v1 — indigo palette, urgency — fires 2 days before trial ends
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, { subject: string; preheader: string; headline: string; body1: string; benefits: string[]; body2: string; cta: string; ps: string; footer: string }> = {
  pt: {
    subject: "Seu trial termina em {days_left} dias",
    preheader: "Você encontrou respostas que nenhuma ferramenta dava. Não perca o acesso.",
    headline: "Seu trial termina em {days_left} dias.",
    body1: "Você já viu o que diferencia o AdBrief: perguntas que outras ferramentas não conseguem responder com dados reais da sua conta.",
    benefits: [
      "Análise automática de fadiga criativa — antes de queimar orçamento",
      "Identificação de ROAS drops em tempo real — e o que os causou",
      "Sugestões de criativos para teste — baseadas nos seus dados",
    ],
    body2: "Sua conta está conectada. Seus dados estão ali. O plano faz você manter o acesso a essas respostas.",
    cta: "Escolher meu plano agora →",
    ps: "Cancele quando quiser. Sem compromisso.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Your trial ends in {days_left} days",
    preheader: "You've found answers no other tool could give. Don't lose access.",
    headline: "Your trial ends in {days_left} days.",
    body1: "You've already seen what makes AdBrief different: questions that no other tool can answer with real data from your account.",
    benefits: [
      "Automatic creative fatigue detection — before budget burns",
      "Real-time ROAS drop identification — and what caused it",
      "Creative test suggestions — based on your actual data",
    ],
    body2: "Your account is connected. Your data is there. A plan keeps you accessing these answers.",
    cta: "Choose my plan now →",
    ps: "Cancel anytime. No commitment.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Tu trial termina en {days_left} días",
    preheader: "Encontraste respuestas que ninguna otra herramienta podía dar. No pierdas el acceso.",
    headline: "Tu trial termina en {days_left} días.",
    body1: "Ya viste lo que diferencia a AdBrief: preguntas que ninguna otra herramienta puede responder con datos reales de tu cuenta.",
    benefits: [
      "Detección automática de fatiga creativa — antes de quemar presupuesto",
      "Identificación de drops de ROAS en tiempo real — y qué los causó",
      "Sugerencias de creativos para probar — basadas en tus datos",
    ],
    body2: "Tu cuenta está conectada. Tus datos están ahí. Un plan te mantiene accediendo a estas respuestas.",
    cta: "Elegir mi plan ahora →",
    ps: "Cancela cuando quieras. Sin compromiso.",
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

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string, daysLeft: number): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  const benefits = t.benefits.map(b => `
    <tr><td style="padding:0 0 12px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="28" valign="top" style="padding-top:2px;">
          <div style="width:20px;height:20px;border-radius:6px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);text-align:center;line-height:20px;font-size:11px;color:#6366f1;">✓</div>
        </td>
        <td style="font-size:14px;color:rgba(200,215,240,0.8);line-height:1.55;font-family:${F};padding-left:12px;">${b}</td>
      </tr></table>
    </td></tr>`).join("");

  const subject = t.subject.replace("{days_left}", String(daysLeft));
  const headline = t.headline.replace("{days_left}", String(daysLeft));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#050508;-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050508;">
<tr><td align="center" style="padding:40px 16px 56px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:32px;">
    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:20px;font-weight:800;color:#6366f1;letter-spacing:-0.05em;font-family:${F};">brief</span>
  </td></tr>

  <!-- MAIN CARD -->
  <tr><td style="border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#0e1628 0%,#0a1020 100%);border:1px solid rgba(99,102,241,0.2);">

    <!-- top bar — urgency gradient -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#f59e0b,#ef4444,#ec4899);"></td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 50%);">
    <tr><td style="padding:36px 40px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${firstName},</p>
      <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${headline}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body1}</p>

      <!-- Benefits block -->
      <div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-left:3px solid #6366f1;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${benefits}
        </table>
      </div>

      <p style="margin:0 0 32px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body2}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(99,102,241,0.1);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.06) 0%,transparent 100%);">
    <tr><td style="padding:28px 40px 36px;" align="center">
      <a href="${appUrl}/settings/billing" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(99,102,241,0.4);">${t.cta}</a>
      <p style="margin:18px 0 0;font-size:12px;color:rgba(150,180,220,0.35);font-family:${F};">${t.ps}</p>
    </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:24px 8px 0;" align="center">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);font-family:${F};">${t.footer} · <a href="https://adbrief.pro" style="color:rgba(99,102,241,0.5);text-decoration:none;">adbrief.pro</a></p>
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
    const { email, name, language, days_left } = await req.json();
    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");
    const daysLeft = days_left || 2;
    const subject = t.subject.replace("{days_left}", String(daysLeft));
    const html = buildHtml(t, firstName, APP, daysLeft);
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
// redeploy 202604101800
