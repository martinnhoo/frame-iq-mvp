// HubImageGenerator — Geração de imagem com IA dentro do Brilliant Hub.
//
// UX: prompt grande no centro + 4 aspect ratios pré-definidos +
// toggle de "aplicar marca" (se persona selecionada) + Generate.
// Resultado aparece em preview grande com download e regenerate.
// Galeria abaixo lista as últimas 12 gerações dessa persona.
//
// Backend: invoca generate-image-hub edge function (DALL-E 3 + brand
// context). Cada geração salva em creative_memory com type =
// 'generated_image' pra alimentar a biblioteca + atividades recentes.

import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle } from "lucide-react";

const ASPECT_RATIOS = [
  { id: "1:1", label: "Quadrado · 1:1", desc: "Feed, Insta post" },
  { id: "9:16", label: "Vertical · 9:16", desc: "Reels, Stories, TikTok" },
  { id: "16:9", label: "Horizontal · 16:9", desc: "YouTube, banner site" },
  { id: "4:5", label: "Retrato · 4:5", desc: "Feed Insta otimizado" },
];

type GenResult = {
  image_url: string;
  prompt: string;
  augmented_prompt: string;
  revised_prompt: string;
  aspect_ratio: string;
  brand_applied: boolean;
  persona_name?: string;
};

type GalleryItem = {
  id: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  created_at: string;
};

