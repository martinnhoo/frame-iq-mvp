import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const J = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const M = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

const STEPS_PT = [
  { label: "Autenticando com a Meta...", duration: 800 },
  { label: "Lendo suas campanhas...", duration: 900 },
  { label: "Analisando CTR, ROAS e spend...", duration: 1000 },
  { label: "Identificando criativos vencedores...", duration: 900 },
  { label: "Mapeando padrões de frequência...", duration: 800 },
  { label: "Calibrando a IA para seu mercado...", duration: 700 },
];
const STEPS_EN = [
  { label: "Authenticating with Meta...", duration: 800 },
  { label: "Reading your campaigns...", duration: 900 },
  { label: "Analyzing CTR, ROAS and spend...", duration: 1000 },
  { label: "Identifying winning creatives...", duration: 900 },
  { label: "Mapping frequency patterns...", duration: 800 },
  { label: "Calibrating AI to your market...", duration: 700 },
];
const STEPS_ES = [
  { label: "Autenticando con Meta...", duration: 800 },
  { label: "Leyendo tus campañas...", duration: 900 },
  { label: "Analizando CTR, ROAS y spend...", duration: 1000 },
  { label: "Identificando creativos ganadores...", duration: 900 },
  { label: "Mapeando patrones de frecuencia...", duration: 800 },
  { label: "Calibrando la IA a tu mercado...", duration: 700 },
];

export default function MetaOAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);

  // Detect language
  const stored = localStorage.getItem("adbrief_language") as "pt"|"en"|"es"|null;
  const lang = stored || "pt";
  const STEPS = lang === "en" ? STEPS_EN : lang === "es" ? STEPS_ES : STEPS_PT;

  const LABELS = {
    connecting: { pt: "Conectando Meta Ads", en: "Connecting Meta Ads", es: "Conectando Meta Ads" },
    connected:  { pt: "Meta Ads conectado", en: "Meta Ads connected", es: "Meta Ads conectado" },
    failed:     { pt: "Conexão falhou", en: "Connection failed", es: "Conexión fallida" },
    accounts:   { pt: "conta encontrada", en: "account found", es: "cuenta encontrada" },
    accountsP:  { pt: "contas encontradas", en: "accounts found", es: "cuentas encontradas" },
    insight:    { pt: "A IA já conhece sua conta.", en: "The AI already knows your account.", es: "La IA ya conoce tu cuenta." },
    cta:        { pt: "Ver o que a IA encontrou →", en: "See what the AI found →", es: "Ver lo que encontró la IA →" },
    error_back: { pt: "Voltando...", en: "Going back...", es: "Volviendo..." },
  };
  const L = (k: keyof typeof LABELS) => LABELS[k][lang];

  // Animate loading steps
  useEffect(() => {
    if (status !== "loading") return;
    let idx = 0;
    const advance = () => {
      if (idx < STEPS.length - 1) {
        idx++;
        setStepIdx(idx);
        setTimeout(advance, STEPS[idx].duration);
      }
    };
    setTimeout(advance, STEPS[0].duration);
  }, [status]);

  // OAuth exchange
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error || !code || !state) {
        setStatus("error");
        setTimeout(() => navigate("/dashboard/ai"), 3000);
        return;
      }

      try {
        const stateData = JSON.parse(atob(state));
        const userId = stateData.user_id;
        if (!userId) throw new Error("Invalid state");

        const { data, error: fnError } = await supabase.functions.invoke("meta-oauth", {
          body: { action: "exchange_code", code, user_id: userId, state },
        });

        if (fnError) throw fnError;
        if (data.error) throw new Error(data.error);

        setAccounts(data.ad_accounts || []);
        // Wait for step animation to finish before showing success
        setTimeout(() => {
          setStatus("success");
          setDone(true);
        }, 400);
      } catch (e: any) {
        setStatus("error");
        setTimeout(() => navigate("/dashboard/ai"), 3000);
      }
    };

    run();
  }, []);

  const progress = status === "success" ? 100 : Math.round((stepIdx / (STEPS.length - 1)) * 90);

  return (
    <div style={{ minHeight: "100vh", background: "#07080f", display: "flex", alignItems: "center", justifyContent: "center", ...J, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>
            <span style={{ color: "#0ea5e9" }}>ad</span>brief
          </span>
        </div>

        {/* Main card */}
        <div style={{ borderRadius: 24, border: `1px solid ${status === "error" ? "rgba(248,113,113,0.2)" : status === "success" ? "rgba(52,211,153,0.25)" : "rgba(14,165,233,0.15)"}`, background: "rgba(255,255,255,0.025)", padding: "32px 28px", transition: "border-color 0.5s" }}>

          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: status === "success" ? "rgba(52,211,153,0.12)" : status === "error" ? "rgba(248,113,113,0.10)" : "rgba(14,165,233,0.10)", border: `1px solid ${status === "success" ? "rgba(52,211,153,0.3)" : status === "error" ? "rgba(248,113,113,0.25)" : "rgba(14,165,233,0.2)"}`, transition: "all 0.5s" }}>
              {status === "loading" && (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: "spin 1.2s linear infinite" }}>
                  <circle cx="11" cy="11" r="9" stroke="rgba(14,165,233,0.2)" strokeWidth="2.5"/>
                  <path d="M11 2a9 9 0 0 1 9 9" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
              {status === "success" && <span style={{ fontSize: 22 }}>✓</span>}
              {status === "error" && <span style={{ fontSize: 22 }}>✕</span>}
            </div>
            <div>
              <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Meta Ads</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>
                {status === "loading" && L("connecting")}
                {status === "success" && L("connected")}
                {status === "error" && L("failed")}
              </h2>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 24, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, width: `${progress}%`, background: status === "error" ? "#f87171" : status === "success" ? "#34d399" : "#0ea5e9", transition: "width 0.6s ease, background 0.5s" }} />
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {STEPS.map((step, i) => {
              const isActive = i === stepIdx && status === "loading";
              const isDone = status === "success" || i < stepIdx;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isDone ? 1 : isActive ? 1 : 0.28, transition: "opacity 0.4s" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "rgba(52,211,153,0.15)" : isActive ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${isDone ? "rgba(52,211,153,0.4)" : isActive ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.4s" }}>
                    {isDone
                      ? <span style={{ fontSize: 9, color: "#34d399" }}>✓</span>
                      : isActive
                      ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1s ease-in-out infinite" }} />
                      : <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
                    }
                  </div>
                  <span style={{ ...M, fontSize: 12, color: isDone ? "rgba(255,255,255,0.7)" : isActive ? "#e2f4ff" : "rgba(255,255,255,0.35)", transition: "color 0.4s" }}>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Success content */}
          {status === "success" && (
            <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
              {/* Accounts found */}
              {accounts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ ...M, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    {accounts.length} {accounts.length === 1 ? L("accounts") : L("accountsP")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {accounts.slice(0, 3).map((acc: any) => (
                      <div key={acc.id} style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
                        <span style={{ ...J, fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{acc.name || acc.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI insight pill */}
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, animation: "pulse 2s ease-in-out infinite" }} />
                <p style={{ ...J, fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>{L("insight")}</p>
              </div>

              {/* CTA */}
              <button
                onClick={() => navigate("/dashboard/ai")}
                style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", border: "none", color: "#000", fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: "-0.01em", ...J, boxShadow: "0 0 32px rgba(14,165,233,0.3)", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 48px rgba(14,165,233,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 32px rgba(14,165,233,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                {L("cta")}
              </button>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <p style={{ ...M, fontSize: 11, color: "rgba(248,113,113,0.7)", textAlign: "center" }}>{L("error_back")}</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
