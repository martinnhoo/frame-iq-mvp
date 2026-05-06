/**
 * HubTranscribe — transcreve áudio/vídeo pra texto + tradução opcional.
 *
 * Layout 2-coluna estilo novo Hub (azul Adbrief, sem roxo):
 *   LEFT: drag-drop / file picker, target language selector, status, botão
 *   RIGHT: textarea com transcrição (+ aba traduzido se aplicável)
 *
 * Pipeline:
 *   1. User sobe arquivo (mp4/mp3/wav/webm/m4a) e opcionalmente escolhe
 *      idioma alvo de tradução
 *   2. Se vídeo > MAX_WHISPER_SIZE, extrai áudio no browser via
 *      audioExtractor.ts (lib já existe, usado pelo TranslatePage)
 *   3. POST FormData pra hub-transcribe edge function (Whisper direto +
 *      Claude Haiku pra tradução opcional)
 *   4. Recebe { transcript, language, duration, translated_text? } e
 *      mostra ambos quando há tradução
 *   5. Salva em hub_assets (kind='hub_transcribe') pra Biblioteca
 *
 * i18n total nas 4 línguas (pt/en/es/zh).
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Mic, Upload, Copy, Check, Download, ArrowLeft, Sparkles, AlertTriangle,
  RefreshCw, FileAudio, X, Languages,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { addHubNotification } from "@/lib/hubNotifications";
import { saveHubAsset } from "@/lib/saveHubAsset";
import { extractAudioFromFile, needsExtraction } from "@/lib/audioExtractor";
import type { Lang } from "@/data/hubBrands";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",        en: "Back to Hub",          es: "Volver al Hub",         zh: "返回中心" },
  title:          { pt: "Transcrição",          en: "Transcription",        es: "Transcripción",         zh: "转录" },
  subtitle:       { pt: "Transcreva áudio ou vídeo pra texto via Whisper.",
                   en: "Transcribe audio or video to text via Whisper.",
                   es: "Transcribe audio o video a texto vía Whisper.",
                   zh: "通过 Whisper 将音频或视频转录为文本。" },
  uploadCta:      { pt: "Solta o arquivo aqui ou clica pra selecionar",
                   en: "Drop file here or click to select",
                   es: "Suelta el archivo aquí o haz clic para seleccionar",
                   zh: "拖放文件或点击选择" },
  uploadHint:     { pt: "MP4, MP3, WAV, WEBM, M4A · até 100MB",
                   en: "MP4, MP3, WAV, WEBM, M4A · up to 100MB",
                   es: "MP4, MP3, WAV, WEBM, M4A · hasta 100MB",
                   zh: "MP4、MP3、WAV、WEBM、M4A · 最大 100MB" },
  fileLabel:      { pt: "Arquivo selecionado",  en: "Selected file",        es: "Archivo seleccionado",  zh: "已选择文件" },
  remove:         { pt: "Remover",              en: "Remove",               es: "Eliminar",              zh: "移除" },
  transcribe:     { pt: "Transcrever",          en: "Transcribe",           es: "Transcribir",           zh: "转录" },
  extracting:     { pt: "Extraindo áudio…",     en: "Extracting audio…",    es: "Extrayendo audio…",     zh: "提取音频中…" },
  uploading:      { pt: "Enviando…",            en: "Uploading…",           es: "Subiendo…",             zh: "上传中…" },
  transcribing:   { pt: "Transcrevendo via Whisper…",
                   en: "Transcribing via Whisper…",
                   es: "Transcribiendo vía Whisper…",
                   zh: "通过 Whisper 转录中…" },
  copy:           { pt: "Copiar",               en: "Copy",                 es: "Copiar",                zh: "复制" },
  copied:         { pt: "Copiado",              en: "Copied",               es: "Copiado",               zh: "已复制" },
  download:       { pt: "Baixar .txt",          en: "Download .txt",        es: "Descargar .txt",        zh: "下载 .txt" },
  clear:          { pt: "Limpar",               en: "Clear",                es: "Limpiar",               zh: "清除" },
  emptyTitle:     { pt: "Sua transcrição aparecerá aqui",
                   en: "Your transcription will appear here",
                   es: "Tu transcripción aparecerá aquí",
                   zh: "您的转录将在此处显示" },
  emptyDesc:      { pt: "Sobe um arquivo de áudio ou vídeo e clica em Transcrever.",
                   en: "Upload an audio or video file and click Transcribe.",
                   es: "Sube un archivo de audio o video y haz clic en Transcribir.",
                   zh: "上传音频或视频文件并点击转录。" },
  notif:          { pt: "Transcrição pronta",   en: "Transcription ready",  es: "Transcripción lista",   zh: "转录已就绪" },
  charCount:      { pt: "caracteres",           en: "characters",           es: "caracteres",            zh: "字符" },
  fileTooBig:     { pt: "Arquivo muito grande (max 100MB).",
                   en: "File too large (max 100MB).",
                   es: "Archivo demasiado grande (máx 100MB).",
                   zh: "文件过大（最大 100MB）。" },
  invalidType:    { pt: "Formato inválido. Use MP4, MP3, WAV, WEBM ou M4A.",
                   en: "Invalid format. Use MP4, MP3, WAV, WEBM or M4A.",
                   es: "Formato inválido. Usa MP4, MP3, WAV, WEBM o M4A.",
                   zh: "格式无效。请使用 MP4、MP3、WAV、WEBM 或 M4A。" },
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
  // Tradução
  translateTo:    { pt: "Traduzir para",       en: "Translate to",         es: "Traducir a",            zh: "翻译为" },
  translateOff:   { pt: "Sem tradução",        en: "No translation",       es: "Sin traducción",        zh: "不翻译" },
  translateHint:  { pt: "Whisper detecta o idioma; Claude traduz se você escolher um destino.",
                   en: "Whisper detects the language; Claude translates if you pick a target.",
                   es: "Whisper detecta el idioma; Claude traduce si eliges un destino.",
                   zh: "Whisper 检测语言；如果选择目标语言，Claude 会翻译。" },
  tabOriginal:    { pt: "Original",            en: "Original",             es: "Original",              zh: "原文" },
  tabTranslated:  { pt: "Tradução",            en: "Translation",          es: "Traducción",            zh: "翻译" },
  detectedLang:   { pt: "Idioma detectado",    en: "Detected language",    es: "Idioma detectado",      zh: "检测到的语言" },
  translating:    { pt: "Traduzindo…",         en: "Translating…",         es: "Traduciendo…",          zh: "翻译中…" },
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPT = "audio/*,video/*";

// Idiomas oferecidos pra tradução. Códigos ISO + label visual nas 4 línguas
// da UI. Hinglish (hi) é caso especial: usa Latin script (não Devanagari).
const TARGET_LANGS: Array<{ code: string; flag: string; label: Record<Lang, string> }> = [
  { code: "pt", flag: "🇧🇷", label: { pt: "Português (BR)", en: "Portuguese (BR)", es: "Portugués (BR)", zh: "葡萄牙语 (巴西)" } },
  { code: "en", flag: "🇺🇸", label: { pt: "Inglês",         en: "English",        es: "Inglés",         zh: "英语" } },
  { code: "es", flag: "🇲🇽", label: { pt: "Espanhol",       en: "Spanish",        es: "Español",        zh: "西班牙语" } },
  { code: "zh", flag: "🇨🇳", label: { pt: "Mandarim",       en: "Mandarin",       es: "Mandarín",       zh: "中文" } },
  { code: "hi", flag: "🇮🇳", label: { pt: "Hinglish",       en: "Hinglish",       es: "Hinglish",       zh: "印地英语" } },
  { code: "fr", flag: "🇫🇷", label: { pt: "Francês",        en: "French",         es: "Francés",        zh: "法语" } },
  { code: "de", flag: "🇩🇪", label: { pt: "Alemão",         en: "German",         es: "Alemán",         zh: "德语" } },
  { code: "ar", flag: "🇸🇦", label: { pt: "Árabe",          en: "Arabic",         es: "Árabe",          zh: "阿拉伯语" } },
];

type Step = "idle" | "extracting" | "uploading" | "transcribing" | "translating" | "done" | "error";
type ResultTab = "original" | "translated";

export default function HubTranscribe() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [translated, setTranslated] = useState<string>("");
  const [detectedLang, setDetectedLang] = useState<string>("");
  const [targetLang, setTargetLang] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ResultTab>("original");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loading =
    step === "extracting" || step === "uploading" || step === "transcribing" || step === "translating";

  const handleFile = (f: File) => {
    setError(null);
    if (f.size > MAX_FILE_SIZE) { setError(t("fileTooBig")); return; }
    if (!/(audio|video)/i.test(f.type)) { setError(t("invalidType")); return; }
    setFile(f);
    setTranscript("");
    setTranslated("");
    setDetectedLang("");
    setActiveTab("original");
    setStep("idle");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const transcribe = async () => {
    if (!file || loading) return;
    setError(null);
    setTranscript("");
    setTranslated("");
    setDetectedLang("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token || !user) { setError(t("sessionExpired")); return; }

      // 1. Extrair áudio se vídeo grande (Whisper aceita até ~25MB pós-extração)
      let toSend: File = file;
      if (needsExtraction(file)) {
        setStep("extracting");
        setProgress(0);
        try {
          toSend = await extractAudioFromFile(file, p => setProgress(Math.round(p.percent)));
        } catch (e) {
          console.error("extract failed:", e);
          setError(String(e).slice(0, 200));
          setStep("error");
          return;
        }
      }

      // 2. POST pra hub-transcribe (Whisper + tradução opcional via
      // gpt-4o-mini). Função dedicada — exige deploy manual no Lovable
      // chat na primeira vez.
      setStep("uploading");
      setProgress(0);
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const fd = new FormData();
      fd.append("audio_file", toSend);
      if (targetLang) fd.append("target_language", targetLang);

      setStep("transcribing");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-transcribe`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": ANON_KEY,
        },
        body: fd,
      });
      const text = await r.text();
      let payload: {
        transcript?: string;
        language?: string;
        duration?: number;
        translated_text?: string | null;
        translation_target?: string | null;
        error?: string;
        message?: string;
      } | null = null;
      try { payload = JSON.parse(text); } catch {}

      if (!r.ok || payload?.error) {
        setError((payload?.message || payload?.error || `HTTP ${r.status}`).slice(0, 400));
        setStep("error");
        return;
      }

      const result = payload?.transcript || "";
      if (!result) { setError("Nenhuma transcrição retornada."); setStep("error"); return; }

      setTranscript(result);
      setDetectedLang(payload?.language || "");
      const translatedResult = payload?.translated_text || "";
      if (translatedResult) {
        setTranslated(translatedResult);
        setActiveTab("translated");
      } else {
        setActiveTab("original");
      }
      setStep("done");

      // 3. Salva em hub_assets
      try {
        await saveHubAsset({
          userId: user.id,
          type: "hub_transcribe",
          content: {
            transcript: result,
            translated_text: translatedResult || null,
            translation_target: payload?.translation_target || null,
            language: payload?.language || null,
            source_filename: file.name,
            file_size: file.size,
            file_type: file.type,
            duration: payload?.duration || null,
            char_count: result.length,
          },
        });
      } catch (e) { console.warn("[transcribe] save failed:", e); }

      // 4. Notif
      try {
        addHubNotification(user.id, {
          kind: "image_generated",
          title: t("notif"),
          description: file.name + " · " + result.length + " " + t("charCount"),
          href: "/dashboard/hub/transcribe",
        });
      } catch {}
    } catch (e) {
      setError(String(e).slice(0, 300));
      setStep("error");
    }
  };

  const activeText = activeTab === "translated" && translated ? translated : transcript;

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const downloadTranscript = () => {
    const blob = new Blob([activeText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (file?.name || "transcript").replace(/\.[^.]+$/, "");
    const suffix = activeTab === "translated" && translated ? `.${targetLang}` : "";
    a.download = `${base}${suffix}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setFile(null); setTranscript(""); setTranslated(""); setDetectedLang("");
    setActiveTab("original"); setStep("idle"); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>
      <div style={{ minHeight: "calc(100vh - 0px)", padding: "20px 28px 64px", maxWidth: 1480, margin: "0 auto", color: "#fff" }}>
        <button onClick={() => navigate("/dashboard/hub")} style={{
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
            <Mic size={20} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 12, color: "#D1D5DB", margin: "2px 0 0" }}>{t("subtitle")}</p>
          </div>
        </div>

        <div className="hub-trans-workspace" style={{
          display: "grid", gridTemplateColumns: "minmax(0, 460px) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT — upload */}
          <div style={{
            background: "rgba(17,24,39,0.70)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: 16,
          }}>
            {!file ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragOver ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.12)"}`,
                  background: dragOver ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.20)",
                  borderRadius: 14,
                  padding: "44px 24px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  textAlign: "center", gap: 12,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Upload size={22} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{t("uploadCta")}</p>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "4px 0 0" }}>{t("uploadHint")}</p>
                </div>
              </div>
            ) : (
              <div style={{
                padding: 14, borderRadius: 11,
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.25)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "rgba(59,130,246,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <FileAudio size={20} style={{ color: "#3B82F6" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                      {t("fileLabel")}
                    </p>
                    <p style={{
                      fontSize: 13, fontWeight: 700, color: "#fff", margin: "2px 0 0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{file.name}</p>
                    <p style={{ fontSize: 11, color: "#D1D5DB", margin: "2px 0 0" }}>
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    disabled={loading}
                    title={t("remove")}
                    style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "#9CA3AF", cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept={ACCEPT}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              style={{ display: "none" }} />

            {/* Target language selector */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Languages size={13} style={{ color: "#3B82F6" }} />
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: 0, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("translateTo")}
                </p>
              </div>
              <select
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                disabled={loading}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 9,
                  background: "rgba(0,0,0,0.30)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#fff", fontSize: 13, fontFamily: "inherit",
                  outline: "none", cursor: loading ? "not-allowed" : "pointer",
                }}>
                <option value="">— {t("translateOff")} —</option>
                {TARGET_LANGS.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label[lang]}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 10.5, color: "#6B7280", margin: "6px 0 0", lineHeight: 1.4 }}>
                {t("translateHint")}
              </p>
            </div>

            {error && (
              <div style={{
                marginTop: 12,
                display: "flex", gap: 8,
                padding: "10px 12px", borderRadius: 9,
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
              }}>
                <AlertTriangle size={14} style={{ color: "#f87171", marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#fee2e2", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</p>
              </div>
            )}

            <button
              onClick={transcribe}
              disabled={!file || loading}
              style={{
                marginTop: 16, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: !file || loading ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: "#fff", border: "none",
                cursor: !file || loading ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                  {step === "extracting" ? t("extracting")
                    : step === "uploading" ? t("uploading")
                    : step === "translating" ? t("translating")
                    : t("transcribing")}
                  {progress > 0 && progress < 100 && step === "extracting" && (
                    <span style={{ fontSize: 11, opacity: 0.85 }}>· {progress}%</span>
                  )}
                </>
              ) : (
                <><Sparkles size={16} />{t("transcribe")}</>
              )}
            </button>
          </div>

          {/* RIGHT — resultado */}
          <div>
            {!transcript && !loading && (
              <div style={{
                background: "rgba(17,24,39,0.50)",
                border: "1px dashed rgba(255,255,255,0.10)",
                borderRadius: 14, minHeight: 360,
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
                  <Mic size={26} strokeWidth={2} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5, maxWidth: 360 }}>
                    {t("emptyDesc")}
                  </p>
                </div>
              </div>
            )}

            {loading && !transcript && (
              <div style={{
                background: "rgba(17,24,39,0.50)",
                border: "1px solid rgba(59,130,246,0.20)",
                borderRadius: 14, minHeight: 360,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: "12px 0 0" }}>
                  {step === "extracting" ? t("extracting")
                    : step === "uploading" ? t("uploading")
                    : step === "translating" ? t("translating")
                    : t("transcribing")}
                </p>
              </div>
            )}

            {transcript && (
              <div style={{
                background: "rgba(17,24,39,0.70)",
                border: "1px solid rgba(59,130,246,0.30)",
                borderRadius: 14, padding: 16,
              }}>
                {/* Tabs Original / Translated */}
                {translated && (
                  <div style={{
                    display: "inline-flex", gap: 4, padding: 3,
                    background: "rgba(0,0,0,0.30)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 9, marginBottom: 12,
                  }}>
                    <button onClick={() => setActiveTab("original")} style={tabBtnStyle(activeTab === "original")}>
                      {t("tabOriginal")}
                      {detectedLang && (
                        <span style={{ fontSize: 9.5, opacity: 0.7, marginLeft: 4, textTransform: "uppercase" }}>
                          · {detectedLang}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setActiveTab("translated")} style={tabBtnStyle(activeTab === "translated")}>
                      {t("tabTranslated")}
                      {targetLang && (
                        <span style={{ fontSize: 9.5, opacity: 0.7, marginLeft: 4, textTransform: "uppercase" }}>
                          · {targetLang}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: 0, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {activeText.length.toLocaleString()} {t("charCount")}
                    {!translated && detectedLang && (
                      <span style={{ marginLeft: 8, color: "#3B82F6", textTransform: "uppercase" }}>
                        · {detectedLang}
                      </span>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={copyTranscript} style={ACTION_BTN}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? t("copied") : t("copy")}
                    </button>
                    <button onClick={downloadTranscript} style={ACTION_BTN}>
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={clearAll} style={{ ...ACTION_BTN, color: "#f87171", borderColor: "rgba(248,113,113,0.20)" }}>
                      <X size={13} /> {t("clear")}
                    </button>
                  </div>
                </div>
                <textarea
                  value={activeText}
                  onChange={e => {
                    if (activeTab === "translated") setTranslated(e.target.value);
                    else setTranscript(e.target.value);
                  }}
                  rows={18}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "14px 16px", borderRadius: 11,
                    background: "rgba(0,0,0,0.30)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#F1F5F9", fontSize: 14, lineHeight: 1.65,
                    fontFamily: "inherit", outline: "none", resize: "vertical",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .hub-trans-workspace { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

const ACTION_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "7px 12px", borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#fff", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 7,
    background: active ? "#3B82F6" : "transparent",
    color: active ? "#fff" : "#9CA3AF",
    border: "none", fontSize: 11.5, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    letterSpacing: "0.02em",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}
