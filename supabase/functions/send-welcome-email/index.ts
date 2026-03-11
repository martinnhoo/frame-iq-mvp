import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type Lang = 'en' | 'pt' | 'es' | 'hi';

const templates: Record<Lang, { subject: string; greeting: string; ready: string; cta: string }> = {
  en: {
    subject: "You're in — AdBrief",
    greeting: "Hey",
    ready: "Your account is ready.\n\nDrop a video. See what converts.",
    cta: "Start analyzing",
  },
  pt: {
    subject: "Você está dentro — AdBrief",
    greeting: "Oi",
    ready: "Sua conta está pronta.\n\nSuba um vídeo. Veja o que converte.",
    cta: "Começar a analisar",
  },
  es: {
    subject: "Ya estás dentro — AdBrief",
    greeting: "Hola",
    ready: "Tu cuenta está lista.\n\nSube un video. Ve qué convierte.",
    cta: "Empezar a analizar",
  },
  hi: {
    subject: "आप अंदर हैं — AdBrief",
    greeting: "नमस्ते",
    ready: "आपका अकाउंट तैयार है।\n\nएक वीडियो अपलोड करें। देखें क्या कन्वर्ट होता है।",
    cta: "विश्लेषण शुरू करें",
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
  const lines = t.ready.split('\n').map(l => l.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px;color:#a1a1aa;font-size:15px;line-height:1.6;">${l}</p>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:22px;font-weight:700;color:#fff;">ad</span><span style="font-size:22px;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">brief</span>
        </td></tr>
        <!-- Greeting -->
        <tr><td style="padding-bottom:20px;">
          <p style="margin:0;color:#fff;font-size:17px;font-weight:600;">${t.greeting} ${firstName},</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding-bottom:28px;">
          ${lines}
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding-bottom:40px;">
          <a href="${appUrl}/dashboard/analyses/new" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${t.cta} →</a>
        </td></tr>
        <!-- Divider -->
        <tr><td style="border-top:1px solid #222;padding-top:20px;">
          <p style="margin:0;color:#555;font-size:12px;">— FrameIQ</p>
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, language, first_name } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang = detectLang(language);
    const t = templates[lang];
    const name = first_name || 'there';
    const appUrl = Deno.env.get('APP_URL') || 'https://frame-iq-mvp.lovable.app';

    const html = buildHtml(t, name, appUrl);

    // Get user email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, name')
      .eq('id', user_id)
      .single();

    const email = profile?.email;
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store preferred language
    await supabaseClient
      .from('profiles')
      .update({ preferred_language: lang })
      .eq('id', user_id);

    // TODO: Uncomment when RESEND_API_KEY is available:
    /*
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FrameIQ <hello@frameiq.com>',
        to: [email],
        subject: t.subject,
        html: html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Resend error: ${res.status} ${errBody}`);
    }

    return new Response(
      JSON.stringify({ success: true, language: lang, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    */

    // MOCK: Return the email content for preview
    return new Response(
      JSON.stringify({
        success: true,
        mock_mode: true,
        language: lang,
        subject: t.subject,
        recipient: email,
        first_name: name,
        message: 'Add RESEND_API_KEY to send real emails. Preview HTML below.',
        html_preview: html,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-welcome-email:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
