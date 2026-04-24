// extract-chat-memory v4
// Dual-write memory extractor:
//   1. chat_memory — flat, legacy, free-form memories (unchanged shape)
//   2. account_knowledge — typed, structured ontology (product/audience/brand/
//      playbook/constraints) for the new context bundle loader
//
// Guardrails:
//   - Robust multilingual filter (PT/EN/ES) to skip operational noise
//   - Semantic dedup via existing memories in prompt
//   - 50-memory cap per (user, persona) on chat_memory
//   - Every knowledge patch is normalized + merged with existing row before
//     upsert; invalid patches are rejected loudly, not silently written
//   - Fire-and-forget from caller — we never throw back to the user
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized } from "../_shared/cron-auth.ts";
import {
  KnowledgeType,
  KNOWLEDGE_TYPES,
  normalizeKnowledge,
  mergeKnowledge,
} from "../_shared/knowledge-types.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MEMORIES_PER_SCOPE = 50;

// Filtro rápido — ignora trocas puramente operacionais sem valor de memória.
const hasMemoryValue = (text: string): boolean => {
  const trivial = /^(ok|certo|entendi|sim|não|yes|no|sure|thanks|obrigad|valeu|bacana|show|legal|ótimo|perfeito|exato|claro|combinado|tá|ta|ok ok|👍|✅|\.\.\.)[\s!?.]*$/i.test(text.trim());
  if (trivial) return false;
  const greeting = /^(oi|olá|ola|hey|hi|hello|bom dia|boa tarde|boa noite|tudo bem|td bem)[\s!?.,]*$/i.test(text.trim());
  if (greeting) return false;
  return text.length > 20;
};

const isExplicitRemember = (text: string): boolean => {
  return /\b(lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|sempre que|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse))\b/i.test(text);
};

