import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, BarChart3, FileText,
  Target, Sparkles, Globe, ShoppingBag, Gamepad2,
  TrendingUp, Heart, Laugh, AlertTriangle, Eye, Star, Users, Monitor, Film, Tv2, Smartphone,
} from "lucide-react";
import type { Profile } from "./DashboardLayout";
import { useLanguage } from "@/i18n/LanguageContext";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'DM Mono', monospace" } as React.CSSProperties;

interface LiteModeProps {
  profile: Profile | null;
  onSwitchToPro: () => void;
}

const GOALS_EN = [
  { id: "analyze",   emoji: "📊", label: "Score my hook",            desc: "0–10 hook score + exact fixes",              route: "/dashboard/analyses/new" },
  { id: "script",    emoji: "✍️", label: "Write a video script",      desc: "Full script from a single prompt",           route: "/dashboard/script" },
  { id: "brief",     emoji: "🎬", label: "Create a production brief", desc: "Scene-by-scene brief ready for your editor", route: "/dashboard/boards/new" },
  { id: "preflight", emoji: "✅", label: "Pre-flight check",          desc: "Catch mistakes before you spend a dollar",   route: "/dashboard/preflight" },
  { id: "hooks",     emoji: "⚡", label: "Generate hook variations",  desc: "10+ hooks for the same concept",             route: "/dashboard/hooks" },
  { id: "persona",   emoji: "🧠", label: "Build an audience persona", desc: "Deep profile of who you're targeting",       route: "/dashboard/persona" },
];

const GOALS_PT = [
  { id: "analyze",   emoji: "📊", label: "Avaliar meu hook",              desc: "Nota 0–10 + melhorias exatas",                  route: "/dashboard/analyses/new" },
  { id: "script",    emoji: "✍️", label: "Escrever um script de vídeo",   desc: "Script completo a partir de um único prompt",   route: "/dashboard/script" },
  { id: "brief",     emoji: "🎬", label: "Criar um brief de produção",    desc: "Brief cena a cena pronto para o editor",        route: "/dashboard/boards/new" },
  { id: "preflight", emoji: "✅", label: "Revisão pré-lançamento",        desc: "Pegue erros antes de gastar um centavo",        route: "/dashboard/preflight" },
  { id: "hooks",     emoji: "⚡", label: "Gerar variações de hook",       desc: "10+ hooks para o mesmo conceito",               route: "/dashboard/hooks" },
  { id: "persona",   emoji: "🧠", label: "Criar persona de audiência",    desc: "Perfil profundo de quem você está segmentando", route: "/dashboard/persona" },
];

const GOALS_ES = [
  { id: "analyze",   emoji: "📊", label: "Puntuar mi hook",               desc: "Puntuación 0–10 + mejoras exactas",             route: "/dashboard/analyses/new" },
  { id: "script",    emoji: "✍️", label: "Escribir un script de video",   desc: "Script completo desde un solo prompt",          route: "/dashboard/script" },
  { id: "brief",     emoji: "🎬", label: "Crear un brief de producción",  desc: "Brief escena a escena listo para tu editor",    route: "/dashboard/boards/new" },
  { id: "preflight", emoji: "✅", label: "Revisión pre-lanzamiento",      desc: "Detecta errores antes de gastar un peso",       route: "/dashboard/preflight" },
  { id: "hooks",     emoji: "⚡", label: "Generar variaciones de hook",   desc: "10+ hooks para el mismo concepto",              route: "/dashboard/hooks" },
  { id: "persona",   emoji: "🧠", label: "Construir persona de audiencia","desc": "Perfil profundo de a quién estás apuntando",  route: "/dashboard/persona" },
];
const PLATFORMS = [
  { id: "tiktok",    emoji: "🎵", label: "TikTok" },
  { id: "facebook",  emoji: "👤", label: "Facebook" },
  { id: "instagram", emoji: "📸", label: "Reels" },
  { id: "youtube",   emoji: "▶️", label: "YouTube" },
];

const INDUSTRIES = [
  { id: "ecommerce", emoji: "🛍️", label: "E-commerce" },
  { id: "igaming",   emoji: "🎮", label: "iGaming" },
  { id: "saas",      emoji: "💻", label: "SaaS / App" },
  { id: "finance",   emoji: "💰", label: "Finance" },
  { id: "health",    emoji: "❤️", label: "Health" },
  { id: "other",     emoji: "🌐", label: "Other" },
];

