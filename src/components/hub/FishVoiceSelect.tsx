import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCw, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FishVoice {
  id: string;
  name: string;
  gender?: string;
  popularity?: number;
  sample_audio: string | null;
}

interface Props {
  value: string;
  onChange: (id: string, name: string) => void;
  style?: React.CSSProperties;
}

export default function FishVoiceSelect({ value, onChange, style }: Props) {
  const [voices, setVoices] = useState<FishVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("hub-voice-gen", {
      body: { action: "voices", language: "pt" },
    });
    if (invokeError || !data?.ok) {
      setError(data?.message || "Não foi possível carregar as vozes.");
      setVoices([]);
    } else {
      const list: FishVoice[] = data.voices || [];
      setVoices(list);
      if (list.length === 0) setError("Nenhuma voz disponível agora.");
      // Se a voz salva não existe mais no catálogo, seleciona a primeira
      // para não deixar a caixa em branco.
      else if (!list.some(v => v.id === value)) onChange(list[0].id, list[0].name);
    }
    setLoading(false);
    // onChange/value fora das deps de propósito: recarregar só sob demanda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => voices.find(voice => voice.id === value), [voices, value]);

  const preview = () => {
    if (!selected?.sample_audio) return;
    void new Audio(selected.sample_audio).play();
  };

  const iconBtn: React.CSSProperties = {
    width: 36, height: 36, display: "grid", placeItems: "center", flexShrink: 0,
    borderRadius: 7, border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.72)",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={value}
          disabled={loading || voices.length === 0}
          onChange={event => {
            const voice = voices.find(item => item.id === event.target.value);
            onChange(event.target.value, voice?.name || "");
          }}
          style={{ ...style, flex: 1 }}
          aria-label="Voz Fish Audio"
        >
          {(loading || voices.length === 0 || !value) && (
            <option value="">
              {loading ? "Carregando vozes…" : voices.length === 0 ? "Nenhuma voz disponível" : "Escolha uma voz"}
            </option>
          )}
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
              {voice.gender === "female" ? " · feminina" : voice.gender === "male" ? " · masculina" : ""}
            </option>
          ))}
        </select>

        {(error || voices.length === 0) && !loading && (
          <button type="button" onClick={() => void load()} title="Recarregar vozes" aria-label="Recarregar vozes" style={iconBtn}>
            <RotateCw size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={preview}
          disabled={!selected?.sample_audio}
          title="Ouvir prévia"
          aria-label="Ouvir prévia da voz"
          style={{
            ...iconBtn,
            cursor: selected?.sample_audio ? "pointer" : "not-allowed",
            opacity: selected?.sample_audio ? 1 : 0.45,
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />}
        </button>
      </div>

      {error && !loading && (
        <span style={{ fontSize: 10, color: "rgba(248,113,113,0.85)" }}>{error}</span>
      )}
    </div>
  );
}
