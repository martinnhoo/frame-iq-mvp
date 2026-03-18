import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es" | "fr" | "de";

const templates = {
  en: {
    subject: "Your AdBrief account is ready.",
    preheader: "The AI that reads your ad account in real time and thinks like a senior strategist.",
    greeting: "Hey", headline: "Welcome to AdBrief.",
    body1: "You now have an AI connected to your ad account — Meta, TikTok, or Google — that answers any question about your campaigns using real data.",
    body2: "Get started in 3 steps:",
    s1t: "01 — Connect your ad account", s1d: "One click. No CSV, no spreadsheet, no manual setup. The AI reads your spend, CTR, CPM, and creatives in real time.",
    s2t: "02 — Create a persona", s2d: "Define who you're advertising to. The AI uses this to respond with context specific to your market.",
    s3t: "03 — Ask anything", s3d: "\"What's killing my ROAS this week?\" · \"Write 3 hooks for my best market\" · \"Which creative should I pause right now?\"",
    cta: "Open AdBrief →", closing: "See you inside,",
    ps: "Your 1-day free trial starts when you pick a plan. Full access to every feature, no limits. Cancel within 24 hours and pay nothing.",
    footer: "You signed up at adbrief.pro",
  },
  pt: {
    subject: "Sua conta no AdBrief está pronta.",
    preheader: "A IA que lê sua conta de anúncios em tempo real e pensa como um gestor de tráfego sênior.",
    greeting: "Oi", headline: "Bem-vindo ao AdBrief.",
    body1: "Você agora tem acesso a uma IA que conecta com sua conta de anúncios — Meta, TikTok ou Google — e responde qualquer pergunta sobre suas campanhas com dados reais.",
    body2: "Comece em 3 passos:",
    s1t: "01 — Conecte sua conta de anúncios", s1d: "Um clique. Sem CSV, sem planilha, sem configuração. A AI lê spend, CTR, CPM e criativos em tempo real.",
    s2t: "02 — Crie uma persona", s2d: "Defina quem você está anunciando. A AI usa isso para responder com contexto do seu mercado específico.",
    s3t: "03 — Pergunte qualquer coisa", s3d: "\"O que está matando meu ROAS essa semana?\" · \"Escreva 3 hooks para meu melhor mercado\" · \"Qual criativo devo pausar agora?\"",
    cta: "Abrir o AdBrief →", closing: "Até logo,",
    ps: "Seu trial de 1 dia começa quando você escolher um plano. Acesso total a todos os recursos, sem limites. Cancele nas primeiras 24 horas e não paga nada.",
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
  <a href="${appUrl}/dashboard/loop/ai" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#000;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">${t.cta}</a>
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

    const { user_id, language, first_name, email: emailOverride, pain_point } = await req.json();

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
    // Personalize subject based on pain_point from onboarding
    const painSubjects: Record<string, Record<string, string>> = {
      roas_drop:       { en: "Your ROAS fix starts here — AdBrief", pt: "Seu ROAS vai melhorar — AdBrief", es: "Tu ROAS mejora aquí — AdBrief" },
      creative_fatigue:{ en: "Fresh creatives on demand — AdBrief",  pt: "Criativos frescos quando precisar — AdBrief", es: "Creativos frescos cuando los necesites — AdBrief" },
      hook_writing:    { en: "Write hooks that stop the scroll — AdBrief", pt: "Escreva hooks que param o scroll — AdBrief", es: "Escribe hooks que detienen el scroll — AdBrief" },
      scaling:         { en: "Scale without killing performance — AdBrief", pt: "Escale sem destruir a performance — AdBrief", es: "Escala sin destruir el rendimiento — AdBrief" },
      briefing:        { en: "Brief your team in 30 seconds — AdBrief", pt: "Briefar sua equipe em 30 segundos — AdBrief", es: "Haz briefing en 30 segundos — AdBrief" },
      analysis:        { en: "Your campaigns analyzed in seconds — AdBrief", pt: "Suas campanhas analisadas em segundos — AdBrief", es: "Tus campañas analizadas en segundos — AdBrief" },
    };
    const langCode = lang.slice(0,2);
    if (pain_point && painSubjects[pain_point]) {
      const subj = painSubjects[pain_point][langCode] || painSubjects[pain_point]["en"];
      if (subj) t = { ...t, subject: subj };
    }
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
// Mon Mar 16 04:13:08 UTC 2026
