/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase JSON/transcript payloads are validated before persistence. */
import { clipCors, json, requireClipUser } from "../_shared/clip-network.ts";
import { applyFeedbackChanges, isSemanticRegeneration, parseDeterministicFeedback } from "../_shared/clip-feedback.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
const VARIANT_KEYS = ["blur_caption", "zoom_caption", "zoom_clean"] as const;

const nowIso = () => new Date().toISOString();
const variantLabel: Record<string,string> = {
  blur_caption: "Blur + legenda", zoom_caption: "Zoom + legenda", zoom_clean: "Zoom sem legenda",
};

function defaultSettings(variantKey: string, clip: Record<string, any>) {
  return {
    start_seconds: Number(clip.start_seconds), end_seconds: Number(clip.end_seconds),
    captions: { enabled: variantKey !== "zoom_clean", scale: 1, position: "lower" },
    framing: { mode: variantKey === "blur_caption" ? "contain_blur" : "cover_center", zoomIntensity: variantKey === "blur_caption" ? "low" : "medium" },
    audio: { normalize: true }, hookTitle: { enabled: false },
  };
}

async function openAiFeedback(clip: Record<string, any>, transcript: Record<string, any>, feedback: string, regenerate: boolean) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada para feedback semântico");
  const segments = transcript?.segments || [];
  const relevant = regenerate ? segments : segments.filter((segment: any) =>
    Number(segment.end) >= Number(clip.start_seconds) - 60 && Number(segment.start) <= Number(clip.end_seconds) + 60);
  const timestamped = relevant.map((segment: any) => `[${Number(segment.start).toFixed(2)}-${Number(segment.end).toFixed(2)}] ${segment.text}`).join("\n").slice(0, 180_000);
  const prompt = regenerate
    ? [
      "Encontre UMA nova oportunidade editorial semelhante, mas não repita o momento descartado.",
      "Use somente a transcrição e timestamps reais. Duração entre 5 e 90 segundos; comece e termine em limites naturais de fala.",
      `Momento anterior: ${clip.start_seconds}-${clip.end_seconds}s | ${clip.hook || clip.topic || ""}`,
      `Feedback: ${feedback}`, "TRANSCRIÇÃO:", timestamped,
      'Responda JSON: {"feedback_type":"regenerate_opportunity","summary":"...","new_opportunity":{"start_seconds":0,"end_seconds":30,"hook":"...","topic":"...","on_screen_title":"...","caption":"...","score":80,"reason":"..."}}',
    ].join("\n")
    : [
      "Interprete um pedido de revisão de um corte usando a transcrição existente.",
      "Não reescreva falas. Para início/fim natural, devolva timestamps reais nos limites de fala. Para legenda errada, devolva caption_text corrigido preservando literalmente a fala.",
      `Corte atual: ${clip.start_seconds}-${clip.end_seconds}s`, `Feedback: ${feedback}`,
      "TRANSCRIÇÃO PRÓXIMA AO CORTE:", timestamped,
      'Responda JSON: {"feedback_type":"trim_start|trim_end|caption_text|caption_style|framing|regenerate_variant","summary":"...","start_seconds":0,"end_seconds":30,"caption_text":null}',
    ].join("\n");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Você interpreta revisões de vídeo e responde somente JSON válido." }, { role: "user", content: prompt }] }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI feedback falhou (${response.status}): ${body?.error?.message || "erro desconhecido"}`);
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI não retornou interpretação do feedback");
  return JSON.parse(content);
}

