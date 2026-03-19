// send-activation-email — fires 24h after signup if user hasn't connected Meta Ads
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const templates: Record<Lang, { subject: string; preheader: string; headline: string; body: string; cta: string; ps: string }> = {
  en: {
    subject: "You're one step away from your first insight",
    preheader: "Connect Meta Ads and ask your first question in 60 seconds.",
    headline: "Your account is ready. Your data isn't connected yet.",
    body: "You created your AdBrief account — but the real value only unlocks when you connect your Meta Ads.\n\nOnce connected, you can ask things like:\n→ \"Which of my ads are in creative fatigue right now?\"\n→ \"What hook pattern do my top converters have in common?\"\n→ \"Why did my ROAS drop this week?\"\n\nAnd get real answers — from your actual account data, not generic AI advice.",
    cta: "Connect Meta Ads →",
    ps: "Takes less than 60 seconds. Read-only access — we never touch your campaigns.",
  },
  pt: {
    subject: "Você está a um passo do seu primeiro insight",
    preheader: "Conecte o Meta Ads e faça sua primeira pergunta em 60 segundos.",
    headline: "Sua conta está pronta. Seus dados ainda não estão conectados.",
    body: "Você criou sua conta no AdBrief — mas o valor real só aparece quando você conecta o Meta Ads.\n\nDepois de conectar, você pode perguntar coisas como:\n→ \"Quais dos meus anúncios estão em fadiga criativa agora?\"\n→ \"Qual padrão de hook meus top criativos têm em comum?\"\n→ \"Por que meu ROAS caiu essa semana?\"\n\nE receber respostas reais — dos seus dados, não conselhos genéricos de IA.",
    cta: "Conectar Meta Ads →",
    ps: "Leva menos de 60 segundos. Acesso somente leitura — nunca tocamos nas suas campanhas.",
  },
  es: {
    subject: "Estás a un paso de tu primer insight",
    preheader: "Conecta Meta Ads y haz tu primera pregunta en 60 segundos.",
    headline: "Tu cuenta está lista. Tus datos aún no están conectados.",
    body: "Creaste tu cuenta en AdBrief — pero el valor real solo se desbloquea cuando conectas Meta Ads.\n\nUna vez conectado, puedes preguntar cosas como:\n→ \"¿Cuáles de mis anuncios están en fatiga creativa ahora mismo?\"\n→ \"¿Qué patrón de hook tienen mis mejores anuncios?\"\n→ \"¿Por qué bajó mi ROAS esta semana?\"\n\nY obtener respuestas reales — de tus datos, no consejos genéricos de IA.",
    cta: "Conectar Meta Ads →",
    ps: "Toma menos de 60 segundos. Acceso de solo lectura — nunca tocamos tus campañas.",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(t: typeof templates["en"], firstName: string, appUrl: string): string {
  const F = "'Plus Jakarta Sans', -apple-system, sans-serif";
  const bodyLines = t.body.split("\n").map(line =>
    line.startsWith("→") 
      ? `<p style="margin:0 0 6px;padding:10px 14px;background:rgba(14,165,233,0.08);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0;font-family:${F};font-size:14px;color:rgba(255,255,255,0.8);">${line}</p>`
      : line.trim() === "" ? "<br/>" 
      : `<p style="margin:0 0 12px;font-family:${F};font-size:15px;color:rgba(255,255,255,0.7);line-height:1.65;">${line}</p>`
  ).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t.subject}</title></head>
<body style="margin:0;padding:0;background:#060812;font-family:${F};">
<span style="display:none;max-height:0;overflow:hidden;">${t.preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060812;">
<tr><td align="center" style="padding:48px 16px 64px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<!-- Logo -->
<tr><td style="padding-bottom:36px;">
  <span style="font-size:24px;font-weight:800;letter-spacing:-0.04em;color:#fff;">ad</span><span style="font-size:24px;font-weight:800;letter-spacing:-0.04em;color:#0ea5e9;">brief</span>
</td></tr>

<!-- Card -->
<tr><td style="background:#0d1117;border-radius:20px;border:1px solid rgba(255,255,255,0.08);padding:36px 32px;">

  <!-- Headline -->
  <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.03em;line-height:1.2;">${t.headline}</h1>
  <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.4);">Hey ${firstName},</p>

  <!-- Body -->
  <div>${bodyLines}</div>

  <!-- CTA -->
  <div style="margin:32px 0 28px;">
    <a href="${appUrl}/dashboard/persona" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#000;font-weight:800;font-size:15px;text-decoration:none;border-radius:12px;font-family:${F};">${t.cta}</a>
  </div>

  <!-- PS -->
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);font-style:italic;">${t.ps}</p>

</td></tr>

<!-- Footer -->
<tr><td style="padding-top:32px;text-align:center;">
  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);">adbrief.pro · <a href="${appUrl}/unsubscribe" style="color:rgba(255,255,255,0.2);">unsubscribe</a></p>
</td></tr>

</table></td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── This function finds users who signed up 20-28h ago with no Meta connection ──
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const appUrl = "https://adbrief.pro";

    // Find users who signed up 20-28 hours ago
    const now = new Date();
    const from = new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

    const { data: users } = await supabase.auth.admin.listUsers();
    const candidates = (users?.users || []).filter(u => {
      const created = u.created_at;
      return created >= from && created <= to;
    });

    const results = [];

    for (const user of candidates) {
      const email = user.email;
      if (!email) continue;

      // Check if they have any active platform connections
      const { data: connections } = await (supabase as any)
        .from("platform_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      // Skip if already connected
      if (connections && connections.length > 0) continue;

      // Check if we already sent this email
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, plan")
        .eq("id", user.id)
        .maybeSingle();

      // Get user language from profile or metadata
      const langRaw = user.user_metadata?.language || (profile as any)?.language || "en";
      const lang = detectLang(langRaw);
      const t = templates[lang];

      const firstName = (profile as any)?.name?.split(" ")[0] 
        || user.user_metadata?.full_name?.split(" ")[0] 
        || user.user_metadata?.name?.split(" ")[0]
        || "there";

      const html = buildHtml(t, firstName, appUrl);

      // Send via Resend
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Martinho from AdBrief <martinho@adbrief.pro>",
          to: [email],
          subject: t.subject,
          html,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@adbrief.pro?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });

      const body = await res.json();
      results.push({ email, status: res.status, id: body.id });
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("send-activation-email error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
