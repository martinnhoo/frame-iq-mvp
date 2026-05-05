/**
 * HubImageGenerator — gerador de imagens com brand context multi-mercado.
 *
 * Layout Higgsfield-inspired:
 *   1. Brand selector — cards visuais clicáveis com logo (gradient +
 *      iniciais), bandeira do(s) mercado(s).
 *   2. Market selector — chips com bandeira aparecem quando a marca
 *      opera em mais de 1 mercado. Auto-seleciona o primeiro ao
 *      trocar de marca.
 *   3. License panel — auto-aparece quando a combinação marca+mercado
 *      tem license (hoje só BETBUS-MX). Toggle + textarea editável.
 *   4. Prompt + aspect ratio + quality.
 *   5. Verify org card — quando OpenAI exige verification, em vez do
 *      erro vermelho genérico.
 *   6. Preview com badge "Modelo: gpt-image-2 ★".
 *
 * Tudo i18n (pt/en/es/zh) — mudou idioma no menu, muda aqui também.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  Copy, RotateCcw, Check,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, getBrandName, getMarketLabel,
  type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { composeImageWithLicense } from "@/lib/composeImageWithLicense";

// ── Strings i18n ─────────────────────────────────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  back:                { pt: "Voltar ao Hub",        en: "Back to Hub",          es: "Volver al Hub",          zh: "返回中心" },
  title:               { pt: "Image Studio",          en: "Image Studio",          es: "Image Studio",            zh: "图像工作室" },
  subtitle:            { pt: "IA generativa por marca · disclaimer auto · multi-mercado",
                         en: "Generative AI by brand · auto disclaimer · multi-market",
                         es: "IA generativa por marca · disclaimer automático · multi-mercado",
                         zh: "按品牌生成 · 自动免责声明 · 多市场" },
  brand:               { pt: "Marca",                  en: "Brand",                 es: "Marca",                  zh: "品牌" },
  market:              { pt: "Mercado",                en: "Market",                es: "Mercado",                zh: "市场" },
  describe:            { pt: "Descreva a imagem",      en: "Describe the image",    es: "Describe la imagen",     zh: "描述图像" },
  describePlaceholder: { pt: 'Ex: "Cena cinematográfica de jogador celebrando uma vitória, neon vibrante, atmosfera premium de cassino"',
                         en: 'Ex: "Cinematic scene of a player celebrating a win, vibrant neon, premium casino atmosphere"',
                         es: 'Ej: "Escena cinematográfica de jugador celebrando una victoria, neón vibrante, atmósfera premium de casino"',
                         zh: '例: "玩家庆祝胜利的电影场景，霓虹灯，高端赌场氛围"' },
  format:              { pt: "Formato",                en: "Format",                es: "Formato",                zh: "格式" },
  quality:             { pt: "Qualidade",              en: "Quality",               es: "Calidad",                zh: "质量" },
  qDraft:              { pt: "Rascunho",               en: "Draft",                 es: "Borrador",               zh: "草稿" },
  qMedium:             { pt: "Médio",                  en: "Medium",                es: "Medio",                  zh: "中等" },
  qHigh:               { pt: "Alta",                   en: "High",                  es: "Alta",                   zh: "高" },
  qDraftDesc:          { pt: "Rascunho rápido",        en: "Quick draft",           es: "Borrador rápido",        zh: "快速草稿" },
  qMediumDesc:         { pt: "Produção",               en: "Production",            es: "Producción",             zh: "生产" },
  qHighDesc:           { pt: "Entrega final",          en: "Final delivery",        es: "Entrega final",          zh: "最终交付" },
  arSquareLabel:       { pt: "Quadrado",               en: "Square",                es: "Cuadrado",               zh: "方形" },
  arSquareDesc:        { pt: "Feed, Insta post",       en: "Feed, Insta post",      es: "Feed, post Insta",       zh: "信息流，Insta 帖子" },
  arVerticalLabel:     { pt: "Vertical",               en: "Vertical",              es: "Vertical",               zh: "垂直" },
  arVerticalDesc:      { pt: "Reels, Stories",         en: "Reels, Stories",        es: "Reels, Stories",         zh: "Reels，Stories" },
  arHorizontalLabel:   { pt: "Horizontal",             en: "Horizontal",            es: "Horizontal",             zh: "横向" },
  arHorizontalDesc:    { pt: "YouTube, banner",        en: "YouTube, banner",       es: "YouTube, banner",        zh: "YouTube，横幅" },
  arPortraitLabel:     { pt: "Retrato",                en: "Portrait",              es: "Retrato",                zh: "人像" },
  arPortraitDesc:      { pt: "Insta otimizado",        en: "Insta optimized",       es: "Insta optimizado",       zh: "Insta 优化" },
  generate:            { pt: "Gerar imagem",           en: "Generate image",        es: "Generar imagen",         zh: "生成图像" },
  generating:          { pt: "Gerando…",               en: "Generating…",           es: "Generando…",             zh: "生成中…" },
  download:            { pt: "Baixar",                 en: "Download",              es: "Descargar",              zh: "下载" },
  variation:           { pt: "Gerar variação",         en: "Generate variation",    es: "Generar variación",      zh: "生成变体" },
  recent:              { pt: "Últimas geraçōes",       en: "Latest generations",    es: "Últimas generaciones",   zh: "最近生成" },
  promptRefined:       { pt: "Prompt refinado pela IA",en: "Prompt refined by AI",  es: "Prompt refinado por IA", zh: "AI 优化后的提示词" },
  modelLabel:          { pt: "Modelo",                 en: "Model",                 es: "Modelo",                 zh: "模型" },
  // License panel
  licTitle:            { pt: "Disclaimer regulatório", en: "Regulatory disclaimer", es: "Disclaimer regulatorio", zh: "监管免责声明" },
  licInclude:          { pt: "Incluir no criativo",    en: "Include in creative",   es: "Incluir en el creativo", zh: "包含在创意中" },
  licCopy:             { pt: "Copiar texto",           en: "Copy text",             es: "Copiar texto",           zh: "复制文本" },
  licCopied:           { pt: "Copiado",                en: "Copied",                es: "Copiado",                zh: "已复制" },
  licReset:            { pt: "Resetar",                en: "Reset",                 es: "Restablecer",            zh: "重置" },
  // Verify org card
  verifyTitle:         { pt: "Verifique sua organização OpenAI",
                         en: "Verify your OpenAI organization",
                         es: "Verifica tu organización OpenAI",
                         zh: "验证您的 OpenAI 组织" },
  verifyDesc:          { pt: "Pra usar o gpt-image-2 (qualidade fotorrealista pra ad creatives), a OpenAI exige verification organizacional.",
                         en: "To use gpt-image-2 (photorealistic quality for ad creatives), OpenAI requires organization verification.",
                         es: "Para usar gpt-image-2 (calidad fotorrealista para anuncios), OpenAI requiere verificación organizacional.",
                         zh: "要使用 gpt-image-2（广告创意的照片级质量），OpenAI 需要组织验证。" },
  verifyTime:          { pt: "Aprovado em ~5min via verification individual (KYC com doc + selfie).",
                         en: "Approved in ~5min via Individual verification (KYC with ID + selfie).",
                         es: "Aprobado en ~5min vía verificación Individual (KYC con DNI + selfie).",
                         zh: "通过个人验证 (KYC 与身份证 + 自拍) 约 5 分钟内批准。" },
  verifyBtn:           { pt: "Verificar agora →",      en: "Verify now →",          es: "Verificar ahora →",      zh: "立即验证 →" },
  verifyClose:         { pt: "Fechar",                 en: "Close",                 es: "Cerrar",                 zh: "关闭" },
  verifyAfter:         { pt: "Após aprovar a verification, volta aqui e tenta gerar de novo. Funciona automaticamente, sem precisar mexer no código.",
                         en: "Once verification is approved, come back and try generating again. Works automatically — no code changes needed.",
                         es: "Tras aprobar la verificación, vuelve y prueba generar de nuevo. Funciona automáticamente, sin cambios de código.",
                         zh: "验证批准后，返回此处再次尝试生成。自动运行，无需代码更改。" },
  sessionExpired:      { pt: "Sessão expirada — recarrega a página.",
                         en: "Session expired — reload the page.",
                         es: "Sesión expirada — recarga la página.",
                         zh: "会话已过期 — 请刷新页面。" },
  promptTooShort:      { pt: "Descreva a imagem com pelo menos 5 caracteres.",
                         en: "Describe the image with at least 5 characters.",
                         es: "Describe la imagen con al menos 5 caracteres.",
                         zh: "请用至少 5 个字符描述图像。" },
};

const ASPECT_RATIOS_KEYS = [
  { id: "1:1",  labelKey: "arSquareLabel",     descKey: "arSquareDesc"     },
  { id: "9:16", labelKey: "arVerticalLabel",   descKey: "arVerticalDesc"   },
  { id: "16:9", labelKey: "arHorizontalLabel", descKey: "arHorizontalDesc" },
  { id: "4:5",  labelKey: "arPortraitLabel",   descKey: "arPortraitDesc"   },
];

type GenResult = {
  image_url: string;
  prompt: string;
  revised_prompt: string;
  aspect_ratio: string;
  model_used?: string;
};

type GalleryItem = {
  id: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  brand_id?: string;
  market?: MarketCode;
  created_at: string;
};

export default function HubImageGenerator() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;

  const [prompt, setPrompt] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");

  const [includeLicense, setIncludeLicense] = useState(true);
  const [licenseText, setLicenseText] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [licenseCopied, setLicenseCopied] = useState(false);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);
  const defaultLicense = useMemo(() => {
    if (!brand?.license || !marketCode) return "";
    return brand.license[marketCode] || "";
  }, [brand, marketCode]);
  const hasLicense = !!defaultLicense;

  // Quando troca brand, auto-seleciona o primeiro mercado dela.
  useEffect(() => {
    if (!brand || brand.markets.length === 0) {
      setMarketCode(null);
    } else {
      // Se mercado atual não tá na lista da nova brand, troca pro primeiro
      setMarketCode(prev => (prev && brand.markets.includes(prev) ? prev : brand.markets[0]));
    }
  }, [brandId]);

  // Quando muda brand+mercado, repõe license padrão e re-ativa toggle
  useEffect(() => {
    if (defaultLicense) {
      setLicenseText(defaultLicense);
      setIncludeLicense(true);
    } else {
      setLicenseText("");
      setIncludeLicense(false);
    }
  }, [defaultLicense]);

  // Carrega galeria das últimas 12
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("creative_memory" as never)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "hub_image")
          .order("created_at", { ascending: false })
          .limit(12);
        if (!mounted || !data) return;
        const items: GalleryItem[] = (data as Array<{
          id: string;
          content?: { image_url?: string; prompt?: string; aspect_ratio?: string; brand_id?: string; market?: MarketCode };
          created_at: string;
        }>)
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content!.image_url!,
            prompt: r.content!.prompt || "",
            aspect_ratio: r.content!.aspect_ratio || "1:1",
            brand_id: r.content!.brand_id,
            market: r.content!.market,
            created_at: r.created_at,
          }));
        setGallery(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  const generate = async () => {
    if (loading || !prompt.trim() || prompt.trim().length < 5) return;
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      // Constrói brand_hint = base hint + market context
      let brandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        brandHint = `${brandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          quality,
          brand_id: brandId === "none" ? null : brandId,
          brand_hint: brandHint,
          market: marketCode,
          include_license: hasLicense && includeLicense,
          license_text: hasLicense && includeLicense ? licenseText.trim() : "",
        }),
      });

      const text = await r.text();
      let payload: {
        ok?: boolean; _v?: string; openai_message?: string; message?: string;
        error?: string; image_url?: string; revised_prompt?: string;
        model_used?: string;
      } | null = null;
      try { payload = JSON.parse(text); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") {
          setNeedsVerify(true);
          return;
        }
        const detail = payload?.openai_message || payload?.message || payload?.error || text || `HTTP ${r.status}`;
        const versionTag = payload?._v ? ` [fn=${payload._v}]` : " [fn=desconhecida]";
        setError((detail + versionTag).slice(0, 500));
        return;
      }

      // Se tem license ativa, compõe disclaimer no rodapé via Canvas
      // (modelo de imagem não consegue renderizar 100+ palavras legíveis,
      // então a única forma confiável é pós-produção). Resultado: data URL.
      let finalImageUrl = payload.image_url!;
      if (hasLicense && includeLicense && licenseText.trim()) {
        try {
          finalImageUrl = await composeImageWithLicense(payload.image_url!, licenseText.trim());
        } catch (composeErr) {
          console.warn("[hub-image] license compose failed, using raw:", composeErr);
        }
      }

      setResult({
        image_url: finalImageUrl,
        prompt: prompt.trim(),
        revised_prompt: payload.revised_prompt || prompt.trim(),
        aspect_ratio: aspectRatio,
        model_used: payload.model_used,
      });
      setGallery(prev => [{
        id: `tmp-${Date.now()}`,
        image_url: finalImageUrl,
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        brand_id: brandId === "none" ? undefined : brandId,
        market: marketCode || undefined,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 12));
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const copyLicense = async () => {
    try {
      await navigator.clipboard.writeText(licenseText);
      setLicenseCopied(true);
      setTimeout(() => setLicenseCopied(false), 1800);
    } catch { /* silent */ }
  };

  const resetLicense = () => {
    if (defaultLicense) setLicenseText(defaultLicense);
  };

  const promptValid = prompt.trim().length >= 5;

  return (
    <>
      <Helmet>
        <title>{t("title")}</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1280, margin: "0 auto", color: "#fff" }}>
        <button
          onClick={() => navigate("/dashboard/hub")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: "rgba(255,255,255,0.55)",
            cursor: "pointer", fontSize: 13, padding: "6px 8px", marginBottom: 16,
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={14} /> {t("back")}
        </button>

        {/* Hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 36px rgba(168,85,247,0.40), inset 0 0 0 1px rgba(255,255,255,0.10)",
          }}>
            <ImageIcon size={26} style={{ color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", margin: "3px 0 0", letterSpacing: "0.02em" }}>
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* ── Brand selector ──────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <p style={SECTION_LABEL}>{t("brand")}</p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
            gap: 10,
          }}>
            {HUB_BRANDS.map(b => {
              const active = brandId === b.id;
              const isNone = b.id === "none";
              const brandLicensed = b.license && Object.keys(b.license).length > 0;
              const brandLabelMarkets = b.markets.length > 0
                ? b.markets.map(m => HUB_MARKETS[m]?.flag).join(" ")
                : "✦";
              return (
                <button
                  key={b.id}
                  onClick={() => setBrandId(b.id)}
                  disabled={loading}
                  style={{
                    position: "relative",
                    padding: 14,
                    borderRadius: 14,
                    background: active ? "rgba(168,85,247,0.10)" : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? "rgba(168,85,247,0.55)" : "rgba(255,255,255,0.06)"}`,
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.18s",
                    overflow: "hidden",
                    boxShadow: active
                      ? "0 0 24px rgba(168,85,247,0.25), inset 0 0 0 1px rgba(168,85,247,0.20)"
                      : "none",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!active && !loading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.045)"; }}
                  onMouseLeave={e => { if (!active && !loading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11,
                      background: b.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: active ? "0 4px 14px rgba(0,0,0,0.30)" : "0 2px 8px rgba(0,0,0,0.20)",
                    }}>
                      <span style={{
                        fontSize: isNone ? 14 : 13, fontWeight: 800,
                        color: "rgba(255,255,255,0.95)",
                        letterSpacing: "0.04em",
                        textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                      }}>
                        {b.logoInitials}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                        {getBrandName(b, lang)}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}>
                        {brandLabelMarkets}
                      </p>
                    </div>
                  </div>
                  {brandLicensed && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.10em",
                      color: "rgba(34,211,153,0.95)",
                      padding: "2px 6px", borderRadius: 5,
                      background: "rgba(34,211,153,0.12)", border: "1px solid rgba(34,211,153,0.28)",
                    }}>
                      LICENSE
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Market sub-selector (só quando brand tem 1+ mercado) ── */}
        {brand && brand.markets.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <p style={SECTION_LABEL}>{t("market")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {brand.markets.map(code => {
                const m = HUB_MARKETS[code];
                const active = marketCode === code;
                const hasLicForThis = !!brand.license?.[code];
                return (
                  <button
                    key={code}
                    onClick={() => setMarketCode(code)}
                    disabled={loading}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "8px 13px", borderRadius: 10,
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(168,85,247,0.55)" : "rgba(255,255,255,0.08)"}`,
                      color: active ? "#fff" : "rgba(255,255,255,0.65)",
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 600,
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                      boxShadow: active ? "0 0 20px rgba(168,85,247,0.18)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{m.flag}</span>
                    <span>{getMarketLabel(code, lang)}</span>
                    {hasLicForThis && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.10em",
                        color: "#22d399",
                        padding: "1px 5px", borderRadius: 4,
                        background: "rgba(34,211,153,0.10)",
                        border: "1px solid rgba(34,211,153,0.25)",
                      }}>
                        LIC
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── License panel ─────────────────────────────────────── */}
        {hasLicense && marketCode && (
          <div style={{
            marginBottom: 22,
            padding: 16,
            borderRadius: 14,
            background: "rgba(34,211,153,0.04)",
            border: "1px solid rgba(34,211,153,0.20)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#22d399",
              }}>
                {t("licTitle")} · {getMarketLabel(marketCode, lang)}
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={includeLicense}
                  onChange={e => setIncludeLicense(e.target.checked)}
                  disabled={loading}
                  style={{ accentColor: "#22d399", width: 14, height: 14, cursor: "pointer" }}
                />
                <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                  {t("licInclude")}
                </span>
              </label>
            </div>
            <textarea
              value={licenseText}
              onChange={e => setLicenseText(e.target.value)}
              disabled={loading || !includeLicense}
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.30)",
                border: "1px solid rgba(34,211,153,0.18)",
                color: includeLicense ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)",
                fontSize: 11.5, lineHeight: 1.55,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                transition: "all 0.15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,153,0.45)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(34,211,153,0.18)"; }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={copyLicense} disabled={loading} style={SUBTLE_BTN}>
                {licenseCopied ? <Check size={12} /> : <Copy size={12} />}
                {licenseCopied ? t("licCopied") : t("licCopy")}
              </button>
              <button
                onClick={resetLicense}
                disabled={loading || licenseText === defaultLicense}
                style={{ ...SUBTLE_BTN, opacity: licenseText === defaultLicense ? 0.4 : 1 }}
              >
                <RotateCcw size={12} /> {t("licReset")}
              </button>
            </div>
          </div>
        )}

        {/* ── Prompt + controls ─────────────────────────────────── */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 18, marginBottom: 22,
        }}>
          <p style={SECTION_LABEL}>{t("describe")}</p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={t("describePlaceholder")}
            rows={3}
            disabled={loading}
            style={{
              width: "100%", background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "12px 14px",
              color: "#F1F5F9", fontSize: 14, lineHeight: 1.55,
              resize: "vertical", outline: "none", boxSizing: "border-box",
              fontFamily: "inherit",
              transition: "border-color 0.18s, box-shadow 0.18s",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "rgba(168,85,247,0.55)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.10)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {/* Aspect ratio */}
          <div style={{ marginTop: 16 }}>
            <p style={SECTION_LABEL}>{t("format")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {ASPECT_RATIOS_KEYS.map(ar => {
                const active = aspectRatio === ar.id;
                return (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    disabled={loading}
                    style={{
                      padding: "10px 12px", borderRadius: 11,
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(168,85,247,0.55)" : "rgba(255,255,255,0.08)"}`,
                      color: active ? "#fff" : "rgba(255,255,255,0.65)",
                      cursor: loading ? "not-allowed" : "pointer",
                      textAlign: "left", fontFamily: "inherit",
                      transition: "all 0.15s",
                      boxShadow: active ? "0 0 20px rgba(168,85,247,0.18)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{t(ar.labelKey as keyof typeof STR)}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: "0.04em" }}>{ar.id}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
                      {t(ar.descKey as keyof typeof STR)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality */}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <p style={{ ...SECTION_LABEL, margin: 0 }}>{t("quality")}</p>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              {(["low", "medium", "high"] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  disabled={loading}
                  title={q === "low" ? t("qDraftDesc") : q === "medium" ? t("qMediumDesc") : t("qHighDesc")}
                  style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 800,
                    background: quality === q ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "transparent",
                    color: quality === q ? "#fff" : "rgba(255,255,255,0.55)",
                    border: "none", cursor: loading ? "not-allowed" : "pointer",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    fontFamily: "inherit",
                    boxShadow: quality === q ? "0 4px 12px rgba(168,85,247,0.30)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {q === "low" ? t("qDraft") : q === "medium" ? t("qMedium") : t("qHigh")}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={loading || !promptValid}
            style={{
              marginTop: 18, width: "100%", padding: "15px 20px",
              borderRadius: 13, fontSize: 14, fontWeight: 800,
              background: loading || !promptValid
                ? "rgba(168,85,247,0.20)"
                : "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
              color: loading || !promptValid ? "rgba(255,255,255,0.40)" : "#fff",
              border: "none", cursor: loading || !promptValid ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading || !promptValid ? "none" : "0 8px 28px rgba(168,85,247,0.45)",
              transition: "all 0.18s",
              letterSpacing: "0.02em",
              fontFamily: "inherit",
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles size={16} /> {t("generate")}
                {brand && brand.id !== "none" && marketCode && (
                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                    · {brand.name} · {HUB_MARKETS[marketCode].flag}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* ── Verify org card ───────────────────────────────────── */}
        {needsVerify && (
          <div style={{
            padding: "20px 22px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(251,191,36,0.06), rgba(168,85,247,0.06))",
            border: "1px solid rgba(251,191,36,0.30)",
            marginBottom: 22,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle size={20} style={{ color: "#1a1a2e" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                  {t("verifyTitle")}
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 6px", lineHeight: 1.55 }}>
                  {t("verifyDesc")}
                </p>
                <p style={{ fontSize: 13, color: "#fbbf24", margin: "0 0 14px", fontWeight: 600 }}>
                  {t("verifyTime")}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href="https://platform.openai.com/settings/organization/general"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "9px 16px", borderRadius: 10,
                      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                      color: "#1a1a2e", fontSize: 13, fontWeight: 800,
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(251,191,36,0.30)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    <Sparkles size={13} /> {t("verifyBtn")}
                  </a>
                  <button
                    onClick={() => setNeedsVerify(false)}
                    style={{
                      padding: "9px 14px", borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t("verifyClose")}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", margin: "12px 0 0", lineHeight: 1.5 }}>
                  {t("verifyAfter")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && !needsVerify && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 16px", borderRadius: 11,
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
            marginBottom: 22,
          }}>
            <AlertTriangle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12.5, color: "rgba(254,226,226,0.95)", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>{error}</p>
          </div>
        )}

        {/* ── Result preview ────────────────────────────────────── */}
        {result && (
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(168,85,247,0.30)",
            borderRadius: 16, padding: 20, marginBottom: 24,
            boxShadow: "0 0 60px rgba(168,85,247,0.10)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <img
                src={result.image_url}
                alt={result.prompt}
                style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 12, display: "block" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => downloadImage(result.image_url, `hub-${Date.now()}.png`)} style={ACTION_BTN}>
                <Download size={14} /> {t("download")}
              </button>
              <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                <RefreshCw size={14} /> {t("variation")}
              </button>
            </div>
            {result.model_used && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                <div style={{
                  padding: "6px 12px",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(34,211,153,0.06)",
                  border: "1px solid rgba(34,211,153,0.20)",
                  borderRadius: 8,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase",
                    color: "#22d399",
                  }}>
                    {t("modelLabel")}: {result.model_used} ★
                  </span>
                </div>
              </div>
            )}
            {result.revised_prompt && result.revised_prompt !== result.prompt && (
              <p style={{
                fontSize: 11, color: "rgba(255,255,255,0.45)",
                marginTop: 12, padding: "8px 12px",
                background: "rgba(255,255,255,0.025)", borderRadius: 8,
                fontStyle: "italic", lineHeight: 1.55,
              }}>
                {t("promptRefined")}: "{result.revised_prompt}"
              </p>
            )}
          </div>
        )}

        {/* ── Gallery ───────────────────────────────────────────── */}
        {gallery.length > 0 && (
          <div>
            <p style={SECTION_LABEL}>{t("recent")}</p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}>
              {gallery.map(item => {
                const itemBrand = item.brand_id ? getBrand(item.brand_id) : null;
                const itemMarket = item.market ? HUB_MARKETS[item.market] : null;
                return (
                  <div key={item.id} style={{
                    position: "relative",
                    borderRadius: 11, overflow: "hidden",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    transition: "transform 0.15s, border-color 0.15s",
                  }}
                    onClick={() => downloadImage(item.image_url, `hub-${item.id}.png`)}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = "rgba(168,85,247,0.40)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.prompt}
                      style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                    />
                    {(itemBrand || itemMarket) && (
                      <div style={{
                        position: "absolute", top: 6, left: 6,
                        padding: "2px 7px", borderRadius: 6,
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(6px)",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.85)",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        {itemMarket && <span>{itemMarket.flag}</span>}
                        {itemBrand && <span>{itemBrand.name}</span>}
                      </div>
                    )}
                    <div style={{ padding: 8 }}>
                      <p style={{
                        fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0,
                        lineHeight: 1.4, display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>{item.prompt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}

const SECTION_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.45)",
  margin: "0 0 9px",
  textTransform: "uppercase",
};

const SUBTLE_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 11px", borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  cursor: "pointer", fontSize: 11.5, fontWeight: 600,
  fontFamily: "inherit",
  transition: "all 0.12s",
};

const ACTION_BTN: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
  transition: "all 0.12s",
};
