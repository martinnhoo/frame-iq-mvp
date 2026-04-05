// send-reengagement-email v3 — redesign bold, urgência vermelha — fires when user inactive for 7+ days
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es" | "hi";

const T: Record<Lang, { subject: string; preheader: string; headline: string; body1: string; stat: string; body2: string; cta: string; ps: string; footer: string }> = {
  pt: {
    subject: "Enquanto você estava fora, seu budget continuou queimando.",
    preheader: "Anúncios em fadiga, ROAS caindo — e ninguém avisou. A IA estava esperando.",
    headline: "Cada dia sem checar é dinheiro perdido.",
    body1: "A maioria dos gestores descobre fadiga criativa depois de perder 30-40% do orçamento. O AdBrief identifica em 60 segundos.",
    stat: "R$ 1.700",
    body2: "é o que o time médio desperdiça por semana em hooks fracos que nunca detectou. Volte e veja o que está consumindo o seu.",
    cta: "Ver o que está acontecendo na minha conta →",
    ps: "Já tem sua conta conectada. Só precisamos de 60 segundos do seu tempo.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "While you were gone, your budget kept burning.",
    preheader: "Fatigued ads, dropping ROAS — and nobody flagged it. The AI was waiting.",
    headline: "Every day you don't check is money left on the table.",
    body1: "Most teams discover creative fatigue after losing 30-40% of their budget. AdBrief flags it in 60 seconds.",
    stat: "$340",
    body2: "is what the average team wastes per week on weak hooks they never caught. Come back and check what's eating yours.",
    cta: "See what's happening in my account →",
    ps: "Your account is already connected. Takes 60 seconds.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Mientras estabas fuera, tu presupuesto siguió quemándose.",
    preheader: "Anuncios en fatiga, ROAS cayendo — y nadie lo detectó. La IA estaba esperando.",
    headline: "Cada día sin revisar es dinero perdido.",
    body1: "La mayoría de los equipos descubre la fatiga creativa después de perder el 30-40% del presupuesto. AdBrief lo detecta en 60 segundos.",
    stat: "$340",
    body2: "es lo que el equipo promedio desperdicia por semana en hooks débiles que nunca detectó. Vuelve y mira qué está consumiendo el tuyo.",
    cta: "Ver qué está pasando en mi cuenta →",
    ps: "Tu cuenta ya está conectada. Solo 60 segundos.",
    footer: "Te registraste en adbrief.pro",
  },
  hi: {
    subject: "जब आप दूर थे, आपका बजट जलता रहा।",
    preheader: "थके हुए विज्ञापन, गिरता ROAS — और किसी ने नहीं बताया।",
    headline: "हर दिन जांच नहीं करना पैसा खोना है।",
    body1: "अधिकांश टीमें 30-40% बजट खोने के बाद creative fatigue का पता लगाती हैं। AdBrief 60 सेकंड में पहचान लेता है।",
    stat: "₹28,000",
    body2: "औसत टीम प्रति सप्ताह कमजोर hooks पर बर्बाद करती है। वापस आएं और देखें क्या खा रहा है आपका।",
    cta: "मेरी account में क्या हो रहा है देखें →",
    ps: "आपकी account पहले से connected है। सिर्फ 60 seconds।",
    footer: "आपने adbrief.pro पर sign up किया",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  if (c === "hi") return "hi";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";
  const _M = "'Helvetica Neue',Arial,sans-serif";

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
  <tr><td style="border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#0e1628 0%,#0a1020 100%);border:1px solid rgba(248,113,113,0.2);">

    <!-- top bar — red urgency -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#ef4444,#f59e0b);"></td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(239,68,68,0.07) 0%,transparent 50%);">
    <tr><td style="padding:36px 40px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${firstName},</p>
      <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${t.headline}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body1}</p>

      <!-- Stat — big number, red -->
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:16px;padding:24px;margin-bottom:28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:48px;font-weight:900;color:#f87171;letter-spacing:-0.05em;font-family:${F};line-height:1;">${t.stat}</p>
        <p style="margin:0;font-size:14px;color:rgba(200,215,240,0.65);line-height:1.6;font-family:${F};">${t.body2}</p>
      </div>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(14,165,233,0.1);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(14,165,233,0.06) 0%,transparent 100%);">
    <tr><td style="padding:28px 40px 36px;" align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(14,165,233,0.4);">${t.cta}</a>
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
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : lang === "hi" ? "वहाँ" : "there");
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
// redeploy 202604052100
