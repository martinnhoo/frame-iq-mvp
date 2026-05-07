/**
 * HubFaceswap — face swap (Brilliant Hub).
 *
 * Layout: 2-coluna no desktop, single-column no mobile.
 *
 * Modos (toggle no topo):
 *   - "image": troca rosto numa foto. Usa Qubico/image-toolkit. ~$0.01/call.
 *   - "video": troca rosto num MP4. Usa Qubico/video-toolkit. Pricing por frame.
 *
 * Inputs:
 *   - "Rosto novo" (swap_image): imagem com a face que vai ser usada.
 *     Sempre uma imagem (PNG/JPG/WEBP).
 *   - "Imagem destino" / "Vídeo destino" (target): onde a face vai ser trocada.
 *     - mode=image → imagem
 *     - mode=video → MP4 (≤10MB, ≤720p, ≤600 frames)
 *
 * Backend: chama edge function hub-faceswap → PiAPI.
 *
 * Salva em hub_assets kind='hub_faceswap' — Library mostra junto com o resto.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  ScanFace, Download, RefreshCw, ArrowLeft, AlertTriangle,
  ChevronDown, Search, Upload, X, Loader, ImageIcon, Video as VideoIcon,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { uploadAssetToStorage } from "@/lib/uploadAssetToStorage";

// ── i18n minimal — Hub só usa pt/en/es/zh ─────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",         en: "Back to Hub",          es: "Volver al Hub",         zh: "返回中心" },
  title:          { pt: "Face Swap",             en: "Face Swap",            es: "Face Swap",             zh: "换脸" },
  subtitle:       { pt: "Troque o rosto em fotos ou vídeos com IA. Igual o Higgsfield.",
                    en: "Swap faces in photos or videos with AI. Like Higgsfield.",
                    es: "Cambia el rostro en fotos o videos con IA. Como Higgsfield.",
                    zh: "用 AI 换脸 — 照片或视频。像 Higgsfield 一样。" },
  modeImage:      { pt: "Imagem",                en: "Image",                es: "Imagen",                zh: "图像" },
  modeVideo:      { pt: "Vídeo",                 en: "Video",                es: "Video",                 zh: "视频" },
  modeImageDesc:  { pt: "Troque o rosto numa foto. Resultado em segundos.",
                    en: "Swap the face in a photo. Result in seconds.",
                    es: "Cambia el rostro en una foto. Resultado en segundos.",
                    zh: "在照片中换脸 — 几秒钟得到结果。" },
  modeVideoDesc:  { pt: "Troque o rosto num MP4. Mantém movimento natural.",
                    en: "Swap the face in an MP4. Keeps natural motion.",
                    es: "Cambia el rostro en un MP4. Mantiene movimiento natural.",
                    zh: "在 MP4 中换脸 — 保持自然动作。" },
  brand:          { pt: "Marca (opcional)",      en: "Brand (optional)",     es: "Marca (opcional)",      zh: "品牌（可选）" },
  brandSelect:    { pt: "Selecionar marca",      en: "Select brand",         es: "Seleccionar marca",     zh: "选择品牌" },
  noBrand:        { pt: "Sem marca",             en: "No brand",             es: "Sin marca",             zh: "无品牌" },
  swapFace:       { pt: "Rosto novo (face que vai entrar)",
                    en: "New face (face to use)",
                    es: "Rostro nuevo (rostro a usar)",
                    zh: "新脸（要使用的脸）" },
  swapFaceDesc:   { pt: "Imagem com o rosto que vai ser colocado no destino.",
                    en: "Image with the face that will be placed on the target.",
                    es: "Imagen con el rostro que se colocará en el destino.",
                    zh: "包含要放置在目标上的脸的图像。" },
  targetImage:    { pt: "Imagem destino (onde o rosto entra)",
                    en: "Target image (where the face goes)",
                    es: "Imagen destino (donde va el rostro)",
                    zh: "目标图像（脸要去的地方）" },
  targetImageDesc:{ pt: "Foto onde o rosto novo vai aparecer.",
                    en: "Photo where the new face will appear.",
                    es: "Foto donde aparecerá el rostro nuevo.",
                    zh: "新脸将出现的照片。" },
  targetVideo:    { pt: "Vídeo destino (onde o rosto entra)",
                    en: "Target video (where the face goes)",
                    es: "Video destino (donde va el rostro)",
                    zh: "目标视频（脸要去的地方）" },
  targetVideoDesc:{ pt: "MP4 ≤10MB, ≤720p, ≤600 frames. Mantém ângulos e movimento.",
                    en: "MP4 ≤10MB, ≤720p, ≤600 frames. Keeps angles and motion.",
                    es: "MP4 ≤10MB, ≤720p, ≤600 frames. Mantiene ángulos y movimiento.",
                    zh: "MP4 ≤10MB, ≤720p, ≤600 帧。保留角度和动作。" },
  uploadImage:    { pt: "Clique pra enviar imagem", en: "Click to upload image", es: "Click para subir imagen", zh: "点击上传图像" },
  uploadVideo:    { pt: "Clique pra enviar MP4",    en: "Click to upload MP4",    es: "Click para subir MP4",    zh: "点击上传 MP4" },
  remove:         { pt: "Remover",               en: "Remove",               es: "Quitar",                zh: "删除" },
  generate:       { pt: "Trocar rosto",          en: "Swap face",            es: "Cambiar rostro",        zh: "换脸" },
  generating:     { pt: "Processando…",          en: "Processing…",          es: "Procesando…",           zh: "处理中..." },
  generatingHint: { pt: "Imagem leva ~10s. Vídeo leva 30-120s. Não feche essa página.",
                    en: "Image takes ~10s. Video takes 30-120s. Don't close this page.",
                    es: "Imagen tarda ~10s. Video tarda 30-120s. No cierres esta página.",
                    zh: "图像需要约 10 秒。视频需要 30-120 秒。不要关闭页面。" },
  preview:        { pt: "Resultado",             en: "Result",               es: "Resultado",             zh: "结果" },
  emptyHint:      { pt: "Seu resultado vai aparecer aqui.",
                    en: "Your result will appear here.",
                    es: "Tu resultado aparecerá aquí.",
                    zh: "您的结果将出现在这里。" },
  download:       { pt: "Baixar",                en: "Download",             es: "Descargar",             zh: "下载" },
  variation:      { pt: "Trocar de novo",        en: "Swap again",           es: "Cambiar otra vez",      zh: "再次换脸" },
  recent:         { pt: "Últimas trocas",        en: "Recent swaps",         es: "Últimos cambios",       zh: "最近的换脸" },
  recentEmpty:    { pt: "Sem trocas ainda. Faça a primeira acima!",
                    en: "No swaps yet. Make your first above!",
                    es: "Sin cambios aún. ¡Haz el primero arriba!",
                    zh: "还没有换脸。在上面进行第一个！" },
  errFile:        { pt: "Arquivo inválido. Use PNG/JPG até 5MB.",
                    en: "Invalid file. Use PNG/JPG up to 5MB.",
                    es: "Archivo inválido. Usa PNG/JPG hasta 5MB.",
                    zh: "文件无效。使用 PNG/JPG，最大 5MB。" },
  errVideoFile:   { pt: "Vídeo inválido. Use MP4 até 10MB.",
                    en: "Invalid video. Use MP4 up to 10MB.",
                    es: "Video inválido. Usa MP4 hasta 10MB.",
                    zh: "视频无效。使用 MP4，最大 10MB。" },
  errMissing:     { pt: "Envie o rosto novo e o destino antes de gerar.",
                    en: "Upload both the new face and the target before generating.",
                    es: "Sube el rostro nuevo y el destino antes de generar.",
                    zh: "在生成前上传新脸和目标。" },
  errPrep:        { pt: "Não consegui preparar os arquivos. Tenta enviar de novo.",
                    en: "Could not prepare the files. Try uploading again.",
                    es: "No pude preparar los archivos. Inténtalo de nuevo.",
                    zh: "无法准备文件。请重试上传。" },
  sessionExpired: { pt: "Sessão expirada. Faça login.",
                    en: "Session expired. Sign in.",
                    es: "Sesión expirada. Inicia sesión.",
                    zh: "会话已过期。请登录。" },
  cost:           { pt: "Custo estimado",        en: "Estimated cost",       es: "Costo estimado",        zh: "预估费用" },
  costImage:      { pt: "~$0,01",                en: "~$0.01",               es: "~$0,01",                zh: "约 $0.01" },
  costVideo:      { pt: "~$0,10–$0,40 (depende da duração)",
                    en: "~$0.10–$0.40 (depends on duration)",
                    es: "~$0,10–$0,40 (depende de la duración)",
                    zh: "约 $0.10–$0.40（取决于时长）" },
};

// ── Limites ───────────────────────────────────────────────────────
const IMG_MAX_BYTES = 5 * 1024 * 1024;   // 5MB pra imagens
const VIDEO_MAX_BYTES = 10 * 1024 * 1024; // 10MB pra vídeo destino (PiAPI limit)

interface FaceswapAsset {
  id: string;
  mode: "image" | "video";
  output_url: string;
  swap_image_url: string;
  target_url: string;
  brand_id?: string;
  created_at: string;
}

export default function HubFaceswap() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;
  const isMobile = useIsMobile();

  // Mode (image vs video)
  const [mode, setMode] = useState<"image" | "video">("image");

  // Brand
  const [brandId, setBrandId] = useState("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);

  // Files (data URLs no client)
  const [swapImage, setSwapImage] = useState<string | null>(null);
  const [swapImageName, setSwapImageName] = useState<string>("");
  const [swapImageError, setSwapImageError] = useState<string | null>(null);

  const [targetFile, setTargetFile] = useState<string | null>(null); // data URL (img) ou objectURL (video)
  const [targetFileName, setTargetFileName] = useState<string>("");
  const [targetFileError, setTargetFileError] = useState<string | null>(null);
  const [targetIsVideo, setTargetIsVideo] = useState(false); // pra preview correto

  // For video target — guardamos o File real pra fazer upload depois
  // (pra video data URL fica gigante; objectURL não funciona pra upload pro Storage server)
  const [targetVideoFile, setTargetVideoFile] = useState<File | null>(null);

  // UI state
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const swapInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  // Async state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceswapAsset | null>(null);
  const [recent, setRecent] = useState<FaceswapAsset[]>([]);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);

  // Load gallery
  const reloadGallery = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: dbErr } = await supabase
        .from("hub_assets")
        .select("id, content, created_at")
        .eq("user_id", user.id)
        .eq("kind" as never, "hub_faceswap" as never)
        .order("created_at", { ascending: false })
        .limit(8);
      if (dbErr || !data) return;
      const items: FaceswapAsset[] = data.map(r => {
        const c = r.content as Record<string, unknown>;
        const m = ((c.mode as string) === "video" ? "video" : "image") as "image" | "video";
        return {
          id: r.id as string,
          mode: m,
          output_url: (c.output_url as string) || (c.image_url as string) || (c.video_url as string) || "",
          swap_image_url: (c.swap_image_url as string) || "",
          target_url: (c.target_url as string) || "",
          brand_id: c.brand_id as string | undefined,
          created_at: r.created_at as string,
        };
      });
      setRecent(items);
    } catch { /* silent */ }
  };

  useEffect(() => { reloadGallery(); }, []);

  // Reset market when brand changes
  useEffect(() => {
    if (brand?.markets?.length) {
      if (!marketCode || !brand.markets.includes(marketCode)) {
        setMarketCode(brand.markets[0]);
      }
    } else {
      setMarketCode(null);
    }
  }, [brand]);

  // Reset target when mode changes (image ↔ video)
  useEffect(() => {
    setTargetFile(null);
    setTargetFileName("");
    setTargetVideoFile(null);
    setTargetIsVideo(false);
    setTargetFileError(null);
    if (targetInputRef.current) targetInputRef.current.value = "";
  }, [mode]);

  // ── File handlers ──────────────────────────────────────────────
  const onSwapImageFile = (file: File) => {
    setSwapImageError(null);
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setSwapImageError(t("errFile"));
      return;
    }
    if (file.size > IMG_MAX_BYTES) {
      setSwapImageError(t("errFile"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSwapImage(reader.result as string);
      setSwapImageName(file.name);
    };
    reader.onerror = () => setSwapImageError(t("errFile"));
    reader.readAsDataURL(file);
  };

  const onTargetFile = (file: File) => {
    setTargetFileError(null);

    if (mode === "image") {
      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
        setTargetFileError(t("errFile"));
        return;
      }
      if (file.size > IMG_MAX_BYTES) {
        setTargetFileError(t("errFile"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setTargetFile(reader.result as string);
        setTargetFileName(file.name);
        setTargetIsVideo(false);
        setTargetVideoFile(null);
      };
      reader.onerror = () => setTargetFileError(t("errFile"));
      reader.readAsDataURL(file);
    } else {
      // video mode — só MP4, ≤10MB, ≤720p, ≤600 frames (limites PiAPI)
      if (!/^video\/mp4$/i.test(file.type)) {
        setTargetFileError(t("errVideoFile"));
        return;
      }
      if (file.size > VIDEO_MAX_BYTES) {
        setTargetFileError(t("errVideoFile"));
        return;
      }
      // Valida resolução E duração via <video> metadata. PiAPI rejeita
      // silenciosamente vídeos >720p ou >600 frames, retornando
      // "code:500, input:null, status:failed" sem mensagem clara.
      const objUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const dur = video.duration;
        const maxDim = Math.max(w, h);
        // PiAPI: max 720p (significa lado maior ≤ 1280, ou ≤ 720
        // dependendo de orientação). Pra ser conservador: ≤ 1280
        if (maxDim > 1280) {
          URL.revokeObjectURL(objUrl);
          setTargetFileError(
            lang === "pt" ? `Vídeo é ${w}x${h}. PiAPI aceita até 720p (1280x720). Reduz a resolução e tenta de novo.` :
            lang === "es" ? `Video es ${w}x${h}. PiAPI acepta hasta 720p (1280x720). Reduce la resolución.` :
            lang === "zh" ? `视频是 ${w}x${h}。PiAPI 接受最高 720p (1280x720)。请减小分辨率。` :
            `Video is ${w}x${h}. PiAPI accepts up to 720p (1280x720). Reduce resolution and retry.`
          );
          return;
        }
        // ≤600 frames: assumindo 30fps, dur ≤ 20s. Usar 25s pra margem.
        if (dur > 25) {
          URL.revokeObjectURL(objUrl);
          setTargetFileError(
            lang === "pt" ? `Vídeo tem ${dur.toFixed(1)}s. PiAPI aceita até ~20s (600 frames a 30fps).` :
            lang === "es" ? `Video tiene ${dur.toFixed(1)}s. PiAPI acepta hasta ~20s.` :
            lang === "zh" ? `视频时长 ${dur.toFixed(1)}秒。PiAPI 最多接受 ~20 秒。` :
            `Video is ${dur.toFixed(1)}s. PiAPI accepts up to ~20s (600 frames at 30fps).`
          );
          return;
        }
        // OK — passa
        setTargetFile(objUrl);
        setTargetFileName(file.name);
        setTargetIsVideo(true);
        setTargetVideoFile(file);
      };
      video.onerror = () => {
        URL.revokeObjectURL(objUrl);
        setTargetFileError(t("errVideoFile"));
      };
      video.src = objUrl;
      return; // não cai no fallthrough — handler async
    }
  };

  const removeSwapImage = () => {
    setSwapImage(null);
    setSwapImageName("");
    if (swapInputRef.current) swapInputRef.current.value = "";
  };

  const removeTarget = () => {
    if (targetFile?.startsWith("blob:")) URL.revokeObjectURL(targetFile);
    setTargetFile(null);
    setTargetFileName("");
    setTargetIsVideo(false);
    setTargetVideoFile(null);
    if (targetInputRef.current) targetInputRef.current.value = "";
  };

  // ── Upload video file pro Storage e retorna URL pública ────────
  // Pra mode=video, target_url precisa ser HTTP, não data URL.
  // uploadAssetToStorage só funciona pra data URL de imagem.
  // Aqui, fazemos manual.
  const uploadVideoToStorage = async (file: File): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return null;

      const path = `${userId}/faceswap-target/${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await supabase.storage.from("hub-images").upload(path, file, {
        contentType: "video/mp4",
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) {
        console.warn("[faceswap] upload video failed:", upErr.message);
        return null;
      }
      const { data: urlData } = supabase.storage.from("hub-images").getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch (e) {
      console.warn("[faceswap] upload video exception:", e);
      return null;
    }
  };

  // ── Generate ────────────────────────────────────────────────────
  const generate = async () => {
    if (loading) return;
    if (!swapImage || !targetFile) {
      setError(t("errMissing"));
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); setLoading(false); return; }

      // 1. Upload swap_image (sempre imagem) pro Storage
      let swapImageUrl = swapImage;
      if (swapImageUrl.startsWith("data:")) {
        swapImageUrl = await uploadAssetToStorage(swapImageUrl, "faceswap-source");
        if (swapImageUrl.startsWith("data:")) {
          setError(t("errPrep"));
          return;
        }
      }

      // 2. Upload target (image data URL OU video File) pro Storage
      let targetUrl: string | null = null;
      if (mode === "image") {
        if (targetFile.startsWith("data:")) {
          const uploaded = await uploadAssetToStorage(targetFile, "faceswap-target");
          if (uploaded.startsWith("data:")) {
            setError(t("errPrep"));
            return;
          }
          targetUrl = uploaded;
        } else {
          targetUrl = targetFile; // já é URL
        }
      } else {
        // video — usa File real
        if (!targetVideoFile) {
          setError(t("errPrep"));
          return;
        }
        targetUrl = await uploadVideoToStorage(targetVideoFile);
        if (!targetUrl) {
          setError(t("errPrep"));
          return;
        }
      }

      // 3. Chama edge function
      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-faceswap`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          mode,
          target_url: targetUrl,
          swap_image_url: swapImageUrl,
          brand_id: brandId === "none" ? null : brandId,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; output_url?: string; memory_id?: string; mode?: string; message?: string; error?: string };
      try { payload = JSON.parse(text); } catch {
        setError(`Resposta inválida: ${text.slice(0, 150)}`);
        return;
      }
      if (!payload.ok || !payload.output_url) {
        setError(payload.message || payload.error || "Falha na geração");
        return;
      }

      const asset: FaceswapAsset = {
        id: payload.memory_id || `${Date.now()}`,
        mode,
        output_url: payload.output_url,
        swap_image_url: swapImageUrl,
        target_url: targetUrl,
        brand_id: brandId === "none" ? undefined : brandId,
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

  // ── Download cross-origin (fetch + blob) ────────────────────────
  // O atributo HTML `download` é IGNORADO quando href é cross-origin
  // (PiAPI ou storage.theapi.app). Pra forçar download em qualquer caso,
  // baixa o blob, cria object URL e dispara click programático.
  const downloadResult = async (asset: FaceswapAsset) => {
    if (!asset.output_url) return;
    try {
      const r = await fetch(asset.output_url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `faceswap_${asset.id}.${asset.mode === "video" ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // libera memória após 1s (tempo do browser registrar o download)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      console.warn("[faceswap] download failed:", e);
      // Fallback: abre em nova aba (user salva manualmente com botão direito)
      window.open(asset.output_url, "_blank");
    }
  };

  const filteredBrands = useMemo(() => {
    const all = Object.values(HUB_BRANDS);
    if (!brandSearch.trim()) return all;
    const s = brandSearch.toLowerCase();
    return all.filter(b => b.name.toLowerCase().includes(s) || b.id.toLowerCase().includes(s));
  }, [brandSearch]);

  const canGenerate = !!swapImage && !!targetFile && !loading;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>{t("title")} — Hub</title>
      </Helmet>
      <div style={{ minHeight: "100%", background: "#06070a", color: "#fff", padding: isMobile ? "16px 14px 28px" : "24px 28px" }}>
        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard/hub")} style={btnGhost}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", maxWidth: 720 }}>{t("subtitle")}</p>
        </div>

        {/* Mode toggle (top, full width on mobile) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 18,
          maxWidth: 460,
        }}>
          <button onClick={() => setMode("image")} style={modeBtnStyle(mode === "image")}>
            <ImageIcon size={isMobile ? 16 : 18} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t("modeImage")}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.65 }}>{t("modeImageDesc")}</span>
            </div>
          </button>
          <button onClick={() => setMode("video")} style={modeBtnStyle(mode === "video")}>
            <VideoIcon size={isMobile ? 16 : 18} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t("modeVideo")}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.65 }}>{t("modeVideoDesc")}</span>
            </div>
          </button>
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

            {/* Swap image (rosto novo) */}
            <div style={section}>
              <div style={sectionLabel}>{t("swapFace")}</div>
              <div style={hint}>{t("swapFaceDesc")}</div>
              {swapImage ? (
                <div style={{ marginTop: 8 }}>
                  <img src={swapImage} alt="swap" style={previewImg} />
                  <div style={fileRow}>
                    <span style={fileNameStyle}>{swapImageName}</span>
                    <button onClick={removeSwapImage} style={btnGhost}>
                      <X size={11} /> {t("remove")}
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => swapInputRef.current?.click()} style={uploadBoxStyle(false)}>
                  <Upload size={20} style={{ color: "#8B5CF6", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t("uploadImage")}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>PNG / JPG / WEBP — até 5MB</div>
                </div>
              )}
              <input
                ref={swapInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onSwapImageFile(f); }}
              />
              {swapImageError && (
                <div style={errMsgStyle}>
                  <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                  {swapImageError}
                </div>
              )}
            </div>

            {/* Target (image OR video, depende do mode) */}
            <div style={section}>
              <div style={sectionLabel}>
                {mode === "image" ? t("targetImage") : t("targetVideo")}
              </div>
              <div style={hint}>
                {mode === "image" ? t("targetImageDesc") : t("targetVideoDesc")}
              </div>
              {targetFile ? (
                <div style={{ marginTop: 8 }}>
                  {targetIsVideo ? (
                    <video
                      src={targetFile}
                      controls
                      muted
                      playsInline
                      style={{
                        width: "100%", maxHeight: 260, objectFit: "contain",
                        background: "#000",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                  ) : (
                    <img src={targetFile} alt="target" style={previewImg} />
                  )}
                  <div style={fileRow}>
                    <span style={fileNameStyle}>{targetFileName}</span>
                    <button onClick={removeTarget} style={btnGhost}>
                      <X size={11} /> {t("remove")}
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => targetInputRef.current?.click()} style={uploadBoxStyle(false)}>
                  <Upload size={20} style={{ color: "#8B5CF6", marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {mode === "image" ? t("uploadImage") : t("uploadVideo")}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
                    {mode === "image" ? "PNG / JPG / WEBP — até 5MB" : "MP4 — até 10MB"}
                  </div>
                </div>
              )}
              <input
                ref={targetInputRef}
                type="file"
                accept={mode === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4"}
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onTargetFile(f); }}
              />
              {targetFileError && (
                <div style={errMsgStyle}>
                  <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                  {targetFileError}
                </div>
              )}
            </div>

            {/* Cost */}
            <div style={{ ...section, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={sectionLabel}>{t("cost")}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#A78BFA" }}>
                  {mode === "image" ? t("costImage") : t("costVideo")}
                </span>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={!canGenerate}
              style={{
                ...btnPrimary,
                width: "100%",
                justifyContent: "center",
                padding: "12px",
                fontSize: 13.5,
                opacity: canGenerate ? 1 : 0.5,
                cursor: canGenerate ? "pointer" : "not-allowed",
              }}
            >
              {loading ? (
                <>
                  <Loader size={14} className="spin" /> {t("generating")}
                </>
              ) : (
                <>
                  <ScanFace size={14} /> {t("generate")}
                </>
              )}
            </button>
            {loading && (
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                {t("generatingHint")}
              </div>
            )}
            {error && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.30)", borderRadius: 6, fontSize: 11.5, color: "#FCA5A5" }}>
                <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                {error}
              </div>
            )}
          </div>

          {/* RIGHT — preview + recents */}
          <div>
            <div style={panelStyle}>
              <div style={sectionLabel}>{t("preview")}</div>
              {result ? (
                <>
                  {result.mode === "video" ? (
                    <video
                      src={result.output_url}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "#000",
                        marginTop: 8,
                      }}
                    />
                  ) : (
                    <img
                      src={result.output_url}
                      alt="result"
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.02)",
                        marginTop: 8,
                      }}
                    />
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => downloadResult(result)}
                      style={{
                        ...btnPrimary,
                        flex: 1,
                        justifyContent: "center",
                      }}
                    >
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={generate} disabled={loading} style={{ ...btnGhost, justifyContent: "center", flex: 1 }}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  marginTop: 8,
                  aspectRatio: "1/1",
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
                      <ScanFace size={32} style={{ opacity: 0.4 }} />
                      <div style={{ fontSize: 12, textAlign: "center", padding: "0 16px" }}>{t("emptyHint")}</div>
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
                  gridTemplateColumns: isMobile
                    ? "repeat(auto-fill, minmax(96px, 1fr))"
                    : "repeat(auto-fill, minmax(120px, 1fr))",
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
                      {v.mode === "video" ? (
                        <video
                          src={v.output_url}
                          muted
                          playsInline
                          preload="metadata"
                          style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                          onMouseLeave={e => { const v2 = e.currentTarget as HTMLVideoElement; v2.pause(); v2.currentTime = 0; }}
                        />
                      ) : (
                        <img
                          src={v.output_url}
                          alt="thumb"
                          loading="lazy"
                          decoding="async"
                          style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }}
                        />
                      )}
                      <div style={{ padding: "5px 7px", fontSize: 10.5, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.mode === "video" ? "MP4" : "IMG"}
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

const previewImg: React.CSSProperties = {
  width: "100%",
  maxHeight: 260,
  objectFit: "contain",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  display: "block",
};

const fileRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 6,
  gap: 8,
};

const fileNameStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flex: 1,
  minWidth: 0,
};

const errMsgStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#F87171",
};

function uploadBoxStyle(dragOver: boolean): React.CSSProperties {
  return {
    marginTop: 8,
    border: `1.5px dashed ${dragOver ? "#8B5CF6" : "rgba(255,255,255,0.12)"}`,
    borderRadius: 10,
    padding: 24,
    textAlign: "center",
    cursor: "pointer",
    background: dragOver ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)",
  };
}

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: active ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "#8B5CF6" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 10,
    color: active ? "#A78BFA" : "rgba(255,255,255,0.75)",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    transition: "background 0.15s, border-color 0.15s",
  };
}

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
