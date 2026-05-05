// HubImageGenerator — Image Generator interno.
//
// Subproduto isolado. Não importa contexto de persona/brand_kit/conta.
// Form simples: prompt + formato + qualidade + transparência. Resultado
// salva em creative_memory com type='hub_image' pra alimentar a
// Biblioteca interna.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle } from "lucide-react";

const ASPECT_RATIOS = [
  { id: "1:1",  label: "Quadrado · 1:1",   desc: "Feed, Insta post" },
  { id: "9:16", label: "Vertical · 9:16",  desc: "Reels, Stories, TikTok" },
  { id: "16:9", label: "Horizontal · 16:9", desc: "YouTube, banner site" },
  { id: "4:5",  label: "Retrato · 4:5",    desc: "Feed Insta otimizado" },
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
  created_at: string;
};

export default function HubImageGenerator() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenResult | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("creative_memory" as any)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "hub_image")
          .order("created_at", { ascending: false })
          .limit(12);
        if (!mounted || !data) return;
        setGallery((data as any[])
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content.image_url,
            prompt: r.content.prompt || "",
            aspect_ratio: r.content.aspect_ratio || "1:1",
            created_at: r.created_at,
          })));
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  const generate = async () => {
    if (loading || !prompt.trim() || prompt.trim().length < 5) return;
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      // fetch direto — supabase.functions.invoke esconde response body em
      // status non-2xx, então erros reais da OpenAI nunca chegavam à UI.
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
        }),
      });

      const text = await r.text();
      let payload: any = null;
      try { payload = JSON.parse(text); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        // Mensagem hierárquica: detail OpenAI > message > raw text > status
        const detail = payload?.openai_message || payload?.message || payload?.error || text || `HTTP ${r.status}`;
        const versionTag = payload?._v ? ` [fn=${payload._v}]` : " [fn=desconhecida — função antiga ainda no Supabase]";
        setError((detail + versionTag).slice(0, 500));
        return;
      }

      setResult(payload as GenResult);
      setGallery(prev => [{
        id: `tmp-${Date.now()}`,
        image_url: (payload as GenResult).image_url,
        prompt: (payload as GenResult).prompt,
        aspect_ratio: (payload as GenResult).aspect_ratio,
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
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>Image Generator</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>
              Gere imagens com IA
            </p>
          </div>
        </div>

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
            placeholder='Ex: "Cena cinematográfica de um relógio de pulso premium em mármore preto, iluminação dramática, fotografia profissional"'
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

          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["low", "medium", "high"] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  disabled={loading}
                  title={q === "low" ? "Rascunho rápido" : q === "medium" ? "Produção" : "Entrega final"}
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

          </div>

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
                onClick={() => downloadImage(result.image_url, `hub-${Date.now()}.png`)}
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
            {result.model_used && (() => {
              const isPremium = result.model_used === "gpt-image-2" || result.model_used === "gpt-image-1";
              const accentColor = result.model_used === "gpt-image-2" ? "#22d399"
                : result.model_used === "gpt-image-1" ? "#38bdf8"
                : "#c084fc";
              const accentBg = result.model_used === "gpt-image-2" ? "rgba(34,211,153,0.06)"
                : result.model_used === "gpt-image-1" ? "rgba(56,189,248,0.06)"
                : "rgba(168,85,247,0.06)";
              const accentBorder = result.model_used === "gpt-image-2" ? "rgba(34,211,153,0.20)"
                : result.model_used === "gpt-image-1" ? "rgba(56,189,248,0.20)"
                : "rgba(168,85,247,0.20)";
              return (
                <div style={{
                  marginTop: 12, padding: "8px 12px",
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 8,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
                    color: accentColor,
                  }}>
                    Modelo: {result.model_used}{isPremium && " ★"}
                  </span>
                  {result.fallback_reason && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", lineHeight: 1.4 }}>
                      · modelos premium indisponíveis ({result.fallback_reason.slice(0, 120)}). Pra liberar gpt-image-2/1, verifica a org em platform.openai.com/settings/organization/general.
                    </span>
                  )}
                </div>
              );
            })()}
            {result.revised_prompt && result.revised_prompt !== result.prompt && (
              <p style={{
                fontSize: 11, color: "rgba(255,255,255,0.40)",
                marginTop: 8, padding: "8px 12px",
                background: "rgba(255,255,255,0.03)", borderRadius: 8,
                fontStyle: "italic", lineHeight: 1.55,
              }}>
                Prompt refinado pela IA: "{result.revised_prompt}"
              </p>
            )}
          </div>
        )}

        {gallery.length > 0 && (
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)", margin: "0 0 12px",
              textTransform: "uppercase",
            }}>
              Últimas geraçōes
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
                  onClick={() => downloadImage(item.image_url, `hub-${item.id}.png`)}
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
