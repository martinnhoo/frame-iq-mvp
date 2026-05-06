/**
 * HubPngGenerator — gera PNGs com fundo transparente (SaaS-style refactor).
 *
 * 2 modos:
 *   1. Gerar do zero — descreve o asset, IA gera PNG transparente
 *   2. Converter imagem — sobe foto/imagem, descreve o que isolar,
 *      IA usa /v1/images/edits pra extrair o sujeito em PNG transparente
 *
 * Layout: 2-col SaaS (LEFT form, RIGHT preview + recent), match com
 * Image Studio / A/B Variations / Voice Gen.
 *
 * Reusa generate-image-hub edge function (passa input_image_base64
 * quando modo "Converter imagem").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Layers, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  Upload, X, Wand2, ImageIcon as ImageDownIcon,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";
import { composeImage } from "@/lib/composeImageWithLicense";
import { compressPngIfNeeded } from "@/lib/compressPng";
import { saveHubAsset } from "@/lib/saveHubAsset";
import { uploadAssetToStorage } from "@/lib/uploadAssetToStorage";
import type { Lang } from "@/data/hubBrands";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",           en: "Back to Hub",            es: "Volver al Hub",            zh: "返回中心" },
  title:          { pt: "Gerador de PNG",          en: "PNG Generator",          es: "Generador de PNG",         zh: "PNG 生成器" },
  subtitle:       { pt: "Crie PNGs com fundo transparente — gere do zero ou converta uma imagem existente.",
                   en: "Create PNGs with transparent background — generate from scratch or convert an existing image.",
                   es: "Crea PNGs con fondo transparente — genera desde cero o convierte una imagen existente.",
                   zh: "创建透明背景的 PNG — 从头生成或转换现有图像。" },
  // Mode tabs
  modeFromScratch:{ pt: "Gerar do zero",           en: "Generate from scratch",  es: "Generar desde cero",       zh: "从零生成" },
  modeFromImage:  { pt: "Converter imagem",        en: "Convert image",          es: "Convertir imagen",         zh: "转换图像" },
  // Section: Source image
  source:         { pt: "Imagem de origem",        en: "Source image",           es: "Imagen de origen",         zh: "源图像" },
  sourceHint:     { pt: "Sobe a imagem que você quer converter em PNG transparente.",
                   en: "Upload the image you want to convert to a transparent PNG.",
                   es: "Sube la imagen que quieres convertir a PNG transparente.",
                   zh: "上传您想转换为透明 PNG 的图像。" },
  uploadCta:      { pt: "Clique para enviar ou arraste",
                   en: "Click to upload or drag",
                   es: "Haz clic para subir o arrastra",
                   zh: "点击上传或拖动" },
  uploadHint:     { pt: "PNG, JPG ou WEBP até 10MB",
                   en: "PNG, JPG or WEBP up to 10MB",
                   es: "PNG, JPG o WEBP hasta 10MB",
                   zh: "PNG、JPG 或 WEBP 最大 10MB" },
  imageTooBig:    { pt: "Arquivo muito grande (max 10MB).",
                   en: "File too large (max 10MB).",
                   es: "Archivo demasiado grande (máx 10MB).",
                   zh: "文件过大（最大 10MB）。" },
  imageInvalidType:{ pt: "Use PNG, JPG ou WEBP.",  en: "Use PNG, JPG or WEBP.",  es: "Usa PNG, JPG o WEBP.",     zh: "请使用 PNG、JPG 或 WEBP。" },
  imageRemove:    { pt: "Remover",                 en: "Remove",                 es: "Eliminar",                 zh: "移除" },
  imageReady:     { pt: "Imagem pronta",           en: "Image ready",            es: "Imagen lista",             zh: "图像就绪" },
  // Section: Describe
  describeFromScratch: { pt: "Descreva o asset",   en: "Describe the asset",     es: "Describe el activo",       zh: "描述素材" },
  describeFromScratchHint: { pt: "O que a IA deve gerar do zero, em PNG transparente.",
                   en: "What the AI should generate from scratch, as a transparent PNG.",
                   es: "Lo que la IA debe generar desde cero, como PNG transparente.",
                   zh: "AI 应该从头生成什么，作为透明 PNG。" },
  describeFromScratchPh: { pt: "Ex: Mascote felino laranja sorridente de costume rosa, estilo cartoon vibrante",
                   en: "Ex: Smiling orange cat mascot in pink costume, vibrant cartoon style",
                   es: "Ej: Mascota felina naranja sonriente con traje rosa, estilo cartoon vibrante",
                   zh: "例：穿着粉色服装的橙色卡通猫吉祥物，鲜明动漫风格" },
  describeFromImage: { pt: "O que isolar",         en: "What to isolate",        es: "Qué aislar",               zh: "要隔离的内容" },
  describeFromImageHint: { pt: "Descreva o sujeito que deve ficar visível. O resto vira fundo transparente.",
                   en: "Describe the subject that should remain visible. Everything else becomes transparent.",
                   es: "Describe el sujeto que debe permanecer visible. El resto se vuelve transparente.",
                   zh: "描述应保持可见的主体。其他部分变为透明。" },
  describeFromImagePh: { pt: "Ex: O jogador de camisa vermelha em primeiro plano",
                   en: "Ex: The player wearing red in the foreground",
                   es: "Ej: El jugador con camiseta roja en primer plano",
                   zh: "例：前景中穿红色球衣的球员" },
  // Format / Quality
  format:         { pt: "Formato",                  en: "Format",                  es: "Formato",                  zh: "格式" },
  formatHint:     { pt: "Escolha o formato ideal pro asset.",
                   en: "Pick the ideal format for the asset.",
                   es: "Elige el formato ideal para el activo.",
                   zh: "选择素材的理想格式。" },
  fmtSquareTitle: { pt: "Quadrado",                 en: "Square",                  es: "Cuadrado",                 zh: "方形" },
  fmtSquareDesc:  { pt: "Asset, post, ícone",       en: "Asset, post, icon",       es: "Asset, post, ícono",       zh: "素材、帖子、图标" },
  fmtVerticalTitle:{ pt: "Vertical",                en: "Vertical",                es: "Vertical",                 zh: "垂直" },
  fmtVerticalDesc:{ pt: "Reels, Story",             en: "Reels, Story",            es: "Reels, Story",             zh: "Reels、Story" },
  fmtHorizontalTitle:{ pt: "Horizontal",            en: "Horizontal",              es: "Horizontal",               zh: "横向" },
  fmtHorizontalDesc:{ pt: "Banner, capa",           en: "Banner, cover",           es: "Banner, portada",          zh: "横幅、封面" },
  quality:        { pt: "Qualidade",                en: "Quality",                  es: "Calidad",                  zh: "质量" },
  qualityHint:    { pt: "Defina o nível de qualidade.",
                   en: "Set the quality level.",
                   es: "Define el nivel de calidad.",
                   zh: "设置质量级别。" },
  qDraft:         { pt: "Rascunho",                 en: "Draft",                   es: "Borrador",                 zh: "草稿" },
  qDraftDesc:     { pt: "Mais rápido",              en: "Faster",                  es: "Más rápido",               zh: "更快" },
  qMedium:        { pt: "Médio",                    en: "Medium",                  es: "Medio",                    zh: "中等" },
  qMediumDesc:    { pt: "Recomendado",              en: "Recommended",             es: "Recomendado",              zh: "推荐" },
  qHigh:          { pt: "Alta",                     en: "High",                    es: "Alta",                     zh: "高" },
  qHighDesc:      { pt: "Mais detalhes",            en: "More detail",             es: "Más detalles",             zh: "更多细节" },
  // CTA
  generate:       { pt: "Gerar PNG",                en: "Generate PNG",            es: "Generar PNG",              zh: "生成 PNG" },
  generateConvert:{ pt: "Converter para PNG",       en: "Convert to PNG",          es: "Convertir a PNG",          zh: "转换为 PNG" },
  generating:     { pt: "Gerando…",                 en: "Generating…",             es: "Generando…",               zh: "生成中…" },
  autoSaved:      { pt: "Seu PNG será salvo automaticamente na Biblioteca.",
                   en: "Your PNG will be auto-saved to the Library.",
                   es: "Tu PNG se guardará automáticamente en la Biblioteca.",
                   zh: "您的 PNG 将自动保存到资源库。" },
  // Right column
  preview:        { pt: "Prévia",                   en: "Preview",                 es: "Vista previa",             zh: "预览" },
  previewHint:    { pt: "Seu PNG aparecerá aqui (fundo xadrez = transparente).",
                   en: "Your PNG will appear here (checkered background = transparent).",
                   es: "Tu PNG aparecerá aquí (fondo a cuadros = transparente).",
                   zh: "您的 PNG 将显示在这里（棋盘背景 = 透明）。" },
  emptyTitle:     { pt: "Seu PNG aparecerá aqui",   en: "Your PNG will appear here",es: "Tu PNG aparecerá aquí",   zh: "您的 PNG 将在此处显示" },
  emptyDesc:      { pt: "Configure os controles ao lado e clique em Gerar PNG.",
                   en: "Configure the controls and click Generate PNG.",
                   es: "Configura los controles y haz clic en Generar PNG.",
                   zh: "配置控件并点击生成 PNG。" },
  download:       { pt: "Baixar",                   en: "Download",                es: "Descargar",                zh: "下载" },
  variation:      { pt: "Gerar variação",           en: "Generate variation",      es: "Generar variación",        zh: "生成变体" },
  recent:         { pt: "Últimas gerações",         en: "Latest generations",      es: "Últimas generaciones",     zh: "最近生成" },
  recentHint:     { pt: "Seus últimos PNGs gerados.",
                   en: "Your last generated PNGs.",
                   es: "Tus últimos PNGs generados.",
                   zh: "您最近生成的 PNG。" },
  seeAll:         { pt: "Ver todos",                en: "See all",                 es: "Ver todos",                zh: "查看全部" },
  // Verify
  verifyTitle:    { pt: "Verifique sua organização OpenAI",
                   en: "Verify your OpenAI organization",
                   es: "Verifica tu organización OpenAI",
                   zh: "验证您的 OpenAI 组织" },
  verifyBtn:      { pt: "Verificar agora →",        en: "Verify now →",            es: "Verificar ahora →",        zh: "立即验证 →" },
  verifyClose:    { pt: "Fechar",                   en: "Close",                   es: "Cerrar",                   zh: "关闭" },
  // Errors
  promptTooShort: { pt: "Descreva com pelo menos 5 caracteres.",
                   en: "Describe with at least 5 characters.",
                   es: "Describe con al menos 5 caracteres.",
                   zh: "请用至少 5 个字符描述。" },
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
  noImage:        { pt: "Sobe uma imagem antes de gerar.",
                   en: "Upload an image before generating.",
                   es: "Sube una imagen antes de generar.",
                   zh: "生成前请先上传图像。" },
};

const FORMATS = [
  { id: "1:1",  titleKey: "fmtSquareTitle",     descKey: "fmtSquareDesc"     },
  { id: "9:16", titleKey: "fmtVerticalTitle",   descKey: "fmtVerticalDesc"   },
  { id: "16:9", titleKey: "fmtHorizontalTitle", descKey: "fmtHorizontalDesc" },
] as const;

const PROMPT_MAX = 600;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

type Mode = "scratch" | "convert";

interface PngItem {
  id: string;
  image_url: string;
  prompt: string;
  created_at: string;
}

export default function HubPngGenerator() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [mode, setMode] = useState<Mode>("scratch");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  // Default 'medium' — quality 'high' demora 60-120s no gpt-image-2 e
  // estoura o timeout de 150s da Supabase Edge Function pra users em
  // regiões distantes do servidor (Ásia/EU). User pode aumentar manualmente.
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [sourceImage, setSourceImage] = useState<string | null>(null); // data URL
  const [sourceFilename, setSourceFilename] = useState<string>("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<PngItem[]>([]);

  // Carrega últimos 4 PNGs gerados
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("hub_assets" as never)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("kind", "hub_png")
          .order("created_at", { ascending: false })
          .limit(8);
        if (!mounted || !data) return;
        const items: PngItem[] = (data as Array<{ id: string; content?: { image_url?: string; prompt?: string }; created_at: string }>)
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content!.image_url!,
            prompt: r.content!.prompt || "",
            created_at: r.created_at,
          }));
        setHistory(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Upload handlers ──────────────────────────────────────────
  const onImageFile = (f: File) => {
    setImageError(null);
    if (f.size > IMAGE_MAX_BYTES) { setImageError(t("imageTooBig")); return; }
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) { setImageError(t("imageInvalidType")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(reader.result as string);
      setSourceFilename(f.name);
    };
    reader.readAsDataURL(f);
  };

  const onImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onImageFile(f);
  };

  const removeSourceImage = () => {
    setSourceImage(null);
    setSourceFilename("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Generate ─────────────────────────────────────────────────
  const generate = async () => {
    if (loading) return;
    if (prompt.trim().length < 5) { setError(t("promptTooShort")); return; }
    if (mode === "convert" && !sourceImage) { setError(t("noImage")); return; }
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setImageUrl(null);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); setLoading(false); return; }

      // 2 modos:
      //   - 'convert': BRIA bg-remove direto na imagem do user (1 call)
      //   - 'scratch': gpt-image-2 gera o asset → BRIA tira o fundo (2 calls)
      //
      // gpt-image-2 NÃO suporta `background: transparent` (só gpt-image-1
      // suporta, mas qualidade muito inferior). Solução: gera com fundo
      // normal no gpt-image-2, depois passa pela BRIA pra extrair só o
      // sujeito. Resultado final = PNG com fundo realmente transparente.
      const isConvert = mode === "convert" && !!sourceImage;

      let imageWithBg: string;

      if (isConvert) {
        // Modo convert: pula gpt-image-2, vai direto pra BRIA bg-remove
        imageWithBg = sourceImage!;
      } else {
        // Modo scratch: gpt-image-2 gera o asset com fundo normal
        const augmentedPrompt = `${prompt.trim()}\n\nIMPORTANT: Subject must be isolated and centered with clean background, no environment, no scenery, simple solid background color (preferably plain white or light gray). Studio shot style — clean and well-lit.`;
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
          },
          body: JSON.stringify({
            prompt: augmentedPrompt,
            aspect_ratio: aspectRatio,
            quality,
            // SEM transparent: true — gpt-image-2 não suporta. BRIA cuida disso.
          }),
        });
        const genText = await genRes.text();
        let genPayload: { ok?: boolean; error?: string; message?: string; openai_message?: string; image_url?: string } | null = null;
        try { genPayload = JSON.parse(genText); } catch { /* not json */ }

        if (!genRes.ok || !genPayload?.ok) {
          if (genPayload?.error === "needs_org_verification") { setNeedsVerify(true); setLoading(false); return; }
          const detail = genPayload?.openai_message || genPayload?.message || genPayload?.error || `HTTP ${genRes.status}`;
          setError(String(detail).slice(0, 400));
          setLoading(false);
          return;
        }
        if (!genPayload.image_url) {
          setError("Geração não retornou imagem.");
          setLoading(false);
          return;
        }
        imageWithBg = genPayload.image_url;
      }

      // Step final em ambos os modos: BRIA bg-remove sobre a imagem.
      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-bria-bg-remove`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          input_image_base64: imageWithBg,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; error?: string; message?: string; image_url?: string } | null = null;
      try { payload = JSON.parse(text); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        const detail = payload?.message || payload?.error || `HTTP ${r.status}`;
        setError(String(detail).slice(0, 400));
        setLoading(false);
        return;
      }

      // Comprime pra ficar abaixo de 2MB — limite pra ser usado como
      // elemento no Image Studio. Mantém PNG (preserva transparência),
      // só escala dimensões se passar do limite.
      let final = payload.image_url || null;
      if (final) {
        try {
          final = await compressPngIfNeeded(final, 2 * 1024 * 1024);
        } catch (e) {
          console.warn("[png] compress skipped:", e);
        }
      }
      setImageUrl(final);

      // Persist no DB — sobe pro Storage primeiro pra row ficar leve
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && final) {
          const storedUrl = await uploadAssetToStorage(final, "png");
          const saved = await saveHubAsset({
            userId: user.id,
            type: "hub_png",
            content: {
              prompt: prompt.trim(),
              image_url: storedUrl,
              aspect_ratio: aspectRatio,
              quality,
              model: "gpt-image-2",
              transparent: true,
              mode,
              source_filename: mode === "convert" ? sourceFilename : null,
            },
          });
          // Optimistic add to history (mantém URL final pra preview imediato)
          setHistory(prev => [{
            id: saved.id || `tmp-${Date.now()}`,
            image_url: storedUrl,
            prompt: prompt.trim(),
            created_at: new Date().toISOString(),
          }, ...prev].slice(0, 8));

          const titleByLang: Record<Lang, string> = {
            pt: mode === "convert" ? "PNG convertido" : "PNG gerado",
            en: mode === "convert" ? "PNG converted" : "PNG generated",
            es: mode === "convert" ? "PNG convertido" : "PNG generado",
            zh: mode === "convert" ? "PNG 已转换" : "PNG 已生成",
          };
          addHubNotification(user.id, {
            kind: "image_generated",
            title: titleByLang[lang],
            description: prompt.trim().slice(0, 80),
            href: "/dashboard/hub/png",
          });
        }
      } catch (e) { console.warn("[png] save failed:", e); }
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string, filename?: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = filename || `png-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) { console.error(e); }
  };

  const promptValid = prompt.trim().length >= 5;
  const canGenerate = promptValid && (mode === "scratch" || !!sourceImage);

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>

      <div style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 28px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 22, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          <button onClick={() => navigate("/dashboard/hub")} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#D1D5DB", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            fontFamily: "inherit", flexShrink: 0,
          }}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: "inline-flex", gap: 4, padding: 4, marginBottom: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
        }}>
          <button onClick={() => setMode("scratch")} disabled={loading}
            style={modeTabStyle(mode === "scratch")}>
            <Wand2 size={13} /> {t("modeFromScratch")}
          </button>
          <button onClick={() => setMode("convert")} disabled={loading}
            style={modeTabStyle(mode === "convert")}>
            <ImageDownIcon size={13} /> {t("modeFromImage")}
          </button>
        </div>

        {/* Workspace */}
        <div className="hub-png-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT */}
          <div style={CARD_STYLE}>
            {/* Source image (only convert mode) */}
            {mode === "convert" && (
              <Section title={t("source")} subtitle={t("sourceHint")}>
                {!sourceImage ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onImageDrop}
                    style={{
                      border: `1.5px dashed ${dragOver ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.12)"}`,
                      background: dragOver ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.20)",
                      borderRadius: 11, padding: "26px 16px",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      textAlign: "center", gap: 10,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: "rgba(59,130,246,0.10)",
                      border: "1px solid rgba(59,130,246,0.22)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Upload size={18} style={{ color: "#3B82F6" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{t("uploadCta")}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{t("uploadHint")}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: 12, borderRadius: 11,
                    background: "rgba(59,130,246,0.06)",
                    border: "1px solid rgba(59,130,246,0.25)",
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 8,
                      background: "rgba(0,0,0,0.40)",
                      overflow: "hidden", flexShrink: 0,
                    }}>
                      <img src={sourceImage} alt="source"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {t("imageReady")}
                      </p>
                      <p style={{
                        fontSize: 13, fontWeight: 700, color: "#fff", margin: "2px 0 0",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{sourceFilename || "image"}</p>
                    </div>
                    <button onClick={removeSourceImage} disabled={loading} title={t("imageRemove")}
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: "#9CA3AF", cursor: loading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onImageFile(f); }}
                  style={{ display: "none" }} />
                {imageError && (
                  <p style={{ fontSize: 11, color: "#f87171", margin: "8px 0 0" }}>{imageError}</p>
                )}
              </Section>
            )}

            {/* Describe */}
            <Section
              title={mode === "scratch" ? t("describeFromScratch") : t("describeFromImage")}
              subtitle={mode === "scratch" ? t("describeFromScratchHint") : t("describeFromImageHint")}
              style={mode === "convert" ? { marginTop: 22 } : undefined}
            >
              <div style={{ position: "relative" }}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                  placeholder={mode === "scratch" ? t("describeFromScratchPh") : t("describeFromImagePh")}
                  rows={4}
                  disabled={loading}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 11, padding: "12px 14px",
                    color: "#F1F5F9", fontSize: 13.5, lineHeight: 1.55,
                    resize: "vertical", outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.10)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div style={{
                  position: "absolute", right: 10, bottom: 8,
                  fontSize: 10.5, color: "#6B7280", pointerEvents: "none", fontWeight: 600,
                }}>
                  {prompt.length} / {PROMPT_MAX}
                </div>
              </div>
            </Section>

            {/* Format + Quality */}
            <div className="hub-png-fmt" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
              <Section title={t("format")} subtitle={t("formatHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {FORMATS.map(f => {
                    const active = aspectRatio === f.id;
                    return (
                      <button key={f.id} onClick={() => setAspectRatio(f.id)} disabled={loading}
                        style={{
                          padding: "9px 6px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(f.titleKey as keyof typeof STR)} <span style={{ fontSize: 9.5, color: "#9CA3AF", fontWeight: 600 }}>{f.id}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(f.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title={t("quality")} subtitle={t("qualityHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {([
                    { v: "low",    titleKey: "qDraft",  descKey: "qDraftDesc"  },
                    { v: "medium", titleKey: "qMedium", descKey: "qMediumDesc" },
                    { v: "high",   titleKey: "qHigh",   descKey: "qHighDesc"   },
                  ] as const).map(q => {
                    const active = quality === q.v;
                    return (
                      <button key={q.v} onClick={() => setQuality(q.v)} disabled={loading}
                        style={{
                          padding: "9px 6px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(q.titleKey as keyof typeof STR)}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(q.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* CTA */}
            <button onClick={generate} disabled={loading || !canGenerate}
              className="hub-cta"
              style={{
                marginTop: 22, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: loading || !canGenerate ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: loading || !canGenerate ? "rgba(255,255,255,0.50)" : "#fff",
                border: "none", cursor: loading || !canGenerate ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
                transition: "background 0.15s, transform 0.08s",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{mode === "convert" ? t("generateConvert") : t("generate")}</>
              )}
            </button>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "10px 0 0", textAlign: "center" }}>
              {t("autoSaved")}
            </p>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={CARD_STYLE}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>{t("preview")}</h3>
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{t("previewHint")}</p>
              </div>

              {needsVerify && (
                <div style={{
                  padding: "16px 18px", borderRadius: 12,
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.30)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "rgba(251,191,36,0.15)",
                      border: "1px solid rgba(251,191,36,0.40)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <AlertTriangle size={18} style={{ color: "#fbbf24" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>{t("verifyTitle")}</h4>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <a href="https://platform.openai.com/settings/organization/general"
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: 9,
                            background: "#fbbf24", color: "#1a1a2e",
                            fontSize: 12.5, fontWeight: 800, textDecoration: "none",
                          }}>
                          <Sparkles size={12} /> {t("verifyBtn")}
                        </a>
                        <button onClick={() => setNeedsVerify(false)}
                          style={{
                            padding: "8px 12px", borderRadius: 9,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#9CA3AF", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}>
                          {t("verifyClose")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && !needsVerify && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "10px 12px", borderRadius: 9,
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                }}>
                  <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 11.5, color: "#fee2e2", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</p>
                </div>
              )}

              {imageUrl && (
                <div>
                  <div style={{
                    display: "flex", justifyContent: "center", marginBottom: 12,
                    padding: 16, borderRadius: 11,
                    backgroundImage:
                      "linear-gradient(45deg, #1F2937 25%, transparent 25%), linear-gradient(-45deg, #1F2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1F2937 75%), linear-gradient(-45deg, transparent 75%, #1F2937 75%)",
                    backgroundSize: "20px 20px",
                    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
                    background: "rgba(0,0,0,0.30)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <img src={imageUrl} alt={prompt}
                      style={{ maxWidth: "100%", maxHeight: "62vh", borderRadius: 8, display: "block" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => downloadImage(imageUrl)} style={ACTION_BTN}>
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                  </div>
                </div>
              )}

              {!imageUrl && !needsVerify && !error && !loading && (
                <div style={{
                  border: "1px dashed rgba(255,255,255,0.10)",
                  borderRadius: 12, minHeight: 280,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 32, textAlign: "center", gap: 14,
                  background: "rgba(0,0,0,0.20)",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 13,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid rgba(59,130,246,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Layers size={22} style={{ color: "#3B82F6" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                    <p style={{ fontSize: 12, color: "#D1D5DB", margin: "5px 0 0", lineHeight: 1.5, maxWidth: 320 }}>
                      {t("emptyDesc")}
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{
                  border: "1px solid rgba(59,130,246,0.20)",
                  borderRadius: 12, minHeight: 280,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 32, gap: 12,
                  background: "rgba(0,0,0,0.20)",
                }}>
                  <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: 0 }}>{t("generating")}</p>
                </div>
              )}
            </div>

            {/* Recent history */}
            {history.length > 0 && (
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{t("recent")}</h3>
                    <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0" }}>{t("recentHint")}</p>
                  </div>
                  <button onClick={() => navigate("/dashboard/hub/library")}
                    style={{
                      background: "transparent", border: "none", color: "#3B82F6",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {t("seeAll")} →
                  </button>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                }}>
                  {history.slice(0, 4).map(item => (
                    <button key={item.id} onClick={() => downloadImage(item.image_url, `png-${item.id.slice(0, 8)}.png`)}
                      style={{
                        textAlign: "left", padding: 0, background: "transparent", border: "none",
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "transform 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{
                        aspectRatio: "1/1", borderRadius: 10, overflow: "hidden",
                        backgroundImage:
                          "linear-gradient(45deg, #1F2937 25%, transparent 25%), linear-gradient(-45deg, #1F2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1F2937 75%), linear-gradient(-45deg, transparent 75%, #1F2937 75%)",
                        backgroundSize: "12px 12px",
                        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                        background: "rgba(0,0,0,0.30)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        marginBottom: 6,
                      }}>
                        <img src={item.image_url} alt={item.prompt}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      </div>
                      <p style={{
                        fontSize: 10.5, color: "#9CA3AF", margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{relativeTime(item.created_at, lang)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .hub-cta:hover:not(:disabled) { background: #2563EB !important; }
          .hub-cta:active:not(:disabled) { background: #1D4ED8 !important; transform: scale(0.97); }
          @media (max-width: 1100px) {
            .hub-png-workspace { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px) {
            .hub-png-fmt { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, subtitle, children, style }: {
  title: string; subtitle?: string;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 7,
    background: active ? "#3B82F6" : "transparent",
    color: active ? "#fff" : "#9CA3AF",
    border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
    letterSpacing: "0.02em",
    transition: "all 0.15s",
  };
}

function relativeTime(iso: string, lang: Lang): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    const h = Math.round(min / 60);
    const d = Math.round(h / 24);
    if (lang === "en") {
      if (min < 1) return "now";
      if (min < 60) return `${min}m ago`;
      if (h < 24) return `${h}h ago`;
      return `${d}d ago`;
    }
    if (lang === "es") {
      if (min < 1) return "ahora";
      if (min < 60) return `${min}m`;
      if (h < 24) return `${h}h`;
      return `${d}d`;
    }
    if (lang === "zh") {
      if (min < 1) return "刚刚";
      if (min < 60) return `${min} 分钟前`;
      if (h < 24) return `${h} 小时前`;
      return `${d} 天前`;
    }
    if (min < 1) return "agora";
    if (min < 60) return `${min}min`;
    if (h < 24) return `${h}h`;
    return `${d}d`;
  } catch { return ""; }
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 18,
};

const ACTION_BTN: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
};
