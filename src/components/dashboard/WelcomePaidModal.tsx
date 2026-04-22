// WelcomePaidModal — shown once after a successful Stripe checkout.
// Replaces the previous sonner toast with a full-screen celebratory moment.
// Design stays restrained (no confetti) to match AdBrief's premium aesthetic.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Check, ArrowRight, Sparkles, LayoutGrid, Gauge, Send, Crown,
  type LucideIcon,
} from "lucide-react";

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Plus Jakarta Sans', system-ui, sans-serif";

type Lang = "pt" | "es" | "en";
type Plan = "maker" | "pro" | "studio";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: string | null | undefined;
  firstName: string | null | undefined;
  language: string;
}

// ── Copy ──────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, {
  pill: string;
  welcome: (plan: string, name: string | null) => string;
  trial: (date: string) => string;
  unlocked: string;
  primary: string;
  manage: string;
}> = {
  pt: {
    pill: "Ativo",
    welcome: (plan, name) => name ? `Bem-vindo ao ${plan}, ${name}` : `Bem-vindo ao ${plan}`,
    trial: (d) => `3 dias grátis. Sem cobrança até ${d}.`,
    unlocked: "DESBLOQUEADO",
    primary: "Começar",
    manage: "Gerenciar assinatura",
  },
  es: {
    pill: "Activo",
    welcome: (plan, name) => name ? `Bienvenido a ${plan}, ${name}` : `Bienvenido a ${plan}`,
    trial: (d) => `3 días gratis. Sin cargo hasta el ${d}.`,
    unlocked: "DESBLOQUEADO",
    primary: "Comenzar",
    manage: "Gestionar suscripción",
  },
  en: {
    pill: "Active",
    welcome: (plan, name) => name ? `Welcome to ${plan}, ${name}` : `Welcome to ${plan}`,
    trial: (d) => `3 days free. No charge until ${d}.`,
    unlocked: "UNLOCKED",
    primary: "Get started",
    manage: "Manage subscription",
  },
};

// ── Per-plan feature list ─────────────────────────────────────────────────────
// Each line is [icon, copy per language]. Icon choice leans on lucide semantics:
// Sparkles=AI, LayoutGrid=accounts, Gauge=usage, Send=telegram, Crown=premium.
type Feature = { icon: LucideIcon; label: Record<Lang, string> };