function semanticSettings(raw: Record<string, any>, semantic: Record<string, any>) {
  const next = structuredClone(raw || {});
  if (Number.isFinite(Number(semantic.start_seconds))) next.start_seconds = Number(semantic.start_seconds);
  if (Number.isFinite(Number(semantic.end_seconds))) next.end_seconds = Number(semantic.end_seconds);
  if (semantic.caption_text) next.captions = { ...(next.captions || {}), text: String(semantic.caption_text) };
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    const { supabase, user } = await requireClipUser(req);
    const { action, payload = {} } = await req.json().catch(() => ({}));
    const clipId = String(payload.clip_id || "");
    if (!clipId) return json({ error: "clip_id required" }, 400);
    const { data: clip, error: clipError } = await supabase.from("clips")
      .select("*, clip_source_videos(transcript,duration_seconds,title)")
      .eq("id", clipId).eq("user_id", user.id).maybeSingle();
    if (clipError) throw clipError;
    if (!clip) return json({ error: "not_found" }, 404);

    if (action === "approve") {
      const { data, error } = await supabase.from("clips").update({ status: "approved", updated_at: nowIso() })
        .eq("id", clip.id).eq("user_id", user.id).eq("status", "candidate").select("*").maybeSingle();
      if (error) throw error;
      return json({ ok: true, clip: data || clip });
    }

    if (action === "discard") {
      const text = String(payload.feedback || "Momento descartado pelo revisor").trim();
      const interpreted = { type: "discard", summary: "Descartar este momento e não regenerar a mesma ideia automaticamente" };
      const { error: feedbackError } = await supabase.from("clip_feedback").insert({ user_id: user.id, clip_id: clip.id, feedback_text: text, feedback_type: "discard", interpreted_action: interpreted, requires_ai: false, status: "completed" });
      if (feedbackError) throw feedbackError;
      const { error } = await supabase.from("clips").update({ status: "rejected", updated_at: nowIso() }).eq("id", clip.id).eq("user_id", user.id);
      if (error) throw error;
      return json({ ok: true, interpreted_action: interpreted });
    }

    if (action === "retry_revision") {
      const revisionId = String(payload.revision_id || "");
      const { data, error } = await supabase.from("clip_revisions").update({ render_status: "pending", last_error: null, locked_by: null, lease_expires_at: null, updated_at: nowIso() })
        .eq("id", revisionId).eq("user_id", user.id).eq("clip_id", clip.id).eq("render_status", "error").select("id").maybeSingle();
      if (error) throw error;
      return json({ ok: Boolean(data) });
    }

    if (action !== "submit_feedback") return json({ error: "unknown_action" }, 400);
    const feedbackText = String(payload.feedback || "").trim();
    if (!feedbackText) return json({ error: "feedback required" }, 400);
    const variantId = payload.clip_variant_id ? String(payload.clip_variant_id) : null;
    const deterministic = parseDeterministicFeedback(feedbackText);
    const regenerate = isSemanticRegeneration(feedbackText);
    const semantic = deterministic ? null : await openAiFeedback(clip, clip.clip_source_videos?.transcript || {}, feedbackText, regenerate);
    const interpreted = deterministic || {
      feedback_type: regenerate ? "regenerate_opportunity" : String(semantic?.feedback_type || "regenerate_variant"),
      summary: String(semantic?.summary || "Ajuste semântico interpretado"),
      semantic,
    };
    const allowedTypes = new Set(["trim_start","trim_end","caption_text","caption_style","framing","regenerate_variant","regenerate_opportunity","discard"]);
    const feedbackType = allowedTypes.has(interpreted.feedback_type) ? interpreted.feedback_type : "regenerate_variant";
    const { data: feedbackRow, error: feedbackError } = await supabase.from("clip_feedback").insert({
      user_id: user.id, clip_id: clip.id, clip_variant_id: variantId,
      feedback_text: feedbackText, feedback_type: feedbackType,
      interpreted_action: interpreted, requires_ai: !deterministic, status: "processing",
    }).select("*").single();
    if (feedbackError) throw feedbackError;

    try {
      if (feedbackType === "regenerate_opportunity") {
        const next = semantic?.new_opportunity;
        const start = Number(next?.start_seconds), end = Number(next?.end_seconds);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 5 || end - start > 90) throw new Error("Nova oportunidade sem timestamps válidos");
        const { data: replacement, error: replacementError } = await supabase.from("clips").insert({
          user_id: user.id, source_video_id: clip.source_video_id, clip_account_id: clip.clip_account_id,
          dedupe_key: `feedback:${feedbackRow.id}`, start_seconds: start, end_seconds: end,
          transcript_excerpt: (clip.clip_source_videos?.transcript?.segments || []).filter((segment: any) => Number(segment.end) > start && Number(segment.start) < end).map((segment: any) => segment.text).join(" ").slice(0,4000),
          topic: next.topic || clip.topic, hook: next.hook || null, on_screen_title: next.on_screen_title || null,
          caption: next.caption || null, score: Math.max(0, Math.min(100, Number(next.score || clip.score || 0))),
          ai_reason: next.reason || "Nova oportunidade solicitada em revisão", status: "candidate", render_status: "pending", updated_at: nowIso(),
        }).select("*").single();
        if (replacementError) throw replacementError;
        await supabase.from("clips").update({ status: "rejected", updated_at: nowIso() }).eq("id", clip.id).eq("user_id", user.id);
        const finalAction = { ...interpreted, new_clip_id: replacement.id };
        await supabase.from("clip_feedback").update({ status: "completed", interpreted_action: finalAction, updated_at: nowIso() }).eq("id", feedbackRow.id);
        return json({ ok: true, interpreted_action: finalAction, replacement_clip: replacement });
      }

      if (clip.status === "candidate") {
        let base = { start_seconds: Number(clip.start_seconds), end_seconds: Number(clip.end_seconds), captions: { enabled: true, scale: 1, position: "lower" }, framing: { mode: "cover_center", zoomIntensity: "medium" } };
        base = deterministic ? applyFeedbackChanges(base, deterministic) : semanticSettings(base, semantic);
        if (Number(base.end_seconds) - Number(base.start_seconds) < 5) throw new Error("O ajuste deixaria o corte com menos de 5 segundos");
        const patch: Record<string,unknown> = { start_seconds: base.start_seconds, end_seconds: base.end_seconds, updated_at: nowIso() };
        if (base.captions?.text) patch.caption = base.captions.text;
        const { error } = await supabase.from("clips").update(patch).eq("id", clip.id).eq("user_id", user.id).eq("status", "candidate");
        if (error) throw error;
        await supabase.from("clip_feedback").update({ status: "completed", interpreted_action: { ...interpreted, previous_parameters: { start_seconds: clip.start_seconds, end_seconds: clip.end_seconds }, new_parameters: base }, updated_at: nowIso() }).eq("id", feedbackRow.id);
        return json({ ok: true, interpreted_action: interpreted, candidate_updated: true });
      }

      const { data: variants, error: variantsError } = await supabase.from("clip_variants").select("*").eq("clip_id", clip.id).eq("user_id", user.id);
      if (variantsError) throw variantsError;
      let targets = variants || [];
      if (variantId) targets = targets.filter((variant) => variant.id === variantId);
      else if (feedbackType === "caption_text" || feedbackType === "caption_style") targets = targets.filter((variant) => variant.variant_key !== "zoom_clean");
      if (!targets.length) throw new Error("Nenhuma variante válida para este ajuste");

      const created = [];
      for (const variant of targets) {
        const previous = Object.keys(variant.parameters || {}).length ? variant.parameters : defaultSettings(variant.variant_key, clip);
        const next = deterministic ? applyFeedbackChanges(previous, deterministic) : semanticSettings(previous, semantic);
        if (!Number.isFinite(Number(next.start_seconds))) next.start_seconds = Number(clip.start_seconds);
        if (!Number.isFinite(Number(next.end_seconds))) next.end_seconds = Number(clip.end_seconds);
        if (Number(next.end_seconds) - Number(next.start_seconds) < 5) throw new Error("O ajuste deixaria o corte com menos de 5 segundos");
        const revisionNumber = Number(variant.current_revision || 1) + 1;
        const { data: revision, error: revisionError } = await supabase.from("clip_revisions").insert({
          user_id: user.id, clip_id: clip.id, clip_variant_id: variant.id, feedback_id: feedbackRow.id,
          revision_number: revisionNumber, feedback_text: feedbackText, interpreted_action: interpreted,
          previous_parameters: previous, parameters: next, render_status: "pending",
        }).select("*").single();
        if (revisionError) throw revisionError;
        const { error: pointerError } = await supabase.from("clip_variants").update({
          current_revision: revisionNumber, current_revision_id: revision.id, parameters: next,
          render_status: "pending", rendered_storage_path: null, rendered_url: null, last_error: null, render_attempts: 0, updated_at: nowIso(),
        }).eq("id", variant.id).eq("user_id", user.id);
        if (pointerError) throw pointerError;
        created.push({ ...revision, variant_key: variant.variant_key, label: variantLabel[variant.variant_key] });
      }
      await supabase.from("clip_feedback").update({ status: "completed", updated_at: nowIso() }).eq("id", feedbackRow.id);
      return json({ ok: true, interpreted_action: interpreted, revisions: created });
    } catch (error) {
      await supabase.from("clip_feedback").update({ status: "error", last_error: String((error as Error)?.message || error).slice(0,1500), updated_at: nowIso() }).eq("id", feedbackRow.id);
      throw error;
    }
  } catch (error) {
    const message = String((error as Error)?.message || error);
    return json({ error: message }, message === "unauthorized" ? 401 : 500);
  }
});
