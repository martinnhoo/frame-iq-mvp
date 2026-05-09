/**
 * HubLibrary — Biblioteca interna do Hub.
 *
 * Lista TODOS os assets gerados no Hub (creative_memory com type
 * começando com 'hub_'):
 *   - hub_image     → Imagem
 *   - hub_png       → PNG
 *   - hub_storyboard → Storyboard (agrupado por storyboard_id)
 *   - hub_carousel  → Carrossel (agrupado por carousel_id)
 *
 * Storyboards e carrosséis vêm com várias rows (1 por cena/slide) —
 * a Biblioteca agrupa elas em UM card só, mostrando capa + count.
 *
 * Filtros: período (Hoje / 7d / 30d / Tudo) + tipo (Tudo / Imagem /
 * PNG / Storyboard / Carrossel) + busca por prompt.
 */

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, Layers, Clapperboard, GalleryHorizontal,
  ArrowLeft, Search, Download, X, Sparkles, FolderOpen, Mic, Captions,
  FileText, Copy, Check, Volume2, Trash2, Video as VideoIcon, ScanFace, Play,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "pt" | "en" | "es" | "zh";
type AssetKind = "image" | "png" | "storyboard" | "carousel" | "transcribe" | "voice" | "video" | "faceswap" | "caption";

interface HubAsset {
  id: string;            // group id (memory id pra single, group_id pra storyboard/carousel)
  kind: AssetKind;
  title: string;
  prompt: string;
  cover_url: string;     // capa (primeira imagem do grupo) — vazio pra transcribe/voice
  scene_count?: number;  // pra storyboard/carousel
  scene_thumbs?: string[]; // pra mostrar miniaturas no preview
  aspect_ratio: string;
  created_at: string;
  brand_id?: string;
  // Transcribe-specific
  transcript?: string;
  transcript_language?: string;
  source_filename?: string;
  duration_seconds?: number;
  // Voice-specific
  audio_url?: string;
  voice_name?: string;
  voice_id?: string;
  characters?: number;
  text?: string;
  // Video-specific
  video_url?: string;
  duration_s?: number;
  resolution?: string;
  // Faceswap-specific
  faceswap_mode?: "image" | "video";
  // Caption-specific
  fb_caption?: string;
  tiktok_caption?: string;
  caption_language?: string;
  caption_media_type?: "image" | "video";   // se vídeo, cover é thumbnail
  caption_transcript?: string | null;       // só se vídeo + Whisper sucesso
  caption_video_url?: string;               // só vídeo — MP4 original pra preview
}

const STR: Record<string, Record<Lang, string>> = {
  back:        { pt: "Voltar ao Hub",   en: "Back to Hub",   es: "Volver al Hub",   zh: "返回中心" },
  title:       { pt: "Biblioteca",      en: "Library",       es: "Biblioteca",      zh: "资源库" },
  subtitle:    { pt: "Tudo que foi gerado no Hub", en: "Everything generated in the Hub", es: "Todo lo generado en el Hub", zh: "中心生成的全部内容" },
  searchPh:    { pt: "Buscar por prompt…", en: "Search by prompt…", es: "Buscar por prompt…", zh: "按提示词搜索…" },
  loading:     { pt: "Carregando…",     en: "Loading…",      es: "Cargando…",       zh: "加载中…" },
  emptyTitle:  { pt: "Biblioteca vazia",en: "Library empty", es: "Biblioteca vacía",zh: "资源库为空" },
  emptyDesc:   { pt: "Gere imagens no Hub — elas aparecem aqui automaticamente.",
                 en: "Generate images in the Hub — they appear here automatically.",
                 es: "Genera imágenes en el Hub — aparecen aquí automáticamente.",
                 zh: "在中心生成图像 — 它们会自动出现在这里。" },
  noResult:    { pt: "Nenhum resultado pra essa busca",
                 en: "No results for this search",
                 es: "Sin resultados para esta búsqueda",
                 zh: "此搜索没有结果" },
  noResultDesc:{ pt: "Tenta limpar a busca ou trocar o período.",
                 en: "Try clearing the search or changing the period.",
                 es: "Intenta limpiar la búsqueda o cambiar el período.",
                 zh: "尝试清除搜索或更改时间段。" },
  filterAll:   { pt: "Tudo",       en: "All",       es: "Todo",       zh: "全部" },
  filterImage: { pt: "Imagens",    en: "Images",    es: "Imágenes",   zh: "图像" },
  filterPng:   { pt: "PNGs",       en: "PNGs",      es: "PNGs",       zh: "PNG" },
  filterSb:    { pt: "Storyboards",en: "Storyboards",es: "Storyboards",zh: "故事板" },
  filterCar:   { pt: "Carrosséis", en: "Carousels", es: "Carruseles", zh: "轮播" },
  filterTr:    { pt: "Transcrições",en: "Transcripts",es: "Transcripciones",zh: "转录" },
  filterVo:    { pt: "Vozes",      en: "Voices",     es: "Voces",      zh: "语音" },
  filterVid:   { pt: "Vídeos",     en: "Videos",     es: "Videos",     zh: "视频" },
  filterFs:    { pt: "Face Swap",  en: "Face Swap",  es: "Face Swap",  zh: "换脸" },
  filterCap:   { pt: "Legendas",   en: "Captions",   es: "Captions",   zh: "字幕" },
  vidFor:      { pt: "Vídeo",      en: "Video",      es: "Video",      zh: "视频" },
  fsFor:       { pt: "Face Swap",  en: "Face Swap",  es: "Face Swap",  zh: "换脸" },
  capFor:      { pt: "Legenda",    en: "Caption",    es: "Caption",    zh: "字幕" },
  scenes:      { pt: "cenas",      en: "scenes",    es: "escenas",    zh: "场景" },
  slides:      { pt: "slides",     en: "slides",    es: "slides",     zh: "幻灯片" },
  download:    { pt: "Baixar",     en: "Download",  es: "Descargar",  zh: "下载" },
  downloadAll: { pt: "Baixar todos",en: "Download all", es: "Descargar todos", zh: "下载全部" },
  imageFor:    { pt: "Imagem",     en: "Image",     es: "Imagen",     zh: "图像" },
  pngFor:      { pt: "PNG",        en: "PNG",       es: "PNG",        zh: "PNG" },
  sbFor:       { pt: "Storyboard", en: "Storyboard",es: "Storyboard", zh: "故事板" },
  carFor:      { pt: "Carrossel",  en: "Carousel",  es: "Carrusel",   zh: "轮播" },
  trFor:       { pt: "Transcrição",en: "Transcript",es: "Transcripción",zh: "转录" },
  voFor:       { pt: "Voz",        en: "Voice",     es: "Voz",        zh: "语音" },
  copy:        { pt: "Copiar",     en: "Copy",      es: "Copiar",     zh: "复制" },
  copied:      { pt: "Copiado",    en: "Copied",    es: "Copiado",    zh: "已复制" },
  downloadTxt: { pt: "Baixar .txt",en: "Download .txt",es: "Descargar .txt",zh: "下载 .txt" },
  words:       { pt: "palavras",   en: "words",     es: "palabras",   zh: "字" },
  // Delete UX
  delete:      { pt: "Excluir",    en: "Delete",    es: "Eliminar",   zh: "删除" },
  deleteConfirm: { pt: "Confirmar exclusão", en: "Confirm delete", es: "Confirmar eliminación", zh: "确认删除" },
  deleteHint:  { pt: "Clique de novo pra confirmar", en: "Click again to confirm", es: "Haz click otra vez para confirmar", zh: "再次点击确认" },
  // Multi-select
  select:      { pt: "Selecionar",     en: "Select",       es: "Seleccionar",  zh: "选择" },
  cancel:      { pt: "Cancelar",       en: "Cancel",       es: "Cancelar",     zh: "取消" },
  selectAll:   { pt: "Selecionar todos", en: "Select all", es: "Seleccionar todos", zh: "全选" },
  clearSel:    { pt: "Limpar",         en: "Clear",        es: "Limpiar",      zh: "清除" },
  selectedN:   { pt: "{n} selecionados", en: "{n} selected", es: "{n} seleccionados", zh: "已选 {n}" },
  selectedOne: { pt: "1 selecionado",   en: "1 selected",  es: "1 seleccionado", zh: "已选 1" },
  deleteSel:   { pt: "Excluir selecionados", en: "Delete selected", es: "Eliminar seleccionados", zh: "删除所选" },
  confirmDelN: { pt: "Confirmar excluir {n}?", en: "Confirm delete {n}?", es: "¿Confirmar eliminar {n}?", zh: "确认删除 {n} 项？" },
  deleting:    { pt: "Excluindo…",     en: "Deleting…",    es: "Eliminando…",  zh: "删除中…" },
  // Load more
  loadMore:    { pt: "Carregar mais", en: "Load more", es: "Cargar más", zh: "加载更多" },
  loadingMore: { pt: "Carregando…",   en: "Loading…",  es: "Cargando…",  zh: "加载中..." },
};

