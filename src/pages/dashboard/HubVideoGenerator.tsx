/**
 * HubVideoGenerator — gerador de vídeo standalone (Brilliant Hub).
 *
 * Layout: 2-coluna igual o Image Studio.
 *   LEFT: marca + (opcional) imagem source + prompt + duração/aspect/res/áudio + gerar
 *   RIGHT: preview do vídeo + galeria recentes
 *
 * Backend: chama edge function hub-video-gen → PiAPI Kling 3.0 default.
 *
 * Modos:
 *   - text-to-video: só prompt
 *   - image-to-video: prompt + upload de imagem (anima o still)
 *
 * Salva em hub_assets kind='hub_video' — biblioteca mostra junto com
 * o resto.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Video as VideoIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  ChevronDown, Search, Upload, X, Loader,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";

// ── i18n minimal — Hub só usa pt/en/es/zh ─────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",         en: "Back to Hub",          es: "Volver al Hub",         zh: "返回中心" },
  title:          { pt: "Gerador de Vídeo",      en: "Video Generator",      es: "Generador de Video",    zh: "视频生成器" },
  subtitle:       { pt: "Gere vídeos com IA via Kling 3.0 — text-to-video ou image-to-video.",
                    en: "Generate videos with AI via Kling 3.0 — text-to-video or image-to-video.",
                    es: "Genera videos con IA vía Kling 3.0 — text-to-video o image-to-video.",
                    zh: "通过 Kling 3.0 用 AI 生成视频。" },
  brand:          { pt: "Marca (opcional)",      en: "Brand (optional)",     es: "Marca (opcional)",      zh: "品牌（可选）" },
  brandSelect:    { pt: "Selecionar marca",      en: "Select brand",         es: "Seleccionar marca",     zh: "选择品牌" },
  noBrand:        { pt: "Sem marca",             en: "No brand",             es: "Sin marca",             zh: "无品牌" },
  source:         { pt: "Imagem source (opcional)", en: "Source image (optional)", es: "Imagen source (opcional)", zh: "源图像（可选）" },
  sourceDesc:     { pt: "Adicione uma imagem pra fazer image-to-video. Sem imagem = text-to-video.",
                    en: "Add an image for image-to-video. No image = text-to-video.",
                    es: "Agrega una imagen para image-to-video. Sin imagen = text-to-video.",
                    zh: "添加图像进行图像转视频。无图像 = 文本转视频。" },
  uploadImage:    { pt: "Clique pra enviar imagem", en: "Click to upload image", es: "Click para subir imagen", zh: "点击上传图像" },
  removeSource:   { pt: "Remover imagem",        en: "Remove image",         es: "Quitar imagen",         zh: "删除图像" },
  prompt:         { pt: "Descreva o vídeo",      en: "Describe the video",   es: "Describe el video",     zh: "描述视频" },
  promptDesc:     { pt: "Pra image-to-video, descreva o movimento. Pra text-to-video, descreva a cena inteira.",
                    en: "For image-to-video, describe the motion. For text-to-video, describe the full scene.",
                    es: "Para image-to-video, describe el movimiento. Para text-to-video, describe toda la escena.",
                    zh: "图像转视频时描述动作。文本转视频时描述整个场景。" },
  promptPh:       { pt: "Ex: Cristiano Ronaldo comemora o gol, câmera em zoom dramático, fogos no estádio…",
                    en: "Ex: Cristiano Ronaldo celebrates the goal, dramatic zoom, fireworks in stadium…",
                    es: "Ej: Cristiano Ronaldo celebra el gol, zoom dramático, fuegos en estadio…",
                    zh: "例如：克里斯蒂亚诺·罗纳尔多庆祝进球，戏剧性缩放…" },
  format:         { pt: "Formato",               en: "Format",               es: "Formato",               zh: "格式" },
  duration:       { pt: "Duração",               en: "Duration",             es: "Duración",              zh: "时长" },
  resolution:     { pt: "Resolução",             en: "Resolution",           es: "Resolución",            zh: "分辨率" },
  mode:           { pt: "Qualidade",             en: "Quality",              es: "Calidad",               zh: "质量" },
  modeStd:        { pt: "Padrão",                en: "Standard",             es: "Estándar",              zh: "标准" },
  modePro:        { pt: "Pro",                   en: "Pro",                  es: "Pro",                   zh: "专业" },
  audio:          { pt: "Áudio nativo",          en: "Native audio",         es: "Audio nativo",          zh: "原生音频" },
  audioDesc:      { pt: "Gera áudio ambiente com Kling 3.0. Custo +50%.",
                    en: "Generate ambient audio with Kling 3.0. Cost +50%.",
                    es: "Genera audio ambiental con Kling 3.0. Costo +50%.",
                    zh: "用 Kling 3.0 生成环境音频。成本 +50%。" },
  generate:       { pt: "Gerar vídeo",           en: "Generate video",       es: "Generar video",         zh: "生成视频" },
  generating:     { pt: "Gerando…",              en: "Generating…",          es: "Generando…",            zh: "生成中..." },
  generatingHint: { pt: "Vídeo leva ~60-120s. Não feche essa página.",
                    en: "Video takes ~60-120s. Don't close this page.",
                    es: "Video tarda ~60-120s. No cierres esta página.",
                    zh: "视频需要约 60-120 秒。不要关闭页面。" },
  preview:        { pt: "Prévia",                en: "Preview",              es: "Previsualización",      zh: "预览" },
  emptyHint:      { pt: "Seu vídeo gerado vai aparecer aqui.",
                    en: "Your generated video will appear here.",
                    es: "Tu video generado aparecerá aquí.",
                    zh: "您生成的视频将出现在这里。" },
  download:       { pt: "Baixar MP4",            en: "Download MP4",         es: "Descargar MP4",         zh: "下载 MP4" },
  variation:      { pt: "Gerar variação",        en: "Generate variation",   es: "Generar variación",     zh: "生成变体" },
  recent:         { pt: "Últimas gerações",      en: "Recent generations",   es: "Últimas generaciones",  zh: "最近生成" },
  recentEmpty:    { pt: "Sem vídeos ainda. Gere o primeiro acima!",
                    en: "No videos yet. Generate your first above!",
                    es: "Sin videos aún. ¡Genera el primero arriba!",
                    zh: "还没有视频。在上面生成第一个！" },
  errFile:        { pt: "Arquivo inválido. Use PNG/JPG até 5MB.",
                    en: "Invalid file. Use PNG/JPG up to 5MB.",
                    es: "Archivo inválido. Usa PNG/JPG hasta 5MB.",
                    zh: "文件无效。使用 PNG/JPG，最大 5MB。" },
  errPrompt:      { pt: "Prompt mínimo 5 caracteres.",
                    en: "Prompt minimum 5 characters.",
                    es: "Prompt mínimo 5 caracteres.",
                    zh: "提示至少 5 个字符。" },
  sessionExpired: { pt: "Sessão expirada. Faça login.",
                    en: "Session expired. Sign in.",
                    es: "Sesión expirada. Inicia sesión.",
                    zh: "会话已过期。请登录。" },
  cost:           { pt: "Custo estimado",        en: "Estimated cost",       es: "Costo estimado",        zh: "预估费用" },
};

// ── PiAPI Kling 3.0 pricing (per second) ────────────────────────────
const PRICE_TABLE: Record<string, number> = {
  "720p_off":  0.10,
  "720p_on":   0.15,
  "1080p_off": 0.15,
  "1080p_on":  0.20,
};

interface VideoAsset {
  id: string;
  video_url: string;
  prompt: string;
  duration_s: number;
  aspect_ratio: string;
  resolution: string;
  brand_id?: string;
  market?: string;
  created_at: string;
}

const SOURCE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function HubVideoGenerator() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;
  const isMobile = useIsMobile();

  // Form state
  const [brandId, setBrandId] = useState("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [enableAudio, setEnableAudio] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [sourceImage, setSourceImage] = useState<string | null>(null); // data URL
  const [sourceFileName, setSourceFileName] = useState<string>("");

  // UI state
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceDragOver, setSourceDragOver] = useState(false);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  // Async state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAsset | null>(null);
  const [recent, setRecent] = useState<VideoAsset[]>([]);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);

  // Load gallery on mount + after each gen
  const reloadGallery = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: dbErr } = await supabase
        .from("hub_assets")
        .select("id, content, created_at")
        .eq("user_id", user.id)
        .eq("kind" as never, "hub_video" as never)
        .order("created_at", { ascending: false })
        .limit(8);
      if (dbErr || !data) return;
      const items: VideoAsset[] = data.map(r => {
        const c = r.content as Record<string, unknown>;
        return {
          id: r.id as string,
          video_url: (c.video_url as string) || "",
          prompt: (c.prompt as string) || "",
          duration_s: Number(c.duration_s) || 5,
          aspect_ratio: (c.aspect_ratio as string) || "16:9",
          resolution: (c.resolution as string) || "720p",
          brand_id: c.brand_id as string | undefined,
          market: c.market as string | undefined,
          created_at: r.created_at as string,
        };
      });
      setRecent(items);
    } catch { /* silent */ }
  };

  useEffect(() => { reloadGallery(); }, []);

  // Reset market when brand changes (each brand has its own valid markets)
  useEffect(() => {
    if (brand?.markets?.length) {
      if (!marketCode || !brand.markets.includes(marketCode)) {
        setMarketCode(brand.markets[0]);
      }
    } else {
      setMarketCode(null);
    }
  }, [brand]);

  // Source image upload
  const onSourceFile = (file: File) => {
    setSourceError(null);
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setSourceError(t("errFile"));
      return;
    }
    if (file.size > SOURCE_MAX_BYTES) {
      setSourceError(t("errFile"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setSourceFileName(file.name);
    };
    reader.onerror = () => setSourceError(t("errFile"));
    reader.readAsDataURL(file);
  };

  const removeSourceImage = () => {
    setSourceImage(null);
    setSourceFileName("");
    if (sourceInputRef.current) sourceInputRef.current.value = "";
  };

  // Cost estimate
  const costPerSec = PRICE_TABLE[`${resolution}_${enableAudio ? "on" : "off"}`] || 0.10;
  const proMultiplier = mode === "pro" ? 2 : 1;
  const estCost = (costPerSec * duration * proMultiplier).toFixed(2);

  // Generate
  const generate = async () => {
    if (loading) return;
    if (prompt.trim().length < 5) { setError(t("errPrompt")); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); setLoading(false); return; }

      // Build brand hint (mesma lógica do Image Generator)
      let brandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        brandHint = `${brandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-video-gen`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image_url: sourceImage, // data URL ou null
          duration,
          aspect_ratio: aspectRatio,
          enable_audio: enableAudio,
          mode,
          resolution,
          provider: "piapi",
          brand_id: brandId === "none" ? null : brandId,
          market: marketCode,
          brand_hint: brandHint,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; video_url?: string; memory_id?: string; duration_s?: number; message?: string; error?: string };
      try { payload = JSON.parse(text); } catch { setError(`Resposta inválida: ${text.slice(0, 150)}`); return; }
      if (!payload.ok || !payload.video_url) {
        setError(payload.message || payload.error || "Falha na geração");
        return;
      }
      const asset: VideoAsset = {
        id: payload.memory_id || `${Date.now()}`,
        video_url: payload.video_url,
        prompt: prompt.trim(),
        duration_s: payload.duration_s || duration,
        aspect_ratio: aspectRatio,
        resolution,
        brand_id: brandId === "none" ? undefined : brandId,
        market: marketCode || undefined,
        created_at: new Date().toISOString(),
      };
      setResult(asset);
      reloadGallery();
    } catch (e) {
      setError(String(e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = useMemo(() => {
    const all = Object.values(HUB_BRANDS);
    if (!brandSearch.trim()) return all;
    const s = brandSearch.toLowerCase();
    return all.filter(b => b.name.toLowerCase().includes(s) || b.id.toLowerCase().includes(s));
  }, [brandSearch]);

  return (
    <>
      <Helmet>
        <title>{t("title")} — Hub</title>
      </Helmet>
      <div style={{ minHeight: "100%", background: "#06070a", color: "#fff", padding: "24px 28px" }}>
        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <button onClick={() => navigate("/dashboard/hub")} style={btnGhost}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", maxWidth: 720 }}>{t("subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, maxWidth: 1280 }}>
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
                    <button
                      key={m}
                      onClick={() => setMarketCode(m)}
                      style={pillStyle(marketCode === m)}
                    >
                      {HUB_MARKETS[m]?.flag} {HUB_MARKETS[m]?.labels[lang] || m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Source image */}
            <div style={section}>
              <div style={sectionLabel}>{t("source")}</div>
              <div style={hint}>{t("sourceDesc")}</div>
              {sourceImage ? (
                <div style={{ marginTop: 8, position: "relative" }}>
                  <img src={sourceImage} alt="source" style={{
                    width: "100%", maxHeight: 200, objectFit: "contain",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{sourceFileName}</span>
                    <button onClick={removeSourceImage} style={btnGhost}>
                      <X size={11} /> {t("removeSource")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => sourceInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setSourceDragOver(true); }}
                  onDragLeave={() => setSourceDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setSourceDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) onSourceFile(f);
                  }}
                  style={{
                    marginTop: 8,
                    border: `1.5px dashed ${sourceDragOver ? "#3B82F6" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 10,
                    padding: 24,
                    textAlign: "center",
                    cursor: "pointer",
                    background: sourceDragOver ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <Upload size={20} style={{ color: "#3B82F6", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t("uploadImage")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>PNG / JPG / WEBP — até 5MB</div>
                </div>
              )}
              <input
                ref={sourceInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onSourceFile(f);
                }}
              />
              {sourceError && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#F87171" }}>
                  <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                  {sourceError}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div style={section}>
              <div style={sectionLabel}>{t("prompt")}</div>
              <div style={hint}>{t("promptDesc")}</div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, 600))}
                placeholder={t("promptPh")}
                rows={5}
                style={{
                  marginTop: 8,
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  resize: "vertical",
                  minHeight: 100,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.40)", marginTop: 4, textAlign: "right" }}>{prompt.length} / 600</div>
            </div>

            {/* Format */}
            <div style={section}>
              <div style={sectionLabel}>{t("format")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["16:9", "9:16", "1:1"] as const).map(ar => (
                  <button key={ar} onClick={() => setAspectRatio(ar)} style={pillStyle(aspectRatio === ar)}>
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div style={section}>
              <div style={sectionLabel}>{t("duration")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[5, 10].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: duration === d ? "1px solid #A78BFA" : "1px solid rgba(255,255,255,0.08)",
                      background: duration === d ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.02)",
                      color: duration === d ? "#A78BFA" : "rgba(255,255,255,0.7)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution + Mode */}
            <div style={{ ...section, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={sectionLabel}>{t("resolution")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["720p", "1080p"] as const).map(r => (
                    <button key={r} onClick={() => setResolution(r)} style={pillStyle(resolution === r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={sectionLabel}>{t("mode")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setMode("std")} style={pillStyle(mode === "std")}>{t("modeStd")}</button>
                  <button onClick={() => setMode("pro")} style={pillStyle(mode === "pro")}>{t("modePro")}</button>
                </div>
              </div>
            </div>

            {/* Audio toggle */}
            <div style={section}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={enableAudio}
                  onChange={e => setEnableAudio(e.target.checked)}
                />
                <span>{t("audio")}</span>
              </label>
              <div style={{ ...hint, marginTop: 4 }}>{t("audioDesc")}</div>
            </div>

            {/* Cost preview */}
            <div style={{
              padding: "10px 12px",
              background: "rgba(139,92,246,0.10)",
              border: "1px solid rgba(139,92,246,0.20)",
              borderRadius: 8,
              fontSize: 11.5,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 14,
            }}>
              <strong style={{ color: "#A78BFA" }}>{t("cost")}:</strong> ~${estCost} USD <span style={{ opacity: 0.6 }}>({duration}s · {resolution} · {enableAudio ? "audio on" : "audio off"} · {mode})</span>
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={loading || prompt.trim().length < 5}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: loading ? "rgba(139,92,246,0.40)" : "#8B5CF6",
                border: "1px solid #8B5CF6",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading || prompt.trim().length < 5 ? "not-allowed" : "pointer",
                opacity: prompt.trim().length < 5 ? 0.5 : 1,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <Loader size={14} className="spin" />
                  {t("generating")}
                </>
              ) : (
                <>
                  <VideoIcon size={14} />
                  {t("generate")}
                </>
              )}
            </button>
            {loading && (
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.50)", textAlign: "center" }}>
                {t("generatingHint")}
              </div>
            )}
            {error && (
              <div style={{ marginTop: 10, padding: 10, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.20)", borderRadius: 8, fontSize: 11.5, color: "#FCA5A5" }}>
                <AlertTriangle size={11} style={{ display: "inline", marginRight: 6 }} />
                {error}
              </div>
            )}
          </div>

          {/* RIGHT — preview + galeria */}
          <div>
            <div style={panelStyle}>
              <div style={sectionLabel}>{t("preview")}</div>
              {result ? (
                <>
                  <video
                    src={result.video_url}
                    controls
                    autoPlay
                    loop
                    muted
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "#000",
                      marginTop: 8,
                    }}
                  />
                  <div style={{ marginTop: 10, fontSize: 11.5, color: "rgba(255,255,255,0.65)" }}>
                    {result.duration_s}s · {result.aspect_ratio} · {result.resolution}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <a
                      href={result.video_url}
                      download={`video_${result.id}.mp4`}
                      style={{
                        ...btnPrimary,
                        flex: 1,
                        textDecoration: "none",
                        justifyContent: "center",
                      }}
                    >
                      <Download size={13} /> {t("download")}
                    </a>
                    <button onClick={generate} disabled={loading} style={{ ...btnGhost, justifyContent: "center", flex: 1 }}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  marginTop: 8,
                  aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "9:16" ? "9/16" : "1/1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.10)",
                  borderRadius: 10,
                  color: "rgba(255,255,255,0.40)",
                }}>
                  {loading ? (
                    <>
                      <Loader size={28} className="spin" style={{ color: "#8B5CF6" }} />
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{t("generating")}</div>
                    </>
                  ) : (
                    <>
                      <VideoIcon size={32} style={{ opacity: 0.4 }} />
                      <div style={{ fontSize: 12 }}>{t("emptyHint")}</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Recent gallery */}
            <div style={{ ...panelStyle, marginTop: 14 }}>
              <div style={sectionLabel}>{t("recent")}</div>
              {recent.length === 0 ? (
                <div style={hint}>{t("recentEmpty")}</div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 8,
                  marginTop: 8,
                }}>
                  {recent.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setResult(v)}
                      style={{
                        cursor: "pointer",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "#000",
                      }}
                    >
                      <video
                        src={v.video_url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                        onMouseLeave={e => { const v2 = e.currentTarget as HTMLVideoElement; v2.pause(); v2.currentTime = 0; }}
                      />
                      <div style={{ padding: "5px 7px", fontSize: 10.5, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.duration_s}s · {v.aspect_ratio}
                      </div>
                    </div>
                  ))}
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
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
            maxWidth: 480, width: "100%", maxHeight: "80vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>{t("brand")}</h3>
              <button onClick={() => setBrandModalOpen(false)} style={btnGhost}>
                <X size={12} />
              </button>
            </div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.40)" }} />
                <input
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  placeholder={lang === "pt" ? "Buscar marca..." : "Search brand..."}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
              <button
                onClick={() => { setBrandId("none"); setBrandModalOpen(false); }}
                style={brandCardStyle(brandId === "none")}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{t("noBrand")}</div>
              </button>
              {filteredBrands.filter(b => b.id !== "none").map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBrandId(b.id); setBrandModalOpen(false); }}
                  style={brandCardStyle(brandId === b.id)}
                >
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

// ── Styles ────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "18px 20px",
};

const section: React.CSSProperties = { marginBottom: 16 };

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
  marginBottom: 6,
};

const hint: React.CSSProperties = {
  fontSize: 11.5,
  color: "rgba(255,255,255,0.45)",
  lineHeight: 1.5,
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  color: "rgba(255,255,255,0.75)",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: "#8B5CF6",
  border: "1px solid #8B5CF6",
  borderRadius: 6,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const brandSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12.5,
  fontFamily: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  textAlign: "left",
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "7px 10px",
    background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#8B5CF6" : "rgba(255,255,255,0.10)"}`,
    borderRadius: 6,
    color: active ? "#A78BFA" : "rgba(255,255,255,0.70)",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function brandCardStyle(active: boolean): React.CSSProperties {
  return {
    padding: "12px",
    background: active ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "#8B5CF6" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 10,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  };
}
