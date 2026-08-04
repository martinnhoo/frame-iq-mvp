/**
 * GenerationStage — a espera, encenada onde a pessoa está olhando.
 *
 * Gerar uma imagem leva de 25 a 45 segundos. Nesse tempo o painel mostrava um
 * ícone girando e a palavra "Gerando…". Quarenta segundos de spinner é tempo
 * suficiente pra pessoa achar que travou, e o cancelamento no primeiro mês
 * nasce exatamente aí.
 *
 * O detalhe irônico: os estágios já existiam, escritos e traduzidos nas quatro
 * línguas — "Preparando" → "Chamando IA" → "Aplicando marca" → "Salvando".
 * Só que eram mandados pro sino da topbar, uma gaveta fechada. O momento em
 * que o produto trabalha na frente do cliente estava escondido.
 *
 * O esqueleto respeita a proporção escolhida: sem isso o layout pula quando a
 * imagem chega, e salto de layout no fim de uma espera longa lê como bug.
 */

import { useEffect, useState } from "react";
import { Check, Loader } from "lucide-react";
import { color, font, radius, space, motion } from "@/lib/design";

export type StageKey = "prep" | "ai" | "compose" | "save";

const ORDER: StageKey[] = ["prep", "ai", "compose", "save"];

export default function GenerationStage({
  stage,
  aspectRatio,
  labels,
}: {
  stage: StageKey;
  /** "1:1", "9:16", "4:5", "16:9" — define a proporção do esqueleto. */
  aspectRatio: string;
  labels: Record<StageKey, string>;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const idx = ORDER.indexOf(stage);

  const [w, h] = (aspectRatio || "1:1").split(":").map(Number);
  const ratio = w && h ? `${w} / ${h}` : "1 / 1";

  return (
    <div style={{
      border: `1px solid ${color.border}`,
      borderRadius: radius.lg,
      background: color.inset,
      padding: space[4],
      display: "flex",
      flexDirection: "column",
      gap: space[4],
    }}>
      {/* Esqueleto na proporção exata. O brilho que atravessa é a única
          animação — spinner girando não diz nada sobre progresso. */}
      <div style={{
        aspectRatio: ratio,
        width: "100%",
        maxHeight: "46vh",
        borderRadius: radius.md,
        background: `linear-gradient(100deg, ${color.surface} 30%, ${color.raised} 50%, ${color.surface} 70%)`,
        backgroundSize: "220% 100%",
        animation: "hubShimmer 1.8s ease-in-out infinite",
      }} />

      <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        {ORDER.map((k, i) => {
          const done = i < idx;
          const now = i === idx;
          return (
            <div key={k} style={{
              display: "flex", alignItems: "center", gap: space[2],
              fontSize: font.size.body,
              color: done ? color.text3 : now ? color.text : color.text3,
              opacity: !done && !now ? 0.45 : 1,
              transition: `opacity ${motion.base}, color ${motion.base}`,
            }}>
              <span style={{
                width: 16, height: 16, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {done
                  ? <Check size={13} color={color.success} />
                  : now
                    ? <Loader size={13} color={color.accent} style={{ animation: "spin 1s linear infinite" }} />
                    : <span style={{
                        width: 5, height: 5, borderRadius: radius.full,
                        background: color.text3, display: "block",
                      }} />}
              </span>
              <span style={{ fontWeight: now ? font.weight.medium : font.weight.regular }}>
                {labels[k]}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: font.size.caption, color: color.text3,
        borderTop: `1px solid ${color.border}`, paddingTop: space[3],
      }}>
        <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: font.mono }}>
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </span>
        <span>Costuma levar de 25 a 45 segundos</span>
      </div>

      <style>{`
        @keyframes hubShimmer {
          0%   { background-position: 180% 0; }
          100% { background-position: -80% 0; }
        }
      `}</style>
    </div>
  );
}
