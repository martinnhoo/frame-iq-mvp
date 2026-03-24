// weekly-report — sends weekly performance summary every Sunday
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

  try {
    const { data: conns } = await sb.from("platform_connections" as any)
      .select("user_id, persona_id").eq("platform", "meta").eq("status", "active");

    if (!conns?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });

    const byUser: Record<string, string[]> = {};
    (conns as any[]).forEach(c => {
      if (!byUser[c.user_id]) byUser[c.user_id] = [];
      if (c.persona_id) byUser[c.user_id].push(c.persona_id);
    });

    let sent = 0;
    for (const [userId, personaIds] of Object.entries(byUser)) {
      try {
        const { data: profile } = await sb.from("profiles").select("email").eq("id", userId).maybeSingle() as any;
        if (!profile?.email) continue;

        const { data: snapshots } = await sb.from("daily_snapshots" as any)
          .select("date, total_spend, avg_ctr, ai_insight, persona_id")
          .eq("user_id", userId)
          .gte("date", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0])
          .order("date", { ascending: false });

        if (!snapshots?.length) continue;

        const totalSpend = (snapshots as any[]).reduce((s: number, r: any) => s + (r.total_spend || 0), 0);
        const avgCTR = (snapshots as any[]).reduce((s: number, r: any) => s + (r.avg_ctr || 0), 0) / snapshots.length;
        const topInsight = (snapshots as any[])[0]?.ai_insight || "";

        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',sans-serif;"><div style="max-width:560px;margin:0 auto;padding:32px 24px;"><div style="margin-bottom:24px;"><span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.04em;">ad<span style="color:#38bdf8;">brief</span></span></div><h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 6px;letter-spacing:-0.03em;">Relatório semanal</h1><p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0 0 24px;">${new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p><table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:20px;"><tr><td style="padding:16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-align:center;"><p style="font-size:10px;color:rgba(255,255,255,0.3);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Spend 7d</p><p style="font-size:22px;font-weight:800;color:#fff;margin:0;">R$${totalSpend.toFixed(0)}</p></td><td style="padding:16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-align:center;"><p style="font-size:10px;color:rgba(255,255,255,0.3);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">CTR médio</p><p style="font-size:22px;font-weight:800;color:#fff;margin:0;">${avgCTR.toFixed(2)}%</p></td><td style="padding:16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-align:center;"><p style="font-size:10px;color:rgba(255,255,255,0.3);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Contas</p><p style="font-size:22px;font-weight:800;color:#fff;margin:0;">${personaIds.length}</p></td></tr></table>${topInsight?`<div style="padding:14px 16px;border-radius:10px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.18);margin-bottom:20px;"><p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0;line-height:1.6;">${topInsight}</p></div>`:""}<a href="https://adbrief.pro/dashboard/ai" style="display:block;text-align:center;padding:14px;border-radius:10px;background:#fff;color:#000;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.02em;margin-bottom:20px;">Abrir AdBrief e agir →</a><p style="font-size:11px;color:rgba(255,255,255,0.2);text-align:center;margin:0;">AdBrief · <a href="https://adbrief.pro" style="color:rgba(255,255,255,0.3);">adbrief.pro</a></p></div></body></html>`;

        if (RESEND_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "AdBrief <relatorios@adbrief.pro>",
              to: [profile.email],
              subject: `Relatório semanal · R$${totalSpend.toFixed(0)} · ${personaIds.length} conta${personaIds.length > 1 ? "s" : ""}`,
              html,
            }),
          });
          sent++;
        }
      } catch(e) { console.error("weekly error for", userId, String(e)); }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