const FEATURES: Record<Plan, Feature[]> = {
  maker: [
    { icon: Sparkles,   label: { pt: "IA com dados da sua conta",   en: "AI trained on your account",      es: "IA con datos de tu cuenta" } },
    { icon: LayoutGrid, label: { pt: "1 conta de anúncios",          en: "1 ad account",                    es: "1 cuenta de anuncios" } },
    { icon: Gauge,      label: { pt: "~33 melhorias por mês",        en: "~33 improvements per month",      es: "~33 mejoras por mes" } },
    { icon: Send,       label: { pt: "Alertas no Telegram",          en: "Telegram alerts",                 es: "Alertas en Telegram" } },
  ],
  pro: [
    { icon: Sparkles,   label: { pt: "IA com dados das suas contas", en: "AI trained on your accounts",     es: "IA con datos de tus cuentas" } },
    { icon: LayoutGrid, label: { pt: "3 contas de anúncios",         en: "3 ad accounts",                   es: "3 cuentas de anuncios" } },
    { icon: Gauge,      label: { pt: "~166 melhorias por mês",       en: "~166 improvements per month",     es: "~166 mejoras por mes" } },
    { icon: Send,       label: { pt: "Alertas no Telegram",          en: "Telegram alerts",                 es: "Alertas en Telegram" } },
  ],
  studio: [
    { icon: Sparkles,   label: { pt: "IA com dados ilimitados",      en: "AI with unlimited data",          es: "IA con datos ilimitados" } },
    { icon: LayoutGrid, label: { pt: "Contas ilimitadas",             en: "Unlimited accounts",              es: "Cuentas ilimitadas" } },
    { icon: Gauge,      label: { pt: "Melhorias ilimitadas",          en: "Unlimited improvements",          es: "Unlimited improvements" } },
    { icon: Crown,      label: { pt: "Suporte prioritário",           en: "Priority support",                es: "Soporte prioritario" } },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const PLAN_DISPLAY: Record<string, string> = {
  maker: "Maker", pro: "Pro", studio: "Studio",
  // Legacy aliases — defensive in case webhook writes old name
  creator: "Maker", starter: "Pro", scale: "Studio",
};

const normalizePlan = (p: string | null | undefined): Plan | null => {
  if (!p) return null;
  const k = p.toLowerCase();
  if (k === "maker" || k === "creator") return "maker";
  if (k === "pro" || k === "starter") return "pro";
  if (k === "studio" || k === "scale") return "studio";
  return null;
};

const formatTrialEnd = (lang: Lang): string => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);
  } catch {
    // Fallback if Intl is missing (very old browsers)
    return d.toLocaleDateString();
  }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function WelcomePaidModal({ open, onClose, plan, firstName, language }: Props) {
  const navigate = useNavigate();
  const primaryRef = useRef<HTMLButtonElement>(null);

  const lang: Lang = (language === "pt" || language === "es" || language === "en") ? language : "pt";
  const planKey = normalizePlan(plan);
  const t = COPY[lang];

  // Focus primary CTA on mount for keyboard users
  useEffect(() => {
    if (open && primaryRef.current) {
      const id = window.setTimeout(() => primaryRef.current?.focus(), 350);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !planKey) return null;

  const planName = PLAN_DISPLAY[planKey] || (plan ?? "");
  const name = (firstName ?? "").trim() || null;
  const trialEnd = formatTrialEnd(lang);
  const features = FEATURES[planKey];

  const handlePrimary = () => { onClose(); };
  const handleManage = () => { onClose(); navigate("/dashboard/settings"); };

  return (
    <>
      <style>{`
        @keyframes wpmFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wpmCardIn {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes wpmStagger {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wpmGlow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.04); }
        }
        @keyframes wpmGlint {
          0%   { opacity: 0;   transform: scale(0.6) rotate(0deg); }
          40%  { opacity: 1;   transform: scale(1)   rotate(90deg); }
          100% { opacity: 0;   transform: scale(0.6) rotate(180deg); }
        }
        .wpm-backdrop { animation: wpmFadeIn 0.22s ease-out both; }
        .wpm-card     { animation: wpmCardIn  0.40s cubic-bezier(.23,1,.32,1) both; }
        .wpm-stagger  { animation: wpmStagger 0.35s cubic-bezier(.23,1,.32,1) both; }
        .wpm-glow     { animation: wpmGlow    4.5s ease-in-out infinite; }
        .wpm-glint    { animation: wpmGlint   2.2s ease-in-out infinite; }
      `}</style>

      <div
        className="wpm-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpm-title"
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(14px)",
          overflowY: "auto",
        }}
        onClick={onClose}
      >
        {/* Soft radial glow behind the card */}
        <div
          className="wpm-glow"
          aria-hidden
          style={{
            position: "absolute", top: "50%", left: "50%",
            width: 720, height: 720, transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(14,165,233,0.22), transparent 62%)",
            pointerEvents: "none",
            filter: "blur(10px)",
          }}
        />

        {/* Subtle glints — 3 restrained sparkles, no confetti */}
        {[
          { top: "22%",  left: "12%", delay: "0s",   size: 14 },
          { top: "68%",  left: "84%", delay: "0.7s", size: 12 },
          { top: "18%",  left: "82%", delay: "1.4s", size: 10 },
        ].map((g, i) => (
          <div
            key={i}
            className="wpm-glint"
            aria-hidden
            style={{
              position: "absolute", top: g.top, left: g.left,
              width: g.size, height: g.size, pointerEvents: "none",
              animationDelay: g.delay,
            }}
          >
            <Sparkles size={g.size} color="#0ea5e9" strokeWidth={2} />
          </div>
        ))}

        {/* Card */}
        <div
          className="wpm-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%", maxWidth: 480,
            background: "linear-gradient(180deg, #0f1520 0%, #0a0e17 100%)",
            border: "1px solid rgba(14,165,233,0.25)",
            borderRadius: 22,
            padding: "32px 28px 24px",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.03) inset, " +
              "0 32px 80px rgba(0,0,0,0.65), " +
              "0 0 80px rgba(14,165,233,0.10)",
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 14, right: 14,
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            <X size={13} color="rgba(255,255,255,0.45)" />
          </button>

          {/* Plan pill */}
          <div
            className="wpm-stagger"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 12px", borderRadius: 20,
              background: "rgba(14,165,233,0.10)",
              border: "1px solid rgba(14,165,233,0.28)",
              animationDelay: "0.05s",
            }}
          >
            <Check size={11} color="#0ea5e9" strokeWidth={3} />
            <span style={{
              fontFamily: F, fontSize: 11, fontWeight: 700,
              color: "#0ea5e9", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {planName} · {t.pill}
            </span>
          </div>

          {/* Headline */}
          <h2
            id="wpm-title"
            className="wpm-stagger"
            style={{
              fontFamily: F, fontSize: 28, fontWeight: 900,
              color: "#fff", letterSpacing: "-0.035em", lineHeight: 1.15,
              margin: "18px 0 8px",
              animationDelay: "0.12s",
            }}
          >
            {t.welcome(planName, name)}
          </h2>

          {/* Trial subtext */}
          <p
            className="wpm-stagger"
            style={{
              fontFamily: M, fontSize: 14, lineHeight: 1.55,
              color: "rgba(255,255,255,0.52)",
              margin: 0,
              animationDelay: "0.18s",
            }}
          >
            {t.trial(trialEnd)}
          </p>

          {/* Divider */}
          <div
            className="wpm-stagger"
            aria-hidden
            style={{
              height: 1, background: "rgba(255,255,255,0.06)",
              margin: "22px 0 16px",
              animationDelay: "0.24s",
            }}
          />

          {/* Section header */}
          <p
            className="wpm-stagger"
            style={{
              fontFamily: F, fontSize: 10.5, fontWeight: 700,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.14em",
              margin: "0 0 12px",
              animationDelay: "0.28s",
            }}
          >
            {t.unlocked}
          </p>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="wpm-stagger"
                  style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "9px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    animationDelay: `${0.34 + i * 0.06}s`,
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: "rgba(14,165,233,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={13} color="#0ea5e9" strokeWidth={2.2} />
                  </div>
                  <span style={{
                    fontFamily: M, fontSize: 13.5, fontWeight: 500,
                    color: "rgba(255,255,255,0.82)", lineHeight: 1.35,
                  }}>
                    {f.label[lang]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Primary CTA */}
          <button
            ref={primaryRef}
            onClick={handlePrimary}
            className="wpm-stagger"
            style={{
              fontFamily: F, fontSize: 14, fontWeight: 700,
              width: "100%", padding: "13px 18px", borderRadius: 12,
              background: "#0ea5e9", color: "#fff",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: "0 0 24px rgba(14,165,233,0.28)",
              transition: "transform 0.12s, box-shadow 0.12s",
              animationDelay: `${0.34 + features.length * 0.06 + 0.05}s`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 0 32px rgba(14,165,233,0.40)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 0 24px rgba(14,165,233,0.28)";
            }}
          >
            {t.primary}
            <ArrowRight size={14} />
          </button>

          {/* Manage subscription — ghost link */}
          <button
            onClick={handleManage}
            className="wpm-stagger"
            style={{
              fontFamily: M, fontSize: 12.5, fontWeight: 500,
              width: "100%", padding: "10px 0 0",
              background: "transparent", color: "rgba(255,255,255,0.38)",
              border: "none", cursor: "pointer",
              textAlign: "center",
              transition: "color 0.15s",
              animationDelay: `${0.34 + features.length * 0.06 + 0.11}s`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.38)")}
          >
            {t.manage}
          </button>
        </div>
      </div>
    </>
  );
}
