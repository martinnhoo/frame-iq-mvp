import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCw, Volume2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FishVoice {
  id: string;
  name: string;
  gender?: string;
  popularity?: number;
  sample_audio: string | null;
}

interface Props {
  /** Single mode: um id. Multi mode: ids separados por vírgula. */
  value: string;
  onChange: (id: string, name: string) => void;
  style?: React.CSSProperties;
  /** Permite escolher várias vozes; elas se alternam entre os roteiros. */
  multiple?: boolean;
}

const split = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

export default function FishVoiceSelect({ value, onChange, style, multiple }: Props) {
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
      else if (!multiple && !list.some(v => v.id === value)) onChange(list[0].id, list[0].name);
    }
    setLoading(false);
    // onChange/value fora das deps de propósito: recarregar só sob demanda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ids = useMemo(() => (multiple ? split(value) : []), [multiple, value]);
  const selected = useMemo(
    () => voices.find(voice => voice.id === (multiple ? ids[0] : value)),
    [voices, value, multiple, ids],
  );

  const nameOf = (id: string) => voices.find(v => v.id === id)?.name || id;

  const play = (id: string) => {
    const sample = voices.find(v => v.id === id)?.sample_audio;
    if (sample) void new Audio(sample).play();
  };

  const emit = (next: string[]) => onChange(next.join(","), next.map(nameOf).join(" · "));

  const add = (id: string) => { if (id && !ids.includes(id)) emit([...ids, id]); };
  const remove = (id: string) => emit(ids.filter(x => x !== id));

  const iconBtn: React.CSSProperties = {
    width: 36, height: 36, display: "grid", placeItems: "center", flexShrink: 0,
    borderRadius: 7, border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.72)",
    cursor: "pointer",
  };

  const options = voices.filter(v => !multiple || !ids.includes(v.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={multiple ? "" : value}
          disabled={loading || voices.length === 0}
          onChange={event => {
            const id = event.target.value;
            if (multiple) { add(id); return; }
            const voice = voices.find(item => item.id === id);
            onChange(id, voice?.name || "");
          }}
          style={{ ...style, flex: 1 }}
          aria-label="Voz Fish Audio"
        >
          {(loading || options.length === 0 || multiple || !value) && (
            <option value="">
              {loading
                ? "Carregando vozes…"
                : voices.length === 0
                  ? "Nenhuma voz disponível"
                  : multiple
                    ? (options.length === 0 ? "Todas as vozes adicionadas" : "Adicionar uma voz…")
                    : "Escolha uma voz"}
            </option>
          )}
          {options.map(voice => (
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

        {!multiple && (
          <button
            type="button"
            onClick={() => selected && play(selected.id)}
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
        )}
      </div>

      {multiple && ids.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ids.map((id, i) => (
            <span
              key={id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 8px", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.80)", fontSize: 11.5, fontWeight: 600,
              }}
            >
              <span style={{ opacity: 0.5 }}>{i + 1}</span>
              {nameOf(id)}
              <button
                type="button" onClick={() => play(id)} title="Ouvir prévia"
                aria-label={`Ouvir prévia de ${nameOf(id)}`}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", opacity: 0.7 }}
              >
                <Volume2 size={12} />
              </button>
              <button
                type="button" onClick={() => remove(id)} title="Remover voz"
                aria-label={`Remover ${nameOf(id)}`}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", opacity: 0.7 }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {multiple && (
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)" }}>
          {ids.length > 1
            ? `As ${ids.length} vozes se alternam entre os roteiros, na ordem acima.`
            : "Adicione mais de uma voz para alternar entre os roteiros."}
        </span>
      )}

      {error && !loading && (
        <span style={{ fontSize: 10, color: "rgba(248,113,113,0.85)" }}>{error}</span>
      )}
    </div>
  );
}
