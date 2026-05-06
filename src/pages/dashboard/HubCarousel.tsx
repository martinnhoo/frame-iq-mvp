/**
 * HubCarousel — gera carrossel a partir de um roteiro/ideia.
 *
 * Diferente do Storyboard (que é sequência cinematográfica contínua
 * pra editor de vídeo), o Carrossel é otimizado pra Instagram/social:
 *   - Aspect 1:1 (default Insta) ou 4:5
 *   - Cada slide é mais STANDALONE (não precisa fluir como filme)
 *   - Geralmente carrega texto/copy na imagem (capa, miolo, CTA)
 *   - 5-10 slides
 *
 * Reusa generate-storyboard-hub no backend — só passa contexto
 * diferente (carousel mode) e quantidade maior de slides.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  GalleryHorizontal, Download, ArrowLeft, Sparkles, AlertTriangle, RefreshCw,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, getBrandName, getMarketLabel,
  type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";
import { composeImage } from "@/lib/composeImageWithLicense";
import { CustomLogoUpload } from "@/components/dashboard/CustomLogoUpload";
import { saveHubAssets } from "@/lib/saveHubAsset";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",    en: "Back to Hub",    es: "Volver al Hub",    zh: "返回中心" },
  title:          { pt: "Carrossel",        en: "Carousel",       es: "Carrusel",         zh: "轮播" },
  subtitle:      { pt: "Roteiro vira carrossel — slides quadrados pra Instagram, LinkedIn, etc.",
                   en: "Script becomes a carousel — square slides for Instagram, LinkedIn, etc.",
                   es: "El guión se convierte en un carrusel — slides cuadrados para Instagram, LinkedIn, etc.",
                   zh: "剧本转化为轮播 — 适用于 Instagram、LinkedIn 的方形幻灯片。" },
  brand:          { pt: "Marca",            en: "Brand",          es: "Marca",            zh: "品牌" },
  market:         { pt: "Mercado",          en: "Market",         es: "Mercado",          zh: "市场" },
  script:         { pt: "Roteiro / ideia",  en: "Script / idea",  es: "Guión / idea",     zh: "剧本 / 想法" },
  scriptPh:       { pt: "Ex: 5 dicas pra escolher slot que paga mais. Capa com hook forte, 3 dicas no miolo, CTA no final.",
                   en: "Ex: 5 tips for picking the best-paying slot. Hook cover, 3 tips in middle, CTA at end.",
                   es: "Ej: 5 tips para elegir el slot que más paga. Carátula con hook, 3 tips, CTA final.",
                   zh: "例：选择最赚钱老虎机的 5 个技巧。强吸引力封面、3 个技巧、最终 CTA。" },
  slideCount:     { pt: "Quantidade de slides", en: "Slide count", es: "Cantidad de slides", zh: "幻灯片数量" },
  format:         { pt: "Formato",          en: "Format",         es: "Formato",          zh: "格式" },
  arSquare:       { pt: "Quadrado",         en: "Square",         es: "Cuadrado",         zh: "方形" },
  arPortrait:     { pt: "Retrato",          en: "Portrait",       es: "Retrato",          zh: "人像" },
  quality:        { pt: "Qualidade",        en: "Quality",        es: "Calidad",          zh: "质量" },
  qDraft:         { pt: "Rascunho",         en: "Draft",          es: "Borrador",         zh: "草稿" },
  qMedium:        { pt: "Médio",            en: "Medium",         es: "Medio",            zh: "中等" },
  qHigh:          { pt: "Alta",             en: "High",           es: "Alta",             zh: "高" },
  generate:       { pt: "Gerar carrossel",  en: "Generate carousel", es: "Generar carrusel", zh: "生成轮播" },
  generating:     { pt: "Gerando…",         en: "Generating…",    es: "Generando…",       zh: "生成中…" },
  downloadAll:    { pt: "Baixar todos",     en: "Download all",   es: "Descargar todos",  zh: "下载全部" },
  slide:          { pt: "Slide",            en: "Slide",          es: "Slide",            zh: "幻灯片" },
  emptyTitle:     { pt: "Seu carrossel aparecerá aqui",
                   en: "Your carousel will appear here",
                   es: "Tu carrusel aparecerá aquí",
                   zh: "您的轮播将在此处显示" },
  emptyDesc:      { pt: "Escreva o roteiro e clique em Gerar carrossel.",
                   en: "Write the script and click Generate carousel.",
                   es: "Escribe el guión y haz clic en Generar carrusel.",
                   zh: "编写剧本并点击生成轮播。" },
  notif:          { pt: "Carrossel pronto", en: "Carousel ready", es: "Carrusel listo",   zh: "轮播已就绪" },
  failed:         { pt: "Falhou",           en: "Failed",         es: "Falló",            zh: "失败" },
  includeLogo:    { pt: "Incluir logo da marca em todos os slides",
                   en: "Include brand logo in every slide",
                   es: "Incluir logo de la marca en todos los slides",
                   zh: "在每个幻灯片中包含品牌 logo" },
  scriptTooShort: { pt: "Roteiro precisa ter pelo menos 10 caracteres.",
                   en: "Script must be at least 10 characters.",
                   es: "El guión debe tener al menos 10 caracteres.",
                   zh: "剧本至少需要 10 个字符。" },
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
  verifyTitle:    { pt: "Verifique sua organização OpenAI",
                   en: "Verify your OpenAI organization",
                   es: "Verifica tu organización OpenAI",
                   zh: "验证您的 OpenAI 组织" },
  verifyBtn:      { pt: "Verificar agora →", en: "Verify now →",  es: "Verificar ahora →", zh: "立即验证 →" },
};

const ASPECT_RATIOS = [
  { id: "1:1", labelKey: "arSquare"   as keyof typeof STR },
  { id: "4:5", labelKey: "arPortrait" as keyof typeof STR },
];

interface SlideResult {
  n: number;
  prompt: string;
  image_url: string | null;
  error?: string;
}

export default function HubCarousel() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [script, setScript] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [slideCount, setSlideCount] = useState(5);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [includeLicense, setIncludeLicense] = useState(true);
  const [licenseText, setLicenseText] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [slides, setSlides] = useState<SlideResult[] | null>(null);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);
  const effectiveLogoUrl = customLogo || (brand?.logoImage && brand.id !== "none" ? brand.logoImage : null);
  const defaultLicense = useMemo(() => {
    if (!brand?.license || !marketCode) return "";
    return brand.license[marketCode] || "";
  }, [brand, marketCode]);
  const hasLicense = !!defaultLicense;

  useEffect(() => {
    if (!brand || brand.markets.length === 0) {
      setMarketCode(null);
    } else {
      setMarketCode(prev => (prev && brand.markets.includes(prev) ? prev : brand.markets[0]));
    }
    setIncludeLogo(!!brand?.logoImage || !!customLogo);
  }, [brandId]);

  useEffect(() => {
    if (customLogo) setIncludeLogo(true);
  }, [customLogo]);

  useEffect(() => {
    if (defaultLicense) {
      setLicenseText(defaultLicense);
      setIncludeLicense(true);
    } else {
      setLicenseText("");
      setIncludeLicense(false);
    }
  }, [defaultLicense]);

  const generate = async () => {
    if (loading) return;
    if (script.trim().length < 10) { setError(t("scriptTooShort")); return; }
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setSlides(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      let brandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        brandHint = `${brandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }
      // Carousel-specific framing: cada slide é uma peça standalone
      // de social, com hierarquia clara. Headline grande no topo,
      // body curto, CTA quando aplicável.
      brandHint = `${brandHint}\n\nFORMAT: Social media carousel slide. Bold headline at top (large readable text), supporting visual element, brand-consistent style. Each slide must work as a standalone piece while maintaining visual unity with the rest of the carousel.`.trim();
      if (effectiveLogoUrl && includeLogo) {
        brandHint = `${brandHint}\n\nIMPORTANT: Do NOT render any logo or brand name as text/visual element inside the slides. The official brand logo will be added as overlay in post-production. Keep the upper-right corner clean.`;
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-storyboard-hub`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          script: script.trim(),
          scene_count: slideCount,
          aspect_ratio: aspectRatio,
          quality,
          brand_id: brandId === "none" ? null : brandId,
          brand_hint: brandHint,
          market: marketCode,
          market_context: marketCode ? HUB_MARKETS[marketCode].promptContext : "",
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; error?: string; message?: string; scenes?: SlideResult[] } | null = null;
      try { payload = JSON.parse(text); } catch {}

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") { setNeedsVerify(true); return; }
        setError((payload?.message || payload?.error || `HTTP ${r.status}`).slice(0, 400));
        return;
      }

      const raw = payload.scenes || [];
      const willCompose = (effectiveLogoUrl && includeLogo) || (hasLicense && includeLicense && licenseText.trim());
      let final = raw;
      if (willCompose) {
        final = await Promise.all(raw.map(async s => {
          if (!s.image_url) return s;
          try {
            const composed = await composeImage(s.image_url, {
              logoUrl: effectiveLogoUrl && includeLogo ? effectiveLogoUrl : null,
              licenseText: hasLicense && includeLicense ? licenseText.trim() : null,
              logoPosition: "top-right",
            });
            return { ...s, image_url: composed };
          } catch { return s; }
        }));
      }
      setSlides(final);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const carouselId = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await saveHubAssets(final
            .filter(s => s.image_url)
            .map(s => ({
              userId: user.id,
              type: "hub_carousel",
              content: {
                carousel_id: carouselId,
                slide_n: s.n,
                slide_count: final.length,
                prompt: s.prompt,
                image_url: s.image_url,
                aspect_ratio: aspectRatio,
                quality,
                model: "gpt-image-1",
                brand_id: brandId === "none" ? null : brandId,
                market: marketCode || null,
                script: script.trim(),
                logo_overlaid: !!(effectiveLogoUrl && includeLogo),
              },
            })));
        }

        const { data: { user: u2 } } = await supabase.auth.getUser();
        const ok = final.filter(s => s.image_url).length;
        addHubNotification(u2?.id, {
          kind: "image_generated",
          title: t("notif"),
          description: `${ok} ${t("slide").toLowerCase()}${ok > 1 ? "s" : ""} · ${script.trim().slice(0, 60)}${script.length > 60 ? "…" : ""}`,
          href: "/dashboard/hub/carousel",
        });
      } catch {}
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  const downloadOne = async (url: string, name: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) { console.error(e); }
  };
  const downloadAll = async () => {
    if (!slides) return;
    for (const s of slides) {
      if (!s.image_url) continue;
      await downloadOne(s.image_url, `carousel-${String(s.n).padStart(2, "0")}.png`);
      await new Promise(res => setTimeout(res, 250));
    }
  };

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>
      <div style={{ minHeight: "calc(100vh - 0px)", padding: "20px 28px 64px", maxWidth: 1480, margin: "0 auto", color: "#fff" }}>
        <button
          onClick={() => navigate("/dashboard/hub")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: "#9CA3AF",
            cursor: "pointer", fontSize: 12.5, padding: "4px 6px", marginBottom: 12,
            fontFamily: "inherit",
          }}>
          <ArrowLeft size={13} /> {t("back")}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, background: "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <GalleryHorizontal size={20} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 12, color: "#D1D5DB", margin: "2px 0 0" }}>{t("subtitle")}</p>
          </div>
        </div>

        {/* Brand strip + market chips compactos */}
        <div style={{ marginBottom: 14 }}>
          <p style={SECTION_LABEL}>{t("brand")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {HUB_BRANDS.map(b => {
              const active = brandId === b.id;
              const isNone = b.id === "none";
              return (
                <button
                  key={b.id}
                  onClick={() => setBrandId(b.id)}
                  disabled={loading}
                  style={{
                    padding: "10px 12px", borderRadius: 11,
                    background: active ? "rgba(59,130,246,0.10)" : "rgba(17,24,39,0.70)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.40)" : "rgba(255,255,255,0.06)"}`,
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left", fontFamily: "inherit",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: b.logoImage ? "rgba(0,0,0,0.85)" : b.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, overflow: "hidden",
                    }}>
                      {b.logoImage ? (
                        <img src={b.logoImage} alt={b.name} style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: isNone ? 12 : 11.5, fontWeight: 800, color: "#fff" }}>{b.logoInitials}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{getBrandName(b, lang)}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>
                        {b.markets.length > 0 ? b.markets.map(m => HUB_MARKETS[m]?.flag).join(" ") : "✦"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {brand && brand.markets.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={SECTION_LABEL}>{t("market")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {brand.markets.map(code => {
                const active = marketCode === code;
                return (
                  <button
                    key={code}
                    onClick={() => setMarketCode(code)}
                    disabled={loading}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "8px 13px", borderRadius: 10,
                      background: active ? "rgba(59,130,246,0.14)" : "rgba(17,24,39,0.70)",
                      border: `1px solid ${active ? "rgba(59,130,246,0.40)" : "rgba(255,255,255,0.06)"}`,
                      color: active ? "#fff" : "#D1D5DB",
                      cursor: loading ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    }}>
                    <span style={{ fontSize: 16 }}>{HUB_MARKETS[code].flag}</span>
                    <span>{getMarketLabel(code, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Logo controls (brand logo + custom upload) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
          {effectiveLogoUrl && (
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 11,
              background: includeLogo ? "rgba(59,130,246,0.08)" : "rgba(17,24,39,0.70)",
              border: `1px solid ${includeLogo ? "rgba(59,130,246,0.30)" : "rgba(255,255,255,0.06)"}`,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={e => setIncludeLogo(e.target.checked)}
                disabled={loading}
                style={{ accentColor: "#3B82F6", width: 14, height: 14, cursor: "pointer" }}
              />
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: "rgba(0,0,0,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0,
              }}>
                <img src={effectiveLogoUrl} alt="logo" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>{t("includeLogo")}</span>
            </label>
          )}
          <CustomLogoUpload value={customLogo} onChange={setCustomLogo} language={lang} disabled={loading} />
        </div>

        {/* License panel — quando brand+market tem disclaimer regulatório */}
        {hasLicense && marketCode && (
          <div style={{
            marginBottom: 14, padding: 14,
            borderRadius: 12, background: "rgba(34,197,94,0.04)",
            border: "1px solid rgba(34,197,94,0.20)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#22d399" }}>
                {lang === "pt" ? "Disclaimer regulatório" : lang === "es" ? "Disclaimer regulatorio" : lang === "zh" ? "监管免责声明" : "Regulatory disclaimer"} · {getMarketLabel(marketCode, lang)}
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox" checked={includeLicense}
                  onChange={e => setIncludeLicense(e.target.checked)}
                  disabled={loading}
                  style={{ accentColor: "#22d399", width: 14, height: 14 }}
                />
                <span style={{ color: "#fff", fontWeight: 600 }}>
                  {lang === "pt" ? "Incluir em todos os slides" : lang === "es" ? "Incluir en todos los slides" : lang === "zh" ? "在所有幻灯片中包含" : "Include in every slide"}
                </span>
              </label>
            </div>
            <textarea
              value={licenseText}
              onChange={e => setLicenseText(e.target.value)}
              disabled={loading || !includeLicense}
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(0,0,0,0.30)",
                border: "1px solid rgba(34,197,94,0.18)",
                color: includeLicense ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)",
                fontSize: 11.5, lineHeight: 1.55,
                fontFamily: "inherit", resize: "vertical", outline: "none",
              }}
            />
          </div>
        )}

        {/* Workspace 2-coluna */}
        <div className="hub-carousel-workspace" style={{
          display: "grid", gridTemplateColumns: "minmax(0, 460px) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT */}
          <div style={{ background: "rgba(17,24,39,0.70)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 16 }}>
            <p style={SECTION_LABEL}>{t("script")}</p>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder={t("scriptPh")}
              rows={6}
              disabled={loading}
              style={{
                width: "100%", background: "rgba(0,0,0,0.30)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12, padding: "12px 14px",
                color: "#F1F5F9", fontSize: 14, lineHeight: 1.55,
                resize: "vertical", outline: "none", boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <p style={{ ...SECTION_LABEL, margin: 0 }}>{t("slideCount")}</p>
              <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                {[3, 5, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setSlideCount(n)}
                    disabled={loading}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 800,
                      background: slideCount === n ? "#3B82F6" : "transparent",
                      color: slideCount === n ? "#fff" : "#9CA3AF",
                      border: "none", cursor: loading ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <p style={SECTION_LABEL}>{t("format")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {ASPECT_RATIOS.map(ar => {
                  const active = aspectRatio === ar.id;
                  return (
                    <button
                      key={ar.id}
                      onClick={() => setAspectRatio(ar.id)}
                      disabled={loading}
                      style={{
                        padding: "10px 12px", borderRadius: 11,
                        background: active ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(59,130,246,0.40)" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#fff" : "#D1D5DB",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontFamily: "inherit", textAlign: "left",
                      }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{t(ar.labelKey)}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF" }}>{ar.id}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <p style={{ ...SECTION_LABEL, margin: 0 }}>{t("quality")}</p>
              <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                {(["low", "medium", "high"] as const).map(q => (
                  <button key={q} onClick={() => setQuality(q)} disabled={loading}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 800,
                      background: quality === q ? "#3B82F6" : "transparent",
                      color: quality === q ? "#fff" : "#9CA3AF",
                      border: "none", cursor: loading ? "not-allowed" : "pointer",
                      textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "inherit",
                    }}>
                    {q === "low" ? t("qDraft") : q === "medium" ? t("qMedium") : t("qHigh")}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generate}
              disabled={loading || script.trim().length < 10}
              style={{
                marginTop: 18, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: loading || script.trim().length < 10 ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: "#fff", border: "none",
                cursor: loading || script.trim().length < 10 ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{t("generate")}{brand && brand.id !== "none" && (
                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                    · {brand.name} · {slideCount} {t("slide").toLowerCase()}s
                  </span>
                )}</>
              )}
            </button>
          </div>

          {/* RIGHT */}
          <div>
            {needsVerify && (
              <div style={{ padding: "20px 22px", borderRadius: 14, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.30)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>{t("verifyTitle")}</h3>
                <a href="https://platform.openai.com/settings/organization/general" target="_blank" rel="noopener noreferrer"
                   style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, background: "#fbbf24", color: "#1a1a2e", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                  <Sparkles size={13} /> {t("verifyBtn")}
                </a>
              </div>
            )}
            {error && !needsVerify && (
              <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderRadius: 11, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                <AlertTriangle size={16} style={{ color: "#f87171", marginTop: 2 }} />
                <p style={{ fontSize: 12.5, color: "#fee2e2", margin: 0, lineHeight: 1.6 }}>{error}</p>
              </div>
            )}
            {slides && slides.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>
                    {slides.filter(s => s.image_url).length}/{slides.length} {t("slide").toLowerCase()}s
                  </p>
                  <button onClick={downloadAll} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 9,
                    background: "#3B82F6", color: "#fff",
                    border: "none", fontSize: 12.5, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Download size={13} /> {t("downloadAll")}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {slides.map(s => (
                    <div key={s.n} style={{ background: "rgba(17,24,39,0.70)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ position: "relative", background: "rgba(0,0,0,0.40)" }}>
                        {s.image_url ? (
                          <img src={s.image_url} alt={`Slide ${s.n}`}
                            style={{ width: "100%", aspectRatio: aspectRatio === "1:1" ? "1/1" : "4/5", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{
                            width: "100%", aspectRatio: aspectRatio === "1:1" ? "1/1" : "4/5",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#f87171", fontSize: 11, padding: 16, textAlign: "center", flexDirection: "column",
                          }}>
                            <AlertTriangle size={22} style={{ marginBottom: 8 }} />
                            {t("failed")}
                          </div>
                        )}
                        <div style={{
                          position: "absolute", top: 8, left: 8,
                          padding: "3px 8px", borderRadius: 6,
                          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
                          fontSize: 11, fontWeight: 800, color: "#fff",
                        }}>
                          {t("slide")} {s.n}
                        </div>
                        {s.image_url && (
                          <button
                            onClick={() => downloadOne(s.image_url!, `carousel-${String(s.n).padStart(2, "0")}.png`)}
                            style={{
                              position: "absolute", top: 8, right: 8,
                              width: 28, height: 28, borderRadius: 7,
                              background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
                              border: "none", color: "#fff", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                            <Download size={13} />
                          </button>
                        )}
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <p style={{
                          fontSize: 11.5, color: "#D1D5DB", margin: 0, lineHeight: 1.45,
                          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>{s.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!slides && !needsVerify && !error && !loading && (
              <div style={{
                background: "rgba(17,24,39,0.50)", border: "1px dashed rgba(255,255,255,0.10)",
                borderRadius: 14, minHeight: 360,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: 32, textAlign: "center", gap: 14,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <GalleryHorizontal size={26} strokeWidth={2} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5, maxWidth: 360 }}>{t("emptyDesc")}</p>
                </div>
              </div>
            )}
            {loading && (
              <div style={{
                background: "rgba(17,24,39,0.50)", border: "1px solid rgba(59,130,246,0.20)",
                borderRadius: 14, minHeight: 360,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: "12px 0 0", textAlign: "center" }}>
                  {t("generating")}
                  <br /><span style={{ fontSize: 11, color: "#9CA3AF" }}>{slideCount} {t("slide").toLowerCase()}s · ~{slideCount * 8}s</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .hub-carousel-workspace { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

const SECTION_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em",
  color: "#9CA3AF",
  margin: "0 0 9px",
  textTransform: "uppercase",
};
