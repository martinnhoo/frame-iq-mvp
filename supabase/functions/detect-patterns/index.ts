import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * detect-patterns — AdBrief Pattern Detection System
 *
 * Analyzes ad_diary data per persona to find statistically meaningful
 * creative patterns. Uses ONLY real account data, never generic advice.
 *
 * Actions:
 *   detect  — Run pattern detection for a persona (primary action)
 *   list    — Return cached patterns for sidebar display
 *
 * Data pipeline:
 *   1. Fetch ad_diary entries for persona (last 90 days)
 *   2. Join creative metadata (hook_type, format, text_density, etc.)
 *   3. Group ads by shared creative features
 *   4. Compare each group vs account baseline
 *   5. Validate: sample_size >= 3, consistency check, confidence scoring
 *   6. Generate AI insight for each validated pattern
 *   7. Upsert into learned_patterns with persona_id tag
 */

const supaFetchFactory = (supabaseUrl: string, supabaseKey: string) =>
  (path: string, opts?: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: opts?.method === "POST"
          ? "return=representation"
          : opts?.method === "DELETE"
          ? "return=minimal"
          : "return=minimal",
        ...(opts?.headers || {}),
      },
    });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Time-decay weighted average — 60-day half-life */
function weightedAvg(items: any[], field: string): number | null {
  const valid = items.filter((i) => i[field] != null && Number(i[field]) > 0);
  if (!valid.length) return null;
  const now = Date.now();
  let totalWeight = 0;
  let weightedSum = 0;
  for (const item of valid) {
    const ageMs = now - new Date(item.synced_at || item.created_at || now).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const weight = Math.pow(0.5, ageDays / 60);
    weightedSum += Number(item[field]) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/** Coefficient of variation — lower = more consistent */
function coefficientOfVariation(items: any[], field: string): number {
  const vals = items.filter((i) => i[field] != null && Number(i[field]) > 0).map((i) => Number(i[field]));
  if (vals.length < 2) return 1;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return 1;
  const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
  return Math.sqrt(variance) / mean;
}

/** Format a number as a percentage impact string */
function impactPct(patternVal: number, baselineVal: number): string {
  if (!baselineVal || baselineVal === 0) return "+0%";
  const pct = ((patternVal - baselineVal) / baselineVal) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

// ── Feature extraction from ad_diary + creatives ────────────────────────────

interface AdEntry {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number;
  frequency: number;
  synced_at: string;
  thumbnail_url: string | null;
  // Joined creative fields
  format?: string;
  hook_type?: string;
  has_hook?: boolean;
  text_density?: string;
  dominant_colors?: string[];
}

interface PatternGroup {
  key: string;
  label: string;
  feature_type: string;
  feature_value: string;
  ads: AdEntry[];
}

/**
 * Extract groupable features from ad entries.
 * Each ad can belong to multiple groups (by format, by campaign, etc.)
 */
function groupByFeatures(ads: AdEntry[]): PatternGroup[] {
  const groups: Record<string, PatternGroup> = {};

  function addToGroup(
    key: string,
    label: string,
    featureType: string,
    featureValue: string,
    ad: AdEntry,
  ) {
    if (!groups[key]) {
      groups[key] = { key, label, feature_type: featureType, feature_value: featureValue, ads: [] };
    }
    groups[key].ads.push(ad);
  }

  for (const ad of ads) {
    // Group by creative format
    if (ad.format && ad.format !== "unknown") {
      const k = `format:${ad.format}`;
      addToGroup(k, `${ad.format} ads`, "format", ad.format, ad);
    }

    // Group by hook presence
    if (ad.has_hook != null) {
      const hookLabel = ad.has_hook ? "with_hook" : "no_hook";
      addToGroup(`hook:${hookLabel}`, ad.has_hook ? "Ads with hook" : "Ads without hook", "hook_presence", hookLabel, ad);
    }

    // Group by hook type (if available)
    if (ad.hook_type && ad.hook_type !== "unknown") {
      addToGroup(`hook_type:${ad.hook_type}`, `Hook: ${ad.hook_type}`, "hook_type", ad.hook_type, ad);
    }

    // Group by text density
    if (ad.text_density && ad.text_density !== "unknown") {
      addToGroup(`text_density:${ad.text_density}`, `Text density: ${ad.text_density}`, "text_density", ad.text_density, ad);
    }

    // Group by campaign (detect campaign-level patterns)
    if (ad.campaign_name) {
      addToGroup(`campaign:${ad.campaign_name}`, `Campaign: ${ad.campaign_name}`, "campaign", ad.campaign_name, ad);
    }

    // Group by ad set (audience-level patterns)
    if (ad.adset_name) {
      addToGroup(`adset:${ad.adset_name}`, `Audience: ${ad.adset_name}`, "adset", ad.adset_name, ad);
    }

    // Group by status
    if (ad.status) {
      addToGroup(`status:${ad.status}`, `Status: ${ad.status}`, "status", ad.status, ad);
    }
  }

  return Object.values(groups);
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "detect", user_id, persona_id } = body;

    if (!user_id) throw new Error("Missing user_id");
    if (!persona_id) throw new Error("Missing persona_id");

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supaFetch = supaFetchFactory(supabaseUrl, supabaseKey);

    // ── ACTION: list — return cached patterns for sidebar ────────────────
    if (action === "list") {
      const res = await supaFetch(
        `learned_patterns?user_id=eq.${user_id}&persona_id=eq.${persona_id}&select=*` +
          `&order=is_winner.desc,confidence.desc&limit=10`,
      );
      const patterns = await res.json();

      return new Response(
        JSON.stringify({
          patterns: Array.isArray(patterns) ? patterns : [],
          persona_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: detect — full pattern detection pipeline ─────────────────
    if (action === "detect") {
      // 1. Fetch ad_diary entries for this persona (last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const diaryRes = await supaFetch(
        `ad_diary?user_id=eq.${user_id}&persona_id=eq.${persona_id}` +
          `&synced_at=gte.${ninetyDaysAgo}` +
          `&select=ad_id,ad_name,campaign_name,adset_name,status,spend,impressions,clicks,ctr,cpc,conversions,roas,frequency,synced_at,thumbnail_url` +
          `&order=synced_at.desc&limit=500`,
      );
      const diaryRaw = await diaryRes.json();
      if (!Array.isArray(diaryRaw) || diaryRaw.length === 0) {
        return new Response(
          JSON.stringify({
            patterns: [],
            message: "No ad diary data for this persona in the last 90 days",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Deduplicate by ad_id — keep most recent entry per ad
      const adMap = new Map<string, any>();
      for (const row of diaryRaw) {
        const existing = adMap.get(row.ad_id);
        if (!existing || new Date(row.synced_at) > new Date(existing.synced_at)) {
          adMap.set(row.ad_id, row);
        }
      }

      // 2. Join creative metadata where available
      const adIds = [...adMap.keys()].filter(Boolean);
      let creativeMap: Record<string, any> = {};
      if (adIds.length > 0) {
        // Fetch creatives by matching ad IDs through the ads table
        try {
          const creativesRes = await supaFetch(
            `creatives?select=id,format,has_hook,hook_timing_ms,text_density,dominant_colors` +
              `&id=in.(${adIds.slice(0, 100).map((id) => `"${id}"`).join(",")})` +
              `&limit=100`,
          );
          const creatives = await creativesRes.json();
          if (Array.isArray(creatives)) {
            for (const c of creatives) {
              creativeMap[c.id] = c;
            }
          }
        } catch {
          /* creative join is optional */
        }
      }

      // Merge diary + creative data
      const ads: AdEntry[] = [...adMap.values()].map((d) => {
        const creative = creativeMap[d.ad_id] || {};
        return {
          ...d,
          format: creative.format || undefined,
          hook_type: creative.hook_type || undefined,
          has_hook: creative.has_hook ?? undefined,
          text_density: creative.text_density || undefined,
          dominant_colors: creative.dominant_colors || undefined,
        };
      });

      // 3. Calculate account baseline (weighted avg across all ads)
      const baselineCtr = weightedAvg(ads, "ctr");
      const baselineCpc = weightedAvg(ads, "cpc");
      const baselineRoas = weightedAvg(ads, "roas");
      const baselineFrequency = weightedAvg(ads, "frequency");

      if (!baselineCtr || baselineCtr === 0) {
        return new Response(
          JSON.stringify({
            patterns: [],
            message: "Insufficient performance data for pattern detection",
            baseline: { ctr: baselineCtr, ads_count: ads.length },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 4. Group by features and analyze
      const groups = groupByFeatures(ads);

      interface DetectedPattern {
        pattern_key: string;
        label: string;
        feature_type: string;
        feature_value: string;
        variables: Record<string, string>;
        avg_ctr: number | null;
        avg_cpc: number | null;
        avg_roas: number | null;
        sample_size: number;
        confidence: number;
        is_winner: boolean;
        impact_ctr_pct: string;
        impact_roas_pct: string;
        consistency: number;
        insight_text: string | null;
        top_ads: { ad_id: string; ad_name: string; ctr: number; thumbnail_url: string | null }[];
      }

      const validPatterns: DetectedPattern[] = [];

      for (const group of groups) {
        // Minimum sample size: 3 ads
        if (group.ads.length < 3) continue;

        const groupCtr = weightedAvg(group.ads, "ctr");
        const groupCpc = weightedAvg(group.ads, "cpc");
        const groupRoas = weightedAvg(group.ads, "roas");

        if (!groupCtr) continue;

        // Consistency check — coefficient of variation < 1.5
        const cv = coefficientOfVariation(group.ads, "ctr");
        if (cv > 1.5) continue;

        // Impact: must be at least 10% different from baseline (positive OR negative)
        const ctrDelta = baselineCtr > 0 ? Math.abs((groupCtr - baselineCtr) / baselineCtr) : 0;
        if (ctrDelta < 0.10) continue;

        // Confidence scoring
        const sampleConf = Math.min(group.ads.length / 10, 1);
        const consistencyConf = Math.max(0, 1 - cv);
        const impactConf = Math.min(ctrDelta / 0.5, 1);
        const confidence = Math.round((sampleConf * 0.4 + consistencyConf * 0.3 + impactConf * 0.3) * 100) / 100;

        const isWinner = groupCtr > baselineCtr * 1.15 && confidence >= 0.25;

        // Top performing ads in this group
        const topAds = [...group.ads]
          .sort((a, b) => (b.ctr || 0) - (a.ctr || 0))
          .slice(0, 3)
          .map((a) => ({
            ad_id: a.ad_id,
            ad_name: a.ad_name,
            ctr: a.ctr,
            thumbnail_url: a.thumbnail_url,
          }));

        validPatterns.push({
          pattern_key: `persona:${persona_id}:${group.key}`,
          label: group.label,
          feature_type: group.feature_type,
          feature_value: group.feature_value,
          variables: {
            persona_id,
            feature_type: group.feature_type,
            feature_value: group.feature_value,
          },
          avg_ctr: groupCtr,
          avg_cpc: groupCpc,
          avg_roas: groupRoas,
          sample_size: group.ads.length,
          confidence,
          is_winner: isWinner,
          impact_ctr_pct: impactPct(groupCtr, baselineCtr),
          impact_roas_pct: groupRoas && baselineRoas ? impactPct(groupRoas, baselineRoas) : "",
          consistency: Math.round((1 - cv) * 100) / 100,
          insight_text: null,
          top_ads: topAds,
        });
      }

      // Sort: winners first, then by absolute impact
      validPatterns.sort((a, b) => {
        if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
        const impA = Math.abs(parseFloat(a.impact_ctr_pct) || 0);
        const impB = Math.abs(parseFloat(b.impact_ctr_pct) || 0);
        return impB - impA;
      });

      // Take top 10 patterns
      const topPatterns = validPatterns.slice(0, 10);

      // 5. Generate AI insights for top patterns
      if (ANTHROPIC_API_KEY && topPatterns.length > 0) {
        const prompt = `You are a senior Meta Ads performance analyst. Analyze these creative patterns detected from real ad account data.

Account baseline: CTR ${(baselineCtr * 100).toFixed(2)}%${baselineRoas ? `, ROAS ${baselineRoas.toFixed(1)}x` : ""}${baselineCpc ? `, CPC $${baselineCpc.toFixed(2)}` : ""} (${ads.length} ads analyzed)

Detected patterns:
${topPatterns.map((p, i) => `${i + 1}. ${p.label} — CTR ${p.avg_ctr ? (p.avg_ctr * 100).toFixed(2) : "?"}% (${p.impact_ctr_pct} vs baseline), ${p.sample_size} ads, confidence ${(p.confidence * 100).toFixed(0)}%${p.is_winner ? " [WINNER]" : ""}`).join("\n")}

For each pattern, write a specific, actionable 1-sentence insight explaining WHY this pattern performs the way it does and what the advertiser should DO about it. Reference the actual numbers. Be direct, no fluff.

Return JSON array: [{"index": 0, "insight": "..."}, ...]`;

        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const textBlock = aiData.content?.find((b: any) => b.type === "text");
            const raw = textBlock?.text || "";
            try {
              const jsonMatch = raw.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const insights: { index: number; insight: string }[] = JSON.parse(jsonMatch[0]);
                for (const ins of insights) {
                  if (topPatterns[ins.index]) {
                    topPatterns[ins.index].insight_text = ins.insight;
                  }
                }
              }
            } catch {
              /* AI parsing optional */
            }
          }
        } catch {
          /* AI is optional — patterns still work without insights */
        }
      }

      // 6. Upsert patterns into learned_patterns
      for (const p of topPatterns) {
        const row = {
          user_id,
          persona_id,
          pattern_key: p.pattern_key,
          variables: p.variables,
          avg_ctr: p.avg_ctr,
          avg_cpc: p.avg_cpc,
          avg_roas: p.avg_roas,
          avg_thumb_stop: null,
          sample_size: p.sample_size,
          confidence: p.confidence,
          is_winner: p.is_winner,
          insight_text: p.insight_text,
          last_updated: new Date().toISOString(),
        };

        // Delete existing pattern with same key for this user
        await supaFetch(
          `learned_patterns?user_id=eq.${user_id}&pattern_key=eq.${encodeURIComponent(p.pattern_key)}`,
          { method: "DELETE" },
        );
        // Insert fresh
        await supaFetch("learned_patterns", {
          method: "POST",
          body: JSON.stringify(row),
        });
      }

      return new Response(
        JSON.stringify({
          patterns: topPatterns,
          baseline: {
            ctr: baselineCtr,
            cpc: baselineCpc,
            roas: baselineRoas,
            ads_count: ads.length,
          },
          total_groups: groups.length,
          valid_patterns: validPatterns.length,
          persona_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use 'detect' or 'list'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("detect-patterns error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
