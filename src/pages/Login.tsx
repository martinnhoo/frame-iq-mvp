import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import { trackEvent } from "@/lib/posthog";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setEmailLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        toast.error(language === "pt" ? "Confirme seu email antes de entrar." : language === "es" ? "Confirma tu email antes de iniciar sesión." : "Please confirm your email before signing in.");
        navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
      } else if (error.message.includes("Invalid login credentials")) {
        toast.error(language === "pt" ? "Email ou senha inválidos. Tente novamente." : language === "es" ? "Email o contraseña incorrectos. Inténtalo de nuevo." : "Invalid email or password. Please try again.");
      } else {
        toast.error(error.message);
      }
    } else {
      trackEvent("login_completed");
      navigate("/dashboard/ai");
    }
    setEmailLoading(false);
  };

  const isFormDisabled = loading || emailLoading;

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-8 sm:py-4 relative overflow-hidden"
    >
      {/* Animated orbs */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, hsla(199, 83%, 58%, 0.12) 0%, transparent 60%)', filter: 'blur(80px)', willChange: 'transform' }}
      />
      <div 
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsla(320, 80%, 60%, 0.1) 0%, transparent 60%)', filter: 'blur(80px)' }}
      />
      <div 
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsla(200, 80%, 60%, 0.06) 0%, transparent 60%)', filter: 'blur(60px)' }}
      />

      {/* Animated grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full pointer-events-none"
          style={{ background: i % 2 === 0 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)', left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
        />
      ))}

      <div className="fixed top-4 right-4 z-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
        </div>

        <div>
          <div style={{
            width: '100%',
            borderRadius: 20,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(14,165,233,0.35)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 64px rgba(0,0,0,0.5), 0 0 80px rgba(14,165,233,0.08)',
            backdropFilter: 'blur(24px)',
            padding: 'clamp(24px, 5vw, 36px) clamp(20px, 5vw, 32px)',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>{t("auth_login_title")}</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>{t("auth_login_subtitle")}</p>
            </div>

            {/* Google button */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={handleGoogleLogin}
                disabled={isFormDisabled}
                style={{
                  width: '100%', height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff', fontSize: 15, fontWeight: 600, cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={e => { if (!isFormDisabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}}
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
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{t("auth_email")}</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
                    type="email" placeholder="name@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required disabled={isFormDisabled}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 42, paddingRight: 16, boxSizing: 'border-box' as const,
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t("auth_password")}</label>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: '#38bdf8', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                    {t("auth_forgot")}
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required disabled={isFormDisabled}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 16, paddingRight: 48, boxSizing: 'border-box' as const,
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
              </div>

              {/* Submit */}
              <div>
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  style={{
                    width: '100%', height: 50, borderRadius: 12, border: 'none', cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                    background: isFormDisabled ? 'rgba(14,165,233,0.3)' : '#0ea5e9',
                    color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                    boxShadow: isFormDisabled ? 'none' : '0 4px 24px rgba(14,165,233,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {emailLoading && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                  {t("auth_signin")}
                </button>
              </div>
            </form>

            {/* Sign up link */}
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 20 }}>
              {t("auth_no_account")}{" "}
              <Link to="/signup" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                {t("auth_create")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
