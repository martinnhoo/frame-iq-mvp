// trend-watcher v2 — deploy 202603270151
// Sistema global de inteligência de trends — acima de todos os clientes
//
// MODOS:
//   { mode: "auto" }           → busca top 10 Google Trends BR + processa
//   { mode: "manual", term }   → pesquisa um termo específico (usuário pediu)
//   { mode: "status" }         → retorna trends ativas hoje com scores
//
// APRENDIZADO:
//   - Guarda volume diário por trend
//   - Calcula baseline semanal (o que é "normal" no BR)
//   - Score de relevância = volume vs baseline + dias consecutivos + retornos
//   - Trends que voltam ao ranking ganham boost de confiança

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC    = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const BRAVE_KEY    = Deno.env.get("BRAVE_SEARCH_API_KEY") ?? "";

// Hard filters
const BLOCKED = [
  "lula","bolsonaro","dilma","temer","lira","pacheco","eleicao","governo","senado",
  "camara","deputado","presidente","ministro","partido","pec","congresso","stf",
  "supremo","anistia","impeachment","reeleicao","golpe",
  "jesus","deus","biblia","evangelico","catolico","candomble","umbanda","missa","pastor",
  "morte","assassinato","tiro","policia","crime","preso","trafico","faccao","milicia",
  "sexo","porno","nude","nudez","escort","putaria",
];

function isBlocked(text: string): boolean {
  const l = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return BLOCKED.some(k => l.includes(k));
}

function toKey(term: string): string {
  return term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/, "").slice(0, 60);
}

async function fetchGoogleTrends(geo = "BR") {
  // Try multiple approaches — Google Trends RSS sometimes blocks server-side
  const urls = [
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`,
    `https://trends.google.com/trends/trendingsearches/realtime/rss?geo=${geo}&hl=pt-BR&cat=all`,
  ];
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
  ];
  
  for (const url of urls) {
    for (const agent of agents) {
      try {
        const r = await fetch(url, {
          headers: { 
            "User-Agent": agent,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "pt-BR,pt;q=0.9",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) continue;
        const xml = await r.text();
        if (!xml.includes("<item>") && !xml.includes("<title>")) continue;
        // Parse this response
        const items = parseGoogleTrendsXML(xml);
        if (items.length > 0) return items;
      } catch { continue; }
    }
  }
  
  // Final fallback: use Brave Search to discover trending terms
  return await discoverTrendsViaBrave(geo);
}

function parseGoogleTrendsXML(xml: string) {
  const items = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
    const itemXml = itemMatches[i][1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) || itemXml.match(/<title>([^<]+)<\/title>/);
    const trafficMatch = itemXml.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/);
    if (!titleMatch) continue;
    const term = titleMatch[1].trim();
    if (term.length < 2 || isBlocked(term)) continue;
    let volume = 50;
    if (trafficMatch) {
      const t = trafficMatch[1].replace(/[^0-9KM+]/g, "");
      if (t.includes("M")) volume = 95;
      else if (t.includes("K")) {
        const n = parseInt(t);
        if (n >= 500) volume = 90;
        else if (n >= 200) volume = 80;
        else if (n >= 100) volume = 70;
        else if (n >= 50) volume = 60;
        else if (n >= 20) volume = 50;
        else if (n >= 10) volume = 40;
        else volume = 30;
      }
    }
    items.push({ term, volume, position: i + 1 });
  }
  return items;
}

async function discoverTrendsViaBrave(geo = "BR") {
  if (!BRAVE_KEY) return [];
  console.log("Google Trends RSS unavailable — using Brave Search fallback");
  try {
    const queries = [
      "trending brasil hoje viral 2026",
      "meme viral brasil semana",
    ];
    const terms = new Set<string>();
    for (const q of queries) {
      const results = await braveSearch(q, 8);
      // Extract potential trend terms from titles
      for (const r of results) {
        const title = r.split(":")[0].trim();
        if (title.length > 2 && title.length < 50 && !isBlocked(title)) {
          terms.add(title);
        }
      }
    }
    return [...terms].slice(0, 10).map((term, i) => ({ term, volume: 60 - i * 3, position: i + 1 }));
  } catch { return []; }
}

