import { useEffect, useMemo, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FishVoice {
  id: string;
  name: string;
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

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error: invokeError } = await supabase.functions.invoke("hub-voice-gen", {
        body: { action: "voices", language: "pt" },
      });
      if (!active) return;
      if (invokeError || !data?.ok) {
        setError(data?.message || "Não foi possível carregar as vozes Fish Audio.");
        setVoices([]);
      } else {
        setError(null);
        setVoices(data.voices || []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => voices.find(voice => voice.id === value), [voices, value]);

  const preview = () => {
    if (!selected?.sample_audio) return;
    void new Audio(selected.sample_audio).play();
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select
        value={value}
        disabled={loading}
        onChange={event => {
          const voice = voices.find(item => item.id === event.target.value);
          onChange(event.target.value, voice?.name || "");
        }}
        style={{ ...style, flex: 1 }}
        aria-label="Voz Fish Audio"
      >
        <option value="">{loading ? "Carregando vozes…" : error || "Escolha uma voz"}</option>
        {voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
      </select>
      <button
        type="button"
        onClick={preview}
        disabled={!selected?.sample_audio}
        title="Ouvir prévia"
        aria-label="Ouvir prévia da voz"
        style={{
          width: 36, height: 36, display: "grid", placeItems: "center", flexShrink: 0,
          borderRadius: 7, border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.72)",
          cursor: selected?.sample_audio ? "pointer" : "not-allowed", opacity: selected?.sample_audio ? 1 : 0.45,
        }}
      >
        {loading ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}