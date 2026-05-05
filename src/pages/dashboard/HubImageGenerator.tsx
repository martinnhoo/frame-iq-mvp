/**
 * HubImageGenerator — gerador de imagens com brand context.
 *
 * Layout Higgsfield-inspired:
 *   1. Brand selector — cards visuais clicáveis com logo (gradient +
 *      iniciais por enquanto). Hover/select com glow.
 *   2. License panel — auto-aparece quando a brand selecionada tem
 *      license (BETBUS hoje). Toggle pra incluir/excluir + textarea
 *      editável + botão pra resetar pro texto original.
 *   3. Prompt textarea — descrição da imagem.
 *   4. Aspect ratio + quality em chips visuais.
 *   5. Preview grande no centro com badge do modelo usado.
 *
 * Edge function recebe brand_id, include_license, license_text e
 * compõe o prompt final (brand_hint + user prompt + disclaimer
 * instruction).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  Copy, RotateCcw, Check,
} from "lucide-react";
import { HUB_BRANDS, getBrand, type HubBrand } from "@/data/hubBrands";

const ASPECT_RATIOS = [
  { id: "1:1",  label: "Quadrado",   sub: "1:1",   desc: "Feed, Insta post" },
  { id: "9:16", label: "Vertical",   sub: "9:16",  desc: "Reels, Stories" },
  { id: "16:9", label: "Horizontal", sub: "16:9",  desc: "YouTube, banner" },
  { id: "4:5",  label: "Retrato",    sub: "4:5",   desc: "Insta otimizado" },
];

type GenResult = {
  image_url: string;
  prompt: string;
  revised_prompt: string;
  aspect_ratio: string;
  model_used?: string;
  fallback_reason?: string | null;
};

type GalleryItem = {
  id: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  brand_id?: string;
  created_at: string;
};

export default function HubImageGenerator() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
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
  const hasLicense = !!brand?.license;

  // Quando troca de brand, repõe a license padrão e re-ativa o toggle
  useEffect(() => {
    if (brand?.license) {
      setLicenseText(brand.license);
      setIncludeLicense(true);
    } else {
      setLicenseText("");
      setIncludeLicense(false);
    }
  }, [brandId]);

  // Carrega galeria das últimas 12 imagens do user
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
          content?: { image_url?: string; prompt?: string; aspect_ratio?: string; brand_id?: string };
          created_at: string;
        }>)
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content!.image_url!,
            prompt: r.content!.prompt || "",
            aspect_ratio: r.content!.aspect_ratio || "1:1",
            brand_id: r.content!.brand_id,
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
      if (!token) { setError("Sessão expirada — recarrega a página."); return; }

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
          brand_hint: brand?.promptHint || "",
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
        // Erro especial: org não verificada — UI dedicada com link
        if (payload?.error === "needs_org_verification") {
          setNeedsVerify(true);
          return;
        }
        const detail = payload?.openai_message || payload?.message || payload?.error || text || `HTTP ${r.status}`;
        const versionTag = payload?._v ? ` [fn=${payload._v}]` : " [fn=desconhecida]";
        setError((detail + versionTag).slice(0, 500));
        return;
      }

      setResult({
        image_url: payload.image_url!,
        prompt: prompt.trim(),
        revised_prompt: payload.revised_prompt || prompt.trim(),
        aspect_ratio: aspectRatio,
        model_used: payload.model_used,
        fallback_reason: (payload as { fallback_reason?: string | null })?.fallback_reason,
      });
      setGallery(prev => [{
        id: `tmp-${Date.now()}`,
        image_url: payload!.image_url!,
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        brand_id: brandId === "none" ? undefined : brandId,
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
    if (brand?.license) setLicenseText(brand.license);
  };

  const promptValid = prompt.trim().length >= 5;

  return (
    <>
      <Helmet>
        <title>Image Generator — Hub</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1280, margin: "0 auto", color: "#fff" }}>
        <button
          onClick={() => navigate("/dashboard/hub")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: "rgba(255,255,255,0.55)",
            cursor: "pointer", fontSize: 13, padding: "6px 8px", marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} /> Voltar ao Hub
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
              Image Studio
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", margin: "3px 0 0", letterSpacing: "0.02em" }}>
              IA generativa por marca · disclaimer auto · multi-mercado
            </p>
          </div>
        </div>

        {/* ── Brand selector ──────────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <p style={SECTION_LABEL}>Marca</p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
            gap: 10,
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
                    position: "relative",
                    padding: 14,
                    borderRadius: 14,
                    background: active
                      ? "rgba(168,85,247,0.10)"
                      : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? "rgba(168,85,247,0.55)" : "rgba(255,255,255,0.06)"}`,
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.18s",
                    overflow: "hidden",
                    boxShadow: active
                      ? "0 0 24px rgba(168,85,247,0.25), inset 0 0 0 1px rgba(168,85,247,0.20)"
                      : "none",
                  }}
                  onMouseEnter={e => { if (!active && !loading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.045)"; }}
                  onMouseLeave={e => { if (!active && !loading) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    {/* Logo */}
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
                        {b.name}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "2px 0 0", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>{b.flag}</span>
                        <span>{b.marketLabel}</span>
                      </p>
                    </div>
                  </div>
                  {b.license && (
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

        {/* ── License panel (só pra marca com license) ──────────── */}
        {hasLicense && brand && (
          <div style={{
            marginBottom: 22,
            padding: 16,
            borderRadius: 14,
            background: "rgba(34,211,153,0.04)",
            border: "1px solid rgba(34,211,153,0.20)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "#22d399",
                }}>
                  Disclaimer regulatório · {brand.marketLabel}
                </span>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={includeLicense}
                  onChange={e => setIncludeLicense(e.target.checked)}
                  disabled={loading}
                  style={{ accentColor: "#22d399", width: 14, height: 14, cursor: "pointer" }}
                />
                <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                  Incluir no criativo
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
              <button
                onClick={copyLicense}
                disabled={loading}
                style={SUBTLE_BTN}
              >
                {licenseCopied ? <Check size={12} /> : <Copy size={12} />}
                {licenseCopied ? "Copiado" : "Copiar texto"}
              </button>
              <button
                onClick={resetLicense}
                disabled={loading || licenseText === brand.license}
                style={{ ...SUBTLE_BTN, opacity: licenseText === brand.license ? 0.4 : 1 }}
              >
                <RotateCcw size={12} /> Resetar
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
          <p style={SECTION_LABEL}>Descreva a imagem</p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='Ex: "Cena cinematográfica de um jogador celebrando uma vitória, neon vibrante, atmosfera premium de cassino"'
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
            <p style={SECTION_LABEL}>Formato</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {ASPECT_RATIOS.map(ar => {
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
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{ar.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: "0.04em" }}>{ar.sub}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
                      {ar.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality */}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <p style={{ ...SECTION_LABEL, margin: 0 }}>Qualidade</p>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(0,0,0,0.30)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              {(["low", "medium", "high"] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  disabled={loading}
                  title={q === "low" ? "Rascunho rápido" : q === "medium" ? "Produção" : "Entrega final"}
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
                  {q === "low" ? "Rascunho" : q === "medium" ? "Médio" : "Alta"}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
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
                Gerando…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Gerar imagem
                {brand && brand.id !== "none" && (
                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.85, fontWeight: 600 }}>
                    · {brand.name}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* ── Verify org (caso especial) ────────────────────────── */}
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
                  Verifique sua organização OpenAI
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 14px", lineHeight: 1.55 }}>
                  Pra usar o gpt-image-2 (qualidade fotorrealista pra ad creatives), a OpenAI exige
                  verification organizacional. <strong style={{ color: "#fbbf24" }}>Aprovado em ~5min</strong>
                  {" "}via verification individual (KYC com doc + selfie).
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
                    <Sparkles size={13} /> Verificar agora →
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
                    Fechar
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", margin: "12px 0 0", lineHeight: 1.5 }}>
                  Após aprovar a verification, volta aqui e tenta gerar de novo. Funciona automaticamente, sem precisar mexer no código.
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
              <button
                onClick={() => downloadImage(result.image_url, `hub-${Date.now()}.png`)}
                style={ACTION_BTN}
              >
                <Download size={14} /> Baixar
              </button>
              <button
                onClick={generate}
                disabled={loading}
                style={ACTION_BTN}
              >
                <RefreshCw size={14} /> Gerar variação
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
                    Modelo: {result.model_used} ★
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
                Prompt refinado pela IA: "{result.revised_prompt}"
              </p>
            )}
          </div>
        )}

        {/* ── Gallery ───────────────────────────────────────────── */}
        {gallery.length > 0 && (
          <div>
            <p style={SECTION_LABEL}>Últimas geraçōes</p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}>
              {gallery.map(item => {
                const itemBrand = item.brand_id ? getBrand(item.brand_id) : null;
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
                    {itemBrand && (
                      <div style={{
                        position: "absolute", top: 6, left: 6,
                        padding: "2px 7px", borderRadius: 6,
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(6px)",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.85)",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <span>{itemBrand.flag}</span>
                        <span>{itemBrand.name}</span>
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

// ── Estilos compartilhados ──────────────────────────────────────────
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