async function fetchGoogleTrends_UNUSED(geo = "BR") {
  try {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdBriefTrendWatcher/2.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
      const itemXml = itemMatches[i][1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/);
      const trafficMatch = itemXml.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/);
      if (!titleMatch) continue;
      const term = titleMatch[1].trim();
      if (term.length < 2 || isBlocked(term)) continue;
      let volume = 50;
      if (trafficMatch) {
        const t = trafficMatch[1].replace(/[^0-9KM+]/g, "");
        if (t.includes("M")) volume = 95;
        else if (t.includes("K")) {
          const n = parseInt(t);
          if (n >= 500) volume = 90;
          else if (n >= 200) volume = 80;
          else if (n >= 100) volume = 70;
          else if (n >= 50) volume = 60;
          else if (n >= 20) volume = 50;
          else if (n >= 10) volume = 40;
          else volume = 30;
        }
      }
      items.push({ term, volume, position: i + 1 });
    }
    return items;
  } catch(e) {
    console.error("Google Trends error:", e);
    return [];
  }
}

async function braveSearch(q: string, count = 5): Promise<string[]> {
  if (!BRAVE_KEY) return [];
  try {
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&country=br`,
      { headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.web?.results || [])
      .map((x: any) => `${x.title}: ${(x.description || "").slice(0, 100)}`)
      .filter((s: string) => !isBlocked(s))
      .slice(0, count);
  } catch { return []; }
}

async function redditSearch(term: string): Promise<string[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=hot&limit=5&t=week`;
    const r = await fetch(url, { headers: { "User-Agent": "AdBriefTrendWatcher/2.0" }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const d = await r.json();
    return ((d.data?.children || []))
      .map((c: any) => (c.data?.title || "").slice(0, 100))
      .filter((t: string) => t.length > 5 && !isBlocked(t))
      .slice(0, 4);
  } catch { return []; }
}

const NITTER = ["https://nitter.privacydev.net", "https://nitter.cz", "https://lightbrd.com"];

async function xSearch(term) {
  for (const instance of NITTER) {
    try {
      const r = await fetch(`${instance}/search?f=tweets&q=${encodeURIComponent(term)}&lang=pt`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AdBriefTrendWatcher/2.0)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      const tweets = [...html.matchAll(/class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
        .filter(t => t.length > 10 && t.length < 200 && !isBlocked(t))
        .slice(0, 5);
      if (tweets.length > 0) return tweets;
    } catch { continue; }
  }
  return [];
}

async function analyzeTrend(term, sources) {
  if (!ANTHROPIC) return { angle: term, ad_angle: "", niches: [], risk_score: 3, category: "geral" };
  const srcText = sources.slice(0, 10).join("\n").slice(0, 1000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Trend brasileira: "${term}"\n\nFontes:\n${srcText || "(sem fontes)"}\n\nJSON sem markdown:\n{\n  "angle": "o que é em 1 frase (máx 80 chars)",\n  "ad_angle": "gancho criativo para anúncio (máx 100 chars)",\n  "niches": ["nichos de marketing relevantes"],\n  "category": "meme|entretenimento|esporte|musica|serie|viral|noticias|comportamento",\n  "risk_score": 0\n}\n\nREGRAS: risk_score 0-10. Política/violência/religião/adulto = 8-10. Entretenimento/humor = 0-3. Máx 4 niches.`
        }]
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = (d.content?.[0]?.text || "").replace(/\`\`\`json?|\`\`\`/g, "").trim();
    return JSON.parse(text);
  } catch { return null; }
}

function computeRelevanceScore(trend, baseline) {
  let score = 0;
  const p75 = baseline?.p75 || 60;
  const p90 = baseline?.p90 || 80;
  if (trend.last_volume >= p90) score += 40;
  else if (trend.last_volume >= p75) score += 25;
  else if (trend.last_volume >= 50) score += 15;
  else score += 5;
  if (trend.days_active >= 5) score += 30;
  else if (trend.days_active >= 3) score += 20;
  else if (trend.days_active >= 2) score += 12;
  else score += 5;
  if (trend.appearances >= 4) score += 20;
  else if (trend.appearances >= 2) score += 12;
  if (trend.peak_volume >= 90) score += 10;
  else if (trend.peak_volume >= 70) score += 6;
  return Math.min(score, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json().catch(() => ({}));
    const { mode = "auto", term, geo = "BR" } = body;

    // STATUS
    if (mode === "status") {
      const { data: trends } = await sb.from("trend_intelligence")
        .select("term,angle,ad_angle,niches,category,days_active,appearances,last_volume,peak_volume,risk_score,is_active,last_seen_at")
        .eq("is_active", true).eq("is_blocked", false).lt("risk_score", 7)
        .order("last_volume", { ascending: false }).limit(10);
      const { data: baseline } = await sb.from("trend_platform_baseline")
        .select("p75_volume,p90_volume").eq("geo", geo)
        .order("week_start", { ascending: false }).limit(1).maybeSingle();
      const p75 = baseline?.p75_volume || 60;
      const p90 = baseline?.p90_volume || 80;
      const scored = (trends || []).map(t => ({
        ...t, relevance_score: computeRelevanceScore(t, { p75, p90 })
      })).sort((a, b) => b.relevance_score - a.relevance_score);
      return new Response(JSON.stringify({ ok: true, trends: scored, baseline: { p75, p90 } }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // MANUAL
    if (mode === "manual" && term) {
      if (isBlocked(term)) return new Response(JSON.stringify({ ok: false, blocked: true }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
      const key = toKey(term);
      const { data: cached } = await sb.from("trend_intelligence").select("*").eq("term_key", key).maybeSingle();
      if (cached) {
        const ageH = (Date.now() - new Date(cached.updated_at).getTime()) / 3600000;
        if (ageH < 4) return new Response(JSON.stringify({ ok: true, cached: true, trend: cached }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      const [brave, reddit, x] = await Promise.all([braveSearch(`${term} brasil meme 2026`, 5), redditSearch(term), xSearch(term)]);
      const sources = [...brave, ...reddit, ...x].filter(s => !isBlocked(s));
      const analysis = await analyzeTrend(term, sources);
      if (!analysis || analysis.risk_score >= 7) return new Response(JSON.stringify({ ok: false, blocked: true }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
      const now = new Date().toISOString();
      if (cached) {
        await sb.from("trend_intelligence").update({
          angle: analysis.angle, ad_angle: analysis.ad_angle, niches: analysis.niches,
          category: analysis.category, risk_score: analysis.risk_score,
          appearances: cached.appearances + 1, last_seen_at: now, is_active: true, updated_at: now,
        }).eq("term_key", key);
      } else {
        await sb.from("trend_intelligence").insert({
          term, term_key: key, angle: analysis.angle, ad_angle: analysis.ad_angle,
          niches: analysis.niches, category: analysis.category, risk_score: analysis.risk_score,
          first_seen_at: now, last_seen_at: now, days_active: 1, appearances: 1,
          peak_volume: 50, last_volume: 50, avg_volume: 50, is_active: true,
        });
      }
      const { data: result } = await sb.from("trend_intelligence").select("*").eq("term_key", key).maybeSingle();
      return new Response(JSON.stringify({ ok: true, trend: result }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // AUTO — top 10 Google Trends
    const googleTrends = await fetchGoogleTrends(geo);
    if (!googleTrends.length) return new Response(JSON.stringify({ ok: false, error: "no_trends_fetched" }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

    const today = new Date().toISOString().slice(0, 10);
    const results = [];

    // Mark old as inactive
    await sb.from("trend_intelligence").update({ is_active: false })
      .eq("is_active", true)
      .lt("last_seen_at", new Date(Date.now() - 20 * 3600000).toISOString());

    for (const { term, volume, position } of googleTrends) {
      if (isBlocked(term)) continue;
      const key = toKey(term);
      const now = new Date().toISOString();
      const { data: existing } = await sb.from("trend_intelligence").select("*").eq("term_key", key).maybeSingle();
      const { data: todayVol } = await sb.from("trend_daily_volumes").select("id").eq("term_key", key).eq("date", today).maybeSingle();

      // Upsert daily volume
      if (!todayVol) await sb.from("trend_daily_volumes").insert({ term_key: key, date: today, volume, position });
      else await sb.from("trend_daily_volumes").update({ volume, position }).eq("term_key", key).eq("date", today);

      if (existing) {
        const isReturn = !existing.is_active;
        const newDays = existing.days_active + (todayVol ? 0 : 1);
        const newPeak = Math.max(existing.peak_volume, volume);
        const newAvg = Math.round((existing.avg_volume * existing.days_active + volume) / (newDays || 1));
        await sb.from("trend_intelligence").update({
          last_seen_at: now, last_volume: volume, peak_volume: newPeak, avg_volume: newAvg,
          days_active: newDays, appearances: isReturn ? existing.appearances + 1 : existing.appearances,
          is_active: true, updated_at: now,
        }).eq("term_key", key);
        results.push({ term, key, status: isReturn ? "returned" : "updated", volume, days_active: newDays });
      } else {
        const [brave, reddit, x] = await Promise.all([braveSearch(`${term} brasil 2026`, 4), redditSearch(term), xSearch(term)]);
        const sources = [...brave, ...reddit, ...x].filter(s => !isBlocked(s));
        const analysis = await analyzeTrend(term, sources);
        if (!analysis || analysis.risk_score >= 7) {
          try { await sb.from("trend_intelligence").insert({
            term, term_key: key, is_blocked: true, risk_score: analysis?.risk_score || 8,
            angle: "", ad_angle: "", niches: [], category: "bloqueado",
            peak_volume: volume, last_volume: volume, avg_volume: volume,
          }); } catch {}
          results.push({ term, key, status: "blocked" });
          continue;
        }
        await sb.from("trend_intelligence").insert({
          term, term_key: key, angle: analysis.angle, ad_angle: analysis.ad_angle,
          niches: analysis.niches, category: analysis.category, risk_score: analysis.risk_score,
          first_seen_at: now, last_seen_at: now, days_active: 1, appearances: 1,
          peak_volume: volume, last_volume: volume, avg_volume: volume, is_active: true,
        });
        results.push({ term, key, status: "new", volume, angle: analysis.angle });
      }
    }

    // Update weekly baseline
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: recentVols } = await sb.from("trend_daily_volumes").select("volume").gte("date", sevenDaysAgo);
    if (recentVols && recentVols.length >= 5) {
      const vols = recentVols.map(v => v.volume).sort((a, b) => a - b);
      const p75 = vols[Math.floor(vols.length * 0.75)];
      const p90 = vols[Math.floor(vols.length * 0.90)];
      const avg = Math.round(vols.reduce((a, b) => a + b, 0) / vols.length);
      const d = new Date(); const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff)).toISOString().slice(0, 10);
      await sb.from("trend_platform_baseline").upsert({ geo, week_start: weekStart, avg_volume: avg, p75_volume: p75, p90_volume: p90 }, { onConflict: "geo,week_start" });
    }

    return new Response(JSON.stringify({ ok: true, mode: "auto", geo, processed: results.length, results }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch(e) {
    console.error("trend-watcher error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
