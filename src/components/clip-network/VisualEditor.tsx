import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";

type VisualEditorProps = {
  revision: any;
  busy: boolean;
  onSave: (headline: Record<string, unknown>, captions: Record<string, unknown>) => void;
};

const presetLabel: Record<string, string> = {
  simple_viral: "Viral simples",
  viral_headline: "Viral simples",
  media_split: "Imagem + faixa + vídeo",
  news_page: "Página / notícia",
};

function initialDraft(revision: any) {
  const p = revision?.parameters || {};
  const headline =
    p.headline_override ||
    p.v5_runtime?.headline ||
    p.v5_plan?.recommended?.headline ||
    p.headline_v51 ||
    {};
  const captions =
    p.captions_override ||
    p.v5_runtime?.captions ||
    p.v5_plan?.recommended?.captions ||
    {};

  const preset =
    headline.preset === "viral_headline"
      ? "simple_viral"
      : ["simple_viral", "media_split", "news_page"].includes(headline.preset)
        ? headline.preset
        : "simple_viral";

  return {
    preset,
    text: String(headline.text || headline.display_text || "").replace(/\p{Extended_Pictographic}/gu, "").trim(),
    emoji: String(headline.emoji || ""),
    fontFamily: String(headline.style?.font_family || (preset === "news_page" ? "Inter" : "DejaVu Sans Condensed")),
    fontSize: Number(headline.style?.font_size || headline.font_size || (preset === "simple_viral" ? 62 : preset === "news_page" ? 49 : 44)),
    panelHeight: Number(headline.style?.panel_height || headline.panel_height || (preset === "simple_viral" ? 250 : preset === "news_page" ? 390 : 120)),
    tracking: Number(headline.style?.tracking ?? (preset === "simple_viral" ? -0.9 : -0.2)),
    bold: headline.style?.bold !== false,
    italic: headline.style?.italic ?? preset === "simple_viral",
    showEmoji: Boolean(headline.style?.show_emoji),
    pageName: String(headline.page_name || "FRAMEIQ CORTES"),
    handle: String(headline.handle || "@frameiqcortes"),
    captionSize: Number(captions.style?.font_size || captions.caption_font_size || 56),
    captionPosition: String(captions.position || "lower_mid"),
    captionColor: String(captions.style?.active_color || "yellow"),
    captionOutline: Number(captions.style?.outline || 4),
    captionFont: String(captions.style?.font_family || "Inter"),
  };
}