const AUDIENCES = [
  { id: "cold",      emoji: "🧊", label: "Cold traffic",    desc: "Never heard of you" },
  { id: "warm",      emoji: "🔥", label: "Warm / retarget", desc: "Visited or engaged before" },
  { id: "lookalike", emoji: "👥", label: "Lookalike",       desc: "Similar to existing customers" },
  { id: "broad",     emoji: "🌍", label: "Broad",           desc: "No specific targeting" },
];

const EMOTIONS = [
  { id: "curiosity",  emoji: "🔍", label: "Curiosity" },
  { id: "social",     emoji: "⭐", label: "Social proof" },
  { id: "fear",       emoji: "⚠️", label: "Fear / urgency" },
  { id: "humor",      emoji: "😄", label: "Humor" },
  { id: "aspiration", emoji: "🚀", label: "Aspiration" },
  { id: "community",  emoji: "🤝", label: "Community" },
];

const STEPS = [
  { num: 1, label: "Goal" },
  { num: 2, label: "Platform" },
  { num: 3, label: "Context" },
  { num: 4, label: "Angle" },
];

const card = (selected: boolean): React.CSSProperties => ({
  background: selected ? "rgba(167,139,250,0.10)" : "rgba(255,255,255,0.025)",
  border: `1px solid ${selected ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.07)"}`,
  borderRadius: 16, cursor: "pointer", transition: "all 0.15s",
});

const pillStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
  border: `1px solid ${selected ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
  borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
  padding: "9px 16px",
});

export default function LiteMode({ profile, onSwitchToPro }: LiteModeProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);

  const isPT = language === "pt";
  const isES = language === "es";

  const GOALS = isPT ? GOALS_PT : isES ? GOALS_ES : GOALS_EN;

  const INDUSTRIES = isPT ? [
    { id: "ecommerce", emoji: "🛍️", label: "E-commerce" },
    { id: "igaming",   emoji: "🎮", label: "iGaming" },
    { id: "saas",      emoji: "💻", label: "SaaS / App" },
    { id: "finance",   emoji: "💰", label: "Finanças" },
    { id: "health",    emoji: "❤️", label: "Saúde" },
    { id: "other",     emoji: "🌐", label: "Outro" },
  ] : isES ? [
    { id: "ecommerce", emoji: "🛍️", label: "E-commerce" },
    { id: "igaming",   emoji: "🎮", label: "iGaming" },
    { id: "saas",      emoji: "💻", label: "SaaS / App" },
    { id: "finance",   emoji: "💰", label: "Finanzas" },
    { id: "health",    emoji: "❤️", label: "Salud" },
    { id: "other",     emoji: "🌐", label: "Otro" },
  ] : [
    { id: "ecommerce", emoji: "🛍️", label: "E-commerce" },
    { id: "igaming",   emoji: "🎮", label: "iGaming" },
    { id: "saas",      emoji: "💻", label: "SaaS / App" },
    { id: "finance",   emoji: "💰", label: "Finance" },
    { id: "health",    emoji: "❤️", label: "Health" },
    { id: "other",     emoji: "🌐", label: "Other" },
  ];

  const AUDIENCES = isPT ? [
    { id: "cold",      emoji: "🧊", label: "Tráfego frio",      desc: "Nunca ouviu falar de você" },
    { id: "warm",      emoji: "🔥", label: "Quente / retarget", desc: "Visitou ou interagiu antes" },
    { id: "lookalike", emoji: "👥", label: "Lookalike",         desc: "Parecido com seus clientes atuais" },
    { id: "broad",     emoji: "🌍", label: "Aberto",            desc: "Sem segmentação específica" },
  ] : isES ? [
    { id: "cold",      emoji: "🧊", label: "Tráfico frío",      desc: "Nunca oyó hablar de ti" },
    { id: "warm",      emoji: "🔥", label: "Cálido / retarget", desc: "Visitó o interactuó antes" },
    { id: "lookalike", emoji: "👥", label: "Lookalike",         desc: "Similar a tus clientes actuales" },
    { id: "broad",     emoji: "🌍", label: "Amplio",            desc: "Sin segmentación específica" },
  ] : [
    { id: "cold",      emoji: "🧊", label: "Cold traffic",    desc: "Never heard of you" },
    { id: "warm",      emoji: "🔥", label: "Warm / retarget", desc: "Visited or engaged before" },
    { id: "lookalike", emoji: "👥", label: "Lookalike",       desc: "Similar to existing customers" },
    { id: "broad",     emoji: "🌍", label: "Broad",           desc: "No specific targeting" },
  ];

  const EMOTIONS = isPT ? [
    { id: "curiosity",  emoji: "🔍", label: "Curiosidade" },
    { id: "social",     emoji: "⭐", label: "Prova social" },
    { id: "fear",       emoji: "⚠️", label: "Medo / urgência" },
    { id: "humor",      emoji: "😄", label: "Humor" },
    { id: "aspiration", emoji: "🚀", label: "Aspiração" },
    { id: "community",  emoji: "🤝", label: "Comunidade" },
  ] : isES ? [
    { id: "curiosity",  emoji: "🔍", label: "Curiosidad" },
    { id: "social",     emoji: "⭐", label: "Prueba social" },
    { id: "fear",       emoji: "⚠️", label: "Miedo / urgencia" },
    { id: "humor",      emoji: "😄", label: "Humor" },
    { id: "aspiration", emoji: "🚀", label: "Aspiración" },
    { id: "community",  emoji: "🤝", label: "Comunidad" },
  ] : [
    { id: "curiosity",  emoji: "🔍", label: "Curiosity" },
    { id: "social",     emoji: "⭐", label: "Social proof" },
    { id: "fear",       emoji: "⚠️", label: "Fear / urgency" },
    { id: "humor",      emoji: "😄", label: "Humor" },
    { id: "aspiration", emoji: "🚀", label: "Aspiration" },
    { id: "community",  emoji: "🤝", label: "Community" },
  ];

  const STEPS = isPT
    ? [{ num: 1, label: "Objetivo" }, { num: 2, label: "Plataforma" }, { num: 3, label: "Contexto" }, { num: 4, label: "Ângulo" }]
    : isES
    ? [{ num: 1, label: "Objetivo" }, { num: 2, label: "Plataforma" }, { num: 3, label: "Contexto" }, { num: 4, label: "Ángulo" }]
    : [{ num: 1, label: "Goal" }, { num: 2, label: "Platform" }, { num: 3, label: "Context" }, { num: 4, label: "Angle" }];

  const ui = {
    badge:          isPT ? "Modo Lite" : isES ? "Modo Lite" : "Lite Mode",
    step1_supra:    isPT ? "O que você quer fazer?" : isES ? "¿Qué quieres hacer?" : "What do you want to do?",
    step1_heading:  isPT ? "escolha seu ponto de partida." : isES ? "elige tu punto de partida." : "pick your starting point.",
    step1_sub:      isPT ? "Escolha um — guiamos o resto." : isES ? "Elige uno — te guiamos el resto." : "Pick one — we'll guide you through the rest.",
    step2_supra:    isPT ? "Plataforma" : isES ? "Plataforma" : "Platform",
    step2_heading:  isPT ? "Onde isso vai rodar?" : isES ? "¿Dónde va a correr esto?" : "Where will this run?",
    step2_sub:      isPT ? "Vamos calibrar benchmarks e recomendações de formato por plataforma." : isES ? "Calibraremos benchmarks y recomendaciones de formato por plataforma." : "We'll calibrate benchmarks and format recommendations per platform.",
    step2_skip:     isPT ? "Pular — decidir depois" : isES ? "Saltar — decidir después" : "Skip — decide later",
    step3_supra:    isPT ? "Contexto" : isES ? "Contexto" : "Context",
    step3_heading:  isPT ? "Conta sobre a campanha." : isES ? "Cuéntanos sobre la campaña." : "Tell us about your campaign.",
    step3_industry: isPT ? "Indústria" : isES ? "Industria" : "Industry",
    step3_audience: isPT ? "Audiência" : isES ? "Audiencia" : "Audience",
    step3_continue: isPT ? "Continuar" : isES ? "Continuar" : "Continue",
    step4_supra:    isPT ? "Ângulo criativo" : isES ? "Ángulo creativo" : "Creative angle",
    step4_heading:  isPT ? "Qual emoção move este anúncio?" : isES ? "¿Qué emoción mueve este anuncio?" : "What emotion drives this ad?",
    step4_sub:      isPT ? "Isso define o estilo do hook, o tom e a direção do script." : isES ? "Esto define el estilo del hook, el tono y la dirección del script." : "This shapes hook style, tone, and script direction.",
    brief_label:    isPT ? "Seu brief" : isES ? "Tu brief" : "Your brief",
    generate:       isPT ? "Gerar agora" : isES ? "Generar ahora" : "Generate now",
    skip_angle:     isPT ? "Pular ângulo — só gerar" : isES ? "Saltar ángulo — solo generar" : "Skip angle — just go",
    back:           isPT ? "← Voltar" : isES ? "← Volver" : "← Back",
    quick_jump:     isPT ? "Atalhos" : isES ? "Accesos rápidos" : "Quick jump",
    q_analyses:     isPT ? "Minhas análises" : isES ? "Mis análisis" : "My analyses",
    q_boards:       isPT ? "Meus boards" : isES ? "Mis boards" : "My boards",
    q_personas:     isPT ? "Personas" : isES ? "Personas" : "Personas",
    q_hooks:        isPT ? "Hooks" : isES ? "Hooks" : "Hooks",
    greeting:       isPT ? "escolha seu ponto de partida." : isES ? "elige tu punto de partida." : "pick your starting point.",
  };

  const name = profile?.name?.split(" ")[0] || "there";

  function goBack() { setStep(s => Math.max(1, s - 1)); }

  function handleGoal(g: typeof GOALS[0]) {
    setGoal(g.id);
    if (["brief", "script", "persona", "hooks"].includes(g.id)) {
      navigate(g.route);
      return;
    }
    setStep(2);
  }

  function handlePlatform(p: string) { setPlatform(p); setStep(3); }
  function handleAudience(a: string) { setAudience(a); setStep(4); }

  function handleLaunch() {
    const g = GOALS.find(x => x.id === goal);
    if (!g) return;
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (industry) params.set("industry", industry);
    if (audience) params.set("audience", audience);
    if (emotion)  params.set("angle", emotion);
    navigate(`${g.route}?${params.toString()}`);
  }

  const chips = [
    goal     && GOALS.find(x => x.id === goal)?.label,
    platform && PLATFORMS.find(x => x.id === platform)?.label,
    industry && INDUSTRIES.find(x => x.id === industry)?.label,
    audience && AUDIENCES.find(x => x.id === audience)?.label,
  ].filter(Boolean) as string[];

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", color: "#fff", ...j, position: "relative", overflow: "hidden" }}>

      {/* Ambient */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.07), transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,114,182,0.05), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, background: "rgba(7,7,15,0.85)", backdropFilter: "blur(12px)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#a78bfa,#f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={13} color="#000" />
          </div>
          <div>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>AdBrief</p>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", lineHeight: 1.2 }}>{ui.badge}</p>
          </div>
        </div>

        {/* Toggle — knob LEFT = Lite active */}
        <button onClick={onSwitchToPro} title="Switch back to Pro" style={{ ...j, display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 10px 4px 5px", gap: 6, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", width: 36, height: 20, borderRadius: 999, background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.3)", padding: "2px 3px" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#f472b6)", boxShadow: "0 0 6px rgba(167,139,250,0.6)" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.04em" }}>LITE</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>PRO</span>
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 100px", position: "relative" }}>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: step > s.num ? "linear-gradient(135deg,#a78bfa,#f472b6)" : step === s.num ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)", border: step === s.num ? "1.5px solid #a78bfa" : "1.5px solid transparent", color: step > s.num ? "#000" : step === s.num ? "#a78bfa" : "rgba(255,255,255,0.2)", transition: "all 0.3s", boxShadow: step === s.num ? "0 0 12px rgba(167,139,250,0.3)" : "none" }}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span style={{ ...m, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: step >= s.num ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)" }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, margin: "0 6px", marginBottom: 18, background: step > s.num ? "linear-gradient(90deg,#a78bfa,#f472b6)" : "rgba(255,255,255,0.06)", transition: "all 0.4s" }} />}
            </div>
          ))}
        </div>

        {/* Summary chips */}
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {chips.map(c => <span key={c} style={{ ...m, fontSize: 10, padding: "4px 10px", borderRadius: 999, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", letterSpacing: "0.06em" }}>{c}</span>)}
          </div>
        )}

        {/* STEP 1 — Goal */}
        {step === 1 && (
          <div>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>{ui.step1_supra}</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 28 }}>
              Hey {name},<br />
              <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{ui.step1_heading}</span>
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => handleGoal(g)} style={{ ...card(goal === g.id), display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", width: "100%", textAlign: "left" }}>
                  <span style={{ fontSize: 24, flexShrink: 0, width: 36, textAlign: "center" }}>{g.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>{g.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{g.desc}</p>
                  </div>
                  <ChevronRight size={14} color="rgba(255,255,255,0.15)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Platform */}
        {step === 2 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{ui.back}</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>{ui.step2_supra}</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{ui.step2_heading}</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>{ui.step2_sub}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => handlePlatform(p.id)} style={{ ...card(platform === p.id), padding: "22px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{p.emoji}</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: platform === p.id ? "#a78bfa" : "rgba(255,255,255,0.75)" }}>{p.label}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 12, cursor: "pointer", textDecoration: "underline", marginTop: 18, padding: 0, display: "block" }}>{ui.step2_skip}</button>
          </div>
        )}

        {/* STEP 3 — Industry + Audience */}
        {step === 3 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{ui.back}</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>{ui.step3_supra}</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 28 }}>{ui.step3_heading}</h1>

            <p style={{ ...m, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{ui.step3_industry}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 28 }}>
              {INDUSTRIES.map(ind => (
                <button key={ind.id} onClick={() => setIndustry(ind.id)} style={{ ...card(industry === ind.id), padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{ind.emoji}</div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: industry === ind.id ? "#a78bfa" : "rgba(255,255,255,0.6)" }}>{ind.label}</p>
                </button>
              ))}
            </div>

            <p style={{ ...m, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{ui.step3_audience}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
              {AUDIENCES.map(a => (
                <button key={a.id} onClick={() => setAudience(a.id)} style={{ ...pillStyle(audience === a.id), display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%" }}>
                  <span style={{ fontSize: 18 }}>{a.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: audience === a.id ? "#a78bfa" : "rgba(255,255,255,0.8)" }}>{a.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => handleAudience(audience || "broad")} style={{ width: "100%", padding: "14px", borderRadius: 999, fontSize: 14, fontWeight: 800, background: (audience || industry) ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)", color: (audience || industry) ? "#a78bfa" : "rgba(255,255,255,0.2)", border: `1px solid ${(audience || industry) ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {ui.step3_continue} <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* STEP 4 — Angle */}
        {step === 4 && (
          <div>
            <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{ui.back}</button>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>{ui.step4_supra}</p>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{ui.step4_heading}</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>{ui.step4_sub}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {EMOTIONS.map(e => (
                <button key={e.id} onClick={() => setEmotion(e.id)} style={{ ...card(emotion === e.id), padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{e.emoji}</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: emotion === e.id ? "#a78bfa" : "rgba(255,255,255,0.75)" }}>{e.label}</p>
                </button>
              ))}
            </div>

            {/* Brief summary */}
            <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 16, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ ...m, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>{ui.brief_label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chips.map(c => <span key={c} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>{c}</span>)}
                {emotion && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>{EMOTIONS.find(e => e.id === emotion)?.label}</span>}
              </div>
            </div>

            <button onClick={handleLaunch} style={{ width: "100%", padding: "16px", borderRadius: 999, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 24px rgba(167,139,250,0.35)" }}>
              {ui.generate} <ArrowRight size={16} />
            </button>
            <button onClick={() => { setEmotion(null); handleLaunch(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 12, cursor: "pointer", textDecoration: "underline", marginTop: 14, padding: 0, display: "block", width: "100%", textAlign: "center" }}>
              {ui.skip_angle}
            </button>
          </div>
        )}

        {/* Quick access step 1 */}
        {step === 1 && (
          <div style={{ marginTop: 36 }}>
            <p style={{ ...m, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 12 }}>{ui.quick_jump}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: ui.q_analyses, route: "/dashboard/analyses", icon: <BarChart3 size={11} /> },
                { label: ui.q_boards,   route: "/dashboard/boards",   icon: <FileText size={11} /> },
                { label: ui.q_personas, route: "/dashboard/persona",  icon: <Target size={11} /> },
                { label: ui.q_hooks,    route: "/dashboard/hooks",    icon: <Sparkles size={11} /> },
              ].map(item => (
                <button key={item.route} onClick={() => navigate(item.route)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
