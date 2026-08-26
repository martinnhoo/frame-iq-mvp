/* eslint-disable @typescript-eslint/no-explicit-any -- render settings are intentionally extensible JSON. */
export type FeedbackChange = {
  type: "trim_start" | "trim_end" | "caption_on_off" | "caption_size" | "caption_position" | "zoom_intensity" | "framing" | "regenerate_variant";
  seconds?: number;
  enabled?: boolean;
  direction?: "increase" | "decrease";
  position?: "lower" | "lower_mid" | "center";
  mode?: "contain_blur" | "cover_center";
};

export type InterpretedFeedback = {
  feedback_type: "trim_start" | "trim_end" | "caption_style" | "framing" | "regenerate_variant";
  changes: FeedbackChange[];
  summary: string;
};

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const secondsNear = (text: string, marker: RegExp) => {
  const before = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:s|seg|segundo|segundos)?[^.]{0,35}${marker.source}`));
  const after = text.match(new RegExp(`${marker.source}[^.]{0,35}?(\\d+(?:[.,]\\d+)?)\\s*(?:s|seg|segundo|segundos)?`));
  return Number(String(before?.[1] || after?.[1] || "").replace(",", ".")) || null;
};

export function parseDeterministicFeedback(input: string): InterpretedFeedback | null {
  const text = normalize(input.trim());
  if (!text) return null;
  if (/(legenda|transcri).*(errad|corrig)|quando (ele|ela) (fala|diz)|depois da resposta|antes da resposta|outro momento|momento parecido|nao funciona|mais contexto|comeca muito cedo|termina muito cedo/.test(text)) return null;

  const changes: FeedbackChange[] = [];
  const summary: string[] = [];
  const startSeconds = secondsNear(text, /(comeco|inicio)/);
  const endSeconds = secondsNear(text, /(final|fim)/);
  if (startSeconds && /(cort|tir|remove|comec.*depois)/.test(text)) {
    changes.push({ type: "trim_start", seconds: startSeconds });
    summary.push(`cortar ${startSeconds}s do início`);
  }
  if (endSeconds && /(cort|tir|remove|termin.*antes)/.test(text)) {
    changes.push({ type: "trim_end", seconds: endSeconds });
    summary.push(`cortar ${endSeconds}s do final`);
  }
  if (/(sem legenda|tira(r)? a legenda|remove(r)? a legenda|desliga(r)? a legenda)/.test(text)) {
    changes.push({ type: "caption_on_off", enabled: false }); summary.push("sem legenda");
  } else if (/(com legenda|coloca(r)? a legenda|liga(r)? a legenda)/.test(text)) {
    changes.push({ type: "caption_on_off", enabled: true }); summary.push("com legenda");
  }
  if (/(legenda).*(menor|muito grande)/.test(text)) {
    changes.push({ type: "caption_size", direction: "decrease" }); summary.push("legenda menor");
  } else if (/(legenda).*(maior|muito pequena)/.test(text)) {
    changes.push({ type: "caption_size", direction: "increase" }); summary.push("legenda maior");
  }
  if (/(legenda).*(mais baixa|abaixo)/.test(text)) {
    changes.push({ type: "caption_position", position: "lower" }); summary.push("posição da legenda: lower");
  } else if (/(legenda).*(mais alta|acima)/.test(text)) {
    changes.push({ type: "caption_position", position: "lower_mid" }); summary.push("posição da legenda: lower-mid");
  }
  if (/(aumenta|mais).*(zoom)/.test(text)) {
    changes.push({ type: "zoom_intensity", direction: "increase" }); summary.push("aumentar punch-in");
  } else if (/(diminui|menos).*(zoom)/.test(text)) {
    changes.push({ type: "zoom_intensity", direction: "decrease" }); summary.push("diminuir punch-in");
  }
  if (/(rosto|cabeca).*(cortad)|enquadramento.*cortad|usa.*blur/.test(text)) {
    changes.push({ type: "framing", mode: "contain_blur" }); summary.push("preservar o quadro com fundo blur");
  }
  if (/(renderiza|gera).*(novamente|de novo)|rerender/.test(text)) {
    changes.push({ type: "regenerate_variant" }); summary.push("renderizar novamente");
  }
  if (!changes.length) return null;
  const first = changes[0].type;
  const feedback_type = first === "caption_on_off" || first === "caption_size" || first === "caption_position"
    ? "caption_style" : first === "zoom_intensity" || first === "framing" ? "framing" : first;
  return { feedback_type, changes, summary: summary.join(" · ") };
}

export function applyFeedbackChanges(raw: Record<string, unknown>, action: InterpretedFeedback) {
  const settings = structuredClone(raw || {}) as Record<string, any>;
  settings.captions = typeof settings.captions === "object" && settings.captions ? { ...settings.captions } : {};
  settings.framing = typeof settings.framing === "object" && settings.framing ? { ...settings.framing } : {};
  for (const change of action.changes) {
    if (change.type === "trim_start") settings.start_seconds = Number(settings.start_seconds || 0) + Number(change.seconds || 0);
    if (change.type === "trim_end") settings.end_seconds = Number(settings.end_seconds || 0) - Number(change.seconds || 0);
    if (change.type === "caption_on_off") settings.captions.enabled = change.enabled;
    if (change.type === "caption_size") {
      const current = Number(settings.captions.scale || 1);
      settings.captions.scale = Math.min(1.4, Math.max(0.65, current + (change.direction === "increase" ? 0.15 : -0.15)));
    }
    if (change.type === "caption_position") settings.captions.position = change.position;
    if (change.type === "zoom_intensity") {
      const levels = ["low", "medium", "high"];
      const current = Math.max(0, levels.indexOf(String(settings.framing.zoomIntensity || "medium")));
      settings.framing.zoomIntensity = levels[Math.min(2, Math.max(0, current + (change.direction === "increase" ? 1 : -1)))];
    }
    if (change.type === "framing") settings.framing.mode = change.mode;
  }
  return settings;
}

export function isSemanticRegeneration(text: string) {
  const normalized = normalize(text);
  return /(outro momento|momento parecido|nao funciona|procura outro|nova oportunidade)/.test(normalized);
}
