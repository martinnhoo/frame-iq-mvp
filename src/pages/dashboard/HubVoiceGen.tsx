/**
 * HubVoiceGen — Gerador de voz via ElevenLabs.
 *
 * Layout 2-coluna SaaS (idêntico aos outros tools do Hub):
 *   LEFT: textarea + voz + modelo + sliders + CTA
 *   RIGHT: player de áudio + download/variação + últimas gerações
 *
 * Pipeline:
 *   1. User digita texto, escolhe voz + modelo + ajustes
 *   2. POST pra hub-voice-gen edge function (ElevenLabs API)
 *   3. Recebe data URL do mp3, mostra no player
 *   4. Salva em hub_assets (kind='hub_voice') pra Biblioteca
 *
 * i18n total nas 4 línguas (pt/en/es/zh).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Mic, Sparkles, ArrowLeft, Download, RefreshCw, AlertTriangle,
  Play, Pause, Volume2, ChevronDown, Settings2,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";
import { saveHubAsset } from "@/lib/saveHubAsset";
import type { Lang } from "@/data/hubBrands";

// ── Vozes ElevenLabs (top picks pra ad/marketing) ─────────────
// IDs estáveis e públicos — válidos em qualquer conta ElevenLabs.
// Descrições reflitem o tom típico de cada voice.
interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female";
  desc: Record<Lang, string>;
}

const VOICES: VoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  gender: "female", desc: { pt: "Calma, jovem, narração",  en: "Calm, young, narration",  es: "Calma, joven, narración",  zh: "平静、年轻、叙述" } },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",    gender: "female", desc: { pt: "Forte, jovem, energética",en: "Strong, young, energetic",es: "Fuerte, joven, enérgica",  zh: "强势、年轻、有活力" } },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella",   gender: "female", desc: { pt: "Suave, jovem, doce",      en: "Soft, young, sweet",      es: "Suave, joven, dulce",      zh: "柔和、年轻、甜美" } },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    gender: "female", desc: { pt: "Emocional, jovem",        en: "Emotional, young",        es: "Emocional, joven",         zh: "情感丰富、年轻" } },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  gender: "male",   desc: { pt: "Bem articulado, narração",en: "Well-rounded, narration", es: "Bien articulado, narración",zh: "表达清晰、叙述" } },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    gender: "male",   desc: { pt: "Profundo, jovem",         en: "Deep, young",             es: "Profundo, joven",          zh: "低沉、年轻" } },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  gender: "male",   desc: { pt: "Crisp, meia-idade",       en: "Crisp, middle-aged",      es: "Nítido, mediana edad",     zh: "清晰、中年" } },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    gender: "male",   desc: { pt: "Profundo, narração",      en: "Deep, narration",         es: "Profundo, narración",      zh: "低沉、叙述" } },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",     gender: "male",   desc: { pt: "Rouco, jovem",            en: "Raspy, young",            es: "Ronco, joven",             zh: "沙哑、年轻" } },
];

const MODELS = [
  { id: "eleven_multilingual_v2", labelKey: "modelMultiV2"   as const, descKey: "modelMultiV2Desc"   as const },
  { id: "eleven_turbo_v2_5",      labelKey: "modelTurboV25"  as const, descKey: "modelTurboV25Desc"  as const },
];

// ── Strings i18n ──────────────────────────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",           en: "Back to Hub",            es: "Volver al Hub",            zh: "返回中心" },
  title:          { pt: "Gerador de Voz",          en: "Voice Generator",        es: "Generador de Voz",         zh: "语音生成器" },
  subtitle:       { pt: "Texto vira áudio profissional via ElevenLabs.",
                   en: "Turn text into professional audio with ElevenLabs.",
                   es: "Convierte texto en audio profesional con ElevenLabs.",
                   zh: "通过 ElevenLabs 将文本转换为专业音频。" },
  // Section 1: Text
  textTitle:      { pt: "Texto",                   en: "Text",                   es: "Texto",                    zh: "文本" },
  textHint:       { pt: "Digite o roteiro que será convertido em voz.",
                   en: "Type the script that will be converted to voice.",
                   es: "Escribe el guión que será convertido en voz.",
                   zh: "输入将转换为语音的脚本。" },
  textPlaceholder:{ pt: "Ex: Cada jogada conta. Aposta agora e leva 100% de bônus na sua primeira recarga.",
                   en: "Ex: Every play counts. Bet now and get a 100% bonus on your first deposit.",
                   es: "Ej: Cada jugada cuenta. Apuesta ahora y llévate un 100% de bono en tu primera recarga.",
                   zh: "例：每一次游戏都很重要。现在下注，首次充值即可获得 100% 奖金。" },
  // Section 2: Voice
  voiceTitle:     { pt: "Voz",                     en: "Voice",                  es: "Voz",                      zh: "声音" },
  voiceHint:      { pt: "Escolha o personagem que vai narrar.",
                   en: "Pick who will narrate.",
                   es: "Elige el personaje que narrará.",
                   zh: "选择叙述者。" },
  // Section 3: Model
  modelTitle:     { pt: "Modelo",                  en: "Model",                  es: "Modelo",                   zh: "模型" },
  modelHint:      { pt: "Multilingual v2 = melhor qualidade. Turbo = mais rápido.",
                   en: "Multilingual v2 = best quality. Turbo = faster.",
                   es: "Multilingual v2 = mejor calidad. Turbo = más rápido.",
                   zh: "Multilingual v2 = 最佳质量。Turbo = 更快。" },
  modelMultiV2:   { pt: "Multilingual v2",         en: "Multilingual v2",        es: "Multilingual v2",          zh: "Multilingual v2" },
  modelMultiV2Desc:{pt: "Melhor qualidade · 29 idiomas",
                   en: "Best quality · 29 languages",
                   es: "Mejor calidad · 29 idiomas",
                   zh: "最佳质量 · 29 种语言" },
  modelTurboV25:  { pt: "Turbo v2.5",              en: "Turbo v2.5",             es: "Turbo v2.5",               zh: "Turbo v2.5" },
  modelTurboV25Desc:{pt:"Mais rápido · ~2x velocidade",
                   en: "Faster · ~2x speed",
                   es: "Más rápido · ~2x velocidad",
                   zh: "更快 · ~2 倍速度" },
  // Section 4: Settings (advanced)
  advancedTitle:  { pt: "Ajustes avançados",       en: "Advanced settings",      es: "Ajustes avanzados",        zh: "高级设置" },
  stability:      { pt: "Estabilidade",            en: "Stability",              es: "Estabilidad",              zh: "稳定性" },
  stabilityHint:  { pt: "Baixa = mais expressiva · Alta = mais consistente",
                   en: "Low = more expressive · High = more consistent",
                   es: "Baja = más expresiva · Alta = más consistente",
                   zh: "低 = 更有表现力 · 高 = 更一致" },
  similarity:     { pt: "Semelhança com a voz",    en: "Voice similarity",       es: "Similitud con la voz",     zh: "声音相似度" },
  similarityHint: { pt: "Alta = imita melhor a voz original",
                   en: "High = mimics original voice better",
                   es: "Alta = imita mejor la voz original",
                   zh: "高 = 更好地模仿原始声音" },
  // CTA
  generate:       { pt: "Gerar voz",               en: "Generate voice",         es: "Generar voz",              zh: "生成语音" },
  generating:     { pt: "Gerando…",                en: "Generating…",            es: "Generando…",               zh: "生成中…" },
  autoSaved:      { pt: "Sua geração será salva automaticamente na Biblioteca.",
                   en: "Your generation will be auto-saved to the Library.",
                   es: "Tu generación se guardará automáticamente en la Biblioteca.",
                   zh: "您的生成将自动保存到资源库。" },
  // Right column
  preview:        { pt: "Prévia",                  en: "Preview",                es: "Vista previa",             zh: "预览" },
  previewHint:    { pt: "Seu áudio gerado aparecerá aqui.",
                   en: "Your generated audio will appear here.",
                   es: "Tu audio generado aparecerá aquí.",
                   zh: "您生成的音频将显示在此处。" },
  emptyTitle:     { pt: "Sua voz aparecerá aqui",  en: "Your voice will appear here",es: "Tu voz aparecerá aquí",zh: "您的声音将在此处显示" },
  emptyDesc:      { pt: "Escreva o texto, escolha a voz e clique em Gerar voz.",
                   en: "Write the text, pick a voice and click Generate voice.",
                   es: "Escribe el texto, elige la voz y haz clic en Generar voz.",
                   zh: "编写文本，选择声音，然后点击生成语音。" },
  download:       { pt: "Baixar",                  en: "Download",               es: "Descargar",                zh: "下载" },
  variation:      { pt: "Gerar variação",          en: "Generate variation",     es: "Generar variación",        zh: "生成变体" },
  recent:         { pt: "Últimas gerações",        en: "Latest generations",     es: "Últimas generaciones",     zh: "最近生成" },
  recentHint:     { pt: "Seus últimos áudios gerados.",
                   en: "Your last generated audios.",
                   es: "Tus últimos audios generados.",
                   zh: "您最近生成的音频。" },
  seeAll:         { pt: "Ver todos",               en: "See all",                es: "Ver todos",                zh: "查看全部" },
  // Errors
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
  // Counter
  characters:     { pt: "caracteres",              en: "characters",             es: "caracteres",               zh: "字符" },
};

const TEXT_MAX = 5000;

interface GenResult {
  audio_url: string;
  text: string;
  voice_id: string;
  voice_name: string;
  model_id: string;
  characters: number;
}

interface VoiceItem {
  id: string;
  audio_url: string;
  text: string;
  voice_name: string;
  voice_id: string;
  characters: number;
  created_at: string;
}

export default function HubVoiceGen() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;

  // ── Form state ────────────────────────────────────────────
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICES[0].id);
  const [modelId, setModelId] = useState<string>(MODELS[0].id);
  const [stability, setStability] = useState(0.50);
  const [similarity, setSimilarity] = useState(0.75);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Async state ───────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenResult | null>(null);
  const [history, setHistory] = useState<VoiceItem[]>([]);

  // ── Player state ──────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const selectedVoice = useMemo(() => VOICES.find(v => v.id === voiceId) || VOICES[0], [voiceId]);
  const textValid = text.trim().length >= 5;

  // Carrega últimas gerações
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("hub_assets" as never)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("kind", "hub_voice")
          .order("created_at", { ascending: false })
          .limit(8);
        if (!mounted || !data) return;
        const items: VoiceItem[] = (data as Array<{
          id: string;
          content?: { audio_url?: string; text?: string; voice_id?: string; voice_name?: string; characters?: number };
          created_at: string;
        }>)
          .filter(r => r?.content?.audio_url)
          .map(r => ({
            id: r.id,
            audio_url: r.content!.audio_url!,
            text: r.content!.text || "",
            voice_name: r.content!.voice_name || "—",
            voice_id: r.content!.voice_id || "",
            characters: r.content!.characters || 0,
            created_at: r.created_at,
          }));
        setHistory(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  const generate = async () => {
    if (loading || !textValid) return;
    setError(null);
    setLoading(true);
    setResult(null);
    setPlaying(false);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data: { user } } = await supabase.auth.getUser();
      if (!token || !user) { setError(t("sessionExpired")); setLoading(false); return; }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-voice-gen`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
        },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: voiceId,
          model_id: modelId,
          stability,
          similarity_boost: similarity,
        }),
      });
      const txt = await r.text();
      let payload: { ok?: boolean; audio_url?: string; characters?: number; error?: string; message?: string } | null = null;
      try { payload = JSON.parse(txt); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        const detail = payload?.message || payload?.error || `HTTP ${r.status}`;
        setError(detail.slice(0, 400));
        setLoading(false);
        return;
      }

      const newResult: GenResult = {
        audio_url: payload.audio_url!,
        text: text.trim(),
        voice_id: voiceId,
        voice_name: selectedVoice.name,
        model_id: modelId,
        characters: payload.characters || text.length,
      };
      setResult(newResult);

      // Save to hub_assets
      try {
        await saveHubAsset({
          userId: user.id,
          type: "hub_voice",
          content: {
            audio_url: newResult.audio_url,
            text: newResult.text,
            voice_id: voiceId,
            voice_name: selectedVoice.name,
            model_id: modelId,
            stability,
            similarity_boost: similarity,
            characters: newResult.characters,
          },
        });
      } catch (e) { console.warn("[hub-voice-gen] save failed:", e); }

      // Optimistic add to history
      setHistory(prev => [{
        id: `tmp-${Date.now()}`,
        audio_url: newResult.audio_url,
        text: newResult.text,
        voice_name: selectedVoice.name,
        voice_id: voiceId,
        characters: newResult.characters,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 8));

      // Notif
      try {
        const titleByLang: Record<Lang, string> = {
          pt: "Voz gerada", en: "Voice generated", es: "Voz generada", zh: "语音已生成",
        };
        addHubNotification(user.id, {
          kind: "image_generated",
          title: titleByLang[lang],
          description: `${selectedVoice.name} · ${newResult.characters} ${t("characters")}`,
          href: "/dashboard/hub/voice",
        });
      } catch { /* silent */ }
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  };

  const downloadAudio = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <>
      <Helmet><title>{t("title")}</title></Helmet>

      <div style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 28px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 22, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          <button onClick={() => navigate("/dashboard/hub")} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#D1D5DB", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            fontFamily: "inherit", flexShrink: 0,
          }}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>

        {/* 2-col workspace */}
        <div className="hub-voice-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT — form */}
          <div style={CARD_STYLE}>
            {/* Text */}
            <Section title={t("textTitle")} subtitle={t("textHint")}>
              <div style={{ position: "relative" }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, TEXT_MAX))}
                  placeholder={t("textPlaceholder")}
                  rows={6}
                  disabled={loading}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "12px 14px", borderRadius: 11,
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#F1F5F9", fontSize: 13.5, lineHeight: 1.6,
                    resize: "vertical", outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.10)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div style={{
                  position: "absolute", right: 10, bottom: 8,
                  fontSize: 10.5, color: "#6B7280", pointerEvents: "none", fontWeight: 600,
                }}>
                  {text.length} / {TEXT_MAX}
                </div>
              </div>
            </Section>

            {/* Voice */}
            <Section title={t("voiceTitle")} subtitle={t("voiceHint")} style={{ marginTop: 22 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 8,
              }}>
                {VOICES.map(v => {
                  const active = voiceId === v.id;
                  return (
                    <button key={v.id} onClick={() => setVoiceId(v.id)} disabled={loading}
                      style={{
                        padding: "10px 12px", borderRadius: 10,
                        minWidth: 0, overflow: "hidden",
                        background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#fff" : "#D1D5DB",
                        cursor: loading ? "not-allowed" : "pointer",
                        textAlign: "left", fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 700,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{v.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          color: v.gender === "female" ? "#f472b6" : "#60a5fa",
                          textTransform: "uppercase", flexShrink: 0,
                        }}>{v.gender === "female" ? "F" : "M"}</span>
                      </div>
                      <div style={{
                        fontSize: 10.5, color: "#9CA3AF",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {v.desc[lang]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Model */}
            <Section title={t("modelTitle")} subtitle={t("modelHint")} style={{ marginTop: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {MODELS.map(m => {
                  const active = modelId === m.id;
                  return (
                    <button key={m.id} onClick={() => setModelId(m.id)} disabled={loading}
                      style={{
                        padding: "11px 12px", borderRadius: 10,
                        minWidth: 0, overflow: "hidden",
                        background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#fff" : "#D1D5DB",
                        cursor: loading ? "not-allowed" : "pointer",
                        textAlign: "left", fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{t(m.labelKey)}</div>
                      <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>{t(m.descKey)}</div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Advanced settings */}
            <div style={{ marginTop: 22 }}>
              <button onClick={() => setAdvancedOpen(v => !v)} disabled={loading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "transparent", border: "none",
                  color: "#9CA3AF", fontSize: 12, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", padding: 0,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>
                <Settings2 size={12} /> {t("advancedTitle")}
                <ChevronDown size={12} style={{
                  transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }} />
              </button>
              {advancedOpen && (
                <div style={{
                  marginTop: 10, padding: 14, borderRadius: 11,
                  background: "rgba(0,0,0,0.20)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", flexDirection: "column", gap: 14,
                }}>
                  <SliderField
                    label={t("stability")} hint={t("stabilityHint")}
                    value={stability} onChange={setStability}
                    disabled={loading}
                  />
                  <SliderField
                    label={t("similarity")} hint={t("similarityHint")}
                    value={similarity} onChange={setSimilarity}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={loading || !textValid}
              className="hub-cta"
              style={{
                marginTop: 22, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: loading || !textValid ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: loading || !textValid ? "rgba(255,255,255,0.50)" : "#fff",
                border: "none", cursor: loading || !textValid ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
                transition: "background 0.15s, transform 0.08s",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{t("generate")}</>
              )}
            </button>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "10px 0 0", textAlign: "center" }}>
              {t("autoSaved")}
            </p>
          </div>

          {/* RIGHT — preview + history */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={CARD_STYLE}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{t("preview")}</h3>
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{t("previewHint")}</p>
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "10px 12px", borderRadius: 9,
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                }}>
                  <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 11.5, color: "#fee2e2", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</p>
                </div>
              )}

              {result && (
                <div>
                  <div style={{
                    background: "rgba(0,0,0,0.30)",
                    border: "1px solid rgba(59,130,246,0.30)",
                    borderRadius: 12, padding: 16, marginBottom: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={togglePlay} className="hub-voice-play"
                        style={{
                          width: 46, height: 46, borderRadius: "50%",
                          background: "#3B82F6", border: "none",
                          color: "#fff", cursor: "pointer", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                        {playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <Volume2 size={13} style={{ color: "#3B82F6", flexShrink: 0 }} />
                          {result.voice_name}
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF", marginLeft: 4 }}>
                            · {result.characters} {t("characters")}
                          </span>
                        </p>
                        <audio ref={audioRef} src={result.audio_url}
                          onPlay={() => setPlaying(true)}
                          onPause={() => setPlaying(false)}
                          onEnded={() => setPlaying(false)}
                          controls
                          style={{
                            width: "100%", marginTop: 8, height: 32,
                            colorScheme: "dark",
                          }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => downloadAudio(result.audio_url, `voice-${result.voice_name.toLowerCase()}-${Date.now()}.mp3`)} style={ACTION_BTN}>
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                  </div>
                </div>
              )}

              {!result && !error && !loading && (
                <div style={{
                  border: "1px dashed rgba(255,255,255,0.10)",
                  borderRadius: 12, minHeight: 280,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 32, textAlign: "center", gap: 14,
                  background: "rgba(0,0,0,0.20)",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 13,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid rgba(59,130,246,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Mic size={22} style={{ color: "#3B82F6" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                    <p style={{ fontSize: 12, color: "#D1D5DB", margin: "5px 0 0", lineHeight: 1.5, maxWidth: 320 }}>
                      {t("emptyDesc")}
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{
                  border: "1px solid rgba(59,130,246,0.20)",
                  borderRadius: 12, minHeight: 280,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 32, gap: 12,
                  background: "rgba(0,0,0,0.20)",
                }}>
                  <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: 0 }}>{t("generating")}</p>
                </div>
              )}
            </div>

            {/* Recent history */}
            {history.length > 0 && (
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{t("recent")}</h3>
                    <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0" }}>{t("recentHint")}</p>
                  </div>
                  <button onClick={() => navigate("/dashboard/hub/library")}
                    style={{
                      background: "transparent", border: "none", color: "#3B82F6",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {t("seeAll")} →
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {history.slice(0, 4).map(item => (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "rgba(59,130,246,0.10)",
                        border: "1px solid rgba(59,130,246,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Volume2 size={14} style={{ color: "#3B82F6" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 12.5, fontWeight: 700, color: "#fff", margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{item.voice_name} · {item.characters} {t("characters")}</p>
                        <p style={{
                          fontSize: 11, color: "#9CA3AF", margin: "2px 0 0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{item.text}</p>
                      </div>
                      <button onClick={() => downloadAudio(item.audio_url, `voice-${item.voice_name.toLowerCase()}-${item.id.slice(0, 8)}.mp3`)}
                        style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "#D1D5DB", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }} title={t("download")}>
                        <Download size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .hub-cta:hover:not(:disabled) { background: #2563EB !important; }
          .hub-cta:active:not(:disabled) { background: #1D4ED8 !important; transform: scale(0.97); }
          .hub-voice-play:hover { background: #2563EB !important; }
          @media (max-width: 1100px) {
            .hub-voice-workspace { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ title, subtitle, children, style }: {
  title: string; subtitle?: string;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function SliderField({ label, hint, value, onChange, disabled }: {
  label: string; hint: string;
  value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", margin: 0 }}>{label}</p>
        <span style={{ fontSize: 11.5, color: "#3B82F6", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          width: "100%",
          accentColor: "#3B82F6",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <p style={{ fontSize: 10.5, color: "#9CA3AF", margin: "4px 0 0", lineHeight: 1.4 }}>{hint}</p>
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 18,
};

const ACTION_BTN: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
};
