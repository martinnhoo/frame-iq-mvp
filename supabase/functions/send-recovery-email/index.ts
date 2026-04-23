// send-recovery-email — one-off apology + "come back" CTA for a user who
// hit a bug that broke their session. Internal-only (service-role gated).
//
// Invoke:
//   supabase.functions.invoke("send-recovery-email", {
//     body: { email, name?, language? /* pt|en|es */ }
//   })
//
// Or via curl with SERVICE_ROLE bearer token.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, {
  subject: string; preheader: string; salut: string; headline: string;
  body1: string; body2: string; body3: string; cta: string; ps: string;
  sig: string; footer: string;
}> = {
  pt: {
    subject: "Desculpa pelo erro de ontem — já corrigi",
    preheader: "Era um bug chato no meu código. Tá arrumado. Volta que agora passa direto.",
    salut: "Oi",
    headline: "Vim te pedir desculpa.",
    body1: "Você tentou usar o AdBrief ontem e pegou um erro quando abriu a tela de upgrade — um bug meu no código que travou a sessão.",
    body2: "Já corrigi (ontem à noite). Quem entra agora passa direto: conecta a conta do Meta em 1 minuto, a IA começa a te avisar no Telegram quando algo precisa de atenção, e o teste é grátis sem cartão.",
    body3: "Se quiser voltar, é só clicar aqui embaixo. Se preferir, me responde esse email direto — eu sou o Martinho, founder. Leio todos.",
    cta: "Voltar pro AdBrief →",
    ps: "PS: se pegar outro erro, me manda print. Corrijo na hora.",
    sig: "Martinho",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Sorry about yesterday's error — I fixed it",
    preheader: "It was a dumb bug in my code. It's fixed now. Come back and try again.",
    salut: "Hey",
    headline: "I owe you an apology.",
    body1: "You tried using AdBrief yesterday and hit an error when the upgrade screen opened — a bug in my code that broke the session.",
    body2: "I already fixed it (last night). Now you can connect your Meta account in 1 minute, the AI starts alerting you on Telegram when something needs attention, and the trial is free, no card required.",
    body3: "If you want to come back, just click below. Or reply to this email directly — I'm Martinho, the founder. I read every one.",
    cta: "Come back to AdBrief →",
    ps: "PS: if you hit another error, send me a screenshot. I'll fix it on the spot.",
    sig: "Martinho",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Perdón por el error de ayer — ya lo arreglé",
    preheader: "Era un bug tonto en mi código. Está arreglado. Vuelve y prueba de nuevo.",
    salut: "Hola",
    headline: "Te debo una disculpa.",
    body1: "Ayer intentaste usar AdBrief y chocaste con un error cuando se abrió la pantalla de upgrade — un bug en mi código que rompió la sesión.",
    body2: "Ya lo arreglé (anoche). Ahora puedes conectar tu cuenta de Meta en 1 minuto, la IA empieza a avisarte por Telegram cuando algo necesita atención, y la prueba es gratis, sin tarjeta.",
    body3: "Si quieres volver, sólo haz clic abajo. O respóndeme este email directo — soy Martinho, el founder. Los leo todos.",
    cta: "Volver a AdBrief →",
    ps: "PD: si ves otro error, mándame un screenshot. Lo arreglo al momento.",
    sig: "Martinho",
    footer: "Te registraste en adbrief.pro",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "pt"; // default PT since most users are BR
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${t.subject}</title></head>
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

    <!-- top accent -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 50%);">
    <tr><td style="padding:36px 40px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${t.salut} ${firstName},</p>
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.2;font-family:${F};">${t.headline}</h1>
      <p style="margin:0 0 18px;font-size:15px;color:rgba(200,215,240,0.78);line-height:1.7;font-family:${F};">${t.body1}</p>
      <p style="margin:0 0 18px;font-size:15px;color:rgba(200,215,240,0.78);line-height:1.7;font-family:${F};">${t.body2}</p>
      <p style="margin:0 0 12px;font-size:15px;color:rgba(200,215,240,0.78);line-height:1.7;font-family:${F};">${t.body3}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(99,102,241,0.1);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.06) 0%,transparent 100%);">
    <tr><td style="padding:28px 40px 24px;" align="center">
      <a href="${appUrl}/dashboard/accounts" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(99,102,241,0.4);">${t.cta}</a>
    </td></tr>
    <tr><td style="padding:0 40px 32px;" align="center">
      <p style="margin:0;font-size:12px;color:rgba(150,180,220,0.45);font-family:${F};">${t.ps}</p>
    </td></tr>
    </table>

    <!-- Signature -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(99,102,241,0.08);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:24px 40px 32px;">
      <p style="margin:0;font-size:14px;color:rgba(200,215,240,0.6);font-family:${F};font-style:italic;">— ${t.sig}, founder</p>
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
    // Internal only — must present service-role bearer
    const authH = req.headers.get("Authorization") ?? "";
    if (authH !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "Martinho from AdBrief <hello@adbrief.pro>";
    const REPLY  = Deno.env.get("RESEND_REPLY_TO") ?? "martinhovff@gmail.com";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";

    const body = await req.json().catch(() => ({}));
    const { email, name, language } = body as { email?: string; name?: string; language?: string };

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_email" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0]
      || (lang === "pt" ? "gestor" : lang === "es" ? "gestor" : "there");
    const html = buildHtml(t, firstName, APP);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: REPLY,
        subject: t.subject,
        html,
      }),
    });
    const data = await res.json();
    return new Response(
      JSON.stringify({ ok: res.ok, resend: data }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
