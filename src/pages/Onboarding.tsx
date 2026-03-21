// Onboarding v2 — 2026-03-20
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Loader2, ChevronRight, Zap, Shield, Eye, Zap as ZapIcon, BarChart3, Brain, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useObT } from "@/i18n/onboardingTranslations";
import type { Language } from "@/i18n/translations";

// ── Connect Meta Step — Tutorial Obsessivo ─────────────────────────────────────
function ConnectMetaStep({ lang, onConnect, onSkip }: { lang: string; onConnect: () => Promise<void>; onSkip: () => void }) {
  const [step, setStep] = useState<0|1|2|3>(0); // 0=why, 1=how, 2=what, 3=connect
  const [connecting, setConnecting] = useState(false);
  const [animIn, setAnimIn] = useState(true);
  const L = {
    pt: {
      progress: "Último passo",
      skip: "Pular por agora",
      connect_btn: "Conectar Meta Ads",
      connecting: "Redirecionando...",
      next: "Entendi →",
      // Step 0
      s0_tag: "POR QUÊ ISSO IMPORTA",
      s0_title: "Sem dados reais, a IA chuta.",
      s0_body: "O AdBrief não é como o ChatGPT — ele não dá respostas genéricas. Ele lê sua conta e responde com os seus números. Sem a conexão, ele não sabe o que está matando seu ROAS.",
      s0_before: "Com ChatGPT genérico",
      s0_before_ex: "\"Tente testar novos criativos e ajustar seu público-alvo...\"",
      s0_after: "Com AdBrief + seus dados",
      s0_after_ex: "\"Creative_042 tem hook rate de 8% — 3× abaixo do seu histórico. CPM subiu 38%. Pause agora.\"",
      // Step 1
      s1_tag: "COMO FUNCIONA",
      s1_title: "OAuth oficial. Você sempre tem controle.",
      s1_body: "A conexão usa o login oficial do Meta — o mesmo que você usa para dar acesso a uma agência. A gente só lê. Nunca escreve, nunca gasta, nunca publica nada sem você confirmar.",
      s1_items: ["Acesso somente leitura por padrão", "Você revoga quando quiser no Meta Business", "Nunca armazenamos sua senha", "Certificado SSL + criptografia em repouso"],
      // Step 2
      s2_tag: "O QUE A IA VÊ",
      s2_title: "Ela aprende como você pensa sobre performance.",
      s2_body: "Com cada pergunta que você faz, o AdBrief calibra o que importa pra você — e responde mais rápido nas próximas vezes.",
      s2_items: [
        { icon: "📊", label: "Métricas de campanha", desc: "ROAS, CPM, CTR, CPA em tempo real" },
        { icon: "🎬", label: "Performance por criativo", desc: "Hook rate, retenção, score de cada ad" },
        { icon: "🧠", label: "Padrões históricos", desc: "O que funcionou nos últimos 90 dias" },
        { icon: "💸", label: "Verba e orçamento", desc: "Onde o dinheiro está indo e o que cortar" },
      ],
      // Step 3
      s3_tag: "PRONTO PARA CONECTAR",
      s3_title: "Conecte agora e receba sua primeira análise em segundos.",
      s3_body: "A conexão Meta fica salva na sua conta AdBrief — só você tem acesso. Se você gerencia múltiplos clientes, conecte uma conta por vez em Contas.",
      s3_note: "🔒 Cada conta de anúncios fica isolada — apenas você vê os dados dela.",
    },
    en: {
      progress: "Last step",
      skip: "Skip for now",
      connect_btn: "Connect Meta Ads",
      connecting: "Redirecting...",
      next: "Got it →",
      s0_tag: "WHY THIS MATTERS",
      s0_title: "Without real data, the AI is just guessing.",
      s0_body: "AdBrief isn't like ChatGPT — it doesn't give generic answers. It reads your account and responds with your actual numbers. Without the connection, it doesn't know what's killing your ROAS.",
      s0_before: "With generic ChatGPT",
      s0_before_ex: "\"Try testing new creatives and adjusting your target audience...\"",
      s0_after: "With AdBrief + your data",
      s0_after_ex: "\"Creative_042 has 8% hook rate — 3× below your average. CPM spiked 38%. Pause it now.\"",
      s1_tag: "HOW IT WORKS",
      s1_title: "Official OAuth. You're always in control.",
      s1_body: "The connection uses Meta's official login — the same way you give access to an agency. We only read. We never write, spend, or publish anything without your confirmation.",
      s1_items: ["Read-only access by default", "Revoke anytime in Meta Business", "We never store your password", "SSL + encryption at rest"],
      s2_tag: "WHAT THE AI SEES",
      s2_title: "It learns how you think about performance.",
      s2_body: "With every question you ask, AdBrief calibrates what matters to you — and gets faster on the next round.",
      s2_items: [
        { icon: "📊", label: "Campaign metrics", desc: "ROAS, CPM, CTR, CPA in real time" },
        { icon: "🎬", label: "Creative performance", desc: "Hook rate, retention, score per ad" },
        { icon: "🧠", label: "Historical patterns", desc: "What worked in the last 90 days" },
        { icon: "💸", label: "Budget & spend", desc: "Where money is going and what to cut" },
      ],
      // Step 3
      s3_tag: "READY TO CONNECT",
      s3_title: "Connect now and get your first analysis in seconds.",
      s3_body: "Your Meta connection is saved to your AdBrief account — only you can access it. Managing multiple clients? Connect one account at a time from Accounts.",
      s3_note: "🔒 Each ad account is isolated — only you see its data.",
    },
    es: {
      progress: "Último paso",
      skip: "Saltar por ahora",
      connect_btn: "Conectar Meta Ads",
      connecting: "Redirigiendo...",
      next: "Entendido →",
      s0_tag: "POR QUÉ IMPORTA",
      s0_title: "Sin datos reales, la IA adivina.",
      s0_body: "AdBrief no es como ChatGPT — no da respuestas genéricas. Lee tu cuenta y responde con tus números reales. Sin la conexión, no sabe qué está matando tu ROAS.",
      s0_before: "Con ChatGPT genérico",
      s0_before_ex: "\"Intenta probar nuevos creativos y ajustar tu audiencia...\"",
      s0_after: "Con AdBrief + tus datos",
      s0_after_ex: "\"Creative_042 tiene hook rate de 8% — 3× bajo tu promedio. CPM subió 38%. Pausalo ahora.\"",
      s1_tag: "CÓMO FUNCIONA",
      s1_title: "OAuth oficial. Tú siempre tienes el control.",
      s1_body: "La conexión usa el login oficial de Meta — igual que cuando das acceso a una agencia. Solo leemos. Nunca escribimos, gastamos, ni publicamos nada sin tu confirmación.",
      s1_items: ["Acceso solo lectura por defecto", "Revocar cuando quieras en Meta Business", "Nunca guardamos tu contraseña", "SSL + cifrado en reposo"],
      s2_tag: "QUÉ VE LA IA",
      s2_title: "Aprende cómo piensas sobre performance.",
      s2_body: "Con cada pregunta que haces, AdBrief calibra lo que importa para ti — y responde más rápido la próxima vez.",
      s2_items: [
        { icon: "📊", label: "Métricas de campaña", desc: "ROAS, CPM, CTR, CPA en tiempo real" },
        { icon: "🎬", label: "Performance por creativo", desc: "Hook rate, retención, score por ad" },
        { icon: "🧠", label: "Patrones históricos", desc: "Lo que funcionó en los últimos 90 días" },
        { icon: "💸", label: "Presupuesto y gasto", desc: "Dónde va el dinero y qué cortar" },
      ],
      // Step 3
      s3_tag: "LISTO PARA CONECTAR",
      s3_title: "Conecta ahora y recibe tu primer análisis en segundos.",
      s3_body: "Tu conexión Meta queda guardada en tu cuenta AdBrief — solo tú tienes acceso. ¿Gestionas múltiples clientes? Conecta una cuenta a la vez desde Cuentas.",
      s3_note: "🔒 Cada cuenta de anuncios es aislada — solo tú ves sus datos.",
    },
  };
  const t = L[lang as keyof typeof L] || L.en;
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";

  const goTo = (n: 0|1|2|3) => {
    setAnimIn(false);
    setTimeout(() => { setStep(n); setAnimIn(true); }, 180);
  };

  return (
    <div style={{ fontFamily: F }}>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
        {[0,1,2,3].map(i => (
          <button key={i} onClick={() => goTo(i as 0|1|2|3)}
            style={{ width: i === step ? 24 : 7, height: 7, borderRadius: 4, background: i === step ? "#0ea5e9" : i < step ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }}/>
        ))}
      </div>

      {/* Card */}
      <div style={{ opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.22s ease" }}>

        {/* ── Slide 0: Por que importa ── */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: M, fontSize: 10, color: "#0ea5e9", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{t.s0_tag}</p>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12 }}>{t.s0_title}</h2>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>{t.s0_body}</p>
            </div>

            {/* Before/After */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(248,113,113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✕</div>
                  <span style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(248,113,113,0.8)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.s0_before}</span>
                </div>
                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>{t.s0_before_ex}</p>
              </div>
              <div style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 14, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</div>
                  <span style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.s0_after}</span>
                </div>
                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>{t.s0_after_ex}</p>
              </div>
            </div>

            <button onClick={() => goTo(1)}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {t.next}
            </button>
          </div>
        )}

        {/* ── Slide 1: Segurança ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: M, fontSize: 10, color: "#0ea5e9", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{t.s1_tag}</p>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12 }}>{t.s1_title}</h2>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>{t.s1_body}</p>
            </div>

            {/* Flow visual */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {[
                  { icon: "🔐", label: lang === "pt" ? "Seu login Meta" : lang === "es" ? "Tu login Meta" : "Your Meta login" },
                  null,
                  { icon: "🔒", label: "OAuth 2.0" },
                  null,
                  { icon: "📊", label: "AdBrief" },
                ].map((item, i) =>
                  item === null ? (
                    <div key={i} style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(14,165,233,0.4), rgba(14,165,233,0.2))", margin: "0 4px" }} />
                  ) : (
                    <div key={i} style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                      <p style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.4)", margin: 0 }}>{item.label}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {t.s1_items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)", borderRadius: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(52,211,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={10} color="#34d399" />
                  </div>
                  <span style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{item}</span>
                </div>
              ))}
            </div>

            <button onClick={() => goTo(2)}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {t.next}
            </button>
          </div>
        )}

        {/* ── Slide 2: O que a IA vê ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: M, fontSize: 10, color: "#0ea5e9", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{t.s2_tag}</p>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12 }}>{t.s2_title}</h2>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>{t.s2_body}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {t.s2_items.map((item, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 13px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            <button onClick={() => goTo(3)}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {t.next}
            </button>
          </div>
        )}

        {/* ── Slide 3: Conectar ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: M, fontSize: 10, color: "#0ea5e9", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{t.s3_tag}</p>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12 }}>{t.s3_title}</h2>
              <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>{t.s3_body}</p>
            </div>

            {/* Privacy note — per-user isolation */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
              <p style={{ fontFamily: M, fontSize: 12, color: "rgba(52,211,153,0.85)", margin: 0, lineHeight: 1.5 }}>
                {(t as any).s3_note || "Each ad account connection is private — only you can access it."}
              </p>
            </div>

            {/* What happens next visual */}
            <div style={{ background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 16, padding: "16px 18px" }}>
              {[
                { n: "1", text: lang === "pt" ? "Clica em conectar abaixo" : lang === "es" ? "Haz clic en conectar abajo" : "Click connect below" },
                { n: "2", text: lang === "pt" ? "Autoriza no login do Meta (leva 30s)" : lang === "es" ? "Autoriza en el login de Meta (30s)" : "Authorize in Meta login (takes 30s)" },
                { n: "3", text: lang === "pt" ? "Voltamos para cá automaticamente" : lang === "es" ? "Volvemos aquí automáticamente" : "We redirect you back automatically" },
                { n: "4", text: lang === "pt" ? "A IA carrega só os dados da sua conta" : lang === "es" ? "La IA carga solo los datos de tu cuenta" : "AI loads only your account's data" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "#0ea5e9" }}>{item.n}</span>
                  </div>
                  <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                </div>
              ))}
            </div>

            <button onClick={async () => { setConnecting(true); await onConnect(); }}
              disabled={connecting}
              style={{ width: "100%", padding: "15px", borderRadius: 13, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: connecting ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, letterSpacing: "-0.01em", boxShadow: "0 0 32px rgba(14,165,233,0.25)" }}>
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <span style={{ fontSize: 18 }}>🔗</span>}
              {connecting ? t.connecting : t.connect_btn}
            </button>

            <button onClick={onSkip}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: 12, fontFamily: M, padding: "4px 0" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)"; }}>
              {t.skip}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "name" | "language" | "source" | "feature" | "persona" | "plan" | "pain_point" | "connect";

