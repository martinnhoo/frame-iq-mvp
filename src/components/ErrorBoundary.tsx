import { Component, type ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

const T = {
  pt: { title: "Algo deu errado", sub: "Ocorreu um erro inesperado nesta página. Tente novamente ou recarregue.", retry: "Tentar novamente" },
  en: { title: "Something went wrong", sub: "An unexpected error occurred on this page. Try again or reload.", retry: "Try again" },
  es: { title: "Algo salió mal", sub: "Ocurrió un error inesperado en esta página. Inténtalo de nuevo o recarga.", retry: "Intentar de nuevo" },
};

function getLang(): "pt" | "en" | "es" {
  try {
    let stored = ""; try { stored = localStorage.getItem("adbrief_language") || localStorage.getItem("language") || ""; } catch {}
    if (stored.startsWith("pt")) return "pt";
    if (stored.startsWith("es")) return "es";
    const browser = navigator.language || "";
    if (browser.startsWith("pt")) return "pt";
    if (browser.startsWith("es")) return "es";
  } catch {}
  return "en";
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AdBrief ErrorBoundary]", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const t = T[getLang()];

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", padding: "40px 24px", fontFamily: "'Inter', sans-serif", textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: "rgba(239,68,68,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <AlertTriangle size={22} color="#ef4444" />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#fff" }}>
          {t.title}
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 360, lineHeight: 1.6 }}>
          {t.sub}
        </p>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px",
            background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)",
            borderRadius: 8, color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <RefreshCw size={14} /> {t.retry}
        </button>
      </div>
    );
  }
}
