// Onboarding v3 — $1B Experience
// 3 passos: Quem você é → Como funciona → Conectar
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, Shield, Eye, Zap, TrendingUp, Lock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";
const BG = "#07080f";
const CARD = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.08)";
const BLUE = "#0ea5e9";

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  pt: {
    skip: "Pular",
    continue: "Continuar",
    back: "Voltar",
    step: "Passo",
    of: "de",
    // Step 1
    s1_tag: "VAMOS COMEÇAR",
    s1_title: "Como quer que a IA\nte chame?",
    s1_sub: "E qual mercado você gerencia? A IA usa isso para personalizar cada resposta.",
    s1_name_label: "Seu nome (opcional)",
    s1_name_ph: "Ex: Martinho",
    s1_niche: "Seu mercado principal",
    s1_terms: "Concordo com os",
    s1_terms_and: "e a",
    s1_terms_link: "Termos de Uso",
    s1_privacy_link: "Política de Privacidade",
    // Step 2
    s2_tag: "COMO A IA FUNCIONA",
    s2_title: "Não é o ChatGPT.\nÉ a inteligência da sua conta.",
    s2_sub: "Veja a diferença entre uma resposta genérica e uma baseada nos seus dados reais.",
    s2_generic_label: "IA genérica",
    s2_generic: "\"Tente testar novos criativos e ajustar seu público-alvo para melhorar os resultados...\"",
    s2_adbrief_label: "AdBrief com sua conta",
    s2_adbrief: "\"Creative_042 está com CTR 0.8% — 3× abaixo do seu histórico. CPM subiu 38% esta semana. Pause agora antes de queimar mais verba.\"",
    s2_what_label: "O que a IA lê em tempo real:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM, CPA de cada anúncio" },
      { icon: "📈", text: "Histórico de 90 dias da sua conta" },
      { icon: "🧠", text: "Padrões vencedores e perdedores" },
      { icon: "💸", text: "Onde o dinheiro está sendo queimado" },
    ],
    // Step 3
    s3_tag: "ÚLTIMO PASSO",
    s3_title: "Conecte o Meta Ads.\nVeja os seus dados em segundos.",
    s3_sub: "Usamos OAuth oficial do Meta — o mesmo que agências usam. Só leitura. Nunca gastamos, publicamos ou mudamos nada sem você confirmar.",
    s3_security: ["Somente leitura", "Revogue quando quiser", "Criptografia SSL", "Seus dados, só você"],
    s3_connect: "Conectar Meta Ads",
    s3_connecting: "Redirecionando para o Meta...",
    s3_skip: "Conectar depois",
    s3_skip_sub: "Você pode conectar a qualquer momento em Contas",
  },
  en: {
    skip: "Skip",
    continue: "Continue",
    back: "Back",
    step: "Step",
    of: "of",
    s1_tag: "LET'S START",
    s1_title: "What should the AI\ncall you?",
    s1_sub: "And which market do you run? The AI uses this to personalize every response.",
    s1_name_label: "Your name (optional)",
    s1_name_ph: "e.g. Alex",
    s1_niche: "Your main market",
    s1_terms: "I agree to the",
    s1_terms_and: "and",
    s1_terms_link: "Terms of Service",
    s1_privacy_link: "Privacy Policy",
    s2_tag: "HOW THE AI WORKS",
    s2_title: "Not ChatGPT.\nThe intelligence behind your account.",
    s2_sub: "See the difference between a generic answer and one powered by your real data.",
    s2_generic_label: "Generic AI",
    s2_generic: "\"Try testing new creatives and adjusting your target audience to improve results...\"",
    s2_adbrief_label: "AdBrief with your account",
    s2_adbrief: "\"Creative_042 has 0.8% CTR — 3× below your average. CPM spiked 38% this week. Pause it now before burning more budget.\"",
    s2_what_label: "What the AI reads in real time:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM, CPA per ad" },
      { icon: "📈", text: "90-day history of your account" },
      { icon: "🧠", text: "Winning and losing patterns" },
      { icon: "💸", text: "Where money is being wasted" },
    ],
    s3_tag: "LAST STEP",
    s3_title: "Connect Meta Ads.\nSee your data in seconds.",
    s3_sub: "We use Meta's official OAuth — the same agencies use. Read-only. We never spend, publish, or change anything without your confirmation.",
    s3_security: ["Read-only access", "Revoke anytime", "SSL encryption", "Your data, only you"],
    s3_connect: "Connect Meta Ads",
    s3_connecting: "Redirecting to Meta...",
    s3_skip: "Connect later",
    s3_skip_sub: "You can connect anytime from Accounts",
  },
  es: {
    skip: "Saltar",
    continue: "Continuar",
    back: "Volver",
    step: "Paso",
    of: "de",
    s1_tag: "EMPECEMOS",
    s1_title: "¿Cómo quieres que\nla IA te llame?",
    s1_sub: "¿Y qué mercado gestionas? La IA usa esto para personalizar cada respuesta.",
    s1_name_label: "Tu nombre (opcional)",
    s1_name_ph: "Ej: Carlos",
    s1_niche: "Tu mercado principal",
    s1_terms: "Acepto los",
    s1_terms_and: "y la",
    s1_terms_link: "Términos de Uso",
    s1_privacy_link: "Política de Privacidad",
    s2_tag: "CÓMO FUNCIONA LA IA",
    s2_title: "No es ChatGPT.\nEs la inteligencia de tu cuenta.",
    s2_sub: "Ve la diferencia entre una respuesta genérica y una basada en tus datos reales.",
    s2_generic_label: "IA genérica",
    s2_generic: "\"Intenta probar nuevos creativos y ajustar tu audiencia para mejorar los resultados...\"",
    s2_adbrief_label: "AdBrief con tu cuenta",
    s2_adbrief: "\"Creative_042 tiene CTR 0.8% — 3× bajo tu promedio. CPM subió 38% esta semana. Pausalo ahora antes de quemar más presupuesto.\"",
    s2_what_label: "Lo que la IA lee en tiempo real:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM, CPA por anuncio" },
      { icon: "📈", text: "Historial de 90 días de tu cuenta" },
      { icon: "🧠", text: "Patrones ganadores y perdedores" },
      { icon: "💸", text: "Dónde se está quemando el dinero" },
    ],
    s3_tag: "ÚLTIMO PASO",
    s3_title: "Conecta Meta Ads.\nVe tus datos en segundos.",
    s3_sub: "Usamos OAuth oficial de Meta — el mismo que usan las agencias. Solo lectura. Nunca gastamos, publicamos ni cambiamos nada sin tu confirmación.",
    s3_security: ["Solo lectura", "Revocar cuando quieras", "Cifrado SSL", "Tus datos, solo tú"],
    s3_connect: "Conectar Meta Ads",
    s3_connecting: "Redirigiendo a Meta...",
    s3_skip: "Conectar después",
    s3_skip_sub: "Puedes conectar en cualquier momento desde Cuentas",
  },
};

