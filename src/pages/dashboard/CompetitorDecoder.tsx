import { useState, useRef, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { Upload, Zap, Copy, Check, AlertCircle, Target, Crosshair, X, Film } from "lucide-react";
import { toast } from "sonner";

const F = {fontFamily:"'Inter', system-ui, sans-serif"} as const;
const M = {fontFamily:"'Inter', sans-serif"} as const;

interface Result {
  industry: string; market: string;
  hook_score: number; hook_score_label: string;
  diagnosis: string;
  why_it_works_or_fails: string;
  your_move: string;
  steal_this: string;
  hooks: string[];
  mismatch_detected?: boolean; mismatch_reason?: string;
}

const L: Record<string, Record<string, string>> = {
  pt: {
    title: "Concorrente", sub: "Analise qualquer anúncio como um CS sênior",
    tab_video: "Upload vídeo", tab_text: "Colar texto / link", tab_brand: "Buscar marca",
    drop_title: "Arraste o vídeo aqui ou clique para selecionar",
    drop_sub: "MP4, MOV, AVI — baixe o vídeo do TikTok/Insta e suba aqui",
    transcribing: "Transcrevendo vídeo...",
    text_placeholder: "Cole o roteiro, legenda, copy ou qualquer texto do anúncio...",
    link_placeholder: "...ou cole o link (tenta extrair conteúdo automaticamente)",
    obs_label: "Observação (opcional)",
    obs_placeholder: "O que você quer entender? A IA vai analisar com isso em mente...",
    btn: "Analisar", analyzing: "Analisando...",
    industry: "Setor / Nicho", market: "Mercado", hook: "Score do Hook",
    diagnosis_label: "O que esse anúncio está fazendo",
    why_label: "Por que funciona ou falha",
    move_label: "Sua jogada",
    steal_label: "Roube isso",
    hooks_label: "Hooks para usar agora",
    copy: "Copiar", copied: "Copiado!",
    empty: "Suba um vídeo ou cole o texto do anúncio",
    empty_sub: "Vídeo do TikTok, Instagram, Meta Ads ou qualquer copy de anúncio",
    remove: "Remover",
    video_ready: "Vídeo pronto para análise",
    brand_label: "Nome da marca ou empresa",
    brand_placeholder: "Ex: Nike, iFood, Nubank...",
    brand_btn: "Ver anúncios na Meta Ad Library →",
    brand_tip: "Abre a biblioteca de anúncios do Meta filtrada por essa marca. Copie o texto do anúncio e cole na aba ao lado para analisar.",
  },
  es: {
    title: "Competidor", sub: "Analiza cualquier anuncio como un CS senior",
    tab_video: "Subir video", tab_text: "Pegar texto / link", tab_brand: "Buscar marca",
    drop_title: "Arrastra el video aquí o haz clic para seleccionar",
    drop_sub: "MP4, MOV, AVI — descarga el video de TikTok/Instagram y súbelo aquí",
    transcribing: "Transcribiendo video...",
    text_placeholder: "Pega el guión, subtítulos, copy o cualquier texto del anuncio...",
    link_placeholder: "...o pega el enlace (intenta extraer contenido automáticamente)",
    obs_label: "Observación (opcional)",
    obs_placeholder: "¿Qué quieres entender? La IA analizará con esto en mente...",
    btn: "Analizar", analyzing: "Analizando...",
    industry: "Sector / Nicho", market: "Mercado", hook: "Score del Hook",
    diagnosis_label: "Lo que está haciendo este anuncio",
    why_label: "Por qué funciona o falla",
    move_label: "Tu jugada",
    steal_label: "Roba esto",
    hooks_label: "Hooks para usar ahora",
    copy: "Copiar", copied: "¡Copiado!",
    empty: "Sube un video o pega el texto del anuncio",
    empty_sub: "Video de TikTok, Instagram, Meta Ads o cualquier copy de anuncio",
    remove: "Eliminar",
    video_ready: "Video listo para analizar",
    brand_label: "Nombre de la marca o empresa",
    brand_placeholder: "Ej: Nike, Rappi, Mercado Libre...",
    brand_btn: "Ver anuncios en Meta Ad Library →",
    brand_tip: "Abre la biblioteca de anuncios de Meta filtrada por esa marca. Copia el texto del anuncio y pégalo en la pestaña de texto para analizar.",
  },
  en: {
    title: "Concorrente", sub: "Analise qualquer anúncio como um CS sênior",
    tab_video: "Upload video", tab_text: "Paste text / link", tab_brand: "Search brand",
    drop_title: "Drag video here or click to select",
    drop_sub: "MP4, MOV, AVI — download the TikTok/Instagram video and upload here",
    transcribing: "Transcribing video...",
    text_placeholder: "Paste the script, captions, copy or any ad text...",
    link_placeholder: "...or paste the link (tries to extract content automatically)",
    obs_label: "Observation (optional)",
    obs_placeholder: "What do you want to understand? AI will analyze with this in mind...",
    btn: "Analyze", analyzing: "Analyzing...",
    industry: "Sector / Niche", market: "Market", hook: "Hook Score",
    diagnosis_label: "What this ad is doing",
    why_label: "Why it works or fails",
    move_label: "Your move",
    steal_label: "Steal this",
    hooks_label: "Hooks to use now",
    copy: "Copy", copied: "Copied!",
    empty: "Upload a video or paste the ad text",
    empty_sub: "TikTok, Instagram, Meta Ads video or any ad copy",
    remove: "Remove",
    video_ready: "Video ready to analyze",
    brand_label: "Brand or company name",
    brand_placeholder: "E.g. Nike, Amazon, Apple...",
    brand_btn: "View ads in Meta Ad Library →",
    brand_tip: "Opens Meta's Ad Library filtered by this brand. Copy the ad text and paste it in the text tab to analyze.",
  },
};

function ScoreBar({ score }: { score: number }) {
  const c = score >= 750 ? "#34d399" : score >= 500 ? "#fbbf24" : "#f87171";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div>
        <span style={{ ...F, fontSize: 30, fontWeight: 900, color: c, lineHeight: 1 }}>{score}</span>
        <span style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.25)" }}>/1000</span>
      </div>
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,#a78bfa,${c})`, width: `${Math.min(100, score / 10)}%`, transition: "width 0.7s ease" }} />
      </div>
    </div>
  );
}

