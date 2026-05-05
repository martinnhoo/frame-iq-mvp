/**
 * HubPngGenerator — gera PNGs com fundo transparente.
 *
 * Variante do Image Studio focada em ASSETS isolados pra ad creatives:
 * logos, ícones, mascotes, badges, props. O modelo (gpt-image-2) suporta
 * background:transparent nativamente.
 *
 * Diferenças vs Image Studio:
 *   - Sem brand context (assets são genéricos por natureza)
 *   - Sem license overlay (não faz sentido em PNG isolado)
 *   - Sem logo overlay (o asset PODE SER um logo)
 *   - Aspect default 1:1 (mais útil pra elementos)
 *   - Quality default "high" (asset isolado merece qualidade máxima)
 *
 * Reusa generate-image-hub passando transparent:true.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Layers, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";
import { CustomLogoUpload } from "@/components/dashboard/CustomLogoUpload";
import { composeImage } from "@/lib/composeImageWithLicense";
import { saveHubAsset } from "@/lib/saveHubAsset";
import type { Lang } from "@/data/hubBrands";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",    en: "Back to Hub",    es: "Volver al Hub",    zh: "返回中心" },
  title:          { pt: "Gerador de PNG",   en: "PNG Generator",  es: "Generador de PNG", zh: "PNG 生成器" },
  subtitle:       { pt: "Gera PNGs com fundo transparente — assets isolados pra ad creatives.",
                   en: "Generate PNGs with transparent background — isolated assets for ad creatives.",
                   es: "Genera PNGs con fondo transparente — activos aislados para anuncios.",
                   zh: "生成透明背景的 PNG — 用于广告创意的独立素材。" },
  describe:       { pt: "Descreva o asset", en: "Describe the asset", es: "Describe el activo", zh: "描述素材" },
  describePh:     { pt: 'Ex: "Mascote felino laranja sorridente de costume rosa, estilo cartoon vibrante, isolado em fundo transparente"',
                   en: 'Ex: "Smiling orange cat mascot in pink costume, vibrant cartoon style, isolated on transparent background"',
                   es: 'Ej: "Mascota felina naranja sonriente con traje rosa, estilo cartoon vibrante, aislado en fondo transparente"',
                   zh: '例："穿着粉色服装的橙色卡通猫吉祥物，鲜明动漫风格，透明背景独立"' },
  format:         { pt: "Formato",          en: "Format",          es: "Formato",          zh: "格式" },
  quality:        { pt: "Qualidade",        en: "Quality",         es: "Calidad",          zh: "质量" },
  qDraft:         { pt: "Rascunho",         en: "Draft",           es: "Borrador",         zh: "草稿" },
  qMedium:        { pt: "Médio",            en: "Medium",          es: "Medio",            zh: "中等" },
  qHigh:          { pt: "Alta",             en: "High",            es: "Alta",             zh: "高" },
  generate:       { pt: "Gerar PNG",        en: "Generate PNG",    es: "Generar PNG",      zh: "生成 PNG" },
  generating:     { pt: "Gerando…",         en: "Generating…",     es: "Generando…",       zh: "生成中…" },
  download:       { pt: "Baixar",           en: "Download",        es: "Descargar",        zh: "下载" },
  regenerate:     { pt: "Gerar variação",   en: "Generate variant",es: "Generar variación",zh: "生成变体" },
  empty:          { pt: "Seu PNG aparecerá aqui",
                   en: "Your PNG will appear here",
                   es: "Tu PNG aparecerá aquí",
                   zh: "您的 PNG 将在此处显示" },
  notif:          { pt: "Novo PNG pronto",  en: "New PNG ready",   es: "Nuevo PNG listo",  zh: "新 PNG 已生成" },
  verifyTitle:    { pt: "Verifique sua organização OpenAI",
                   en: "Verify your OpenAI organization",
                   es: "Verifica tu organización OpenAI",
                   zh: "验证您的 OpenAI 组织" },
  verifyBtn:      { pt: "Verificar agora →", en: "Verify now →",   es: "Verificar ahora →",zh: "立即验证 →" },
  promptTooShort: { pt: "Descreva o asset com pelo menos 5 caracteres.",
                   en: "Describe the asset with at least 5 characters.",
                   es: "Describe el activo con al menos 5 caracteres.",
                   zh: "请用至少 5 个字符描述素材。" },
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
};

const ASPECT_RATIOS = [
  { id: "1:1",  label: "1:1",  desc: "Quadrado · Insta post / asset" },
  { id: "9:16", label: "9:16", desc: "Vertical · Reels / Story" },
  { id: "16:9", label: "16:9", desc: "Horizontal · YouTube / banner" },
];

export default function HubPngGenerator() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const generate = async () => {
    if (loading) return;
    if (prompt.trim().length < 5) { setError(t("promptTooShort")); return; }
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setImageUrl(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      // Adiciona instrução pra modelo otimizar pra fundo transparente
      const augmented = prompt.trim() + "\n\nIMPORTANT: The image must have a fully transparent background. The subject must be isolated, with no environment or scenery. Soft anti-aliased edges. Output as a transparent PNG asset.";

      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          prompt: augmented,
          aspect_ratio: aspectRatio,
          quality,
          transparent: true,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; _v?: string; error?: string; message?: string; image_url?: string } | null = null;
      try { payload = JSON.parse(text); } catch {}

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") { setNeedsVerify(true); return; }
        setError((payload?.message || payload?.error || `HTTP ${r.status}`).slice(0, 400));
        return;
      }

      let final = payload.image_url || null;
      // Se tem custom logo, sobrepõe (PNG transparente + logo no canto)
      if (final && customLogo && includeLogo) {
        try {
          final = await composeImage(final, { logoUrl: customLogo, logoPosition: "top-right" });
        } catch (e) { console.warn("[png] compose failed:", e); }
      }
      setImageUrl(final);

      // Persist no DB direto do frontend (RLS-safe)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && final) {
          await saveHubAsset({
            userId: user.id,
            type: "hub_png",
            content: {
              prompt: prompt.trim(),
              image_url: final,
              aspect_ratio: aspectRatio,
              quality,
              model: "gpt-image-2",
              transparent: true,
              logo_overlaid: !!(customLogo && includeLogo),
            },
          });
          addHubNotification(user.id, {
            kind: "image_generated",
            title: t("notif"),
            description: prompt.trim().slice(0, 80),
            href: "/dashboard/hub/library",
          });
        }
      } catch (e) { console.warn("[png] save failed:", e); }
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = `png-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) { console.error(e); }
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

        {/* Hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Layers size={20} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 12, color: "#D1D5DB", margin: "2px 0 0" }}>
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Workspace 2-coluna */}
        <div className="hub-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT */}
          <div style={{
            background: "rgba(17,24,39,0.70)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: 16,
          }}>
            <p style={SECTION_LABEL}>{t("describe")}</p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t("describePh")}
              rows={4}
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

            <div style={{ marginTop: 16 }}>
              <p style={SECTION_LABEL}>{t("format")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
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
                        textAlign: "left", fontFamily: "inherit",
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ar.label}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{ar.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <p style={{ ...SECTION_LABEL, margin: 0 }}>{t("quality")}</p>
              <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                {(["low", "medium", "high"] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    disabled={loading}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 800,
                      background: quality === q ? "#3B82F6" : "transparent",
                      color: quality === q ? "#fff" : "#9CA3AF",
                      border: "none", cursor: loading ? "not-allowed" : "pointer",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      fontFamily: "inherit",
                    }}>
                    {q === "low" ? t("qDraft") : q === "medium" ? t("qMedium") : t("qHigh")}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo overlay (custom upload) */}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {customLogo && (
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10,
                  background: includeLogo ? "rgba(59,130,246,0.08)" : "rgba(17,24,39,0.70)",
                  border: `1px solid ${includeLogo ? "rgba(59,130,246,0.30)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={e => setIncludeLogo(e.target.checked)}
                    disabled={loading}
                    style={{ accentColor: "#3B82F6", width: 14, height: 14 }}
                  />
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: "rgba(0,0,0,0.85)", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <img src={customLogo} alt="logo" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>
                    {lang === "pt" ? "Logo no canto" : lang === "es" ? "Logo en la esquina" : lang === "zh" ? "角落 logo" : "Corner logo"}
                  </span>
                </label>
              )}
              <CustomLogoUpload value={customLogo} onChange={setCustomLogo} language={lang} disabled={loading} />
            </div>

            <button
              onClick={generate}
              disabled={loading || prompt.trim().length < 5}
              style={{
                marginTop: 18, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: loading || prompt.trim().length < 5 ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: "#fff", border: "none",
                cursor: loading || prompt.trim().length < 5 ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{t("generate")}</>
              )}
            </button>
          </div>

          {/* RIGHT */}
          <div>
            {needsVerify && (
              <div style={{
                padding: "20px 22px", borderRadius: 14,
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.30)",
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>{t("verifyTitle")}</h3>
                <a href="https://platform.openai.com/settings/organization/general" target="_blank" rel="noopener noreferrer"
                   style={{
                     display: "inline-flex", alignItems: "center", gap: 6,
                     padding: "9px 16px", borderRadius: 10,
                     background: "#fbbf24", color: "#1a1a2e",
                     fontSize: 13, fontWeight: 800, textDecoration: "none",
                   }}>
                  <Sparkles size={13} /> {t("verifyBtn")}
                </a>
              </div>
            )}
            {error && !needsVerify && (
              <div style={{
                display: "flex", gap: 10,
                padding: "12px 16px", borderRadius: 11,
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
              }}>
                <AlertTriangle size={16} style={{ color: "#f87171", marginTop: 2 }} />
                <p style={{ fontSize: 12.5, color: "#fee2e2", margin: 0, lineHeight: 1.6 }}>{error}</p>
              </div>
            )}
            {imageUrl && (
              <div style={{
                background: "rgba(17,24,39,0.40)",
                border: "1px solid rgba(59,130,246,0.30)",
                borderRadius: 14, padding: 16,
                /* Checkered pattern pra mostrar transparência */
                backgroundImage: "linear-gradient(45deg, #1F2937 25%, transparent 25%), linear-gradient(-45deg, #1F2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1F2937 75%), linear-gradient(-45deg, transparent 75%, #1F2937 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <img src={imageUrl} alt={prompt} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button onClick={() => downloadImage(imageUrl)} style={ACTION_BTN}>
                    <Download size={14} /> {t("download")}
                  </button>
                  <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                    <RefreshCw size={14} /> {t("regenerate")}
                  </button>
                </div>
              </div>
            )}
            {!imageUrl && !needsVerify && !error && !loading && (
              <div style={{
                background: "rgba(17,24,39,0.50)",
                border: "1px dashed rgba(255,255,255,0.10)",
                borderRadius: 14,
                minHeight: 360,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: 32, textAlign: "center", gap: 14,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Layers size={26} strokeWidth={2} style={{ color: "#3B82F6" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{t("empty")}</p>
              </div>
            )}
            {loading && (
              <div style={{
                background: "rgba(17,24,39,0.50)",
                border: "1px solid rgba(59,130,246,0.20)",
                borderRadius: 14,
                minHeight: 360,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: "12px 0 0" }}>
                  {t("generating")}
                </p>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .hub-workspace { grid-template-columns: 1fr !important; }
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

const ACTION_BTN: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 11, fontSize: 13, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
};
