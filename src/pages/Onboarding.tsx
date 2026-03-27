// Onboarding v5 — redesign completo com background animado + tipografia maior
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Inter', sans-serif";
const BLUE = "#0ea5e9";
const CYAN = "#06b6d4";

const T: Record<string, any> = {
  pt: {
    skip: "Pular",
    continue: "Continuar →",
    back: "Voltar",
    s1_tag: "PASSO 1 DE 3",
    s1_title: "Como a IA deve\nte chamar?",
    s1_sub: "E em qual setor você atua? A IA usa isso para personalizar o tom, o vocabulário e as recomendações em cada resposta.",
    s1_name_label: "Seu nome",
    s1_name_ph: "Ex: Carla",
    s1_niche_label: "Seu setor principal",
    s1_terms: "Concordo com os",
    s1_terms_and: "e a",
    s1_terms_link: "Termos de Uso",
    s1_privacy_link: "Política de Privacidade",
    s2_tag: "PASSO 2 DE 3",
    s2_title: "Não é um chatbot.\nÉ o gestor sênior\nda sua conta.",
    s2_sub: "A diferença entre uma IA genérica e uma que realmente conhece seus dados:",
    s2_generic_label: "IA genérica",
    s2_generic: '"Tente testar novos criativos e ajustar seu público-alvo para melhorar os resultados..."',
    s2_adbrief_label: "AdBrief conectado",
    s2_adbrief: '"Creative_042 com CTR 0.8% — 3× abaixo do histórico. CPM subiu 38% essa semana. Pause agora antes de queimar mais verba."',
    s2_reads_label: "O que a IA lê em tempo real:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM e CPA de cada anúncio" },
      { icon: "📈", text: "Histórico de 90 dias da sua conta" },
      { icon: "🧠", text: "Padrões de criativos vencedores e perdedores" },
      { icon: "💸", text: "Onde a verba está sendo desperdiçada agora" },
    ],
    s2_extras_label: "Além disso:",
    s2_extras: [
      "Hooks, roteiros e briefs no seu nicho",
      "Análise de anúncios de concorrentes",
      "Trends culturais do Brasil em tempo real",
    ],
    s2_note: "Você organiza tudo por contas — uma conta por cliente ou marca. Vamos criar a primeira agora.",
    s3_tag: "PASSO 3 DE 3",
    s3_title: "Crie sua\nprimeira conta.",
    s3_sub: "Uma conta = um cliente ou marca. Cada conta tem seus próprios dados e conexões. Você pode criar quantas quiser depois.",
    s3_name_label: "Nome da conta",
    s3_name_ph: "Ex: Loja da Carla, Agência XYZ, Minha Marca",
    s3_desc_label: "Descreva em uma linha (opcional)",
    s3_desc_ph: "Ex: E-commerce de moda feminina em SP",
    s3_connect_title: "Conecte Meta Ads ou Google Ads a essa conta",
    s3_connect_sub: "OAuth oficial — só leitura. Nunca gastamos ou publicamos nada sem sua confirmação.",
    s3_meta: "Conectar Meta Ads",
    s3_google: "Conectar Google Ads",
    s3_connecting_meta: "Redirecionando para o Meta...",
    s3_connecting_google: "Redirecionando para o Google...",
    s3_skip: "Criar conta sem conectar agora",
    s3_skip_note: "Você conecta depois em Contas → selecionar a conta",
    s3_security: ["Somente leitura", "Revogue quando quiser"],
    s3_fill_hint: "Preencha o nome da conta para continuar",
  },
  en: {
    skip: "Skip",
    continue: "Continue →",
    back: "Back",
    s1_tag: "STEP 1 OF 3",
    s1_title: "What should the AI\ncall you?",
    s1_sub: "And what sector do you work in? The AI uses this to personalize the tone, vocabulary and recommendations in every response.",
    s1_name_label: "Your name",
    s1_name_ph: "e.g. James",
    s1_niche_label: "Your main sector",
    s1_terms: "I agree to the",
    s1_terms_and: "and",
    s1_terms_link: "Terms of Service",
    s1_privacy_link: "Privacy Policy",
    s2_tag: "STEP 2 OF 3",
    s2_title: "Not a chatbot.\nThe senior manager\nof your account.",
    s2_sub: "The difference between a generic AI and one that truly knows your data:",
    s2_generic_label: "Generic AI",
    s2_generic: '"Try testing new creatives and adjusting your target audience to improve results..."',
    s2_adbrief_label: "AdBrief connected",
    s2_adbrief: '"Creative_042 at 0.8% CTR — 3× below average. CPM spiked 38% this week. Pause it now before burning more budget."',
    s2_reads_label: "What the AI reads in real time:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM and CPA per ad" },
      { icon: "📈", text: "90-day history of your account" },
      { icon: "🧠", text: "Winning and losing creative patterns" },
      { icon: "💸", text: "Where budget is being wasted right now" },
    ],
    s2_extras_label: "It also:",
    s2_extras: [
      "Hooks, scripts and briefs for your niche",
      "Competitor ad analysis",
      "Real-time cultural trends",
    ],
    s2_note: "You organize everything by accounts — one per client or brand. Let's create the first one now.",
    s3_tag: "STEP 3 OF 3",
    s3_title: "Create your\nfirst account.",
    s3_sub: "One account = one client or brand. Each has its own data and connections. You can create as many as you want later.",
    s3_name_label: "Account name",
    s3_name_ph: "e.g. My Store, Agency XYZ, Brand Name",
    s3_desc_label: "Describe in one line (optional)",
    s3_desc_ph: "e.g. Women's fashion e-commerce in NY",
    s3_connect_title: "Connect Meta Ads or Google Ads to this account",
    s3_connect_sub: "Official OAuth — read-only. We never spend or publish anything without your confirmation.",
    s3_meta: "Connect Meta Ads",
    s3_google: "Connect Google Ads",
    s3_connecting_meta: "Redirecting to Meta...",
    s3_connecting_google: "Redirecting to Google...",
    s3_skip: "Create account without connecting now",
    s3_skip_note: "You can connect later in Accounts → select the account",
    s3_security: ["Read-only access", "Revoke anytime"],
    s3_fill_hint: "Fill in the account name to continue",
  },
  es: {
    skip: "Saltar",
    continue: "Continuar →",
    back: "Volver",
    s1_tag: "PASO 1 DE 3",
    s1_title: "¿Cómo debe\nllamarte la IA?",
    s1_sub: "¿Y en qué sector trabajas? La IA usa esto para personalizar el tono, vocabulario y recomendaciones en cada respuesta.",
    s1_name_label: "Tu nombre",
    s1_name_ph: "Ej: Miguel",
    s1_niche_label: "Tu sector principal",
    s1_terms: "Acepto los",
    s1_terms_and: "y la",
    s1_terms_link: "Términos de Uso",
    s1_privacy_link: "Política de Privacidad",
    s2_tag: "PASO 2 DE 3",
    s2_title: "No es un chatbot.\nEl gestor senior\nde tu cuenta.",
    s2_sub: "La diferencia entre una IA genérica y una que realmente conoce tus datos:",
    s2_generic_label: "IA genérica",
    s2_generic: '"Intenta probar nuevos creativos y ajustar tu audiencia para mejorar los resultados..."',
    s2_adbrief_label: "AdBrief conectado",
    s2_adbrief: '"Creative_042 con CTR 0.8% — 3× bajo el promedio. CPM subió 38% esta semana. Paúsalo antes de quemar más presupuesto."',
    s2_reads_label: "Lo que la IA lee en tiempo real:",
    s2_items: [
      { icon: "📊", text: "ROAS, CTR, CPM y CPA por anuncio" },
      { icon: "📈", text: "Historial de 90 días de tu cuenta" },
      { icon: "🧠", text: "Patrones ganadores y perdedores" },
      { icon: "💸", text: "Dónde se desperdicia el presupuesto ahora" },
    ],
    s2_extras_label: "Además:",
    s2_extras: [
      "Hooks, guiones y briefs para tu nicho",
      "Análisis de anuncios de competidores",
      "Tendencias culturales en tiempo real",
    ],
    s2_note: "Organizas todo por cuentas — una por cliente o marca. Vamos a crear la primera ahora.",
    s3_tag: "PASO 3 DE 3",
    s3_title: "Crea tu\nprimera cuenta.",
    s3_sub: "Una cuenta = un cliente o marca. Cada una tiene sus propios datos y conexiones. Puedes crear todas las que quieras después.",
    s3_name_label: "Nombre de la cuenta",
    s3_name_ph: "Ej: Mi Tienda, Agencia XYZ, Nombre de Marca",
    s3_desc_label: "Describe en una línea (opcional)",
    s3_desc_ph: "Ej: E-commerce de moda femenina en CDMX",
    s3_connect_title: "Conecta Meta Ads o Google Ads a esta cuenta",
    s3_connect_sub: "OAuth oficial — solo lectura. Nunca gastamos ni publicamos nada sin tu confirmación.",
    s3_meta: "Conectar Meta Ads",
    s3_google: "Conectar Google Ads",
    s3_connecting_meta: "Redirigiendo a Meta...",
    s3_connecting_google: "Redirigiendo a Google...",
    s3_skip: "Crear cuenta sin conectar ahora",
    s3_skip_note: "Puedes conectar después en Cuentas → seleccionar la cuenta",
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

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan    = searchParams.get("checkout");
  const checkoutBilling = searchParams.get("billing");
  const { language: globalLang } = useLanguage();
  const lang = (["pt","en","es"].includes(globalLang) ? globalLang : "en") as "pt"|"en"|"es";
  const t = T[lang];

  const [step, setStep]             = useState<1|2|3>(1);
  const [connecting, setConnecting] = useState<"meta"|"google"|null>(null);
  const [name, setName]             = useState("");
  const [niche, setNiche]           = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountDesc, setAccountDesc] = useState("");
  const [revealed, setRevealed]     = useState(false);
  const nameRef        = useRef<HTMLInputElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 2) { setRevealed(false); return; }
    const tid = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(tid);
  }, [step]);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 400);
    if (step === 3) setTimeout(() => accountNameRef.current?.focus(), 400);
  }, [step]);

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
      try {
        await (supabase.from("user_ai_profile" as any) as any).upsert({
          user_id: session.user.id,
          industry: niche,
          pain_point: [name ? `Usuário: ${name}.` : "", niche ? `Nicho: ${nicheObj?.label || niche}.` : ""].filter(Boolean).join(" "),
          last_updated: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch {}
    }
  };

  const createFirstAccount = async (session: any): Promise<string | null> => {
    const nicheObj = NICHES.find(n => n.value === niche);
    const personaName = accountName.trim() || (name ? name.split(" ")[0] : nicheObj?.label || "Minha conta");

    // 1. Check if persona already exists
    const { data: existing, error: selectErr } = await supabase.from("personas")
      .select("id").eq("user_id", session.user.id).limit(1);
    console.log("[persona] existing check:", { existing, selectErr: selectErr?.message });
    if (existing?.length) {
      await supabase.from("personas").update({
        name: personaName,
        headline: accountDesc || (nicheObj ? `${nicheObj.label} · ${lang.toUpperCase()}` : "Minha conta"),
        result: { preferred_market: lang === "pt" ? "BR" : lang === "es" ? "MX" : "US", niche, industry: niche, biz_description: accountDesc },
      } as never).eq("id", (existing[0] as any).id);
      return (existing[0] as any).id as string;
    }

    // 2. Insert new persona
    const { data: inserted, error: insertError } = await supabase.from("personas").insert({
      user_id: session.user.id,
      name: personaName,
      headline: accountDesc || (nicheObj ? `${nicheObj.label} · ${lang.toUpperCase()}` : "Minha conta"),
      result: { preferred_market: lang === "pt" ? "BR" : lang === "es" ? "MX" : "US", niche, industry: niche, biz_description: accountDesc },
    } as never).select("id");

    console.log("[persona] insert result:", { inserted, insertError: insertError?.message, code: insertError?.code });
    if (!insertError && inserted?.length) {
      supabase.functions.invoke("send-welcome-email", {
        body: { user_id: session.user.id, first_name: name.trim().split(" ")[0] || personaName, language: lang }
      }).catch(() => {});
      return (inserted[0] as any).id as string;
    }

    // 3. Try fetching again after failed insert
    const { data: retry, error: retryErr } = await supabase.from("personas")
      .select("id").eq("user_id", session.user.id).limit(1);
    console.log("[persona] retry:", { retry, retryErr: retryErr?.message });
    return retry?.length ? (retry[0] as any).id as string : null;
  };

  const handleConnect = async (platform: "meta"|"google") => {
    if (!accountName.trim()) return;
    setConnecting(platform);
    try {
      const session = await getSession();
      if (!session) return;
      await saveUserProfile(session);
      const personaId = await createFirstAccount(session);
      if (!personaId) throw new Error("Could not create account");
      const fn = platform === "meta" ? "meta-oauth" : "google-oauth";
      const { data } = await supabase.functions.invoke(fn, {
        body: { action: "get_auth_url", user_id: session.user.id, persona_id: personaId }
      });
      if (data?.url) window.location.href = data.url;
      else throw new Error("No URL");
    } catch (err: any) {
      console.error("[onboarding connect error]", err?.message || String(err));
      toast.error("Something went wrong: " + (err?.message || "unknown"));
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
      const PRICES: Record<string,string> = { maker:"price_1T9sd1Dr9So14XztT3Mqddch", pro:"price_1T9sdfDr9So14XztPR3tI14Y", studio:"price_1T9seMDr9So14Xzt0vEJNQIX" };
      const priceId = PRICES[checkoutPlan];
      if (priceId) {
        const { data } = await supabase.functions.invoke("create-checkout", { body: { price_id: priceId, billing: checkoutBilling || undefined } }).catch(() => ({ data: null }));
        if (data?.url) { window.location.href = data.url; return; }
      }
    }
    navigate("/dashboard/ai");
  };

  const canStep1 = acceptedTerms;
  const canStep3 = accountName.trim().length > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const,
    padding: "14px 18px", borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1.5px solid rgba(255,255,255,0.18)",
    color: "#fff", fontSize: 16, fontFamily: F,
    outline: "none", transition: "border-color 0.15s, background 0.15s",
  };

  const stepVariants = {
    enter: { opacity: 0, y: 20 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07080f", fontFamily: F, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* ── Animated background orbs (same as signup) ── */}
      <motion.div style={{ position: "fixed", width: 700, height: 700, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, hsla(199,83%,58%,0.13) 0%, transparent 60%)", filter: "blur(80px)", top: "10%", left: "20%" }}
        animate={{ x: ["0%","30%","-20%","0%"], y: ["0%","-30%","20%","0%"] }}
        transition={{ duration: 18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />
      <motion.div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, hsla(280,80%,60%,0.10) 0%, transparent 60%)", filter: "blur(80px)", top: "50%", right: "10%" }}
        animate={{ x: ["0%","-25%","20%","0%"], y: ["0%","25%","-20%","0%"] }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />
      <motion.div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, hsla(180,70%,50%,0.07) 0%, transparent 60%)", filter: "blur(60px)", bottom: "10%", left: "10%" }}
        animate={{ x: ["0%","20%","-15%","0%"], y: ["0%","-20%","15%","0%"] }}
        transition={{ duration: 16, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />

      {/* Grid pattern */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.035, backgroundImage: "linear-gradient(rgba(14,165,233,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.6) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div key={i} style={{ position: "fixed", width: 3, height: 3, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: i % 3 === 0 ? "rgba(14,165,233,0.5)" : i % 3 === 1 ? "rgba(6,182,212,0.4)" : "rgba(139,92,246,0.4)", left: `${10 + i * 11}%`, top: `${10 + (i % 4) * 22}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2], scale: [1, 2, 1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }} />
      ))}

      {/* ── Header ── */}
      <div className="onboarding-header" style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", flexShrink: 0 }}>
        <Logo size="md" />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {([1,2,3] as const).map(n => (
              <div key={n} style={{ height: 6, borderRadius: 3, width: step === n ? 28 : 8, background: step === n ? BLUE : step > n ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.15)", transition: "all 0.35s ease" }} />
            ))}
          </div>
          <button onClick={handleSkip} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: M, letterSpacing: "0.03em", padding: "6px 12px", borderRadius: 8, transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
            {t.skip}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ position: "relative", zIndex: 10, height: 2, background: "rgba(255,255,255,0.06)", margin: "0 32px", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <motion.div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${BLUE}, ${CYAN})` }}
          animate={{ width: `${((step - 1) / 2) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }} />
      </div>

      {/* ── Content ── */}
      <div className="onboarding-content" style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "32px 20px 40px", overflowY: "auto" as const }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={stepVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ width: "100%", maxWidth: 520 }}>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div>
                <p style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase" as const }}>
                  {t.s1_tag}
                </p>
                <h1 style={{ fontSize: "clamp(36px,6vw,48px)", fontWeight: 800, color: "#fff", margin: "0 0 14px", lineHeight: 1.1, letterSpacing: "-0.04em", whiteSpace: "pre-line" as const }}>
                  {t.s1_title}
                </h1>
                <p style={{ fontFamily: M, fontSize: 16, color: "rgba(255,255,255,0.6)", margin: "0 0 36px", lineHeight: 1.65 }}>
                  {t.s1_sub}
                </p>

                {/* Nome */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontFamily: M, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 10, letterSpacing: "0.02em" }}>
                    {t.s1_name_label}
                  </label>
                  <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canStep1 && setStep(2)}
                    placeholder={t.s1_name_ph} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.6)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }} />
                </div>

                {/* Nicho */}
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: "block", fontFamily: M, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 12, letterSpacing: "0.02em" }}>
                    {t.s1_niche_label}
                  </label>
                  <div className="niche-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                    {NICHES.map(n => {
                      const active = niche === n.value;
                      return (
                        <button key={n.value} onClick={() => setNiche(n.value)} style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 6, padding: "14px 6px", borderRadius: 14, cursor: "pointer",
                          background: active ? `${n.color}20` : "rgba(255,255,255,0.05)",
                          border: `2px solid ${active ? `${n.color}60` : "rgba(255,255,255,0.10)"}`,
                          transition: "all 0.15s",
                        }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}>
                          <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
                          <span style={{ fontFamily: M, fontSize: 10, textAlign: "center", lineHeight: 1.25, fontWeight: active ? 700 : 400, color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>
                            {n.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Terms */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 28 }}
                  onClick={() => setAcceptedTerms(!acceptedTerms)}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${acceptedTerms ? "#fff" : "rgba(255,255,255,0.25)"}`, background: acceptedTerms ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {acceptedTerms && <Check size={12} color="#000" />}
                  </div>
                  <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                    {t.s1_terms}{" "}
                    <a href="/terms" target="_blank" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.s1_terms_link}</a>
                    {" "}{t.s1_terms_and}{" "}
                    <a href="/privacy" target="_blank" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.s1_privacy_link}</a>
                  </span>
                </label>

                <motion.button onClick={() => setStep(2)} disabled={!canStep1}
                  whileHover={canStep1 ? { scale: 1.01 } : {}}
                  whileTap={canStep1 ? { scale: 0.99 } : {}}
                  style={{ width: "100%", padding: "16px 0", borderRadius: 16, background: canStep1 ? "#fff" : "rgba(255,255,255,0.08)", border: "none", cursor: canStep1 ? "pointer" : "not-allowed", color: canStep1 ? "#000" : "rgba(255,255,255,0.2)", fontSize: 15, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
                  {t.continue}
                </motion.button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div>
                <p style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase" as const }}>
                  {t.s2_tag}
                </p>
                <h1 style={{ fontSize: "clamp(32px,5vw,44px)", fontWeight: 800, color: "#fff", margin: "0 0 14px", lineHeight: 1.1, letterSpacing: "-0.04em", whiteSpace: "pre-line" as const }}>
                  {t.s2_title}
                </h1>
                <p style={{ fontFamily: M, fontSize: 15, color: "rgba(255,255,255,0.6)", margin: "0 0 24px", lineHeight: 1.6 }}>
                  {t.s2_sub}
                </p>

                {/* Before / After */}
                <div className="compare-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ padding: "16px", borderRadius: 16, background: "rgba(248,113,113,0.07)", border: "2px solid rgba(248,113,113,0.2)" }}>
                    <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "#f87171", letterSpacing: "0.12em", margin: "0 0 10px", textTransform: "uppercase" as const }}>{t.s2_generic_label}</p>
                    <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: 0, fontStyle: "italic" as const }}>{t.s2_generic}</p>
                  </div>
                  <motion.div style={{ padding: "16px", borderRadius: 16 }}
                    animate={{ background: revealed ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.04)", borderColor: revealed ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.10)", borderWidth: "2px", borderStyle: "solid" }}
                    transition={{ duration: 0.5 }}>
                    <motion.p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", margin: "0 0 10px", textTransform: "uppercase" as const }}
                      animate={{ color: revealed ? BLUE : "rgba(255,255,255,0.25)" }} transition={{ duration: 0.3 }}>
                      {t.s2_adbrief_label}
                    </motion.p>
                    <motion.p style={{ fontFamily: M, fontSize: 12, lineHeight: 1.6, margin: 0 }}
                      animate={{ color: revealed ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.15)" }} transition={{ duration: 0.5 }}>
                      {revealed ? t.s2_adbrief : "..."}
                    </motion.p>
                  </motion.div>
                </div>

                {/* O que a IA lê */}
                <div style={{ padding: "18px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.10)", marginBottom: 12 }}>
                  <p style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{t.s2_reads_label}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {t.s2_items.map((item: any, i: number) => (
                      <motion.div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}
                        animate={{ opacity: revealed ? 1 : i === 0 ? 0.4 : 0.15 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}>
                        <span style={{ fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>{item.text}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                    <p style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{t.s2_extras_label}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {t.s2_extras.map((extra: string, i: number) => (
                        <motion.div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}
                          animate={{ opacity: revealed ? 1 : 0.15 }}
                          transition={{ duration: 0.4, delay: (i + 4) * 0.08 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: CYAN, flexShrink: 0 }} />
                          <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{extra}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nota workspace */}
                <div style={{ padding: "14px 16px", borderRadius: 14, marginBottom: 28, background: "rgba(14,165,233,0.07)", border: "2px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, margin: 0 }}>{t.s2_note}</p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ padding: "14px 22px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 14, fontFamily: F, fontWeight: 600 }}>
                    {t.back}
                  </button>
                  <motion.button onClick={() => setStep(3)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "#fff", border: "none", cursor: "pointer", color: "#000", fontSize: 15, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {t.continue}
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div>
                <p style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase" as const }}>
                  {t.s3_tag}
                </p>
                <h1 style={{ fontSize: "clamp(36px,6vw,48px)", fontWeight: 800, color: "#fff", margin: "0 0 14px", lineHeight: 1.1, letterSpacing: "-0.04em", whiteSpace: "pre-line" as const }}>
                  {t.s3_title}
                </h1>
                <p style={{ fontFamily: M, fontSize: 15, color: "rgba(255,255,255,0.6)", margin: "0 0 32px", lineHeight: 1.65 }}>
                  {t.s3_sub}
                </p>

                {/* Nome da conta */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontFamily: M, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 10, letterSpacing: "0.02em" }}>{t.s3_name_label}</label>
                  <input ref={accountNameRef} value={accountName} onChange={e => setAccountName(e.target.value)}
                    placeholder={t.s3_name_ph} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.6)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }} />
                </div>

                {/* Descrição */}
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: "block", fontFamily: M, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 10, letterSpacing: "0.02em" }}>{t.s3_desc_label}</label>
                  <input value={accountDesc} onChange={e => setAccountDesc(e.target.value)}
                    placeholder={t.s3_desc_ph} style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.6)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }} />
                </div>

                {/* Conectar */}
                <div style={{ padding: "20px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.10)", marginBottom: 14 }}>
                  <p style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>{t.s3_connect_title}</p>
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.5 }}>{t.s3_connect_sub}</p>

                  {/* Security pills */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" as const }}>
                    {t.s3_security.map((s: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "rgba(14,165,233,0.09)", border: "1.5px solid rgba(14,165,233,0.25)" }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: CYAN }} />
                        <span style={{ fontFamily: M, fontSize: 12, color: "rgba(14,165,233,0.9)", fontWeight: 600 }}>{s}</span>
                      </div>
                    ))}
                  </div>

                  {/* Meta */}
                  <motion.button onClick={() => handleConnect("meta")} disabled={!canStep3 || connecting !== null}
                    whileHover={canStep3 && !connecting ? { scale: 1.01, boxShadow: "0 0 40px rgba(14,165,233,0.25)" } : {}}
                    whileTap={canStep3 && !connecting ? { scale: 0.99 } : {}}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 14, marginBottom: 8, border: "none", cursor: !canStep3 || connecting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s",
                      background: !canStep3 || connecting ? "rgba(255,255,255,0.07)" : `linear-gradient(135deg, ${BLUE}, ${CYAN})`,
                      color: !canStep3 || connecting ? "rgba(255,255,255,0.25)" : "#000" }}>
                    {connecting === "meta" ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />{t.s3_connecting_meta}</> : <><TrendingUp size={16} />{t.s3_meta}</>}
                  </motion.button>

                  {/* Google */}
                  <motion.button onClick={() => handleConnect("google")} disabled={!canStep3 || connecting !== null}
                    whileHover={canStep3 && !connecting ? { scale: 1.01 } : {}}
                    whileTap={canStep3 && !connecting ? { scale: 0.99 } : {}}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: `2px solid ${!canStep3 ? "rgba(255,255,255,0.10)" : "rgba(66,133,244,0.4)"}`, cursor: !canStep3 || connecting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(255,255,255,0.05)", color: !canStep3 || connecting ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.88)", transition: "all 0.2s" }}>
                    {connecting === "google" ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />{t.s3_connecting_google}</> : <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      {t.s3_google}
                    </>}
                  </motion.button>
                </div>

                {!canStep3 && (
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(251,146,60,0.8)", textAlign: "center", margin: "0 0 14px" }}>↑ {t.s3_fill_hint}</p>
                )}

                <button onClick={handleSkip} style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: "none", border: "2px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: F, marginBottom: canStep3 ? 8 : 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
                  {canStep3 ? t.s3_skip : t.skip}
                </button>
                {canStep3 && <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", margin: 0 }}>{t.s3_skip_note}</p>}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        button, input { touch-action: manipulation; }
        * { -webkit-tap-highlight-color: transparent; }
        /* Mobile optimizations */
        @media (max-width: 480px) {
          /* Nicho grid: 5 col no mobile fica muito pequeno, vai pra 3+2 */
          .niche-grid { grid-template-columns: repeat(3, 1fr) !important; }
          /* Padding geral menor */
          .onboarding-content { padding: 16px 16px 28px !important; }
          /* Header compacto */
          .onboarding-header { padding: 14px 16px !important; }
          /* Botões mais fáceis de toque */
          button { min-height: 44px; }
          /* H1 menor no mobile */
          .onboarding-h1 { font-size: clamp(28px,8vw,40px) !important; }
          /* Before/after empilhado no mobile */
          .compare-grid { grid-template-columns: 1fr !important; }
          /* Cards de conexão fullwidth */
        }
        @media (max-width: 360px) {
          .niche-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
