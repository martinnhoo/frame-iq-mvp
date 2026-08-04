/**
 * design.ts — a fonte única de cor, tipo, espaço, raio e sombra.
 *
 * POR QUE ISTO EXISTE
 *
 * Uma auditoria mediu o repositório e achou, em `src/**\/*.tsx`:
 *   34 tamanhos de fonte distintos (9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, …)
 *   24 raios de borda
 *   91 strings distintas de boxShadow em 209 usos — quase nada reaproveitado
 *   284 cores hex, 53 delas usadas como fundo
 *   437 strings distintas de padding
 *   7 pretos de página e 6 azuis primários concorrentes
 *   17 objetos `const T = {…}` de tema, um por arquivo
 *
 * Existiam três fontes de token no repo — o `:root` do index.css, o
 * design-tokens.css e o tokens.ts — e as três juntas eram lidas por três
 * telas. O produto real rodava nos 17 temas locais.
 *
 * Isso não é uma questão de gosto. É o que o cérebro de quem vai pagar lê
 * como "amador" antes de conseguir dizer por quê: nada parece feito pela
 * mesma equipe. E torna qualquer mudança de visual um trabalho de 17
 * arquivos, o que na prática significa que ela não acontece.
 *
 * REGRA DE CORTE: dois valores a menos de ~20% um do outro são o mesmo
 * valor. 12 e 12.5px de corpo de texto ninguém distingue — mas juntos eles
 * garantem que duas telas nunca fiquem iguais.
 *
 * A partir daqui, nada de cor, raio, sombra ou tamanho literal em .tsx.
 */

import type { CSSProperties } from "react";

/* ── Cor ────────────────────────────────────────────────────────────────────
   Um preto (eram 7), uma primária (eram 6). As superfícies sobem em passos
   de ~4% de luminância: o suficiente pra separar plano sem virar cinza. */
export const color = {
  /** Fundo de página, body, sidebar, topbar.
   *  Aposenta #080B11, #060A14, #06070a, #0A0D14, #050508, #06080C, #0a0a0f. */
  canvas:  "#06080D",
  surface: "#0F1218",  // card padrão
  raised:  "#161A22",  // modal, hover de card, plano em destaque
  inset:   "#0A0C11",  // input, textarea, poço de imagem

  border:      "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.13)",
  borderFocus: "rgba(59,130,246,0.55)",

  text:  "#F2F4F8",                // título e valor
  text2: "rgba(255,255,255,0.64)", // corpo e descrição
  text3: "rgba(255,255,255,0.42)", // meta, label, placeholder

  /** Primária única. Aposenta #0ea5e9, #0da2e7, #2563EB, #38bdf8 e o
   *  amarelo #EAB308 que virou CTA por acidente numa tela só. */
  accent:       "#3B82F6",
  accentHover:  "#2563EB",
  accentText:   "#FFFFFF",
  accentSoft:   "rgba(59,130,246,0.12)",
  accentBorder: "rgba(59,130,246,0.42)",

  success: "#34D399", successSoft: "rgba(52,211,153,0.10)",  successBorder: "rgba(52,211,153,0.28)",
  warning: "#FBBF24", warningSoft: "rgba(251,191,36,0.10)",  warningBorder: "rgba(251,191,36,0.28)",
  danger:  "#F87171", dangerSoft:  "rgba(248,113,113,0.10)", dangerBorder:  "rgba(248,113,113,0.28)",
} as const;

/* ── Tipografia ─────────────────────────────────────────────────────────────
   8 degraus. Os 34 atuais colapsam sem perda:
   9/9.5/10/10.5 → label · 11.5 → caption · 12.5/13.5 → body
   14/14.5/15.5 → bodyLg · 16-19 → title · 20-28 → h1 · 30-40 → display */
