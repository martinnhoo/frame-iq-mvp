/**
 * Studio — geração em batch com angle distribution.
 *
 * UX simples (1 tela só):
 *   - Pick brand (opcional)
 *   - Prompt
 *   - Quantidade (1, 5, 10)
 *   - Aspect ratio (1:1, 9:16, 16:9)
 *   - Distribuição de angles (Auto Mix 70/20/10 OU custom)
 *   - GERAR
 *   - Grid de N resultados, cada um com angle label + Refinar + Library
 *
 * Backend: chama generate-creatives (bulk N) e refine-creative (1 refinement).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ChevronDown, Sparkles, Loader, AlertTriangle, Wand2,
  Download, FolderOpen, X, Check,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ANGLE_LIBRARY, anglesBySafety, pickAngles, type AngleSafety } from "@/data/angleLibrary";

interface BrandOption {
  id: string;
  name: string;
  asset_count: number;
}

interface CreativeResult {
  angle_id: string;
  angle_label: string;
  image_url?: string;
  asset_id?: string;
  error?: string;
  // Frontend-only state
  refining?: boolean;
  refinements?: { image_url: string; asset_id?: string; feedback: string }[];
}

const MAX_PROMPT = 1000;
const COUNT_OPTIONS = [1, 3, 5, 10];
const ASPECT_OPTIONS = [
  { id: "1:1",  label: "Quadrado",  hint: "Feed" },
  { id: "9:16", label: "Vertical",  hint: "Reels / Stories" },
  { id: "16:9", label: "Horizontal", hint: "Display" },
];

export default function Studio() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Form state
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [anglesMode, setAnglesMode] = useState<"auto" | "manual">("auto");
  const [manualAngles, setManualAngles] = useState<Set<string>>(new Set());
  const [angleModalOpen, setAngleModalOpen] = useState(false);

  // Run state
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CreativeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const pollAbortRef = useRef<{ abort: boolean }>({ abort: false });

  // Brands load
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("user_brands")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (!data) return;
        const enriched = await Promise.all(
          data.map(async (b) => {
            const { count: c } = await supabase
              .from("brand_assets")
              .select("id", { count: "exact", head: true })
              .eq("brand_id", b.id);
            return { id: b.id as string, name: (b.name as string) || "?", asset_count: c || 0 };
          })
        );
        setBrands(enriched);
      } catch { /* silent */ }
    })();
  }, []);

  // Tick elapsed timer enquanto running
  useEffect(() => {
    if (!running || !runStartedAt) return;
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - runStartedAt) / 1000)), 500);
    return () => clearInterval(i);
  }, [running, runStartedAt]);

  const selectedBrand = useMemo(
    () => brands.find(b => b.id === brandId) || null,
    [brands, brandId]
  );

  const generate = async () => {
    if (running) return;
    setError(null);
    if (prompt.trim().length < 5) {
      setError("Descreva o anúncio com pelo menos 5 caracteres.");
      return;
    }
    setRunning(true);
    setRunStartedAt(Date.now());
    setElapsed(0);
    setResults([]);
    setRunId(null);
    pollAbortRef.current = { abort: false };

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError("Sessão expirada. Faça login."); setRunning(false); return; }

      // Pré-popula slots vazios localmente pra mostrar UI imediata
      const angleIdsLocal = anglesMode === "manual" && manualAngles.size > 0
        ? Array.from(manualAngles).slice(0, count)
        : pickAngles(count, "balanced").map(a => a.id);
      setResults(angleIdsLocal.map(id => {
        const a = ANGLE_LIBRARY.find(x => x.id === id);
        return { angle_id: id, angle_label: a?.label || id };
      }));

      // POST kicks off background work, returns run_id imediato (HTTP 202)
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-creatives`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          brand_id: brandId,
          prompt: prompt.trim(),
          count,
          aspect_ratio: aspectRatio,
          angles: anglesMode === "manual" && manualAngles.size > 0
            ? Array.from(manualAngles)
            : null,
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; run_id?: string; angles?: { id: string; label: string }[]; error?: string; message?: string };
      try { payload = JSON.parse(text); } catch {
        setError(`Resposta inválida: ${text.slice(0, 150)}`);
        setRunning(false);
        return;
      }
      if (!payload.ok || !payload.run_id) {
        setError(payload.message || payload.error || "Falha ao iniciar");
        setRunning(false);
        return;
      }

      // Atualiza placeholders com angles reais retornados do server
      if (Array.isArray(payload.angles)) {
        setResults(payload.angles.map(a => ({ angle_id: a.id, angle_label: a.label })));
      }
      setRunId(payload.run_id);

      // Inicia polling — termina quando status='done' ou 'failed', ou abort
      pollRun(payload.run_id);
    } catch (e) {
      setError(String(e).slice(0, 200));
      setRunning(false);
    }
  };

  // Polling do studio_runs.results — atualiza UI conforme cada slot termina
  const pollRun = async (rid: string) => {
    const POLL_INTERVAL = 2500;     // 2.5s
    const MAX_DURATION = 5 * 60 * 1000;  // 5min hard cap
    const start = Date.now();

    while (!pollAbortRef.current.abort) {
      if (Date.now() - start > MAX_DURATION) {
        setError("Timeout: geração passou de 5 min. Verifique a Library.");
        setRunning(false);
        return;
      }
      try {
        const { data, error: dbErr } = await supabase
          .from("studio_runs")
          .select("status, results")
          .eq("id", rid)
          .maybeSingle();
        if (dbErr) {
          // Erro transiente, tenta de novo
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          continue;
        }
        if (!data) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          continue;
        }
        const r = data as unknown as { status: string; results: CreativeResult[] };
        if (Array.isArray(r.results) && r.results.length > 0) {
          setResults(r.results);
        }
        if (r.status === "done" || r.status === "failed") {
          setRunning(false);
          if (r.status === "failed") {
            setError("Geração falhou. Verifique os erros nos cards.");
          }
          return;
        }
      } catch (e) {
        console.warn("[poll] error:", e);
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  };

  // Cleanup polling no unmount
  useEffect(() => {
    return () => { pollAbortRef.current.abort = true; };
  }, []);

  const handleRefine = async (idx: number, feedback: string) => {
    const target = results[idx];
    if (!target?.image_url || !feedback.trim()) return;
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, refining: true } : r));
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const r = await fetch(`${SUPABASE_URL}/functions/v1/refine-creative`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          source_asset_id: target.asset_id || null,
          source_image_url: target.image_url,
          user_feedback: feedback.trim(),
        }),
      });
      const text = await r.text();
      let payload: { ok?: boolean; image_url?: string; asset_id?: string; error?: string; message?: string };
      try { payload = JSON.parse(text); } catch {
        setResults(prev => prev.map((r, i) => i === idx
          ? { ...r, refining: false, error: `Resposta inválida: ${text.slice(0, 80)}` }
          : r));
        return;
      }
      if (!payload.ok || !payload.image_url) {
        setResults(prev => prev.map((r, i) => i === idx
          ? { ...r, refining: false, error: payload.message || payload.error || "Falha refinar" }
          : r));
        return;
      }
      setResults(prev => prev.map((r, i) => i === idx ? {
        ...r, refining: false,
        refinements: [...(r.refinements || []), { image_url: payload.image_url!, asset_id: payload.asset_id, feedback }],
      } : r));
    } catch (e) {
      setResults(prev => prev.map((r, i) => i === idx
        ? { ...r, refining: false, error: String(e).slice(0, 100) }
        : r));
    }
  };

  return (
    <>
      <Helmet><title>Studio — Hub</title></Helmet>
      <div style={{
        minHeight: "100%", background: "#06070a", color: "#fff",
        padding: isMobile ? "16px 14px 28px" : "24px 28px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard/hub")} style={btnGhost}>
            <ArrowLeft size={13} /> Voltar ao Hub
          </button>
        </div>

        <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Studio</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "6px 0 0", maxWidth: 720, lineHeight: 1.5 }}>
              Gere múltiplos criativos com angles diferentes em uma única chamada. Selecione marca pra usar suas referências visuais.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard/hub/brands")}
            style={btnGhost}
          >
            <FolderOpen size={12} /> Gerenciar marcas
          </button>
        </div>

        {/* Form panel */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: isMobile ? 14 : 24, maxWidth: 1300,
        }}>
          {/* LEFT: form */}
          <div style={panelStyle}>
            {/* Brand */}
            <div style={fieldRow}>
              <label style={fieldLabel}>Marca</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setBrandId(null)}
                  style={chipStyle(brandId === null)}
                >Sem marca</button>
                {brands.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBrandId(b.id)}
                    style={chipStyle(brandId === b.id)}
                  >
                    {b.name}
                    {b.asset_count > 0 && (
                      <span style={{ marginLeft: 5, opacity: 0.6, fontSize: 10 }}>· {b.asset_count}</span>
                    )}
                  </button>
                ))}
                {brands.length === 0 && (
                  <button onClick={() => navigate("/dashboard/hub/brands")} style={{
                    ...chipStyle(false),
                    borderStyle: "dashed",
                    color: "#A78BFA",
                  }}>+ Criar marca</button>
                )}
              </div>
              {selectedBrand && selectedBrand.asset_count === 0 && (
                <div style={{ ...fieldHint, marginTop: 6, color: "#FCD34D" }}>
                  Esta marca não tem referências visuais. Adicione assets em "Gerenciar marcas" pra IA usar.
                </div>
              )}
            </div>

            {/* Prompt */}
            <div style={fieldRow}>
              <label style={fieldLabel}>O que você quer gerar</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, MAX_PROMPT))}
                rows={5}
                placeholder="ex: Mulher latina sorrindo segurando o celular, mostrando notificação de bônus de boas-vindas. Fundo: quarto moderno com luz neon."
                style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
              />
              <div style={{ ...fieldHint, textAlign: "right" }}>
                {prompt.length}/{MAX_PROMPT}
              </div>
            </div>

            {/* Count */}
            <div style={fieldRow}>
              <label style={fieldLabel}>Quantidade</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    style={chipStyle(count === n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Aspect */}
            <div style={fieldRow}>
              <label style={fieldLabel}>Formato</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ASPECT_OPTIONS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAspectRatio(a.id)}
                    style={chipStyle(aspectRatio === a.id)}
                  >
                    {a.label} <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 4 }}>{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Angles */}
            <div style={fieldRow}>
              <label style={fieldLabel}>Angles (direções criativas)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setAnglesMode("auto")}
                  style={chipStyle(anglesMode === "auto")}
                >Auto Mix (70/20/10)</button>
                <button
                  onClick={() => { setAnglesMode("manual"); setAngleModalOpen(true); }}
                  style={chipStyle(anglesMode === "manual")}
                >
                  Manual {anglesMode === "manual" && manualAngles.size > 0 && `(${manualAngles.size})`}
                </button>
              </div>
              <div style={{ ...fieldHint, marginTop: 6 }}>
                {anglesMode === "auto"
                  ? "Sistema escolhe N angles diferentes — 70% safe (escala), 20% moderado, 10% experimental."
                  : "Você escolhe quais angles usar."}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={running || prompt.trim().length < 5}
              style={{
                ...btnPrimary, width: "100%", justifyContent: "center",
                padding: "13px", fontSize: 14,
                opacity: (running || prompt.trim().length < 5) ? 0.5 : 1,
                cursor: (running || prompt.trim().length < 5) ? "not-allowed" : "pointer",
              }}
            >
              {running ? (
                <><Loader size={15} className="spin" /> Gerando... {elapsed}s</>
              ) : (
                <><Sparkles size={15} /> Gerar {count} criativo{count > 1 ? "s" : ""}</>
              )}
            </button>

            {error && (
              <div style={{
                marginTop: 10, padding: "9px 12px",
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.30)",
                borderRadius: 7, fontSize: 12, color: "#FCA5A5",
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </div>

          {/* RIGHT: results */}
          <div>
            {results.length === 0 ? (
              <div style={{
                ...panelStyle,
                minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", textAlign: "center", color: "rgba(255,255,255,0.40)",
              }}>
                <Wand2 size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Seus criativos vão aparecer aqui</div>
                <div style={{ fontSize: 12, marginTop: 6, maxWidth: 320 }}>
                  Configure ao lado e clique em <strong>Gerar</strong>. Cada imagem terá um angle diferente.
                </div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : count >= 5 ? "repeat(auto-fill, minmax(240px, 1fr))" : "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}>
                {results.map((r, idx) => (
                  <ResultCard
                    key={`${r.angle_id}-${idx}`}
                    result={r}
                    aspectRatio={aspectRatio}
                    onRefine={(feedback) => handleRefine(idx, feedback)}
                    isRunning={running}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {angleModalOpen && (
        <AngleManualPicker
          existing={manualAngles}
          targetCount={count}
          onClose={() => setAngleModalOpen(false)}
          onApply={(set) => { setManualAngles(set); setAngleModalOpen(false); }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .pulse { animation: pulse 1.2s ease-in-out infinite; }
      `}</style>
    </>
  );
}

