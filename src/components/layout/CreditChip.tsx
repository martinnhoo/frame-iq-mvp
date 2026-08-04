/**
 * CreditChip — o saldo de créditos na topbar.
 *
 * O produto inteiro é medido em créditos, e o medidor não aparecia em lugar
 * nenhum persistente: das 52 telas, 7 liam `useHubCredits` e nenhuma delas
 * era o shell. Quem gera não sabe quanto tem, quem acaba descobre por um
 * erro, e isso vira ticket de suporte antes de virar upgrade.
 *
 * O número usa fonte tabular porque ele muda a cada geração — com fonte
 * proporcional a largura dança e o olho lê como instabilidade.
 */

import { useNavigate } from "react-router-dom";
import { useHubCredits } from "@/hooks/useHubCredits";
import { color, font, radius, size, space, motion } from "@/lib/design";

export default function CreditChip() {
  const navigate = useNavigate();
  const { balance, planCredits, packCredits, loading } = useHubCredits();

  if (loading) return null;

  const total = planCredits + packCredits;
  const pct = total > 0 ? Math.max(0, Math.min(1, balance / total)) : 0;

  // Abaixo de 15% o chip muda de cor. Não é enfeite: é o aviso que evita a
  // pessoa começar uma automação de 56 créditos com 12 no saldo.
  const low = total > 0 && pct < 0.15;
  const tone = low ? color.warning : color.text2;

  return (
    <button
      onClick={() => navigate("/dashboard/plans")}
      title={`${balance} de ${total} créditos neste ciclo`}
      style={{
        display: "inline-flex", alignItems: "center", gap: space[2],
        height: size.controlSm,
        padding: `0 ${space[3]}px`,
        background: low ? color.warningSoft : "rgba(255,255,255,0.04)",
        border: `1px solid ${low ? color.warningBorder : color.border}`,
        borderRadius: radius.full,
        color: tone,
        fontFamily: font.family,
        fontSize: font.size.caption,
        fontWeight: font.weight.medium,
        cursor: "pointer",
        transition: `border-color ${motion.fast}, background ${motion.fast}`,
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color.borderHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = low ? color.warningBorder : color.border; }}
    >
      {/* Anel de consumo. Menor que um texto de porcentagem e lido mais
          rápido — a pessoa vê "quase acabando" sem ler número nenhum. */}
      <span style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "block" }}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <circle
            cx="7" cy="7" r="5.5" fill="none"
            stroke={low ? color.warning : color.accent}
            strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${pct * 34.5} 34.5`}
            transform="rotate(-90 7 7)"
          />
        </svg>
      </span>
      <span style={{
        fontFamily: font.mono,
        fontVariantNumeric: "tabular-nums",
        fontSize: font.size.body,
        fontWeight: font.weight.bold,
        color: low ? color.warning : color.text,
      }}>
        {balance}
      </span>
      <span style={{ color: color.text3, fontSize: font.size.caption }}>
        crédito{balance === 1 ? "" : "s"}
      </span>
    </button>
  );
}
