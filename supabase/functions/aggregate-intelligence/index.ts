// aggregate-intelligence v1
// Cérebro central do AdBrief — aprende com TODAS as campanhas de todos os usuários.
// Roda semanalmente. Agrega padrões anônimos por nicho + mercado + tipo de hook.
// Output: learned_patterns com user_id=null — benchmarks reais do setor.
// A AI usa isso como base de conhecimento sem jamais revelar a origem dos dados.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const MIN_SAMPLES_FOR_GLOBAL = 3;
const MIN_SOURCE_CONFIDENCE = 0.25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const today = new Date().toISOString().split("T")[0];

    // ── 1. Collect all performance patterns across all users ──────────────────
    const { data: rawPatterns } = await (sb as any)
      .from("learned_patterns")
      .select("user_id, persona_id, pattern_key, avg_ctr, avg_roas, is_winner, confidence, insight_text, variables, sample_size")
      .not("user_id", "is", null)
      .not("avg_ctr", "is", null)
      .gte("confidence", MIN_SOURCE_CONFIDENCE)
      .gte("sample_size", 2)
      .like("pattern_key", "perf_%")
      .order("avg_ctr", { ascending: false })
      .limit(2000);

    const patterns = (rawPatterns || []) as any[];
    if (!patterns.length) {
      return new Response(JSON.stringify({ ok: true, message: "No patterns yet", global_patterns: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // ── 2. Enrich with persona niche/market ───────────────────────────────────
    const personaIds = [...new Set(patterns.map((p: any) => p.persona_id).filter(Boolean))];
    const { data: personas } = await sb.from("personas").select("id, result").in("id", personaIds.slice(0, 500));
    const personaMap: Record<string, any> = {};
    (personas || []).forEach((p: any) => { personaMap[p.id] = p.result || {}; });

    // ── 3. Aggregate into buckets ──────────────────────────────────────────────
    const buckets: Record<string, {
      ctrs: number[]; roas_values: number[]; winners: number; losers: number;
      entries: any[]; hook_type: string; platform: string; niche: string; market: string;
    }> = {};

    for (const p of patterns) {
      const parts = p.pattern_key.replace("perf_", "").split("_");
      const platform = parts[parts.length - 1];
      const hook_type = parts.slice(0, -1).join("_");
      const persona = personaMap[p.persona_id] || {};
      const niche = persona.niche || persona.industry || "unknown";
      const market = persona.preferred_market || "BR";

      const bucketKeys = [
        `global::${hook_type}::${platform}`,
        `${niche}::${hook_type}::${platform}`,
        `${niche}::${market}::${hook_type}::${platform}`,
      ];

      for (const bk of bucketKeys) {
        if (!buckets[bk]) {
          buckets[bk] = {
            ctrs: [], roas_values: [], winners: 0, losers: 0, entries: [],
            hook_type, platform,
            niche: bk.startsWith("global") ? "all" : niche,
            market: bk.includes(`::${market}::`) ? market : "all",
          };
        }
        buckets[bk].ctrs.push(p.avg_ctr);
        if (p.avg_roas) buckets[bk].roas_values.push(p.avg_roas);
        if (p.is_winner) buckets[bk].winners++; else buckets[bk].losers++;
        const vars = (p.variables as any) || {};
        for (const e of (vars.entries || []).slice(0, 3)) {
          if (e.text) buckets[bk].entries.push({ text: e.text.slice(0, 80), ctr: e.ctr, roas: e.roas });
        }
      }
    }

    // ── 4. Write global patterns (user_id = null) ─────────────────────────────
    let written = 0; let skipped = 0;
    for (const [bk, bucket] of Object.entries(buckets)) {
      const n = bucket.ctrs.length;
      if (n < MIN_SAMPLES_FOR_GLOBAL) { skipped++; continue; }

      const avgCtr = bucket.ctrs.reduce((a, b) => a + b, 0) / n;
      const avgRoas = bucket.roas_values.length
        ? bucket.roas_values.reduce((a, b) => a + b, 0) / bucket.roas_values.length : null;
      const winRate = bucket.winners / n;
      const confidence = Math.min(0.95, n / 20);

      const roasStr = avgRoas ? ` | ROAS médio ${avgRoas.toFixed(1)}x` : "";
      const winStr = winRate > 0.6 ? "padrão vencedor" : winRate > 0.3 ? "padrão misto" : "padrão fraco";
      const marketLabel = bucket.market !== "all" ? ` (${bucket.market})` : "";
      const insight = `${bucket.hook_type} em ${bucket.platform}${marketLabel} — ${winStr}: CTR médio ${(avgCtr * 100).toFixed(2)}%${roasStr} | ${n} campanhas analisadas`;

      const globalKey = `global_benchmark::${bk}`;
      const topEntries = bucket.entries
        .filter((e: any) => e.ctr && e.ctr > avgCtr)
        .sort((a: any, b: any) => (b.ctr || 0) - (a.ctr || 0))
        .slice(0, 5);

      const { data: existing } = await (sb as any).from("learned_patterns")
        .select("id").is("user_id", null).eq("pattern_key", globalKey).maybeSingle();

      const payload = {
        avg_ctr: avgCtr, avg_roas: avgRoas, is_winner: winRate > 0.5, confidence,
        sample_size: n, insight_text: insight, last_updated: new Date().toISOString(),
        variables: { hook_type: bucket.hook_type, platform: bucket.platform, niche: bucket.niche, market: bucket.market, win_rate: winRate, top_entries: topEntries, sample_count: n, last_aggregated: today }
      };

      if (existing) {
        await (sb as any).from("learned_patterns").update(payload).eq("id", existing.id);
      } else {
        await (sb as any).from("learned_patterns").insert({ user_id: null, persona_id: null, pattern_key: globalKey, ...payload });
      }
      written++;
    }

    // ── 5. Haiku synthesis — market summary ───────────────────────────────────
    if (ANTHROPIC && written > 0) {
      const topGlobal = Object.entries(buckets)
        .filter(([bk]) => bk.startsWith("global::"))
        .filter(([, b]) => b.ctrs.length >= MIN_SAMPLES_FOR_GLOBAL)
        .sort(([, a], [, b]) => {
          const avgA = a.ctrs.reduce((s, v) => s + v, 0) / a.ctrs.length;
          const avgB = b.ctrs.reduce((s, v) => s + v, 0) / b.ctrs.length;
          return avgB - avgA;
        })
        .slice(0, 10)
        .map(([, b]) => {
          const avg = b.ctrs.reduce((s, v) => s + v, 0) / b.ctrs.length;
          return `${b.hook_type} em ${b.platform}: CTR médio ${(avg * 100).toFixed(2)}%, ${b.ctrs.length} campanhas, win rate ${(b.winners / b.ctrs.length * 100).toFixed(0)}%`;
        }).join("\n");

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 250,
          messages: [{ role: "user", content: `Você é um analista de dados de marketing digital.\nEstes são benchmarks agregados de campanhas reais (anônimos):\n\n${topGlobal}\n\nEscreva em 2-3 frases uma síntese do que esses dados revelam sobre o que funciona no mercado.\nTom: analista sênior, direto, baseado em dados. Nunca mencione "clientes" ou "usuários". Responda em português.` }]
        })
      });

      if (aiRes.ok) {
        const summary = (await aiRes.json()).content?.[0]?.text?.trim() || "";
        if (summary) {
          const summaryKey = "global_market_summary";
          const { data: es } = await (sb as any).from("learned_patterns").select("id").is("user_id", null).eq("pattern_key", summaryKey).maybeSingle();
          const sp = { insight_text: summary, last_updated: new Date().toISOString(), confidence: 0.9, sample_size: patterns.length, is_winner: true, variables: { generated_at: today, pattern_count: written, source_patterns: patterns.length } };
          if (es) { await (sb as any).from("learned_patterns").update(sp).eq("id", es.id); }
          else { await (sb as any).from("learned_patterns").insert({ user_id: null, persona_id: null, pattern_key: summaryKey, avg_ctr: null, avg_roas: null, ...sp }); }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, source_patterns: patterns.length, global_patterns_written: written, buckets_skipped: skipped }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("aggregate-intelligence error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
// v1 — 2026-03-27
