import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, user_id, entries, variables } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supaFetch = (path: string, opts?: RequestInit) =>
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

    // ── ACTION: learn ──
    // Analyze all creative_entries for this user and discover patterns
    if (action === "learn") {
      const res = await supaFetch(`creative_entries?user_id=eq.${user_id}&select=*&order=created_at.desc&limit=500`);
      const entries = await res.json();

      if (!entries?.length) {
        return new Response(JSON.stringify({ patterns: [], message: "No creative entries to learn from" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by composite key: platform+hook_type+market+audience_temp+creative_type
      const groups: Record<string, typeof entries> = {};
      for (const e of entries) {
        const parts = [
          e.platform || "unknown",
          e.hook_type || "unknown",
          e.market || "unknown",
          e.audience_temp || "unknown",
          e.creative_type || "unknown",
        ];
        const key = parts.join("+");
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
      }

      // Calculate aggregates per group
      const patterns = Object.entries(groups)
        .filter(([_, items]) => items.length >= 2) // need min 2 data points
        .map(([key, items]) => {
          const withCtr = items.filter((i: any) => i.ctr != null && i.ctr > 0);
          const withCpc = items.filter((i: any) => i.cpc != null && i.cpc > 0);
          const withRoas = items.filter((i: any) => i.roas != null && i.roas > 0);
          const withThumb = items.filter((i: any) => i.thumb_stop_rate != null);

          const avg = (arr: any[], field: string) =>
            arr.length ? arr.reduce((s: number, i: any) => s + Number(i[field]), 0) / arr.length : null;

          const [platform, hook_type, market, audience_temp, creative_type] = key.split("+");
          const confidence = Math.min(items.length / 10, 1); // confidence scales with sample size

          return {
            pattern_key: key,
            variables: { platform, hook_type, market, audience_temp, creative_type },
            avg_ctr: avg(withCtr, "ctr"),
            avg_cpc: avg(withCpc, "cpc"),
            avg_roas: avg(withRoas, "roas"),
            avg_thumb_stop: avg(withThumb, "thumb_stop_rate"),
            sample_size: items.length,
            confidence: Math.round(confidence * 100) / 100,
            is_winner: false,
          };
        });

      // Find the global avg CTR to mark winners
      const allCtrs = patterns.filter(p => p.avg_ctr != null).map(p => p.avg_ctr!);
      const globalAvgCtr = allCtrs.length ? allCtrs.reduce((a, b) => a + b, 0) / allCtrs.length : 0;

      for (const p of patterns) {
        if (p.avg_ctr != null && p.avg_ctr > globalAvgCtr * 1.2 && p.confidence >= 0.3) {
          p.is_winner = true;
        }
      }

      // Generate insight text with AI
      const winnerPatterns = patterns.filter(p => p.is_winner);
      let insights: Record<string, string> = {};

      if (winnerPatterns.length > 0) {
        const prompt = `Analyze these winning ad creative patterns and write a 1-sentence insight for each one explaining WHY it works. Be specific, not generic.

Patterns:
${winnerPatterns.map(p => `- ${p.pattern_key}: CTR ${(p.avg_ctr! * 100).toFixed(2)}%, ${p.sample_size} samples, confidence ${(p.confidence * 100).toFixed(0)}%`).join("\n")}

Return JSON: { "pattern_key": "insight text", ... }`;

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content || "{}";
            try {
              insights = JSON.parse(raw.replace(/```json|```/g, "").trim());
            } catch { /* ignore parse errors */ }
          }
        } catch { /* AI is optional */ }
      }

      // Upsert patterns to DB
      for (const p of patterns) {
        const body = {
          user_id,
          pattern_key: p.pattern_key,
          variables: p.variables,
          avg_ctr: p.avg_ctr,
          avg_cpc: p.avg_cpc,
          avg_roas: p.avg_roas,
          avg_thumb_stop: p.avg_thumb_stop,
          sample_size: p.sample_size,
          confidence: p.confidence,
          is_winner: p.is_winner,
          insight_text: insights[p.pattern_key] || null,
          last_updated: new Date().toISOString(),
        };

        // Delete existing then insert (upsert workaround)
        await supaFetch(
          `learned_patterns?user_id=eq.${user_id}&pattern_key=eq.${encodeURIComponent(p.pattern_key)}`,
          { method: "DELETE" }
        );
        await supaFetch("learned_patterns", { method: "POST", body: JSON.stringify(body) });
      }

      return new Response(JSON.stringify({
        patterns_found: patterns.length,
        winners: winnerPatterns.length,
        total_entries: entries.length,
        patterns: patterns.slice(0, 20),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: predict ──
    // Score a new creative concept before spending
    if (action === "predict") {
      if (!variables) throw new Error("Missing variables for prediction");

      // Fetch user's learned patterns
      const pRes = await supaFetch(`learned_patterns?user_id=eq.${user_id}&select=*&order=confidence.desc`);
      const patterns = await pRes.json();

      if (!patterns?.length) {
        return new Response(JSON.stringify({
          score: 50,
          confidence: 0,
          reasoning: "Not enough data yet. Import your ad performance data to get accurate predictions.",
          patterns_used: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find matching patterns
      const matching = patterns.filter((p: any) => {
        const v = p.variables;
        let matches = 0;
        let total = 0;
        for (const key of Object.keys(variables)) {
          if (v[key]) {
            total++;
            if (v[key].toLowerCase() === variables[key].toLowerCase()) matches++;
          }
        }
        return total > 0 && matches / total >= 0.4; // at least 40% variable match
      });

      if (!matching.length) {
        return new Response(JSON.stringify({
          score: 50,
          confidence: 0.1,
          reasoning: "No similar patterns found in your data. This is a new combination — results are unpredictable.",
          patterns_used: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Weight by confidence and recency
      const totalConf = matching.reduce((s: number, p: any) => s + p.confidence, 0);
      let weightedCtr = 0;
      let weightedRoas = 0;

      for (const p of matching) {
        const w = p.confidence / totalConf;
        if (p.avg_ctr) weightedCtr += p.avg_ctr * w;
        if (p.avg_roas) weightedRoas += p.avg_roas * w;
      }

      // Fetch global avg for comparison
      const allCtrs = patterns.filter((p: any) => p.avg_ctr).map((p: any) => p.avg_ctr);
      const globalAvg = allCtrs.length ? allCtrs.reduce((a: number, b: number) => a + b, 0) / allCtrs.length : 0;

      const ratio = globalAvg > 0 ? weightedCtr / globalAvg : 1;
      const rawScore = Math.round(Math.min(Math.max(ratio * 50 + 25, 10), 98));
      const avgConfidence = totalConf / matching.length;

      // Generate reasoning
      const prompt = `Based on ad performance data, this creative combination has:
- Predicted CTR: ${(weightedCtr * 100).toFixed(2)}% (avg is ${(globalAvg * 100).toFixed(2)}%)
- Score: ${rawScore}/100
- Based on ${matching.length} similar patterns with avg confidence ${(avgConfidence * 100).toFixed(0)}%
- Variables: ${JSON.stringify(variables)}
- Matching winners: ${matching.filter((p: any) => p.is_winner).length}

Write a 2-sentence prediction summary. Be specific about why this will/won't perform. No fluff.`;

      let reasoning = `Based on ${matching.length} similar patterns, this combination ${rawScore >= 60 ? "aligns with your winning creatives" : "hasn't shown strong results yet"}.`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          reasoning = aiData.choices?.[0]?.message?.content || reasoning;
        }
      } catch { /* AI is optional */ }

      return new Response(JSON.stringify({
        score: rawScore,
        confidence: Math.round(avgConfidence * 100) / 100,
        predicted_ctr: Math.round(weightedCtr * 10000) / 10000,
        predicted_roas: Math.round(weightedRoas * 100) / 100,
        reasoning,
        patterns_used: matching.slice(0, 5).map((p: any) => ({
          key: p.pattern_key,
          is_winner: p.is_winner,
          avg_ctr: p.avg_ctr,
          sample_size: p.sample_size,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'learn' or 'predict'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("creative-loop error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
