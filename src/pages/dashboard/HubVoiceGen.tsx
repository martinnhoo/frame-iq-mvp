/**
 * HubVoiceGen — locução com Fish Audio.
 *
 * O que mudou em relação à versão ElevenLabs:
 *
 *   • 9 vozes fixas em inglês  →  catálogo PT-BR navegável
 *   • Escolher voz às cegas    →  play inline, preview grátis
 *   • Sliders "Stability" e    →  chips de emoção ([animado], [pausa]…)
 *     "Similarity boost"          que o Fish executa nativamente
 *   • Custo invisível          →  custo mostrado antes de gerar
 *
 * Os sliders foram o motivo real de a tela ser confusa: pediam ao usuário
 * uma decisão numérica sobre um parâmetro que ele não tem como avaliar sem
 * gerar. As tags de emoção resolvem o mesmo problema com uma palavra.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Play, Pause, Search, Loader2, Volume2, Sparkles, Download, Check,
} from "lucide-react";
import { useHubCredits, notifyCreditsSpent } from "@/hooks/useHubCredits";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  border1: "rgba(240,246,252,0.07)", border2: "rgba(240,246,252,0.12)",
  text1: "#F0F6FC", text2: "rgba(240,246,252,0.72)", text3: "rgba(240,246,252,0.48)",
  blue: "#0ea5e9", green: "#4ADE80", purple: "#A78BFA", red: "#F87171",
  label: "rgba(240,246,252,0.40)",
};

interface Voice {
  id: string;
  name: string;
  author: string | null;
  languages: string[];
  tags: string[];
  gender: "male" | "female" | "neutral";
  age: string | null;
  useCase: string;
  popularity: number;
  likes: number;
  sample_audio: string | null;
}

const USE_CASES = [
  { id: "todos",    label: "Todos" },
  { id: "anuncio",  label: "Anúncio" },
  { id: "narracao", label: "Narração" },
  { id: "social",   label: "Social / UGC" },
  { id: "locutor",  label: "Locutor" },
];

const LANGUAGES = [
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
  { id: "es", label: "Espanhol" },
];

/** Tags de emoção do Fish. Substituem os sliders — cada uma é autoexplicativa. */
const EMOTION_CHIPS = [
  { tag: "[animado]",     label: "Animado" },
  { tag: "[sussurrando]", label: "Sussurro" },
  { tag: "[ênfase]",      label: "Ênfase" },
  { tag: "[pausa]",       label: "Pausa" },
  { tag: "[rindo]",       label: "Rindo" },
  { tag: "[sério]",       label: "Sério" },
  { tag: "[suave]",       label: "Suave" },
];

