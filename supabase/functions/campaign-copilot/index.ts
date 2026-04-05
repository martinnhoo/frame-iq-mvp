// campaign-copilot v1 — AI comments in real-time during campaign setup
// Proxies Anthropic API server-side (browser can't call Anthropic directly)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const { user_id, persona_id, persona_name, platform, trigger, form_ctx } = await req.json();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Auth: verify JWT matches user_id ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ messages: [] }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: { user: authUser }, error: authErr } = await sb.auth.getUser(authHeader.slice(7));
    if (authErr || !authUser || authUser.id !== user_id) {
      return new Response(JSON.stringify({ messages: [] }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!ANTHROPIC) {
      return new Response(JSON.stringify({ messages: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch context in parallel
    const [snapRes, patsRes, memRes, profileRes] = await Promise.allSettled([
      sb.from("daily_snapshots" as any)
        .select("total_spend,avg_ctr,active_ads,winners_count,losers_count")
        .eq("user_id", user_id).eq("persona_id", persona_id)
        .order("date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("learned_patterns" as any)
        .select("insight_text,avg_ctr,avg_roas,is_winner,confidence")
        .eq("user_id", user_id)
        .order("confidence", { ascending: false }).limit(8),
      sb.from("chat_memory" as any)
        .select("memory_text,memory_type,importance")
        .eq("user_id", user_id)
        .order("importance", { ascending: false }).limit(8),
      sb.from("user_ai_profile" as any)
        .select("ai_recommendations,pain_point")
        .eq("user_id", user_id).maybeSingle(),
    ]);

    const snap    = snapRes.status    === "fulfilled" ? snapRes.value.data    : null;
    const pats    = patsRes.status    === "fulfilled" ? patsRes.value.data    : [];
    const memories = memRes.status   === "fulfilled" ? memRes.value.data     : [];
    const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;

    // Build context
    const acct = snap
      ? `CTR médio: ${((snap.avg_ctr || 0) * 100).toFixed(2)}% | Spend 7d: R$${(snap.total_spend || 0).toFixed(0)} | Ads ativos: ${snap.active_ads || 0} | Escalando: ${snap.winners_count || 0} | Pausar: ${snap.losers_count || 0}`
      : "Conta sem histórico ainda.";

    const patsText = (pats as any[] || [])
      .filter((p: any) => p.insight_text)
      .map((p: any) => `${p.is_winner ? "✓" : "✗"} ${p.insight_text} (CTR ${((p.avg_ctr || 0) * 100).toFixed(2)}%${p.avg_roas ? `, ROAS ${p.avg_roas.toFixed(1)}x` : ""})`)
      .join("\n");

    const memText = (memories as any[] || [])
      .filter((m: any) => m.memory_text)
      .map((m: any) => m.memory_text)
      .join("\n");

    const bizGoal = (profile as any)?.ai_recommendations?.business_goal;
    const goalText = bizGoal
      ? `Meta de negócio: ${bizGoal.goal}${bizGoal.target_cpa ? ` | CPA alvo: R$${bizGoal.target_cpa}` : ""}${bizGoal.budget ? ` | Budget mensal: R$${bizGoal.budget}` : ""}`
      : null;

    const platformName = false /* google disabled */ ? "Google Ads" : "Meta Ads";

    // Fetch live Meta data — same approach as adbrief-ai-chat
    let liveMetaCtx = "";
    try {
      const { data: metaConns } = await sb.from("platform_connections" as any)
        .select("access_token, ad_accounts, selected_account_id")
        .eq("user_id", user_id).eq("persona_id", persona_id).eq("platform", "meta").eq("status", "active");
      const mc = (metaConns as any[])?.[0];
      if (mc?.access_token) {
        const accs = mc.ad_accounts || [];
        const acc = (mc.selected_account_id && accs.find((a: any) => a.id === mc.selected_account_id)) || accs[0];
        if (acc?.id) {
          const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
          const today = new Date().toISOString().split("T")[0];
          const fields = "campaign_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,frequency";
          const r = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=20&access_token=${mc.access_token}`);
          const j = await r.json();
          if (j.data?.length) {
            const ads = j.data.slice(0, 10).map((a: any) => {
              const ctr = (parseFloat(a.ctr || "0")).toFixed(2);
              const spend = parseFloat(a.spend || "0").toFixed(0);
              const freq = parseFloat(a.frequency || "0").toFixed(1);
              return `  ${a.ad_name}: R$${spend} spend, CTR ${ctr}%, freq ${freq}x`;
            }).join("\n");
            liveMetaCtx = `ANÚNCIOS ATIVOS (últimos 90 dias):\n${ads}`;
          }
        }
      }
    } catch (_) {}

    const isChat = trigger === "chat";
    const userQuestion = form_ctx?.user_question || "";

    const prompt = `Você é o co-piloto de campanhas do AdBrief — media buyer sênior com acesso aos dados reais da conta.

PLATAFORMA: ${platformName}
CONTA: ${persona_name}

DADOS DA CONTA:
${acct}
${liveMetaCtx ? `\n${liveMetaCtx}` : ""}
${patsText ? `\nPADRÕES APRENDIDOS:\n${patsText}` : ""}
${goalText ? `\n${goalText}` : ""}
${memText ? `\nCONTEXTO DO USUÁRIO:\n${memText}` : ""}

${isChat ? `PERGUNTA DO USUÁRIO: "${userQuestion}"

Responda diretamente à pergunta. Use os dados reais da conta acima. Seja direto e específico. Máx 3 linhas.` : `ETAPA ATUAL: ${trigger}
FORMULÁRIO: ${JSON.stringify(form_ctx)}

Gere 1-2 comentários curtos e diretos sobre o que foi preenchido. Use dados reais da conta.`}

NUNCA invente números. Se não há dados, use benchmarks BR (CPA leads Meta BR: R$15-80).
tipos: "tip" (sugestão), "warn" (alerta), "insight" (dado), "ok" (positivo)

Responda APENAS com JSON válido:
[{"type":"tip"|"warn"|"insight"|"ok","text":"..."}]`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: [{ type: "text", text: "You are the AdBrief campaign co-pilot — a senior media buyer that gives short, data-driven commentary during campaign setup. Respond ONLY with a valid JSON array of message objects.", cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ messages: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const text = data.content?.[0]?.text || "[]";
    const messages = JSON.parse(text.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify({ messages }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    // Never crash — copilot is non-blocking
    return new Response(JSON.stringify({ messages: [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