const PERIOD_OPTIONS = [
  { id: "today", labelKey: "today" as const, days: 1 },
  { id: "7d",    labelKey: "7d"    as const, days: 7 },
  { id: "30d",   labelKey: "30d"   as const, days: 30 },
  { id: "all",   labelKey: "all"   as const, days: 365 * 5 },
] as const;

const PERIOD_LABELS: Record<string, Record<Lang, string>> = {
  today: { pt: "Hoje",   en: "Today",  es: "Hoy",     zh: "今天" },
  "7d":  { pt: "7 dias", en: "7 days", es: "7 días",  zh: "7 天" },
  "30d": { pt: "30 dias",en: "30 days",es: "30 días", zh: "30 天" },
  all:   { pt: "Tudo",   en: "All",    es: "Todo",    zh: "全部" },
};

type RawRow = {
  id: string;
  kind: string;
  content?: {
    image_url?: string;
    prompt?: string;
    aspect_ratio?: string;
    brand_id?: string;
    storyboard_id?: string;
    carousel_id?: string;
    scene_n?: number;
    slide_n?: number;
    scene_count?: number;
    slide_count?: number;
    // Transcribe-specific
    transcript?: string;
    translated_text?: string;
    translation_target?: string;
    language?: string;
    source_filename?: string;
    duration?: number;
    // Voice-specific
    audio_url?: string;
    text?: string;
    voice_id?: string;
    voice_name?: string;
    characters?: number;
    // Video-specific
    video_url?: string;
    duration_s?: number;
    resolution?: string;
    // Faceswap-specific
    output_url?: string;
    mode?: "image" | "video";
    swap_image_url?: string;
    target_url?: string;
    task_id?: string;
    model?: string;
    // Caption-specific (reusa transcript + video_url já declarados acima)
    fb_caption?: string;
    tiktok_caption?: string;
    media_type?: "image" | "video";
  };
  created_at: string;
};