function Section({ label, content, onCopy, copied }: { label: string; content: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ ...M, fontSize: 12, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{label}</span>
        {onCopy && (
          <button onClick={onCopy} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", ...M, fontSize: 12, color: "rgba(238,240,246,0.38)" }}>
            {copied ? <><Check size={9}/> Copiado</> : <><Copy size={9}/> Copiar</>}
          </button>
        )}
      </div>
      <p style={{ ...M, fontSize: 13.5, color: "rgba(238,240,246,0.82)", lineHeight: 1.75, margin: 0 }}>{content}</p>
    </div>
  );
}

export default function CompetitorDecoder() {
  const { selectedPersona, user, aiProfile } = useOutletContext<DashboardContext & { aiProfile?: any }>();
  const { language } = useLanguage();
  const lang = (["pt","es","en"].includes(language) ? language : "pt") as "pt"|"es"|"en";
  const t = L[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"video"|"text"|"brand">("video");
  const [adText, setAdText] = useState("");
  const [observation, setObservation] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [brandQuery, setBrandQuery] = useState("");
  const [searchParams] = useSearchParams();

  // Pre-fill from CompetitorTracker navigation + persona context
  useEffect(() => {
    const brand = searchParams.get("brand");
    const market = searchParams.get("market");
    if (brand) {
      const obs = market ? `Analyzing ${brand} ads (${market} market)` : `Analyzing ${brand} ads`;
      setObservation(obs);
      setTab("text");
    }
  }, []);

  // Auto-set observation context from persona when no brand param
  useEffect(() => {
    if (!selectedPersona) return;
    const brand = searchParams.get("brand");
    if (brand) return; // don't override navigation param
    const p = selectedPersona;
    const mkt = (p.preferred_market || (p as any)?.result?.preferred_market || "").toUpperCase();
    const industry = p.industry || (p as any)?.result?.industry || aiProfile?.industry || "";
    if (mkt || industry) {
      const ctx = [
        industry ? `Nicho: ${industry}` : "",
        mkt ? `Mercado: ${mkt}` : "",
        p.name ? `Conta: ${p.name}` : "",
      ].filter(Boolean).join(" | ");
      setObservation(ctx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona?.id]);

  const cp = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [key]: true }));
    toast.success(t.copied);
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      toast.error(lang === "pt" ? "Selecione um arquivo de vídeo" : "Select a video file"); return;
    }
    setVideoFile(file);
    setTranscript("");
    setResult(null);
    // Auto-transcribe
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("video_file", file);
      fd.append("transcribe_only", "true");
      fd.append("user_id", "competitor-decoder");
      const { data, error } = await supabase.functions.invoke("analyze-video", { body: fd });
      if (error || !data?.transcript) throw new Error(data?.message || "transcription failed");
      setTranscript(data.transcript);
      toast.success(lang === "pt" ? "Transcrição pronta!" : lang === "es" ? "¡Transcripción lista!" : "Transcript ready!");
    } catch (e: any) {
      toast.error(lang === "pt" ? "Transcrição falhou — cole o texto manualmente" : "Transcription failed — paste the text manually");
      setTab("text");
    } finally { setTranscribing(false); }
  };

  const analyze = async () => {
    const inputText = tab === "video" ? transcript : tab === "brand" ? "" : adText.trim();
    if (!inputText || inputText.length < 15) {
      toast.error(lang === "pt" ? "Cole ou transcreva o conteúdo do anúncio primeiro" : lang === "es" ? "Añade el contenido del anuncio primero" : "Cole ou transcreva o conteúdo do anúncio primeiro"); return;
    }
    setLoading(true); setResult(null);
    try {
      const personaCtx = selectedPersona ? [
        `Account: ${selectedPersona.name}.`,
        selectedPersona.industry || (selectedPersona as any)?.result?.industry ? `Industry: ${selectedPersona.industry || (selectedPersona as any)?.result?.industry}.` : "",
        selectedPersona.preferred_market ? `Market: ${selectedPersona.preferred_market}.` : "",
        selectedPersona.pains?.length ? `Target pains: ${selectedPersona.pains.slice(0,2).join(", ")}.` : "",
      ].filter(Boolean).join(" ") : undefined;
      const { data, error } = await supabase.functions.invoke("decode-competitor", {
        body: { ad_text: inputText, observation: observation.trim() || undefined, persona_context: personaCtx, ui_language: lang },
      });
      if (error) throw error;
      if (data?.error_type) { setResult({ _urlError: true, _message: data.message } as any); return; }
      setResult(data);
      // Capture learning — fire and forget
      if (data?.industry && user?.id) {
        supabase.functions.invoke("capture-learning", { body: {
          user_id: user.id, event_type: "competitor_analyzed",
          data: { industry: data.industry, hook_score: data.hook_score, hook_type: data.hook_type, your_move: data.your_move, steal_this: data.steal_this }
        }}).catch(() => {});
      }
    } catch { toast.error(lang === "pt" ? "Análise falhou — tente novamente" : "Analysis failed"); }
    finally { setLoading(false); }
  };

  const canAnalyze = tab === "video" ? (transcript.length > 15) : tab === "brand" ? false : (adText.trim().length > 15);

  return (
    <div className="tool-page-wrap" style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Crosshair size={16} color="#22d3ee" />
        </div>
        <div>
          <h1 style={{ ...F, fontSize: 16, fontWeight: 800, color: "#eef0f6", margin: 0, letterSpacing: "-0.02em" }}>{t.title}</h1>
          <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.38)", marginTop: 1 }}>{t.sub}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, width: "fit-content" }}>
        {(["video","text","brand"] as const).map(tp => (
          <button key={tp} onClick={() => { setTab(tp as any); setResult(null); }}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", ...M, fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              background: tab === tp ? "rgba(255,255,255,0.10)" : "transparent",
              color: tab === tp ? "#eef0f6" : "rgba(238,240,246,0.40)" }}>
            {tp === "video" ? t.tab_video : tp === "text" ? t.tab_text : t.tab_brand}
          </button>
        ))}
      </div>

      {/* Brand search tab */}
      {tab === "brand" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...M, display: "block", fontSize: 12, fontWeight: 600, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 6 }}>{t.brand_label}</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={brandQuery}
              onChange={e => setBrandQuery(e.target.value)}
              placeholder={t.brand_placeholder}
              onKeyDown={e => { if (e.key === "Enter" && brandQuery.trim()) window.open(`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(brandQuery.trim())}&search_type=keyword_unordered`, "_blank", "noopener,noreferrer"); }}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 9, padding: "10px 14px", color: "#eef0f6", ...M, fontSize: 13, outline: "none", transition: "border-color 0.15s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />
            <button
              onClick={() => { if (brandQuery.trim()) window.open(`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(brandQuery.trim())}&search_type=keyword_unordered`, "_blank", "noopener,noreferrer"); }}
              disabled={!brandQuery.trim()}
              style={{ padding: "10px 18px", borderRadius: 9, border: "none", cursor: brandQuery.trim() ? "pointer" : "not-allowed", background: brandQuery.trim() ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.04)", color: brandQuery.trim() ? "#c4b5fd" : "rgba(255,255,255,0.2)", ...M, fontSize: 12, fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap" as const }}>
              {t.brand_btn}
            </button>
          </div>
          {/* Quick country filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>
            {[{ code: "BR", flag: "🇧🇷", label: "Brasil" }, { code: "MX", flag: "🇲🇽", label: "México" }, { code: "IN", flag: "🇮🇳", label: "India" }, { code: "US", flag: "🇺🇸", label: "US" }, { code: "ALL", flag: "🌍", label: "Global" }].map(c => (
              <button key={c.code}
                onClick={() => { if (brandQuery.trim()) window.open(`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${c.code === "ALL" ? "ALL" : c.code}&q=${encodeURIComponent(brandQuery.trim())}&search_type=keyword_unordered`, "_blank", "noopener,noreferrer"); }}
                disabled={!brandQuery.trim()}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", cursor: brandQuery.trim() ? "pointer" : "default", ...M, fontSize: 12, color: brandQuery.trim() ? "rgba(238,240,246,0.6)" : "rgba(255,255,255,0.2)", transition: "all 0.15s" }}
                onMouseEnter={e => { if (brandQuery.trim()) { e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)"; e.currentTarget.style.color = "#eef0f6"; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = brandQuery.trim() ? "rgba(238,240,246,0.6)" : "rgba(255,255,255,0.2)"; }}>
                <span>{c.flag}</span> {c.label}
              </button>
            ))}
          </div>
          <div style={{ padding: "11px 14px", borderRadius: 9, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.14)" }}>
            <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.5)", margin: 0, lineHeight: 1.6 }}>
              💡 {t.brand_tip}
            </p>
          </div>
        </div>
      )}

      {/* Video tab */}
      {tab === "video" && (
        <div style={{ marginBottom: 14 }}>
          <input ref={fileInputRef} type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.webm" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {!videoFile ? (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 12, border: `2px dashed ${isDragging ? "rgba(34,211,238,0.50)" : "rgba(255,255,255,0.12)"}`,
                background: isDragging ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)",
                padding: "36px 20px", textAlign: "center" as const, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.20)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Upload size={20} color="#22d3ee" />
              </div>
              <p style={{ ...F, fontSize: 14, fontWeight: 700, color: "rgba(238,240,246,0.70)", margin: "0 0 5px" }}>{t.drop_title}</p>
              <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.30)", margin: 0 }}>{t.drop_sub}</p>
            </div>
          ) : (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: transcribing ? "rgba(14,165,233,0.06)" : transcript ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.04)", border: `1px solid ${transcribing ? "rgba(14,165,233,0.20)" : transcript ? "rgba(52,211,153,0.20)" : "rgba(255,255,255,0.10)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Film size={16} color={transcribing ? "#0ea5e9" : transcript ? "#34d399" : "rgba(238,240,246,0.40)"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...M, fontSize: 13, fontWeight: 600, color: "rgba(238,240,246,0.80)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{videoFile.name}</p>
                  <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.38)", margin: "2px 0 0" }}>
                    {transcribing ? t.transcribing : transcript ? `${t.video_ready} · ${transcript.slice(0, 60)}...` : ""}
                  </p>
                </div>
                {!transcribing && (
                  <button onClick={() => { setVideoFile(null); setTranscript(""); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    style={{ padding: 5, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <X size={13} color="rgba(238,240,246,0.45)" />
                  </button>
                )}
              </div>
              {transcribing && <ThinkingIndicator lang={lang} variant="inline" label={t.transcribing} />}
            </div>
          )}
        </div>
      )}

      {/* Text tab */}
      {tab === "text" && (
        <div style={{ marginBottom: 14 }}>
          <textarea value={adText} onChange={e => setAdText(e.target.value)} placeholder={`${t.text_placeholder}

${t.link_placeholder}`} rows={5}
            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "14px 16px", color: "#eef0f6", ...M, fontSize: 13, resize: "vertical" as const, outline: "none", lineHeight: 1.6, boxSizing: "border-box" as const, minHeight: 130, transition: "border-color 0.15s" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
          />
        </div>
      )}

      {/* Observation */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ ...M, display: "block", fontSize: 12, fontWeight: 600, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 5 }}>{t.obs_label}</label>
        <input value={observation} onChange={e => setObservation(e.target.value)} placeholder={t.obs_placeholder}
          style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "9px 14px", color: "#eef0f6", ...M, fontSize: 13, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.30)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
        />
      </div>

      {/* Button */}
      <button onClick={analyze} disabled={loading || transcribing || !canAnalyze}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10,
          background: loading ? "rgba(34,211,238,0.08)" : canAnalyze ? "#22d3ee" : "rgba(34,211,238,0.06)",
          border: "none", cursor: canAnalyze && !loading && !transcribing ? "pointer" : "not-allowed",
          ...F, fontSize: 14, fontWeight: 800, color: loading ? "#22d3ee" : canAnalyze ? "#000" : "rgba(34,211,238,0.25)",
          marginBottom: 24, transition: "all 0.15s" }}>
        {loading ? <ThinkingIndicator lang={lang} variant="inline" label={t.analyzing} /> : <><Zap size={15} /> {t.btn}</>}
      </button>

      {loading && <ThinkingIndicator lang={lang} variant="tool" label={lang === "pt" ? "Analisando como CS sênior" : lang === "es" ? "Analizando como CS senior" : "Analyzing as senior CS"} />}

      {/* Result */}
      {result && (
        <div>
          {(result as any)._urlError ? (
            <div style={{ padding: "18px", borderRadius: 12, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)" }}>
              <p style={{ ...M, fontSize: 13, color: "rgba(238,240,246,0.75)", lineHeight: 1.7, margin: "0 0 14px" }}>{(result as any)._message}</p>
              <button onClick={() => { setTab("text"); setAdText(tab === "video" ? "" : adText); setResult(null); }}
                style={{ ...M, fontSize: 12, fontWeight: 600, color: "#38bdf8", background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.22)", padding: "7px 14px", borderRadius: 7, cursor: "pointer" }}>
                {lang === "pt" ? "Cole o texto manualmente" : lang === "es" ? "Pega el texto manualmente" : "Paste text manually"}
              </button>
            </div>
          ) : (
            <div>
              {result.mismatch_detected && result.mismatch_reason && (
                <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 9, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.20)", marginBottom: 18 }}>
                  <AlertCircle size={13} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ ...M, fontSize: 12, color: "rgba(251,191,36,0.80)", lineHeight: 1.5, margin: 0 }}>{result.mismatch_reason}</p>
                </div>
              )}
              {/* Meta */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <span style={{ ...M, fontSize: 12, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, display: "block", marginBottom: 3 }}>{t.industry}</span>
                  <span style={{ ...F, fontSize: 13, fontWeight: 700, color: "#eef0f6" }}>{result.industry}</span>
                  {result.market && <span style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.38)", marginLeft: 8 }}>{result.market}</span>}
                </div>
                <div style={{ textAlign: "right" as const, minWidth: 160 }}>
                  <span style={{ ...M, fontSize: 12, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, display: "block", marginBottom: 3 }}>{t.hook}</span>
                  <ScoreBar score={result.hook_score} />
                  {result.hook_score_label && <span style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.38)" }}>{result.hook_score_label}</span>}
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }} />
              <Section label={t.diagnosis_label} content={result.diagnosis} onCopy={() => cp("diag", result.diagnosis)} copied={copied["diag"]} />
              <Section label={t.why_label} content={result.why_it_works_or_fails} onCopy={() => cp("why", result.why_it_works_or_fails)} copied={copied["why"]} />
              <Section label={t.move_label} content={result.your_move} onCopy={() => cp("move", result.your_move)} copied={copied["move"]} />
              <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Target size={12} color="#22d3ee" />
                    <span style={{ ...M, fontSize: 12, fontWeight: 700, color: "rgba(34,211,238,0.55)", letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{t.steal_label}</span>
                  </div>
                  <button onClick={() => cp("steal", result.steal_this)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)", cursor: "pointer", ...M, fontSize: 12, color: "#22d3ee" }}>
                    {copied["steal"] ? <><Check size={9}/> {t.copied}</> : <><Copy size={9}/> {t.copy}</>}
                  </button>
                </div>
                <p style={{ ...M, fontSize: 13.5, color: "rgba(238,240,246,0.82)", lineHeight: 1.75, margin: 0 }}>{result.steal_this}</p>
              </div>
              {result.hooks?.length > 0 && (
                <div>
                  <span style={{ ...M, fontSize: 12, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.12em", textTransform: "uppercase" as const, display: "block", marginBottom: 10 }}>{t.hooks_label}</span>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    {result.hooks.map((hook, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ ...M, fontSize: 12, fontWeight: 800, color: "rgba(238,240,246,0.20)", flexShrink: 0, marginTop: 3, minWidth: 14 }}>#{i + 1}</span>
                        <p style={{ ...M, fontSize: 13, color: "rgba(238,240,246,0.85)", lineHeight: 1.55, margin: 0, flex: 1 }}>{hook}</p>
                        <button onClick={() => cp(`h${i}`, hook)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", ...M, fontSize: 12, color: "rgba(238,240,246,0.45)", flexShrink: 0 }}>
                          {copied[`h${i}`] ? <><Check size={9}/> {t.copied}</> : <><Copy size={9}/> {t.copy}</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !result && (
        <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)", padding: "40px 20px", textAlign: "center" as const }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>🎯</div>
          <p style={{ ...F, fontSize: 14, fontWeight: 700, color: "rgba(238,240,246,0.35)", margin: "0 0 5px" }}>{t.empty}</p>
          <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.18)", margin: 0 }}>{t.empty_sub}</p>
        </div>
      )}
    </div>
  );
}
