import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface SyncRequest {
  account_id: string;
  sync_type: "fast" | "full" | "deep" | "on_demand";
}

interface MetaTokenResponse {
  access_token: string;
}

interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: number;
  targeting?: Record<string, unknown>;
  optimization_goal?: string;
}

interface MetaCreative {
  id: string;
  thumbnail_url?: string;
  body?: string;
  title?: string;
  call_to_action_type?: string;
}

interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative?: MetaCreative;
}

interface MetaInsights {
  spend: string;
  impressions: string;
  clicks: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  date_start: string;
}

interface PaginatedResponse {
  data: unknown[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// Retry with exponential backoff for rate limits
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    // Check for rate limit (code 17 in Meta API)
    if (response.status === 429 || response.status === 400) {
      const body = await response.clone().json().catch(() => ({}));
      if (
        body.error?.code === 17 ||
        response.status === 429
      ) {
        const backoffMs = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.log(
          `Rate limit hit, retrying after ${backoffMs}ms (attempt ${i + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }

    return response;
  }

  throw new Error(`Failed after ${maxRetries} retries due to rate limiting`);
}

// Get Meta access token + meta_account_id for account
async function getAccountCredentials(accountId: string): Promise<{ token: string; metaAccountId: string }> {
  const { data, error } = await supabase
    .from("ad_accounts")
    .select("access_token_encrypted, meta_account_id, user_id")
    .eq("id", accountId)
    .single();

  if (error) {
    throw new Error(`DB error fetching account ${accountId}: ${error.message} (code: ${error.code})`);
  }
  if (!data) {
    throw new Error(`No ad_account found with id ${accountId}`);
  }
  if (!data.meta_account_id) {
    throw new Error(`ad_account ${accountId} has no meta_account_id`);
  }

  let token = data.access_token_encrypted;

  // Fallback: if token is null, fetch from platform_connections
  if (!token && data.user_id) {
    console.log(`[getAccountCredentials] token null, falling back to platform_connections for meta_account_id=${data.meta_account_id}`);
    const { data: conns } = await supabase
      .from("platform_connections")
      .select("access_token, ad_accounts")
      .eq("user_id", data.user_id)
      .eq("platform", "meta")
      .eq("status", "active");

    if (conns && conns.length > 0) {
      // Find the connection that has this meta_account_id in its ad_accounts
      for (const conn of conns) {
        const accounts = (conn.ad_accounts || []) as any[];
        const hasAccount = accounts.some((a: any) => a.id === data.meta_account_id || a.id === `act_${data.meta_account_id}`);
        if (hasAccount && conn.access_token) {
          token = conn.access_token;
          // Backfill the ad_accounts row so future calls work directly
          await supabase
            .from("ad_accounts")
            .update({ access_token_encrypted: conn.access_token })
            .eq("id", accountId);
          console.log(`[getAccountCredentials] backfilled token from platform_connections`);
          break;
        }
      }
      // If no specific match, use first connection's token
      if (!token && conns[0]?.access_token) {
        token = conns[0].access_token;
        await supabase
          .from("ad_accounts")
          .update({ access_token_encrypted: conns[0].access_token })
          .eq("id", accountId);
        console.log(`[getAccountCredentials] backfilled token from first active connection`);
      }
    }
  }

  if (!token) {
    throw new Error(`Failed to fetch credentials for account ${accountId}`);
  }

  console.log(`[getAccountCredentials] account=${accountId}, meta_id=${data.meta_account_id}, token_length=${token.length}`);

  return {
    token,
    metaAccountId: data.meta_account_id,
  };
}

// Convert dollar string to centavos
function dollarsToCentavos(dollarsStr: string | number): number {
  const dollars = typeof dollarsStr === "string" ? parseFloat(dollarsStr) : dollarsStr;
  return Math.round(dollars * 100);
}

// Get date range based on sync type
function getDateRange(syncType: string): { since: string; until: string } {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (d: Date): string => d.toISOString().split("T")[0];

  if (syncType === "fast") {
    return { since: yesterday.toISOString().split("T")[0], until: formatDate(today) };
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (syncType === "full" || syncType === "on_demand") {
    return { since: formatDate(sevenDaysAgo), until: formatDate(today) };
  }

  // deep sync: 30 days
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return { since: formatDate(thirtyDaysAgo), until: formatDate(today) };
}

// Fetch campaigns with pagination
async function fetchCampaigns(
  accountId: string,
  token: string
): Promise<MetaCampaign[]> {
  const campaigns: MetaCampaign[] = [];
  let after: string | undefined;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      fields: "id,name,objective,status,daily_budget,lifetime_budget",
      access_token: token,
      limit: limit.toString(),
    });

    if (after) {
      params.append("after", after);
    }

    const url = `${META_API_BASE}/${accountId}/campaigns?${params}`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch campaigns: ${JSON.stringify(error)}`);
    }

    const data: PaginatedResponse = await response.json();
    campaigns.push(...(data.data as MetaCampaign[]));

    if (!data.paging?.cursors?.after) break;
    after = data.paging.cursors.after;
  }

  return campaigns;
}

// Fetch ad sets with pagination
async function fetchAdSets(
  accountId: string,
  token: string
): Promise<MetaAdSet[]> {
  const adSets: MetaAdSet[] = [];
  let after: string | undefined;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      fields: "id,name,campaign_id,status,daily_budget,targeting,optimization_goal",
      access_token: token,
      limit: limit.toString(),
    });

    if (after) {
      params.append("after", after);
    }

    const url = `${META_API_BASE}/${accountId}/adsets?${params}`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch ad sets: ${JSON.stringify(error)}`);
    }

    const data: PaginatedResponse = await response.json();
    adSets.push(...(data.data as MetaAdSet[]));

    if (!data.paging?.cursors?.after) break;
    after = data.paging.cursors.after;
  }

  return adSets;
}

// Fetch ads with optional creative data
async function fetchAds(
  accountId: string,
  token: string,
  includeCreative = false
): Promise<MetaAd[]> {
  const ads: MetaAd[] = [];
  let after: string | undefined;
  const limit = 100;

  const creativeFields = includeCreative
    ? ",creative{id,thumbnail_url,body,title,call_to_action_type}"
    : "";
  const fields = `id,name,adset_id,status,effective_status${creativeFields}`;

  while (true) {
    const params = new URLSearchParams({
      fields,
      access_token: token,
      limit: limit.toString(),
    });

    if (after) {
      params.append("after", after);
    }

    const url = `${META_API_BASE}/${accountId}/ads?${params}`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch ads: ${JSON.stringify(error)}`);
    }

    const data: PaginatedResponse = await response.json();
    ads.push(...(data.data as MetaAd[]));

    if (!data.paging?.cursors?.after) break;
    after = data.paging.cursors.after;
  }

  return ads;
}

