/**
 * HubStoryboard — Storyboard contínuo a partir de roteiro/ideia.
 *
 * Layout 2-coluna:
 *   LEFT: Brand selector + market + roteiro (textarea grande) +
 *         scene count + aspect + qualidade + Gerar storyboard
 *   RIGHT: Resultado — grid de cenas geradas com imagens contínuas,
 *          numeração, prompt da cena. Botão "Baixar todas" gera ZIP.
 *
 * O backend (generate-storyboard-hub) divide o roteiro em N cenas
 * com "bible" de continuidade visual (mesmo personagem/cenário em
 * cada cena), depois gera N imagens em paralelo via gpt-image-2.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Clapperboard, Download, ArrowLeft, Sparkles, AlertTriangle, RefreshCw,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, getBrandName, getMarketLabel,
  type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",    en: "Back to Hub",    es: "Volver al Hub",    zh: "返回中心" },
  title:          { pt: "Storyboard",       en: "Storyboard",     es: "Storyboard",       zh: "故事板" },
  subtitle:      { pt: "Sequência contínua a partir de um roteiro · cenas visualmente consistentes",
                   en: "Continuous sequence from a script · visually consistent scenes",
                   es: "Secuencia continua a partir de un guión · escenas visualmente consistentes",
                   zh: "基于剧本的连续序列 · 视觉一致的场景" },
  brand:          { pt: "Marca",            en: "Brand",          es: "Marca",            zh: "品牌" },
  market:         { pt: "Mercado",          en: "Market",         es: "Mercado",          zh: "市场" },
  script:         { pt: "Roteiro / ideia",  en: "Script / idea",  es: "Guión / idea",     zh: "剧本 / 想法" },
  scriptPh:       { pt: "Ex: Jovem ganha grande prêmio no slot de cassino. Mostra a animação dele, a contagem de moedas caindo, e a celebração final com amigos.",
                   en: "Ex: Young man wins big jackpot on casino slot. Shows his excitement, coins pouring, final celebration with friends.",
                   es: "Ej: Joven gana gran premio en slot de casino. Muestra su emoción, monedas cayendo, celebración final con amigos.",
                   zh: "例：年轻人在赌场老虎机赢得大奖。展示他的兴奋、硬币倾泻、与朋友最后庆祝。" },
  sceneCount:     { pt: "Quantidade de cenas", en: "Scene count",    es: "Cantidad de escenas", zh: "场景数量" },
  format:         { pt: "Formato",          en: "Format",         es: "Formato",          zh: "格式" },
  quality:        { pt: "Qualidade",        en: "Quality",        es: "Calidad",          zh: "质量" },
  qDraft:         { pt: "Rascunho",         en: "Draft",          es: "Borrador",         zh: "草稿" },
  qMedium:        { pt: "Médio",            en: "Medium",         es: "Medio",            zh: "中等" },
  qHigh:          { pt: "Alta",             en: "High",           es: "Alta",             zh: "高" },
  arSquare:       { pt: "Quadrado",         en: "Square",         es: "Cuadrado",         zh: "方形" },
  arVertical:     { pt: "Vertical",         en: "Vertical",       es: "Vertical",         zh: "垂直" },
  arHorizontal:   { pt: "Horizontal",       en: "Horizontal",     es: "Horizontal",       zh: "横向" },
  generate:       { pt: "Gerar storyboard", en: "Generate storyboard", es: "Generar storyboard", zh: "生成故事板" },
  generating:     { pt: "Gerando…",         en: "Generating…",    es: "Generando…",       zh: "生成中…" },
  downloadAll:    { pt: "Baixar todas",     en: "Download all",   es: "Descargar todas",  zh: "下载全部" },
  scene:          { pt: "Cena",             en: "Scene",          es: "Escena",           zh: "场景" },
  emptyTitle:     { pt: "Seu storyboard aparecerá aqui",
                   en: "Your storyboard will appear here",
                   es: "Tu storyboard aparecerá aquí",
                   zh: "您的故事板将在此处显示" },
  emptyDesc:      { pt: "Escreva o roteiro à esquerda e clique em Gerar storyboard. As cenas vêm em sequência visualmente contínua.",
                   en: "Write the script on the left and click Generate storyboard. Scenes come in visually continuous sequence.",
                   es: "Escribe el guión a la izquierda y haz clic en Generar storyboard. Las escenas vienen en secuencia visualmente continua.",
                   zh: "在左侧编写剧本并点击生成故事板。场景将以视觉连续的序列呈现。" },
  verifyTitle:    { pt: "Verifique sua organização OpenAI",
                   en: "Verify your OpenAI organization",
                   es: "Verifica tu organización OpenAI",
                   zh: "验证您的 OpenAI 组织" },
  verifyBtn:      { pt: "Verificar agora →", en: "Verify now →",  es: "Verificar ahora →", zh: "立即验证 →" },
  failed:         { pt: "Falhou — tenta de novo", en: "Failed — try again", es: "Falló — intenta de nuevo", zh: "失败 — 重试" },
  notifTitle:     { pt: "Storyboard pronto", en: "Storyboard ready", es: "Storyboard listo", zh: "故事板已就绪" },
  scriptTooShort: { pt: "Roteiro precisa ter pelo menos 10 caracteres.", en: "Script must be at least 10 characters.", es: "El guión debe tener al menos 10 caracteres.", zh: "剧本至少需要 10 个字符。" },
  sessionExpired: { pt: "Sessão expirada — recarrega.", en: "Session expired — reload.", es: "Sesión expirada — recarga.", zh: "会话已过期 — 请刷新。" },
};

const ASPECT_RATIOS = [
  { id: "9:16", labelKey: "arVertical"   as keyof typeof STR },
  { id: "1:1",  labelKey: "arSquare"     as keyof typeof STR },
  { id: "16:9", labelKey: "arHorizontal" as keyof typeof STR },
];

interface SceneResult {
  n: number;
  prompt: string;
  image_url: string | null;
  error?: string;
}

export default function HubStoryboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [script, setScript] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [sceneCount, setSceneCount] = useState(4);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [scenes, setScenes] = useState<SceneResult[] | null>(null);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);

  useEffect(() => {
    if (!brand || brand.markets.length === 0) {
      setMarketCode(null);
    } else {
      setMarketCode(prev => (prev && brand.markets.includes(prev) ? prev : brand.markets[0]));
    }
  }, [brandId]);

  const generate = async () => {
    if (loading) return;
    if (script.trim().length < 10) { setError(t("scriptTooShort")); return; }
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setScenes(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      let brandHint = brand?.promptHint || "";
      let marketContext = "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        marketContext = HUB_MARKETS[marketCode].promptContext;
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
          scene_count: sceneCount,
          aspect_ratio: aspectRatio,
          quality,
          brand_id: brandId === "none" ? null : brandId,
          brand_hint: brandHint,
          market: marketCode,
          market_context: marketContext,
        }),
      });

      const text = await r.text();
      let payload: {
        ok?: boolean; _v?: string; error?: string; message?: string;
        scenes?: SceneResult[]; bible?: string; storyboard_id?: string;
      } | null = null;
      try { payload = JSON.parse(text); } catch {}

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") {
          setNeedsVerify(true);
          return;
        }
        setError((payload?.message || payload?.error || `HTTP ${r.status}`).slice(0, 400));
        return;
      }

      setScenes(payload.scenes || []);

      // Notif pro sino
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const ok = (payload.scenes || []).filter(s => s.image_url).length;
        addHubNotification(user?.id, {
          kind: "image_generated",
          title: t("notifTitle"),
          description: `${ok} ${t("scene").toLowerCase()}${ok > 1 ? "s" : ""} · ${script.trim().slice(0, 60)}${script.length > 60 ? "…" : ""}`,
          href: "/dashboard/hub/storyboard",
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
    if (!scenes) return;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (!s.image_url) continue;
      await downloadOne(s.image_url, `storyboard-scene-${String(s.n).padStart(2, "0")}.png`);
      // pequena espera entre downloads pro browser não bloquear
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

        {/* Hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Clapperboard size={20} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 12, color: "#D1D5DB", margin: "2px 0 0", letterSpacing: "0.01em" }}>
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Brand + Market — strip horizontal */}
        <div style={{ marginBottom: 14 }}>
          <p style={SECTION_LABEL}>{t("brand")}</p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}>
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
                    textAlign: "left",
                    transition: "all 0.18s",
                    fontFamily: "inherit",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: b.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: isNone ? 12 : 11.5, fontWeight: 800, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}>
                        {b.logoInitials}
                      </span>
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
          <div style={{ marginBottom: 18 }}>
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

        {/* Workspace 2-coluna */}
        <div className="hub-storyboard-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 460px) minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}>
          {/* LEFT — controles */}
          <div style={{
            background: "rgba(17,24,39,0.70)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: 16,
          }}>
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
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />

            {/* Scene count */}
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <p style={{ ...SECTION_LABEL, margin: 0 }}>{t("sceneCount")}</p>
              <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                {[3, 4, 6, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setSceneCount(n)}
                    disabled={loading}
                    style={{
                      padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 800,
                      background: sceneCount === n ? "#3B82F6" : "transparent",
                      color: sceneCount === n ? "#fff" : "#9CA3AF",
                      border: "none", cursor: loading ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect */}
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
                        fontFamily: "inherit",
                        textAlign: "left",
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

            {/* Quality */}
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

            {/* Generate */}
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
                transition: "background 0.12s",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{t("generate")}{brand && brand.id !== "none" && marketCode && (
                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                    · {brand.name} · {HUB_MARKETS[marketCode].flag} · {sceneCount} {t("scene").toLowerCase()}s
                  </span>
                )}</>
              )}
            </button>
          </div>

          {/* RIGHT — resultado */}
          <div>
            {needsVerify && (
              <div style={{
                padding: "20px 22px", borderRadius: 14,
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.30)",
                marginBottom: 14,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: "#fbbf24",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <AlertTriangle size={20} style={{ color: "#1a1a2e" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                      {t("verifyTitle")}
                    </h3>
                    <a href="https://platform.openai.com/settings/organization/general"
                       target="_blank" rel="noopener noreferrer"
                       style={{
                         display: "inline-flex", alignItems: "center", gap: 6,
                         padding: "9px 16px", borderRadius: 10,
                         background: "#fbbf24", color: "#1a1a2e",
                         fontSize: 13, fontWeight: 800, textDecoration: "none",
                       }}>
                      <Sparkles size={13} /> {t("verifyBtn")}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {error && !needsVerify && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 16px", borderRadius: 11,
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                marginBottom: 14,
              }}>
                <AlertTriangle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12.5, color: "#fee2e2", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>{error}</p>
              </div>
            )}

            {scenes && scenes.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>
                    {scenes.filter(s => s.image_url).length}/{scenes.length} {t("scene").toLowerCase()}s
                  </p>
                  <button
                    onClick={downloadAll}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 9,
                      background: "#3B82F6", color: "#fff",
                      border: "none", fontSize: 12.5, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                    <Download size={13} /> {t("downloadAll")}
                  </button>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}>
                  {scenes.map(s => (
                    <div key={s.n} style={{
                      background: "rgba(17,24,39,0.70)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12, overflow: "hidden",
                    }}>
                      <div style={{ position: "relative", background: "rgba(0,0,0,0.40)" }}>
                        {s.image_url ? (
                          <img src={s.image_url} alt={`Scene ${s.n}`}
                            style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{
                            width: "100%", aspectRatio: "9/16",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#f87171", fontSize: 11, padding: 16, textAlign: "center",
                          }}>
                            <AlertTriangle size={22} style={{ marginBottom: 8 }} />
                            {t("failed")}
                          </div>
                        )}
                        <div style={{
                          position: "absolute", top: 8, left: 8,
                          padding: "3px 8px", borderRadius: 6,
                          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
                          fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                          color: "#fff",
                        }}>
                          {t("scene")} {s.n}
                        </div>
                        {s.image_url && (
                          <button
                            onClick={() => downloadOne(s.image_url!, `storyboard-scene-${String(s.n).padStart(2, "0")}.png`)}
                            title={t("downloadAll")}
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

            {!scenes && !needsVerify && !error && !loading && (
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
                  <Clapperboard size={26} strokeWidth={2} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                    {t("emptyTitle")}
                  </p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5, maxWidth: 360 }}>
                    {t("emptyDesc")}
                  </p>
                </div>
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
                padding: 32, gap: 12,
              }}>
                <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: 0, textAlign: "center" }}>
                  {t("generating")}
                  <br />
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {sceneCount} {t("scene").toLowerCase()}s · ~{sceneCount * 8}s
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .hub-storyboard-workspace { grid-template-columns: 1fr !important; }
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