export default function HubVoiceGen() {
  const credits = useHubCredits();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [language, setLanguage] = useState("pt");
  const [useCase, setUseCase] = useState("todos");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; free: boolean; credits: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Catálogo ───────────────────────────────────────────────────────────────
  const loadVoices = useCallback(async () => {
    setLoadingVoices(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("hub-voice-gen", {
        body: {
          action: "voices",
          language,
          query: query.trim(),
          // A aba vira consulta por tag no Fish, não peneira local.
          use_case: useCase === "todos" ? "" : useCase,
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.ok) throw new Error(data?.message || "Falha ao carregar vozes");
      setVoices(data.voices || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar vozes");
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  }, [language, query, useCase]);

  useEffect(() => {
    const t = setTimeout(() => { void loadVoices(); }, query ? 400 : 0);
    return () => clearTimeout(t);
  }, [loadVoices, query]);

  // Só o gênero filtra local — o uso já foi consultado no servidor.
  const filtered = useMemo(
    () => voices.filter(v => gender === "all" || v.gender === gender),
    [voices, gender]);

  const selected = useMemo(
    () => voices.find(v => v.id === selectedId) || null, [voices, selectedId]);

  // ── Preview: toca o sample. Zero crédito. ──────────────────────────────────
  const togglePreview = (v: Voice) => {
    if (!v.sample_audio) return;
    if (previewId === v.id) {
      audioRef.current?.pause();
      setPreviewId(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(v.sample_audio);
    audioRef.current = a;
    a.onended = () => setPreviewId(null);
    a.onerror = () => setPreviewId(null);
    void a.play().catch(() => setPreviewId(null));
    setPreviewId(v.id);
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const insertTag = (tag: string) => {
    const el = textRef.current;
    if (!el) { setText(t => `${t}${tag} `); return; }
    const start = el.selectionStart ?? text.length;
    setText(`${text.slice(0, start)}${tag} ${text.slice(start)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length + 1;
    });
  };

  // No modelo grátis o custo é zero — e a tela diz isso, em vez de esconder.
  const estimatedCost = 0;

  const generate = async () => {
    if (!selectedId || !text.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("hub-voice-gen", {
        body: { action: "generate", text: text.trim(), voice_id: selectedId, speed },
      });
      if (fnErr) throw fnErr;
      if (!data?.ok) throw new Error(data?.message || "Falha ao gerar locução");
      setResult({ url: data.audio_url, free: !!data.free, credits: data.credits_charged || 0 });
      if (!data.free) { notifyCreditsSpent(); void credits.reload(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar locução");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = !!selectedId && text.trim().length > 0 && !generating;

  return (
    <div style={{ minHeight: "100%", background: T.bg0, color: T.text1, padding: "20px 22px" }}>
      <Helmet><title>Locução · AdBrief Hub</title></Helmet>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Volume2 size={17} color={T.purple} />
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Locução</h1>
        <span style={{
          marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", color: T.green,
          background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)",
          borderRadius: 4, padding: "3px 7px",
        }}>Grátis</span>
      </div>
      <p style={{ fontSize: 12, color: T.text3, margin: "0 0 20px" }}>
        Ouça antes de escolher. Nenhum preview consome crédito.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)", gap: 20, alignItems: "start" }}>

        {/* ── Coluna esquerda: catálogo ───────────────────────────────────── */}
        <div>
          {/* Filtros */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: 10, color: T.label }} />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar voz…"
                style={{
                  width: "100%", padding: "8px 10px 8px 30px", fontSize: 12,
                  background: T.bg1, border: `1px solid ${T.border1}`,
                  borderRadius: 7, color: T.text1, outline: "none",
                }}
              />
            </div>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <select value={gender} onChange={e => setGender(e.target.value as any)} style={selectStyle}>
              <option value="all">Qualquer voz</option>
              <option value="female">Feminina</option>
              <option value="male">Masculina</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {USE_CASES.map(u => (
              <button key={u.id} onClick={() => setUseCase(u.id)} style={chipStyle(useCase === u.id)}>
                {u.label}
              </button>
            ))}
          </div>

          {/* Grade de vozes */}
          {loadingVoices ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, justifyContent: "center", color: T.text3 }}>
              <Loader2 size={15} className="animate-spin" /> <span style={{ fontSize: 12 }}>Carregando vozes…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.text3, fontSize: 12 }}>
              Nenhuma voz com esses filtros. Tente outro uso ou idioma.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
              {filtered.map(v => {
                const active = selectedId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    style={{
                      padding: 11, borderRadius: 9, cursor: "pointer",
                      background: active ? T.bg3 : T.bg1,
                      border: `1px solid ${active ? T.purple : T.border1}`,
                      borderLeft: `2px solid ${active ? T.purple : "transparent"}`,
                      transition: "transform .12s, border-color .12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <button
                        onClick={e => { e.stopPropagation(); togglePreview(v); }}
                        disabled={!v.sample_audio}
                        title={v.sample_audio ? "Ouvir amostra" : "Sem amostra"}
                        style={{
                          width: 26, height: 26, flexShrink: 0, borderRadius: "50%",
                          display: "grid", placeItems: "center",
                          background: previewId === v.id ? T.purple : "rgba(167,139,250,0.14)",
                          border: "none", cursor: v.sample_audio ? "pointer" : "not-allowed",
                          opacity: v.sample_audio ? 1 : 0.35,
                          color: previewId === v.id ? "#0B0B0F" : T.purple,
                        }}
                      >
                        {previewId === v.id ? <Pause size={11} /> : <Play size={11} style={{ marginLeft: 1 }} />}
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis",
                        }}>{v.name}</div>
                      </div>
                      {active && <Check size={13} color={T.purple} style={{ flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: 10, color: T.text3, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <span>{v.gender === "female" ? "Feminina" : v.gender === "male" ? "Masculina" : "Neutra"}</span>
                      {v.age && <><span style={{ opacity: 0.4 }}>·</span><span>{v.age}</span></>}
                      {v.popularity > 1000 && (
                        <><span style={{ opacity: 0.4 }}>·</span>
                        <span>{(v.popularity / 1000).toFixed(0)}k usos</span></>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Coluna direita: roteiro ─────────────────────────────────────── */}
        <div style={{
          position: "sticky", top: 16, background: T.bg1,
          border: `1px solid ${T.border1}`, borderRadius: 11, padding: 15,
        }}>
          <div style={labelStyle}>Voz escolhida</div>
          <div style={{
            padding: "9px 11px", borderRadius: 7, marginBottom: 14,
            background: selected ? "rgba(167,139,250,0.08)" : T.bg2,
            border: `1px solid ${selected ? "rgba(167,139,250,0.25)" : T.border1}`,
            fontSize: 12, color: selected ? T.text1 : T.text3,
          }}>
            {selected ? selected.name : "Escolha uma voz ao lado"}
          </div>

          <div style={labelStyle}>Roteiro</div>
          <textarea
            ref={textRef}
            value={text} onChange={e => setText(e.target.value)}
            rows={7}
            placeholder="Escreva o texto da locução…"
            style={{
              width: "100%", padding: 10, fontSize: 12.5, lineHeight: 1.55,
              background: T.bg2, border: `1px solid ${T.border1}`, borderRadius: 7,
              color: T.text1, outline: "none", resize: "vertical",
              fontFamily: "inherit", marginBottom: 8,
            }}
          />

          <div style={labelStyle}>Emoção</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
            {EMOTION_CHIPS.map(c => (
              <button key={c.tag} onClick={() => insertTag(c.tag)} style={chipStyle(false)}>
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.text3, marginBottom: 14, lineHeight: 1.5 }}>
            Clique para inserir no ponto do texto. A marcação é interpretada, nunca lida em voz alta.
          </div>

          <div style={labelStyle}>Velocidade — {speed.toFixed(2)}x</div>
          <input
            type="range" min={0.5} max={2} step={0.05}
            value={speed} onChange={e => setSpeed(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 16, accentColor: T.purple }}
          />

          <button
            onClick={generate} disabled={!canGenerate}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8, border: "none",
              background: canGenerate ? T.blue : T.bg3,
              color: canGenerate ? "#fff" : T.text3,
              fontSize: 13, fontWeight: 700,
              cursor: canGenerate ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" /> Gerando…</>
              : <><Sparkles size={14} /> Gerar locução</>}
          </button>

          <div style={{
            marginTop: 9, fontSize: 10.5, textAlign: "center",
            color: estimatedCost === 0 ? T.green : T.text3,
          }}>
            {estimatedCost === 0
              ? `Sem custo em créditos · ${text.length} caracteres`
              : `≈ ${estimatedCost} créditos · saldo ${credits.balance}`}
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: 10, borderRadius: 7, fontSize: 11.5,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)", color: T.red,
            }}>{error}</div>
          )}

          {result && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 8,
              background: T.bg2, border: `1px solid ${T.border1}`,
            }}>
              <audio controls src={result.url} style={{ width: "100%", height: 34 }} />
              <a
                href={result.url} download="locucao.mp3"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginTop: 9, padding: "7px 10px", borderRadius: 6, fontSize: 11.5,
                  fontWeight: 600, color: T.text2, textDecoration: "none",
                  border: `1px solid ${T.border2}`,
                }}
              >
                <Download size={12} /> Baixar MP3
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: T.label, marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 12, background: T.bg1,
  border: `1px solid ${T.border1}`, borderRadius: 7,
  color: T.text1, outline: "none", cursor: "pointer",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6,
    background: active ? "rgba(167,139,250,0.15)" : T.bg1,
    border: `1px solid ${active ? "rgba(167,139,250,0.35)" : T.border1}`,
    color: active ? T.purple : T.text2, cursor: "pointer",
  };
}
