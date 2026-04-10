// send-demo-followup-email v1 — indigo palette, personalized score — fires 24h after demo analysis
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, { subject: string; preheader: string; headline: string; body1: string; scoreLabel: string; body2: string; whatYouGetLabel: string; features: string[]; body3: string; cta: string; ps: string; footer: string }> = {
  pt: {
    subject: "Seu anúncio recebeu nota {score}/10 — veja o que melhorar",
    preheader: "Sua análise está pronta. O que descobrimos — e como melhorar.",
    headline: "Seu anúncio: {score}/10",
    body1: "Fizemos a análise do seu anúncio. Há oportunidades claras aqui, e o AdBrief identifica exatamente o que testar.",
    scoreLabel: "Nota de performance",
    body2: "Um score baixo não significa fracasso — significa oportunidade. Os melhores gestores sabem que todo anúncio melhora.",
    whatYouGetLabel: "Na análise completa você vê:",
    features: [
      "Quais elementos (headline, CTA, imagem) estão abaixo do esperado",
      "Por que seu anúncio está perdendo para a concorrência",
      "Exatamente o que testar primeiro para dobrar performance",
    ],
    body3: "O AdBrief não diz só o problema — diz a solução. Com seus dados conectados, a IA recomenda criativos reais para teste.",
    cta: "Ver análise completa →",
    ps: "Trial grátis de 3 dias. Cancele quando quiser.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Your ad scored {score}/10 — here's what to improve",
    preheader: "Your analysis is ready. What we found — and how to improve it.",
    headline: "Your ad: {score}/10",
    body1: "We analyzed your ad. There are clear opportunities here, and AdBrief identifies exactly what to test.",
    scoreLabel: "Performance score",
    body2: "A low score doesn't mean failure — it means opportunity. The best managers know every ad can improve.",
    whatYouGetLabel: "In the full analysis you'll see:",
    features: [
      "Which elements (headline, CTA, image) are underperforming",
      "Why your ad is losing to competitors",
      "Exactly what to test first to double performance",
    ],
    body3: "AdBrief doesn't just identify problems — it gives solutions. With your data connected, the AI recommends actual creatives to test.",
    cta: "See full analysis →",
    ps: "Free 3-day trial. Cancel anytime.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Tu anuncio recibió calificación {score}/10 — aquí qué mejorar",
    preheader: "Tu análisis está listo. Lo que descubrimos — y cómo mejorarlo.",
    headline: "Tu anuncio: {score}/10",
    body1: "Analizamos tu anuncio. Hay oportunidades claras, y AdBrief identifica exactamente qué probar.",
    scoreLabel: "Calificación de desempeño",
    body2: "Una calificación baja no significa fracaso — significa oportunidad. Los mejores gestores saben que todo anuncio mejora.",
    whatYouGetLabel: "En el análisis completo verás:",
    features: [
      "Qué elementos (titular, CTA, imagen) están por debajo de lo esperado",
      "Por qué tu anuncio está perdiendo contra la competencia",
      "Exactamente qué probar primero para doblar el desempeño",
    ],
    body3: "AdBrief no solo identifica problemas — da soluciones. Con tus datos conectados, la IA recomienda creativos reales para probar.",
    cta: "Ver análisis completo →",
    ps: "Prueba gratuita de 3 días. Cancela cuando quieras.",
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

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string, score: number): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  const features = t.features.map(f => `
    <tr><td style="padding:0 0 12px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="28" valign="top" style="padding-top:2px;">
          <div style="width:20px;height:20px;border-radius:6px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);text-align:center;line-height:20px;font-size:11px;color:#6366f1;">→</div>
        </td>
        <td style="font-size:14px;color:rgba(200,215,240,0.8);line-height:1.55;font-family:${F};padding-left:12px;">${f}</td>
      </tr></table>
    </td></tr>`).join("");

  const subject = t.subject.replace("{score}", String(score));
  const headline = t.headline.replace("{score}", String(score));

  const scoreColor = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  const scoreBg = score >= 7 ? "rgba(16,185,129,0.1)" : score >= 5 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const scoreBorder = score >= 7 ? "rgba(16,185,129,0.25)" : score >= 5 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";

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

    <!-- top bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#f59e0b,#ef4444,#ec4899);"></td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 50%);">
    <tr><td style="padding:36px 40px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${firstName},</p>
      <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.15;font-family:${F};">${headline}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body1}</p>

      <!-- Score card -->
      <div style="background:${scoreBg};border:1px solid ${scoreBorder};border-left:3px solid ${scoreColor};border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${scoreColor};letter-spacing:0.1em;text-transform:uppercase;font-family:${F};">${t.scoreLabel}</p>
        <p style="margin:0;font-size:48px;font-weight:900;color:${scoreColor};letter-spacing:-0.05em;font-family:${F};line-height:1;">${score}</p>
      </div>

      <p style="margin:0 0 28px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body2}</p>

      <!-- Features block -->
      <div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-left:3px solid #6366f1;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:800;color:#6366f1;letter-spacing:0.1em;text-transform:uppercase;font-family:${F};">${t.whatYouGetLabel}</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${features}
        </table>
      </div>

      <p style="margin:0 0 32px;font-size:15px;color:rgba(200,215,240,0.7);line-height:1.75;font-family:${F};">${t.body3}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(99,102,241,0.1);"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(99,102,241,0.06) 0%,transparent 100%);">
    <tr><td style="padding:28px 40px 36px;" align="center">
      <a href="${appUrl}/auth/signup" style="display:inline-block;padding:15px 44px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(99,102,241,0.4);">${t.cta}</a>
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
    const { email, name, language, score } = await req.json();
    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");
    const finalScore = Math.min(10, Math.max(1, Math.round(score || 7)));
    const subject = t.subject.replace("{score}", String(finalScore));
    const html = buildHtml(t, firstName, APP, finalScore);
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
