import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const J = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const M = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

export default function MetaOAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your Meta account...");
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage("Meta connection was cancelled or denied.");
        setTimeout(() => navigate("/dashboard/ai"), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Invalid callback — missing code or state.");
        setTimeout(() => navigate("/dashboard/ai"), 3000);
        return;
      }

      try {
        // Decode state to get user_id
        const stateData = JSON.parse(atob(state));
        const userId = stateData.user_id;

        if (!userId) throw new Error("Invalid state parameter");

        setMessage("Exchanging token with Meta...");

        const { data, error: fnError } = await supabase.functions.invoke("meta-oauth", {
          body: { action: "exchange_code", code, user_id: userId, state },
        });

        if (fnError) throw fnError;
        if (data.error) throw new Error(data.error);

        setStatus("success");
        setAccounts(data.ad_accounts || []);
        const accountCount = data.ad_accounts?.length || 0;
        setMessage(`Meta conectado! ${accountCount} conta${accountCount !== 1 ? "s" : ""} encontrada${accountCount !== 1 ? "s" : ""}.`);
        // Don't auto-redirect — show summary and let user continue
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Connection failed. Please try again.");
        setTimeout(() => navigate("/dashboard/ai"), 3500);
      }
    };

    run();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#07080f", display: "flex", alignItems: "center", justifyContent: "center", ...J }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 32 }}>

        {/* Icon */}
        <div style={{ width: 64, height: 64, borderRadius: 18, background: status === "success" ? "rgba(52,211,153,0.1)" : status === "error" ? "rgba(248,113,113,0.1)" : "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {status === "loading" && <Loader2 size={28} color="#0ea5e9" className="animate-spin" />}
          {status === "success" && <CheckCircle2 size={28} color="#34d399" />}
          {status === "error" && <XCircle size={28} color="#f87171" />}
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>
          {status === "loading" && "Conectando Meta"}
          {status === "success" && "Meta Conectado ✓"}
          {status === "error" && "Conexão falhou"}
        </h2>

        {/* Message */}
        <p style={{ ...M, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 16 }}>
          {message}
        </p>

        {/* Ad accounts list on success */}
        {status === "success" && accounts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {accounts.slice(0, 3).map((acc: any) => (
              <div key={acc.id} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: acc.account_status === 1 ? "#34d399" : "#f87171" }} />
                <span style={{ ...J, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{acc.name || acc.id}</span>
              </div>
            ))}
          </div>
        )}

        {/* Optional video upload hint — only on success */}
        {status === "success" && (
          <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* What the AI is doing now */}
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", textAlign: "left" }}>
              <p style={{ ...J, fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 6 }}>
                🧠 Analisando seus últimos 90 dias...
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  "Identificando criativos vencedores e perdedores",
                  "Mapeando padrões de CTR, ROAS e frequência",
                  "Calibrando a IA para o seu mercado específico",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ ...M, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
                Quando você abrir o chat, a IA já vai saber o que funcionou e o que não funcionou na sua conta.
              </p>
            </div>
          </div>
        )}

        {/* CTAs */}
        {status === "success" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => navigate("/dashboard/ai")}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", border: "none", color: "#000", fontSize: 14, fontWeight: 800, cursor: "pointer", ...J }}>
              Ver o que a IA encontrou →
            </button>
          </div>
        )}

        {status === "loading" && (
          <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
            Analisando histórico da conta...
          </p>
        )}
      </div>
    </div>
  );
}