export default function HubImageGenerator() {
  const navigate = useNavigate();
  const ctx = useOutletContext<DashboardContext>();
  const persona = ctx?.selectedPersona || null;

  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [applyBrand, setApplyBrand] = useState(true);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [transparent, setTransparent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenResult | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // ── Load gallery ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        let q = supabase.from("creative_memory" as any)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "generated_image")
          .order("created_at", { ascending: false })
          .limit(12);
        if (persona?.id) q = q.eq("persona_id", persona.id);
        const { data } = await q;
        if (!mounted || !data) return;
        const items: GalleryItem[] = (data as any[])
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content.image_url,
            prompt: r.content.prompt || "",
            aspect_ratio: r.content.aspect_ratio || "1:1",
            created_at: r.created_at,
          }));
        setGallery(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, [persona?.id]);

  const generate = async () => {
    if (loading || !prompt.trim() || prompt.trim().length < 5) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-image-hub", {
        body: {
          prompt: prompt.trim(),
          persona_id: applyBrand && persona?.id ? persona.id : null,
          aspect_ratio: aspectRatio,
          quality,
          transparent,
        },
      });
      if (fnErr || !(data as any)?.ok) {
        setError((data as any)?.message || fnErr?.message || "Falha desconhecida");
        return;
      }
      setResult(data as GenResult);
      // Refresh gallery — just prepend the new one
      setGallery(prev => [{
        id: `tmp-${Date.now()}`,
        image_url: (data as GenResult).image_url,
        prompt: (data as GenResult).prompt,
        aspect_ratio: (data as GenResult).aspect_ratio,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 12));
    } catch (e) {
      setError(String(e).slice(0, 200));
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

  return (
    <>
      <Helmet>
        <title>Image Generator — Brilliant Hub</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1280, margin: "0 auto", color: "#fff" }}>
        {/* Back to Hub */}
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

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #a855f740 0%, #a855f720 100%)",
            border: "1px solid #a855f755",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px #a855f730",
          }}>
            <ImageIcon size={24} style={{ color: "#a855f7" }} />
          </div>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: "#fff",
              margin: 0, letterSpacing: "-0.01em",
            }}>Image Generator</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>
              Gere imagens com IA{persona?.name ? ` · contexto da marca ${persona.name}` : ""}
            </p>
          </div>
        </div>

        {/* Prompt + controls */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: 20, marginBottom: 24,
        }}>
          <label style={{
            display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.55)", marginBottom: 8, textTransform: "uppercase",
          }}>
            Descreva a imagem
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='Ex: "Cassino moderno em estilo cinematográfico, jovem casal feliz contando ganhos, neon verde e dourado, ambiente luxuoso com mesas de blackjack ao fundo"'
            rows={4}
            disabled={loading}
            style={{
              width: "100%", background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12, padding: "12px 14px",
              color: "#F1F5F9", fontSize: 14, lineHeight: 1.55,
              resize: "vertical", outline: "none", boxSizing: "border-box",
              fontFamily: "inherit",
              transition: "border-color 0.18s, box-shadow 0.18s",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "#a855f755";
              e.currentTarget.style.boxShadow = "0 0 0 1px #a855f733";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          {/* Aspect ratio */}
          <div style={{ marginTop: 16 }}>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
              color: "rgba(255,255,255,0.55)", marginBottom: 8, textTransform: "uppercase",
            }}>
              Formato
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {ASPECT_RATIOS.map(ar => {
                const active = aspectRatio === ar.id;
                return (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    disabled={loading}
                    style={{
                      padding: "10px 12px", borderRadius: 10,
                      background: active ? "#a855f720" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "#a855f7" : "rgba(255,255,255,0.10)"}`,
                      color: active ? "#fff" : "rgba(255,255,255,0.65)",
                      cursor: loading ? "not-allowed" : "pointer",
                      textAlign: "left", fontSize: 13, fontWeight: 600,
                      transition: "all 0.15s",
                      font: "inherit",
                    }}
                  >
                    <div>{ar.label}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 400, marginTop: 2 }}>
                      {ar.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles row */}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            {persona?.id && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={applyBrand}
                  onChange={e => setApplyBrand(e.target.checked)}
                  disabled={loading}
                  style={{ accentColor: "#a855f7" }}
                />
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  Aplicar contexto de <strong>{persona.name}</strong>
                </span>
              </label>
            )}

            {/* Quality tier — gpt-image-2 tem 3 níveis vs DALL-E 2.
                Low = $0.011, medium = $0.042, high = $0.167 por imagem. */}
            <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["low", "medium", "high"] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  disabled={loading}
                  title={q === "low" ? "≈$0.011/img — rascunho rápido" : q === "medium" ? "≈$0.042/img — produção" : "≈$0.167/img — entrega final"}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                    background: quality === q ? "#a855f7" : "transparent",
                    color: quality === q ? "#000" : "rgba(255,255,255,0.55)",
                    border: "none", cursor: loading ? "not-allowed" : "pointer",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    font: "inherit",
                  }}
                >
                  {q === "low" ? "Rascunho" : q === "medium" ? "Médio" : "Alta"}
                </button>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={e => setTransparent(e.target.checked)}
                disabled={loading}
                style={{ accentColor: "#a855f7" }}
              />
              <span style={{ color: "rgba(255,255,255,0.85)" }}>
                Fundo transparente (PNG)
              </span>
            </label>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading || !prompt.trim() || prompt.trim().length < 5}
            style={{
              marginTop: 16, width: "100%", padding: "14px 20px",
              borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: loading || !prompt.trim() ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
              color: loading || !prompt.trim() ? "rgba(255,255,255,0.35)" : "#fff",
              border: "none", cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading || !prompt.trim() ? "none" : "0 8px 24px rgba(168,85,247,0.40)",
              transition: "all 0.15s",
              font: "inherit",
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
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
            marginBottom: 24,
          }}>
            <AlertTriangle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, color: "rgba(254,226,226,0.95)", margin: 0, lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(168,85,247,0.30)",
            borderRadius: 16, padding: 20, marginBottom: 24,
            boxShadow: "0 0 40px rgba(168,85,247,0.10)",
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
                onClick={() => downloadImage(result.image_url, `brilliant-hub-${Date.now()}.png`)}
                style={{
                  padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: "rgba(255,255,255,0.06)", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  font: "inherit",
                }}
              >
                <Download size={14} /> Baixar
              </button>
              <button
                onClick={generate}
                disabled={loading}
                style={{
                  padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: "rgba(255,255,255,0.06)", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  font: "inherit",
                }}
              >
                <RefreshCw size={14} /> Gerar variação
              </button>
            </div>
            {result.revised_prompt && result.revised_prompt !== result.augmented_prompt && (
              <p style={{
                fontSize: 11, color: "rgba(255,255,255,0.40)",
                marginTop: 12, padding: "8px 12px",
                background: "rgba(255,255,255,0.03)", borderRadius: 8,
                fontStyle: "italic", lineHeight: 1.55,
              }}>
                Prompt refinado pela IA: "{result.revised_prompt}"
              </p>
            )}
          </div>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)", margin: "0 0 12px",
              textTransform: "uppercase",
            }}>
              Últimas geraçōes{persona?.name ? ` · ${persona.name}` : ""}
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}>
              {gallery.map(item => (
                <div key={item.id} style={{
                  borderRadius: 10, overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  transition: "transform 0.15s, border-color 0.15s",
                }}
                  onClick={() => downloadImage(item.image_url, `brilliant-hub-${item.id}.png`)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = "rgba(168,85,247,0.40)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <img
                    src={item.image_url}
                    alt={item.prompt}
                    style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ padding: 8 }}>
                    <p style={{
                      fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0,
                      lineHeight: 1.4, display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>{item.prompt}</p>
                  </div>
                </div>
              ))}
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
