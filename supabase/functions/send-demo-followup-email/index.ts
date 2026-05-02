// send-demo-followup-email v2 — usa _shared/email-layout.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

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
  const subject = t.subject.replace("{score}", String(score));
  const headline = t.headline.replace("{score}", String(score));

  // Render score as a single stats row (label + big number) inside the layout.
  // The previous implementation used a color-on-color box (green for 7+, amber
  // for 5-6, red for <5) — banned by the design rules. Now the score sits in
  // a neutral stats grid; the headline already says "Seu anúncio: 10/10" so
  // the number is visible there too. No double-count, no red-on-red box.
  const features = t.features.map((f, i) => ({
    index: String(i + 1).padStart(2, "0"),
    title: f,
    desc: "",
  }));

  return buildEmailHtml({
    subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${firstName},`,
    headline,
    body: `${t.body1}<br/><br/>${t.body2}<br/><br/>${t.body3}`,
    bulletsTitle: t.whatYouGetLabel.replace(/:$/, ""),
    bullets: features,
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/auth/signup`,
    ps: t.ps,
    footerLine: t.footer,
  });
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
