/**
 * Tema do Creative Intelligence — cores, tipografia e as peças repetidas.
 *
 * ── Por que este arquivo existe ───────────────────────────────────────────
 * Havia ONZE cópias de `const T = {…}` e DEZ cópias de `const Card`. Nenhuma
 * era exatamente igual à outra, e nenhuma dessas diferenças foi escolhida:
 *
 *   · raio 13 em oito telas, 14 na de importação
 *   · marginBottom 13 em quatro, 14 em cinco, nenhum na visão geral
 *   · `purple` valia #8B5CF6 na visão geral e #A78BFA na importação —
 *     o MESMO nome com duas cores
 *   · `orange` na visão geral era #FBBF24, que é exatamente o `yellow`.
 *     Um token laranja que pinta amarelo: quem lesse o código teria certeza
 *     de estar vendo duas cores diferentes na tela.
 *
 * Isso não é questão de gosto. Com onze fontes de verdade, ajustar um contraste
 * significa achar e acertar onze arquivos, e o décimo primeiro sempre escapa.
 * A tela fica "quase certa" de um jeito que ninguém consegue apontar.
 *
 * ── Regra ─────────────────────────────────────────────────────────────────
 * Nenhuma tela do CI declara cor própria. Se falta um token, ele nasce aqui.
 */
import React from "react";

export const T = {
  // Fundos, do mais escuro para o mais claro.
  bg0: "#080B11",  // página
  bg1: "#0D1117",  // card
  bg2: "#161B22",  // dentro do card
  bg3: "#1C2128",  // pílula, chip

  // Bordas.
  b0: "rgba(240,246,252,0.04)",
  b1: "rgba(240,246,252,0.07)",
  b2: "rgba(240,246,252,0.12)",

  // Texto, do mais forte ao mais fraco.
  t1: "#F0F6FC",
  t2: "rgba(240,246,252,0.72)",
  t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",

  // Acentos.
  blue: "#0ea5e9",
  green: "#4ADE80",
  red: "#F87171",
  yellow: "#FBBF24",
  orange: "#FB923C",   // laranja de verdade, distinguível do amarelo
  teal: "#2DD4BF",

  // Roxo é a cor da marca no CI e tem DOIS tons, com nomes que dizem qual:
  // o forte preenche, o claro escreve. Chamar os dois de "violet" em arquivos
  // diferentes foi o que produziu itens de menu com contrastes distintos.
  violet: "#A78BFA",       // claro — texto, ícone, estado ativo
  violetForte: "#8B5CF6",  // forte — preenchimento, avatar, fundo translúcido
} as const;

export const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Ícones ───────────────────────────────────────────────────────────────────
// Traçado único, 24×24, sem preenchimento — misturar famílias de ícone é o
// jeito mais rápido de um produto parecer montado por duas pessoas.
export const I = {
  home: "M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  brand: "M4 4h16v16H4zM8 8h8v8H8z",
  ads: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5v8m-4-4h8",
  recipe: "M4 6h16M4 12h16M4 18h10",
  hook: "M13 2 4 14h6l-1 8 9-12h-6z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
  product: "M20 7 12 3 4 7v10l8 4 8-4z",
  report: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.5-4.5",
  layers: "M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  bulb: "M9 21h6M10 17h4a5 5 0 1 0-4 0z",
  shield: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z",
  doc: "M6 2h8l4 4v16H6zM14 2v4h4",
  spark: "m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z",
  chat: "M4 5h16v11H9l-5 4z",
  warn: "M12 3 2 20h20zM12 10v4m0 3h.01",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-4-9 3 3 5-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2",
  phone: "M8 2h8v20H8zM11 19h2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
};

export const Ic = ({ d, s = 16, c = "currentColor", w = 1.6 }: {
  d: string; s?: number; c?: string; w?: number;
}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w}
       strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>
);

// ── Peças ────────────────────────────────────────────────────────────────────

/**
 * Card. Uma medida só, porque nenhuma tela tinha motivo para a sua.
 * `style` continua aceito para o caso legítimo: uma borda vermelha de erro.
 */
export const Card = ({ children, style }: {
  children: React.ReactNode; style?: React.CSSProperties;
}) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 13,
    padding: 18, marginBottom: 14, ...style,
  }}>{children}</div>
);

/**
 * Cabeçalho de seção: título, e abaixo a frase que diz de onde o número veio.
 *
 * A explicação é PROP OBRIGATÓRIA, não opcional. Num produto que mostra
 * contagens de repetição pública, um título sozinho — "Hooks que mais
 * aparecem" — convida a ler como ranking de desempenho. Tornar a legenda
 * obrigatória custa uma linha por seção e evita a leitura errada por padrão.
 */
export const Secao = ({ titulo, explica, direita }: {
  titulo: string; explica: string; direita?: React.ReactNode;
}) => (
  <div style={{
    display: "flex", alignItems: "flex-start", gap: 12,
    marginBottom: 10, flexWrap: "wrap",
  }}>
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 14.5, fontWeight: 640, letterSpacing: "-.01em" }}>{titulo}</div>
      <div style={{ fontSize: 11.8, color: T.t3, marginTop: 3, lineHeight: 1.5 }}>{explica}</div>
    </div>
    {direita}
  </div>
);

/**
 * Estado vazio. `motivo` diz POR QUE está vazio e `acao` dá a saída.
 *
 * O padrão anterior era um "Nenhum dado" cinza, que é indistinguível de uma
 * tela quebrada. Zero porque ninguém importou ainda e zero porque a consulta
 * falhou parecem a mesma coisa para quem olha — e só uma das duas é culpa
 * do sistema.
 */
export const Vazio = ({ motivo, acao }: { motivo: string; acao?: React.ReactNode }) => (
  <div style={{
    border: `1px dashed ${T.b2}`, borderRadius: 11, padding: "22px 18px",
    display: "grid", gap: 10, justifyItems: "start",
    color: T.t3, fontSize: 12.8, lineHeight: 1.55,
  }}>
    <span>{motivo}</span>
    {acao}
  </div>
);

/**
 * Pílula de rótulo — chip de valor observado.
 * `tom` só muda a cor, nunca o tamanho: chips de alturas diferentes na mesma
 * linha é o defeito visual mais comum destas telas.
 */
export const Pilula = ({ children, tom = "neutro" }: {
  children: React.ReactNode; tom?: "neutro" | "bom" | "atencao" | "ruim" | "marca";
}) => {
  const cor = { neutro: T.t2, bom: T.green, atencao: T.yellow, ruim: T.red, marca: T.violet }[tom];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px",
      borderRadius: 999, background: T.bg3, border: `1px solid ${T.b1}`,
      color: cor, fontSize: 11.5, fontWeight: 560, whiteSpace: "nowrap",
    }}>{children}</span>
  );
};