// ── Niches ────────────────────────────────────────────────────────────────────
const NICHES = [
  { value: "igaming",    label: "iGaming",      icon: "🎰", color: "#f59e0b" },
  { value: "ecommerce",  label: "E-commerce",   icon: "🛒", color: "#06b6d4" },
  { value: "fitness",    label: "Fitness",       icon: "💪", color: "#34d399" },
  { value: "saas",       label: "SaaS / Tech",   icon: "⚡", color: "#8b5cf6" },
  { value: "finance",    label: "Finanças",      icon: "💰", color: "#0ea5e9" },
  { value: "beauty",     label: "Beleza",        icon: "✨", color: "#f472b6" },
  { value: "education",  label: "Educação",      icon: "📚", color: "#a78bfa" },
  { value: "food",       label: "Food & Resto",  icon: "🍔", color: "#fb923c" },
  { value: "health",     label: "Saúde",         icon: "🏥", color: "#4ade80" },
  { value: "other",      label: "Outro",         icon: "🔮", color: "#94a3b8" },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan = searchParams.get("checkout");
  const checkoutBilling = searchParams.get("billing");
  const { language: globalLang, setLanguage: setGlobalLanguage } = useLanguage();

  const lang = (["pt","en","es"].includes(globalLang) ? globalLang : "en") as "pt"|"en"|"es";
  const t = T[lang];

  const [step, setStep] = useState<1|2|3>(1);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [animDir, setAnimDir] = useState<"in"|"out">("in");
  const nameRef = useRef<HTMLInputElement>(null);

  // Animate counter for step 2
  const [demoPhase, setDemoPhase] = useState<0|1|2>(0);
  useEffect(() => {
    if (step !== 2) return;
    setDemoPhase(0);
    const t1 = setTimeout(() => setDemoPhase(1), 800);
    const t2 = setTimeout(() => setDemoPhase(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 300);
  }, [step]);

  const goTo = (n: 1|2|3) => {
    setAnimDir("out");
    setTimeout(() => { setStep(n); setAnimDir("in"); }, 180);
  };

  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    await supabase.from("profiles").update({
      name: name || undefined,
      onboarding_completed: true,
      onboarding_data: {
        niche, completedAt: new Date().toISOString(),
      },
    } as never).eq("id", session.user.id);
    if (niche || name) {
      await (supabase.from("user_ai_profile" as any) as any).upsert({
        user_id: session.user.id,
        industry: niche,
        pain_point: name ? `Usuário: ${name}. Nicho: ${niche}` : `Nicho: ${niche}`,
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id" }).catch(() => {});
    }
    supabase.functions.invoke("send-welcome-email", {
      body: { user_id: session.user.id, first_name: name.trim().split(" ")[0], language: lang }
    }).catch(() => {});
    return session;
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const session = await saveProfile();
      if (!session) return;
      const { data } = await supabase.functions.invoke("meta-oauth", {
        body: { action: "get_auth_url", user_id: session.user.id },
      });
      if (data?.url) window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
      setConnecting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await saveProfile();
    } catch {}
    if (checkoutPlan) {
      const PRICES: Record<string, string> = {
        maker: "price_1T9sd1Dr9So14XztT3Mqddch",
        pro: "price_1T9sdfDr9So14XztPR3tI14Y",
        studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
      };
      const priceId = PRICES[checkoutPlan];
      if (priceId) {
        const { data } = await supabase.functions.invoke("create-checkout", {
          body: { price_id: priceId, billing: checkoutBilling || undefined }
        }).catch(() => ({ data: null }));
        if (data?.url) { window.location.href = data.url; return; }
      }
    }
    navigate("/dashboard/ai");
  };

  const pct = ((step - 1) / 2) * 100;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: F, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", flexShrink: 0 }}>
        <Logo size="md" />
        <button onClick={handleSkip}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: M, letterSpacing: "0.04em" }}>
          {t.skip}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.05)", margin: "0 24px", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${BLUE}, #06b6d4)`, width: `${pct}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px 32px" }}>
        <div style={{
          width: "100%", maxWidth: 480,
          opacity: animDir === "in" ? 1 : 0,
          transform: animDir === "in" ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)"
        }}>

          {/* ── STEP 1: Nome + Nicho ── */}
          {step === 1 && (
            <div>
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.14em", marginBottom: 16, textTransform: "uppercase" }}>
                {t.s1_tag}
              </p>
              <h1 style={{ fontSize: "clamp(26px,5vw,34px)", fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.18, letterSpacing: "-0.03em", whiteSpace: "pre-line" }}>
                {t.s1_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 14, color: "rgba(255,255,255,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>
                {t.s1_sub}
              </p>

              {/* Name input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, letterSpacing: "0.04em" }}>
                  {t.s1_name_label}
                </label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && acceptedTerms && niche && goTo(2)}
                  placeholder={t.s1_name_ph}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "12px 16px", borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#fff", fontSize: 14, fontFamily: F,
                    outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
              </div>

              {/* Niche grid */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, letterSpacing: "0.04em" }}>
                  {t.s1_niche}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {NICHES.map(n => {
                    const active = niche === n.value;
                    return (
                      <button key={n.value} onClick={() => setNiche(n.value)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 5, padding: "12px 6px", borderRadius: 12, cursor: "pointer",
                          background: active ? `${n.color}14` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? `${n.color}45` : "rgba(255,255,255,0.07)"}`,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                        <span style={{ fontFamily: M, fontSize: 10, color: active ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: active ? 600 : 400, textAlign: "center", lineHeight: 1.2 }}>
                          {n.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Terms */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 24 }}
                onClick={() => setAcceptedTerms(!acceptedTerms)}>
                <div style={{
                  width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  border: `1px solid ${acceptedTerms ? "#fff" : "rgba(255,255,255,0.2)"}`,
                  background: acceptedTerms ? "#fff" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s",
                }}>
                  {acceptedTerms && <Check size={11} color="#000" />}
                </div>
                <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                  {t.s1_terms}{" "}
                  <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline", textUnderlineOffset: 2 }}>{t.s1_terms_link}</a>
                  {" "}{t.s1_terms_and}{" "}
                  <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.6)", textDecoration: "underline", textUnderlineOffset: 2 }}>{t.s1_privacy_link}</a>
                </span>
              </label>

              <button onClick={() => goTo(2)} disabled={!acceptedTerms}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  background: acceptedTerms ? "#fff" : "rgba(255,255,255,0.08)",
                  border: "none", cursor: acceptedTerms ? "pointer" : "not-allowed",
                  color: acceptedTerms ? "#000" : "rgba(255,255,255,0.2)",
                  fontSize: 14, fontWeight: 700, fontFamily: F,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.15s",
                }}>
                {t.continue} <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP 2: Como funciona ── */}
          {step === 2 && (
            <div>
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.14em", marginBottom: 16, textTransform: "uppercase" }}>
                {t.s2_tag}
              </p>
              <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2, letterSpacing: "-0.03em", whiteSpace: "pre-line" }}>
                {t.s2_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 24px", lineHeight: 1.6 }}>
                {t.s2_sub}
              </p>

              {/* Before / After comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {/* Generic */}
                <div style={{ padding: "14px", borderRadius: 14, background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
                  <p style={{ fontFamily: M, fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" }}>
                    {t.s2_generic_label}
                  </p>
                  <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>
                    {t.s2_generic}
                  </p>
                </div>
                {/* AdBrief */}
                <div style={{
                  padding: "14px", borderRadius: 14,
                  background: demoPhase >= 1 ? "rgba(14,165,233,0.07)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${demoPhase >= 1 ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)"}`,
                  transition: "all 0.5s ease",
                }}>
                  <p style={{ fontFamily: M, fontSize: 9, fontWeight: 700, color: demoPhase >= 1 ? BLUE : "rgba(255,255,255,0.3)", letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase", transition: "color 0.3s" }}>
                    {t.s2_adbrief_label}
                  </p>
                  <p style={{
                    fontFamily: M, fontSize: 11, color: demoPhase >= 1 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                    lineHeight: 1.5, margin: 0, transition: "color 0.5s ease",
                  }}>
                    {demoPhase >= 1 ? t.s2_adbrief : "..."}
                  </p>
                </div>
              </div>

              {/* What the AI reads */}
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 28 }}>
                <p style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "0 0 12px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t.s2_what_label}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {t.s2_items.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      opacity: demoPhase >= 2 ? 1 : i === 0 ? 0.6 : 0.3,
                      transition: `opacity 0.4s ${i * 0.1}s ease`,
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>{item.icon}</span>
                      <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => goTo(1)}
                  style={{ padding: "13px 20px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: F }}>
                  {t.back}
                </button>
                <button onClick={() => goTo(3)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: "#fff", border: "none", cursor: "pointer", color: "#000", fontSize: 14, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {t.continue} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Conectar Meta ── */}
          {step === 3 && (
            <div>
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.14em", marginBottom: 16, textTransform: "uppercase" }}>
                {t.s3_tag}
              </p>
              <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2, letterSpacing: "-0.03em", whiteSpace: "pre-line" }}>
                {t.s3_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>
                {t.s3_sub}
              </p>

              {/* Security badges */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 28 }}>
                {([
                  { icon: Eye,    label: t.s3_security[0] },
                  { icon: Shield, label: t.s3_security[1] },
                  { icon: Lock,   label: t.s3_security[2] },
                  { icon: Zap,    label: t.s3_security[3] },
                ] as any[]).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <item.icon size={14} color="rgba(14,165,233,0.7)" />
                    <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Connect CTA */}
              <button onClick={handleConnect} disabled={connecting}
                style={{
                  width: "100%", padding: "16px 0", borderRadius: 14, marginBottom: 12,
                  background: connecting ? "rgba(14,165,233,0.2)" : "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                  border: "none", cursor: connecting ? "not-allowed" : "pointer",
                  color: "#000", fontSize: 15, fontWeight: 800, fontFamily: F,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.2s", boxShadow: connecting ? "none" : "0 0 40px rgba(14,165,233,0.2)",
                }}>
                {connecting
                  ? <><Loader2 size={16} className="animate-spin" style={{ color: BLUE }} /><span style={{ color: BLUE }}>{t.s3_connecting}</span></>
                  : <><TrendingUp size={16} />{t.s3_connect}</>
                }
              </button>

              {/* Skip */}
              <button onClick={handleSkip}
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "none", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: F }}>
                {t.s3_skip}
              </button>
              <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 8 }}>
                {t.s3_skip_sub}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "0 0 28px", flexShrink: 0 }}>
        {([1,2,3] as const).map(n => (
          <div key={n} style={{
            height: 4, borderRadius: 3,
            width: step === n ? 24 : 8,
            background: step === n ? BLUE : step > n ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.1)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>
    </div>
  );
}
