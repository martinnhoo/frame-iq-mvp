export async function buildVisualPlan({
  callFunction,
  clip,
  revision,
  log = console.log,
}) {
  const existing = revision?.parameters || {};

  if (
    existing?.editor === "ai_editor_v3_multimodal" &&
    Number(existing?.version) >= 3 &&
    Array.isArray(existing?.framing) &&
    existing.framing.length
  ) {
    return existing;
  }

  log(`[clip ${clip.id}] AI Editor v3: Gemini assistindo ao trecho do YouTube`);

  const response = await callFunction(
    "clip-ai-editor-v3",
    "analyze_video",
    {
      clip_id: clip.id,
      revision_id: revision.id,
    },
    { timeoutMs: 240_000 },
  );

  const plan = response?.plan;
  if (
    !plan ||
    plan.editor !== "ai_editor_v3_multimodal" ||
    Number(plan.version) < 3
  ) {
    throw new Error("AI Editor v3 não devolveu plano válido");
  }

  log(
    `[clip ${clip.id}] AI Editor v3: ${response.source_method || "visual"} | ` +
    `${plan.framing?.length || 0} enquadramentos | ` +
    `${plan.overlays?.length || 0} overlays | ` +
    `headline=${plan.hook_overlay?.enabled ? "sim" : "nao"}`,
  );

  return plan;
}
