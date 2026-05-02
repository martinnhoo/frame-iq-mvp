// send-welcome-email v6 — refatorado pra usar _shared/email-layout.ts
// (logo certo + paleta dark navy + sem emoji + sem ciano-bebê em subtítulos).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es" | "fr" | "de";

const T: Record<Lang, {
  subject: string; preheader: string; greeting: string;
  headline: string; sub: string; body: string;
  steps_label: string;
  s1t: string; s1d: string;
  s2t: string; s2d: string;
  s3t: string; s3d: string;
  cta: string; ps: string; footer: string;
}> = {
  pt: {
    subject: "Sua conta no AdBrief está pronta.",
    preheader: "A IA que age como gestor sênior — conectada à sua conta de anúncios.",
    greeting: "Oi",
    headline: "Bem-vindo ao AdBrief.",
    sub: "Não é um chatbot. É um gestor que conhece sua conta.",
    body: "A diferença: uma IA genérica fala de estratégia no vácuo. O AdBrief lê seus dados reais — spend, CTR, frequência, quais criativos estão queimando — e age com base no que encontra.",
    steps_label: "COMO COMEÇAR EM 3 PASSOS",
    s1t: "Crie sua primeira conta",
    s1d: "Uma conta = um cliente ou uma marca. Dê um nome e descreva o negócio — a IA usa isso em cada resposta.",
    s2t: "Conecte Meta Ads",
    s2d: "OAuth oficial, só leitura. A IA passa a ver CTR, ROAS, frequência e padrões de criativos em tempo real.",
    s3t: "Pergunte qualquer coisa",
    s3d: "\"O que está matando meu ROAS?\" · \"Qual criativo pausar?\" · \"Gere 3 hooks para minha conta\"",
    cta: "Abrir o AdBrief →",
    ps: "Trial de 3 dias começa quando você escolhe um plano. Acesso total. Cancele nas primeiras 72h e não paga nada.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Your AdBrief account is ready.",
    preheader: "An AI that acts like a senior manager — connected to your ad account.",
    greeting: "Hey",
    headline: "Welcome to AdBrief.",
    sub: "Not a chatbot. A manager that knows your account.",
    body: "The difference: a generic AI talks strategy in a vacuum. AdBrief reads your real data — spend, CTR, frequency, which creatives are burning — and acts based on what it finds.",
    steps_label: "HOW TO START IN 3 STEPS",
    s1t: "Create your first account",
    s1d: "One account = one client or brand. Give it a name and describe the business — the AI uses this in every answer.",
    s2t: "Connect Meta Ads",
    s2d: "Official OAuth, read-only. The AI starts seeing CTR, ROAS, frequency and creative patterns in real time.",
    s3t: "Ask anything",
    s3d: "\"What's killing my ROAS?\" · \"Which creative should I pause?\" · \"Write 3 hooks for my account\"",
    cta: "Open AdBrief →",
    ps: "3-day trial starts when you pick a plan. Full access. Cancel within 72 hours and pay nothing.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Tu cuenta en AdBrief está lista.",
    preheader: "Una IA que actúa como gestor senior — conectada a tu cuenta de anuncios.",
    greeting: "Hola",
    headline: "Bienvenido a AdBrief.",
    sub: "No es un chatbot. Es un gestor que conoce tu cuenta.",
    body: "La diferencia: una IA genérica habla de estrategia en el vacío. AdBrief lee tus datos reales — gasto, CTR, frecuencia, qué creativos están quemando — y actúa según lo que encuentra.",
    steps_label: "CÓMO EMPEZAR EN 3 PASOS",
    s1t: "Crea tu primera cuenta",
    s1d: "Una cuenta = un cliente o una marca. Dale un nombre y describe el negócio — la IA lo usa en cada respuesta.",
    s2t: "Conecta Meta Ads",
    s2d: "OAuth oficial, solo lectura. La IA empieza a ver CTR, ROAS, frecuencia y patrones de creativos en tiempo real.",
    s3t: "Pregunta lo que quieras",
    s3d: "\"¿Qué está matando mi ROAS?\" · \"¿Qué creativo pausar?\" · \"Escribe 3 hooks para mi cuenta\"",
    cta: "Abrir AdBrief →",
    ps: "Prueba de 3 días comienza cuando eliges un plan. Acceso total. Cancela en las primeras 72h y no pagas nada.",
    footer: "Te registraste en adbrief.pro",
  },
  fr: {
    subject: "Votre compte AdBrief est prêt.",
    preheader: "Une IA qui agit comme un manager senior — connectée à votre compte publicitaire.",
    greeting: "Bonjour",
    headline: "Bienvenue sur AdBrief.",
    sub: "Pas un chatbot. Un manager qui connaît votre compte.",
    body: "La différence : une IA générique parle stratégie dans le vide. AdBrief lit vos vraies données — dépenses, CTR, fréquence, quels créatifs brûlent — et agit selon ce qu'il trouve.",
    steps_label: "COMMENT DÉMARRER EN 3 ÉTAPES",
    s1t: "Créez votre premier compte",
    s1d: "Un compte = un client ou une marque. Donnez-lui un nom et décrivez l'activité — l'IA l'utilise dans chaque réponse.",
    s2t: "Connectez Meta Ads",
    s2d: "OAuth officiel, lecture seule. L'IA commence à voir CTR, ROAS, fréquence et patterns créatifs en temps réel.",
    s3t: "Posez n'importe quelle question",
    s3d: "\"Qu'est-ce qui tue mon ROAS ?\" · \"Quel créatif mettre en pause ?\" · \"Écris 3 hooks pour mon compte\"",
    cta: "Ouvrir AdBrief →",
    ps: "Essai de 3 jours commence quand vous choisissez un plan. Accès complet. Annulez dans les 72h et ne payez rien.",
    footer: "Vous vous êtes inscrit sur adbrief.pro",
  },
  de: {
    subject: "Dein AdBrief-Konto ist bereit.",
    preheader: "Eine KI, die wie ein Senior Manager handelt — verbunden mit deinem Anzeigenkonto.",
    greeting: "Hey",
    headline: "Willkommen bei AdBrief.",
    sub: "Kein Chatbot. Ein Manager, der dein Konto kennt.",
    body: "Der Unterschied: Eine generische KI redet über Strategie im Vakuum. AdBrief liest deine echten Daten — Ausgaben, CTR, Frequenz, welche Creatives verbrennen — und handelt auf Basis dessen.",
    steps_label: "SO GEHT'S LOS IN 3 SCHRITTEN",
    s1t: "Erstelle dein erstes Konto",
    s1d: "Ein Konto = ein Kunde oder eine Marke. Gib ihm einen Namen und beschreibe das Business — die KI nutzt das in jeder Antwort.",
    s2t: "Verbinde Meta Ads",
    s2d: "Offizielles OAuth, nur Lesen. Die KI sieht ab sofort CTR, ROAS, Frequenz und Creative-Muster in Echtzeit.",
    s3t: "Frag alles",
    s3d: "\"Was tötet meinen ROAS?\" · \"Welches Creative pausieren?\" · \"Schreib 3 Hooks für mein Konto\"",
    cta: "AdBrief öffnen →",
    ps: "3-Tage-Test beginnt wenn du einen Plan wählst. Voller Zugang. Kündige in 72h und zahle nichts.",
    footer: "Du hast dich bei adbrief.pro registriert",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  if (c === "fr") return "fr";
  if (c === "de") return "de";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string): string {
  return buildEmailHtml({
    subject: t.subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${t.greeting} ${firstName} —`,
    headline: t.headline,
    subhead: t.sub,
    body: t.body,
    bulletsTitle: t.steps_label,
    bullets: [
      { title: t.s1t, desc: t.s1d },
      { title: t.s2t, desc: t.s2d },
      { title: t.s3t, desc: t.s3d },
    ],
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/dashboard/ai`,
    ps: t.ps,
    footerLine: t.footer,
  });
}

function detectLang2(raw?: string | null): Lang {
  return detectLang(raw);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const authH = req.headers.get("Authorization") ?? "";
    const isServiceRole = authH === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!isServiceRole) {
      if (!authH.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const token = authH.slice(7);
      const sbCheck = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: { user: jwtUser }, error: jwtErr } = await sbCheck.auth.getUser(token);
      if (jwtErr || !jwtUser) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";

    const body = await req.json();
    const email    = body.email;
    const name     = body.name || body.first_name || "";
    const language = body.language;

    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: cors });

    let toEmail = email;
    if (!toEmail && body.user_id) {
      const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: u } = await sb.from("profiles").select("email").eq("id", body.user_id).maybeSingle();
      toEmail = (u as any)?.email;
    }
    if (!toEmail) return new Response(JSON.stringify({ error: "no email found" }), { status: 400, headers: cors });

    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");
    const html = buildHtml(t, firstName, APP);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [toEmail], subject: t.subject, html }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, ...data }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
// redeploy 202604052100
