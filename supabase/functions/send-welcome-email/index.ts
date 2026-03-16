import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es" | "fr" | "de";

const templates = {
  en: {
    subject: "You're in. Now let's make your ads work harder.",
    preheader: "Connect your ad account and ask anything about your campaigns.",
    greeting: "Hey", headline: "Welcome to AdBrief.",
    body1: "Your account is ready. You now have an AI that reads your Meta, TikTok, or Google Ads data in real time — and thinks like a senior media buyer.",
    body2: "Here's what to do first:",
    s1t: "01 — Connect your ad account", s1d: "Link Meta, TikTok, or Google Ads in one click. No CSV. No manual setup.",
    s2t: "02 — Create a persona", s2d: "Tell AdBrief who you're targeting. It uses this to give you market-specific answers.",
    s3t: "03 — Ask anything", s3d: "\"What's killing my ROAS?\" · \"Write 3 hooks for my top market\" · \"Which ad should I pause?\"",
    cta: "Open AdBrief →", closing: "See you inside,",
    ps: "Your 1-day free trial starts when you pick a plan. Every feature, no limits, cancel anytime within 24 hours.",
    footer: "You signed up at adbrief.pro",
  },
  pt: {
    subject: "Bem-vindo ao AdBrief. Vamos fazer seus anúncios convertirem mais.",
    preheader: "Conecte sua conta de anúncios e pergunte qualquer coisa sobre suas campanhas.",
    greeting: "Oi", headline: "Bem-vindo ao AdBrief.",
    body1: "Sua conta está pronta. Agora você tem uma AI que lê seus dados do Meta, TikTok ou Google Ads em tempo real — e pensa como um media buyer sênior.",
    body2: "Veja o que fazer primeiro:",
    s1t: "01 — Conecte sua conta de anúncios", s1d: "Conecte Meta, TikTok ou Google Ads em um clique. Sem CSV. Sem configuração manual.",
    s2t: "02 — Crie uma persona", s2d: "Diga ao AdBrief quem você está segmentando. Ele usa isso para dar respostas específicas para o seu mercado.",
    s3t: "03 — Pergunte qualquer coisa", s3d: "\"O que está matando meu ROAS?\" · \"Escreva 3 hooks para meu mercado\" · \"Qual anúncio devo pausar?\"",
    cta: "Abrir o AdBrief →", closing: "Até logo,",
    ps: "Seu trial de 1 dia começa quando você escolher um plano. Todos os recursos, sem limites, cancele quando quiser nas primeiras 24 horas.",
    footer: "Você se cadastrou em adbrief.pro",
  },
  es: {
    subject: "Bienvenido a AdBrief. Hagamos que tus anuncios conviertan más.",
    preheader: "Conecta tu cuenta publicitaria y pregunta cualquier cosa sobre tus campañas.",
    greeting: "Hola", headline: "Bienvenido a AdBrief.",
    body1: "Tu cuenta está lista. Ahora tienes una IA que lee tus datos de Meta, TikTok o Google Ads en tiempo real — y piensa como un media buyer senior.",
    body2: "Esto es lo que debes hacer primero:",
    s1t: "01 — Conecta tu cuenta publicitaria", s1d: "Vincula Meta, TikTok o Google Ads en un clic. Sin CSV. Sin configuración manual.",
    s2t: "02 — Crea una persona", s2d: "Dile a AdBrief a quién estás dirigiendo tus anuncios. Lo usa para darte respuestas específicas de tu mercado.",
    s3t: "03 — Pregunta cualquier cosa", s3d: "\"¿Qué está matando mi ROAS?\" · \"Escribe 3 hooks para mi mercado\" · \"¿Qué anuncio debo pausar?\"",
    cta: "Abrir AdBrief →", closing: "Hasta pronto,",
    ps: "Tu prueba de 1 día comienza cuando eliges un plan. Todas las funciones, sin límites, cancela cuando quieras en las primeras 24 horas.",
    footer: "Te registraste en adbrief.pro",
  },
  fr: {
    subject: "Bienvenue sur AdBrief. Faisons performer vos publicités.",
    preheader: "Connectez votre compte publicitaire et posez n'importe quelle question.",
    greeting: "Bonjour", headline: "Bienvenue sur AdBrief.",
    body1: "Votre compte est prêt. Vous avez maintenant une IA qui lit vos données Meta, TikTok ou Google Ads en temps réel — et pense comme un media buyer senior.",
    body2: "Voici quoi faire en premier :",
    s1t: "01 — Connectez votre compte publicitaire", s1d: "Liez Meta, TikTok ou Google Ads en un clic. Sans CSV. Sans configuration manuelle.",
    s2t: "02 — Créez un persona", s2d: "Dites à AdBrief qui vous ciblez. Il utilise ça pour vous donner des réponses spécifiques à votre marché.",
    s3t: "03 — Posez n'importe quelle question", s3d: "\"Qu'est-ce qui tue mon ROAS ?\" · \"Écris 3 hooks pour mon marché\" · \"Quelle pub mettre en pause ?\"",
    cta: "Ouvrir AdBrief →", closing: "À bientôt,",
    ps: "Votre essai d'1 jour commence quand vous choisissez un plan. Toutes les fonctionnalités, annulez à tout moment dans les 24 premières heures.",
    footer: "Vous vous êtes inscrit sur adbrief.pro",
  },
  de: {
    subject: "Willkommen bei AdBrief. Lass deine Anzeigen härter arbeiten.",
    preheader: "Verbinde dein Anzeigenkonto und frag alles über deine Kampagnen.",
    greeting: "Hey", headline: "Willkommen bei AdBrief.",
    body1: "Dein Konto ist bereit. Du hast jetzt eine KI, die deine Meta-, TikTok- oder Google Ads-Daten in Echtzeit liest — und wie ein Senior-Media-Buyer denkt.",
    body2: "Das solltest du zuerst tun:",
    s1t: "01 — Verbinde dein Anzeigenkonto", s1d: "Verknüpfe Meta, TikTok oder Google Ads mit einem Klick. Kein CSV. Kein manuelles Setup.",
    s2t: "02 — Erstelle eine Persona", s2d: "Sag AdBrief, wen du targetierst. Es nutzt das für marktspezifische Antworten.",
    s3t: "03 — Frag alles", s3d: "\"Was tötet meinen ROAS?\" · \"Schreib 3 Hooks für meinen Markt\" · \"Welche Anzeige pausieren?\"",
    cta: "AdBrief öffnen →", closing: "Bis bald,",
    ps: "Dein 1-Tage-Test beginnt, wenn du einen Plan wählst. Alle Funktionen, jederzeit innerhalb von 24 Stunden kündbar.",
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

function buildHtml(t: typeof templates["en"], firstName: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t.subject}</title></head>
<body style="margin:0;padding:0;background:#060812;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${t.preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060812;">
<tr><td align="center" style="padding:48px 16px 64px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<!-- Logo -->
<tr><td style="padding-bottom:36px;">
  <span style="font-size:24px;font-weight:800;letter-spacing:-0.04em;color:#fff;">ad</span><span style="font-size:24px;font-weight:800;letter-spacing:-0.04em;color:#0ea5e9;">brief</span>
</td></tr>

<!-- Divider -->
<tr><td style="padding-bottom:36px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="33%" style="height:1px;background:transparent;"></td>
  <td width="34%" style="height:1px;background:rgba(14,165,233,0.5);"></td>
  <td width="33%" style="height:1px;background:transparent;"></td>
</tr></table></td></tr>

<!-- Headline -->
<tr><td style="padding-bottom:20px;">
  <h1 style="margin:0;font-size:30px;font-weight:800;letter-spacing:-0.04em;line-height:1.1;color:#fff;">${t.headline}</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding-bottom:10px;">
  <p style="margin:0;font-size:16px;color:#e4e4e7;line-height:1.6;">${t.greeting} ${firstName},</p>
</td></tr>
<tr><td style="padding-bottom:24px;">
  <p style="margin:0;font-size:15px;color:#a1a1aa;line-height:1.75;">${t.body1}</p>
</td></tr>
<tr><td style="padding-bottom:20px;">
  <p style="margin:0;font-size:14px;font-weight:600;color:#e4e4e7;">${t.body2}</p>
</td></tr>

<!-- Steps card -->
<tr><td style="padding-bottom:32px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(14,165,233,0.18);border-radius:14px;overflow:hidden;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(14,165,233,0.04);">
      <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#0ea5e9;text-transform:uppercase;">${t.s1t}</p>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${t.s1d}</p>
    </td></tr>
    <tr><td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#06b6d4;text-transform:uppercase;">${t.s2t}</p>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${t.s2d}</p>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#34d399;text-transform:uppercase;">${t.s3t}</p>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${t.s3d}</p>
    </td></tr>
  </table>
</td></tr>

<!-- CTA -->
<tr><td style="padding-bottom:40px;text-align:center;">
  <a href="${appUrl}/dashboard" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#000;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">${t.cta}</a>
</td></tr>

<!-- Closing -->
<tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:15px;color:#a1a1aa;">${t.closing}</p></td></tr>
<tr><td style="padding-bottom:32px;"><p style="margin:0;font-size:15px;font-weight:700;color:#fff;">The AdBrief team</p></td></tr>

<!-- PS box -->
<tr><td style="padding-bottom:40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(14,165,233,0.05);border:1px solid rgba(14,165,233,0.15);border-radius:10px;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0;font-size:12px;color:#71717a;line-height:1.7;"><strong style="color:#a1a1aa;">P.S.</strong> — ${t.ps}</p>
    </td></tr>
  </table>
</td></tr>

<!-- Footer -->
<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;text-align:center;">
  <p style="margin:0 0 4px;font-size:11px;color:#3f3f46;">${t.footer}</p>
  <p style="margin:0;font-size:11px;color:#27272a;">© 2026 AdBrief · adbrief.pro</p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_id, language, first_name, email: emailOverride } = await req.json();

    let toEmail = emailOverride;
    let firstName = first_name || "there";

    if (user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
      if (!toEmail) toEmail = authUser?.user?.email;
      if (firstName === "there" || !first_name) {
        const meta = authUser?.user?.user_metadata;
        firstName = meta?.full_name?.split(" ")[0] || meta?.name?.split(" ")[0]
          || toEmail?.split("@")[0] || "there";
      }
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = detectLang(language);
    const t = templates[lang];
    const appUrl = Deno.env.get("APP_URL") || "https://www.adbrief.pro";
    const html = buildHtml(t, firstName, appUrl);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — skipping send");
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "AdBrief <hello@adbrief.pro>",
        to: [toEmail],
        subject: t.subject,
        html,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(`Resend: ${JSON.stringify(body)}`);

    return new Response(JSON.stringify({ success: true, email: toEmail, lang, id: body.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-welcome-email:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