interface OnboardingState {
  name: string;
  acceptedTerms: boolean;
  marketingEmails: boolean;
  language: string;
  source: string;
  sourceOther: string;
  feature: string;
  pain_point: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "en", label: "English",   flag: "🇺🇸" },
  { value: "pt", label: "Português", flag: "🇧🇷" },
  { value: "es", label: "Español",   flag: "🇪🇸" },
  { value: "hi", label: "Hindi",     flag: "🇮🇳" },
  { value: "fr", label: "Français",  flag: "🇫🇷" },
  { value: "de", label: "Deutsch",   flag: "🇩🇪" },
];

const SOURCES_STATIC = [
  { value: "twitter",    emoji: "𝕏" },
  { value: "youtube",    emoji: "▶️" },
  { value: "tiktok",     emoji: "🎵" },
  { value: "friend",     emoji: "👋" },
  { value: "linkedin",   emoji: "💼" },
  { value: "google",     emoji: "🔍" },
  { value: "newsletter", emoji: "📧" },
  { value: "other",      emoji: "✨" },
];

// Source labels that don't need translation (brand names)
const SOURCE_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  google: "Google Search",
  newsletter: "Newsletter",
};

const FEATURES_STATIC = [
  { value: "analyze",      url: "/dashboard/analyses/new", emoji: "🔍", accent: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)" },
  { value: "board",        url: "/dashboard/boards/new",   emoji: "🎬", accent: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  { value: "templates",    url: "/dashboard/templates",    emoji: "📋", accent: "#06b6d4", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)" },
  { value: "translate",    url: "/dashboard/translate",    emoji: "🌍", accent: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  { value: "preflight",    url: "/dashboard/preflight",    emoji: "✅", accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  { value: "intelligence", url: "/dashboard/intelligence", emoji: "🧠", accent: "#c084fc", bg: "rgba(192,132,252,0.08)", border: "rgba(192,132,252,0.2)" },
];

const PLAN_PRICES: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1T9seMDr9So14Xzt0vEJNQIX",
};

const PLANS = [
  { key: "maker",  label: "Maker",  price: "$19",  period: "/mo", features: ["50 AI messages/day", "1 ad account", "All tools unlocked", "3 personas"],                                  highlight: false, desc_key: "plan_desc_maker" },
  { key: "pro",    label: "Pro",    price: "$49",  period: "/mo", features: ["200 AI messages/day", "3 ad accounts", "All tools unlocked", "Unlimited personas", "Multi-market"],      highlight: true,  desc_key: "plan_desc_pro"   },
  { key: "studio", label: "Studio", price: "$149", period: "/mo", features: ["Unlimited messages", "Unlimited accounts", "All tools unlocked", "Agency workspace"],                    highlight: false, desc_key: "plan_desc_studio" },
];

const STEP_ORDER: Step[] = ["name", "pain_point", "plan", "connect"];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutPlan = searchParams.get("checkout");
  const checkoutBilling = searchParams.get("billing"); // "annual" | null
  const { language: globalLang, setLanguage: setGlobalLanguage } = useLanguage();
  const [step, setStep] = useState<Step>("name");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<OnboardingState>({
    name: "", acceptedTerms: false, marketingEmails: false,
    language: "", source: "", sourceOther: "", feature: "", pain_point: "",
  });

  // Use the selected onboarding language or fall back to global
  const activeLang = state.language || globalLang || "en";
  const ot = useObT(activeLang);

  useEffect(() => { if (step === "name") nameRef.current?.focus(); }, [step]);

  // Auto-trigger checkout if plan param was passed from signup
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false);
  useEffect(() => {
    if (step === "plan" && checkoutPlan && PLAN_PRICES[checkoutPlan] && !autoCheckoutTriggered) {
      setAutoCheckoutTriggered(true);
      handlePlanCheckout(checkoutPlan);
    }
  }, [step, checkoutPlan, autoCheckoutTriggered]);

  const stepIdx = STEP_ORDER.indexOf(step);
  const pct = Math.round(((stepIdx + 1) / STEP_ORDER.length) * 100);
  const set = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) =>
    setState(s => ({ ...s, [k]: v }));
  const goNext = () => { const i = STEP_ORDER.indexOf(step); if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]); };
  const goBack = () => { const i = STEP_ORDER.indexOf(step); if (i > 0) setStep(STEP_ORDER[i - 1]); };

  const saveOnboarding = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return null; }
    await supabase.from("profiles").update({
      name: state.name || undefined,
      preferred_language: state.language || undefined,
      onboarding_completed: true,
      onboarding_data: {
        source: state.source, sourceOther: state.sourceOther,
        feature: state.feature, marketingEmails: state.marketingEmails,
        pain_point: state.pain_point,
        completedAt: new Date().toISOString(),
      },
    } as never).eq("id", session.user.id);
    return session;
  };

  const finish = async () => {
    setSaving(true);
    try {
      const session = await saveOnboarding();
      if (!session) return;

      // Send welcome email for ALL new users (email signup + Google OAuth)
      supabase.functions.invoke('send-welcome-email', {
        body: {
          user_id: session.user.id,
          first_name: (state.name || session.user.user_metadata?.full_name || '').trim().split(' ')[0],
          language: state.language || navigator.language || 'en',
          pain_point: state.pain_point || '',
        }
      }).catch(() => {}); // silent fail — don't block

      // Save pain_point to ai_profile for personalizing first chat message
      if (state.pain_point) {
        try {
          await (supabase.from('user_ai_profile' as any) as any).upsert({
            user_id: session.user.id,
            pain_point: state.pain_point,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        } catch {}
      }

      const feat = FEATURES_STATIC.find(f => f.value === state.feature);
      toast.success("Welcome to AdBrief 🚀");
      navigate(feat?.url || "/dashboard/ai");
    } catch {
      toast.error(ot("skip_setup"));
      navigate("/dashboard/ai");
    } finally { setSaving(false); }
  };

  const handlePlanCheckout = async (planKey: string) => {
    setSaving(true);
    try {
      const session = await saveOnboarding();
      if (!session) return;

      // Send welcome email (fire-and-forget)
      supabase.functions.invoke('send-welcome-email', {
        body: {
          user_id: session.user.id,
          first_name: (state.name || session.user.user_metadata?.full_name || '').trim().split(' ')[0],
          language: state.language || navigator.language || 'en',
        }
      }).catch(() => {});

      const priceId = PLAN_PRICES[planKey];
      if (!priceId) { finish(); return; }
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: priceId, billing: checkoutBilling || undefined }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not start checkout");
        navigate("/dashboard/ai");
      }
    } catch {
      toast.error("Something went wrong");
      navigate("/dashboard/ai");
    } finally { setSaving(false); }
  };

  const skip = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("profiles").update({ onboarding_completed: true } as never).eq("id", session.user.id);
    } catch {}
    navigate("/dashboard/ai");
  };

  // Get translated source label
  const getSourceLabel = (value: string) => {
    if (value === "friend") return ot("src_friend");
    if (value === "other") return ot("src_other");
    return SOURCE_LABELS[value] || value;
  };

  // Get translated feature label + description
  const getFeatureLabel = (value: string) => {
    const map: Record<string, { label: string; desc: string }> = {
      analyze:      { label: ot("feat_analyze"),      desc: ot("feat_analyze_d") },
      board:        { label: ot("feat_board"),         desc: ot("feat_board_d") },
      templates:    { label: ot("feat_templates"),     desc: ot("feat_templates_d") },
      translate:    { label: ot("feat_translate"),     desc: ot("feat_translate_d") },
      preflight:    { label: ot("feat_preflight"),     desc: ot("feat_preflight_d") },
      intelligence: { label: ot("feat_intelligence"),  desc: ot("feat_intelligence_d") },
    };
    return map[value] || { label: value, desc: "" };
  };

  const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
  const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060606", fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <Logo size="md" />
        <button onClick={skip} className="text-[11px] text-white/15 hover:text-white/35 transition-colors" style={mono}>
          {ot("skip_setup")}
        </button>
      </div>

      {/* Progress */}
      <div className="h-px bg-white/[0.05] mx-6 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #0ea5e9, #06b6d4)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {/* ── Step 1: Name + Terms ── */}
          {step === "name" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 1 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("setup_title")}</h1>
                <p className="text-sm text-white/35">{ot("setup_sub")}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/30 mb-2">{ot("name_label")} <span className="text-white/15">({ot("name_opt")})</span></label>
                  <input ref={nameRef} type="text" value={state.name} onChange={e => set("name", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && goNext()} placeholder={ot("name_ph")}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/20 transition-colors" />
                </div>
                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("acceptedTerms", !state.acceptedTerms)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.acceptedTerms ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.acceptedTerms && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    {ot("terms_agree")} <a href="/terms" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>{ot("terms")}</a> {ot("and")} <a href="/privacy" target="_blank" className="text-white/60 underline underline-offset-2 hover:text-white" onClick={e => e.stopPropagation()}>{ot("privacy")}</a>
                  </span>
                </label>
                {/* Marketing */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => set("marketingEmails", !state.marketingEmails)}>
                  <div className={`h-5 w-5 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${state.marketingEmails ? "bg-white border-white" : "border-white/15 bg-white/[0.04] group-hover:border-white/30"}`}>
                    {state.marketingEmails && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs text-white/40 leading-relaxed">
                    {ot("marketing")} <span className="text-white/20">({ot("name_opt")})</span>
                  </span>
                </label>
              </div>
              <button onClick={goNext} disabled={!state.acceptedTerms}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                style={syne}>
                {ot("continue")} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Language ── */}
          {step === "language" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 2 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("lang_title")}</h1>
                <p className="text-sm text-white/35">{ot("lang_sub")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(lang => {
                  const active = state.language === lang.value;
                  return (
                    <button key={lang.value} onClick={() => {
                      set("language", lang.value);
                      // Sync with global language context immediately
                      const supportedLangs = ["en", "pt", "es", "fr", "de", "zh", "ar"];
                      if (supportedLangs.includes(lang.value)) {
                        setGlobalLanguage(lang.value as Language);
                      }
                      setTimeout(goNext, 220);
                    }}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150"
                      style={{ borderColor: active ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.07)", background: active ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.02)" }}>
                      <span className="text-xl">{lang.flag}</span>
                      <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-white/50"}`}>{lang.label}</span>
                      {active && <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">{ot("back")}</button>
                <button onClick={goNext} className="flex items-center gap-1 text-sm text-white/25 hover:text-white/50 transition-colors">{ot("skip")} <ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step: Connect Meta Ads — Tutorial Obsessivo ── */}
          {step === "connect" && (
            <ConnectMetaStep lang={activeLang} onConnect={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const { data } = await supabase.functions.invoke("meta-oauth", {
                  body: { action: "get_auth_url", user_id: session.user.id },
                });
                if (data?.url) window.location.href = data.url;
              } catch (e) { console.error(e); }
            }} onSkip={() => navigate("/dashboard/ai")} />
          )}

          {/* ── Step: Pain Point ── */}
          {step === "pain_point" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>
                  {ot("step_of")} 2 {ot("of")} {STEP_ORDER.length}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>
                  {state.language === "pt" ? "Qual é seu maior desafio com anúncios?" :
                   state.language === "es" ? "¿Cuál es tu mayor desafío con anuncios?" :
                   "What's your biggest challenge with paid ads?"}
                </h1>
                <p className="text-sm text-white/35">
                  {state.language === "pt" ? "Isso personaliza sua primeira resposta da IA." :
                   state.language === "es" ? "Esto personaliza tu primera respuesta de IA." :
                   "This personalizes your first AI response."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 mt-6">
                {[
                  { value: "roas_drop", en: "My ROAS keeps dropping and I don't know why", pt: "Meu ROAS cai e não sei por quê", es: "Mi ROAS baja y no sé por qué", emoji: "📉" },
                  { value: "creative_fatigue", en: "My ads fatigue too fast — need fresh creative constantly", pt: "Meus anúncios fatigam rápido demais", es: "Mis anuncios se fatigan demasiado rápido", emoji: "😩" },
                  { value: "hook_writing", en: "I struggle to write hooks that stop the scroll", pt: "Tenho dificuldade para escrever hooks que param o scroll", es: "Me cuesta escribir hooks que detengan el scroll", emoji: "✍️" },
                  { value: "scaling", en: "I can't scale without killing performance", pt: "Não consigo escalar sem destruir a performance", es: "No puedo escalar sin destruir el rendimiento", emoji: "📈" },
                  { value: "briefing", en: "Briefing my creative team takes too long", pt: "Briefar minha equipe criativa demora demais", es: "Hacer briefing a mi equipo creativo toma demasiado tiempo", emoji: "📋" },
                  { value: "analysis", en: "I spend too much time analyzing data manually", pt: "Gasto muito tempo analisando dados manualmente", es: "Paso demasiado tiempo analizando datos manualmente", emoji: "🔍" },
                ].map(opt => {
                  const label = state.language === "pt" ? opt.pt : state.language === "es" ? opt.es : opt.en;
                  const active = state.pain_point === opt.value;
                  return (
                    <button key={opt.value}
                      onClick={() => set("pain_point", opt.value)}
                      className="w-full text-left transition-all duration-150"
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: active ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.08)"}`,
                        display: "flex", alignItems: "center", gap: 12,
                        color: active ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: 14, fontFamily: "'Inter', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.emoji}</span>
                      <span style={{ lineHeight: 1.4 }}>{label}</span>
                      {active && <span style={{ marginLeft: "auto", color: "#0ea5e9", flexShrink: 0 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep(STEP_ORDER[STEP_ORDER.indexOf("pain_point") + 1])}
                disabled={!state.pain_point}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: state.pain_point ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.06)",
                  color: state.pain_point ? "#000" : "rgba(255,255,255,0.25)",
                  border: "none", cursor: state.pain_point ? "pointer" : "not-allowed",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 8,
                }}
              >
                {state.language === "pt" ? "Continuar →" : state.language === "es" ? "Continuar →" : "Continue →"}
              </button>
            </div>
          )}

          {/* ── Step 3: Plans ── */}
          {step === "plan" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <p className="text-[11px] text-white/20 uppercase tracking-[0.15em]" style={mono}>{ot("step_of")} 3 {ot("of")} {STEP_ORDER.length}</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ ...syne, letterSpacing: "-0.03em" }}>{ot("plan_title")}</h1>
                <p className="text-sm text-white/35">{ot("plan_sub")}</p>
                <p className="text-xs text-white/20 mt-1">🎉 {ot("plan_trial_note")}</p>
              </div>
              <div className="space-y-2.5">
                {PLANS.map(plan => (
                  <div key={plan.key} className="relative rounded-2xl border p-4"
                    style={{ borderColor: plan.highlight ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.07)", background: plan.highlight ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.02)" }}>
                    {plan.highlight && (
                      <span className="absolute top-3.5 right-3.5 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                        style={{ background: "rgba(14,165,233,0.2)", color: "#0ea5e9", ...mono }}>
                        {ot("plan_most_popular")}
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-1 pr-20">
                      <p className="font-bold text-white" style={syne}>{plan.label}</p>
                      <div><span className="text-lg font-bold text-white" style={syne}>{plan.price}</span><span className="text-xs text-white/30">{plan.period}</span></div>
                    </div>
                    <p className="text-[10px] text-white/25 mb-2">{ot("plan_trial_badge")}</p>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                      {plan.features.map(f => (
                        <li key={f} className="text-xs text-white/40 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => handlePlanCheckout(plan.key)} disabled={saving}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ background: plan.highlight ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.08)", color: plan.highlight ? "#fff" : "rgba(255,255,255,0.55)", ...syne }}>
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {ot("plan_setting_up")}</> : <><Zap className="h-3.5 w-3.5" /> {ot("plan_get")} {plan.label}</>}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-sm text-white/20 hover:text-white/45 transition-colors">{ot("back")}</button>
                <button onClick={finish} disabled={saving} className="text-xs text-white/15 hover:text-white/30 transition-colors">
                  {saving ? ot("plan_setting_up") : ot("plan_free")}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
