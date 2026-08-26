/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase relation payloads are runtime-validated below. */
import { clipCors, json, requireClipUser, serviceClient } from "../_shared/clip-network.ts";

const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v25.0";

async function authorize(req: Request, publicationId: string) {
  const supabase = serviceClient();
  const secret = Deno.env.get("CLIP_NETWORK_CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (secret
    && req.headers.get("x-clip-cron-secret") === secret
    && req.headers.get("Authorization") === `Bearer ${serviceKey}`) {
    return { supabase, userId: null as string | null };
  }
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const { user } = await requireClipUser(req);
    const { data } = await supabase.from("clip_publications").select("id,user_id").eq("id", publicationId).eq("user_id", user.id).single();
    if (!data) throw new Error("publication not found");
    return { supabase, userId: user.id };
  }
  throw new Error("unauthorized");
}

async function loadPublication(supabase: any, publicationId: string) {
  const { data: pub, error } = await supabase.from("clip_publications")
    .select("*, clips(*), clip_social_accounts(*)")
    .eq("id", publicationId).single();
  if (error || !pub) throw new Error("publication not found");
  if (pub.platform !== "instagram") throw new Error("not an Instagram publication");
  if (pub.clips?.user_id !== pub.user_id
    || pub.clip_social_accounts?.user_id !== pub.user_id
    || pub.clip_social_accounts?.platform !== "instagram") {
    throw new Error("invalid publication ownership");
  }
  const { data: token } = await supabase.from("clip_social_tokens").select("*").eq("social_account_id", pub.social_account_id).single();
  if (!token?.access_token) throw new Error("Instagram token missing");
  return { pub, token };
}

async function publishContainer(supabase: any, pub: any, token: any, creationId: string) {
  const statusUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${creationId}`);
  statusUrl.searchParams.set("fields", "status_code,status");
  statusUrl.searchParams.set("access_token", token.access_token);
  const statusRes = await fetch(statusUrl);
  const status = await statusRes.json();
  const code = status.status_code;
  if (code === "ERROR" || code === "EXPIRED") {
    await supabase.from("clip_publications").update({
      status: "failed", error_code: code, error_message: status.status || "Instagram processing failed", last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", pub.id);
    throw new Error(status.status || "Instagram processing failed");
  }
  if (code !== "FINISHED") {
    await supabase.from("clip_publications").update({
      status: "processing", provider_publish_id: creationId, last_checked_at: new Date().toISOString(), provider_payload: status, updated_at: new Date().toISOString(),
    }).eq("id", pub.id);
    return { processing: true, status };
  }

  const publishUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pub.clip_social_accounts.external_user_id}/media_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", token.access_token);
  const publishRes = await fetch(publishUrl, { method: "POST" });
  const published = await publishRes.json();
  if (!publishRes.ok || published.error) throw new Error(published?.error?.message || "Instagram media_publish failed");

  await supabase.from("clip_publications").update({
    status: "published", provider_publish_id: creationId, provider_media_id: published.id,
    published_at: new Date().toISOString(), last_checked_at: new Date().toISOString(), provider_payload: published,
    error_code: null, error_message: null, updated_at: new Date().toISOString(),
  }).eq("id", pub.id);
  await supabase.from("clips").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", pub.clip_id);
  return { processing: false, media_id: published.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    const body = await req.json().catch(() => ({}));
    const publicationId = body.publication_id;
    if (!publicationId) return json({ error: "publication_id required" }, 400);
    const { supabase, userId } = await authorize(req, publicationId);
    const { pub, token } = await loadPublication(supabase, publicationId);
    if (userId && pub.user_id !== userId) throw new Error("forbidden");

    if (pub.status === "published") return json({ success: true, already_published: true, media_id: pub.provider_media_id });
    if (body.action === "check" || pub.provider_publish_id) {
      const result = await publishContainer(supabase, pub, token, pub.provider_publish_id);
      return json({ success: true, ...result });
    }

    const videoUrl = pub.clips?.rendered_url;
    if (!videoUrl || !/^https:\/\//.test(videoUrl)) throw new Error("clip has no public rendered_url");
    const caption = (pub.clips?.caption || "").slice(0, 2200);

    await supabase.from("clip_publications").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", pub.id);

    const createUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pub.clip_social_accounts.external_user_id}/media`);
    createUrl.searchParams.set("media_type", "REELS");
    createUrl.searchParams.set("video_url", videoUrl);
    createUrl.searchParams.set("caption", caption);
    createUrl.searchParams.set("share_to_feed", "true");
    createUrl.searchParams.set("access_token", token.access_token);
    const createRes = await fetch(createUrl, { method: "POST" });
    const created = await createRes.json();
    if (!createRes.ok || created.error || !created.id) throw new Error(created?.error?.message || "Instagram container creation failed");

    await supabase.from("clip_publications").update({
      status: "processing", provider_publish_id: created.id, provider_payload: created, updated_at: new Date().toISOString(),
    }).eq("id", pub.id);

    // Fast-path for small Reels. If Meta is still processing, scheduler will check again later.
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const result = await publishContainer(supabase, pub, token, created.id);
      if (!result.processing) return json({ success: true, ...result });
    }
    return json({ success: true, processing: true, creation_id: created.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, message.includes("unauthorized") ? 401 : message.includes("forbidden") ? 403 : 400);
  }
});
