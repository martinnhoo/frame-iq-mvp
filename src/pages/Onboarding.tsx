// Onboarding v4 — fluxo correto: perfil → como funciona → criar primeira conta
// A conexão Meta/Google é feita dentro do workspace, não no user level
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";
const BG = "#0b0c18";
const BLUE = "#0ea5e9";
const CYAN = "#06b6d4";
const TEXT = "rgba(255,255,255,0.88)";
const MUTED = "rgba(255,255,255,0.45)";
const FAINT = "rgba(255,255,255,0.18)";
const SURFACE = "rgba(255,255,255,0.06)";
const SURFACE_HI = "rgba(255,255,255,0.09)";
const BORDER = "rgba(255,255,255,0.12)";
const BORDER_ACTIVE = "rgba(14,165,233,0.45)";

const T: Record<string, any> = {
  pt: {
    skip: "Pular", continue: "Continuar", back: "Voltar",
    s1_tag: "CONFIGURAÇÃO INICIAL",
    s1_title: "Como a IA deve\nte chamar?",
    s1_sub: "E em qual setor você atua? A IA usa isso para personalizar o tom e o vocabulário em todas as respostas.",
    s1_name_label: "Seu nome", s1_name_ph: "Ex: Carla",
    s1_niche_label: "Seu setor principal",
    s1_terms: "Concordo com os", s1_terms_and: "e a",
    s1_terms_link: "Termos de Uso", s1_privacy_link: "Política de Privacidade",
    s2_tag: "O QUE VOCÊ TEM EM MÃOS",
    s2_title: "Não é um chatbot.\nÉ um gestor que\nconhece sua conta.",
    s2_sub: "A diferença entre uma IA genérica e uma conectada nos seus dados reais:",
    s2_generic_label: "IA genérica",
    s2_generic: '"Tente testar novos criativos e ajustar seu público-alvo para melhorar os resultados..."',
    s2_adbrief_label: "AdBrief conectado",
    s2_adbrief: '"Creative_042 está com CTR 0.8% — 3× abaixo do seu histórico. CPM subiu 38% essa semana. Pause agora antes de queimar mais verba."',
    s2_reads_label: "O que a IA lê automaticamente:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM e CPA de cada anúncio" },
      { icon: "📈", text: "Histórico de 90 dias da sua conta" },
      { icon: "🧠", text: "Padrões de criativos vencedores e perdedores" },
      { icon: "💸", text: "Onde a verba está sendo desperdiçada" },
    ],
    s2_extras_label: "Além disso:",
    s2_extras: [
      "Gera hooks, roteiros e briefs para o seu nicho",
      "Analisa anúncios de concorrentes",
      "Monitora trends culturais em tempo real",
    ],
    s2_workspace_note: "Você organiza tudo por contas — uma conta por cliente ou marca. Vamos criar a primeira agora.",
    s3_tag: "CRIAR PRIMEIRA CONTA",
    s3_title: "Qual é o nome\nda sua primeira conta?",
    s3_sub: "Uma conta = um cliente ou uma marca. Cada conta tem seus próprios dados e conexões. Você pode criar quantas quiser depois.",
    s3_name_label: "Nome da conta", s3_name_ph: "Ex: Loja da Carla, Cliente ABC, Minha Marca",
    s3_desc_label: "Descreva essa conta em uma linha (opcional)",
    s3_desc_ph: "Ex: Loja de moda feminina em SP, vende pelo Instagram",
    s3_connect_title: "Conecte o Meta Ads ou Google Ads a essa conta",
    s3_connect_sub: "OAuth oficial — só leitura. Nunca gastamos ou publicamos nada sem sua confirmação.",
    s3_meta: "Conectar Meta Ads", s3_google: "Conectar Google Ads",
    s3_connecting_meta: "Redirecionando para o Meta...",
    s3_connecting_google: "Redirecionando para o Google...",
    s3_skip: "Criar conta sem conectar agora",
    s3_skip_sub: "Você conecta depois em Contas → selecionar a conta",
    s3_security: ["Somente leitura", "Revogue quando quiser"],
    s3_fill_hint: "Preencha o nome da conta para continuar",
  },
  en: {
    skip: "Skip", continue: "Continue", back: "Back",
    s1_tag: "INITIAL SETUP",
    s1_title: "What should the AI\ncall you?",
    s1_sub: "And what sector do you work in? The AI uses this to personalize tone and vocabulary across all responses.",
    s1_name_label: "Your name", s1_name_ph: "e.g. James",
    s1_niche_label: "Your main sector",
    s1_terms: "I agree to the", s1_terms_and: "and",
    s1_terms_link: "Terms of Service", s1_privacy_link: "Privacy Policy",
    s2_tag: "WHAT YOU HAVE",
    s2_title: "Not a chatbot.\nA manager who knows\nyour account.",
    s2_sub: "The difference between a generic AI and one connected to your real data:",
    s2_generic_label: "Generic AI",
    s2_generic: '"Try testing new creatives and adjusting your target audience to improve results..."',
    s2_adbrief_label: "AdBrief connected",
    s2_adbrief: '"Creative_042 has 0.8% CTR — 3× below your average. CPM spiked 38% this week. Pause it now before burning more budget."',
    s2_reads_label: "What the AI reads automatically:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM and CPA per ad" },
      { icon: "📈", text: "90-day history of your account" },
      { icon: "🧠", text: "Winning and losing creative patterns" },
      { icon: "💸", text: "Where budget is being wasted" },
    ],
    s2_extras_label: "It also:",
    s2_extras: [
      "Generates hooks, scripts and briefs for your niche",
      "Analyzes competitor ads",
      "Monitors cultural trends in real time",
    ],
    s2_workspace_note: "You organize everything by accounts — one account per client or brand. Let's create the first one now.",
    s3_tag: "CREATE FIRST ACCOUNT",
    s3_title: "What's the name of\nyour first account?",
    s3_sub: "One account = one client or brand. Each account has its own data and connections. You can create as many as you want later.",
    s3_name_label: "Account name", s3_name_ph: "e.g. My Store, Client ABC, Brand Name",
    s3_desc_label: "Describe this account in one line (optional)",
    s3_desc_ph: "e.g. Women's clothing store in NY, selling on Instagram",
    s3_connect_title: "Connect Meta Ads or Google Ads to this account",
    s3_connect_sub: "Official OAuth — read-only. We never spend or publish anything without your confirmation.",
    s3_meta: "Connect Meta Ads", s3_google: "Connect Google Ads",
    s3_connecting_meta: "Redirecting to Meta...",
    s3_connecting_google: "Redirecting to Google...",
    s3_skip: "Create account without connecting now",
    s3_skip_sub: "You can connect later in Accounts → select the account",
    s3_security: ["Read-only access", "Revoke anytime"],
    s3_fill_hint: "Fill in the account name to continue",
  },
  es: {
    skip: "Saltar", continue: "Continuar", back: "Volver",
    s1_tag: "CONFIGURACIÓN INICIAL",
    s1_title: "¿Cómo debe\nllamarte la IA?",
    s1_sub: "¿Y en qué sector trabajas? La IA usa esto para personalizar el tono y vocabulario en todas las respuestas.",
    s1_name_label: "Tu nombre", s1_name_ph: "Ej: Miguel",
    s1_niche_label: "Tu sector principal",
    s1_terms: "Acepto los", s1_terms_and: "y la",
    s1_terms_link: "Términos de Uso", s1_privacy_link: "Política de Privacidad",
    s2_tag: "LO QUE TIENES EN MANO",
    s2_title: "No es un chatbot.\nEs un gestor que\nconoce tu cuenta.",
    s2_sub: "La diferencia entre una IA genérica y una conectada a tus datos reales:",
    s2_generic_label: "IA genérica",
    s2_generic: '"Intenta probar nuevos creativos y ajustar tu audiencia para mejorar los resultados..."',
    s2_adbrief_label: "AdBrief conectado",
    s2_adbrief: '"Creative_042 tiene CTR 0.8% — 3× bajo tu promedio. CPM subió 38% esta semana. Paúsalo ahora antes de quemar más presupuesto."',
    s2_reads_label: "Lo que la IA lee automáticamente:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM y CPA por anuncio" },
      { icon: "📈", text: "Historial de 90 días de tu cuenta" },
      { icon: "🧠", text: "Patrones ganadores y perdedores" },
      { icon: "💸", text: "Dónde se está desperdiciando el presupuesto" },
    ],
    s2_extras_label: "Además:",
    s2_extras: [
      "Genera hooks, guiones y briefs para tu nicho",
      "Analiza anuncios de competidores",
      "Monitorea tendencias culturales en tiempo real",
    ],
    s2_workspace_note: "Organizas todo por cuentas — una cuenta por cliente o marca. Vamos a crear la primera ahora.",
    s3_tag: "CREAR PRIMERA CUENTA",
    s3_title: "¿Cuál es el nombre\nde tu primera cuenta?",
    s3_sub: "Una cuenta = un cliente o una marca. Cada cuenta tiene sus propios datos y conexiones. Puedes crear todas las que quieras después.",
    s3_name_label: "Nombre de la cuenta", s3_name_ph: "Ej: Mi Tienda, Cliente ABC, Nombre de Marca",
    s3_desc_label: "Describe esta cuenta en una línea (opcional)",
    s3_desc_ph: "Ej: Tienda de moda femenina en CDMX, vende por Instagram",
    s3_connect_title: "Conecta Meta Ads o Google Ads a esta cuenta",
    s3_connect_sub: "OAuth oficial — solo lectura. Nunca gastamos ni publicamos nada sin tu confirmación.",
    s3_meta: "Conectar Meta Ads", s3_google: "Conectar Google Ads",
    s3_connecting_meta: "Redirigiendo a Meta...",
    s3_connecting_google: "Redirigiendo a Google...",
    s3_skip: "Crear cuenta sin conectar ahora",
    s3_skip_sub: "Puedes conectar después en Cuentas → seleccionar la cuenta",
    s3_security: ["Solo lectura", "Revocar cuando quieras"],
    s3_fill_hint: "Completa el nombre de la cuenta para continuar",
  },
};

