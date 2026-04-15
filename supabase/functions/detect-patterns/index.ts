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
      addToGroup(k, `Formato ${ad.format}`, "format", ad.format, ad);
    }

    // Group by hook presence
    if (ad.has_hook != null) {
      const hookLabel = ad.has_hook ? "with_hook" : "no_hook";
      addToGroup(`hook:${hookLabel}`, ad.has_hook ? "Anúncios com hook" : "Anúncios sem hook", "hook_presence", hookLabel, ad);
    }

    // Group by hook type (if available)
    if (ad.hook_type && ad.hook_type !== "unknown") {
      addToGroup(`hook_type:${ad.hook_type}`, `Hook: ${ad.hook_type}`, "hook_type", ad.hook_type, ad);
    }

    // Group by text density
    if (ad.text_density && ad.text_density !== "unknown") {
      addToGroup(`text_density:${ad.text_density}`, `Densidade de texto: ${ad.text_density}`, "text_density", ad.text_density, ad);
    }

    // Group by campaign (detect campaign-level patterns)
    if (ad.campaign_name) {
      addToGroup(`campaign:${ad.campaign_name}`, `Campanha: ${ad.campaign_name}`, "campaign", ad.campaign_name, ad);
    }

    // Group by ad set (audience-level patterns)
    if (ad.adset_name) {
      addToGroup(`adset:${ad.adset_name}`, `Público: ${ad.adset_name}`, "adset", ad.adset_name, ad);
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
      const patternList = Array.isArray(patterns) ? patterns : [];

      // Calculate alignment score for sidebar
      let alignmentScore = 0;
      let alignmentLabel = "Sem dados";
      const winners = patternList.filter((p: any) => p.is_winner);
      if (winners.length > 0 && patternList.length > 0) {
        const avgConf = patternList.reduce((s: number, p: any) => s + (p.confidence || 0), 0) / patternList.length;
        alignmentScore = Math.round(avgConf * 100);
        if (alignmentScore >= 70) alignmentLabel = "Excelente";
        else if (alignmentScore >= 50) alignmentLabel = "Bom";
        else if (alignmentScore >= 30) alignmentLabel = "Moderado";
        else alignmentLabel = "Em desenvolvimento";
      }

      return new Response(
        JSON.stringify({
          patterns: patternList,
          persona_id,
          alignment: { score: alignmentScore, label: alignmentLabel },
          winners_count: winners.length,
          total_count: patternList.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: track_result — compare actual vs predicted after action ──
    if (action === "track_result") {
      const { pattern_key, expected_impact_pct, actual_ctr, period_days = 7 } = body;
      if (!pattern_key) throw new Error("Missing pattern_key for track_result");

      // Fetch the pattern
      const patRes = await supaFetch(
        `learned_patterns?user_id=eq.${user_id}&pattern_key=eq.${encodeURIComponent(pattern_key)}&select=*&limit=1`,
      );
      const pats = await patRes.json();
      const pattern = Array.isArray(pats) ? pats[0] : null;

      if (!pattern) {
        return new Response(
          JSON.stringify({ error: "Pattern not found", pattern_key }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const expectedCtr = pattern.avg_ctr || 0;
      const actualCtrNum = Number(actual_ctr) || 0;
      const deviation = expectedCtr > 0
        ? Math.round(((actualCtrNum - expectedCtr) / expectedCtr) * 100)
        : 0;

      let status: string;
      if (Math.abs(deviation) <= 15) status = "within_expected";
      else if (deviation > 15) status = "above_expected";
      else status = "below_expected";

      // Result message
      const resultMessage = status === "within_expected"
        ? `Resultado dentro do esperado (desvio: ${deviation > 0 ? "+" : ""}${deviation}%)`
        : status === "above_expected"
        ? `Resultado acima do esperado (+${deviation}%) — padrão fortalecido`
        : `Resultado abaixo do esperado (${deviation}%) — padrão enfraquecido`;

      // Strengthen or weaken the pattern based on result
      const confAdjust = status === "above_expected" ? 0.05
        : status === "below_expected" ? -0.08
        : 0.02; // within range slightly strengthens

      const newConfidence = Math.max(0.1, Math.min(1.0, (pattern.confidence || 0.5) + confAdjust));

      await supaFetch(
        `learned_patterns?user_id=eq.${user_id}&pattern_key=eq.${encodeURIComponent(pattern_key)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            confidence: newConfidence,
            last_updated: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" },
        },
      );

      return new Response(
        JSON.stringify({
          pattern_key,
          expected_ctr: expectedCtr,
          actual_ctr: actualCtrNum,
          deviation_pct: deviation,
          status,
          result_message: resultMessage,
          new_confidence: newConfidence,
          confidence_change: confAdjust > 0 ? `+${(confAdjust * 100).toFixed(0)}%` : `${(confAdjust * 100).toFixed(0)}%`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── ACTION: evolve — decay old patterns, strengthen validated ones ──
    if (action === "evolve") {
      const res = await supaFetch(
        `learned_patterns?user_id=eq.${user_id}&persona_id=eq.${persona_id}&select=*`,
      );
      const allPatterns = await res.json();
      if (!Array.isArray(allPatterns) || allPatterns.length === 0) {
        return new Response(
          JSON.stringify({ evolved: 0, message: "No patterns to evolve" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let evolved = 0;
      const now = Date.now();
      for (const p of allPatterns) {
        const lastUpdated = new Date(p.last_updated || p.created_at || now).getTime();
        const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);

        // Time decay: patterns lose confidence over time if not revalidated
        // 0.5% per day after 14 days of no update
        let newConf = p.confidence || 0.5;
        if (daysSinceUpdate > 14) {
          const decayDays = daysSinceUpdate - 14;
          newConf = Math.max(0.1, newConf - (decayDays * 0.005));
        }

        // Weak patterns (conf < 0.2) get removed
        if (newConf < 0.15) {
          await supaFetch(
            `learned_patterns?id=eq.${p.id}`,
            { method: "DELETE" },
          );
          evolved++;
          continue;
        }

        if (Math.abs(newConf - (p.confidence || 0)) > 0.01) {
          await supaFetch(
            `learned_patterns?id=eq.${p.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({ confidence: Math.round(newConf * 100) / 100 }),
              headers: { Prefer: "return=minimal" },
            },
          );
          evolved++;
        }
      }

      return new Response(
        JSON.stringify({ evolved, total: allPatterns.length, message: `${evolved} patterns evolved` }),
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

      // 2. Join creative metadata where available (batch in chunks of 80 for URL length safety)
      const adIds = [...adMap.keys()].filter(Boolean);
      let creativeMap: Record<string, any> = {};
      if (adIds.length > 0) {
        const CHUNK_SIZE = 80;
        try {
          for (let i = 0; i < adIds.length; i += CHUNK_SIZE) {
            const chunk = adIds.slice(i, i + CHUNK_SIZE);
            const creativesRes = await supaFetch(
              `creatives?select=id,format,has_hook,hook_timing_ms,text_density,dominant_colors` +
                `&id=in.(${chunk.map((id) => `"${id}"`).join(",")})` +
                `&limit=${CHUNK_SIZE}`,
            );
            const creatives = await creativesRes.json();
            if (Array.isArray(creatives)) {
              for (const c of creatives) {
                creativeMap[c.id] = c;
              }
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

      // ── GAP PATTERNS — what's missing ──
      // Check if common high-performing formats/features are absent
      const allFormats = new Set(ads.filter(a => a.format).map(a => a.format!));
      const commonHighPerformers = ["video", "carousel", "ugc"];
      for (const fmt of commonHighPerformers) {
        if (!allFormats.has(fmt)) {
          // This format is not being tested at all — it's a gap
          const existingWinner = validPatterns.find(p => p.is_winner && p.feature_type === "format");
          if (existingWinner) {
            validPatterns.push({
              pattern_key: `persona:${persona_id}:gap:${fmt}`,
              label: `Gap: formato "${fmt}" não testado`,
              feature_type: "gap",
              feature_value: fmt,
              variables: { persona_id, feature_type: "gap", feature_value: fmt },
              avg_ctr: null,
              avg_cpc: null,
              avg_roas: null,
              sample_size: 0,
              confidence: 0.2,
              is_winner: false,
              impact_ctr_pct: "?",
              impact_roas_pct: "",
              consistency: 0,
              insight_text: `Formato "${fmt}" nunca foi testado nesta conta. Contas similares têm bom desempenho com este formato.`,
              top_ads: [],
            });
          }
        }
      }

      // ── DEVIATION DETECTION — ads performing far from their pattern group ──
      for (const group of groups) {
        if (group.ads.length < 3) continue;
        const groupCtr = weightedAvg(group.ads, "ctr");
        if (!groupCtr) continue;
        // Find outliers: ads deviating > 50% from their group average
        for (const ad of group.ads) {
          if (!ad.ctr || ad.impressions < 500) continue;
          const deviation = Math.abs((ad.ctr - groupCtr) / groupCtr);
          if (deviation > 0.5) {
            const isOver = ad.ctr > groupCtr;
            validPatterns.push({
              pattern_key: `persona:${persona_id}:deviation:${ad.ad_id}`,
              label: `Desvio: "${ad.ad_name}" ${isOver ? "acima" : "abaixo"} do grupo`,
              feature_type: "deviation",
              feature_value: ad.ad_id,
              variables: { persona_id, feature_type: "deviation", feature_value: ad.ad_id, group_key: group.key },
              avg_ctr: ad.ctr,
              avg_cpc: ad.cpc || null,
              avg_roas: ad.roas || null,
              sample_size: 1,
              confidence: 0.3,
              is_winner: isOver,
              impact_ctr_pct: impactPct(ad.ctr, groupCtr),
              impact_roas_pct: "",
              consistency: 0,
              insight_text: `"${ad.ad_name}" desvia ${Math.round(deviation * 100)}% do grupo "${group.label}". ${isOver ? "Investigar o que o diferencia para replicar." : "Considerar pausar ou ajustar."}`,
              top_ads: [{ ad_id: ad.ad_id, ad_name: ad.ad_name, ctr: ad.ctr, thumbnail_url: ad.thumbnail_url }],
            });
          }
        }
      }

      // ── COMBINATION PATTERNS — e.g. format + hook type ──
      const combos: Record<string, AdEntry[]> = {};
      for (const ad of ads) {
        if (ad.format && ad.has_hook != null) {
          const key = `${ad.format}+${ad.has_hook ? "hook" : "no_hook"}`;
          if (!combos[key]) combos[key] = [];
          combos[key].push(ad);
        }
      }
      for (const [comboKey, comboAds] of Object.entries(combos)) {
        if (comboAds.length < 3) continue;
        const comboCtr = weightedAvg(comboAds, "ctr");
        if (!comboCtr || !baselineCtr) continue;
        const cv = coefficientOfVariation(comboAds, "ctr");
        if (cv > 1.5) continue;
        const delta = Math.abs((comboCtr - baselineCtr) / baselineCtr);
        if (delta < 0.15) continue;

        const sampleConf = Math.min(comboAds.length / 10, 1);
        const consistencyConf = Math.max(0, 1 - cv);
        const impactConf = Math.min(delta / 0.5, 1);
        const confidence = Math.round((sampleConf * 0.4 + consistencyConf * 0.3 + impactConf * 0.3) * 100) / 100;
        const isWinner = comboCtr > baselineCtr * 1.15 && confidence >= 0.25;

        const comboLabel = comboKey.replace("+", " + ").replace("hook", "com hook").replace("no_hook", "sem hook");
        validPatterns.push({
          pattern_key: `persona:${persona_id}:combo:${comboKey}`,
          label: `Combinação: ${comboLabel}`,
          feature_type: "combination",
          feature_value: comboKey,
          variables: { persona_id, feature_type: "combination", feature_value: comboKey },
          avg_ctr: comboCtr,
          avg_cpc: weightedAvg(comboAds, "cpc"),
          avg_roas: weightedAvg(comboAds, "roas"),
          sample_size: comboAds.length,
          confidence,
          is_winner: isWinner,
          impact_ctr_pct: impactPct(comboCtr, baselineCtr),
          impact_roas_pct: "",
          consistency: Math.round((1 - cv) * 100) / 100,
          insight_text: null,
          top_ads: [...comboAds].sort((a, b) => (b.ctr || 0) - (a.ctr || 0)).slice(0, 3)
            .map(a => ({ ad_id: a.ad_id, ad_name: a.ad_name, ctr: a.ctr, thumbnail_url: a.thumbnail_url })),
        });
      }

      // Sort: winners first, then by absolute impact
      validPatterns.sort((a, b) => {
        if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
        const impA = Math.abs(parseFloat(a.impact_ctr_pct) || 0);
        const impB = Math.abs(parseFloat(b.impact_ctr_pct) || 0);
        return impB - impA;
      });

      // Take top 15 patterns (increased from 10 to include gaps/deviations/combos)
      const topPatterns = validPatterns.slice(0, 15);

      // 5. Generate AI insights for top patterns
      if (ANTHROPIC_API_KEY && topPatterns.length > 0) {
        // Build rich context string per pattern for the AI
        const patternDetails = topPatterns.map((p, i) => {
          const lines: string[] = [];
          lines.push(`${i + 1}. Tipo: ${p.feature_type} | Valor: ${p.feature_value}`);
          lines.push(`   Label: ${p.label}`);
          lines.push(`   CTR: ${p.avg_ctr ? (p.avg_ctr * 100).toFixed(2) : "?"}% (${p.impact_ctr_pct} vs baseline)`);
          if (p.avg_roas != null && p.avg_roas > 0) lines.push(`   ROAS: ${p.avg_roas.toFixed(2)}x`);
          if (p.avg_cpc != null && p.avg_cpc > 0) lines.push(`   CPC: R$${p.avg_cpc.toFixed(2)}`);
          lines.push(`   Amostra: ${p.sample_size} anúncios | Confiança: ${(p.confidence * 100).toFixed(0)}% | Consistência: ${Math.round(p.consistency * 100)}%`);
          if (p.is_winner) lines.push(`   STATUS: VENCEDOR`);
          if (p.top_ads && p.top_ads.length > 0) {
            const topAdsStr = p.top_ads.map(a =>
              `"${a.ad_name || a.ad_id}" (CTR ${(a.ctr * 100).toFixed(2)}%)`
            ).join(", ");
            lines.push(`   Top anúncios: ${topAdsStr}`);
          }
          if (p.impact_roas_pct) lines.push(`   Impacto ROAS: ${p.impact_roas_pct}`);
          return lines.join("\n");
        }).join("\n\n");

        const prompt = `Você é um analista sênior de Meta Ads. Analise estes padrões criativos detectados de dados REAIS de uma conta de anúncios.

Baseline da conta: CTR ${(baselineCtr * 100).toFixed(2)}%${baselineRoas ? `, ROAS ${baselineRoas.toFixed(1)}x` : ""}${baselineCpc ? `, CPC R$${baselineCpc.toFixed(2)}` : ""} (${ads.length} anúncios analisados)

${patternDetails}

Para CADA padrão, escreva EM PORTUGUÊS DO BRASIL:
- "title": Um título curto (máx 60 chars) que EXPLICA o padrão, NÃO apenas repete a métrica. Diga O QUE funciona e POR QUÊ. Ex: "Hooks de urgência geram 2x mais cliques nos primeiros 3s", "Vídeo curto com pouco texto domina esta conta", "Carrossel + hook direto: combo vencedor com CTR 4.2%"
- "insight": 1-2 frases explicando POR QUE este padrão funciona na prática e O QUE FAZER para replicar ou melhorar. Use os nomes dos top anúncios quando relevante. Seja específico e acionável.

REGRAS:
- NUNCA escreva títulos genéricos como "CTR acima da média" ou "Performance superior"
- O título deve explicar a CAUSA, não o efeito
- Referencie dados reais (nomes de anúncios, CTR específico, formato)
- Para padrões de gap: sugira o que testar
- Para desvios: explique o que diferencia esse anúncio

Retorne um array JSON: [{"index": 0, "title": "...", "insight": "..."}, ...]`;

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
              max_tokens: 2048,
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
                const insights: { index: number; title?: string; insight: string }[] = JSON.parse(jsonMatch[0]);
                for (const ins of insights) {
                  if (topPatterns[ins.index]) {
                    // Store title + insight as structured string: "TITLE || INSIGHT"
                    // Frontend can split on " || " to use title as label and insight as explanation
                    const title = ins.title || "";
                    const insight = ins.insight || "";
                    topPatterns[ins.index].insight_text = title && insight
                      ? `${title} || ${insight}`
                      : insight || title;
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