export const font = {
  /** Uma família no app E na landing. Hoje a landing usa Inter e o app usa
   *  Plus Jakarta — quem clica em "Começar grátis" troca de marca no caminho. */
  family: "'Plus Jakarta Sans', system-ui, sans-serif",
  /** Só para número que precisa alinhar em coluna: saldo, crédito, preço. */
  mono: "'DM Mono', ui-monospace, monospace",

  size: {
    label:   11,  // eyebrow maiúsculo, badge, contador
    caption: 12,  // meta, hint, apoio
    body:    13,  // corpo padrão do app
    bodyLg:  15,  // input, corpo da landing
    title:   18,  // título de seção e de card
    h1:      24,  // título de página
    display: 34,  // h2 da landing, preço do plano
    hero:    52,  // h1 da landing, só ali
  },

  /** 3 pesos, eram 6. */
  weight: { regular: 400, medium: 600, bold: 800 },

  leading: { tight: 1.15, snug: 1.35, normal: 1.55 },

  /** 3 tracking, eram 62 valores soltos. */
  tracking: { display: "-0.03em", normal: "0", label: "0.08em" },
} as const;

/* ── Espaçamento ────────────────────────────────────────────────────────────
   Passo de 4, sem meio-termo. Aposenta 5, 7, 9, 11, 13, 17, 18, 22, 26. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;

/* ── Raio ───────────────────────────────────────────────────────────────────
   5 valores, eram 24. Um raio por classe de objeto. */
export const radius = {
  xs:   4,   // badge, tag, barra de progresso
  sm:   8,   // input, botão, chip, miniatura
  md:   12,  // card, painel
  lg:   16,  // modal, moldura de preview
  full: 999,
} as const;

/* ── Sombra ─────────────────────────────────────────────────────────────────
   4 valores, eram 91 strings distintas. Profundidade é função — card,
   dropdown, modal, foco — não decoração. */
export const shadow = {
  card:    "0 1px 2px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)",
  raised:  "0 8px 24px -8px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.05)",
  overlay: "0 24px 64px -16px rgba(0,0,0,0.75)",
  focus:   "0 0 0 3px rgba(59,130,246,0.25)",
} as const;

/* ── Altura de componente ───────────────────────────────────────────────────
   3 alturas de controle, no lugar dos 437 paddings ad-hoc. 40 e 48 também
   resolvem o alvo de toque no celular, que hoje é resolvido por acidente. */
export const size = {
  controlSm: 32,
  control:   40,
  controlLg: 48,
  topbar:    56,
  sidebar:   220,
  page:      1280,
} as const;

/* ── Movimento ──────────────────────────────────────────────────────────────
   Duas curvas. Aposenta 0.12 / 0.15 / 0.18 / 0.2 / 0.25 / 0.3 soltos. */
export const motion = {
  fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "260ms cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/* ── Receitas ───────────────────────────────────────────────────────────────
   Pra ninguém precisar recompor um card na mão de novo. */

export const card: CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.card,
  padding: space[5],
};

export const input: CSSProperties = {
  height: size.control,
  padding: `0 ${space[3]}px`,
  background: color.inset,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  color: color.text,
  fontSize: font.size.bodyLg,
  fontFamily: font.family,
  outline: "none",
  boxSizing: "border-box",
};

export const btnPrimary: CSSProperties = {
  height: size.controlLg,
  padding: `0 ${space[5]}px`,
  background: color.accent,
  color: color.accentText,
  border: "none",
  borderRadius: radius.sm,
  fontSize: font.size.bodyLg,
  fontWeight: font.weight.bold,
  fontFamily: font.family,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  transition: `background ${motion.fast}, transform ${motion.fast}`,
};

export const btnSecondary: CSSProperties = {
  ...btnPrimary,
  height: size.control,
  background: "transparent",
  color: color.text,
  border: `1px solid ${color.borderHover}`,
  fontWeight: font.weight.medium,
};

/** Rótulo curto em caixa alta. Usado como eyebrow de seção. */
export const eyebrow: CSSProperties = {
  fontSize: font.size.label,
  fontWeight: font.weight.bold,
  letterSpacing: font.tracking.label,
  textTransform: "uppercase",
  color: color.text3,
};
