// Onboarding v5 — redesign completo com background animado + tipografia maior
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { trackEvent } from "@/lib/posthog";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Plus Jakarta Sans', system-ui, sans-serif";
const BLUE = "#0ea5e9";
const CYAN = "#06b6d4";

const T: Record<string, any> = {
  pt: {
    skip: "Pular",
    continue: "Continuar →",
    back: "Voltar",
    s1_tag: "PASSO 1 DE 2",
    s1_title: "Como a IA deve\nte chamar?",
    s1_sub: "E em qual setor você atua? A IA usa isso para personalizar o tom, o vocabulário e as recomendações em cada resposta.",
    s1_name_label: "Seu nome",
    s1_name_ph: "Ex: Carla",
    s1_niche_label: "Seu setor principal",
    s1_value_prop: "A IA lê ROAS, CTR, CPM em tempo real e diz o que pausar, escalar e testar.",
    s1_terms: "Concordo com os",
    s1_terms_and: "e a",
    s1_terms_link: "Termos de Uso",
    s1_privacy_link: "Política de Privacidade",
    s3_tag: "PASSO 2 DE 2",
    s3_urgency_title: "Conecte agora e desbloqueie:",
    s3_urgency_items: ["Alertas quando ROAS cair abaixo do esperado", "Diagnóstico automático de criativos fadigados", "Recomendações baseadas nos seus dados reais"],
    s3_title: "Crie sua\nprimeira conta.",
    s3_sub: "Uma conta = um cliente ou marca. Cada conta tem seus próprios dados e conexões. Você pode criar quantas quiser depois.",
    s3_name_label: "Nome da conta",
    s3_name_ph: "Ex: Loja da Carla, Agência XYZ, Minha Marca",
    s3_desc_label: "Descreva em uma linha (opcional)",
    s3_desc_ph: "Ex: E-commerce de moda feminina em SP",
    s3_connect_title: "Conecte Meta Ads a essa conta",
    s3_connect_sub: "OAuth oficial — só leitura. Nunca gastamos ou publicamos nada sem sua confirmação.",
    s3_meta: "Conectar conta de anúncios",
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
    s1_tag: "STEP 1 OF 2",
    s1_title: "What should the AI\ncall you?",
    s1_sub: "And what sector do you work in? The AI uses this to personalize the tone, vocabulary and recommendations in every response.",
    s1_name_label: "Your name",
    s1_name_ph: "e.g. James",
    s1_niche_label: "Your main sector",
    s1_value_prop: "The AI reads ROAS, CTR, CPM in real time and tells you what to pause, scale and test.",
    s1_terms: "I agree to the",
    s1_terms_and: "and",
    s1_terms_link: "Terms of Service",
    s1_privacy_link: "Privacy Policy",
    s3_tag: "STEP 2 OF 2",
    s3_urgency_title: "Connect now and unlock:",
    s3_urgency_items: ["Alerts when ROAS drops below expected", "Automatic fatigued creative diagnosis", "Recommendations based on your real data"],
    s3_title: "Create your\nfirst account.",
    s3_sub: "One account = one client or brand. Each has its own data and connections. You can create as many as you want later.",
    s3_name_label: "Account name",
    s3_name_ph: "e.g. My Store, Agency XYZ, Brand Name",
    s3_desc_label: "Describe in one line (optional)",
    s3_desc_ph: "e.g. Women's fashion e-commerce in NY",
    s3_connect_title: "Connect Meta Ads to this account",
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
    s1_tag: "PASO 1 DE 2",
    s1_title: "¿Cómo debe\nllamarte la IA?",
    s1_sub: "¿Y en qué sector trabajas? La IA usa esto para personalizar el tono, vocabulario y recomendaciones en cada respuesta.",
    s1_name_label: "Tu nombre",
    s1_name_ph: "Ej: Miguel",
    s1_niche_label: "Tu sector principal",
    s1_value_prop: "La IA lee ROAS, CTR, CPM en tiempo real y te dice qué pausar, escalar y probar.",
    s1_terms: "Acepto los",
    s1_terms_and: "y la",
    s1_terms_link: "Términos de Uso",
    s1_privacy_link: "Política de Privacidad",
    s3_tag: "PASO 2 DE 2",
    s3_urgency_title: "Conecta ahora y desbloquea:",
    s3_urgency_items: ["Alertas cuando el ROAS caiga", "Diagnóstico automático de creativos fatigados", "Recomendaciones basadas en tus datos reales"],
    s3_title: "Crea tu\nprimera cuenta.",
    s3_sub: "Una cuenta = un cliente o marca. Cada una tiene sus propios datos y conexiones. Puedes crear todas las que quieras después.",
    s3_name_label: "Nombre de la cuenta",
    s3_name_ph: "Ej: Mi Tienda, Agencia XYZ, Nombre de Marca",
    s3_desc_label: "Describe en una línea (opcional)",
    s3_desc_ph: "Ej: E-commerce de moda femenina en CDMX",
    s3_connect_title: "Conecta Meta Ads a esta cuenta",
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
  { value: "igaming",   label: "iGaming",     icon: "", color: "#f59e0b" },
  { value: "ecommerce", label: "E-commerce",  icon: "", color: "#06b6d4" },
  { value: "fitness",   label: "Fitness",      icon: "", color: "#34d399" },
  { value: "saas",      label: "SaaS / Tech",  icon: "", color: "#8b5cf6" },
  { value: "finance",   label: "Finanças",     icon: "", color: "#0ea5e9" },
  { value: "beauty",    label: "Beleza",       icon: "", color: "#f472b6" },
  { value: "education", label: "Educação",     icon: "", color: "#a78bfa" },
  { value: "food",      label: "Food & Resto", icon: "", color: "#fb923c" },
  { value: "health",    label: "Saúde",        icon: "", color: "#4ade80" },
  { value: "other",     label: "Outro",        icon: "", color: "#94a3b8" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan    = searchParams.get("checkout");
  const checkoutBilling = searchParams.get("billing");
  const redirectAfter   = searchParams.get("redirect"); // e.g. "/demo?unlocked=1"
  const { language: globalLang } = useLanguage();
  const lang = (["pt","en","es"].includes(globalLang) ? globalLang : "en") as "pt"|"en"|"es";
  const t = T[lang];

  const [step, setStep]             = useState<1|2>(1);
  const [connecting, setConnecting] = useState<"meta"|null>(null);
  const [name, setName]             = useState("");
  const [niche, setNiche]           = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountDesc, setAccountDesc] = useState("");
  const nameRef        = useRef<HTMLInputElement>(null);
  const accountNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 400);
    if (step === 2) setTimeout(() => accountNameRef.current?.focus(), 400);
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
          pain_point: [name ? `User: ${name}.` : "", niche ? `Niche: ${nicheObj?.label || niche}.` : ""].filter(Boolean).join(" "),
          last_updated: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch {}
    }
  };

  const createFirstAccount = async (session: any): Promise<string | null> => {
    const effectiveNiche = niche === "other" ? (customNiche.trim() || "other") : niche;
    const nicheObj = NICHES.find(n => n.value === niche);
    const personaName = accountName.trim() || (name ? name.split(" ")[0] : nicheObj?.label || "Minha conta");

    // 1. Check if persona already exists
    const { data: existing, error: selectErr } = await supabase.from("personas")
      .select("id").eq("user_id", session.user.id).limit(1);
    
    const resultPayload = { preferred_market: lang === "pt" ? "BR" : lang === "es" ? "MX" : "US", niche: effectiveNiche, industry: effectiveNiche, biz_description: accountDesc, name: personaName };

    if (existing?.length) {
      await supabase.from("personas").update({
        name: personaName,
        result: resultPayload,
      } as never).eq("id", (existing[0] as any).id);
      return (existing[0] as any).id as string;
    }

    // 2. Insert new persona
    const { data: inserted, error: insertError } = await supabase.from("personas").insert({
      user_id: session.user.id,
      name: personaName,
      result: resultPayload,
    } as never).select("id");

    
    if (!insertError && inserted?.length) {
      const newPersonaId = (inserted[0] as any).id as string;

      // Fire welcome email
      supabase.functions.invoke("send-welcome-email", {
        body: { user_id: session.user.id, email: session.user.email, first_name: name.trim().split(" ")[0] || personaName, language: lang }
      }).catch(() => {});

      // Fire business-profiler async — research this business so the AI knows it from day 1
      if (accountDesc || niche) {
        supabase.functions.invoke("business-profiler", {
          body: {
            user_id: session.user.id,
            persona_id: newPersonaId,
            product_name: personaName,
            niche,
            market: lang === "pt" ? "BR" : lang === "es" ? "MX" : "US",
          }
        }).catch(() => {});
      }

      return newPersonaId;
    }

    // 3. Try fetching again after failed insert
    const { data: retry, error: retryErr } = await supabase.from("personas")
      .select("id").eq("user_id", session.user.id).limit(1);
    
    return retry?.length ? (retry[0] as any).id as string : null;
  };

  const handleConnect = async (platform: "meta") => { // google disabled
    if (!accountName.trim()) return;
    setConnecting(platform);
    try {
      const session = await getSession();
      if (!session) return;
      await saveUserProfile(session);
      const personaId = await createFirstAccount(session);
      if (!personaId) throw new Error("Could not create account");
      const fn = "meta-oauth"; // google-oauth disabled
      const { data } = await supabase.functions.invoke(fn, {
        body: { action: "get_auth_url", user_id: session.user.id, persona_id: personaId }
      });
      if (data?.url) window.location.href = data.url;
      else throw new Error("No URL");
    } catch (err: any) {
      
      toast.error("Something went wrong: " + (err?.message || "unknown"));
      setConnecting(null);
    }
  };

  const handleSkip = async () => {
    try {
      const session = await getSession();
      if (session) {
        await saveUserProfile(session);
        // Always create first account when skipping step 2, even without accountName
        // createFirstAccount has fallback to name/niche if accountName is empty
        if (step === 2) {
          if (!accountName.trim()) {
            // Use name from step 1 as fallback account name
            setAccountName(name.trim().split(" ")[0] || "Minha conta");
          }
          await createFirstAccount(session);
          trackEvent("onboarding_completed");
        } else {
          trackEvent("onboarding_skipped");
        }
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
    navigate(redirectAfter || "/dashboard/ai");
  };

  const canStep1 = acceptedTerms && name.trim().length > 0;
  const canStep3 = accountName.trim().length > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box" as const,
    padding: "14px 18px", borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1.5px solid rgba(255,255,255,0.18)",
    color: "#fff", fontSize: 16, fontFamily: F,
    outline: "none", transition: "border-color 0.15s, background 0.15s",
  };



  return (
    <div style={{ minHeight: "100vh", background: "#07080f", fontFamily: F, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* ── Animated background orbs (same as signup) ── */}
      <div style={{ position: "fixed", width: 700, height: 700, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, hsla(199,83%,58%,0.13) 0%, transparent 60%)", filter: "blur(80px)", top: "10%", left: "20%" }} />
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, hsla(280,80%,60%,0.10) 0%, transparent 60%)", filter: "blur(80px)", top: "50%", right: "10%" }} />
      <div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle, hsla(180,70%,50%,0.07) 0%, transparent 60%)", filter: "blur(60px)", bottom: "10%", left: "10%" }} />

      {/* Grid pattern */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.035, backgroundImage: "linear-gradient(rgba(14,165,233,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.6) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Floating particles */}
      {/* particles removed - framer-motion v12 array keyframe issue */}

      {/* ── Header ── */}
      <div className="onboarding-header" style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", flexShrink: 0 }}>
        <Logo size="md" />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {([1,2] as const).map(n => (
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
        <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`, width: `${((step - 1) / 1) * 100}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>

      {/* ── Content ── */}
      <div className="onboarding-content" style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "32px 20px 40px", overflowY: "auto" as const }}>
        <div key={step} style={{ width: "100%", maxWidth: 520, animation: "stepIn 0.25s cubic-bezier(0.4,0,0.2,1)" }}>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div>
                <p style={{ fontFamily: M, fontSize: 12, fontWeight: 700, color: BLUE, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase" as const }}>
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
                          <span style={{ fontFamily: M, fontSize: 12, textAlign: "center", lineHeight: 1.25, fontWeight: active ? 700 : 400, color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>
                            {n.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom niche input — aparece só quando "Outro" selecionado */}
                  {niche === "other" && (
                    <div style={{ marginTop: 10 }}>
                      <input
                        autoFocus
                        type="text"
                        value={customNiche}
                        onChange={e => setCustomNiche(e.target.value)}
                        placeholder={lang === "pt" ? "Ex: Imóveis, Saúde, Jurídico..." : lang === "es" ? "Ej: Inmobiliaria, Salud..." : "E.g. Real estate, Health, Legal..."}
                        style={{
                          width: "100%", boxSizing: "border-box" as const,
                          padding: "12px 16px", borderRadius: 12,
                          background: "rgba(255,255,255,0.07)",
                          border: "1.5px solid rgba(14,165,233,0.35)",
                          color: "#fff", fontSize: 14, fontFamily: F,
                          outline: "none",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Mini value prop */}
                <div style={{ padding: "14px 16px", borderRadius: 14, marginBottom: 20, background: "rgba(14,165,233,0.07)", border: "1.5px solid rgba(14,165,233,0.18)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}></span>
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.55, margin: 0 }}>{t.s1_value_prop}</p>
                </div>

                {/* Terms */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 28 }}
                  onClick={() => setAcceptedTerms(!acceptedTerms)}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${acceptedTerms ? "#fff" : "rgba(255,255,255,0.25)"}`, background: acceptedTerms ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {acceptedTerms && <Check size={12} color="#000" />}
                  </div>
                  <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                    {t.s1_terms}{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.s1_terms_link}</a>
                    {" "}{t.s1_terms_and}{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline", textUnderlineOffset: 3 }}>{t.s1_privacy_link}</a>
                  </span>
                </label>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => navigate(-1 as any)}
                    style={{ padding: "14px 20px", borderRadius: 14, background: "none", border: "1.5px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: F, fontWeight: 500, transition: "all 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
                    {t.back}
                  </button>
                  <button onClick={() => setStep(2)} disabled={!canStep1}
                    style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: canStep1 ? "#fff" : "rgba(255,255,255,0.08)", border: "none", cursor: canStep1 ? "pointer" : "not-allowed", color: canStep1 ? "#000" : "rgba(255,255,255,0.2)", fontSize: 15, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
                    {t.continue}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div>
                <p style={{ fontFamily: M, fontSize: 12, fontWeight: 700, color: BLUE, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase" as const }}>
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

                  {/* Urgency items */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: M, fontSize: 12, fontWeight: 700, color: "rgba(52,211,153,0.9)", letterSpacing: "0.08em", margin: "0 0 10px", textTransform: "uppercase" as const }}>{t.s3_urgency_title}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {t.s3_urgency_items.map((item: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
                          <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meta */}
                  <button onClick={() => handleConnect("meta")} disabled={!canStep3 || connecting !== null}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 14, marginBottom: 8, border: "none", cursor: !canStep3 || connecting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s",
                      background: !canStep3 || connecting ? "rgba(255,255,255,0.07)" : `linear-gradient(135deg, ${BLUE}, ${CYAN})`,
                      color: !canStep3 || connecting ? "rgba(255,255,255,0.25)" : "#000" }}>
                    {connecting === "meta" ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />{t.s3_connecting_meta}</> : <><TrendingUp size={16} />{t.s3_meta}</>}
                  </button>

                  {/* Google connect button — disabled (see GOOGLE_ADS_BACKUP.md) */}
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

        </div>
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
        @keyframes stepIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
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
// build bump Sun Apr  5 18:06:04 UTC 2026
