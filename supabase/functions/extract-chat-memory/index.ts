// extract-chat-memory v2
// Roda após cada resposta do chat — extrai fatos, preferências e decisões
// Salva em chat_memory para injetar no contexto das próximas sessões
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

  try {
    const { user_id, persona_id, user_message, assistant_response, existing_memories } = await req.json();
    if (!user_id || !user_message || !assistant_response) {
      return new Response(JSON.stringify({ ok: false }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Só extrai se a troca contém algo memorizável
    const worthExtract = /lembr|remember|prefer|sempre|nunca|budget|orçamento|pausei|escalei|decidiu|regra|meu produto|minha marca|meu público|trabalho com|foco em/i.test(user_message + assistant_response);
    if (!worthExtract) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...cors, "Content-Type": "application/json" } });

    const prompt = `You are a memory extraction system for an ad account AI assistant.

Extract ONLY concrete, durable facts from this conversation exchange that would be useful in future sessions.
IMPORTANT: Write ALL memory_text entries in the SAME LANGUAGE as the user message. If user speaks Portuguese, write in Portuguese. If English, write in English.
Focus on: account preferences, business context, decisions made, rules the user wants enforced, product/market info.
IGNORE: questions, greetings, temporary states, things already obvious from ad data.

Existing memories (don't duplicate):
${(existing_memories || []).map((m: any) => `- ${m.memory_text}`).join("\n") || "none"}

User said: "${user_message}"
Assistant replied: "${assistant_response.slice(0, 400)}"

Return a JSON array of memory objects, or [] if nothing worth storing:
[{ "memory_text": "concise fact in 1 sentence", "memory_type": "preference|decision|context|rule", "importance": 1-5 }]

Return ONLY valid JSON array. Nothing else.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!res.ok) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...cors, "Content-Type": "application/json" } });

    const raw = (await res.json()).content?.[0]?.text?.trim() || "[]";
    let memories: any[] = [];
    try { memories = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } }); }

    if (!memories.length) return new Response(JSON.stringify({ ok: true, extracted: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Upsert — evita duplicatas por texto similar
    const rows = memories.map((m: any) => ({
      user_id,
      persona_id: persona_id || null,
      memory_text: String(m.memory_text || "").slice(0, 500),
      memory_type: m.memory_type || "context",
      importance: Math.min(5, Math.max(1, parseInt(m.importance) || 3)),
      source: "chat",
      created_at: new Date().toISOString(),
    }));

    await (sb as any).from("chat_memory").insert(rows);

    return new Response(JSON.stringify({ ok: true, extracted: rows.length }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("extract-chat-memory error:", e);
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
// redeploy 202603261317
