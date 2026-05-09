/**
 * HubCaptionGen — gerador de legendas TikTok + Facebook.
 *
 * User upload de 1+ imagens. Edge function hub-caption-gen analisa
 * cada uma com Claude Haiku 4.5 (vision) e retorna:
 *   - FB caption (4 linhas com emojis, formato custom do user)
 *   - TikTok caption (≤95 chars, sem emojis)
 *
 * Idioma das legendas vem do market selecionado:
 *   BR → pt-BR · MX/CO/PE → es-{country} · US → en-US · IN → Hinglish
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Captions, Download, ArrowLeft, ChevronDown, Search, Upload, X,
  Loader, AlertTriangle, Copy, Check, Sparkles, Play, Mic, ChevronUp,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { uploadAssetToStorage } from "@/lib/uploadAssetToStorage";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",       en: "Back to Hub",       es: "Volver al Hub",     zh: "返回中心" },
  title:          { pt: "Gerador de Legendas", en: "Caption Generator", es: "Generador de captions", zh: "字幕生成器" },
  subtitle:       { pt: "Suba imagens e ganhe legendas Facebook + TikTok prontas em segundos. IA analisa o conteúdo e adapta ao seu mercado.",
                    en: "Upload images and get Facebook + TikTok captions ready in seconds. AI analyzes content and adapts to your market.",
                    es: "Sube imágenes y obtén captions Facebook + TikTok listos en segundos. IA analiza el contenido y se adapta a tu mercado.",
                    zh: "上传图片，几秒内获得 Facebook + TikTok 字幕。AI 分析内容并适应您的市场。" },
  brand:          { pt: "Marca",               en: "Brand",             es: "Marca",             zh: "品牌" },
  market:         { pt: "Mercado",             en: "Market",            es: "Mercado",           zh: "市场" },
  brandSelect:    { pt: "Selecionar marca",    en: "Select brand",      es: "Seleccionar marca", zh: "选择品牌" },
  noBrand:        { pt: "Sem marca",           en: "No brand",          es: "Sin marca",         zh: "无品牌" },
  uploadArea:     { pt: "Clique pra enviar imagens ou vídeos", en: "Click to upload images or videos", es: "Click para subir imágenes o videos", zh: "点击上传图像或视频" },
  uploadHint:     { pt: "Até 10 arquivos · Imagens PNG/JPG/WEBP 5MB · Vídeos MP4 100MB / 90s", en: "Up to 10 files · Images PNG/JPG/WEBP 5MB · Videos MP4 100MB / 90s", es: "Hasta 10 archivos · Imágenes PNG/JPG/WEBP 5MB · Videos MP4 100MB / 90s", zh: "最多 10 个文件 · 图像 5MB · 视频 100MB / 90秒" },
  transcript:     { pt: "Transcript (áudio)",  en: "Transcript (audio)", es: "Transcript (audio)", zh: "音频转录" },
  noTranscript:   { pt: "Sem áudio detectado ou vídeo grande demais pra Whisper.", en: "No audio detected or video too large for Whisper.", es: "Sin audio detectado o video demasiado grande para Whisper.", zh: "未检测到音频或视频过大。" },
  videoLabel:     { pt: "Vídeo",                en: "Video",             es: "Video",             zh: "视频" },
  generate:       { pt: "Gerar legendas",      en: "Generate captions", es: "Generar captions",  zh: "生成字幕" },
  generating:     { pt: "Gerando legendas...", en: "Generating...",     es: "Generando...",      zh: "生成中..." },
  results:        { pt: "Resultados",          en: "Results",           es: "Resultados",        zh: "结果" },
  fbLabel:        { pt: "Facebook",            en: "Facebook",          es: "Facebook",          zh: "Facebook" },
  tiktokLabel:    { pt: "TikTok",              en: "TikTok",            es: "TikTok",            zh: "TikTok" },
  copy:           { pt: "Copiar",              en: "Copy",              es: "Copiar",            zh: "复制" },
  copied:         { pt: "Copiado",             en: "Copied",            es: "Copiado",           zh: "已复制" },
  errFile:        { pt: "Arquivo inválido. PNG/JPG/WEBP até 5MB.", en: "Invalid file. PNG/JPG/WEBP up to 5MB.", es: "Archivo inválido. PNG/JPG/WEBP hasta 5MB.", zh: "无效文件。PNG/JPG/WEBP，最大 5MB。" },
  errMaxFiles:    { pt: "Máximo 10 imagens por geração.", en: "Max 10 images per generation.", es: "Máx 10 imágenes por generación.", zh: "每次最多 10 张图像。" },
  errNoImages:    { pt: "Adicione pelo menos 1 imagem.", en: "Add at least 1 image.", es: "Agrega al menos 1 imagen.", zh: "至少添加 1 张图像。" },
  errFailed:      { pt: "Falha ao gerar",      en: "Generation failed", es: "Falla al generar",  zh: "生成失败" },
  sessionExpired: { pt: "Sessão expirada. Faça login.", en: "Session expired. Sign in.", es: "Sesión expirada.", zh: "会话已过期" },
  remove:         { pt: "Remover",             en: "Remove",            es: "Quitar",            zh: "删除" },
  removeAll:      { pt: "Limpar tudo",         en: "Clear all",         es: "Limpiar todo",      zh: "全部清除" },
  cost:           { pt: "Custo estimado",      en: "Estimated cost",    es: "Costo estimado",    zh: "预估费用" },
  costPerImage:   { pt: "$0,001 / imagem",     en: "$0.001 / image",    es: "$0,001 / imagen",   zh: "$0.001/图" },
  costPerVideo:   { pt: "$0,004 / vídeo",      en: "$0.004 / video",    es: "$0,004 / video",    zh: "$0.004/视频" },
  bigVideoWarn:   { pt: "Vídeo > 25MB — sem transcript de áudio (Whisper limita 25MB). Legenda usará só os frames visuais.",
                    en: "Video > 25MB — no audio transcript (Whisper 25MB limit). Caption will use visual frames only.",
                    es: "Video > 25MB — sin transcript (Whisper limita 25MB). Caption usará solo frames visuales.",
                    zh: "视频 > 25MB — 无音频转录（Whisper 25MB 限制）。字幕仅使用视觉帧。" },
  uploading:      { pt: "Enviando imagens...", en: "Uploading...",      es: "Subiendo...",       zh: "上传中..." },
  recent:         { pt: "Últimas legendas",    en: "Recent captions",   es: "Últimas captions",  zh: "最近的字幕" },
  recentEmpty:    { pt: "Sem legendas ainda. Gere a primeira acima.", en: "No captions yet. Generate the first above.", es: "Sin captions aún.", zh: "还没有字幕。" },
  langInfo:       { pt: "Sem mercado: IA detecta o idioma da imagem (texto visível, copy do anúncio).", en: "No market: AI detects language from image (visible text, ad copy).", es: "Sin mercado: IA detecta el idioma de la imagen.", zh: "无市场：AI 从图像检测语言。" },
  langTitle:      { pt: "Idioma das legendas", en: "Caption language", es: "Idioma de los captions", zh: "字幕语言" },
  langAuto:       { pt: "Automático (do mercado)", en: "Auto (from market)", es: "Auto (del mercado)", zh: "自动（按市场）" },
};

// Idiomas disponíveis pra override. Default = "auto" (deriva do market).
type CaptionLang = "auto" | "pt-BR" | "es-MX" | "es-CO" | "es-PE" | "en-US" | "hinglish";

const LANG_OPTIONS: { id: CaptionLang; label: string; flag: string }[] = [
  { id: "auto",     label: "Auto",                  flag: "✨" },
  { id: "pt-BR",    label: "Português (BR)",        flag: "🇧🇷" },
  { id: "es-MX",    label: "Español (MX)",          flag: "🇲🇽" },
  { id: "es-CO",    label: "Español (CO)",          flag: "🇨🇴" },
  { id: "es-PE",    label: "Español (PE)",          flag: "🇵🇪" },
  { id: "en-US",    label: "English (US)",          flag: "🇺🇸" },
  { id: "hinglish", label: "Hinglish (IN)",         flag: "🇮🇳" },
];

const MAX_FILES = 10;
const MAX_IMG_BYTES = 5 * 1024 * 1024;          // 5MB pra imagem
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;      // 100MB pra vídeo (cobre Reels/TikTok ads)
const MAX_VIDEO_DURATION = 90;                  // 90s — Meta Reels recomendado
const VIDEO_FRAMES = 3;                         // início, meio, fim

interface CaptionAsset {
  id: string;
  image_url: string;            // se vídeo: URL do thumbnail (frame)
  fb_caption: string;
  tiktok_caption: string;
  language?: string;
  brand_id?: string;
  created_at: string;
  media_type?: "image" | "video";
  transcript?: string | null;   // só vídeo
  video_url?: string;           // só vídeo — URL do MP4 pra preview
}

interface PendingImage {
  id: string;                    // local
  dataUrl: string;               // preview (image OU thumbnail do video)
  file: File;
  mediaType: "image" | "video";  // tipo
  duration?: number;             // só video (segundos)
  // Frames extraídos do vídeo (data URLs base64). Populado depois do load.
  frames?: string[];
  // True quando vídeo > 25MB → Whisper API não aceita, vai gerar legenda
  // só com frames visuais (sem transcript de áudio).
  noWhisper?: boolean;
}

export default function HubCaptionGen() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;
  const isMobile = useIsMobile();

  const [brandId, setBrandId] = useState("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [captionLang, setCaptionLang] = useState<CaptionLang>("auto");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [results, setResults] = useState<CaptionAsset[]>([]);
  const [recent, setRecent] = useState<CaptionAsset[]>([]);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);

  // Custo + warnings derivados das pendingImages
  const pendingStats = useMemo(() => {
    const imgCount = pendingImages.filter(p => p.mediaType === "image").length;
    const vidCount = pendingImages.filter(p => p.mediaType === "video").length;
    const noWhisperCount = pendingImages.filter(p => p.mediaType === "video" && p.noWhisper).length;
    const cost = imgCount * 0.001 + vidCount * 0.004; // GPT-4o-mini + Whisper
    return { imgCount, vidCount, noWhisperCount, cost };
  }, [pendingImages]);

  // Reset market when brand changes
  useEffect(() => {
    if (brand?.markets?.length) {
      if (!marketCode || !brand.markets.includes(marketCode)) {
        setMarketCode(brand.markets[0]);
      }
    }
  }, [brand]);

  // Load recent captions
  const reloadRecent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("hub_assets")
        .select("id, content, created_at")
        .eq("user_id", user.id)
        .eq("kind" as never, "hub_caption" as never)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!data) return;
      const items: CaptionAsset[] = data.map(r => {
        const c = r.content as Record<string, unknown>;
        return {
          id: r.id as string,
          image_url: (c.image_url as string) || "",
          fb_caption: (c.fb_caption as string) || "",
          tiktok_caption: (c.tiktok_caption as string) || "",
          language: c.language as string | undefined,
          brand_id: c.brand_id as string | undefined,
          created_at: r.created_at as string,
          media_type: (c.media_type as "image" | "video" | undefined) || "image",
          transcript: (c.transcript as string | null | undefined) || null,
          video_url: (c.video_url as string | undefined) || undefined,
        };
      });
      setRecent(items);
    } catch { /* silent */ }
  };

  useEffect(() => { reloadRecent(); }, []);

  const handleFiles = async (filesList: FileList | File[]) => {
    setError(null);
    const files = Array.from(filesList);
    if (pendingImages.length + files.length > MAX_FILES) {
      setError(t("errMaxFiles"));
      return;
    }
    for (const file of files) {
      const isImage = /^image\/(png|jpeg|jpg|webp)$/i.test(file.type);
      const isVideo = /^video\/mp4$/i.test(file.type);
      if (!isImage && !isVideo) {
        setError(t("errFile"));
        continue;
      }
      if (isImage && file.size > MAX_IMG_BYTES) {
        setError(t("errFile"));
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        setError(lang === "pt" ? `Vídeo passa de 100MB (${(file.size/1024/1024).toFixed(1)}MB)` : `Video over 100MB`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingImages(prev => [...prev, {
            id, dataUrl: reader.result as string, file, mediaType: "image",
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        // Vídeo: extrai N frames + thumbnail
        try {
          const { frames, thumbnail, duration } = await extractVideoFrames(file, VIDEO_FRAMES);
          if (duration > MAX_VIDEO_DURATION) {
            setError(lang === "pt"
              ? `Vídeo tem ${duration.toFixed(0)}s. Máximo ${MAX_VIDEO_DURATION}s pra Reels/TikTok.`
              : `Video is ${duration.toFixed(0)}s. Max ${MAX_VIDEO_DURATION}s.`);
            continue;
          }
          // > 24.5MB → Whisper API rejeita (limite 25MB binário com overhead)
          const noWhisper = file.size > 24.5 * 1024 * 1024;
          setPendingImages(prev => [...prev, {
            id, dataUrl: thumbnail, file, mediaType: "video", duration, frames, noWhisper,
          }]);
        } catch (e) {
          setError(`${lang === "pt" ? "Falha ao processar vídeo" : "Video processing failed"}: ${String(e).slice(0, 100)}`);
        }
      }
    }
  };

  // Extrai N frames de um vídeo MP4 via <video> + canvas. Retorna data URLs base64.
  // Tira frames em t = 0%, 50%, 100% da duração. Primeiro frame = thumbnail.
  async function extractVideoFrames(file: File, n: number): Promise<{ frames: string[]; thumbnail: string; duration: number }> {
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video_metadata_failed"));
        setTimeout(() => reject(new Error("video_metadata_timeout")), 15000);
      });
      const duration = video.duration;
      const canvas = document.createElement("canvas");
      // Limita resolução pra economizar bandwidth (max 720p mantém aspect)
      const ar = video.videoWidth / video.videoHeight;
      const targetH = Math.min(video.videoHeight, 720);
      const targetW = Math.round(targetH * ar);
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas_ctx_failed");

      const frames: string[] = [];
      const positions = n === 1
        ? [duration * 0.5]
        : Array.from({ length: n }, (_, i) => duration * (i / (n - 1)) * 0.99); // 0%, 50%, 99%

      for (const t of positions) {
        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("seek_failed"));
          video.currentTime = Math.max(0, Math.min(duration - 0.1, t));
          setTimeout(() => reject(new Error("seek_timeout")), 8000);
        });
        // Pequeno delay pra garantir que o frame renderizou
        await new Promise(r => setTimeout(r, 50));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.85));
      }
      return { frames, thumbnail: frames[0], duration };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const removeImage = (id: string) => {
    setPendingImages(prev => prev.filter(p => p.id !== id));
  };

  // Upload direto de File → Storage (binário, sem passar por data URL).
  // Usa bucket dedicado hub-captions (100MB limit, video/mp4 only) ao
  // invés de hub-images (25MB, mistura imagens) — separação de domínios.
  async function uploadVideoFile(file: File): Promise<string | null> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return null;
      const path = `${userId}/caption-source/${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await supabase.storage.from("hub-captions").upload(path, file, {
        contentType: "video/mp4",
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        console.warn("[HubCaptionGen] video upload failed:", upErr.message);
        return null;
      }
      const { data: urlData } = supabase.storage.from("hub-captions").getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch (e) {
      console.warn("[HubCaptionGen] uploadVideoFile exc:", e);
      return null;
    }
  }

  const generate = async () => {
    if (loading) return;
    if (pendingImages.length === 0) { setError(t("errNoImages")); return; }
    setError(null);
    setLoading(true);
    setResults([]);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); setLoading(false); return; }

      // 1. Upload todos os assets pro Storage EM PARALELO (entre items):
      //    - Imagem: data URL → uploadAssetToStorage (vira URL pública)
      //    - Vídeo: MP4 + 3 frames sobem juntos (4 uploads/vídeo simultâneos)
      // Tudo em paralelo entre os items reduz upload de 10 vídeos
      // de ~60s sequenciais pra ~15s.
      let uploadedCount = 0;
      setUploadingProgress(`${t("uploading")} 0/${pendingImages.length}`);

      const uploaded = await Promise.all(pendingImages.map(async (img) => {
        if (img.mediaType === "image") {
          const url = await uploadAssetToStorage(img.dataUrl, "caption-source");
          uploadedCount++;
          setUploadingProgress(`${t("uploading")} ${uploadedCount}/${pendingImages.length}`);
          return { image_url: url, ref_id: img.id };
        }
        // Vídeo: MP4 + frames em paralelo
        const [videoUrl, ...frameUrls] = await Promise.all([
          uploadVideoFile(img.file),
          ...(img.frames || []).map(f => uploadAssetToStorage(f, "caption-source")),
        ]);
        uploadedCount++;
        setUploadingProgress(`${t("uploading")} ${uploadedCount}/${pendingImages.length}`);
        return {
          image_url: frameUrls[0] || img.dataUrl,
          ref_id: img.id,
          frames: frameUrls,
          video_url: videoUrl || undefined,
        };
      }));
      setUploadingProgress("");

      // 2. Chama edge function
      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-caption-gen`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          images: uploaded,
          brand_id: brandId === "none" ? null : brandId,
          market: marketCode,
          // language override (auto = deriva do market server-side)
          language: captionLang === "auto" ? undefined : captionLang,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; results?: Array<{ image_url: string; ref_id?: string; fb_caption: string; tiktok_caption: string; memory_id?: string; error?: string; media_type?: "image" | "video"; transcript?: string }>; message?: string; error?: string };
      try { payload = JSON.parse(text); } catch {
        setError(`Resposta inválida: ${text.slice(0, 150)}`);
        return;
      }
      if (!payload.ok || !Array.isArray(payload.results)) {
        setError(payload.message || payload.error || t("errFailed"));
        return;
      }

      // Mapa ref_id → uploaded item pra recuperar video_url no resultado
      const uploadedByRef = new Map(uploaded.map(u => [u.ref_id, u]));

      const assets: CaptionAsset[] = payload.results
        .filter(r => r.fb_caption && r.tiktok_caption && !r.error)
        .map(r => {
          const upl = r.ref_id ? uploadedByRef.get(r.ref_id) : undefined;
          return {
            id: r.memory_id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            image_url: r.image_url,
            fb_caption: r.fb_caption,
            tiktok_caption: r.tiktok_caption,
            brand_id: brandId === "none" ? undefined : brandId,
            created_at: new Date().toISOString(),
            media_type: r.media_type || "image",
            transcript: r.transcript || null,
            video_url: upl?.video_url,
          };
        });

      setResults(assets);
      // Limpa pending depois de sucesso
      if (assets.length > 0) {
        setPendingImages([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      reloadRecent();
    } catch (e) {
      setError(String(e).slice(0, 200));
    } finally {
      setLoading(false);
      setUploadingProgress("");
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* silent */ }
  };

  const filteredBrands = useMemo(() => {
    const all = Object.values(HUB_BRANDS);
    if (!brandSearch.trim()) return all;
    const s = brandSearch.toLowerCase();
    return all.filter(b => b.name.toLowerCase().includes(s) || b.id.toLowerCase().includes(s));
  }, [brandSearch]);

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>
      <div style={{ minHeight: "100%", background: "#06070a", color: "#fff", padding: isMobile ? "16px 14px 28px" : "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard/hub")} style={btnGhost}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{t("title")}</h1>
            <span title="Powered by GPT-4o-mini vision (custo otimizado: ~$0.0001 por imagem)"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 999,
                background: "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(236,72,153,0.18))",
                border: "1px solid rgba(167,139,250,0.30)",
                color: "#C4B5FD", fontSize: 10.5, fontWeight: 800,
                letterSpacing: "0.02em", cursor: "help",
              }}>
              <Sparkles size={10} /> GPT-4o-mini Vision
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "6px 0 0", maxWidth: 720, lineHeight: 1.5 }}>{t("subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 24, maxWidth: 1280 }}>
          {/* LEFT — controles */}
          <div style={panelStyle}>
            {/* Brand */}
            <div style={section}>
              <div style={sectionLabel}>{t("brand")}</div>
              <button onClick={() => setBrandModalOpen(true)} style={brandSelectStyle}>
                {brand && brand.id !== "none" ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{brand.name}</span>
                    {marketCode && (
                      <span style={{ marginLeft: 8, fontSize: 10.5, color: "rgba(255,255,255,0.50)" }}>
                        {HUB_MARKETS[marketCode]?.flag} {HUB_MARKETS[marketCode]?.labels[lang] || marketCode}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.50)" }}>{t("brandSelect")}</span>
                )}
                <ChevronDown size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.40)" }} />
              </button>
              {brand && brand.id !== "none" && brand.markets && brand.markets.length > 1 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {brand.markets.map(m => (
                    <button key={m} onClick={() => setMarketCode(m)} style={pillStyle(marketCode === m)}>
                      {HUB_MARKETS[m]?.flag} {HUB_MARKETS[m]?.labels[lang] || m}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ ...hint, marginTop: 6 }}>{t("langInfo")}</div>
            </div>

            {/* Idioma das legendas (override) */}
            <div style={section}>
              <div style={sectionLabel}>{t("langTitle")}</div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 6,
              }}>
                {LANG_OPTIONS.map(opt => {
                  const active = captionLang === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setCaptionLang(opt.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 10px", borderRadius: 6,
                        background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "#A78BFA" : "rgba(255,255,255,0.10)"}`,
                        color: active ? "#C4B5FD" : "rgba(255,255,255,0.70)",
                        fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left", whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{opt.flag}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {opt.id === "auto" ? t("langAuto") : opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upload area */}
            <div style={section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={sectionLabel}>{lang === "pt" ? "Imagens" : "Images"} {pendingImages.length > 0 && <span style={{ color: "#A78BFA", marginLeft: 6 }}>({pendingImages.length}/{MAX_FILES})</span>}</span>
                {pendingImages.length > 0 && (
                  <button onClick={() => setPendingImages([])} style={{
                    fontSize: 10.5, padding: "3px 7px", borderRadius: 4,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.55)", cursor: "pointer", fontFamily: "inherit",
                  }}>{t("removeAll")}</button>
                )}
              </div>
              <div onClick={() => fileInputRef.current?.click()} style={{
                border: "1.5px dashed rgba(255,255,255,0.12)",
                borderRadius: 10, padding: 24, textAlign: "center", cursor: "pointer",
                background: "rgba(255,255,255,0.02)",
              }}>
                <Upload size={20} style={{ color: "#A78BFA", marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 600 }}>{t("uploadArea")}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>{t("uploadHint")}</div>
              </div>
              <input
                ref={fileInputRef} type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4"
                multiple style={{ display: "none" }}
                onChange={e => { if (e.target.files) handleFiles(e.target.files); }}
              />
              {/* Pending thumbnails */}
              {pendingImages.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 6, marginTop: 10,
                }}>
                  {pendingImages.map(img => (
                    <div key={img.id} style={{
                      position: "relative", aspectRatio: "1/1",
                      borderRadius: 6, overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#000",
                    }}>
                      <img src={img.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {img.mediaType === "video" && (
                        <>
                          <div style={{
                            position: "absolute", inset: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(0,0,0,0.20)", pointerEvents: "none",
                          }}>
                            <Play size={22} fill="#fff" style={{ color: "#fff", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }} />
                          </div>
                          <div style={{
                            position: "absolute", bottom: 3, left: 3,
                            padding: "2px 5px", borderRadius: 3,
                            background: img.noWhisper ? "rgba(245,158,11,0.85)" : "rgba(0,0,0,0.75)",
                            color: img.noWhisper ? "#0a0a0f" : "#fff",
                            fontSize: 9, fontWeight: 800,
                            letterSpacing: "0.04em",
                          }} title={img.noWhisper ? t("bigVideoWarn") : undefined}>
                            {img.noWhisper ? "NO AUDIO" : img.duration ? `${img.duration.toFixed(0)}s` : "MP4"}
                          </div>
                        </>
                      )}
                      <button onClick={() => removeImage(img.id)} style={{
                        position: "absolute", top: 3, right: 3,
                        width: 20, height: 20, borderRadius: 4,
                        background: "rgba(0,0,0,0.75)", border: "none",
                        color: "#fff", cursor: "pointer", fontSize: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning: vídeos > 25MB (sem Whisper) */}
            {pendingStats.noWhisperCount > 0 && (
              <div style={{
                marginBottom: 12, padding: "8px 10px",
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.30)",
                borderRadius: 6, fontSize: 11, color: "#FCD34D",
                lineHeight: 1.5,
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>{pendingStats.noWhisperCount}</strong> {pendingStats.noWhisperCount === 1
                    ? (lang === "pt" ? "vídeo" : "video")
                    : (lang === "pt" ? "vídeos" : "videos")} {">"} 25MB. {t("bigVideoWarn")}
                </span>
              </div>
            )}
            {/* Cost — dinâmico baseado no que tá pendente */}
            <div style={{ ...section, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={sectionLabel}>{t("cost")}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#A78BFA" }}>
                  {pendingImages.length === 0
                    ? `${t("costPerImage")} · ${t("costPerVideo")}`
                    : `~$${pendingStats.cost.toFixed(3)}`}
                </span>
              </div>
              {pendingImages.length > 0 && (
                <div style={{ ...hint, marginTop: 4, fontSize: 10.5 }}>
                  {pendingStats.imgCount > 0 && `${pendingStats.imgCount} img × $0.001`}
                  {pendingStats.imgCount > 0 && pendingStats.vidCount > 0 && " + "}
                  {pendingStats.vidCount > 0 && `${pendingStats.vidCount} video × $0.004`}
                </div>
              )}
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={loading || pendingImages.length === 0}
              style={{
                ...btnPrimary, width: "100%", justifyContent: "center", padding: "12px",
                fontSize: 13.5,
                opacity: (loading || pendingImages.length === 0) ? 0.5 : 1,
                cursor: (loading || pendingImages.length === 0) ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <><Loader size={14} className="spin" /> {uploadingProgress || t("generating")}</>
              ) : (
                <><Captions size={14} /> {t("generate")} {pendingImages.length > 0 && `(${pendingImages.length})`}</>
              )}
            </button>
            {error && (
              <div style={{
                marginTop: 10, padding: "8px 10px",
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.30)",
                borderRadius: 6, fontSize: 11.5, color: "#FCA5A5",
              }}>
                <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                {error}
              </div>
            )}
          </div>

          {/* RIGHT — resultados + recents */}
          <div>
            <div style={panelStyle}>
              <div style={sectionLabel}>{t("results")}</div>
              {results.length === 0 && !loading ? (
                <div style={{
                  marginTop: 10, padding: "32px 16px",
                  textAlign: "center", color: "rgba(255,255,255,0.40)", fontSize: 12,
                  border: "1px dashed rgba(255,255,255,0.10)", borderRadius: 10,
                }}>
                  <Captions size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <div>{lang === "pt" ? "Suas legendas vão aparecer aqui" : "Your captions will appear here"}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                  {results.map(r => <CaptionCard key={r.id} asset={r} t={t} lang={lang} onCopy={copy} copiedId={copiedId} />)}
                </div>
              )}
            </div>

            {/* Recent */}
            <div style={{ ...panelStyle, marginTop: 14 }}>
              <div style={sectionLabel}>{t("recent")}</div>
              {recent.length === 0 ? (
                <div style={hint}>{t("recentEmpty")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {recent.map(r => <CaptionCard key={r.id} asset={r} t={t} lang={lang} onCopy={copy} copiedId={copiedId} compact />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Brand modal */}
      {brandModalOpen && (
        <div onClick={() => setBrandModalOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
            maxWidth: 480, width: "100%", maxHeight: "80vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>{t("brand")}</h3>
              <button onClick={() => setBrandModalOpen(false)} style={btnGhost}><X size={12} /></button>
            </div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.40)" }} />
                <input
                  value={brandSearch} onChange={e => setBrandSearch(e.target.value)}
                  placeholder={lang === "pt" ? "Buscar marca..." : "Search brand..."}
                  style={{
                    width: "100%", padding: "8px 12px 8px 32px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8,
                    color: "#fff", fontSize: 12.5, fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box",
                  }} autoFocus
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
              <button onClick={() => { setBrandId("none"); setBrandModalOpen(false); }} style={brandCardStyle(brandId === "none")}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{t("noBrand")}</div>
              </button>
              {filteredBrands.filter(b => b.id !== "none").map(b => (
                <button key={b.id} onClick={() => { setBrandId(b.id); setBrandModalOpen(false); }} style={brandCardStyle(brandId === b.id)}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{b.name}</div>
                  {b.markets && b.markets.length > 0 && (
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                      {b.markets.map(m => HUB_MARKETS[m]?.flag).join(" ")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </>
  );
}

// ── Caption card (resultado individual) ──────────────────────────
function CaptionCard({
  asset, t, lang, onCopy, copiedId, compact,
}: {
  asset: CaptionAsset;
  t: (k: keyof typeof STR) => string;
  lang: Lang;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  compact?: boolean;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const isVideo = asset.media_type === "video";
  const previewHref = isVideo && asset.video_url ? asset.video_url : asset.image_url;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: compact ? "60px 1fr" : "120px 1fr",
      gap: 12, padding: compact ? 8 : 12,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
    }}>
      <a href={previewHref} target="_blank" rel="noopener noreferrer" style={{ display: "block", borderRadius: 6, overflow: "hidden", cursor: "zoom-in", position: "relative" }}>
        <img src={asset.image_url} alt="" loading="lazy" decoding="async" style={{
          width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block",
          background: "#000",
        }} />
        {isVideo && (
          <>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.20)", pointerEvents: "none",
            }}>
              <Play size={compact ? 16 : 24} fill="#fff" style={{ color: "#fff", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" }} />
            </div>
            <div style={{
              position: "absolute", bottom: 3, left: 3,
              padding: "2px 5px", borderRadius: 3,
              background: "rgba(167,139,250,0.85)",
              color: "#0a0a0f", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{t("videoLabel")}</div>
          </>
        )}
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {/* FB */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#3B82F6" }}>{t("fbLabel")}</span>
            <button onClick={() => onCopy(asset.fb_caption, `fb-${asset.id}`)} style={copyBtnStyle}>
              {copiedId === `fb-${asset.id}` ? <><Check size={10} /> {t("copied")}</> : <><Copy size={10} /> {t("copy")}</>}
            </button>
          </div>
          <pre style={{
            margin: 0, padding: "8px 10px",
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 6, fontSize: 11.5, color: "rgba(255,255,255,0.90)",
            fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word",
            lineHeight: 1.55,
          }}>{asset.fb_caption}</pre>
        </div>
        {/* TikTok */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#EC4899" }}>
              {t("tiktokLabel")} <span style={{ color: "rgba(255,255,255,0.40)", marginLeft: 4 }}>{asset.tiktok_caption.length}/95</span>
            </span>
            <button onClick={() => onCopy(asset.tiktok_caption, `tt-${asset.id}`)} style={copyBtnStyle}>
              {copiedId === `tt-${asset.id}` ? <><Check size={10} /> {t("copied")}</> : <><Copy size={10} /> {t("copy")}</>}
            </button>
          </div>
          <div style={{
            padding: "8px 10px",
            background: "rgba(236,72,153,0.06)",
            border: "1px solid rgba(236,72,153,0.15)",
            borderRadius: 6, fontSize: 11.5, color: "rgba(255,255,255,0.90)",
            lineHeight: 1.5, wordBreak: "break-word",
          }}>{asset.tiktok_caption}</div>
        </div>
        {/* Transcript (só pra vídeo, collapsible) */}
        {isVideo && !compact && (
          <div>
            <button
              onClick={() => setTranscriptOpen(o => !o)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", borderRadius: 6,
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.15)",
                color: "#C4B5FD", fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <Mic size={11} />
              <span style={{ flex: 1 }}>{t("transcript")}</span>
              {transcriptOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {transcriptOpen && (
              <div style={{
                marginTop: 4, padding: "8px 10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,0.75)",
                lineHeight: 1.5, fontStyle: asset.transcript ? "normal" : "italic",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                maxHeight: 180, overflowY: "auto",
              }}>
                {asset.transcript || t("noTranscript")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14, padding: "18px 20px",
};
const section: React.CSSProperties = { marginBottom: 16 };
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
  marginBottom: 6,
};
const hint: React.CSSProperties = { fontSize: 11.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 };
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6, color: "rgba(255,255,255,0.75)",
  fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  background: "#A78BFA",
  border: "1px solid #A78BFA",
  borderRadius: 6, color: "#0a0a0f",
  fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const brandSelectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8, color: "#fff", fontSize: 12.5, fontFamily: "inherit",
  cursor: "pointer", display: "flex", alignItems: "center", textAlign: "left",
};
const copyBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "3px 7px", borderRadius: 4,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.70)",
  fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "7px 10px",
    background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#A78BFA" : "rgba(255,255,255,0.10)"}`,
    borderRadius: 6,
    color: active ? "#C4B5FD" : "rgba(255,255,255,0.70)",
    fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };
}
function brandCardStyle(active: boolean): React.CSSProperties {
  return {
    padding: 12,
    background: active ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "#A78BFA" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 10, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
  };
}
