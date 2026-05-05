/**
 * CustomLogoUpload — file input pra user subir logo customizado.
 *
 * Caso de uso: além das marcas pré-cadastradas (BETBUS, ELUCK,
 * FUNILIVE), o user pode subir QUALQUER PNG/JPG e usar como overlay.
 * Útil pra testes, marcas one-off, ou parceiros sem cadastro fixo.
 *
 * Strategy: FileReader → data URL → state local + persist em
 * localStorage por 24h pra não precisar re-upload em cada geração.
 *
 * Output: o pai recebe a data URL via callback. Quando user limpa,
 * recebe null.
 */

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

const STORAGE_KEY = "hub_custom_logo_v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Lang = "pt" | "en" | "es" | "zh";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  language?: Lang;
  disabled?: boolean;
}

const STR: Record<string, Record<Lang, string>> = {
  upload:    { pt: "Subir logo customizado", en: "Upload custom logo",   es: "Subir logo personalizado", zh: "上传自定义 logo" },
  remove:    { pt: "Remover",                en: "Remove",               es: "Eliminar",                 zh: "移除" },
  uploaded:  { pt: "Logo customizado",       en: "Custom logo",          es: "Logo personalizado",       zh: "自定义 logo" },
  invalid:   { pt: "Arquivo inválido (PNG/JPG até 5MB).",
               en: "Invalid file (PNG/JPG up to 5MB).",
               es: "Archivo inválido (PNG/JPG hasta 5MB).",
               zh: "无效文件（PNG/JPG 最大 5MB）。" },
};

export function CustomLogoUpload({ value, onChange, language = "pt", disabled }: Props) {
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const t = (key: keyof typeof STR) => STR[key]?.[language] || STR[key]?.en || key;

  // Restaura da storage se ainda dentro do TTL
  useEffect(() => {
    if (value) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { dataUrl: string; ts: number };
      if (Date.now() - parsed.ts < TTL_MS) {
        onChange(parsed.dataUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* silent */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (file: File) => {
    setError(null);
    if (!/(image\/png|image\/jpeg|image\/webp)/i.test(file.type)) {
      setError(t("invalid"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("invalid"));
      return;
    }
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      onChange(dataUrl);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ dataUrl, ts: Date.now() })); } catch {}
    } catch (e) {
      setError(String(e).slice(0, 100));
    }
  };

  const handleRemove = () => {
    onChange(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    if (ref.current) ref.current.value = "";
  };

  if (value) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 10,
        background: "rgba(59,130,246,0.08)",
        border: "1px solid rgba(59,130,246,0.30)",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          <img src={value} alt="custom logo" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#FFFFFF" }}>{t("uploaded")}</span>
        <button
          onClick={handleRemove}
          disabled={disabled}
          title={t("remove")}
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            color: "#9CA3AF", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}>
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => ref.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={disabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 10,
          background: hover ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.70)",
          border: "1px dashed rgba(255,255,255,0.16)",
          color: "#D1D5DB", fontSize: 12.5, fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "all 0.15s",
        }}>
        <Upload size={13} /> {t("upload")}
      </button>
      <input
        ref={ref} type="file" accept="image/png,image/jpeg,image/webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        style={{ display: "none" }}
      />
      {error && (
        <p style={{ fontSize: 11, color: "#f87171", margin: "6px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
