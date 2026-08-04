/**
 * RecipeStudio — a tela que a pessoa vê ao abrir Automações.
 *
 * Antes, abrir Automações mostrava um canvas vazio com uma paleta de dez tipos
 * de nó. Isso pede que o usuário conheça a arquitetura do sistema antes de
 * produzir a primeira coisa: descobrir que "prompt" alimenta "image-gen", que
 * "brand" entra por outra porta, que "variation" multiplica o que vem depois.
 *
 * Aqui ele escolhe um resultado, responde três perguntas e roda. O grafo sai
 * montado e vai pro MESMO executor — o canvas continua ali, em "Modo
 * avançado", pra quem quiser mexer nos nós.
 *
 * O preço aparece antes do botão. Rodar sem saber quanto custa é o tipo de
 * coisa que gera pedido de reembolso na primeira semana.
 */

import { useMemo, useState } from "react";
import { ArrowLeft, Play, Loader, SlidersHorizontal, Coins } from "lucide-react";
import { RECIPES, missingField, type Recipe, type RecipeField } from "@/lib/workflowRecipes";
import type { WfGraph } from "@/lib/hubWorkflows";
import { useUserBrands } from "@/hooks/useUserBrands";

const T = {
  bg:     "#06070a",
  panel:  "#0a0b10",
  line:   "rgba(255,255,255,0.08)",
  lineHi: "rgba(255,255,255,0.16)",
  text:   "#fff",
  dim:    "rgba(255,255,255,0.56)",
  faint:  "rgba(255,255,255,0.34)",
  accent: "#EAB308",
};

interface Props {
  onRun: (name: string, graph: WfGraph) => Promise<void>;
  running: boolean;
  onOpenAdvanced: (name: string, graph: WfGraph) => Promise<void>;
  balance: number;
}

