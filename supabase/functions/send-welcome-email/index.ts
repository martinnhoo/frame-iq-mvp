// send-welcome-email v3 — unified design system
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es" | "fr" | "de";

const T: Record<Lang, {
  subject: string; preheader: string; greeting: string; headline: string;
  sub: string; body: string; s1t: string; s1d: string; s2t: string; s2d: string;
  s3t: string; s3d: string; cta: string; ps: string; footer: string;
}> = {
  pt: {
    subject: "Sua conta no AdBrief está pronta.",
    preheader: "A IA que sabe o que está acontecendo na sua conta de anúncios — agora.",
    greeting: "Oi",
    headline: "Bem-vindo ao AdBrief.",
    sub: "A IA que conhece sua conta de anúncios.",
    body: "Você tem acesso a uma IA que conecta com o seu Meta Ads e responde qualquer pergunta com dados reais — spend, CTR, criativos, o que escalar, o que pausar.",
    s1t: "Conecte o Meta Ads",
    s1d: "Um clique. A IA lê spend, CTR, criativos e frequência em tempo real.",
    s2t: "Crie uma persona",
    s2d: "Diga para quem você anuncia. A IA usa o contexto do seu mercado em cada resposta.",
    s3t: "Pergunte qualquer coisa",
    s3d: "\"O que está matando meu ROAS?\" · \"Qual criativo pausar?\" · \"Gere 3 hooks para minha conta\"",
    cta: "Abrir o AdBrief →",
    ps: "Trial de 1 dia começa quando você escolhe o plano. Acesso total. Cancele nas primeiras 24h e não paga nada.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Your AdBrief account is ready.",
    preheader: "The AI that knows what's happening in your ad account — right now.",
    greeting: "Hey",
    headline: "Welcome to AdBrief.",
    sub: "The AI that knows your ad account.",
    body: "You now have an AI connected to Meta Ads that answers any question with real data — spend, CTR, creatives, what to scale, what to pause.",
    s1t: "Connect Meta Ads",
    s1d: "One click. The AI reads spend, CTR, creatives and frequency in real time.",
    s2t: "Create a persona",
    s2d: "Tell it who you're targeting. It uses your market context in every answer.",
    s3t: "Ask anything",
    s3d: "\"What's killing my ROAS?\" · \"Which creative should I pause?\" · \"Write 3 hooks for my account\"",
    cta: "Open AdBrief →",
    ps: "1-day trial starts when you pick a plan. Full access. Cancel within 72 hours (3 days) and pay nothing.",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Tu cuenta en AdBrief está lista.",
    preheader: "La IA que sabe qué está pasando en tu cuenta de anuncios — ahora mismo.",
    greeting: "Hola",
    headline: "Bienvenido a AdBrief.",
    sub: "La IA que conoce tu cuenta de anuncios.",
    body: "Tienes acceso a una IA conectada a Meta Ads que responde cualquier pregunta con datos reales — gasto, CTR, creativos, qué escalar, qué pausar.",
    s1t: "Conecta Meta Ads",
    s1d: "Un clic. La IA lee gasto, CTR, creativos y frecuencia en tiempo real.",
    s2t: "Crea una persona",
    s2d: "Dile a quién te diriges. Usa el contexto de tu mercado en cada respuesta.",
    s3t: "Pregunta lo que quieras",
    s3d: "\"¿Qué está matando mi ROAS?\" · \"¿Qué creativo pausar?\" · \"Escribe 3 hooks para mi cuenta\"",
    cta: "Abrir AdBrief →",
    ps: "Prueba de 1 día comienza cuando eliges el plan. Acceso total. Cancela en las primeras 24h y no pagas nada.",
    footer: "Te registraste en adbrief.pro",
  },
  fr: {
    subject: "Votre compte AdBrief est prêt.",
    preheader: "L'IA qui sait ce qui se passe dans votre compte publicitaire — maintenant.",
    greeting: "Bonjour",
    headline: "Bienvenue sur AdBrief.",
    sub: "L'IA qui connaît votre compte publicitaire.",
    body: "Vous avez accès à une IA connectée à Meta Ads qui répond à toute question avec de vraies données — dépenses, CTR, créatifs, quoi scaler, quoi mettre en pause.",
    s1t: "Connectez Meta Ads",
    s1d: "Un clic. L'IA lit dépenses, CTR, créatifs et fréquence en temps réel.",
    s2t: "Créez un persona",
    s2d: "Dites-lui qui vous ciblez. Il utilise le contexte de votre marché dans chaque réponse.",
    s3t: "Posez n'importe quelle question",
    s3d: "\"Qu'est-ce qui tue mon ROAS ?\" · \"Quel créatif mettre en pause ?\" · \"Écris 3 hooks pour mon compte\"",
    cta: "Ouvrir AdBrief →",
    ps: "Essai d'1 jour commence quand vous choisissez le plan. Accès complet. Annulez dans les 24h et ne payez rien.",
    footer: "Vous vous êtes inscrit sur adbrief.pro",
  },
  de: {
    subject: "Dein AdBrief-Konto ist bereit.",
    preheader: "Die KI, die weiß, was in deinem Anzeigenkonto passiert — jetzt.",
    greeting: "Hey",
    headline: "Willkommen bei AdBrief.",
    sub: "Die KI, die dein Anzeigenkonto kennt.",
    body: "Du hast jetzt Zugang zu einer KI, die mit Meta Ads verbunden ist und jede Frage mit echten Daten beantwortet — Ausgaben, CTR, Creatives, was skalieren, was pausieren.",
    s1t: "Meta Ads verbinden",
    s1d: "Ein Klick. Die KI liest Ausgaben, CTR, Creatives und Frequenz in Echtzeit.",
    s2t: "Persona erstellen",
    s2d: "Sag ihr, wen du targetierst. Sie nutzt deinen Marktkontext in jeder Antwort.",
    s3t: "Frag alles",
    s3d: "\"Was tötet meinen ROAS?\" · \"Welches Creative pausieren?\" · \"Schreib 3 Hooks für mein Konto\"",
    cta: "AdBrief öffnen →",
    ps: "1-Tage-Test beginnt wenn du einen Plan wählst. Voller Zugang. Kündige in 72h und zahle nichts.",
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
  const M = "'Helvetica Neue',Arial,sans-serif";

  const steps = [
    { n: "01", title: t.s1t, desc: t.s1d },
    { n: "02", title: t.s2t, desc: t.s2d },
    { n: "03", title: t.s3t, desc: t.s3d },
  ].map(s => `
    <tr>
      <td style="padding:0 0 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="32" valign="top" style="padding-top:2px;">
            <span style="font-size:10px;font-weight:800;color:#0ea5e9;letter-spacing:0.05em;font-family:${M};">${s.n}</span>
          </td>
          <td valign="top">
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#eef0f6;font-family:${F};">${s.title}</p>
            <p style="margin:0;font-size:13px;color:rgba(238,240,246,0.50);line-height:1.55;font-family:${M};">${s.desc}</p>
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
<body style="margin:0;padding:0;background:#080c12;font-family:${M};-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;</span>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080c12;">
<tr><td align="center" style="padding:48px 16px 64px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:36px;">
    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:22px;font-weight:800;color:#0ea5e9;letter-spacing:-0.05em;font-family:${F};">brief</span>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background:#0d1320;border-radius:20px;border:1px solid rgba(255,255,255,0.09);padding:40px;">

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:14px;color:rgba(238,240,246,0.45);font-family:${M};">${t.greeting} ${firstName},</p>

    <!-- Headline -->
    <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.1;font-family:${F};">${t.headline}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(238,240,246,0.45);font-family:${M};">${t.sub}</p>

    <!-- Divider -->
    <div style="height:1px;background:rgba(255,255,255,0.07);margin-bottom:28px;"></div>

    <!-- Body -->
    <p style="margin:0 0 28px;font-size:15px;color:rgba(238,240,246,0.70);line-height:1.70;font-family:${M};">${t.body}</p>

    <!-- Steps -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:20px;">
      <tr><td style="padding:0 0 14px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:rgba(238,240,246,0.30);letter-spacing:0.10em;text-transform:uppercase;font-family:${F};">COMO COMEÇAR</p>
      </td></tr>
      ${steps}
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.30);">${t.cta}</a>
    </td></tr>
    </table>

    <!-- PS -->
    <p style="margin:28px 0 0;font-size:12px;color:rgba(238,240,246,0.30);line-height:1.6;text-align:center;font-family:${M};">${t.ps}</p>

  </td></tr>

  <!-- FOOTER -->
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
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: cors });

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
    return new Response(JSON.stringify({ ok: res.ok, ...data }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
// redeploy 202603270100