export default function HubLibrary() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [assets, setAssets] = useState<HubAsset[]>([]);
  // initialLoading = primeira vez que abre. firstLoadDone fica true após
  // a primeira query terminar — usado pra mostrar skeleton só na primeira
  // carga (não a cada mudança de filter, que mantém grid estável).
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  // Default 'today' — abertura rápida, user filtra pra outros períodos
  // se quiser histórico maior.
  const [period, setPeriod] = useState<string>("today");
  const [kindFilter, setKindFilter] = useState<"all" | AssetKind>("all");
  // searchInput = state imediato do <input> (UI responsiva).
  // search = state debounced que dispara o filtering pesado.
  // Evita refilter a cada keystroke quando há 60+ cards.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [previewAsset, setPreviewAsset] = useState<HubAsset | null>(null);
  // Paginação — antes carregava 500 rows com data URLs embebidas (~1GB).
  // Agora carrega 60 inicial + "Carregar mais" pra adicionar 60 por vez.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 60;

  // ── Multi-seleção ─────────────────────────────────────────────────
  // Modo de seleção: quando ON, click no card alterna seleção em vez
  // de abrir preview. Action bar no topo mostra count + ações batch.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkConfirming(false);
  };

  // Deleta asset(s) e atualiza lista localmente.
  // Storyboard/carousel: deleta TODAS as rows com mesmo group_id.
  // Outros: deleta a row única.
  const deleteAsset = async (asset: HubAsset) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (asset.kind === "storyboard" || asset.kind === "carousel") {
        const fieldName = asset.kind === "storyboard" ? "storyboard_id" : "carousel_id";
        const { error } = await supabase
          .from("hub_assets")
          .delete()
          .eq("user_id", user.id)
          .eq(`content->>${fieldName}` as never, asset.id as never);
        if (error) {
          console.error("[hub-library] delete group error:", error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from("hub_assets")
          .delete()
          .eq("id", asset.id)
          .eq("user_id", user.id);
        if (error) {
          console.error("[hub-library] delete error:", error.message);
          return;
        }
      }
      // Remove da UI
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
    } catch (e) {
      console.error("[hub-library] delete exception:", e);
    }
  };

  // Bulk delete — itera pelos selecionados e usa a mesma lógica do
  // deleteAsset (single ou group). Atualiza UI uma vez no fim pra
  // evitar N re-renders. Falhas individuais são logadas mas não param.
  const deleteSelected = async () => {
    if (bulkDeleting || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const idsToDelete = Array.from(selectedIds);
      const successIds: string[] = [];

      for (const id of idsToDelete) {
        const asset = assets.find(a => a.id === id);
        if (!asset) continue;

        try {
          if (asset.kind === "storyboard" || asset.kind === "carousel") {
            const fieldName = asset.kind === "storyboard" ? "storyboard_id" : "carousel_id";
            const { error } = await supabase
              .from("hub_assets")
              .delete()
              .eq("user_id", user.id)
              .eq(`content->>${fieldName}` as never, asset.id as never);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase
              .from("hub_assets")
              .delete()
              .eq("id", asset.id)
              .eq("user_id", user.id);
            if (error) throw new Error(error.message);
          }
          successIds.push(id);
        } catch (e) {
          console.error(`[hub-library] bulk delete failed for ${id}:`, e);
        }
      }

      // Update UI: remove os deletados de uma vez
      const successSet = new Set(successIds);
      setAssets(prev => prev.filter(a => !successSet.has(a.id)));
      if (previewAsset && successSet.has(previewAsset.id)) setPreviewAsset(null);
      exitSelectionMode();
    } catch (e) {
      console.error("[hub-library] bulk delete exception:", e);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Transforma rows do DB → HubAsset[] (com agrupamento de storyboard/carousel).
  // Agora aceita um Map existente pra mergear (usado pelo "Carregar mais"
  // sem re-processar tudo).
  const rowsToAssets = (rows: RawRow[], existing?: Map<string, HubAsset>): HubAsset[] => {
    const groupedMap = existing || new Map<string, HubAsset>();
    for (const r of rows) {
          const c = r.content || {};

          // Voice — sem image_url, mas tem audio_url
          if (r.kind === "hub_voice") {
            const audio = (c.audio_url || "").trim();
            if (!audio) continue;
            groupedMap.set(r.id, {
              id: r.id,
              kind: "voice",
              title: c.voice_name ? `${c.voice_name}` : (c.text || "").slice(0, 60),
              prompt: (c.text || "").slice(0, 300),
              cover_url: "",
              aspect_ratio: "1:1",
              created_at: r.created_at,
              audio_url: audio,
              voice_name: c.voice_name,
              voice_id: c.voice_id,
              characters: c.characters,
              text: c.text,
            });
            continue;
          }

          // Transcribe — sem image_url, mas tem transcript text
          if (r.kind === "hub_transcribe") {
            const transcript = (c.transcript || "").trim();
            if (!transcript) continue;
            const previewTitle = c.source_filename
              ? c.source_filename.replace(/\.[^/.]+$/, "").slice(0, 80)
              : transcript.slice(0, 80);
            groupedMap.set(r.id, {
              id: r.id,
              kind: "transcribe",
              title: previewTitle,
              prompt: transcript.slice(0, 300),
              cover_url: "", // sem cover
              aspect_ratio: "1:1",
              created_at: r.created_at,
              transcript,
              transcript_language: c.language,
              source_filename: c.source_filename,
              duration_seconds: c.duration,
            });
            continue;
          }

          // Video — sem image_url, mas tem video_url. Cover é placeholder.
          if (r.kind === "hub_video") {
            const videoUrl = (c.video_url || "").trim();
            if (!videoUrl) continue;
            groupedMap.set(r.id, {
              id: r.id,
              kind: "video",
              title: (c.prompt || "").slice(0, 80),
              prompt: c.prompt || "",
              cover_url: c.image_url || "", // image source se for image-to-video, senão vazio
              aspect_ratio: c.aspect_ratio || "16:9",
              created_at: r.created_at,
              brand_id: c.brand_id,
              video_url: videoUrl,
              duration_s: c.duration_s,
              resolution: c.resolution,
            });
            continue;
          }

          // Caption — gerador de legendas TikTok+FB. Tem image_url da imagem
          // analisada + 2 captions no content. cover_url = image_url.
          if (r.kind === "hub_caption") {
            const url = (c.image_url || "").trim();
            const fb = (c.fb_caption as string) || "";
            const tiktok = (c.tiktok_caption as string) || "";
            if (!url || (!fb && !tiktok)) continue;
            const mediaType = (c.media_type === "video" ? "video" : "image") as "image" | "video";
            groupedMap.set(r.id, {
              id: r.id,
              kind: "caption",
              title: tiktok.slice(0, 80) || fb.split("\n")[0]?.slice(0, 80) || "Legenda",
              prompt: tiktok || fb,
              cover_url: url,
              aspect_ratio: "1:1",
              created_at: r.created_at,
              brand_id: c.brand_id,
              fb_caption: fb,
              tiktok_caption: tiktok,
              caption_language: c.language as string | undefined,
              caption_media_type: mediaType,
              caption_transcript: (c.transcript as string | null | undefined) ?? null,
              caption_video_url: (c.video_url as string | undefined) || undefined,
            });
            continue;
          }

          // Faceswap — pode ser imagem ou vídeo (depende do mode).
          // output_url é o resultado final, swap_image_url + target_url são inputs.
          if (r.kind === "hub_faceswap") {
            const outUrl = (c.output_url || c.image_url || c.video_url || "").trim();
            if (!outUrl) continue;
            const fsMode = (c.mode === "video" ? "video" : "image") as "image" | "video";
            groupedMap.set(r.id, {
              id: r.id,
              kind: "faceswap",
              title: fsMode === "video" ? "Face swap (vídeo)" : "Face swap (imagem)",
              prompt: "",
              cover_url: fsMode === "image" ? outUrl : (c.swap_image_url || ""),
              aspect_ratio: "1:1",
              created_at: r.created_at,
              brand_id: c.brand_id,
              faceswap_mode: fsMode,
              // Pra Library reaproveitar o player de vídeo:
              ...(fsMode === "video" ? { video_url: outUrl } : {}),
            });
            continue;
          }

          const url = c.image_url;
          if (!url) continue;

          let kind: AssetKind = "image";
          if (r.kind === "hub_png") kind = "png";
          else if (r.kind === "hub_storyboard") kind = "storyboard";
          else if (r.kind === "hub_carousel") kind = "carousel";

          if (kind === "storyboard" || kind === "carousel") {
            const groupKey = (kind === "storyboard" ? c.storyboard_id : c.carousel_id) || r.id;
            const sceneN = (kind === "storyboard" ? c.scene_n : c.slide_n) || 1;
            const expected = (kind === "storyboard" ? c.scene_count : c.slide_count) || 1;
            const existing = groupedMap.get(groupKey);
            if (existing) {
              existing.scene_count = Math.max(existing.scene_count || 1, expected);
              existing.scene_thumbs = [...(existing.scene_thumbs || []), url].slice(0, 4);
              if (sceneN === 1) existing.cover_url = url; // prioriza scene 1 como capa
            } else {
              groupedMap.set(groupKey, {
                id: groupKey,
                kind,
                title: (c.prompt || "").slice(0, 80),
                prompt: c.prompt || "",
                cover_url: url,
                scene_count: expected,
                scene_thumbs: [url],
                aspect_ratio: c.aspect_ratio || "1:1",
                created_at: r.created_at,
                brand_id: c.brand_id,
              });
            }
          } else {
            // image/png — row solta
            groupedMap.set(r.id, {
              id: r.id,
              kind,
              title: (c.prompt || "").slice(0, 80),
              prompt: c.prompt || "",
              cover_url: url,
              aspect_ratio: c.aspect_ratio || "1:1",
              created_at: r.created_at,
              brand_id: c.brand_id,
            });
          }
        }

    return Array.from(groupedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  };

  // Cache do Map agrupado pra suportar "Carregar mais" sem re-processar
  // os assets já carregados.
  const groupedRef = useRef<Map<string, HubAsset>>(new Map());

  // Initial load + reload quando period muda. Estratégia:
  //   - Primeira carga: initialLoading=true → skeleton cards
  //   - Mudança de filter: refetching=true (overlay sutil), grid antigo
  //     fica visível até nova data chegar — sem flash branco
  useEffect(() => {
    let mounted = true;
    const isFirst = initialLoading;
    if (!isFirst) setRefetching(true);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) { setAssets([]); setInitialLoading(false); setRefetching(false); }
          return;
        }

        const days = PERIOD_OPTIONS.find(p => p.id === period)!.days;
        const since = new Date(Date.now() - days * 86_400_000).toISOString();

        // Reset cache pra evitar misturar resultados de períodos diferentes
        groupedRef.current = new Map();

        const { data } = await supabase.from("hub_assets" as never)
          .select("id, kind, content, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE + 1); // +1 pra detectar se há mais
        if (!mounted) return;

        const rows = (data || []) as RawRow[];
        const moreAvailable = rows.length > PAGE_SIZE;
        const visibleRows = moreAvailable ? rows.slice(0, PAGE_SIZE) : rows;
        setAssets(rowsToAssets(visibleRows, groupedRef.current));
        setHasMore(moreAvailable);
      } catch (e) {
        console.error("[hub-library] load error:", e);
        if (mounted) setAssets([]);
      } finally {
        if (mounted) {
          setInitialLoading(false);
          setRefetching(false);
        }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Load more — busca o próximo PAGE_SIZE com offset pelo created_at do
  // último asset já carregado. Usa created_at do raw row (não do agrupado)
  // pra paginar corretamente. Como agrupados podem ter created_at do PRIMEIRO
  // row do grupo, usamos o último created_at como cutoff.
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const days = PERIOD_OPTIONS.find(p => p.id === period)!.days;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();

      // Pega created_at do último asset visível como cutoff
      const lastAsset = assets[assets.length - 1];
      if (!lastAsset) return;

      const { data } = await supabase.from("hub_assets" as never)
        .select("id, kind, content, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .lt("created_at", lastAsset.created_at)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);

      const rows = (data || []) as RawRow[];
      const moreAvailable = rows.length > PAGE_SIZE;
      const visibleRows = moreAvailable ? rows.slice(0, PAGE_SIZE) : rows;
      // Mergea no Map existente (evita duplicar storyboards já carregados)
      setAssets(rowsToAssets(visibleRows, groupedRef.current));
      setHasMore(moreAvailable);
    } catch (e) {
      console.error("[hub-library] load more error:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    let out = assets;
    if (kindFilter !== "all") out = out.filter(a => a.kind === kindFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(a => a.title.toLowerCase().includes(q) || a.prompt.toLowerCase().includes(q));
    }
    return out;
  }, [assets, kindFilter, search]);

  const counts = useMemo(() => {
    const c = { all: assets.length, image: 0, png: 0, storyboard: 0, carousel: 0, transcribe: 0, voice: 0, video: 0, faceswap: 0, caption: 0 };
    for (const a of assets) c[a.kind]++;
    return c;
  }, [assets]);

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>
      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1480, margin: "0 auto", color: "#fff" }}>
        <button
          onClick={() => navigate("/dashboard/hub")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: "#9CA3AF",
            cursor: "pointer", fontSize: 13, padding: "6px 8px", marginBottom: 16,
            fontFamily: "inherit",
          }}>
          <ArrowLeft size={14} /> {t("back")}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "rgba(59,130,246,0.14)",
            border: "1px solid rgba(59,130,246,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FolderOpen size={20} style={{ color: "#3B82F6" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>{t("title")}</h1>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "2px 0 0" }}>
              {t("subtitle")} · {filtered.length} de {assets.length}
            </p>
          </div>
        </div>

        {/* Search + period + kind filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder={t("searchPh")}
              style={{
                width: "100%", padding: "10px 14px 10px 36px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, color: "#fff", fontSize: 13, outline: "none",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.id} onClick={() => setPeriod(p.id)}
                style={{
                  padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                  background: period === p.id ? "#3B82F6" : "transparent",
                  color: period === p.id ? "#fff" : "#9CA3AF",
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>
                {PERIOD_LABELS[p.id]?.[lang] || p.id}
              </button>
            ))}
          </div>
          {/* Selecionar — toggle do modo de seleção múltipla */}
          {!selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 9,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#D1D5DB",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}>
              <Check size={13} style={{ color: "#3B82F6" }} />
              {t("select")}
            </button>
          )}
        </div>

        {/* Action bar — só aparece em modo seleção. Mostra count, botão de
            selecionar todos visíveis, excluir (com confirm 2-step) e cancelar. */}
        {selectionMode && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: 14, padding: "10px 14px",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.30)",
            borderRadius: 10,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {selectedIds.size === 0
                ? t("select")
                : selectedIds.size === 1
                  ? t("selectedOne")
                  : t("selectedN").replace("{n}", String(selectedIds.size))}
            </span>
            <div style={{ flex: 1 }} />
            {/* Selecionar todos visíveis (respeita filtro atual) */}
            <button
              onClick={() => {
                const allVisible = filtered.map(a => a.id);
                const allSelected = allVisible.every(id => selectedIds.has(id));
                if (allSelected) clearSelection();
                else setSelectedIds(new Set(allVisible));
              }}
              disabled={bulkDeleting}
              style={{
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: bulkDeleting ? "wait" : "pointer", fontFamily: "inherit",
              }}>
              {filtered.length > 0 && filtered.every(a => selectedIds.has(a.id))
                ? t("clearSel")
                : t("selectAll")}
            </button>
            {/* Excluir — 2-step: 1º click vira vermelho com texto de confirm */}
            <button
              onClick={() => {
                if (selectedIds.size === 0) return;
                if (!bulkConfirming) {
                  setBulkConfirming(true);
                  setTimeout(() => setBulkConfirming(false), 4000);
                  return;
                }
                deleteSelected();
              }}
              disabled={selectedIds.size === 0 || bulkDeleting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 8,
                background: selectedIds.size === 0
                  ? "rgba(239,68,68,0.15)"
                  : bulkConfirming ? "#DC2626" : "rgba(239,68,68,0.20)",
                border: `1px solid ${selectedIds.size === 0 ? "rgba(239,68,68,0.20)" : bulkConfirming ? "#EF4444" : "rgba(239,68,68,0.40)"}`,
                color: selectedIds.size === 0 ? "rgba(252,165,165,0.40)" : "#FCA5A5",
                fontSize: 12, fontWeight: 700,
                cursor: selectedIds.size === 0 || bulkDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: selectedIds.size === 0 ? 0.5 : 1,
              }}>
              {bulkDeleting ? <Trash2 size={12} /> : bulkConfirming ? <Check size={12} color="#fff" /> : <Trash2 size={12} />}
              {bulkDeleting
                ? t("deleting")
                : bulkConfirming && selectedIds.size > 0
                  ? <span style={{ color: "#fff" }}>{t("confirmDelN").replace("{n}", String(selectedIds.size))}</span>
                  : t("deleteSel")}
            </button>
            {/* Cancelar — sai do modo seleção */}
            <button
              onClick={exitSelectionMode}
              disabled={bulkDeleting}
              style={{
                padding: "6px 12px", borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#9CA3AF", fontSize: 12, fontWeight: 600,
                cursor: bulkDeleting ? "wait" : "pointer", fontFamily: "inherit",
              }}>
              {t("cancel")}
            </button>
          </div>
        )}

        {/* Kind filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
          <KindChip
            active={kindFilter === "all"} count={counts.all}
            label={t("filterAll")}
            onClick={() => setKindFilter("all")}
          />
          <KindChip
            active={kindFilter === "image"} count={counts.image}
            label={t("filterImage")} icon={ImageIcon}
            onClick={() => setKindFilter("image")}
          />
          <KindChip
            active={kindFilter === "png"} count={counts.png}
            label={t("filterPng")} icon={Layers}
            onClick={() => setKindFilter("png")}
          />
          <KindChip
            active={kindFilter === "storyboard"} count={counts.storyboard}
            label={t("filterSb")} icon={Clapperboard}
            onClick={() => setKindFilter("storyboard")}
          />
          <KindChip
            active={kindFilter === "carousel"} count={counts.carousel}
            label={t("filterCar")} icon={GalleryHorizontal}
            onClick={() => setKindFilter("carousel")}
          />
          <KindChip
            active={kindFilter === "transcribe"} count={counts.transcribe}
            label={t("filterTr")} icon={Captions}
            onClick={() => setKindFilter("transcribe")}
          />
          <KindChip
            active={kindFilter === "voice"} count={counts.voice}
            label={t("filterVo")} icon={Mic}
            onClick={() => setKindFilter("voice")}
          />
          <KindChip
            active={kindFilter === "video"} count={counts.video}
            label={t("filterVid")} icon={VideoIcon}
            onClick={() => setKindFilter("video")}
          />
          <KindChip
            active={kindFilter === "faceswap"} count={counts.faceswap}
            label={t("filterFs")} icon={ScanFace}
            onClick={() => setKindFilter("faceswap")}
          />
          <KindChip
            active={kindFilter === "caption"} count={counts.caption}
            label={t("filterCap")} icon={Captions}
            onClick={() => setKindFilter("caption")}
          />
        </div>

        {initialLoading ? (
          // Skeleton grid: matches real grid layout pra evitar reflow
          // quando os assets reais chegam.
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={assets.length === 0 ? t("emptyTitle") : t("noResult")}
            desc={assets.length === 0 ? t("emptyDesc") : t("noResultDesc")}
          />
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              // Durante refetching, leve dim no grid antigo até nova data
              // chegar — sinaliza atividade sem destruir layout
              opacity: refetching ? 0.55 : 1,
              transition: "opacity 0.15s",
              pointerEvents: refetching ? "none" : "auto",
            }}>
              {filtered.map(asset => (
                <AssetCard
                  key={asset.id} asset={asset} lang={lang} t={t}
                  onClick={() => {
                    if (selectionMode) toggleSelection(asset.id);
                    else setPreviewAsset(asset);
                  }}
                  onDelete={() => deleteAsset(asset)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(asset.id)}
                />
              ))}
            </div>
            {/* Load more — só aparece se houver mais rows e o filtro não
                tiver cortado tudo (filtered considera kindFilter+search). */}
            {hasMore && filtered.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    padding: "10px 22px",
                    background: loadingMore ? "rgba(59,130,246,0.10)" : "rgba(59,130,246,0.15)",
                    border: "1px solid rgba(59,130,246,0.40)",
                    borderRadius: 9,
                    color: "#fff",
                    fontSize: 13, fontWeight: 600,
                    cursor: loadingMore ? "wait" : "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}

        {previewAsset && (
          <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} lang={lang} t={t} />
        )}
      </div>
    </>
  );
}

