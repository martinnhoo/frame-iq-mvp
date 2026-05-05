/**
 * CollapsibleSection — accordion compacto pra agrupar configurações.
 *
 * Mostra um header clicável com label + summary (à direita) + chevron.
 * Click expande as opções abaixo. Estilo premium discreto, sem bordas
 * coloridas a não ser o accent azul quando aberto.
 *
 * Caso de uso: encolher Brand+Logo, Format+Quality, etc. em sections
 * fechadas por padrão pra economizar vertical, e abrir só o que o
 * user quer mexer no momento.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  label: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Visual accent quando ativo/highlight */
  accent?: boolean;
}

export function CollapsibleSection({ label, summary, defaultOpen = false, children, accent }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: 12,
      background: open
        ? (accent ? "rgba(59,130,246,0.05)" : "rgba(17,24,39,0.70)")
        : "rgba(17,24,39,0.50)",
      border: `1px solid ${open
        ? (accent ? "rgba(59,130,246,0.30)" : "rgba(255,255,255,0.10)")
        : "rgba(255,255,255,0.06)"}`,
      transition: "all 0.18s",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          color: "inherit", textAlign: "left",
        }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
          color: "#9CA3AF", textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {label}
        </span>
        {summary && (
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            fontSize: 12.5, color: "#FFFFFF", fontWeight: 600,
            gap: 6, flexWrap: "wrap",
          }}>
            {summary}
          </div>
        )}
        <ChevronDown
          size={15}
          style={{
            color: "#9CA3AF", flexShrink: 0,
            transition: "transform 0.18s",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        />
      </button>
      {open && (
        <div style={{
          padding: "0 14px 14px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
