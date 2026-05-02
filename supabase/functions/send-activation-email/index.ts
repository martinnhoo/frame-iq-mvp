// send-activation-email v4 — usa _shared/email-layout (logo certo, sem emoji,
// sem ciano-bebê em subtítulos, sem faixa colorida no topo do card).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

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
  // Each bullet from t.bullets is a quoted question — render as numbered
  // list inside the shared layout (preserves the i18n strings exactly).
  const bullets = t.bullets.map((q, i) => ({
    index: String(i + 1).padStart(2, "0"),
    title: q,
    desc: "",
  }));
  return buildEmailHtml({
    subject: t.subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${firstName},`,
    headline: t.headline,
    body: `${t.body1}<br/><br/>${t.body2}`,
    bulletsTitle: "Perguntas que você já pode fazer",
    bullets,
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/dashboard/accounts`,
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
// redeploy 202604052100
