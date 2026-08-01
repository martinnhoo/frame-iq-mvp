/**
 * Signup — aberto ao público (Creative Hub).
 *
 * Cadastro livre por email/senha ou Google. O gate de código de convite
 * foi removido: qualquer pessoa pode criar conta.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, User } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const tr = (pt: string, en: string, es?: string, zh?: string) =>
    language === "pt" ? pt : language === "es" ? (es || en) : language === "zh" ? (zh || en) : en;

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard/hub",
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(result.error.message);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard/hub");
    } catch (e) {
      toast.error(String(e).slice(0, 100));
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) return;

    if (password.length < 8) {
      toast.error(tr("Senha deve ter ao menos 8 caracteres.", "Password must be at least 8 characters.", "La contraseña debe tener al menos 8 caracteres.", "密码至少需要8个字符。"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard/hub`,
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      const isDup = /already|registered|exists/i.test(error.message);
      toast.error(
        isDup
          ? tr("Este email já está cadastrado.", "This email is already registered.", "Este email ya está registrado.", "此邮箱已注册。")
          : error.message
      );
      setLoading(false);
      return;
    }

    // Se o projeto exigir confirmação de email, não haverá sessão ativa.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.success(tr("Conta criada. Confirme seu email para continuar.", "Account created. Confirm your email to continue.", "Cuenta creada. Confirma tu email para continuar.", "账号已创建，请确认邮箱后继续。"));
      navigate("/login");
      return;
    }

    toast.success(tr("Bem-vindo!", "Welcome!", "¡Bienvenido!", "欢迎！"));
    navigate("/dashboard/hub");
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
  const isFormDisabled = loading;

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

      {/* fixed em vez de absolute — no mobile o form é maior que o
          viewport e o ancestral 'absolute' deixava o switcher fora
          da tela. fixed mantém top-right do viewport sempre. */}
      <div className="fixed top-4 right-4 z-50" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center">
          <Logo size="lg" />
        </div>

        <div>
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
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
                {tr("Criar conta", "Create account", "Crear cuenta", "创建账号")}
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
                {tr("Crie sua conta e comece a gerar criativos.", "Create your account and start generating creatives.", "Crea tu cuenta y empieza a generar creativos.", "创建账号，开始生成创意。")}
              </p>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              style={{
                width: '100%', height: 48, borderRadius: 12, marginBottom: 20,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              {tr("Continuar com Google", "Continue with Google", "Continuar con Google", "使用 Google 继续")}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{tr("ou", "or", "o", "或")}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>


              {/* Name */}
              <div>
                <label htmlFor="signup-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  {tr("Nome", "Name", "Nombre", "姓名")}
                </label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
                    id="signup-name"
                    type="text"
                    placeholder={tr("Seu nome", "Your name", "Tu nombre", "您的姓名")}
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    disabled={isFormDisabled}
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
                <label htmlFor="signup-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
                    id="signup-email"
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
                <label htmlFor="signup-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  {tr("Senha", "Password", "Contraseña", "密码")}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tr("Mín. 8 caracteres", "Min. 8 characters", "Mín. 8 caracteres", "至少8个字符")}
                    autoComplete="new-password"
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                    {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
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
                  disabled={isFormDisabled || password.length < 8 || !code.trim()}
                  style={{
                    width: '100%', height: 50, borderRadius: 12, border: 'none',
                    cursor: isFormDisabled || password.length < 8 || !code.trim() ? 'not-allowed' : 'pointer',
                    background: isFormDisabled || password.length < 8 || !code.trim()
                      ? 'rgba(14,165,233,0.3)'
                      : 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                    color: '#ffffff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                    boxShadow: isFormDisabled || password.length < 8 || !code.trim() ? 'none' : '0 4px 24px rgba(14,165,233,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {loading && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
                  {tr("Criar conta", "Create account", "Crear cuenta", "创建账号")}
                </button>
              </div>
            </form>

            {/* Legal */}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 20, lineHeight: 1.6 }}>
              {tr("Ao criar conta você concorda com nossos", "By creating an account you agree to our", "Al crear cuenta aceptas nuestros", "创建账号即表示您同意我们的")}{" "}
              <Link to="/terms" style={{ color: '#38bdf8', textDecoration: 'none' }}>{tr("Termos", "Terms", "Términos", "条款")}</Link>
              {" "}{tr("e", "and", "y", "和")}{" "}
              <Link to="/privacy" style={{ color: '#38bdf8', textDecoration: 'none' }}>{tr("Privacidade", "Privacy", "Privacidad", "隐私政策")}</Link>.
            </p>

            {/* Sign in link */}
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 12 }}>
              {tr("Já tem conta?", "Already have an account?", "¿Ya tienes cuenta?", "已有账号？")}{" "}
              <Link to="/login" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
                {tr("Entrar", "Sign in", "Iniciar sesión", "登录")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
