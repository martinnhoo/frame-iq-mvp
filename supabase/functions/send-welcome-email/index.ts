// send-welcome-email v5 — design renovado, sem, mais cor
import { createClient } from "npm:@supabase/supabase-js@2";

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
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  const steps = [
    { n: "01", emoji: "🏠", title: t.s1t, desc: t.s1d },
    { n: "02", emoji: "⚡", title: t.s2t, desc: t.s2d },
    { n: "03", emoji: "💬", title: t.s3t, desc: t.s3d },
  ].map(s => `
    <tr>
      <td style="padding:0 0 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="44" valign="top">
            <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(14,165,233,0.25),rgba(6,182,212,0.15));border:1px solid rgba(14,165,233,0.3);display:flex;align-items:center;justify-content:center;text-align:center;line-height:32px;font-size:15px;">${s.emoji}</div>
          </td>
          <td valign="top" style="padding-left:4px;">
            <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#ffffff;font-family:${F};line-height:1.3;">${s.title}</p>
            <p style="margin:0;font-size:13px;color:rgba(200,210,230,0.6);line-height:1.6;font-family:${F};">${s.desc}</p>
          </td>
        </tr>
        </table>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:#050811;-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</span>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050811;">
<tr><td align="center" style="padding:40px 16px 56px;">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

  <!-- LOGO row -->
  <tr><td style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:20px;font-weight:800;color:#0ea5e9;letter-spacing:-0.05em;font-family:${F};">brief</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- HERO CARD -->
  <tr><td style="border-radius:24px;overflow:hidden;background:linear-gradient(160deg,#0e1628 0%,#0a1020 100%);border:1px solid rgba(14,165,233,0.2);">

    <!-- Top accent gradient bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#0ea5e9 0%,#06b6d4 50%,#6366f1 100%);"></td></tr>
    </table>

    <!-- Glow header area -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(14,165,233,0.08) 0%,transparent 60%);">
    <tr><td style="padding:40px 40px 32px;">

      <!-- Greeting -->
      <p style="margin:0 0 8px;font-size:14px;color:rgba(150,180,220,0.6);font-family:${F};">${t.greeting} ${firstName} —</p>

      <!-- Main headline -->
      <h1 style="margin:0 0 10px;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.1;font-family:${F};">${t.headline}</h1>

      <!-- Subline with cyan accent -->
      <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#22d3ee;font-family:${F};letter-spacing:-0.01em;">${t.sub}</p>

      <!-- Body -->
      <p style="margin:0;font-size:15px;color:rgba(200,210,230,0.75);line-height:1.75;font-family:${F};">${t.body}</p>

    </td></tr>
    </table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:linear-gradient(90deg,transparent,rgba(14,165,233,0.2),transparent);"></td></tr>
    </table>

    <!-- Steps block -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:32px 40px 28px;">
      <p style="margin:0 0 24px;font-size:10px;font-weight:800;color:#0ea5e9;letter-spacing:0.14em;text-transform:uppercase;font-family:${F};">${t.steps_label}</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${steps}
      </table>
    </td></tr>
    </table>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:1px;background:rgba(14,165,233,0.1);"></td></tr>
    </table>

    <!-- CTA area with subtle glow -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,rgba(14,165,233,0.06) 0%,transparent 100%);">
    <tr><td style="padding:32px 40px 40px;" align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.4),0 2px 8px rgba(14,165,233,0.2);">${t.cta}</a>
      <p style="margin:20px 0 0;font-size:12px;color:rgba(150,180,220,0.4);font-family:${F};line-height:1.6;">${t.ps}</p>
    </td></tr>
    </table>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:28px 8px 0;" align="center">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);font-family:${F};">${t.footer} · <a href="https://adbrief.pro" style="color:rgba(14,165,233,0.5);text-decoration:none;">adbrief.pro</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
