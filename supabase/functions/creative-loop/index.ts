import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supaFetchFactory = (supabaseUrl: string, supabaseKey: string) =>
  (path: string, opts?: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: opts?.method === "POST" ? "return=representation" : "return=minimal",
        ...(opts?.headers || {}),
      },
    });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, user_id, variables, analysis_data } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supaFetch = supaFetchFactory(supabaseUrl, supabaseKey);

    // ── ACTION: store_analysis ──
    // Store a video analysis result into creative_memory so AI accumulates context
    if (action === "store_analysis") {
      if (!analysis_data) throw new Error("Missing analysis_data");

      const body = {
        user_id,
        analysis_id: analysis_data.analysis_id || null,
        hook_type: analysis_data.hook_type || null,
        hook_score: analysis_data.hook_score || null,
        creative_model: analysis_data.creative_model || null,
        platform: analysis_data.platform || null,
        market: analysis_data.market || null,
        ctr: analysis_data.ctr || null,
        cpc: analysis_data.cpc || null,
        roas: analysis_data.roas || null,
        notes: analysis_data.notes || null,
      };

      await supaFetch("creative_memory", { method: "POST", body: JSON.stringify(body) });

      // Count total memories for this user
      const countRes = await supaFetch(`creative_memory?user_id=eq.${user_id}&select=id`, { method: "HEAD" });
      const total = parseInt(countRes.headers.get("content-range")?.split("/")[1] || "0");

      return new Response(JSON.stringify({ stored: true, total_memories: total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: get_context ──
    // Retrieve accumulated learning context for use in generators
    if (action === "get_context") {
      const [memoriesRes, patternsRes, profileRes, chatMemRes] = await Promise.all([
        supaFetch(`creative_memory?user_id=eq.${user_id}&select=*&order=created_at.desc&limit=50`),
        supaFetch(`learned_patterns?user_id=eq.${user_id}&is_winner=eq.true&select=*&order=confidence.desc&limit=10`),
        supaFetch(`user_ai_profile?user_id=eq.${user_id}&select=*&limit=1`),
        supaFetch(`chat_memory?user_id=eq.${user_id}&select=memory_type,memory_text&order=importance.desc&limit=15`),
      ]);

      const [memories, patterns, profiles, chatMems] = await Promise.all([
        memoriesRes.json(), patternsRes.json(), profileRes.json(), chatMemRes.json(),
      ]);

      const profile = profiles?.[0] || null;

      // Build a concise context string the generators can inject into prompts
      let contextLines: string[] = [];

      if (memories?.length) {
        const hookTypes: Record<string, number> = {};
        const platforms: Record<string, number> = {};
        const markets: Record<string, number> = {};
        let totalScore = 0, scoreCount = 0;

        for (const m of memories) {
          if (m.hook_type) hookTypes[m.hook_type] = (hookTypes[m.hook_type] || 0) + 1;
          if (m.platform) platforms[m.platform] = (platforms[m.platform] || 0) + 1;
          if (m.market) markets[m.market] = (markets[m.market] || 0) + 1;
          if (m.hook_score) { totalScore += m.hook_score; scoreCount++; }
        }

        const topHook = Object.entries(hookTypes).sort((a, b) => b[1] - a[1])[0];
        const topPlatform = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0];
        const topMarket = Object.entries(markets).sort((a, b) => b[1] - a[1])[0];

        contextLines.push(`CREATIVE MEMORY (${memories.length} analyzed ads):`);
        if (topHook) contextLines.push(`- Most used hook type: ${topHook[0]} (${topHook[1]} times)`);
        if (topPlatform) contextLines.push(`- Primary platform: ${topPlatform[0]}`);
        if (topMarket) contextLines.push(`- Main market: ${topMarket[0]}`);
        if (scoreCount) contextLines.push(`- Average hook score: ${(totalScore / scoreCount).toFixed(1)}/10`);
      }

      if (patterns?.length) {
        contextLines.push(`\nWINNING PATTERNS (proven by data):`);
        for (const p of patterns.slice(0, 5)) {
          const vars = Object.entries(p.variables || {})
            .filter(([_, v]) => v !== "unknown")
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
          const ctr = p.avg_ctr ? `CTR ${(p.avg_ctr * 100).toFixed(2)}%` : "";
          const roas = p.avg_roas ? `ROAS ${p.avg_roas.toFixed(1)}x` : "";
          contextLines.push(`- ${vars} → ${[ctr, roas].filter(Boolean).join(", ")} (${p.sample_size} samples, ${(p.confidence * 100).toFixed(0)}% confidence)`);
          if (p.insight_text) contextLines.push(`  Insight: ${p.insight_text}`);
        }
      }

      if (profile?.ai_summary) {
        contextLines.push(`\nAI PROFILE: ${profile.ai_summary}`);
      }

      if (chatMems?.length) {
        const grouped: Record<string, string[]> = {};
        for (const m of chatMems) {
          const t = m.memory_type || "general";
          if (!grouped[t]) grouped[t] = [];
          grouped[t].push(m.memory_text);
        }
        contextLines.push(`\nUSER PREFERENCES (from chat):`);
        for (const [type, texts] of Object.entries(grouped)) {
          for (const txt of texts.slice(0, 3)) {
            contextLines.push(`- [${type}] ${txt.slice(0, 120)}`);
          }
        }
      }

      return new Response(JSON.stringify({
        context: contextLines.join("\n"),
        memories_count: memories?.length || 0,
        patterns_count: patterns?.length || 0,
        has_data: (memories?.length || 0) > 0 || (patterns?.length || 0) > 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: learn ──
    if (action === "learn") {
      const res = await supaFetch(`creative_entries?user_id=eq.${user_id}&select=*&order=created_at.desc&limit=500`);
      const entries = await res.json();

      if (!entries?.length) {
        return new Response(JSON.stringify({ patterns: [], message: "No creative entries to learn from" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const groups: Record<string, typeof entries> = {};
      for (const e of entries) {
        const key = [e.platform || "unknown", e.hook_type || "unknown", e.market || "unknown", e.audience_temp || "unknown", e.creative_type || "unknown"].join("+");
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
      }

      const avg = (arr: any[], field: string) =>
        arr.length ? arr.reduce((s: number, i: any) => s + Number(i[field]), 0) / arr.length : null;

      // Time-decay weighted average — recent data matters more
      const weightedAvg = (arr: any[], field: string) => {
        const valid = arr.filter((i: any) => i[field] != null && Number(i[field]) > 0);
        if (!valid.length) return null;
        const now = Date.now();
        let totalWeight = 0;
        let weightedSum = 0;
        for (const item of valid) {
          const ageMs = now - new Date(item.created_at || now).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          // Half-life of 60 days — data from 60 days ago weighs 50%, 120 days ago 25%
          const weight = Math.pow(0.5, ageDays / 60);
          weightedSum += Number(item[field]) * weight;
          totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : null;
      };

      const patterns = Object.entries(groups)
        .filter(([_, items]) => items.length >= 2)
        .map(([key, items]) => {
          const withCtr = items.filter((i: any) => i.ctr != null && i.ctr > 0);
          const withCpc = items.filter((i: any) => i.cpc != null && i.cpc > 0);
          const withRoas = items.filter((i: any) => i.roas != null && i.roas > 0);
          const withThumb = items.filter((i: any) => i.thumb_stop_rate != null);
          const [platform, hook_type, market, audience_temp, creative_type] = key.split("+");
          const confidence = Math.min(items.length / 10, 1);
          return {
            pattern_key: key,
            variables: { platform, hook_type, market, audience_temp, creative_type },
            avg_ctr: weightedAvg(withCtr, "ctr"),
            avg_cpc: weightedAvg(withCpc, "cpc"),
            avg_roas: weightedAvg(withRoas, "roas"),
            avg_thumb_stop: avg(withThumb, "thumb_stop_rate"),
            sample_size: items.length,
            confidence: Math.round(confidence * 100) / 100,
            is_winner: false,
          };
        });

      const allCtrs = patterns.filter(p => p.avg_ctr != null).map(p => p.avg_ctr!);
      const globalAvgCtr = allCtrs.length ? allCtrs.reduce((a, b) => a + b, 0) / allCtrs.length : 0;

      for (const p of patterns) {
        if (p.avg_ctr != null && p.avg_ctr > globalAvgCtr * 1.2 && p.confidence >= 0.3) {
          p.is_winner = true;
        }
      }

      const winnerPatterns = patterns.filter(p => p.is_winner);
      let insights: Record<string, string> = {};

      if (winnerPatterns.length > 0) {
        const prompt = `Analyze these winning ad creative patterns and write a 1-sentence insight for each explaining WHY it works. Be specific.

Patterns:
${winnerPatterns.map(p => `- ${p.pattern_key}: CTR ${(p.avg_ctr! * 100).toFixed(2)}%, ${p.sample_size} samples, confidence ${(p.confidence * 100).toFixed(0)}%`).join("\n")}

Return JSON: { "pattern_key": "insight text", ... }`;

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }] }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content || "{}";
            try { insights = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { /* ignore */ }
          }
        } catch { /* AI optional */ }
      }

      for (const p of patterns) {
        const body = {
          user_id, pattern_key: p.pattern_key, variables: p.variables,
          avg_ctr: p.avg_ctr, avg_cpc: p.avg_cpc, avg_roas: p.avg_roas,
          avg_thumb_stop: p.avg_thumb_stop, sample_size: p.sample_size,
          confidence: p.confidence, is_winner: p.is_winner,
          insight_text: insights[p.pattern_key] || null,
          last_updated: new Date().toISOString(),
        };
        await supaFetch(`learned_patterns?user_id=eq.${user_id}&pattern_key=eq.${encodeURIComponent(p.pattern_key)}`, { method: "DELETE" });
        await supaFetch("learned_patterns", { method: "POST", body: JSON.stringify(body) });
      }

      return new Response(JSON.stringify({
        patterns_found: patterns.length, winners: winnerPatterns.length,
        total_entries: entries.length, patterns: patterns.slice(0, 20),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: predict ──
    if (action === "predict") {
      if (!variables) throw new Error("Missing variables for prediction");

      const pRes = await supaFetch(`learned_patterns?user_id=eq.${user_id}&select=*&order=confidence.desc`);
      const patterns = await pRes.json();

      if (!patterns?.length) {
        return new Response(JSON.stringify({
          score: 50, confidence: 0,
          reasoning: "Not enough data yet. Import your ad performance data to get accurate predictions.",
          patterns_used: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const matching = patterns.filter((p: any) => {
        const v = p.variables;
        let matches = 0, total = 0;
        for (const key of Object.keys(variables)) {
          if (v[key]) { total++; if (v[key].toLowerCase() === variables[key].toLowerCase()) matches++; }
        }
        return total > 0 && matches / total >= 0.4;
      });

      if (!matching.length) {
        return new Response(JSON.stringify({
          score: 50, confidence: 0.1,
          reasoning: "No similar patterns found. This is a new combination — results are unpredictable.",
          patterns_used: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const totalConf = matching.reduce((s: number, p: any) => s + p.confidence, 0);
      let weightedCtr = 0, weightedRoas = 0;
      for (const p of matching) {
        const w = p.confidence / totalConf;
        if (p.avg_ctr) weightedCtr += p.avg_ctr * w;
        if (p.avg_roas) weightedRoas += p.avg_roas * w;
      }

      const allCtrs = patterns.filter((p: any) => p.avg_ctr).map((p: any) => p.avg_ctr);
      const globalAvg = allCtrs.length ? allCtrs.reduce((a: number, b: number) => a + b, 0) / allCtrs.length : 0;
      const ratio = globalAvg > 0 ? weightedCtr / globalAvg : 1;
      const rawScore = Math.round(Math.min(Math.max(ratio * 50 + 25, 10), 98));
      const avgConfidence = totalConf / matching.length;

      let reasoning = `Based on ${matching.length} similar patterns, this combination ${rawScore >= 60 ? "aligns with your winning creatives" : "hasn't shown strong results yet"}.`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Based on ad performance data: Predicted CTR ${(weightedCtr * 100).toFixed(2)}% (avg ${(globalAvg * 100).toFixed(2)}%), Score ${rawScore}/100, ${matching.length} patterns, Variables: ${JSON.stringify(variables)}. Write 2-sentence prediction. Be specific, no fluff.` }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          reasoning = aiData.choices?.[0]?.message?.content || reasoning;
        }
      } catch { /* AI optional */ }

      return new Response(JSON.stringify({
        score: rawScore, confidence: Math.round(avgConfidence * 100) / 100,
        predicted_ctr: Math.round(weightedCtr * 10000) / 10000,
        predicted_roas: Math.round(weightedRoas * 100) / 100,
        reasoning,
        patterns_used: matching.slice(0, 5).map((p: any) => ({
          key: p.pattern_key, is_winner: p.is_winner, avg_ctr: p.avg_ctr, sample_size: p.sample_size,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'learn', 'predict', 'store_analysis', or 'get_context'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("creative-loop error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
