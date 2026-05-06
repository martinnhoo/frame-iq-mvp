/**
 * Signup — invite-only.
 *
 * AdBrief virou portal interno: cadastro só com código de convite
 * pré-distribuído. Edge function `claim-invite-code` valida e cria a
 * conta atomicamente. Sem código válido = sem conta.
 *
 * Removido: Google OAuth (não tem como exigir código no fluxo OAuth
 * sem caixinha de surpresas), Pixel/CAPI tracking (não há campanha
 * Meta rodando pra conversão), email-guard (códigos já filtram bots),
 * planParam/billing/redirect/ref (não tem mais funil pago).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, User, Key } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const tr = (pt: string, en: string, es?: string, zh?: string) =>
    language === "pt" ? pt : language === "es" ? (es || en) : language === "zh" ? (zh || en) : en;

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim() || !code.trim()) return;

    if (password.length < 8) {
      toast.error(tr("Senha deve ter ao menos 8 caracteres.", "Password must be at least 8 characters.", "La contraseña debe tener al menos 8 caracteres.", "密码至少需要8个字符。"));
      return;
    }

    setLoading(true);

    // Edge function valida código + cria conta atomicamente.
    // Usa fetch direto em vez de supabase.functions.invoke porque o invoke
    // do supabase-js, quando a função retorna 4xx/5xx, joga o body em
    // error.context (Response object) e zera o data — o que fazia o frontend
    // perder o errCode específico ('invalid_code', 'email_taken' etc) e cair
    // no fallback genérico. Com fetch direto, parseamos o body manualmente
    // pra todos os status.
    let result: { ok?: boolean; error?: string; message?: string } | null = null;
    let httpStatus = 0;
    try {
      const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const r = await fetch(`${SUPA_URL}/functions/v1/claim-invite-code`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        }),
      });
      httpStatus = r.status;
      const text = await r.text();
      try { result = JSON.parse(text); } catch { /* not json — server crashed */ }
    } catch (netErr) {
      console.error("[signup] network error:", netErr);
    }

    if (!result?.ok) {
      const errCode = result?.error || (httpStatus === 0 ? "network" : "unknown");
      let msg: string;
      if (errCode === "invalid_code") {
        msg = tr("Código de convite inválido ou já utilizado.", "Invalid or already-used invite code.", "Código de invitación inválido o ya utilizado.", "邀请码无效或已被使用。");
      } else if (errCode === "email_taken") {
        msg = tr("Este email já está cadastrado.", "This email is already registered.", "Este email ya está registrado.", "此邮箱已注册。");
      } else if (errCode === "weak_password") {
        msg = tr("Senha deve ter ao menos 8 caracteres.", "Password must be at least 8 characters.", "La contraseña debe tener al menos 8 caracteres.", "密码至少需要8个字符。");
      } else if (errCode === "network") {
        msg = tr("Falha de conexão. Verifica sua internet e tenta de novo.", "Connection failed. Check your internet and try again.", "Error de conexión. Verifica tu internet e intenta de nuevo.", "连接失败。请检查您的网络后重试。");
      } else {
        msg = result?.message || tr("Falha ao criar conta. Tenta de novo.", "Failed to create account. Try again.", "Error al crear cuenta. Intenta de nuevo.", "创建账号失败，请重试。");
      }
      toast.error(msg);
      setLoading(false);
      return;
    }

    // Conta criada. Faz login imediato com as credenciais.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInErr) {
      toast.success(tr("Conta criada. Faça login pra continuar.", "Account created. Sign in to continue.", "Cuenta creada. Inicia sesión para continuar.", "账号已创建，请登录继续。"));
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
                {tr("Acesso por convite. Use o código que recebeu.", "Invite-only. Use the code you received.", "Acceso por invitación. Usa el código que recibiste.", "仅限邀请。请使用您收到的邀请码。")}
              </p>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Invite code — destacado, primeiro campo */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(56,189,248,0.85)', marginBottom: 8, letterSpacing: '0.02em' }}>
                  {tr("Código de convite", "Invite code", "Código de invitación", "邀请码")}
                </label>
                <div style={{ position: 'relative' }}>
                  <Key style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(56,189,248,0.6)' }} />
                  <input
                    type="text"
                    placeholder="BRILL-XXXX-XXXX"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    required
                    disabled={isFormDisabled}
                    autoCapitalize="characters"
                    spellCheck={false}
                    style={{
                      width: '100%', height: 48, borderRadius: 12, paddingLeft: 42, paddingRight: 16, boxSizing: 'border-box',
                      background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.30)',
                      color: '#ffffff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '0.04em',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.7)'; e.currentTarget.style.background = 'rgba(14,165,233,0.10)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.30)'; e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  {tr("Nome", "Name", "Nombre", "姓名")}
                </label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)' }} />
                  <input
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Email</label>
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  {tr("Senha", "Password", "Contraseña", "密码")}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
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