// Compact summary of existing knowledge rows for the dedup prompt.
function summarizeKnowledge(rows: any[]): string {
  if (!rows?.length) return "none";
  return rows
    .slice(0, 40)
    .map((r) => {
      const summary = r.data?.display_summary || r.data?.name || "(sem resumo)";
      return `- ${r.knowledge_type}/${r.slug}: ${summary}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

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

    // ── Auth: accept service-role (internal invocations from adbrief-ai-chat)
    // OR a user JWT whose uid matches the claimed user_id. Without this the
    // internal invocation from adbrief-ai-chat was silently 401'ing and no
    // memory was ever extracted.
    if (!isCronAuthorized(req)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { data: { user: authUser }, error: authErr } = await sb.auth.getUser(authHeader.slice(7));
      if (authErr || !authUser || authUser.id !== user_id) {
        return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // Filtro rápido — skip exchanges with no memory value (saves a Haiku call)
    if (!hasMemoryValue(user_message + " " + assistant_response)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isExplicitSave = isExplicitRemember(user_message);

    // ── Load existing flat memories for dedup + cap management ───────────────
    const scopeFilter = persona_id
      ? (sb as any).from("chat_memory").select("id, memory_text, importance, created_at").eq("user_id", user_id).eq("persona_id", persona_id)
      : (sb as any).from("chat_memory").select("id, memory_text, importance, created_at").eq("user_id", user_id).is("persona_id", null);

    const { data: currentMemories } = await scopeFilter
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORIES_PER_SCOPE);

    const existingList = (currentMemories || []) as any[];
    const existingTexts = existingList.map((m: any) => m.memory_text);

    // ── Load existing typed knowledge for dedup + later merge ────────────────
    const kQuery = (sb as any)
      .from("account_knowledge")
      .select("id, knowledge_type, slug, data, confidence, source")
      .eq("user_id", user_id);
    const kScoped = persona_id ? kQuery.eq("persona_id", persona_id) : kQuery.is("persona_id", null);
    const { data: existingKnowledge } = await kScoped;
    const existingK = (existingKnowledge || []) as any[];

    // ── Haiku: extract BOTH flat memories AND typed knowledge patches ────────
    const prompt = `You are a memory + knowledge extraction system for an ad account AI assistant.

Extract durable facts from this conversation into TWO buckets:
  (A) memories — flat free-form facts (legacy bucket, keep using it)
  (B) knowledge_updates — typed structured records about the account's product,
      audience, brand, playbook (rules), or constraints (budgets/goals)

Write ALL text fields in the SAME LANGUAGE the user is writing in (PT/EN/ES).

${isExplicitSave ? "⚠ USER EXPLICITLY ASKED TO REMEMBER THIS — extract with high importance / confidence, do not skip." : ""}

Focus on: business context, product/price/margin, audience/persona traits, brand tone, rules the user wants enforced, budgets, goals (CPA/ROAS), compliance constraints, winning/losing angles.

STRICTLY IGNORE (these are EPHEMERAL STATE, not durable facts — NEVER extract as memory):
  ❌ current account status labels like "crítico", "saudável", "em alerta", "estável"
  ❌ current ad counts ("X anúncios ativos", "Y campanhas pausadas", "Z em entrega")
  ❌ spend totals tied to a window ("R$174 gastos 30d", "R$1200 última semana", "gastou R$X esse mês")
  ❌ current metric values ("CTR 5.76%", "ROAS 2.1x agora", "CPA de R$45")
  ❌ live performance deltas ("caiu 30% ontem", "subiu esta semana")
  ❌ recent click/impression/conversion counts
  These change hour-by-hour. Storing them as memories creates stale lies the AI will repeat weeks later.

Instead, if the user TARGETS a metric, store the target as a rule/constraint:
  ✓ "target ROAS 3x" → constraint
  ✓ "CPA máximo R$50" → constraint
  ✓ "pausar se frequência > 4" → playbook rule
  ✓ "não gastar mais que R$100/dia em MoFu" → constraint

ALSO IGNORE: pure questions with no context given, one-word responses, anything already in existing memories/knowledge below.

EXISTING FLAT MEMORIES (do NOT duplicate):
${existingTexts.length ? existingTexts.map((t: string) => `- ${t}`).join("\n") : "none"}

EXISTING STRUCTURED KNOWLEDGE (only emit an update if it ADDS info or CORRECTS something):
${summarizeKnowledge(existingK)}

User said: "${String(user_message).slice(0, 800)}"
Assistant replied: "${String(assistant_response).slice(0, 500)}"

Return a single JSON object with this exact shape (no prose, no markdown):
{
  "memories": [
    { "memory_text": "concise fact, max 120 chars", "memory_type": "preference|decision|context|rule", "importance": 1-5 }
  ],
  "knowledge_updates": [
    {
      "knowledge_type": "product" | "audience" | "brand" | "playbook" | "constraints",
      "slug": "kebab-case-id (required for product/audience, use 'main' for brand/playbook/constraints)",
      "confidence": 0.0-1.0,
      "data": {
         "display_summary": "one-line human summary, < 140 chars",
         // plus the type-specific fields — see schema below
      }
    }
  ]
}

Knowledge shapes (emit ONLY fields you actually learned — do not invent):
  product   { name, category?, price?, currency?, margin_pct?, usp?, objections?, key_benefits?, notes? }
  audience  { name, demographics?:{age_range?,gender?,income_range?,location?,education?}, psychographics?, pain_points?, buying_triggers?, funnel_stage?, notes? }
  brand     { tone?, voice?, forbidden_words?, forbidden_angles?, compliance_flags?, key_messages?, notes? }
  playbook  { rules?:[{trigger, action, rationale?}], preferred_formats?, winning_angles?, losing_angles?, notes? }
  constraints { monthly_budget_cap?, daily_floor?, daily_ceiling?, target_cpa?, target_roas?, max_cpa?, min_roas?, working_hours?, notes? }

Importance (memories): 5=critical rule/goal, 4=strong preference, 3=useful context, 2=minor detail, 1=trivial.
Confidence (knowledge): 0.9+ only for explicit user statements; 0.7 for strong inference; 0.5 for soft hints.
Default to EMPTY arrays if nothing qualifies — do not invent to fill space.
Return ONLY the JSON object. Nothing else.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: [{
          type: "text",
          text: "You are a memory + knowledge extraction system for an ad account AI assistant. Extract durable facts and emit a single valid JSON object with `memories` and `knowledge_updates` arrays. No prose, no markdown.",
          cache_control: { type: "ephemeral" },
        }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "api_error" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const raw = (await res.json()).content?.[0]?.text?.trim() || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return new Response(JSON.stringify({ ok: true, extracted: 0, parse_error: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Tolerate older shape (raw array = memories only)
    const newMemories: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.memories) ? parsed.memories : [];
    const knowledgeUpdates: any[] = Array.isArray(parsed?.knowledge_updates) ? parsed.knowledge_updates : [];

    // ── (A) Flat memory writes ───────────────────────────────────────────────
    // Safety net for ephemeral-state leaks: even with the prompt rules,
    // Haiku occasionally extracts things like "Conta em status crítico:
    // 2 campanhas pausadas, 0 anúncios ativos, R$174 gastos (30d), 871
    // cliques, CTR 5.76%" — which are hour-fresh snapshots, not durable
    // facts. Storing them as permanent memories makes the AI confidently
    // recite stale numbers weeks later. This regex is intentionally loose
    // and catches the common patterns we've seen in prod.
    const EPHEMERAL_PATTERNS: RegExp[] = [
      /\b(?:status\s+(?:cr[ií]tico|saud[aá]vel|em\s+alerta|est[aá]vel))\b/i,
      /\b\d+\s+an[úu]ncios?\s+(?:ativos?|em\s+entrega|rodando|pausados?)\b/i,
      /\b\d+\s+campanhas?\s+(?:ativas?|pausadas?|em\s+entrega)\b/i,
      /R\$\s?[\d.,]+\s*(?:gastos?|investidos?)?\s*(?:\(?\s*\d+\s*d\s*\)?|nos?\s+[úu]ltimos?)/i,
      /\bCTR\s+[\d.,]+\s*%/i,
      /\bROAS\s+[\d.,]+\s*x/i,
      /\bCPA\s+(?:de\s+)?R?\$?\s?[\d.,]+/i,
      /\bconversões?\s+[\d.,]+\s*(?:por\s+dia|hoje|ontem)/i,
    ];
    const isEphemeral = (text: string): boolean =>
      EPHEMERAL_PATTERNS.some(rx => rx.test(text));

    const rows = newMemories
      .filter((m: any) => m?.memory_text && String(m.memory_text).trim().length > 5)
      .filter((m: any) => {
        if (isEphemeral(String(m.memory_text))) {
          console.log("[extract-chat-memory] dropped ephemeral:", String(m.memory_text).slice(0, 120));
          return false;
        }
        return true;
      })
      .map((m: any) => ({
        user_id,
        persona_id: persona_id || null,
        memory_text: String(m.memory_text).slice(0, 500),
        memory_type: m.memory_type || "context",
        importance: Math.min(5, Math.max(1, parseInt(m.importance) || 3)),
        source: "chat",
        created_at: new Date().toISOString(),
      }));

    // Opportunistic cleanup: every extraction run sweeps ≥14-day-old memories
    // in this scope whose text matches our ephemeral regex. Conservative by
    // design — only deletes rows that BOTH match the regex AND are old.
    // Fresh inserts of ephemeral stuff are already blocked by the filter
    // above; this retroactively clears the mess written to prod BEFORE this
    // fix shipped. Runs even when rows.length is 0 so cleanup isn't gated
    // on new extractions.
    try {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const staleQ = persona_id
        ? (sb as any).from("chat_memory").select("id, memory_text")
            .eq("user_id", user_id).eq("persona_id", persona_id)
            .lt("created_at", cutoff)
        : (sb as any).from("chat_memory").select("id, memory_text")
            .eq("user_id", user_id).is("persona_id", null)
            .lt("created_at", cutoff);
      const { data: candidates } = await staleQ.limit(50);
      const toPurge = ((candidates || []) as any[])
        .filter(r => r?.memory_text && isEphemeral(String(r.memory_text)))
        .map(r => r.id);
      if (toPurge.length > 0) {
        await (sb as any).from("chat_memory").delete().in("id", toPurge);
        console.log(`[extract-chat-memory] purged ${toPurge.length} stale ephemeral memories`);
      }
    } catch (e) {
      console.error("[extract-chat-memory] cleanup failed (non-blocking):", (e as any)?.message || e);
    }

    if (rows.length) {
      await (sb as any).from("chat_memory").insert(rows);

      // Cap enforcement — keep newest/highest-importance
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
    }

    // ── (B) Structured knowledge upserts ─────────────────────────────────────
    // Index existing by (type, slug) for merge.
    const existingByKey = new Map<string, any>();
    for (const r of existingK) {
      existingByKey.set(`${r.knowledge_type}::${r.slug}`, r);
    }

    const knowledgeResults: Array<{ knowledge_type: string; slug: string; ok: boolean; reason?: string }> = [];

    for (const update of knowledgeUpdates) {
      const kt = update?.knowledge_type as KnowledgeType;
      if (!KNOWLEDGE_TYPES.includes(kt)) {
        knowledgeResults.push({ knowledge_type: String(kt), slug: "?", ok: false, reason: "unknown_type" });
        continue;
      }
      const rawData = (update?.data || {}) as Record<string, unknown>;
      // Pass through slug if provided at top level
      if (update?.slug && typeof update.slug === "string") {
        rawData.slug = update.slug;
      }
      const normalized = normalizeKnowledge(kt, rawData);
      if (!normalized.valid) {
        knowledgeResults.push({ knowledge_type: kt, slug: normalized.slug, ok: false, reason: normalized.reason });
        continue;
      }

      const key = `${normalized.knowledge_type}::${normalized.slug}`;
      const existing = existingByKey.get(key);
      const mergedData = existing
        ? mergeKnowledge(normalized.knowledge_type, existing.data || {}, normalized.data)
        : normalized.data;

      // Confidence: chat extractions cap at 0.75 unless existing was higher
      const rawConf = typeof update?.confidence === "number" ? update.confidence : 0.6;
      const chatConf = Math.max(0, Math.min(0.75, rawConf));
      const existingConf = typeof existing?.confidence === "number" ? existing.confidence : 0;
      const nextConf = Math.max(existingConf, chatConf);

      const row = {
        user_id,
        persona_id: persona_id || null,
        knowledge_type: normalized.knowledge_type,
        slug: normalized.slug,
        data: mergedData,
        confidence: Number(nextConf.toFixed(2)),
        source: "chat",
        last_updated: new Date().toISOString(),
      };

      // Upsert by (user_id, COALESCE(persona_id), knowledge_type, slug).
      // Note: PostgREST on_conflict needs the column list in the same order as
      // the unique index — but since COALESCE isn't a plain column, we fall
      // back to manual update-or-insert.
      if (existing) {
        const { error: updErr } = await (sb as any)
          .from("account_knowledge")
          .update({
            data: row.data,
            confidence: row.confidence,
            source: row.source,
            last_updated: row.last_updated,
          })
          .eq("id", existing.id);
        if (updErr) {
          knowledgeResults.push({ knowledge_type: row.knowledge_type, slug: row.slug, ok: false, reason: "update_failed" });
          continue;
        }
        // Update local cache so repeated updates in same batch merge correctly
        existingByKey.set(key, { ...existing, data: row.data, confidence: row.confidence });
      } else {
        const { error: insErr, data: insRow } = await (sb as any)
          .from("account_knowledge")
          .insert(row)
          .select("id, knowledge_type, slug, data, confidence")
          .single();
        if (insErr) {
          // Likely a race — another request inserted the same (type, slug).
          // Retry as update by fetching the row and merging.
          const refetch = await (sb as any)
            .from("account_knowledge")
            .select("id, data, confidence")
            .eq("user_id", user_id)
            .eq("knowledge_type", row.knowledge_type)
            .eq("slug", row.slug)
            .maybeSingle();
          const raced = refetch?.data;
          if (raced) {
            const remerged = mergeKnowledge(normalized.knowledge_type, raced.data || {}, normalized.data);
            await (sb as any)
              .from("account_knowledge")
              .update({
                data: remerged,
                confidence: Math.max(Number(raced.confidence || 0), row.confidence),
                source: row.source,
                last_updated: row.last_updated,
              })
              .eq("id", raced.id);
            existingByKey.set(key, { id: raced.id, knowledge_type: row.knowledge_type, slug: row.slug, data: remerged, confidence: row.confidence });
            knowledgeResults.push({ knowledge_type: row.knowledge_type, slug: row.slug, ok: true, reason: "race_merged" });
            continue;
          }
          knowledgeResults.push({ knowledge_type: row.knowledge_type, slug: row.slug, ok: false, reason: "insert_failed" });
          continue;
        }
        if (insRow) existingByKey.set(key, insRow);
      }

      knowledgeResults.push({ knowledge_type: row.knowledge_type, slug: row.slug, ok: true });
    }

    return new Response(JSON.stringify({
      ok: true,
      extracted: rows.length,
      knowledge_applied: knowledgeResults.filter((k) => k.ok).length,
      knowledge_rejected: knowledgeResults.filter((k) => !k.ok).length,
      knowledge_results: knowledgeResults,
    }), {
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
// v4 — 2026-04-22: dual-write to chat_memory + account_knowledge (typed ontology).
// Emits structured knowledge patches via normalizeKnowledge/mergeKnowledge from
// _shared/knowledge-types.ts. Backward compatible with old array-only responses.
