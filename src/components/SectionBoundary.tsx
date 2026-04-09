import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Label shown in error — e.g. "Performance" or "IA Chat" */
  label?: string;
  /** Render compact inline error instead of full-height block */
  inline?: boolean;
}
interface State { error: Error | null; errorInfo: string }

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const context = this.props.label ? `[${this.props.label}]` : "[Section]";
    console.error(`AdBrief ${context}`, error, info.componentStack?.slice(0, 300));
    this.setState({ errorInfo: info.componentStack?.slice(0, 200) || "" });
  }

  reset = () => this.setState({ error: null, errorInfo: "" });

  render() {
    const { error } = this.state;
    const { label = "este bloco", inline = false, children } = this.props;

    if (!error) return children;

    if (inline) {
      return (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.18)",
        }}>
          <span style={{ fontSize: 12, color: "#f87171", flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Erro em {label} — <button onClick={this.reset}
              style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}>
              tentar novamente
            </button>
          </span>
        </div>
      );
    }

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "48px 24px", textAlign: "center",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Erro em {label}
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Algo inesperado aconteceu neste módulo. Os outros continuam funcionando normalmente.
        </p>
        <button onClick={this.reset} style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "8px 16px", borderRadius: 8, cursor: "pointer",
          background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)",
          color: "#38bdf8", fontSize: 13, fontWeight: 600,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <RefreshCw size={13} /> Tentar novamente
        </button>
      </div>
    );
  }
}
