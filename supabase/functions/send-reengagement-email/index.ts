// send-reengagement-email v2 — fires when user inactive for 7+ days
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
  const M = "'Helvetica Neue',Arial,sans-serif";

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
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);width:34px;height:34px;border-radius:9px;text-align:center;vertical-align:middle;">
        <span style="font-size:16px;font-weight:900;color:#fff;font-family:${F};display:block;line-height:34px;letter-spacing:-0.05em;">ab</span>
      </td>
      <td style="padding-left:10px;vertical-align:middle;">
        <span style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-0.04em;font-family:${F};">ad</span><span style="font-size:19px;font-weight:800;color:#0ea5e9;letter-spacing:-0.04em;font-family:${F};">brief</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background:#0d1320;border-radius:20px;border:1px solid rgba(255,255,255,0.09);padding:40px;">
    <p style="margin:0 0 6px;font-size:14px;color:rgba(238,240,246,0.45);font-family:${M};">${firstName},</p>
    <h1 style="margin:0 0 24px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${t.headline}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:rgba(238,240,246,0.65);line-height:1.70;font-family:${M};">${t.body1}</p>

    <!-- Stat highlight -->
    <div style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.18);border-radius:12px;padding:20px 24px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:42px;font-weight:900;color:#f87171;letter-spacing:-0.05em;font-family:${F};line-height:1;">${t.stat}</p>
      <p style="margin:0;font-size:14px;color:rgba(238,240,246,0.55);line-height:1.55;font-family:${M};">${t.body2}</p>
    </div>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.30);">${t.cta}</a>
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
    const firstName = (name || "").split(" ")[0] || (lang === "pt" ? "gestor" : "there");
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
// redeploy 202603262000
