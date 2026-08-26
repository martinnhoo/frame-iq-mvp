/* eslint-disable @typescript-eslint/no-explicit-any -- External API and ungenerated migration payloads are validated at runtime. */
import { clipCors, json, requireClipUser, serviceClient } from "../_shared/clip-network.ts";

const YT = "https://www.googleapis.com/youtube/v3";

function channelSelector(urlOrId: string) {
  const raw = (urlOrId || "").trim();
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(raw)) return { key: "id", value: raw };
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && parts[1]) return { key: "id", value: parts[1] };
    if (parts[0]?.startsWith("@")) return { key: "forHandle", value: parts[0] };
  } catch {
    // Non-URL channel selectors (for example @handle) are handled below.
  }
  if (raw.startsWith("@")) return { key: "forHandle", value: raw };
  return { key: "forHandle", value: raw };
}

async function resolveChannel(apiKey: string, sourceUrl: string) {
  const selector = channelSelector(sourceUrl);
  const url = new URL(`${YT}/channels`);
  url.searchParams.set("part", "id,snippet,contentDetails");
  url.searchParams.set(selector.key, selector.value);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || !body.items?.length) {
    throw new Error(body?.error?.message || "YouTube channel not found");
  }
  return body.items[0];
}

async function discoverForSource(supabase: any, source: any, apiKey: string) {
  let channelId = source.provider_channel_id;
  let uploadsPlaylistId = source.uploads_playlist_id;

  if (!channelId || !uploadsPlaylistId) {
    const channel = await resolveChannel(apiKey, source.provider_url || source.provider_channel_id || "");
    channelId = channel.id;
    uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error("Uploads playlist not available");
    await supabase.from("clip_sources").update({
      provider_channel_id: channelId,
      uploads_playlist_id: uploadsPlaylistId,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", source.id);
  }

  const listUrl = new URL(`${YT}/playlistItems`);
  listUrl.searchParams.set("part", "snippet,contentDetails");
  listUrl.searchParams.set("playlistId", uploadsPlaylistId);
  listUrl.searchParams.set("maxResults", "25");
  listUrl.searchParams.set("key", apiKey);
  const res = await fetch(listUrl);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || "YouTube playlist lookup failed");

  const rows = (body.items || []).map((item: any) => {
    const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
    return {
      user_id: source.user_id,
      source_id: source.id,
      provider_video_id: videoId,
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      title: item.snippet?.title || "YouTube video",
      thumbnail_url: item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || null,
      source_published_at: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
      rights_confirmed: !!source.rights_confirmed,
      // Discovery is metadata-only. The database default marks new rows as waiting_for_media.
      // Do not send media_status here: rescans must not reset ready/processed assets.
      updated_at: new Date().toISOString(),
    };
  }).filter((x: any) => x.provider_video_id);

  if (rows.length) {
    const { error } = await supabase.from("clip_source_videos")
      .upsert(rows, { onConflict: "source_id,provider_video_id", ignoreDuplicates: false });
    if (error) throw error;
  }

  await supabase.from("clip_sources").update({
    last_checked_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", source.id);

  return { source_id: source.id, channel_id: channelId, discovered: rows.length };
}

async function discoverSources(supabase: any, sources: any[], apiKey: string) {
  const results = [];
  for (const source of sources) {
    try {
      results.push(await discoverForSource(supabase, source, apiKey));
    } catch (e) {
      await supabase.from("clip_sources").update({
        last_error: String(e),
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", source.id);
      results.push({ source_id: source.id, error: String(e) });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) return json({ error: "YOUTUBE_API_KEY missing" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CLIP_NETWORK_CRON_SECRET");
    const headerSecret = req.headers.get("x-clip-cron-secret") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    // Duas portas para o modo cron:
    //  - pg_cron: manda apenas o header x-clip-cron-secret. O agendamento no
    //    Postgres não tem acesso legível à service role key neste ambiente, e
    //    colocá-la no comando do cron seria pior do que um segredo dedicado.
    //  - chamada de serviço: bearer da service role key.
    const isSecretCall = !!cronSecret && headerSecret === cronSecret;
    const isServiceCall = !!serviceKey && authHeader === `Bearer ${serviceKey}`;
    const isCron = isSecretCall || isServiceCall;



    // User-triggered mode. Cron is checked first because scheduled calls also carry a Bearer token.
    if (!isCron && authHeader.startsWith("Bearer ")) {
      const { supabase, user } = await requireClipUser(req);
      const { source_id, network_id } = await req.json().catch(() => ({}));
      let q = supabase.from("clip_sources").select("*").eq("user_id", user.id).eq("provider", "youtube").eq("active", true);
      if (source_id) q = q.eq("id", source_id);
      else if (network_id) q = q.eq("network_id", network_id);
      const { data: sources, error } = await q;
      if (error) throw error;
      const results = await discoverSources(supabase, sources || [], apiKey);
      return json({ success: true, results });
    }

    // Cron mode requires both the service-role bearer and the module-specific secret.
    if (!isCron) return json({ error: "unauthorized" }, 401);
    const supabase = serviceClient();
    const { data: sources, error } = await supabase.from("clip_sources").select("*").eq("provider", "youtube").eq("active", true);
    if (error) throw error;
    const results = await discoverSources(supabase, sources || [], apiKey);
    return json({ success: true, results });
  } catch (e) {
    return json({ error: String(e) }, String(e).includes("unauthorized") ? 401 : 400);
  }
});
