/**
 * CreditChip — o saldo de créditos na topbar.
 *
 * Chip compacto de 36px: ícone circular azul discreto + número em fonte do
 * produto (peso 600, tabular-nums) + a palavra "créditos" em peso 400 e menor
 * contraste. Nada de fonte display: o número é dado, não manchete.
 *
 * Enquanto carrega, o chip mantém a mesma caixa (skeleton) para o header não
 * pular quando o saldo chega.
 */

import { useNavigate } from "react-router-dom";
import { useHubCredits } from "@/hooks/useHubCredits";
import { color, font, radius, space, motion } from "@/lib/design";

const CHIP_HEIGHT = 36;

export default function CreditChip() {
  const navigate = useNavigate();
  const { balance, planCredits, packCredits, loading } = useHubCredits();

  const total = planCredits + packCredits;
  const pct = total > 0 ? Math.max(0, Math.min(1, balance / total)) : 0;

  // Abaixo de 15% o chip muda de cor. Não é enfeite: é o aviso que evita a
  // pessoa começar uma automação de 56 créditos com 12 no saldo.
  const low = !loading && total > 0 && pct < 0.15;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: space[2],
    height: CHIP_HEIGHT,
    padding: `0 ${space[3]}px`,
    background: low ? color.warningSoft : "rgba(255,255,255,0.04)",
    border: `1px solid ${low ? color.warningBorder : "rgba(255,255,255,0.10)"}`,
    borderRadius: radius.full,
    fontFamily: font.family,
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  if (loading) {
    return (
      <div
        aria-busy="true"
        style={{ ...baseStyle, minWidth: 122, opacity: 0.6 }}
      >
        <span style={{
          width: 14, height: 14, borderRadius: radius.full,
          background: "rgba(255,255,255,0.10)", flexShrink: 0,
        }} />
        <span style={{
          width: 62, height: 8, borderRadius: radius.xs,
          background: "rgba(255,255,255,0.08)",
        }} />
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate("/dashboard/plans")}
      title={`${balance.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} créditos neste ciclo`}
      style={{
        ...baseStyle,
        cursor: "pointer",
        transition: `border-color ${motion.fast}, background ${motion.fast}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = low ? color.warningSoft : "rgba(255,255,255,0.07)";
        e.currentTarget.style.borderColor = low ? color.warningBorder : "rgba(255,255,255,0.16)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = low ? color.warningSoft : "rgba(255,255,255,0.04)";
        e.currentTarget.style.borderColor = low ? color.warningBorder : "rgba(255,255,255,0.10)";
      }}
    >
      {/* Anel de consumo. Menor que um texto de porcentagem e lido mais
          rápido — a pessoa vê "quase acabando" sem ler número nenhum. */}
      <span style={{ position: "relative", width: 14, height: 14, flexShrink: 0, display: "inline-flex" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "block" }}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
          <circle
            cx="7" cy="7" r="5.5" fill="none"
            stroke={low ? color.warning : color.accent}
            strokeWidth="1.5" strokeLinecap="round"
            strokeDasharray={`${pct * 34.5} 34.5`}
            transform="rotate(-90 7 7)"
            opacity={0.9}
          />
        </svg>
      </span>
      <span style={{
        fontFamily: font.family,
        fontVariantNumeric: "tabular-nums",
        fontSize: font.size.body,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        color: low ? color.warning : color.text,
      }}>
        {balance.toLocaleString("pt-BR")}
      </span>
      <span style={{
        fontFamily: font.family,
        fontWeight: 400,
        fontSize: font.size.caption,
        color: color.text3,
        letterSpacing: "-0.01em",
      }}>
        crédito{balance === 1 ? "" : "s"}
      </span>
    </button>
  );
}