export default function VisualEditor({ revision, busy, onSave }: VisualEditorProps) {
  const seed = useMemo(() => initialDraft(revision), [revision?.id, revision?.updated_at]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(seed);

  useEffect(() => setDraft(seed), [seed]);

  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = () => {
    const headline = {
      enabled: true,
      preset: draft.preset,
      text: draft.text.trim(),
      emoji: draft.emoji.trim(),
      page_name: draft.pageName.trim(),
      handle: draft.handle.trim(),
      style: {
        font_family: draft.fontFamily,
        font_size: draft.fontSize,
        panel_height: draft.panelHeight,
        tracking: draft.tracking,
        bold: draft.bold,
        italic: draft.italic,
        show_emoji: draft.showEmoji,
      },
    };
    const captions = {
      preset: "dynamic_active_word",
      max_words: 4,
      position: draft.captionPosition,
      style: {
        font_family: draft.captionFont,
        font_size: draft.captionSize,
        active_color: draft.captionColor,
        outline: draft.captionOutline,
      },
    };
    onSave(headline, captions);
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[.04]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="inline-flex items-center text-[11px] font-medium text-violet-100">
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
          Editar headline e legenda
        </span>
        <span className="text-[10px] text-white/35">{open ? "Fechar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[.06] p-3">
          <label className="block">
            <span className="text-[9px] uppercase tracking-[.08em] text-white/35">Template</span>
            <select
              value={draft.preset}
              onChange={(e) => set("preset", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0d11] px-2.5 py-2 text-[11px] text-white"
            >
              {["simple_viral", "media_split", "news_page"].map((preset) => (
                <option key={preset} value={preset}>{presetLabel[preset]}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[9px] uppercase tracking-[.08em] text-white/35">Headline</span>
            <textarea
              rows={2}
              value={draft.text}
              onChange={(e) => set("text", e.target.value)}
              className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-400/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-[9px] text-white/35">Fonte</span>
              <select value={draft.fontFamily} onChange={(e) => set("fontFamily", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0d11] px-2 py-2 text-[10px] text-white">
                <option>DejaVu Sans Condensed</option>
                <option>Inter</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] text-white/35">Tamanho · {draft.fontSize}</span>
              <input type="range" min="40" max="90" value={draft.fontSize} onChange={(e) => set("fontSize", Number(e.target.value))} className="mt-2 w-full" />
            </label>
            <label>
              <span className="text-[9px] text-white/35">Área do topo · {draft.panelHeight}px</span>
              <input type="range" min="120" max="420" value={draft.panelHeight} onChange={(e) => set("panelHeight", Number(e.target.value))} className="mt-2 w-full" />
            </label>
            <label>
              <span className="text-[9px] text-white/35">Espaçamento · {draft.tracking}</span>
              <input type="range" min="-3" max="4" step=".1" value={draft.tracking} onChange={(e) => set("tracking", Number(e.target.value))} className="mt-2 w-full" />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 text-[10px] text-white/60">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={draft.bold} onChange={(e) => set("bold", e.target.checked)} />Negrito</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={draft.italic} onChange={(e) => set("italic", e.target.checked)} />Itálico</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={draft.showEmoji} onChange={(e) => set("showEmoji", e.target.checked)} />Emoji</label>
          </div>

          {draft.showEmoji && (
            <input value={draft.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={8} placeholder="😳" className="w-20 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-sm text-white" />
          )}

          {draft.preset === "news_page" && (
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.pageName} onChange={(e) => set("pageName", e.target.value)} placeholder="Nome da página" className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-[10px] text-white" />
              <input value={draft.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@handle" className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-[10px] text-white" />
            </div>
          )}

          <div className="border-t border-white/[.06] pt-3">
            <div className="mb-2 text-[9px] uppercase tracking-[.08em] text-white/35">Legenda</div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-[9px] text-white/35">Tamanho · {draft.captionSize}</span>
                <input type="range" min="42" max="76" value={draft.captionSize} onChange={(e) => set("captionSize", Number(e.target.value))} className="mt-2 w-full" />
              </label>
              <label>
                <span className="text-[9px] text-white/35">Contorno · {draft.captionOutline}</span>
                <input type="range" min="1" max="7" step=".5" value={draft.captionOutline} onChange={(e) => set("captionOutline", Number(e.target.value))} className="mt-2 w-full" />
              </label>
              <select value={draft.captionPosition} onChange={(e) => set("captionPosition", e.target.value)} className="rounded-lg border border-white/10 bg-[#0b0d11] px-2 py-2 text-[10px] text-white">
                <option value="lower_mid">Centro baixo</option>
                <option value="center_low">Mais acima</option>
                <option value="lower">Mais abaixo</option>
              </select>
              <select value={draft.captionColor} onChange={(e) => set("captionColor", e.target.value)} className="rounded-lg border border-white/10 bg-[#0b0d11] px-2 py-2 text-[10px] text-white">
                <option value="yellow">Destaque amarelo</option>
                <option value="cyan">Destaque ciano</option>
                <option value="green">Destaque verde</option>
                <option value="white">Sem cor</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy || !draft.text.trim()}
            className="inline-flex w-full items-center justify-center rounded-lg bg-violet-500 px-3 py-2.5 text-[11px] font-semibold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Gerar nova versão
          </button>
        </div>
      )}
    </div>
  );
}
