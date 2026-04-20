import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, Zap, TrendingUp, ArrowRight, Lock, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const F = "'Plus Jakarta Sans', sans-serif";
const A = "#0ea5e9";

// ── Onboarding Steps ─────────────────────────────────────────────────────────

interface Step {
  tag: string;
  title: string;
  subtitle: string;
  features: { icon: React.ElementType; label: string; desc: string }[];
  cta: string;
}

const STEPS: Record<string, Step[]> = {
  pt: [
    {
      tag: "BEM-VINDO",
      title: "Sua IA de performance criativa",
      subtitle: "AdBrief analisa seus anúncios em tempo real e diz exatamente o que escalar, pausar e criar.",
      features: [
        { icon: Eye, label: "Análise em tempo real", desc: "CTR, ROAS, frequência — monitoramento contínuo" },
        { icon: Zap, label: "Decisões automáticas", desc: "Alertas de fadiga, oportunidades de escala, cortes urgentes" },
        { icon: TrendingUp, label: "Inteligência criativa", desc: "Hooks, roteiros e briefs gerados pelos seus dados reais" },
      ],
      cta: "Começar",
    },
    {
      tag: "CONEXÃO SEGURA",
      title: "Conecte o Meta Ads",
      subtitle: "Precisamos de acesso de leitura à sua conta para analisar seus anúncios. Não fazemos alterações sem sua permissão.",
      features: [
        { icon: Shield, label: "Somente leitura", desc: "Acessamos métricas e criativos — nunca modificamos campanhas" },
        { icon: Lock, label: "Criptografia ponta a ponta", desc: "Suas credenciais nunca são armazenadas nos nossos servidores" },
        { icon: Eye, label: "Você controla tudo", desc: "Desconecte a qualquer momento em Contas → Configurações" },
      ],
      cta: "Conectar Meta Ads",
    },
  ],
  en: [
    {
      tag: "WELCOME",
      title: "Your creative performance AI",
      subtitle: "AdBrief analyzes your ads in real time and tells you exactly what to scale, pause, and create.",
      features: [
        { icon: Eye, label: "Real-time analysis", desc: "CTR, ROAS, frequency — continuous monitoring" },
        { icon: Zap, label: "Automatic decisions", desc: "Fatigue alerts, scale opportunities, urgent cuts" },
        { icon: TrendingUp, label: "Creative intelligence", desc: "Hooks, scripts and briefs generated from your real data" },
      ],
      cta: "Get started",
    },
    {
      tag: "SECURE CONNECTION",
      title: "Connect Meta Ads",
      subtitle: "We need read-only access to your account to analyze your ads. We never make changes without your permission.",
      features: [
        { icon: Shield, label: "Read-only access", desc: "We access metrics and creatives — never modify campaigns" },
        { icon: Lock, label: "End-to-end encryption", desc: "Your credentials are never stored on our servers" },
        { icon: Eye, label: "You're in control", desc: "Disconnect anytime in Accounts → Settings" },
      ],
      cta: "Connect Meta Ads",
    },
  ],
  es: [
    {
      tag: "BIENVENIDO",
      title: "Tu IA de performance creativa",
      subtitle: "AdBrief analiza tus anuncios en tiempo real y te dice exactamente qué escalar, pausar y crear.",
      features: [
        { icon: Eye, label: "Análisis en tiempo real", desc: "CTR, ROAS, frecuencia — monitoreo continuo" },
        { icon: Zap, label: "Decisiones automáticas", desc: "Alertas de fatiga, oportunidades de escala, cortes urgentes" },
        { icon: TrendingUp, label: "Inteligencia creativa", desc: "Hooks, guiones y briefs generados de tus datos reales" },
      ],
      cta: "Comenzar",
    },
    {
      tag: "CONEXIÓN SEGURA",
      title: "Conecta Meta Ads",
      subtitle: "Necesitamos acceso de lectura a tu cuenta para analizar tus anuncios. No hacemos cambios sin tu permiso.",
      features: [
        { icon: Shield, label: "Solo lectura", desc: "Accedemos a métricas y creativos — nunca modificamos campañas" },
        { icon: Lock, label: "Cifrado de extremo a extremo", desc: "Tus credenciales nunca se almacenan en nuestros servidores" },
        { icon: Eye, label: "Tú controlas todo", desc: "Desconecta en cualquier momento en Cuentas → Configuración" },
      ],
      cta: "Conectar Meta Ads",
    },
  ],
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = language === "pt" || language === "es" ? language : "en";
  const steps = STEPS[lang] || STEPS.pt;
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const goNext = () => {
    if (isLast) {
      navigate('/dashboard/accounts');
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 200);
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#060a14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: F,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: `radial-gradient(ellipse, ${A}08 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{
        maxWidth: 520, width: '100%',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.4s ease',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 40 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 6, height: 6, borderRadius: 99,
              background: i === step ? A : 'rgba(255,255,255,0.08)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Card */}
        <div style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(8px)' : 'translateY(0)',
          transition: 'all 0.2s ease',
        }}>
          {/* Tag */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: A, background: `${A}10`, padding: '4px 12px',
              borderRadius: 99, border: `1px solid ${A}20`,
            }}>
              {current.tag}
            </span>
          </div>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#eef0f6', letterSpacing: '-0.04em' }}>ad</span>
            <span style={{ fontSize: 28, fontWeight: 900, background: `linear-gradient(135deg, #38bdf8, #06b6d4)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.04em' }}>brief</span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800,
            color: '#f0f2f8', letterSpacing: '-0.03em',
            lineHeight: 1.15, textAlign: 'center',
            margin: '0 0 10px',
          }}>
            {current.title}
          </h1>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.65, textAlign: 'center',
            margin: '0 auto 36px', maxWidth: 380,
          }}>
            {current.subtitle}
          </p>

          {/* Feature cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
            {current.features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: `${A}08`, border: `1px solid ${A}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon size={15} color={A} strokeWidth={1.8} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f8', margin: '0 0 3px' }}>{f.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={goNext}
            style={{
              width: '100%', padding: '14px 24px',
              background: isLast ? '#2563eb' : A,
              color: '#fff', border: 'none',
              borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: F,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s ease',
              boxShadow: `0 0 24px ${isLast ? 'rgba(37,99,235,0.25)' : `${A}20`}`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            {isLast ? (
              <>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {current.cta}
              </>
            ) : (
              <>
                {current.cta}
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>

          {/* Skip */}
          {!isLast && (
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                margin: '14px auto 0', background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer',
                fontFamily: F, transition: 'color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'; }}
            >
              {lang === 'pt' ? 'Pular' : lang === 'es' ? 'Saltar' : 'Skip'}
              <ChevronRight size={12} />
            </button>
          )}

          {/* Trust badge */}
          {isLast && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
              <Lock size={11} color="rgba(255,255,255,0.20)" />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)', margin: 0, fontFamily: F }}>
                {lang === 'pt' ? 'Conexão segura · Dados criptografados' : lang === 'es' ? 'Conexión segura · Datos cifrados' : 'Secure connection · Encrypted data'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
