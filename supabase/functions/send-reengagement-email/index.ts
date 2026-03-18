import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Lang = 'en' | 'pt' | 'es' | 'hi';

const templates: Record<Lang, { subject: string; greeting: string; body: string; cta: string }> = {
  en: {
    subject: "Your budget is burning — AdBrief",
    greeting: "Hey",
    body: "Every day without checking your creatives is money left on the table.\n\nThe average team wastes $340/week on weak hooks they never caught. AdBrief flags them in 60 seconds.\n\nCome back and check what's eating your budget.",
    cta: "Stop wasting budget — analyze now",
  },
  pt: {
    subject: "Seu orçamento está sendo desperdiçado — AdBrief",
    greeting: "Oi",
    body: "Cada dia sem verificar seus criativos é dinheiro perdido.\n\nA maioria dos times desperdiça R$1.700/semana em hooks fracos que nunca detectaram. O AdBrief identifica em 60 segundos.\n\nVolte e veja o que está consumindo seu orçamento.",
    cta: "Parar de desperdiçar — analisar agora",
  },
  es: {
    subject: "Te extrañamos — AdBrief",
    greeting: "Hola",
    body: "Ha pasado un tiempo desde tu última visita.\n\nTus competidores lanzan creativos nuevos cada día. Sube un video y ve qué funciona — toma 30 segundos.",
    cta: "Analizar un video ahora",
  },
  hi: {
    subject: "हम आपको याद कर रहे हैं — AdBrief",
    greeting: "नमस्ते",
    body: "आपकी आखिरी विज़िट को काफी समय हो गया है।\n\nआपके प्रतियोगी हर दिन नए क्रिएटिव्स शिप कर रहे हैं। एक वीडियो अपलोड करें और देखें क्या काम कर रहा है — सिर्फ 30 सेकंड लगते हैं।",
    cta: "अभी एक वीडियो एनालाइज़ करें",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return 'en';
  const code = raw.toLowerCase().slice(0, 2);
  if (code === 'pt') return 'pt';
  if (code === 'es') return 'es';
  if (code === 'hi') return 'hi';
  return 'en';
}

function buildHtml(t: typeof templates['en'], firstName: string, appUrl: string): string {
  const lines = t.body.split('\n').map(l =>
    l.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px;color:#a1a1aa;font-size:15px;line-height:1.6;">${l}</p>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:22px;font-weight:700;color:#fff;">ad</span><span style="font-size:22px;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">brief</span>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <p style="margin:0;color:#fff;font-size:17px;font-weight:600;">${t.greeting} ${firstName},</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          ${lines}
        </td></tr>
        <tr><td style="padding-bottom:40px;">
          <a href="${appUrl}/dashboard/analyses/new" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${t.cta} →</a>
        </td></tr>
        <tr><td style="border-top:1px solid #222;padding-top:20px;">
          <p style="margin:0;color:#555;font-size:12px;">— AdBrief</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping reengagement emails');
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const appUrl = Deno.env.get('APP_URL') || 'https://adbrief.pro';

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    // Target 1: Free users who signed up 2-3 days ago (D+2 window)
    // Target 2: Free users who signed up 7-8 days ago and still haven't converted (D+7 window)
    const { data: targetUsers, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, name, preferred_language, last_ai_action_at, usage_alert_flags, plan, created_at')
      .or(`created_at.gte.${threeDaysAgo},created_at.gte.${eightDaysAgo}`)
      .lt('created_at', twoDaysAgo)
      .not('email', 'is', null);

    if (queryError) throw queryError;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const alertKey = `reengagement_${currentMonth}`;
    let sent = 0;
    let skipped = 0;

    for (const user of (targetUsers || [])) {
      // Only target free users — paid users don't need re-engagement
      const plan = user.plan || 'free';
      if (plan !== 'free') { skipped++; continue; }

      // Skip if already active recently
      if (user.last_ai_action_at && new Date(user.last_ai_action_at) > new Date(twoDaysAgo)) {
        skipped++;
        continue;
      }

      // Skip if already emailed this month
      const flags: Record<string, boolean> = (user.usage_alert_flags as Record<string, boolean>) || {};
      if (flags[alertKey]) {
        skipped++;
        continue;
      }

      const lang = detectLang(user.preferred_language);
      const t = templates[lang];
      const firstName = (user.name || '').trim().split(' ')[0] || 'there';
      const html = buildHtml(t, firstName, appUrl);

      // Send email
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AdBrief <hello@adbrief.pro>',
          to: [user.email],
          subject: t.subject,
          html,
        }),
      });

      if (res.ok) {
        // Mark as sent this month
        await supabase
          .from('profiles')
          .update({ usage_alert_flags: { ...flags, [alertKey]: true } })
          .eq('id', user.id);
        sent++;
      } else {
        const errBody = await res.text();
        console.error(`Failed to send to ${user.email}: ${res.status} ${errBody}`);
      }
    }

    console.log(`Reengagement: sent=${sent}, skipped=${skipped}, total=${(inactiveUsers || []).length}`);

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total: (inactiveUsers || []).length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-reengagement-email error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
