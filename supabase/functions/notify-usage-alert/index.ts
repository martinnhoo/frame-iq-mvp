import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')  ?? '';
const ALERT_EMAIL     = Deno.env.get('OWNER_ALERT_EMAIL') ?? 'martinhovff@gmail.com';
const FROM_EMAIL      = Deno.env.get('RESEND_FROM_EMAIL') ?? 'AdBrief <noreply@adbrief.pro>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Internal only — called by check-usage which is already auth-protected
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { user_id, plan, cost_ratio, estimated_cost, plan_revenue } = await req.json();

    // ── Guard: only fire for paid plans ──────────────────────────────────────
    if (!user_id || plan === 'free') {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Guard: only alert once per calendar month per user ───────────────────
    const currentPeriod = new Date().toISOString().slice(0, 7); // "2026-03"
    const alertKey = `usage_alert_75_${currentPeriod}`;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, usage_alert_flags')
      .eq('id', user_id)
      .single();

    const flags: Record<string, boolean> = (profile?.usage_alert_flags as Record<string, boolean>) || {};
    if (flags[alertKey]) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already_alerted_this_month' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark as alerted
    await supabase
      .from('profiles')
      .update({ usage_alert_flags: { ...flags, [alertKey]: true } })
      .eq('id', user_id);

    const userName  = profile?.name  || 'Unknown user';
    const userEmail = profile?.email || '—';
    const pct       = Math.round(cost_ratio * 100);
    const costStr   = `$${estimated_cost.toFixed(3)}`;
    const revenueStr = `$${plan_revenue.toFixed(2)}`;
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

    // ── Send email via Resend ────────────────────────────────────────────────
    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping email, alert was logged');
      return new Response(JSON.stringify({ success: true, email_sent: false, reason: 'no_resend_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailBody = `
<div style="font-family: 'DM Mono', monospace; background: #050505; color: #fff; padding: 32px; max-width: 540px; border-radius: 16px; border: 1px solid #222;">
  <p style="color:#a78bfa; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; margin:0 0 16px;">AdBrief · Usage Alert</p>
  <h2 style="font-size:20px; margin:0 0 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
    ${planLabel} user at ${pct}% of plan cost
  </h2>
  <p style="color:#666; font-size:13px; margin:0 0 24px;">A paid user is approaching their cost threshold.</p>

  <table style="width:100%; border-collapse:collapse; font-size:13px;">
    <tr><td style="padding:8px 0; color:#666; border-bottom:1px solid #1a1a1a;">User</td>
        <td style="padding:8px 0; text-align:right; border-bottom:1px solid #1a1a1a;">${userName}</td></tr>
    <tr><td style="padding:8px 0; color:#666; border-bottom:1px solid #1a1a1a;">Email</td>
        <td style="padding:8px 0; text-align:right; border-bottom:1px solid #1a1a1a;">${userEmail}</td></tr>
    <tr><td style="padding:8px 0; color:#666; border-bottom:1px solid #1a1a1a;">Plan</td>
        <td style="padding:8px 0; text-align:right; border-bottom:1px solid #1a1a1a;">${planLabel} · ${revenueStr}/mo</td></tr>
    <tr><td style="padding:8px 0; color:#666; border-bottom:1px solid #1a1a1a;">API cost this month</td>
        <td style="padding:8px 0; text-align:right; border-bottom:1px solid #1a1a1a; color:#fbbf24;">${costStr}</td></tr>
    <tr><td style="padding:8px 0; color:#666;">Cost / Revenue ratio</td>
        <td style="padding:8px 0; text-align:right; color:${pct >= 90 ? '#f87171' : '#fbbf24'};">${pct}%</td></tr>
  </table>

  <div style="margin-top:24px; padding:12px 16px; background:#0a0a0d; border:1px solid #222; border-radius:10px;">
    <p style="margin:0; font-size:12px; color:#555;">
      Throttle status: ${pct >= 80 ? '⚠️ Progressivo ativo' : '✅ Livre'}<br/>
      Throttle will activate at 80% · Max cooldown at 100%
    </p>
  </div>

  <p style="margin-top:24px; font-size:11px; color:#333;">
    This alert fires once per month per user when they cross 75% of plan cost.
  </p>
</div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ALERT_EMAIL],
        subject: `⚠️ [AdBrief] ${planLabel} user at ${pct}% cost — ${userName}`,
        html: emailBody,
      }),
    });

    const resData = await res.json();
    console.log('Resend response:', resData);

    return new Response(JSON.stringify({ success: true, email_sent: true, resend: resData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('notify-usage-alert error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
