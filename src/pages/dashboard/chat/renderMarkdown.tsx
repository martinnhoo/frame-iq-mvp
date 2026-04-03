import React from "react";
import { FONTS, COLORS } from "./constants";

// ── Inline formatter — **bold** e `code` ──────────────────────────────────────
function inlineFormat(str: string, idx: { n: number }): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = str;

  while (remaining.length > 0) {
    const boldMatch  = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*$)/s);
    const codeMatch  = remaining.match(/^(.*?)`([^`]+)`(.*$)/s);
    const hasBold    = boldMatch  != null;
    const hasCode    = codeMatch  != null;
    const boldFirst  = hasBold && (!hasCode || boldMatch![1].length <= (codeMatch![1]?.length ?? Infinity));

    if (boldFirst) {
      if (boldMatch![1]) parts.push(<span key={idx.n++}>{boldMatch![1]}</span>);
      parts.push(
        <strong key={idx.n++} style={{
          fontWeight: 700,
          color: "#fff",
          background: "rgba(14,165,233,0.12)",
          borderRadius: 3,
          padding: "0 3px",
        }}>
          {boldMatch![2]}
        </strong>
      );
      remaining = boldMatch![3];
    } else if (hasCode) {
      if (codeMatch![1]) parts.push(<span key={idx.n++}>{codeMatch![1]}</span>);
      parts.push(
        <code key={idx.n++} style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          background: "rgba(14,165,233,0.1)",
          border: "1px solid rgba(14,165,233,0.18)",
          borderRadius: 4,
          padding: "1px 5px",
          color: "#67e8f9",
        }}>
          {codeMatch![2]}
        </code>
      );
      remaining = codeMatch![3];
    } else {
      parts.push(<span key={idx.n++}>{remaining}</span>);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ── Main renderer ─────────────────────────────────────────────────────────────
export function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Normaliza escapes literais que vêm da API: \\n\\n → \n\n
  const normalized = text
    .replace(/\\n\\n/g, "\n\n")
    .replace(/\\n/g, "\n");

  const lines    = normalized.split("\n");
  const nodes: React.ReactNode[] = [];
  const listBuf: string[] = [];
  const idx      = { n: 0 };

  const flushList = (key: string) => {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={key} style={{ margin: "8px 0 12px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        {listBuf.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent, flexShrink: 0, marginTop: 8 }} />
            <span style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 1.7 }}>
              {inlineFormat(item, idx)}
            </span>
          </li>
        ))}
      </ul>
    );
    listBuf.length = 0;
  };

  lines.forEach((line, i) => {
    const t = line.trim();

    // ### heading
    if (/^###\s/.test(t)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, color: "rgba(14,165,233,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "16px 0 4px" }}>
          {t.replace(/^###\s/, "")}
        </p>
      );
      return;
    }

    // ## heading
    if (/^##\s/.test(t)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.02em", margin: "16px 0 6px" }}>
          {t.replace(/^##\s/, "")}
        </p>
      );
      return;
    }

    // bullet / numbered list
    if (/^[-*•]\s/.test(t)) { listBuf.push(t.replace(/^[-*•]\s/, "")); return; }
    if (/^\d+\.\s/.test(t)) { listBuf.push(t.replace(/^\d+\.\s/, "")); return; }

    // blank line — flush list, add spacing
    if (!t) { flushList(`fl-${i}`); return; }

    // paragraph
    flushList(`fl-${i}`);
    nodes.push(
      <p key={i} style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 1.75, margin: "0 0 10px" }}>
        {inlineFormat(t, idx)}
      </p>
    );
  });

  flushList("final");
  return nodes;
}
