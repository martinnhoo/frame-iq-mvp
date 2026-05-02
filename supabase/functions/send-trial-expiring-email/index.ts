// send-trial-expiring-email v2 — usa _shared/email-layout.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

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
  const subject = t.subject.replace("{days_left}", String(daysLeft));
  const headline = t.headline.replace("{days_left}", String(daysLeft));
  // Each benefit becomes a bullet without index number — just a checkbox-feel
  // numbered "01/02/03" treatment from the shared layout. Keeps the list look
  // consistent with welcome's "3 passos" rendering.
  const bullets = t.benefits.map((b, i) => ({
    index: String(i + 1).padStart(2, "0"),
    title: b,
    desc: "",
  }));
  return buildEmailHtml({
    subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${firstName},`,
    headline,
    body: `${t.body1}<br/><br/>${t.body2}`,
    bullets,
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/settings/billing`,
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