// ── Result card ──────────────────────────────────────────────────
function ResultCard({
  result, aspectRatio, onRefine, isRunning,
}: {
  result: CreativeResult;
  aspectRatio: string;
  onRefine: (feedback: string) => void;
  isRunning: boolean;
}) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectCss = aspectRatio === "9:16" ? "9/16" : aspectRatio === "16:9" ? "16/9" : "1/1";
  const isPlaceholder = !result.image_url && !result.error;

  const submitRefine = () => {
    if (!feedback.trim()) return;
    onRefine(feedback.trim());
    setFeedback("");
    setRefineOpen(false);
  };

  return (
    <div style={{
      background: "rgba(17,24,39,0.50)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Image / placeholder / error */}
      <div style={{ position: "relative", background: "#000", aspectRatio: aspectCss }}>
        {result.image_url ? (
          <a href={result.image_url} target="_blank" rel="noopener noreferrer" style={{
            display: "block", width: "100%", height: "100%", cursor: "zoom-in",
          }}>
            <img src={result.image_url} alt="" loading="lazy" decoding="async" style={{
              width: "100%", height: "100%", objectFit: "cover", display: "block",
            }} />
          </a>
        ) : result.error ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "#FCA5A5", padding: 12, textAlign: "center", fontSize: 11.5,
          }}>
            <AlertTriangle size={20} style={{ marginBottom: 6 }} />
            <div>{result.error.slice(0, 100)}</div>
          </div>
        ) : (
          <div className={isRunning ? "pulse" : undefined} style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.30)",
          }}>
            {isRunning ? <Loader size={22} className="spin" /> : "—"}
          </div>
        )}
        {/* Angle badge */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "3px 7px", borderRadius: 4,
          background: "rgba(167,139,250,0.92)",
          color: "#0a0a0f", fontSize: 9.5, fontWeight: 800,
          letterSpacing: "0.04em",
          maxWidth: "calc(100% - 12px)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{result.angle_label}</div>
      </div>

      {/* Actions */}
      {result.image_url && (
        <>
          <div style={{
            padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between",
          }}>
            <button
              onClick={() => { setRefineOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              disabled={result.refining}
              style={miniBtnStyle}
            >
              <Wand2 size={11} /> {result.refining ? "Refinando..." : "Refinar"}
            </button>
            <a
              href={result.image_url}
              download={`creative-${result.angle_id}.png`}
              target="_blank" rel="noopener noreferrer"
              style={{ ...miniBtnStyle, textDecoration: "none" }}
            >
              <Download size={11} />
            </a>
          </div>

          {/* Refine input inline */}
          {refineOpen && (
            <div style={{
              padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(167,139,250,0.05)",
              display: "flex", gap: 6, alignItems: "center",
            }}>
              <input
                ref={inputRef}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitRefine(); if (e.key === "Escape") setRefineOpen(false); }}
                placeholder="ex: rosto mais sorridente, fundo escuro"
                style={{
                  flex: 1, padding: "6px 9px",
                  background: "rgba(0,0,0,0.30)",
                  border: "1px solid rgba(167,139,250,0.30)",
                  borderRadius: 5, color: "#fff", fontSize: 11.5,
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <button onClick={submitRefine} disabled={!feedback.trim()} style={{
                ...miniBtnStyle,
                background: feedback.trim() ? "#A78BFA" : "rgba(167,139,250,0.30)",
                color: "#0a0a0f",
                opacity: feedback.trim() ? 1 : 0.5,
              }}><Check size={11} /></button>
              <button onClick={() => setRefineOpen(false)} style={miniBtnStyle}>
                <X size={11} />
              </button>
            </div>
          )}

          {/* Refinements (variants) */}
          {result.refinements && result.refinements.length > 0 && (
            <div style={{
              padding: "8px 10px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.20)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Refinements ({result.refinements.length})
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                gap: 5,
              }}>
                {result.refinements.map((ref, i) => (
                  <a
                    key={i} href={ref.image_url} target="_blank" rel="noopener noreferrer"
                    title={ref.feedback}
                    style={{
                      display: "block", aspectRatio: aspectCss,
                      borderRadius: 4, overflow: "hidden",
                      background: "#000",
                      border: "1px solid rgba(167,139,250,0.25)",
                    }}
                  >
                    <img src={ref.image_url} alt="" loading="lazy" style={{
                      width: "100%", height: "100%", objectFit: "cover",
                    }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Manual angle picker modal ────────────────────────────────────
function AngleManualPicker({
  existing, targetCount, onClose, onApply,
}: {
  existing: Set<string>;
  targetCount: number;
  onClose: () => void;
  onApply: (set: Set<string>) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(existing));
  const [filter, setFilter] = useState<AngleSafety | "all">("all");
  const isMobile = useIsMobile();

  const filtered = filter === "all" ? ANGLE_LIBRARY : anglesBySafety(filter);
  const safetyColor = (s: AngleSafety): string =>
    s === "safe" ? "#34D399" : s === "moderate" ? "#FBBF24" : "#F472B6";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? 8 : 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0a0a0f", border: "1px solid rgba(167,139,250,0.30)", borderRadius: 14,
        maxWidth: 640, width: "100%", maxHeight: "85vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>Escolher Angles</h3>
          <button onClick={onClose} style={btnGhost}><X size={13} /></button>
        </div>
        <div style={{ padding: "10px 18px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" }}>
          {(["all", "safe", "moderate", "experimental"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {filtered.map(a => {
            const isSel = selected.has(a.id);
            return (
              <button key={a.id} onClick={() => {
                setSelected(prev => {
                  const next = new Set(prev);
                  if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                  return next;
                });
              }} style={{
                width: "100%", textAlign: "left",
                padding: "10px 12px", marginBottom: 6,
                background: isSel ? "rgba(167,139,250,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isSel ? "#A78BFA" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit", color: "#fff",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{a.label}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.05em",
                    padding: "1px 6px", borderRadius: 3,
                    background: `${safetyColor(a.safety)}22`,
                    color: safetyColor(a.safety),
                    textTransform: "uppercase",
                  }}>{a.safety}</span>
                  {isSel && <Check size={12} style={{ color: "#A78BFA", marginLeft: "auto" }} />}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
                  {a.intent}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{
          padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>
            {selected.size} selecionados {selected.size > targetCount && (
              <span style={{ color: "#FCD34D", marginLeft: 4 }}>(só {targetCount} serão usados)</span>
            )}
          </span>
          <button onClick={() => onApply(selected)} disabled={selected.size === 0} style={{
            ...btnPrimary, padding: "9px 16px", fontSize: 12.5,
            opacity: selected.size === 0 ? 0.5 : 1,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
          }}>Aplicar ({selected.size})</button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14, padding: "18px 20px",
};
const fieldRow: React.CSSProperties = { marginBottom: 16 };
const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 7,
};
const fieldHint: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, marginTop: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8, color: "#fff", fontSize: 13,
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6, color: "rgba(255,255,255,0.75)",
  fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  background: "#A78BFA",
  border: "1px solid #A78BFA",
  borderRadius: 8, color: "#0a0a0f",
  fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 9px", borderRadius: 5,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 11, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", textDecoration: "none",
};
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px", borderRadius: 6,
    background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#A78BFA" : "rgba(255,255,255,0.10)"}`,
    color: active ? "#C4B5FD" : "rgba(255,255,255,0.75)",
    fontSize: 11.5, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
  };
}
