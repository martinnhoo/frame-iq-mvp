import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, User } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import { trackEvent } from "@/lib/posthog";

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan"); // e.g. "maker", "pro", "studio"
  const billingParam = searchParams.get("billing"); // "annual" | null
  const redirectParam = searchParams.get("redirect"); // e.g. "/demo?unlocked=1"
  const { t, language } = useLanguage();

  const handleGoogleSignup = async () => {
    setLoading(true);
    // If coming from demo flow, redirect to /dashboard/ai?from_demo=1 after OAuth
    const oauthRedirect = redirectParam
      ? window.location.origin + redirectParam
      : window.location.origin + "/dashboard";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: oauthRedirect,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) return;

    if (password.length < 8) {
      toast.error(language === "pt" ? "A senha deve ter pelo menos 8 caracteres." : language === "es" ? "La contraseña debe tener al menos 8 caracteres." : "Password must be at least 8 characters.");
      return;
    }

    setEmailLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error(language === "pt" ? "Este email já está cadastrado. Tente entrar." : language === "es" ? "Este email ya está registrado. Intenta iniciar sesión." : "This email is already registered. Try signing in instead.");
      } else {
        toast.error(error.message);
      }
      setEmailLoading(false);
    } else {
      // Send branded confirmation email (non-blocking)
      // Always redirects to /email-confirmed — never to demo or onboarding
      supabase.functions.invoke("send-confirmation-email", {
        body: { email: email.trim(), name: name.trim(), language },
      }).catch(() => {}); // fire-and-forget

      // Go directly to onboarding (no blocking email confirmation)
      const billingQuery = billingParam ? `&billing=${billingParam}` : '';
      const redirectQuery = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
      const redirectUrl = planParam ? `/onboarding?checkout=${planParam}${billingQuery}${redirectQuery}` : `/onboarding?${redirectQuery.replace('&', '')}`;
      trackEvent("signup_completed", { plan: planParam || "free" });
      navigate(redirectUrl);
      setEmailLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
      { label: t("pw_weak"), color: "bg-destructive" },
      { label: t("pw_fair"), color: "bg-yellow-500" },
      { label: t("pw_good"), color: "bg-blue-500" },
      { label: t("pw_strong"), color: "bg-green-500" },
    ];
    return { score, ...levels[Math.min(score, levels.length) - 1] };
  };

  const strength = passwordStrength();
  const isFormDisabled = loading || emailLoading;

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-8 sm:py-4 relative overflow-hidden"
    >
      {/* Animated orbs */}
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, hsla(199, 83%, 58%, 0.12) 0%, transparent 60%)', filter: 'blur(80px)' }} />
      <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, hsla(320, 80%, 60%, 0.1) 0%, transparent 60%)', filter: 'blur(80px)' }}   />
      <div className="absolute w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, hsla(180, 70%, 50%, 0.05) 0%, transparent 60%)', filter: 'blur(60px)' }}   />

      {/* Animated grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full pointer-events-none" style={{ background: i % 2 === 0 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)', left: `${20 + i * 12}%`, top: `${15 + (i % 3) * 30}%`, opacity: 0.4 }} />
      ))}

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
        </div>

        <div>
          {/* Card — glass with bright border and light inner background */}
          <div style={{
            width: '100%',
            borderRadius: 20,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(14,165,233,0.35)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 64px rgba(0,0,0,0.5), 0 0 80px rgba(14,165,233,0.08)',
            backdropFilter: 'blur(24px)',
            padding: 'clamp(24px, 5vw, 36px) clamp(20px, 5vw, 32px) clamp(24px, 5vw, 32px)',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              {planParam && (
                <div style={{ marginBottom: 16, padding: '8px 16px', borderRadius: 10, background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', fontSize: 13, fontWeight: 600, display: 'inline-block' }}>
                   Starting with <span style={{ textTransform: 'capitalize' }}>{planParam}</span> plan
                </div>
              )}
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>{t("auth_signup_title")}</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>{t("auth_signup_subtitle")}</p>
            </div>

            {/* Google button */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={handleGoogleSignup}
                disabled={isFormDisabled}
                style={{
                  width: '100%', height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff', fontSize: 15, fontWeight: 600, cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={e => { if (!isFormDisabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {t("auth_google")}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t("auth_or_email")}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{t("auth_name")}</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
                    type="text" placeholder={t("auth_name_placeholder")} autoComplete="name"
                    value={name} onChange={e => setName(e.target.value)} required disabled={isFormDisabled}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 42, paddingRight: 16, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#ffffff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.6)'; e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{t("auth_email")}</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
                    type="email" placeholder="name@example.com" autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)} required disabled={isFormDisabled}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 42, paddingRight: 16, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#ffffff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.6)'; e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{t("auth_password")}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" autoComplete="new-password"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={8} disabled={isFormDisabled}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 16, paddingRight: 48, boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#ffffff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.6)'; e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                    {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
                {/* Strength indicator */}
                {password && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      {[1, 2, 3, 4].map(level => (
                        <div key={level} style={{
                          height: 3, flex: 1, borderRadius: 99,
                          background: level <= strength.score
                            ? (strength.score === 1 ? '#ef4444' : strength.score === 2 ? '#eab308' : strength.score === 3 ? '#3b82f6' : '#22A3A3')
                            : 'rgba(255,255,255,0.1)',
                          transition: 'background 0.3s'
                        }} />
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      {t("pw_strength")}: <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div>
                <button
                  type="submit"
                  disabled={isFormDisabled || password.length < 8}
                  style={{
                    width: '100%', height: 50, borderRadius: 12, border: 'none', cursor: isFormDisabled || password.length < 8 ? 'not-allowed' : 'pointer',
                    background: isFormDisabled || password.length < 8
                      ? 'rgba(14,165,233,0.3)'
                      : 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                    color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                    boxShadow: isFormDisabled || password.length < 8 ? 'none' : '0 4px 24px rgba(14,165,233,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {emailLoading && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                  {t("auth_create")}
                </button>
              </div>

              {/* Trust bar */}
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0, lineHeight: 1.6 }}>
                {t("auth_trust")}
              </p>
            </form>

            {/* Legal */}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 16, lineHeight: 1.6 }}>
              {t("auth_legal")}{" "}
              <Link to="/terms" style={{ color: '#38bdf8', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{t("auth_legal_terms")}</Link>
              {" "}{t("auth_legal_and")}{" "}
              <Link to="/privacy" style={{ color: '#38bdf8', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{t("auth_legal_privacy")}</Link>.
            </p>

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 12 }}>
              {t("auth_has_account")}{" "}
              <Link to="/login" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>{t("auth_signin")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
