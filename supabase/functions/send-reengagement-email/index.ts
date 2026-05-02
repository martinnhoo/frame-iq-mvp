// send-reengagement-email v5 — usa _shared/email-layout.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, { subject: string; preheader: string; headline: string; body1: string; stat: string; body2: string; cta: string; ps: string; footer: string }> = {
  pt: {
    subject: "Sua conta de anúncios sentiu sua falta",
    preheader: "Criativos em fadiga, ROAS caindo — e você não sabe. A IA estava esperando.",
    headline: "Cada dia sem checar é dinheiro desperdiçado.",
    body1: "A maioria dos gestores descobre fadiga criativa depois de perder 30-40% do orçamento. O AdBrief identifica em 60 segundos.",
    stat: "R$ 1.700",
    body2: "é o que o time médio desperdiça por semana em criativos fracos que nunca detectou. Volte e veja o que está comendo seu orçamento.",
    cta: "Verificar minha conta agora →",
    ps: "Sua conta já está conectada. Leva 60 segundos.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Your ad account misses you",
    preheader: "Creative fatigue, dropping ROAS — and you don't know. The AI was waiting.",
    headline: "Every day you don't check is money left on the table.",
    body1: "Most teams discover creative fatigue after losing 30-40% of their budget. AdBrief flags it in 60 seconds.",
    stat: "$340",
    body2: "is what the average team wastes per week on weak creatives they never caught. Come back and check what's eating your budget.",
    cta: "Check my account now →",
    ps: "Your account is already connected. Takes 60 seconds.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Tu cuenta de anuncios te extraña",
    preheader: "Creativos en fatiga, ROAS cayendo — y no lo sabes. La IA estaba esperando.",
    headline: "Cada día sin revisar es dinero perdido.",
    body1: "La mayoría de los equipos descubre la fatiga creativa después de perder el 30-40% del presupuesto. AdBrief lo detecta en 60 segundos.",
    stat: "$340",
    body2: "es lo que el equipo promedio desperdicia por semana en creativos débiles que nunca detectó. Vuelve y mira qué está comiendo tu presupuesto.",
    cta: "Revisar mi cuenta ahora →",
    ps: "Tu cuenta ya está conectada. Solo 60 segundos.",
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
  // The original template had a custom red-number-in-box treatment for the
  // stat — that's exactly the "color-on-color box" the user banned. Inline
  // the stat into the body with bold weight; the visceral hit comes from
  // tabular-nums + bold inside readable prose, not from a styled callout box.
  return buildEmailHtml({
    subject: t.subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${firstName},`,
    headline: t.headline,
    subhead: t.body1,
    body: `<strong style="color:#F0F6FC;font-variant-numeric:tabular-nums;">${t.stat}</strong> ${t.body2}`,
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/dashboard/ai`,
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
// redeploy 202604101800
