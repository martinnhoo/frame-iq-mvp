import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Eye, EyeOff, CheckCircle, ShieldAlert, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
      <span style={{ fontFamily: F, fontWeight: 900, fontSize: 18, letterSpacing: "-0.04em", color: "#fff" }}>
        ad<span style={{ color: "#0ea5e9" }}>brief</span>
      </span>
    </a>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "", color: "#ef4444" },
    { label: "", color: "#f59e0b" },
    { label: "", color: "#3b82f6" },
    { label: "", color: "#22c55e" },
  ];
  const l = levels[Math.min(score, 4) - 1] || levels[0];
  return { score, color: l.color };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase sends token_hash in the URL — we need to exchange it
    // The onAuthStateChange fires PASSWORD_RECOVERY when the token is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setChecking(false);
      } else if (event === "SIGNED_IN" && session) {
        // Also valid — user signed in via magic link
        setIsRecovery(true);
        setChecking(false);
      }
    });

    // Check URL for recovery type (older Supabase versions)
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash.includes("type=recovery") || params.get("type") === "recovery") {
      setIsRecovery(true);
      setChecking(false);
    }

    // Give Supabase 2s to process the token from the URL
    const timeout = setTimeout(() => setChecking(false), 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const strength = getStrength(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      // Show error inline
      setErrorMsg(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/dashboard/ai"), 3000);
    }
  };

  const [errorMsg, setErrorMsg] = useState("");

  // ── Loading check ──────────────────────────────────────────────────────────
  if (checking) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Loader2 size={28} style={{ color: "#0ea5e9", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
            {language === "pt" ? "Verificando link..." : language === "es" ? "Verificando enlace..." : "Verifying link..."}
          </p>
        </div>
      </Page>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle size={28} style={{ color: "#22c55e" }} />
          </div>
          <h2 style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.03em" }}>
            {t("reset_success_title")}
          </h2>
          <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 20 }}>
            {t("reset_success_text")}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Loader2 size={14} style={{ color: "rgba(255,255,255,0.3)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              {language === "pt" ? "Redirecionando..." : language === "es" ? "Redirigiendo..." : "Redirecting..."}
            </span>
          </div>
        </div>
      </Page>
    );
  }

  // ── Invalid link ──────────────────────────────────────────────────────────
  if (!isRecovery) {
    return (
      <Page>
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <ShieldAlert size={28} style={{ color: "#ef4444" }} />
          </div>
          <h2 style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.03em" }}>
            {t("reset_invalid_title")}
          </h2>
          <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 24 }}>
            {t("reset_invalid_text")}
          </p>
          <Link to="/forgot-password" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px", borderRadius: 10, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#0ea5e9", textDecoration: "none", fontFamily: F, fontSize: 13, fontWeight: 600 }}>
            {t("reset_invalid_btn")} <ArrowRight size={14} />
          </Link>
        </div>
      </Page>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <Page>
      {/* Icon */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, rgba(14,165,233,0.15), rgba(99,102,241,0.15))", border: "1px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldCheck size={24} style={{ color: "#0ea5e9" }} />
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", marginBottom: 8 }}>
          {t("reset_title")}
        </h1>
        <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
          {t("reset_subtitle")}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* New password */}
        <div>
          <label style={{ display: "block", fontFamily: M, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}>
            {t("reset_new_pw")}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); setErrorMsg(""); }}
              placeholder="••••••••"
              required
              minLength={8}
              autoFocus
              style={{ width: "100%", padding: "12px 44px 12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", fontFamily: M, fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => { e.target.style.borderColor = "rgba(14,165,233,0.4)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: 0 }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength bar */}
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)", transition: "background 0.2s" }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  {t("pw_strength")}
                </span>
                <span style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: strength.color }}>
                  {strength.score === 1 ? t("pw_weak") : strength.score === 2 ? t("pw_fair") : strength.score === 3 ? t("pw_good") : t("pw_strong")}
                </span>
              </div>
              {password.length < 8 && (
                <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  {language === "pt" ? "Mínimo 8 caracteres" : language === "es" ? "Mínimo 8 caracteres" : "Minimum 8 characters"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label style={{ display: "block", fontFamily: M, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}>
            {t("reset_confirm_pw")}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErrorMsg(""); }}
              placeholder="••••••••"
              required
              style={{ width: "100%", padding: "12px 44px 12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${mismatch ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.10)"}`, color: "#fff", fontFamily: M, fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => { if (!mismatch) e.target.style.borderColor = "rgba(14,165,233,0.4)"; }}
              onBlur={e => { if (!mismatch) e.target.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: 0 }}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mismatch && (
            <p style={{ fontFamily: M, fontSize: 11, color: "#ef4444", marginTop: 5 }}>{t("reset_no_match")}</p>
          )}
          {confirm.length > 0 && !mismatch && (
            <p style={{ fontFamily: M, fontSize: 11, color: "#22c55e", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle size={10} /> {language === "pt" ? "Senhas iguais" : language === "es" ? "Contraseñas iguales" : "Passwords match"}
            </p>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p style={{ fontFamily: M, fontSize: 13, color: "#f87171", margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{ width: "100%", padding: "13px", borderRadius: 11, background: canSubmit ? "linear-gradient(135deg, #0ea5e9, #6366f1)" : "rgba(255,255,255,0.06)", color: canSubmit ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: F, fontSize: 15, fontWeight: 700, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: canSubmit ? "0 0 24px rgba(14,165,233,0.2)" : "none", transition: "all 0.2s", letterSpacing: "-0.02em" }}
        >
          {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : t("reset_submit")}
        </button>

        {/* Back link */}
        <div style={{ textAlign: "center" }}>
          <Link to="/login" style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}
          >
            {language === "pt" ? "← Voltar para o login" : language === "es" ? "← Volver al inicio" : "← Back to login"}
          </Link>
        </div>
      </form>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #131929 inset !important; -webkit-text-fill-color: #fff !important; }
      `}</style>
    </Page>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #080c14 0%, #0b1020 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(14,165,233,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <Logo />
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
