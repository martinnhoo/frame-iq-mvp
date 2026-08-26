/**
 * clip-network-sign-media — dá ao dashboard uma URL temporária para assistir ou
 * baixar um corte.
 *
 * Por que existe: o bucket clip-network é privado, e assim deve continuar. O
 * banco guarda `rendered_storage_path` (permanente) e nunca uma URL assinada
 * (que expira e viraria um link morto salvo como se fosse verdade). O player
 * pede a assinatura no momento do play.
 *
 * A checagem de dono é feita aqui, com o service role, comparando o user_id da
 * linha com o dono do JWT — o cliente não escolhe o caminho do arquivo.
 */
import { clipCors, json, requireClipBridgeUser } from "../_shared/clip-network-bridge.ts";

const BUCKET = "clip-network";
const DEFAULT_TTL = 60 * 60; // 1 hora: cobre assistir e baixar sem virar link permanente.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    const { supabase, user } = await requireClipBridgeUser(req);
    const { clip_id, variant_id, revision_id, source_video_id, download } = await req.json().catch(() => ({}));

    let path: string | null = null;
    let filename = "clip.mp4";

    if (revision_id) {
      const { data, error } = await supabase
        .from("clip_revisions")
        .select("id,user_id,rendered_storage_path,revision_number,clip_variants(variant_key),clips(on_screen_title,hook)")
        .eq("id", revision_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== user.id) return json({ error: "not_found" }, 404);
      path = data.rendered_storage_path;
      const clip = Array.isArray(data.clips) ? data.clips[0] : data.clips;
      const variant = Array.isArray(data.clip_variants) ? data.clip_variants[0] : data.clip_variants;
      const label = String(clip?.on_screen_title || clip?.hook || "clip")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "clip";
      filename = `${label}-${variant?.variant_key || "variant"}-v${data.revision_number}.mp4`;
    } else if (variant_id) {
      const { data, error } = await supabase
        .from("clip_variants")
        .select("id,user_id,variant_key,rendered_storage_path,current_revision,clips(on_screen_title,hook)")
        .eq("id", variant_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== user.id) return json({ error: "not_found" }, 404);
      path = data.rendered_storage_path;
      const clip = Array.isArray(data.clips) ? data.clips[0] : data.clips;
      const label = String(clip?.on_screen_title || clip?.hook || "clip")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "clip";
      filename = `${label}-${data.variant_key}-v${data.current_revision}.mp4`;
    } else if (clip_id) {
      const { data, error } = await supabase
        .from("clips")
        .select("id,user_id,rendered_storage_path,on_screen_title,hook")
        .eq("id", clip_id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== user.id) return json({ error: "not_found" }, 404);
      path = data.rendered_storage_path;
      const label = String(data.on_screen_title || data.hook || "clip")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "clip";
      filename = `${label}.mp4`;
    } else if (source_video_id) {
      const { data, error } = await supabase
        .from("clip_source_videos")
        .select("id,user_id,media_storage_path")
        .eq("id", source_video_id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.user_id !== user.id) return json({ error: "not_found" }, 404);
      path = data.media_storage_path;
      filename = "master.mp4";
    } else {
      return json({ error: "revision_id, variant_id, clip_id or source_video_id required" }, 400);
    }

    if (!path) return json({ error: "media_not_ready" }, 409);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, DEFAULT_TTL, download ? { download: filename } : undefined);
    if (signError) throw signError;

    return json({ url: signed.signedUrl, expires_in: DEFAULT_TTL, filename });
  } catch (e) {
    const message = String((e as Error)?.message || e);
    return json({ error: message }, message === "unauthorized" ? 401 : 500);
  }
});
