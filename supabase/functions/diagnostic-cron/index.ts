/**
 * diagnostic-cron — Roda diagnóstico semanal para todas as contas ativas
 *
 * Compara score semana-a-semana e alerta se cair.
 * Chamado via pg_cron toda segunda às 9h.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get all active Meta connections from last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const { data: connections } = await sb
      .from("platform_connections")
      .select("user_id, persona_id, selected_account_id")
      .eq("platform", "meta")
      .eq("status", "active")
      .gte("updated_at", fourteenDaysAgo);

    if (!connections?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_active_connections" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: { user_id: string; score: number | null; prev_score: number | null; delta: number | null; alerted: boolean }[] = [];

    for (const conn of connections) {
      try {
        // Get previous diagnostic score
        const { data: prevDiag } = await sb
          .from("account_diagnostics")
          .select("score, wasted_spend, created_at")
          .eq("user_id", conn.user_id)
          .eq("ad_account_id", conn.selected_account_id || "")
          .maybeSingle();

        const prevScore = prevDiag?.score || null;

        // Run fresh diagnostic via internal invocation
        const diagRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/account-diagnostic`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              user_id: conn.user_id,
              persona_id: conn.persona_id,
              account_id: conn.selected_account_id,
            }),
          }
        );

        if (!diagRes.ok) {
          results.push({ user_id: conn.user_id, score: null, prev_score: prevScore, delta: null, alerted: false });
          continue;
        }

        const diag = await diagRes.json();
        const newScore = diag.score || 0;
        const delta = prevScore !== null ? newScore - prevScore : null;

        let alerted = false;

        // Alert if score dropped by 10+ points
        if (delta !== null && delta <= -10) {
          // Create account alert
          await sb.from("account_alerts").insert({
            user_id: conn.user_id,
            persona_id: conn.persona_id,
            type: "diagnostic_degradation",
            urgency: delta <= -20 ? "critical" : "warning",
            title: `Score da conta caiu ${Math.abs(delta)} pontos`,
            detail: `Score: ${prevScore} → ${newScore}. Desperdício: R$${diag.wasted_spend?.toFixed(0) || 0}. ${diag.ads_to_pause?.length || 0} anúncios para pausar.`,
            action_suggestion: "Acesse /dashboard/diagnostic para ver o diagnóstico completo",
          });

          // Try Telegram alert
          try {
            const { data: profile } = await sb
              .from("user_ai_profile")
              .select("telegram_chat_id")
              .eq("user_id", conn.user_id)
              .maybeSingle();

            if (profile?.telegram_chat_id) {
              await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-telegram`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    user_id: conn.user_id,
                    message: `⚠️ <b>Score da conta caiu ${Math.abs(delta)} pontos</b>\n\n` +
                      `Score: ${prevScore} → ${newScore}\n` +
                      `Desperdiçado: R$${diag.wasted_spend?.toFixed(0) || 0}\n` +
                      `Anúncios para pausar: ${diag.ads_to_pause?.length || 0}\n\n` +
                      `Acesse o diagnóstico completo no app.`,
                  }),
                }
              );
            }
          } catch { /* Telegram non-fatal */ }

          alerted = true;
        }

        results.push({ user_id: conn.user_id, score: newScore, prev_score: prevScore, delta, alerted });

      } catch (e) {
        console.error(`Diagnostic failed for ${conn.user_id}:`, e);
        results.push({ user_id: conn.user_id, score: null, prev_score: null, delta: null, alerted: false });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      alerted: results.filter(r => r.alerted).length,
      results,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("diagnostic-cron error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
