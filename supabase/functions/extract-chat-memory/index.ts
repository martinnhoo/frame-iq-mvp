// extract-chat-memory v3
// Robusto, multilingual, com dedup semântico e cap de 50 memórias por persona.
// Garante que a memória de longo prazo cresce de forma confiável e eficiente.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Máximo de memórias por (user_id + persona_id) — mantém o banco limpo
const MAX_MEMORIES_PER_SCOPE = 50;

// Filtro rápido: ignora trocas puramente operacionais sem valor de memória.
// Cobre PT, EN, ES — muito mais abrangente que v2.
const hasMemoryValue = (text: string): boolean => {
  return /lembr|remember|recuerd|prefer|always|nunca|never|siempre|jamás|budget|orçamento|presupuesto|pausei|pausar|escalar|escalei|scale|pause|decidiu|decided|decidí|decidi|regra|rule|regla|meu produto|my product|mi producto|minha marca|my brand|mi marca|meu público|my audience|mi audiencia|trabalho com|i work with|trabajo con|foco em|focus on|enfoque en|meu cliente|my client|mi cliente|objetivo|goal|campanh|campaign|ticket médio|concorrente|competitor|churn|cancelamento/i.test(text);
};

// Explicit "remember this" triggers — these are handled by the pain_point system in adbrief-ai-chat.
// Skipping here prevents double-storage of the same fact in both pain_point and chat_memory.
const isExplicitRemember = (text: string): boolean => {
  return /\b(lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|sempre que|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse))\b/i.test(text);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

  try {
    const { user_id, persona_id, user_message, assistant_response } = await req.json();
    if (!user_id || !user_message || !assistant_response) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_params" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Filtro rápido — skip trocas sem valor de memória (economiza chamada ao Haiku)
    if (!hasMemoryValue(user_message + " " + assistant_response)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Skip explicit "remember" commands — pain_point system in adbrief-ai-chat handles these
    // to avoid storing the same fact twice in two different memory systems
    if (isExplicitRemember(user_message)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "explicit_remember_handled_by_pain_point" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Buscar memórias existentes para dedup e para o cap
    const scopeFilter = persona_id
      ? (sb as any).from("chat_memory").select("id, memory_text, importance, created_at").eq("user_id", user_id).eq("persona_id", persona_id)
      : (sb as any).from("chat_memory").select("id, memory_text, importance, created_at").eq("user_id", user_id).is("persona_id", null);

    const { data: currentMemories } = await scopeFilter
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORIES_PER_SCOPE);

    const existingList = (currentMemories || []) as any[];
    const existingTexts = existingList.map((m: any) => m.memory_text);

    // Extração via Haiku — instrui dedup explícito
    const prompt = `You are a memory extraction system for an ad account AI assistant.

Extract ONLY concrete, durable facts from this conversation that would be useful in future sessions.
Write ALL memory_text values in the SAME LANGUAGE the user is writing in (Portuguese, English, or Spanish).
Focus on: business context, account preferences, decisions made, rules the user wants enforced, product/market info, client info, budget signals.
IGNORE: questions, greetings, one-off temporary states.

EXISTING MEMORIES — do NOT extract anything semantically similar to these:
${existingTexts.length ? existingTexts.map((t: string) => `- ${t}`).join("\n") : "none"}

User said: "${user_message.slice(0, 600)}"
Assistant replied: "${assistant_response.slice(0, 400)}"

Return a JSON array (may be empty []):
[{ "memory_text": "concise fact, max 120 chars", "memory_type": "preference|decision|context|rule", "importance": 1-5 }]

Importance: 5=critical rule/goal, 4=strong preference, 3=useful context, 2=minor detail, 1=trivial.
Return ONLY valid JSON array. Nothing else.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "api_error" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const raw = (await res.json()).content?.[0]?.text?.trim() || "[]";
    let newMemories: any[] = [];
    try {
      newMemories = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (!Array.isArray(newMemories)) newMemories = [];
    } catch {
      return new Response(JSON.stringify({ ok: true, extracted: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!newMemories.length) {
      return new Response(JSON.stringify({ ok: true, extracted: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rows = newMemories
      .filter((m: any) => m.memory_text && String(m.memory_text).trim().length > 5)
      .map((m: any) => ({
        user_id,
        persona_id: persona_id || null,
        memory_text: String(m.memory_text).slice(0, 500),
        memory_type: m.memory_type || "context",
        importance: Math.min(5, Math.max(1, parseInt(m.importance) || 3)),
        source: "chat",
        created_at: new Date().toISOString(),
      }));

    if (!rows.length) {
      return new Response(JSON.stringify({ ok: true, extracted: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await (sb as any).from("chat_memory").insert(rows);

    // ── Cap enforcement: se passou de MAX, deletar os mais antigos de baixa importância ──
    const totalAfter = existingList.length + rows.length;
    if (totalAfter > MAX_MEMORIES_PER_SCOPE) {
      const excess = totalAfter - MAX_MEMORIES_PER_SCOPE;
      const toDelete = [...existingList]
        .sort((a: any, b: any) => {
          if (a.importance !== b.importance) return a.importance - b.importance;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .slice(0, excess)
        .map((m: any) => m.id);

      if (toDelete.length) {
        await (sb as any).from("chat_memory").delete().in("id", toDelete);
      }
    }

    return new Response(JSON.stringify({ ok: true, extracted: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-chat-memory error:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
// v3 — 2026-03-27: dedup semântico, cap 50/persona, multilingual, cleanup automático