const NICHES = [
  { value: "igaming",   label: "iGaming",     icon: "🎰", color: "#f59e0b" },
  { value: "ecommerce", label: "E-commerce",  icon: "🛒", color: "#06b6d4" },
  { value: "fitness",   label: "Fitness",      icon: "💪", color: "#34d399" },
  { value: "saas",      label: "SaaS / Tech",  icon: "⚡", color: "#8b5cf6" },
  { value: "finance",   label: "Finanças",     icon: "💰", color: "#0ea5e9" },
  { value: "beauty",    label: "Beleza",       icon: "✨", color: "#f472b6" },
  { value: "education", label: "Educação",     icon: "📚", color: "#a78bfa" },
  { value: "food",      label: "Food & Resto", icon: "🍔", color: "#fb923c" },
  { value: "health",    label: "Saúde",        icon: "🏥", color: "#4ade80" },
  { value: "other",     label: "Outro",        icon: "🔮", color: "#94a3b8" },
];

const inputCss: React.CSSProperties = {
  width: "100%", boxSizing: "border-box" as const,
  padding: "13px 16px", borderRadius: 12,
  background: SURFACE, border: `1.5px solid ${BORDER}`,
  color: TEXT, fontSize: 15, fontFamily: F,
  outline: "none", transition: "border-color 0.15s",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan    = searchParams.get("checkout");
  const checkoutBilling = searchParams.get("billing");
  const { language: globalLang } = useLanguage();
  const lang = (["pt","en","es"].includes(globalLang) ? globalLang : "en") as "pt"|"en"|"es";
  const t = T[lang];

  const [step, setStep]               = useState<1|2|3>(1);
  const [connecting, setConnecting]   = useState<"meta"|"google"|null>(null);
  const [name, setName]               = useState("");
  const [niche, setNiche]             = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountDesc, setAccountDesc] = useState("");
  const [animDir, setAnimDir]         = useState<"in"|"out">("in");
  const nameRef        = useRef<HTMLInputElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed]       = useState(false);

  useEffect(() => {
    if (step !== 2) { setRevealed(false); return; }
    const t1 = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(t1);
  }, [step]);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 300);
    if (step === 3) setTimeout(() => accountNameRef.current?.focus(), 300);
  }, [step]);

  const goTo = (n: 1|2|3) => {
    setAnimDir("out");
    setTimeout(() => { setStep(n); setAnimDir("in"); }, 160);
  };

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    return session;
  };

  const saveUserProfile = async (session: any) => {
    const nicheObj = NICHES.find(n => n.value === niche);
    await supabase.from("profiles").update({
      name: name || undefined,
      onboarding_completed: true,
      onboarding_data: { niche, completedAt: new Date().toISOString() },
    } as never).eq("id", session.user.id);
    if (niche || name) {
      await (supabase.from("user_ai_profile" as any) as any).upsert({
        user_id: session.user.id,
        industry: niche,
        pain_point: [
          name  ? `Usuário: ${name}.`                      : "",
          niche ? `Nicho: ${nicheObj?.label || niche}.`    : "",
        ].filter(Boolean).join(" "),
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id" }).catch(() => {});
    }
  };

  const createFirstAccount = async (session: any) => {
    const nicheObj    = NICHES.find(n => n.value === niche);
    const personaName = accountName.trim() || (name ? name.split(" ")[0] : nicheObj?.label || "Minha conta");
    const { data: existing } = await supabase.from("personas")
      .select("id").eq("user_id", session.user.id).limit(1);
    if (!existing?.length) {
      try {
        await supabase.from("personas").insert({
          user_id:  session.user.id,
          name:     personaName,
          headline: accountDesc || (niche ? `${nicheObj?.label || niche} · ${lang.toUpperCase()}` : "Minha conta"),
          result: {
            preferred_market: lang === "pt" ? "BR" : lang === "es" ? "MX" : "US",
            niche, industry: niche, biz_description: accountDesc,
          },
        } as never);
      } catch {}
    }
    supabase.functions.invoke("send-welcome-email", {
      body: { user_id: session.user.id, first_name: name.trim().split(" ")[0] || personaName, language: lang }
    }).catch(() => {});
  };

  const handleConnect = async (platform: "meta"|"google") => {
    if (!accountName.trim()) return;
    setConnecting(platform);
    try {
      const session = await getSession();
      if (!session) return;
      await saveUserProfile(session);
      await createFirstAccount(session);
      const fn = platform === "meta" ? "meta-oauth" : "google-oauth";
      const { data } = await supabase.functions.invoke(fn, {
        body: { action: "get_auth_url", user_id: session.user.id },
      });
      if (data?.url) window.location.href = data.url;
      else throw new Error("No URL");
    } catch {
      toast.error("Something went wrong");
      setConnecting(null);
    }
  };

  const handleSkip = async () => {
    try {
      const session = await getSession();
      if (session) {
        await saveUserProfile(session);
        if (step === 3) await createFirstAccount(session);
      }
    } catch {}
    if (checkoutPlan) {
      const PRICES: Record<string,string> = {
        maker: "price_1T9sd1Dr9So14XztT3Mqddch",
        pro:   "price_1T9sdfDr9So14XztPR3tI14Y",
        studio:"price_1T9seMDr9So14Xzt0vEJNQIX",
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
  const canStep1 = acceptedTerms;
  const canStep3 = accountName.trim().length > 0;

  const Lbl = ({ text }: { text: string }) => (
    <p style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: MUTED,
      margin: "0 0 8px", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
      {text}
    </p>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: F, display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(14,165,233,0.08) 0%, transparent 70%)" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "20px 28px", flexShrink: 0 }}>
        <Logo size="md" />
        <button onClick={handleSkip} style={{ background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: FAINT, fontFamily: M, letterSpacing: "0.04em" }}>
          {t.skip}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", margin: "0 28px",
        borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`,
          width: `${pct}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", padding: "24px 20px 32px", overflowY: "auto" as const }}>
        <div style={{ width: "100%", maxWidth: 500,
          opacity: animDir === "in" ? 1 : 0,
          transform: animDir === "in" ? "translateY(0)" : "translateY(14px)",
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)" }}>

          {/* ── STEP 1: Perfil ── */}
          {step === 1 && (
            <div>
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE,
                letterSpacing: "0.14em", marginBottom: 14, textTransform: "uppercase" as const }}>
                {t.s1_tag}
              </p>
              <h1 style={{ fontSize: "clamp(26px,5vw,34px)", fontWeight: 800, color: "#fff",
                margin: "0 0 10px", lineHeight: 1.18, letterSpacing: "-0.03em", whiteSpace: "pre-line" as const }}>
                {t.s1_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 14, color: MUTED, margin: "0 0 28px", lineHeight: 1.6 }}>
                {t.s1_sub}
              </p>

              {/* Nome */}
              <div style={{ marginBottom: 20 }}>
                <Lbl text={t.s1_name_label} />
                <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canStep1 && goTo(2)}
                  placeholder={t.s1_name_ph} style={inputCss}
                  onFocus={e => { e.currentTarget.style.borderColor = BORDER_ACTIVE; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER; }} />
              </div>

              {/* Nicho */}
              <div style={{ marginBottom: 24 }}>
                <Lbl text={t.s1_niche_label} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }} className="niche-grid">
                  {NICHES.map(n => {
                    const active = niche === n.value;
                    return (
                      <button key={n.value} onClick={() => setNiche(n.value)} style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: 5, padding: "12px 6px", borderRadius: 12,
                        cursor: "pointer",
                        background: active ? `${n.color}18` : SURFACE,
                        border: `1.5px solid ${active ? `${n.color}50` : BORDER}`,
                        transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = SURFACE_HI; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = SURFACE; }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                        <span style={{ fontFamily: M, fontSize: 10, textAlign: "center", lineHeight: 1.2,
                          color: active ? "#fff" : MUTED, fontWeight: active ? 600 : 400 }}>
                          {n.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Terms */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10,
                cursor: "pointer", marginBottom: 24 }}
                onClick={() => setAcceptedTerms(!acceptedTerms)}>
                <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${acceptedTerms ? "#fff" : BORDER}`,
                  background: acceptedTerms ? "#fff" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                  {acceptedTerms && <Check size={11} color="#000" />}
                </div>
                <span style={{ fontFamily: M, fontSize: 12, color: FAINT, lineHeight: 1.5 }}>
                  {t.s1_terms}{" "}
                  <a href="/terms" target="_blank" onClick={e => e.stopPropagation()}
                    style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {t.s1_terms_link}
                  </a>{" "}{t.s1_terms_and}{" "}
                  <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()}
                    style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {t.s1_privacy_link}
                  </a>
                </span>
              </label>

              <button onClick={() => goTo(2)} disabled={!canStep1} style={{
                width: "100%", padding: "14px 0", borderRadius: 14,
                background: canStep1 ? "#fff" : "rgba(255,255,255,0.07)",
                border: "none", cursor: canStep1 ? "pointer" : "not-allowed",
                color: canStep1 ? "#000" : "rgba(255,255,255,0.18)",
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
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE,
                letterSpacing: "0.14em", marginBottom: 14, textTransform: "uppercase" as const }}>
                {t.s2_tag}
              </p>
              <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#fff",
                margin: "0 0 10px", lineHeight: 1.2, letterSpacing: "-0.03em", whiteSpace: "pre-line" as const }}>
                {t.s2_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 13, color: MUTED, margin: "0 0 20px", lineHeight: 1.6 }}>
                {t.s2_sub}
              </p>

              {/* Before / After */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ padding: "14px", borderRadius: 14,
                  background: "rgba(248,113,113,0.06)", border: "1.5px solid rgba(248,113,113,0.18)" }}>
                  <p style={{ fontFamily: M, fontSize: 9, fontWeight: 700, color: "#f87171",
                    letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" as const }}>
                    {t.s2_generic_label}
                  </p>
                  <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.38)",
                    lineHeight: 1.55, margin: 0, fontStyle: "italic" as const }}>
                    {t.s2_generic}
                  </p>
                </div>
                <div style={{ padding: "14px", borderRadius: 14,
                  background: revealed ? "rgba(14,165,233,0.08)" : SURFACE,
                  border: `1.5px solid ${revealed ? "rgba(14,165,233,0.28)" : BORDER}`,
                  transition: "all 0.5s ease" }}>
                  <p style={{ fontFamily: M, fontSize: 9, fontWeight: 700,
                    color: revealed ? BLUE : "rgba(255,255,255,0.25)",
                    letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" as const,
                    transition: "color 0.3s" }}>
                    {t.s2_adbrief_label}
                  </p>
                  <p style={{ fontFamily: M, fontSize: 11,
                    color: revealed ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.18)",
                    lineHeight: 1.55, margin: 0, transition: "color 0.5s ease" }}>
                    {revealed ? t.s2_adbrief : "..."}
                  </p>
                </div>
              </div>

              {/* O que a IA lê */}
              <div style={{ padding: "16px", borderRadius: 14,
                background: SURFACE, border: `1.5px solid ${BORDER}`, marginBottom: 12 }}>
                <p style={{ fontFamily: M, fontSize: 10, fontWeight: 600, color: MUTED,
                  margin: "0 0 12px", letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                  {t.s2_reads_label}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {t.s2_items.map((item: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                      opacity: revealed ? 1 : i === 0 ? 0.5 : 0.2,
                      transition: `opacity 0.4s ${i * 0.08}s ease` }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontFamily: M, fontSize: 12, color: TEXT }}>{item.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                  <p style={{ fontFamily: M, fontSize: 10, fontWeight: 600, color: MUTED,
                    margin: "0 0 8px", letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                    {t.s2_extras_label}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {t.s2_extras.map((extra: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                        opacity: revealed ? 1 : 0.2, transition: `opacity 0.4s ${(i + 4) * 0.08}s ease` }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: CYAN, flexShrink: 0 }} />
                        <span style={{ fontFamily: M, fontSize: 12, color: MUTED }}>{extra}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nota workspaces */}
              <div style={{ padding: "12px 14px", borderRadius: 12, marginBottom: 22,
                background: "rgba(14,165,233,0.06)", border: "1.5px solid rgba(14,165,233,0.18)",
                display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.55, margin: 0 }}>
                  {t.s2_workspace_note}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => goTo(1)} style={{ padding: "13px 20px", borderRadius: 12,
                  background: SURFACE, border: `1.5px solid ${BORDER}`, cursor: "pointer",
                  color: MUTED, fontSize: 13, fontFamily: F }}>
                  {t.back}
                </button>
                <button onClick={() => goTo(3)} style={{ flex: 1, padding: "13px 0", borderRadius: 12,
                  background: "#fff", border: "none", cursor: "pointer",
                  color: "#000", fontSize: 14, fontWeight: 700, fontFamily: F,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {t.continue} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Criar primeira conta ── */}
          {step === 3 && (
            <div>
              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: BLUE,
                letterSpacing: "0.14em", marginBottom: 14, textTransform: "uppercase" as const }}>
                {t.s3_tag}
              </p>
              <h1 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#fff",
                margin: "0 0 10px", lineHeight: 1.2, letterSpacing: "-0.03em", whiteSpace: "pre-line" as const }}>
                {t.s3_title}
              </h1>
              <p style={{ fontFamily: M, fontSize: 13, color: MUTED, margin: "0 0 24px", lineHeight: 1.6 }}>
                {t.s3_sub}
              </p>

              {/* Nome da conta */}
              <div style={{ marginBottom: 14 }}>
                <Lbl text={t.s3_name_label} />
                <input ref={accountNameRef} value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder={t.s3_name_ph} style={inputCss}
                  onFocus={e => { e.currentTarget.style.borderColor = BORDER_ACTIVE; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER; }} />
              </div>

              {/* Descrição */}
              <div style={{ marginBottom: 24 }}>
                <Lbl text={t.s3_desc_label} />
                <input value={accountDesc} onChange={e => setAccountDesc(e.target.value)}
                  placeholder={t.s3_desc_ph} style={inputCss}
                  onFocus={e => { e.currentTarget.style.borderColor = BORDER_ACTIVE; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER; }} />
              </div>

              {/* Conectar */}
              <div style={{ padding: "16px", borderRadius: 14,
                background: SURFACE, border: `1.5px solid ${BORDER}`, marginBottom: 12 }}>
                <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: TEXT, margin: "0 0 4px" }}>
                  {t.s3_connect_title}
                </p>
                <p style={{ fontFamily: M, fontSize: 12, color: MUTED, margin: "0 0 14px", lineHeight: 1.5 }}>
                  {t.s3_connect_sub}
                </p>
                {/* Security tags */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" as const }}>
                  {t.s3_security.map((s: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 20,
                      background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: CYAN }} />
                      <span style={{ fontFamily: M, fontSize: 11, color: "rgba(14,165,233,0.85)" }}>{s}</span>
                    </div>
                  ))}
                </div>
                {/* Meta */}
                <button onClick={() => handleConnect("meta")}
                  disabled={!canStep3 || connecting !== null} style={{
                    width: "100%", padding: "13px 0", borderRadius: 12, marginBottom: 8,
                    background: !canStep3 || connecting !== null
                      ? "rgba(255,255,255,0.06)"
                      : `linear-gradient(135deg, ${BLUE}, ${CYAN})`,
                    border: "none",
                    cursor: !canStep3 || connecting !== null ? "not-allowed" : "pointer",
                    color: !canStep3 || connecting !== null ? "rgba(255,255,255,0.25)" : "#000",
                    fontSize: 14, fontWeight: 700, fontFamily: F,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                    boxShadow: !canStep3 || connecting !== null ? "none" : "0 0 30px rgba(14,165,233,0.18)",
                  }}>
                  {connecting === "meta"
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /><span>{t.s3_connecting_meta}</span></>
                    : <><TrendingUp size={15} />{t.s3_meta}</>}
                </button>
                {/* Google */}
                <button onClick={() => handleConnect("google")}
                  disabled={!canStep3 || connecting !== null} style={{
                    width: "100%", padding: "13px 0", borderRadius: 12,
                    background: SURFACE_HI,
                    border: `1.5px solid ${!canStep3 ? BORDER : "rgba(66,133,244,0.35)"}`,
                    cursor: !canStep3 || connecting !== null ? "not-allowed" : "pointer",
                    color: !canStep3 || connecting !== null ? "rgba(255,255,255,0.25)" : TEXT,
                    fontSize: 14, fontWeight: 600, fontFamily: F,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                  }}>
                  {connecting === "google"
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /><span>{t.s3_connecting_google}</span></>
                    : <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      {t.s3_google}
                    </>}
                </button>
              </div>

              {/* Hint nome vazio */}
              {!canStep3 && (
                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(251,146,60,0.75)",
                  textAlign: "center", margin: "0 0 12px" }}>
                  ↑ {t.s3_fill_hint}
                </p>
              )}

              {/* Skip */}
              <button onClick={handleSkip} style={{ width: "100%", padding: "12px 0", borderRadius: 12,
                background: "none", border: `1.5px solid ${BORDER}`, cursor: "pointer",
                color: FAINT, fontSize: 13, fontFamily: F, marginBottom: canStep3 ? 6 : 0 }}>
                {canStep3 ? t.s3_skip : t.skip}
              </button>
              {canStep3 && (
                <p style={{ fontFamily: M, fontSize: 11, color: FAINT, textAlign: "center", margin: 0 }}>
                  {t.s3_skip_sub}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center",
        gap: 8, padding: "10px 0 24px", flexShrink: 0 }}>
        {([1,2,3] as const).map(n => (
          <div key={n} style={{ height: 4, borderRadius: 3,
            width: step === n ? 24 : 8,
            background: step === n ? BLUE : step > n ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.1)",
            transition: "all 0.3s ease" }} />
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .niche-grid { display: grid; }
        @media (max-width:420px) { .niche-grid button { padding: 9px 3px !important; } }
        * { -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: rgba(255,255,255,0.22); }
        button, input { touch-action: manipulation; }
      `}</style>
    </div>
  );
}