// ── KindChip ────────────────────────────────────────────────────────────────
function KindChip({ active, count, label, icon: Icon, onClick }: {
  active: boolean; count: number; label: string;
  icon?: typeof ImageIcon; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 9,
        background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(59,130,246,0.40)" : "rgba(255,255,255,0.06)"}`,
        color: active ? "#fff" : "#D1D5DB",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit",
      }}>
      {Icon && <Icon size={13} style={{ color: active ? "#3B82F6" : "#9CA3AF" }} />}
      <span>{label}</span>
      <span style={{ fontSize: 11, color: active ? "#3B82F6" : "#6B7280", fontWeight: 700 }}>{count}</span>
    </button>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────────────────
// Mesmo footprint visual do AssetCard. Usado durante initial loading pra
// reservar layout — evita flash branco e reflow quando assets reais chegam.
function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(17,24,39,0.50)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        width: "100%", aspectRatio: "1/1",
        background: "linear-gradient(110deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 70%)",
        backgroundSize: "200% 100%",
        animation: "skeletonShimmer 1.4s ease-in-out infinite",
      }} />
      <div style={{ padding: "10px 12px" }}>
        <div style={{
          width: "72%", height: 10, borderRadius: 4,
          background: "rgba(255,255,255,0.08)",
          marginBottom: 6,
        }} />
        <div style={{
          width: "40%", height: 8, borderRadius: 4,
          background: "rgba(255,255,255,0.05)",
        }} />
      </div>
      <style>{`@keyframes skeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

// ── AssetCard ──────────────────────────────────────────────────────────────
// Wrappado em memo: re-render só se props mudarem (asset reference,
// selectionMode, selected). Evita re-render dos 60 cards a cada keystroke
// do search — só o `filtered` array muda, mas cada AssetCard individual
// continua o mesmo objeto, então memo barra o re-render.
function AssetCardImpl({ asset, lang, t, onClick, onDelete, selectionMode, selected }: {
  asset: HubAsset; lang: Lang;
  t: (key: keyof typeof STR) => string;
  onClick: () => void;
  onDelete: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Delete handler: 2-step confirm. 1º click muda pro estado vermelho com
  // ✓; 2º click executa. Auto-reset após 3s sem clicar.
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    onDelete();
  };
  const KindIcon = asset.kind === "png" ? Layers
    : asset.kind === "storyboard" ? Clapperboard
    : asset.kind === "carousel" ? GalleryHorizontal
    : asset.kind === "transcribe" ? Captions
    : asset.kind === "voice" ? Mic
    : asset.kind === "video" ? VideoIcon
    : asset.kind === "faceswap" ? ScanFace
    : asset.kind === "caption" ? Captions
    : ImageIcon;
  const kindLabel = asset.kind === "png" ? t("pngFor")
    : asset.kind === "storyboard" ? t("sbFor")
    : asset.kind === "carousel" ? t("carFor")
    : asset.kind === "transcribe" ? t("trFor")
    : asset.kind === "voice" ? t("voFor")
    : asset.kind === "video" ? t("vidFor")
    : asset.kind === "faceswap" ? t("fsFor")
    : asset.kind === "caption" ? t("capFor")
    : t("imageFor");
  const isGroup = asset.kind === "storyboard" || asset.kind === "carousel";
  const isTranscribe = asset.kind === "transcribe";
  const isVoice = asset.kind === "voice";
  // faceswap em modo vídeo usa o mesmo player de vídeo
  const isVideo = asset.kind === "video" || (asset.kind === "faceswap" && asset.faceswap_mode === "video");
  const countLabel = asset.kind === "storyboard" ? t("scenes") : t("slides");
  const wordCount = isTranscribe ? (asset.transcript || "").trim().split(/\s+/).filter(Boolean).length : 0;

  // Em modo seleção, card mostra borda azul forte quando selecionado
  // (efeito visual destaca seleção mesmo após mouse leave).
  const baseBorder = selected ? "rgba(59,130,246,0.70)" : "rgba(255,255,255,0.06)";
  const baseBg = selected ? "rgba(59,130,246,0.10)" : "rgba(17,24,39,0.50)";

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        borderRadius: 12, overflow: "hidden",
        cursor: "pointer", color: "inherit", fontFamily: "inherit",
        display: "flex", flexDirection: "column",
        transition: "transform 0.15s, border-color 0.15s, background 0.15s",
        padding: 0,
        boxShadow: selected ? "0 0 0 2px rgba(59,130,246,0.25)" : "none",
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = selected
          ? "rgba(59,130,246,0.85)"
          : "rgba(59,130,246,0.40)";
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setConfirming(false);
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = baseBorder;
      }}
    >
      <div style={{ position: "relative" }}>
        {isTranscribe ? (
          // Transcribe — sem imagem, mostra área cinza com ícone + preview de texto
          <div style={{
            width: "100%", aspectRatio: "1/1",
            background: "linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.02))",
            display: "flex", flexDirection: "column",
            padding: "32px 16px 18px",
            position: "relative",
          }}>
            <FileText size={28} style={{ color: "rgba(59,130,246,0.50)", marginBottom: 12 }} />
            <p style={{
              fontSize: 11.5, color: "#D1D5DB", lineHeight: 1.5, margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 7,
              WebkitBoxOrient: "vertical",
              fontStyle: "italic",
            }}>
              "{(asset.transcript || "").slice(0, 240)}{(asset.transcript || "").length > 240 ? "…" : ""}"
            </p>
          </div>
        ) : isVoice ? (
          // Voice — mostra ícone de áudio + preview do texto + voz usada
          <div style={{
            width: "100%", aspectRatio: "1/1",
            background: "linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.02))",
            display: "flex", flexDirection: "column",
            padding: "20px 16px 18px",
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Volume2 size={16} style={{ color: "#3B82F6" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {asset.voice_name || "—"}
                </p>
                <p style={{ fontSize: 10, color: "#9CA3AF", margin: "1px 0 0", fontWeight: 600 }}>
                  {asset.characters || 0} {lang === "pt" ? "chars" : lang === "en" ? "chars" : lang === "es" ? "chars" : "字"}
                </p>
              </div>
            </div>
            <p style={{
              fontSize: 11, color: "#D1D5DB", lineHeight: 1.5, margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              fontStyle: "italic",
            }}>
              "{(asset.text || "").slice(0, 200)}{(asset.text || "").length > 200 ? "…" : ""}"
            </p>
          </div>
        ) : isVideo ? (
          // Video — mostra <video> direto, hover preview
          <video
            src={asset.video_url}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              aspectRatio: asset.aspect_ratio === "9:16" ? "9/16"
                : asset.aspect_ratio === "1:1" ? "1/1"
                : "16/9",
              objectFit: "cover", display: "block",
              background: "#000",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
            onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        ) : (
          <img
            src={asset.cover_url} alt={asset.title}
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              aspectRatio: asset.aspect_ratio === "9:16" || asset.aspect_ratio === "1024x1536" ? "9/16"
                : asset.aspect_ratio === "16:9" || asset.aspect_ratio === "1536x1024" ? "16/9"
                : "1/1",
              objectFit: "cover", display: "block",
            }}
          />
        )}
        {/* Type badge top-left */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "#fff",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <KindIcon size={10} style={{ color: "#3B82F6" }} />
          {kindLabel}
          {isGroup && asset.scene_count && asset.scene_count > 1 && (
            <span style={{ color: "#3B82F6", marginLeft: 2 }}>· {asset.scene_count}</span>
          )}
        </div>
        {/* Badge "🎬 VIDEO" no canto inferior direito quando caption veio de
            vídeo. Sem Play overlay porque o MP4 foi apagado pós-Whisper —
            só o frame thumbnail sobrevive. */}
        {asset.kind === "caption" && asset.caption_media_type === "video" && (
          <div style={{
            position: "absolute", bottom: 8, right: 8,
            padding: "3px 7px", borderRadius: 5,
            background: "rgba(167,139,250,0.90)", backdropFilter: "blur(6px)",
            color: "#0a0a0f", fontSize: 9.5, fontWeight: 800,
            letterSpacing: "0.05em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>🎬 Video</div>
        )}
        {/* Top-right corner: checkbox em modo seleção, delete button caso contrário */}
        {selectionMode ? (
          <div
            aria-label={selected ? t("clearSel") : t("select")}
            style={{
              position: "absolute", top: 8, right: 8,
              width: 24, height: 24, borderRadius: 7,
              background: selected ? "#3B82F6" : "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              border: selected
                ? "1px solid #60A5FA"
                : "1px solid rgba(255,255,255,0.30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            {selected && <Check size={14} color="#fff" strokeWidth={3} />}
          </div>
        ) : (
          <div
            onClick={handleDelete}
            role="button"
            tabIndex={-1}
            aria-label={confirming ? t("deleteConfirm") : t("delete")}
            title={confirming ? t("deleteHint") : t("delete")}
            style={{
              position: "absolute", top: 8, right: 8,
              width: 28, height: 28, borderRadius: 7,
              background: confirming ? "#DC2626" : "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
              border: confirming ? "1px solid #EF4444" : "1px solid rgba(255,255,255,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              opacity: hovered || confirming ? 1 : 0,
              transition: "opacity 0.15s, background 0.15s, border-color 0.15s",
              zIndex: 2,
            }}
          >
            {confirming
              ? <Check size={14} color="#fff" strokeWidth={2.5} />
              : <Trash2 size={13} color="#FCA5A5" />}
          </div>
        )}
        {/* Group thumbnails preview (storyboard/carousel) */}
        {isGroup && asset.scene_thumbs && asset.scene_thumbs.length > 1 && (
          <div style={{
            position: "absolute", bottom: 8, left: 8, right: 8,
            display: "flex", gap: 4,
          }}>
            {asset.scene_thumbs.slice(0, 4).map((src, i) => (
              <div key={i} style={{
                flex: 1, aspectRatio: "1/1",
                borderRadius: 4, overflow: "hidden",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.20)",
              }}>
                <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{asset.title || "—"}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#9CA3AF", marginTop: 4 }}>
          <span>{relativeDate(asset.created_at, lang)}</span>
          {isGroup && asset.scene_count && (
            <>
              <span>·</span>
              <span>{asset.scene_count} {countLabel}</span>
            </>
          )}
          {isTranscribe && wordCount > 0 && (
            <>
              <span>·</span>
              <span>{wordCount} {t("words")}</span>
            </>
          )}
          {isVoice && asset.characters && asset.characters > 0 && (
            <>
              <span>·</span>
              <span>{asset.characters} chars</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// memo barra re-render quando props relevantes não mudaram. Search/filter
// no parent não dispara re-render dos cards visíveis (apenas re-monta o
// array filtrado).
const AssetCard = memo(AssetCardImpl, (prev, next) => {
  return prev.asset === next.asset
    && prev.selectionMode === next.selectionMode
    && prev.selected === next.selected
    && prev.lang === next.lang;
});

// ── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.10)",
      borderRadius: 16,
    }}>
      <Sparkles size={32} style={{ color: "rgba(255,255,255,0.30)", marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontSize: 12, color: "#D1D5DB", margin: 0 }}>{desc}</p>
    </div>
  );
}

// ── PreviewModal ────────────────────────────────────────────────────────────
function PreviewModal({ asset, onClose, lang, t }: {
  asset: HubAsset; onClose: () => void; lang: Lang;
  t: (key: keyof typeof STR) => string;
}) {
  const [groupItems, setGroupItems] = useState<{ url: string; n: number }[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isGroup = asset.kind === "storyboard" || asset.kind === "carousel";
  const isTranscribe = asset.kind === "transcribe";
  const isVoice = asset.kind === "voice";
  const isCaption = asset.kind === "caption";
  const isCaptionVideo = isCaption && asset.caption_media_type === "video";

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!isGroup) return;
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const groupField = asset.kind === "storyboard" ? "storyboard_id" : "carousel_id";
        const sceneField = asset.kind === "storyboard" ? "scene_n" : "slide_n";
        const { data } = await supabase.from("hub_assets" as never)
          .select("content")
          .eq("user_id", user.id)
          .eq("kind", asset.kind === "storyboard" ? "hub_storyboard" : "hub_carousel")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!mounted || !data) return;
        const items = (data as Array<{ content?: Record<string, unknown> }>)
          .filter(r => (r.content?.[groupField] as string) === asset.id)
          .map(r => ({
            url: (r.content?.image_url as string) || "",
            n: (r.content?.[sceneField] as number) || 1,
          }))
          .filter(x => x.url)
          .sort((a, b) => a.n - b.n);
        setGroupItems(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, [asset.id, asset.kind, isGroup]);

  const downloadOne = async (url: string, name: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {}
  };

  const downloadAll = async () => {
    if (groupItems.length === 0) return;
    const prefix = asset.kind === "storyboard" ? "storyboard" : "carousel";
    for (const it of groupItems) {
      await downloadOne(it.url, `${prefix}-${asset.id.slice(0, 8)}-${String(it.n).padStart(2, "0")}.png`);
      await new Promise(res => setTimeout(res, 250));
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20, backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#0a0a0f",
        border: "1px solid rgba(59,130,246,0.30)",
        borderRadius: 16,
        maxWidth: 1100, width: "100%",
        maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {asset.kind === "png" ? t("pngFor")
                : asset.kind === "storyboard" ? t("sbFor")
                : asset.kind === "carousel" ? t("carFor")
                : asset.kind === "transcribe" ? t("trFor")
                : asset.kind === "voice" ? t("voFor")
                : t("imageFor")}
            </span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {relativeDate(asset.created_at, lang)}</span>
            {isGroup && groupItems.length > 0 && (
              <button onClick={downloadAll} style={{
                marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 7,
                background: "#3B82F6", color: "#fff",
                border: "none", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit",
              }}>
                <Download size={11} /> {t("downloadAll")}
              </button>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "none",
            borderRadius: 7, padding: 6, cursor: "pointer",
            color: "#9CA3AF", display: "flex",
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {isVoice ? (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", fontSize: 11.5, color: "#9CA3AF" }}>
                {asset.voice_name && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#3B82F6", fontWeight: 700 }}>
                    <Volume2 size={12} /> {asset.voice_name}
                  </span>
                )}
                {asset.characters !== undefined && (
                  <span>{asset.characters} chars</span>
                )}
              </div>
              {asset.audio_url && (
                <audio
                  src={asset.audio_url}
                  controls
                  style={{
                    width: "100%", marginBottom: 14, height: 40,
                    colorScheme: "dark",
                  }}
                />
              )}
              {asset.text && (
                <div style={{
                  fontSize: 13, color: "#E5E7EB", lineHeight: 1.6,
                  padding: "14px 16px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, maxHeight: "40vh", overflow: "auto",
                  whiteSpace: "pre-wrap", marginBottom: 14,
                  fontStyle: "italic",
                }}>
                  "{asset.text}"
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    if (!asset.audio_url) return;
                    const a = document.createElement("a");
                    a.href = asset.audio_url;
                    a.download = `voice-${(asset.voice_name || "voice").toLowerCase()}-${asset.id.slice(0, 8)}.mp3`;
                    document.body.appendChild(a); a.click(); a.remove();
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 9,
                    background: "#3B82F6", color: "#fff",
                    border: "none", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <Download size={14} /> {t("download")}
                </button>
                {asset.text && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(asset.text || "").then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }).catch(() => {});
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "9px 14px", borderRadius: 9,
                      background: copied ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.10)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {copied ? <><Check size={14} /> {t("copied")}</> : <><Copy size={14} /> {t("copy")}</>}
                  </button>
                )}
              </div>
            </>
          ) : isTranscribe ? (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", fontSize: 11.5, color: "#9CA3AF" }}>
                {asset.source_filename && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <FileText size={12} /> {asset.source_filename}
                  </span>
                )}
                {asset.transcript_language && (
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "#3B82F6" }}>
                    {asset.transcript_language}
                  </span>
                )}
                {typeof asset.duration_seconds === "number" && asset.duration_seconds > 0 && (
                  <span>{formatDuration(asset.duration_seconds)}</span>
                )}
                <span>{(asset.transcript || "").trim().split(/\s+/).filter(Boolean).length} {t("words")}</span>
              </div>
              <div style={{
                fontSize: 13.5, color: "#E5E7EB", lineHeight: 1.7,
                padding: "16px 18px", background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, maxHeight: "55vh", overflow: "auto",
                whiteSpace: "pre-wrap", marginBottom: 16,
                fontFamily: "inherit",
              }}>
                {asset.transcript || "—"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(asset.transcript || "").then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }).catch(() => {});
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 9,
                    background: copied ? "rgba(34,197,94,0.20)" : "#3B82F6",
                    color: "#fff", border: "none", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {copied ? <><Check size={14} /> {t("copied")}</> : <><Copy size={14} /> {t("copy")}</>}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([asset.transcript || ""], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const base = asset.source_filename
                      ? asset.source_filename.replace(/\.[^/.]+$/, "")
                      : `transcript-${asset.id.slice(0, 8)}`;
                    a.download = `${base}.txt`;
                    document.body.appendChild(a); a.click(); a.remove();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 9,
                    background: "rgba(255,255,255,0.06)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <Download size={14} /> {t("downloadTxt")}
                </button>
              </div>
            </>
          ) : isCaption ? (
            <>
              {/* Mídia: vídeo player se vídeo + url disponível, senão imagem */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                {isCaptionVideo && asset.caption_video_url ? (
                  <video
                    src={asset.caption_video_url}
                    poster={asset.cover_url}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 10, background: "#000" }}
                  />
                ) : (
                  <img src={asset.cover_url} alt={asset.title}
                    loading="lazy" decoding="async"
                    style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 10 }} />
                )}
              </div>
              {/* FB caption */}
              {asset.fb_caption && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#3B82F6" }}>Facebook</span>
                    <button onClick={() => copyText(asset.fb_caption || "", "fb")} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 9px", borderRadius: 6,
                      background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
                      border: "1px solid rgba(255,255,255,0.10)",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {copiedKey === "fb" ? <><Check size={11} /> {t("copied")}</> : <><Copy size={11} /> {t("copy")}</>}
                    </button>
                  </div>
                  <pre style={{
                    margin: 0, padding: "12px 14px",
                    background: "rgba(59,130,246,0.06)",
                    border: "1px solid rgba(59,130,246,0.20)",
                    borderRadius: 8, fontSize: 13, color: "#fff",
                    fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word",
                    lineHeight: 1.6,
                  }}>{asset.fb_caption}</pre>
                </div>
              )}
              {/* TikTok caption */}
              {asset.tiktok_caption && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#EC4899" }}>
                      TikTok <span style={{ color: "#9CA3AF", marginLeft: 6, fontWeight: 600 }}>{asset.tiktok_caption.length}/95</span>
                    </span>
                    <button onClick={() => copyText(asset.tiktok_caption || "", "tt")} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 9px", borderRadius: 6,
                      background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
                      border: "1px solid rgba(255,255,255,0.10)",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {copiedKey === "tt" ? <><Check size={11} /> {t("copied")}</> : <><Copy size={11} /> {t("copy")}</>}
                    </button>
                  </div>
                  <div style={{
                    padding: "12px 14px",
                    background: "rgba(236,72,153,0.06)",
                    border: "1px solid rgba(236,72,153,0.20)",
                    borderRadius: 8, fontSize: 13, color: "#fff",
                    lineHeight: 1.55, wordBreak: "break-word",
                  }}>{asset.tiktok_caption}</div>
                </div>
              )}
              {/* Transcript (vídeo só) */}
              {isCaptionVideo && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A78BFA" }}>
                      {lang === "pt" ? "Transcript" : "Transcript"}
                    </span>
                    {asset.caption_transcript && (
                      <button onClick={() => copyText(asset.caption_transcript || "", "tr")} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 9px", borderRadius: 6,
                        background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
                        border: "1px solid rgba(255,255,255,0.10)",
                        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}>
                        {copiedKey === "tr" ? <><Check size={11} /> {t("copied")}</> : <><Copy size={11} /> {t("copy")}</>}
                      </button>
                    )}
                  </div>
                  <div style={{
                    padding: "12px 14px",
                    background: "rgba(167,139,250,0.06)",
                    border: "1px solid rgba(167,139,250,0.20)",
                    borderRadius: 8, fontSize: 12.5, color: "#E5E7EB",
                    lineHeight: 1.6, wordBreak: "break-word",
                    fontStyle: asset.caption_transcript ? "normal" : "italic",
                    maxHeight: 200, overflowY: "auto",
                  }}>
                    {asset.caption_transcript || (lang === "pt" ? "Sem transcript (vídeo > 25MB ou sem áudio)." : "No transcript (video > 25MB or no audio).")}
                  </div>
                </div>
              )}
            </>
          ) : !isGroup ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <img src={asset.cover_url} alt={asset.title}
                  loading="lazy" decoding="async"
                  style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }} />
              </div>
              <p style={{
                fontSize: 12, color: "#D1D5DB", margin: "0 0 14px",
                padding: "10px 12px", background: "rgba(255,255,255,0.03)",
                borderRadius: 8, lineHeight: 1.55, fontStyle: "italic",
              }}>"{asset.prompt}"</p>
              <button onClick={() => downloadOne(asset.cover_url, `${asset.kind}-${asset.id.slice(0, 8)}.png`)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 9,
                  background: "#3B82F6", color: "#fff",
                  border: "none", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                <Download size={14} /> {t("download")}
              </button>
            </>
          ) : (
            <>
              <p style={{
                fontSize: 12, color: "#D1D5DB", margin: "0 0 14px",
                padding: "10px 12px", background: "rgba(255,255,255,0.03)",
                borderRadius: 8, lineHeight: 1.55, fontStyle: "italic",
              }}>"{asset.prompt}"</p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}>
                {groupItems.map(it => (
                  <div key={it.n} style={{
                    background: "rgba(17,24,39,0.50)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, overflow: "hidden",
                  }}>
                    <div style={{ position: "relative" }}>
                      {/* Imagem clicável — abre em nova aba pra ver tamanho real */}
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", cursor: "zoom-in" }}
                        title={lang === "pt" ? "Abrir em tamanho real" : "Open full size"}
                      >
                        <img src={it.url} alt={`${asset.id}-${it.n}`}
                          loading="lazy" decoding="async"
                          style={{
                            width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block",
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                        />
                      </a>
                      <div style={{
                        position: "absolute", top: 6, left: 6,
                        padding: "2px 7px", borderRadius: 5,
                        background: "rgba(0,0,0,0.65)", color: "#fff",
                        fontSize: 10, fontWeight: 800,
                        pointerEvents: "none",
                      }}>
                        {it.n}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          downloadOne(it.url, `${asset.kind}-${asset.id.slice(0, 8)}-${String(it.n).padStart(2, "0")}.png`);
                        }}
                        title={t("download")}
                        style={{
                          position: "absolute", top: 6, right: 6,
                          width: 24, height: 24, borderRadius: 6,
                          background: "rgba(0,0,0,0.65)", border: "none",
                          color: "#fff", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                        <Download size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(secs: number): string {
  const total = Math.max(0, Math.round(secs));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relativeDate(iso: string, lang: Lang): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    const ago = lang === "en" ? " ago" : lang === "es" ? " atrás" : lang === "zh" ? "前" : " atrás";
    if (min < 1) return lang === "en" ? "now" : lang === "es" ? "ahora" : lang === "zh" ? "刚刚" : "agora";
    if (min < 60) return `${min}min${ago}`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h${ago}`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d${ago}`;
    return new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-MX" : lang === "zh" ? "zh-CN" : "en-US", { day: "2-digit", month: "short" });
  } catch { return ""; }
}