// Fetch insights for an object (ad, ad set, or campaign)
async function fetchInsights(
  objectId: string,
  token: string,
  dateRange: { since: string; until: string }
): Promise<MetaInsights[]> {
  const insights: MetaInsights[] = [];
  let after: string | undefined;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      fields: "spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,frequency,reach,date_start",
      access_token: token,
      time_increment: "1",
      since: dateRange.since,
      until: dateRange.until,
      limit: limit.toString(),
    });

    if (after) {
      params.append("after", after);
    }

    const url = `${META_API_BASE}/${objectId}/insights?${params}`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch insights for ${objectId}: ${JSON.stringify(error)}`);
    }

    const data: PaginatedResponse = await response.json();
    insights.push(...(data.data as MetaInsights[]));

    if (!data.paging?.cursors?.after) break;
    after = data.paging.cursors.after;
  }

  return insights;
}

// Process and normalize metrics
function normalizeMetrics(insight: MetaInsights, adUuid: string, accountUuid: string) {
  const spend = dollarsToCentavos(insight.spend || "0");
  const impressions = parseInt(insight.impressions || "0", 10);
  const clicks = parseInt(insight.clicks || "0", 10);
  const reach = parseInt(insight.reach || "0", 10);

  let conversions = 0;
  let actionValue = 0;

  if (Array.isArray(insight.actions)) {
    conversions = insight.actions.reduce(
      (sum, action) => sum + parseInt(action.value || "0", 10),
      0
    );
  }

  if (Array.isArray(insight.action_values)) {
    actionValue = dollarsToCentavos(
      insight.action_values.reduce(
        (sum, action) => sum + parseFloat(action.value || "0"),
        0
      )
    );
  }

  // ctr and roas are numeric columns — decimals OK
  const ctr =
    impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
  // cpc and cpa are integer columns — must be whole numbers (stored in centavos)
  const cpc =
    clicks > 0 ? Math.round(spend / clicks) : 0;
  const roas =
    spend > 0 ? Math.round((actionValue / spend) * 10000) / 10000 : 0;
  const cpa =
    conversions > 0 ? Math.round(spend / conversions) : 0;

  return {
    ad_id: adUuid,
    account_id: accountUuid,
    date: insight.date_start,
    spend,
    impressions,
    clicks,
    conversions,
    revenue: actionValue,
    ctr,
    cpc,
    roas,
    cpa,
    frequency: parseFloat(insight.frequency || "0"),
    reach,
  };
}

// ── Shared upsert logic for campaigns/ad_sets/ads/creatives ──────────────────
// Upserts using meta_*_id columns and resolves UUID FKs for dependent tables.
async function upsertHierarchy(
  accountId: string,
  campaigns: MetaCampaign[],
  adSets: MetaAdSet[],
  ads: MetaAd[],
) {
  // 1. Upsert campaigns
  if (campaigns.length > 0) {
    const campaignRecords = campaigns.map((c) => ({
      account_id: accountId,
      meta_campaign_id: c.id,
      name: c.name,
      objective: c.objective || null,
      status: c.status,
      daily_budget: c.daily_budget ? dollarsToCentavos(c.daily_budget) : null,
      lifetime_budget: c.lifetime_budget ? dollarsToCentavos(c.lifetime_budget) : null,
    }));
    const { error } = await supabase
      .from("campaigns")
      .upsert(campaignRecords, { onConflict: "account_id,meta_campaign_id" });
    if (error) throw new Error(`Failed to upsert campaigns: ${error.message}`);
  }

  // 2. Resolve campaign UUIDs for ad_sets
  const campaignMetaIds = [...new Set(adSets.map((s) => s.campaign_id))];
  const campaignUuidMap: Record<string, string> = {};
  if (campaignMetaIds.length > 0) {
    const { data: campRows } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id")
      .eq("account_id", accountId)
      .in("meta_campaign_id", campaignMetaIds);
    for (const row of campRows || []) {
      campaignUuidMap[row.meta_campaign_id] = row.id;
    }
  }

  // 3. Upsert ad_sets
  if (adSets.length > 0) {
    const adSetRecords = adSets
      .filter((s) => campaignUuidMap[s.campaign_id]) // skip if campaign not found
      .map((s) => ({
        account_id: accountId,
        meta_adset_id: s.id,
        campaign_id: campaignUuidMap[s.campaign_id],
        name: s.name,
        status: s.status,
        daily_budget: s.daily_budget ? dollarsToCentavos(s.daily_budget) : null,
        targeting: s.targeting || {},
        optimization_goal: s.optimization_goal || null,
      }));
    if (adSetRecords.length > 0) {
      const { error } = await supabase
        .from("ad_sets")
        .upsert(adSetRecords, { onConflict: "account_id,meta_adset_id" });
      if (error) throw new Error(`Failed to upsert ad_sets: ${error.message}`);
    }
  }

  // 4. Resolve adset UUIDs for ads
  const adsetMetaIds = [...new Set(ads.map((a) => a.adset_id))];
  const adsetUuidMap: Record<string, string> = {};
  if (adsetMetaIds.length > 0) {
    const { data: adsetRows } = await supabase
      .from("ad_sets")
      .select("id, meta_adset_id")
      .eq("account_id", accountId)
      .in("meta_adset_id", adsetMetaIds);
    for (const row of adsetRows || []) {
      adsetUuidMap[row.meta_adset_id] = row.id;
    }
  }

  // 5. Upsert ads
  if (ads.length > 0) {
    const adRecords = ads
      .filter((a) => adsetUuidMap[a.adset_id])
      .map((a) => ({
        account_id: accountId,
        meta_ad_id: a.id,
        ad_set_id: adsetUuidMap[a.adset_id],
        name: a.name,
        status: a.status,
        effective_status: a.effective_status,
      }));
    if (adRecords.length > 0) {
      const { error } = await supabase
        .from("ads")
        .upsert(adRecords, { onConflict: "account_id,meta_ad_id" });
      if (error) throw new Error(`Failed to upsert ads: ${error.message}`);
    }
  }

  // 6. Resolve ad UUIDs (meta_ad_id → UUID) for metrics/creatives
  const adMetaIds = ads.map((a) => a.id);
  const adUuidMap: Record<string, string> = {};
  if (adMetaIds.length > 0) {
    // Batch in chunks of 500
    for (let i = 0; i < adMetaIds.length; i += 500) {
      const chunk = adMetaIds.slice(i, i + 500);
      const { data: adRows } = await supabase
        .from("ads")
        .select("id, meta_ad_id")
        .eq("account_id", accountId)
        .in("meta_ad_id", chunk);
      for (const row of adRows || []) {
        adUuidMap[row.meta_ad_id] = row.id;
      }
    }
  }

  // 7. Upsert creatives (linked to ads via creative_id FK)
  const creativeAds = ads.filter((a) => a.creative && adUuidMap[a.id]);
  if (creativeAds.length > 0) {
    const creativeRecords = creativeAds.map((a) => ({
      account_id: accountId,
      meta_creative_id: a.creative!.id,
      thumbnail_url: a.creative!.thumbnail_url || null,
      body: a.creative!.body || null,
      title: a.creative!.title || null,
      cta_type: a.creative!.call_to_action_type || null,
    }));
    const { error } = await supabase
      .from("creatives")
      .upsert(creativeRecords, { onConflict: "id", ignoreDuplicates: true });
    if (error) console.error(`Creatives upsert warning: ${error.message}`);
  }

  return adUuidMap;
}

// Fast sync: active ads with spend > 0, last 7 days, top 50
async function syncFast(accountId: string, token: string, metaAccountId?: string): Promise<void> {
  const metaId = metaAccountId || accountId;
  console.log(`Starting FAST sync for account ${accountId} (meta: ${metaId})`);

  const dateRange = getDateRange("fast");
  const ads = await fetchAds(metaId, token, false);

  // Filter only active ads
  const activeAds = ads.filter(
    (ad) => ad.status === "ACTIVE" && ad.effective_status === "ACTIVE"
  );

  // Resolve ad UUIDs — we need them for ad_metrics
  const adMetaIds = activeAds.map((a) => a.id);
  const adUuidMap: Record<string, string> = {};
  if (adMetaIds.length > 0) {
    for (let i = 0; i < adMetaIds.length; i += 500) {
      const chunk = adMetaIds.slice(i, i + 500);
      const { data: adRows } = await supabase
        .from("ads")
        .select("id, meta_ad_id")
        .eq("account_id", accountId)
        .in("meta_ad_id", chunk);
      for (const row of adRows || []) {
        adUuidMap[row.meta_ad_id] = row.id;
      }
    }
  }

  // Only process ads that exist in our DB
  const knownAds = activeAds.filter((ad) => adUuidMap[ad.id]);

  // Fetch insights for all known active ads
  const adInsights: Record<string, MetaInsights[]> = {};
  for (const ad of knownAds) {
    const insights = await fetchInsights(ad.id, token, dateRange);
    if (insights.length > 0) {
      adInsights[ad.id] = insights;
    }
  }

  // Filter ads with spend > 0 and get top 50
  const adsWithSpend = knownAds
    .filter((ad) => {
      const insights = adInsights[ad.id] || [];
      return insights.some((i) => parseFloat(i.spend || "0") > 0);
    })
    .sort((a, b) => {
      const aSpend = (adInsights[a.id] || []).reduce(
        (sum, i) => sum + parseFloat(i.spend || "0"),
        0
      );
      const bSpend = (adInsights[b.id] || []).reduce(
        (sum, i) => sum + parseFloat(i.spend || "0"),
        0
      );
      return bSpend - aSpend;
    })
    .slice(0, 50);

  // Upsert metrics using UUID ad_id
  const metrics: unknown[] = [];
  for (const ad of adsWithSpend) {
    const insights = adInsights[ad.id] || [];
    for (const insight of insights) {
      metrics.push(normalizeMetrics(insight, adUuidMap[ad.id], accountId));
    }
  }

  if (metrics.length > 0) {
    const { error } = await supabase
      .from("ad_metrics")
      .upsert(metrics, { onConflict: "ad_id,date" });

    if (error) {
      throw new Error(`Failed to upsert ad_metrics: ${error.message}`);
    }
  }

  // Update last_fast_sync_at
  await supabase
    .from("ad_accounts")
    .update({ last_fast_sync_at: new Date().toISOString() })
    .eq("id", accountId);

  console.log(`FAST sync completed: ${metrics.length} metrics synced`);
}

// Full sync: all campaigns/ad sets/ads, last 7 days, includes creatives
async function syncFull(accountId: string, token: string, metaAccountId?: string): Promise<void> {
  const metaId = metaAccountId || accountId;
  console.log(`Starting FULL sync for account ${accountId} (meta: ${metaId})`);

  const dateRange = getDateRange("full");

  // Fetch all campaigns, ad sets, ads
  const [campaigns, adSets, ads] = await Promise.all([
    fetchCampaigns(metaId, token),
    fetchAdSets(metaId, token),
    fetchAds(metaId, token, true),
  ]);

  // Upsert hierarchy and get ad UUID map
  const adUuidMap = await upsertHierarchy(accountId, campaigns, adSets, ads);

  // Fetch insights for all ads using Meta IDs, but store with UUID ad_ids
  const metrics: unknown[] = [];
  for (const ad of ads) {
    if (!adUuidMap[ad.id]) continue;
    const insights = await fetchInsights(ad.id, token, dateRange);
    for (const insight of insights) {
      metrics.push(normalizeMetrics(insight, adUuidMap[ad.id], accountId));
    }
  }

  if (metrics.length > 0) {
    const { error } = await supabase
      .from("ad_metrics")
      .upsert(metrics, { onConflict: "ad_id,date" });
    if (error) throw new Error(`Failed to upsert ad_metrics: ${error.message}`);
  }

  // Update last_full_sync_at and total_ads_synced
  await supabase
    .from("ad_accounts")
    .update({
      last_full_sync_at: new Date().toISOString(),
      total_ads_synced: ads.length,
    })
    .eq("id", accountId);

  console.log(
    `FULL sync completed: ${campaigns.length} campaigns, ${adSets.length} ad sets, ${ads.length} ads, ${metrics.length} metrics`
  );
}

// Deep sync: everything in FULL + 30-day insights + calculate baselines + update maturity
async function syncDeep(accountId: string, token: string, metaAccountId?: string): Promise<void> {
  const metaId = metaAccountId || accountId;
  console.log(`Starting DEEP sync for account ${accountId} (meta: ${metaId})`);

  const dateRange = getDateRange("deep");

  // Fetch all campaigns, ad sets, ads
  const [campaigns, adSets, ads] = await Promise.all([
    fetchCampaigns(metaId, token),
    fetchAdSets(metaId, token),
    fetchAds(metaId, token, true),
  ]);

  // Upsert hierarchy and get ad UUID map
  const adUuidMap = await upsertHierarchy(accountId, campaigns, adSets, ads);

  // Fetch insights for all ads (30 days)
  const metrics: unknown[] = [];
  for (const ad of ads) {
    if (!adUuidMap[ad.id]) continue;
    const insights = await fetchInsights(ad.id, token, dateRange);
    for (const insight of insights) {
      metrics.push(normalizeMetrics(insight, adUuidMap[ad.id], accountId));
    }
  }

  if (metrics.length > 0) {
    const { error } = await supabase
      .from("ad_metrics")
      .upsert(metrics, { onConflict: "ad_id,date" });
    if (error) throw new Error(`Failed to upsert ad_metrics: ${error.message}`);
  }

  // Call calculate-baselines function
  try {
    const response = await fetchWithRetry(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/calculate-baselines`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ account_id: accountId }),
      }
    );

    if (!response.ok) {
      console.error("Failed to call calculate-baselines:", await response.text());
    }
  } catch (error) {
    console.error("Error calling calculate-baselines:", error);
  }

  // Update account maturity and sync timestamps
  await supabase
    .from("ad_accounts")
    .update({
      last_deep_sync_at: new Date().toISOString(),
      last_full_sync_at: new Date().toISOString(),
      total_ads_synced: ads.length,
    })
    .eq("id", accountId);

  console.log(
    `DEEP sync completed: ${campaigns.length} campaigns, ${adSets.length} ad sets, ${ads.length} ads, ${metrics.length} metrics`
  );
}

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body: SyncRequest = await req.json();
    const { account_id, sync_type } = body;

    if (!account_id || !sync_type) {
      return new Response(
        JSON.stringify({ error: "account_id and sync_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token, metaAccountId } = await getAccountCredentials(account_id);

    switch (sync_type) {
      case "fast":
        await syncFast(account_id, token, metaAccountId);
        break;
      case "full":
        await syncFull(account_id, token, metaAccountId);
        break;
      case "deep":
        await syncDeep(account_id, token, metaAccountId);
        break;
      case "on_demand":
        await syncFull(account_id, token, metaAccountId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid sync_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_id,
        sync_type,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