export default function RecipeStudio({ onRun, running, onOpenAdvanced, balance }: Props) {
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const { brands } = useUserBrands();

  const cost = useMemo(() => {
    if (!picked) return 0;
    try { return picked.estimate(answers); } catch { return 0; }
  }, [picked, answers]);

  const enough = balance >= cost;

  function pick(r: Recipe) {
    setPicked(r);
    setErr(null);
    // Pré-preenche os defaults declarados na receita: um formulário que abre
    // vazio faz a pessoa decidir coisas que têm resposta óbvia.
    const init: Record<string, string> = {};
    for (const f of r.fields) if (f.default !== undefined) init[f.key] = String(f.default);
    setAnswers(init);
  }

  async function go(advanced: boolean) {
    if (!picked) return;
    const miss = missingField(picked, answers);
    if (miss) { setErr(`Falta preencher: ${miss}`); return; }
    setErr(null);
    const graph = picked.build(answers);
    const name = picked.name;
    if (advanced) await onOpenAdvanced(name, graph);
    else await onRun(name, graph);
  }

  if (!picked) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 60px" }}>
        <style>{`
          @media (max-width: 760px) {
            .recipe-grid { grid-template-columns: 1fr !important; }
            .recipe-head { font-size: 22px !important; }
          }
        `}</style>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h1 className="recipe-head" style={{
            fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: T.text,
          }}>
            O que você quer produzir?
          </h1>
          <p style={{ fontSize: 14, color: T.dim, margin: "8px 0 26px", lineHeight: 1.6, maxWidth: 620 }}>
            Escolha o resultado. Você responde três perguntas e a automação roda sozinha —
            sem montar nada.
          </p>

          <div className="recipe-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12,
          }}>
            {RECIPES.map(r => (
              <button
                key={r.id}
                onClick={() => pick(r)}
                style={{
                  textAlign: "left", padding: 18, borderRadius: 12,
                  background: T.panel, border: `1px solid ${T.line}`,
                  color: T.text, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", flexDirection: "column", gap: 8,
                  transition: "border-color .15s, transform .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.lineHi; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.transform = "none"; }}
              >
                <span style={{ fontSize: 18, color: T.accent, lineHeight: 1 }}>{r.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.name}</span>
                <span style={{ fontSize: 13, color: T.dim, lineHeight: 1.55 }}>{r.outcome}</span>
                <span style={{ fontSize: 12, color: T.faint, lineHeight: 1.5, marginTop: 2 }}>
                  {r.whenToUse}
                </span>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 26, padding: 16, borderRadius: 10,
            border: `1px dashed ${T.line}`, color: T.faint, fontSize: 12.5, lineHeight: 1.6,
          }}>
            Precisa de algo que não está aqui? O <strong style={{ color: T.dim }}>Modo avançado</strong> abre
            o editor de nós, onde dá pra montar qualquer combinação. Toda receita
            também abre lá, já montada.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 20px 80px" }}>
      <style>{`
        @media (max-width: 760px) {
          .recipe-form { padding: 16px !important; }
          .recipe-actions { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <button
          onClick={() => setPicked(null)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
            background: "transparent", border: "none", color: T.dim,
            fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0,
          }}
        >
          <ArrowLeft size={13} /> Escolher outro resultado
        </button>

        <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
          {picked.name}
        </h2>
        <p style={{ fontSize: 13.5, color: T.dim, margin: "0 0 22px", lineHeight: 1.6 }}>
          {picked.outcome}
        </p>

        <div className="recipe-form" style={{
          background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20,
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          {picked.fields.map(f => (
            <Field
              key={f.key}
              field={f}
              value={answers[f.key] ?? ""}
              brands={brands}
              onChange={v => setAnswers(a => ({ ...a, [f.key]: v }))}
            />
          ))}
        </div>

        {/* Custo antes do botão, não depois. */}
        <div style={{
          marginTop: 14, padding: "12px 14px", borderRadius: 10,
          background: enough ? "rgba(234,179,8,0.07)" : "rgba(239,68,68,0.09)",
          border: `1px solid ${enough ? "rgba(234,179,8,0.22)" : "rgba(239,68,68,0.30)"}`,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <Coins size={15} color={enough ? T.accent : "#F87171"} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {cost > 0 ? `Custa ${cost} crédito${cost === 1 ? "" : "s"}` : "Preencha para ver o custo"}
          </span>
          <span style={{ fontSize: 12.5, color: T.dim }}>
            · você tem {balance}
          </span>
          {!enough && cost > 0 && (
            <span style={{ fontSize: 12.5, color: "#F87171", width: "100%" }}>
              Saldo insuficiente. A automação não roda pela metade — ou sai
              inteira, ou nada é cobrado.
            </span>
          )}
        </div>

        {err && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#F87171" }}>{err}</div>
        )}

        <div className="recipe-actions" style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
          <button
            onClick={() => go(false)}
            disabled={running || !enough || cost === 0}
            style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 18px", borderRadius: 10, border: "none",
              background: running || !enough || cost === 0 ? "rgba(255,255,255,0.10)" : T.accent,
              color: running || !enough || cost === 0 ? T.faint : "#111",
              fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              cursor: running || !enough || cost === 0 ? "not-allowed" : "pointer",
              minHeight: 46,
            }}
          >
            {running ? <Loader size={15} className="spin" /> : <Play size={15} />}
            {running ? "Gerando…" : "Gerar agora"}
          </button>
          <button
            onClick={() => go(true)}
            disabled={running}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "13px 16px", borderRadius: 10,
              background: "transparent", border: `1px solid ${T.line}`, color: T.dim,
              fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              minHeight: 46, whiteSpace: "nowrap",
            }}
            title="Abre o editor de nós com esta automação já montada"
          >
            <SlidersHorizontal size={14} /> Abrir no modo avançado
          </button>
        </div>
      </div>
    </div>
  );
}

const labelSt: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: T.text,
  marginBottom: 6, letterSpacing: "0.01em",
};
const helpSt: React.CSSProperties = {
  display: "block", fontSize: 11.5, color: T.faint, marginTop: 6, lineHeight: 1.5,
};
const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 8,
  background: "rgba(255,255,255,0.04)", border: `1px solid ${T.line}`,
  color: T.text, fontSize: 13.5, fontFamily: "inherit", outline: "none",
  boxSizing: "border-box", minHeight: 44,
};

function Field({ field, value, onChange, brands }: {
  field: RecipeField;
  value: string;
  onChange: (v: string) => void;
  brands: { id: string; name: string }[];
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelSt}>
        {field.label}
        {!field.required && <span style={{ color: T.faint, fontWeight: 500 }}> · opcional</span>}
      </span>

      {field.kind === "textarea" && (
        <textarea
          rows={4}
          value={value}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputSt, resize: "vertical", lineHeight: 1.6, scrollMarginBottom: 140 }}
        />
      )}

      {field.kind === "text" && (
        <input
          value={value}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          style={inputSt}
        />
      )}

      {field.kind === "number" && (
        <input
          type="number"
          value={value}
          min={field.min}
          max={field.max}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputSt, maxWidth: 140 }}
        />
      )}

      {field.kind === "brand" && (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputSt, cursor: "pointer" }}
        >
          <option value="">Sem marca</option>
          {brands.filter(b => b.id && b.id !== "none").map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {field.kind === "select" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(field.options || []).map(o => {
            const on = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                style={{
                  padding: "9px 13px", borderRadius: 8, minHeight: 40,
                  background: on ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${on ? T.accent : T.line}`,
                  color: on ? T.accent : T.dim,
                  fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
                }}
              >
                <span>{o.label}</span>
                {o.hint && <span style={{ fontSize: 10.5, opacity: 0.7, fontWeight: 500 }}>{o.hint}</span>}
              </button>
            );
          })}
        </div>
      )}

      {field.help && <span style={helpSt}>{field.help}</span>}
    </label>
  );
}
