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

    const platformName = platform === "google" ? "Google Ads" : "Meta Ads";

    const prompt = `Você é o co-piloto de campanhas do AdBrief — um media buyer sênior que comenta em tempo real enquanto o gestor configura uma campanha.

PLATAFORMA: ${platformName}
CONTA: ${persona_name}

DADOS DA CONTA:
${acct}

${patsText ? `PADRÕES APRENDIDOS:\n${patsText}` : ""}
${goalText ? `\n${goalText}` : ""}
${memText ? `\nO QUE O USUÁRIO DISSE NO CHAT:\n${memText}` : ""}

ETAPA ATUAL: ${trigger}
FORMULÁRIO: ${JSON.stringify(form_ctx)}

INSTRUÇÕES:
- Gere 1 a 3 comentários CURTOS e DIRETOS (máx 2 linhas cada)
- Seja ESPECÍFICO: use os números reais da conta
- Se o usuário mencionou metas (ex: "10 agendamentos/mês") e temos CPA histórico, calcule o orçamento necessário
- Se não há histórico, use benchmarks do mercado brasileiro (ex: CPA médio de leads no Meta BR: R$15-80 dependendo do nicho)
- Nunca invente dados que não existem
- tipos: "tip" (sugestão), "warn" (alerta), "insight" (dado relevante), "ok" (confirmação positiva)

Responda APENAS com JSON válido, sem texto antes ou depois:
[{"type":"tip"|"warn"|"insight"|"ok","text":"..."}]`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
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
