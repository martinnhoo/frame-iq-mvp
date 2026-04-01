// v8.5 — footer i18n + CTA smooth loading 2026-03-25
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, Plug, Users, ChevronDown, Globe, Play, Zap, BarChart3, Target, Layers } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";
import { motion, useInView, AnimatePresence } from "framer-motion";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const BG = "#0d1117";
const CARD_BG = "rgba(255,255,255,0.12)";
const CARD_BORDER = "rgba(255,255,255,0.1)";
const TEXT_MUTED = "rgba(255,255,255,0.62)";
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ─── CTA Button ──────────────────────────────────────────────────────────────
function CTAButton({
  onClick, loading = false, label, size = "md", variant = "primary", icon
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost" | "white";
  icon?: React.ReactNode;
}) {
  const pad = size === "lg" ? "18px 48px" : size === "sm" ? "10px 20px" : "14px 36px";
  const fs  = size === "lg" ? 16 : size === "sm" ? 13 : 15;
  const br  = size === "lg" ? 14 : size === "sm" ? 9 : 12;

  const baseStyle: React.CSSProperties = {
    fontFamily: F, fontSize: fs, fontWeight: 700, padding: pad, borderRadius: br,
    border: "none", cursor: loading ? "wait" : "pointer",
    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
    letterSpacing: "-0.025em", display: "inline-flex", alignItems: "center", gap: 8,
    opacity: loading ? 0.72 : 1,
    transform: "translateY(0)",
    userSelect: "none" as const,
    position: "relative" as const, overflow: "hidden" as const,
    whiteSpace: "nowrap" as const,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff", boxShadow: "0 0 32px rgba(14,165,233,0.25)" },
    ghost:   { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.09)" },
    white:   { background: "#fff", color: "#000" },
  };

  const hoverStyle = {
    primary: { transform: "translateY(-2px)", boxShadow: "0 0 48px rgba(14,165,233,0.4)" },
    ghost:   { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" },
    white:   { opacity: "0.88" },
  };

  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return;
    const el = e.currentTarget;
    Object.assign(el.style, hoverStyle[variant]);
  };
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translateY(0)";
    el.style.boxShadow = variants[variant].boxShadow as string || "";
    el.style.background = variants[variant].background as string;
    el.style.color = variants[variant].color as string;
    el.style.opacity = "1";
  };

  return (
    <button
      onClick={loading ? undefined : onClick}
      style={{ ...baseStyle, ...variants[variant] }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      disabled={loading}
    >
      {loading ? (
        <>
          <span style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.25)",
            borderTopColor: "#fff",
            animation: "cta-spin 0.65s linear infinite",
            flexShrink: 0,
          }} />
          <span style={{ opacity: 0.8 }}>{label}</span>
        </>
      ) : (
        <>
          {label}
          {icon}
        </>
      )}
    </button>
  );
}

// Keyframe injection (once)
if (typeof document !== "undefined" && !document.getElementById("cta-spin-style")) {
  const s = document.createElement("style");
  s.id = "cta-spin-style";
  s.textContent = "@keyframes cta-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}

// ─── Types & Translations ────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_how: "How it works", nav_for: "Who it's for", nav_pricing: "Pricing", nav_signin: "Sign in", nav_cta: "Try free for 3 days",
    hero_badge: "AI CONNECTED TO YOUR AD ACCOUNT",
    hero_h1: "Chat with your ads.\nGet real answers.",
    hero_sub: "Connect Meta Ads or Google Ads. Reads your real data. Answers like a senior analyst who knows every campaign, creative, and metric.",
    hero_cta: "Try free for 3 days", hero_see: "See it in action",
    hero_fine: "3-day free trial · No charge for 72h · Cancel anytime",
    stat_1: "30s", stat_1_label: "To connect Meta Ads",
    stat_2: "90 days", stat_2_label: "Of real data analyzed",
    stat_3: "7", stat_3_label: "Integrated tools",
    stat_4: "Telegram", stat_4_label: "Real-time alerts",
    demo_label: "LIVE DEMO",
    demo_q1_short: "My ROAS dropped 40%", demo_q1_full: "My fitness ads ROAS dropped 40% this week. What's happening?",
    demo_q2_short: "Which ads to pause?", demo_q2_full: "Which of my ads should I pause immediately?",
    demo_q3_short: "Write hooks from winners", demo_q3_full: "Write 3 hooks based on my best performing creatives",
    demo_empty: "Select a question to see AdBrief in action",
    demo_sample: "Sample account · Meta connected",
    demo_connected: "connected to FitCore Brasil",
    demo_cta_note: "This is a sample account. With yours, the AI uses real data.",
    demo_cta_btn: "Try with my account →",
    how_label: "HOW IT WORKS", how_h2: "Three steps. Zero friction.",
    how_sub: "No CSV uploads. No manual data. Just connect and ask.",
    how_s1_title: "Create your account", how_s1_desc: "Sign up and create an account for each brand or client. Add website and context — the AI uses all of it to personalize every answer.",
    how_s2_title: "Connect Meta or Google Ads", how_s2_desc: "Link your ad account in one click via OAuth. AdBrief reads spend, CTR, creatives and performance — in real time.",
    how_s3_title: "Ask anything. Get real answers.", how_s3_desc: "Chat like ChatGPT — but AdBrief knows your actual account. Ask what's working, what to kill, what to produce next.",
    for_label: "WHO IT'S FOR", for_h2: "Built for performance teams.",
    for_tab0: "Agencies", for_tab1: "Media Buyers", for_tab2: "In-house Teams",
    for_h0: "Manage 10 clients like you have a full data team.", for_d0: "AdBrief connects to each client's ad account and gives your strategists real answers — which creatives to scale, which to kill, what to brief next.",
    for_h1: "Stop flying blind on creative decisions.", for_d1: "AdBrief gives you data-backed answers — which format is underperforming, what the winning hook pattern is, what to brief next.",
    for_h2b: "Your campaigns, finally speaking to each other.", for_d2: "Connect your company's ad accounts and give your whole team access to a shared AI that knows your performance history.",
    for_cta: "Start for free",
    for_p0_0: "Per-client accounts with Meta Ads connection", for_p0_1: "Real-time performance in chat", for_p0_2: "Brief generation tuned to each brand", for_p0_3: "AI that learns each client's patterns",
    for_p1_0: "Real spend and CTR in every answer", for_p1_1: "Pattern detection across performers", for_p1_2: "Competitor analysis and benchmarking", for_p1_3: "Account memory that improves over time",
    for_p2_0: "Connected to your real data", for_p2_1: "Accounts for each product line", for_p2_2: "Brand context baked in", for_p2_3: "Team-wide shared intelligence",
    tools_label: "TOOLS", tools_h2: "Everything you need to scale.",
    tools_sub: "Every tool connected to your real data. No copy-pasting.",
    ba_label: "BEFORE VS AFTER", ba_h2: "What changes when the AI knows your account.",
    ba_before_label: "Before AdBrief", ba_after_label: "With AdBrief",
    ba_1_before: "Export CSV from Meta every Monday", ba_1_after: "Ask: \"What should I fix this week?\" — 10s",
    ba_2_before: "Manually compare CTR across 20 ad sets", ba_2_after: "Ask: \"Which ads are underperforming?\" — instant",
    ba_3_before: "Guess why ROAS dropped", ba_3_after: "Ask: \"Why did ROAS drop?\" — specific diagnosis",
    ba_4_before: "Write hooks from scratch, no data", ba_4_after: "\"Write 5 hooks based on my top converters\"",
    pricing_label: "PRICING", pricing_h2: "3 days free. Stay because it works.",
    pricing_sub: "Every plan includes a 3-day free trial. Card required. No charge until day 4.",
    pricing_cta: "Start 3-day trial", pricing_note: "3 days free · No charge until day 4",
    plan_badge_pro: "Most popular",
    plan_maker_f0: "50 AI messages / day", plan_maker_f1: "1 ad account", plan_maker_f2: "Basic tools", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 AI messages / day", plan_pro_f1: "3 ad accounts", plan_pro_f2: "All tools unlocked", plan_pro_f3: "Unlimited brands", plan_pro_f4: "Multi-market",
    plan_studio_f0: "Unlimited AI messages", plan_studio_f1: "Unlimited ad accounts", plan_studio_f2: "All tools unlocked", plan_studio_f3: "Unlimited brands", plan_studio_f4: "Agency workspace",
    faq_label: "FAQ", faq_h2: "Common questions",
    faq_q0: "How does the 3-day free trial work?", faq_a0: "When you sign up, you get full access for 3 days at no charge. If you cancel within that period, you won't be billed.",
    faq_q1: "Why do I need a card to start?", faq_a1: "Requiring a card filters for serious users and lets us give you genuine full access. We don't charge anything for 72 hours (3 days).",
    faq_q2: "What does AdBrief connect to?", faq_a2: "Meta Ads and Google Ads — fully connected and reading your data in real time. TikTok Ads is coming soon.",
    faq_q3: "Is my data secure?", faq_a3: "Yes. We use OAuth — the same standard used by every major ad tool. We never store your credentials. Tokens are encrypted at rest.",
    faq_q4: "Can I use it for multiple clients?", faq_a4: "Yes. Pro supports 3 ad accounts, Studio unlimited. Most agencies use one persona per brand.",
    faq_q5: "What is an Account?", faq_a5: "An Account is a brand profile connected to its ad accounts (Meta Ads, Google Ads). The AI uses this context to personalize every answer.",
    faq_q6: "Works with catalog ads?", faq_a6: "Yes. AdBrief reads all campaign types from Meta — including DPA, catalog, and Advantage+ Shopping.",
    faq_q7: "What if it doesn't work?", faq_a7: "Cancel within 72h (3 days) and you won't be charged. On a paid plan, email us — we handle refunds case by case.",
    final_label: "START TODAY", final_h2: "Your ad account is full of insights.\nStart asking.",
    final_sub: "Connect in 2 minutes. Cancel anytime.",
    final_cta: "Try free for 3 days", final_fine: "Any plan · 3-day free trial · Cancel before day 4, pay nothing",
    trust_1: "No credit card until day 4", trust_2: "Cancel anytime", trust_3: "Setup in 2 minutes",
    tiktok_soon: "SOON",
    footer_copy: "© 2026 AdBrief",
    footer_tagline: "The AI that knows your ad account. Stop guessing, start scaling.",
    footer_product: "Product",
    footer_legal: "Legal",
    footer_pricing: "Pricing",
    footer_how: "How it works",
    footer_for: "Who it's for",
    footer_tools: "Tools",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
    footer_faq: "FAQ",
    footer_built: "Built for performance marketers who move fast.",
  },
  pt: {
    nav_how: "Como funciona", nav_for: "Para quem", nav_pricing: "Preços", nav_signin: "Entrar", nav_cta: "Testar grátis por 3 dias",
    hero_badge: "IA CONECTADA NA SUA CONTA DE ANÚNCIOS",
    hero_h1: "Converse com\nseus anúncios.",
    hero_sub: "Conecta em Meta Ads ou Google Ads. Lê seus dados reais. Responde como um analista que conhece cada campanha, criativo e métrica.",
    hero_cta: "Testar grátis por 3 dias", hero_see: "Ver na prática",
    hero_fine: "3 dias grátis · Sem cobrança por 72h · Cancele quando quiser",
    stat_1: "30s", stat_1_label: "Para conectar o Meta Ads",
    stat_2: "90 dias", stat_2_label: "De dados reais analisados",
    stat_3: "7", stat_3_label: "Ferramentas integradas",
    stat_4: "Telegram", stat_4_label: "Alertas em tempo real",
    demo_label: "DEMO AO VIVO",
    demo_q1_short: "Meu ROAS caiu 40%", demo_q1_full: "Meu ROAS de fitness caiu 40% essa semana. O que está acontecendo?",
    demo_q2_short: "Quais anúncios pausar?", demo_q2_full: "Quais dos meus anúncios devo pausar imediatamente?",
    demo_q3_short: "Hooks dos meus winners", demo_q3_full: "Escreve 3 hooks baseados nos meus melhores criativos",
    demo_empty: "Selecione uma pergunta para ver o AdBrief em ação",
    demo_sample: "Conta de exemplo · Meta conectado",
    demo_connected: "conectado à FitCore Brasil",
    demo_cta_note: "Conta de exemplo. Com a sua, a IA usa dados reais.",
    demo_cta_btn: "Testar com minha conta →",
    how_label: "COMO FUNCIONA", how_h2: "Conecte. Pergunte. Escale.",
    how_sub: "Do zero à sua primeira resposta em menos de 2 minutos.",
    how_s1_title: "Crie sua conta", how_s1_desc: "30 segundos. Adicione o nome da marca, site e contexto — a IA usa isso para personalizar cada resposta com a identidade do seu negócio.",
    how_s2_title: "Conecte Meta ou Google Ads", how_s2_desc: "Um clique via OAuth. O AdBrief lê spend, CTR, frequência, criativos e performance dos últimos 90 dias — em tempo real, sem CSV.",
    how_s3_title: "Pergunte. Receba diagnóstico.", how_s3_desc: "Interface de chat — mas com seus dados reais. Pergunte por que o ROAS caiu, o que pausar, quais hooks criar. A IA responde com contexto real.",
    for_label: "PARA QUEM", for_h2: "Para quem gerencia anúncios a sério.",
    for_tab0: "Agências", for_tab1: "Gestores de Tráfego", for_tab2: "Times Internos",
    for_h0: "Gerencie 10 clientes como se tivesse um time de dados.", for_d0: "O AdBrief conecta à conta de cada cliente e dá respostas reais — quais criativos escalar, quais pausar, o que briefar.",
    for_h1: "Pare de decidir no escuro.", for_d1: "AdBrief te dá respostas baseadas em dados — qual formato underperforma, qual hook vence, o que briefar.",
    for_h2b: "Suas campanhas finalmente conectadas.", for_d2: "Conecte as contas e dê ao time acesso a uma IA que conhece seu histórico de performance.",
    for_cta: "Começar grátis",
    for_p0_0: "Contas por cliente com Meta Ads", for_p0_1: "Performance em tempo real", for_p0_2: "Brief calibrado por marca", for_p0_3: "IA que aprende cada cliente",
    for_p1_0: "Dados reais em cada resposta", for_p1_1: "Detecção de padrões", for_p1_2: "Análise de concorrentes", for_p1_3: "Memória que melhora",
    for_p2_0: "Conectado aos dados reais", for_p2_1: "Contas por produto", for_p2_2: "Contexto de marca integrado", for_p2_3: "Inteligência compartilhada",
    tools_label: "FERRAMENTAS", tools_h2: "Uma IA. Sete ferramentas.",
    tools_sub: "Hooks, roteiros, análise, tradução — tudo com contexto dos seus dados reais.",
    ba_label: "ANTES VS DEPOIS", ba_h2: "O que muda quando a IA conhece sua conta.",
    ba_before_label: "Antes do AdBrief", ba_after_label: "Com AdBrief",
    ba_1_before: "Exportar CSV do Meta toda segunda", ba_1_after: "Pergunte: \"O que corrigir essa semana?\" — 10s",
    ba_2_before: "Comparar CTR de 20 conjuntos manualmente", ba_2_after: "\"Quais anúncios estão underperformando?\" — instantâneo",
    ba_3_before: "Adivinhar por que o ROAS caiu", ba_3_after: "\"Por que o ROAS caiu?\" — diagnóstico específico",
    ba_4_before: "Escrever hooks do zero, sem dados", ba_4_after: "\"5 hooks baseados nos meus melhores criativos\"",
    pricing_label: "PREÇOS", pricing_h2: "3 dias grátis. Cancele se quiser.",
    pricing_sub: "Acesso completo por 3 dias. Cartão necessário — mas nenhuma cobrança até o 4º dia.",
    pricing_cta: "Começar teste grátis", pricing_note: "3 dias grátis · Sem cobrança até o 4º dia",
    plan_badge_pro: "Mais popular",
    plan_maker_f0: "50 mensagens / dia", plan_maker_f1: "1 conta de anúncios", plan_maker_f2: "Ferramentas básicas", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 mensagens / dia", plan_pro_f1: "3 contas conectadas", plan_pro_f2: "Todas as ferramentas", plan_pro_f3: "Marcas ilimitadas", plan_pro_f4: "Multi-mercado",
    plan_studio_f0: "Mensagens ilimitadas", plan_studio_f1: "Contas ilimitadas", plan_studio_f2: "Todas as ferramentas", plan_studio_f3: "Marcas ilimitadas", plan_studio_f4: "Workspace agência",
    faq_label: "FAQ", faq_h2: "Perguntas frequentes",
    faq_q0: "Como funciona o teste grátis de 3 dias?", faq_a0: "Ao se cadastrar, você tem acesso completo por 3 dias sem cobrança. Cancele dentro desse período e não será cobrado.",
    faq_q1: "Por que preciso de cartão?", faq_a1: "Filtra usuários sérios e te dá acesso genuíno. Não cobramos nada em 72h.",
    faq_q2: "O que conecta?", faq_a2: "Meta Ads e Google Ads — conectados e lendo seus dados em tempo real. TikTok Ads em breve.",
    faq_q3: "Meus dados são seguros?", faq_a3: "Sim. Usamos OAuth. Nunca armazenamos suas credenciais. Tokens criptografados.",
    faq_q4: "Posso usar para vários clientes?", faq_a4: "Sim. Pro: 3 contas. Studio: ilimitado. A maioria usa uma persona por marca.",
    faq_q5: "O que é uma Conta?", faq_a5: "Um perfil de marca conectado às suas contas de anúncios (Meta Ads, Google Ads). A IA usa esse contexto em cada resposta.",
    faq_q6: "Funciona com catálogo?", faq_a6: "Sim. Lê todos os tipos de campanha — DPA, catálogo, Advantage+.",
    faq_q7: "E se não funcionar?", faq_a7: "Cancele em 72h (3 dias), sem cobrança. Em plano pago, mande email — resolvemos caso a caso.",
    final_label: "COMECE AGORA", final_h2: "Sua conta tem dados.\nA IA tem as respostas.",
    final_sub: "Conecte em 30 segundos. Pergunte tudo. Cancele quando quiser.",
    final_cta: "Testar grátis por 3 dias", final_fine: "Qualquer plano · 3 dias grátis · Cancele antes do 4º dia",
    trust_1: "Sem cartão até o 4º dia", trust_2: "Cancele quando quiser", trust_3: "Configure em 2 minutos",
    tiktok_soon: "EM BREVE",
    footer_copy: "© 2026 AdBrief",
    footer_tagline: "A IA que conhece sua conta de anúncios. Pare de adivinhar, comece a escalar.",
    footer_product: "Produto",
    footer_legal: "Legal",
    footer_pricing: "Preços",
    footer_how: "Como funciona",
    footer_for: "Para quem",
    footer_tools: "Ferramentas",
    footer_privacy: "Privacidade",
    footer_terms: "Termos",
    footer_faq: "FAQ",
    footer_built: "Feito para gestores de tráfego que movem rápido.",
  },
  es: {
    nav_how: "Cómo funciona", nav_for: "Para quién", nav_pricing: "Precios", nav_signin: "Iniciar sesión", nav_cta: "Probar gratis 3 días",
    hero_badge: "LA IA QUE CONOCE TU CUENTA DE ANUNCIOS",
    hero_h1: "Habla con tus anuncios.\nLa IA te responde.",
    hero_sub: "Conecta Meta Ads o Google Ads y pregunta lo que quieras. La IA lee tu cuenta y responde como un analista que conoce cada campaña.",
    hero_cta: "Probar gratis 3 días", hero_see: "Verlo en acción",
    hero_fine: "3 días gratis · Sin cobro por 72h · Cancela cuando quieras",
    stat_1: "30s", stat_1_label: "Para conectar Meta Ads",
    stat_2: "90 días", stat_2_label: "De datos reales analizados",
    stat_3: "7", stat_3_label: "Herramientas integradas",
    stat_4: "Telegram", stat_4_label: "Alertas en tiempo real",
    demo_label: "DEMO EN VIVO",
    demo_q1_short: "Mi ROAS bajó 40%", demo_q1_full: "Mi ROAS de fitness bajó 40% esta semana. ¿Qué pasa?",
    demo_q2_short: "¿Cuáles pausar?", demo_q2_full: "¿Cuáles de mis anuncios debo pausar inmediatamente?",
    demo_q3_short: "Hooks de mis ganadores", demo_q3_full: "Escribe 3 hooks basados en mis mejores creativos",
    demo_empty: "Selecciona una pregunta para ver AdBrief en acción",
    demo_sample: "Cuenta de ejemplo · Meta conectado",
    demo_connected: "conectado a FitCore Brasil",
    demo_cta_note: "Cuenta de ejemplo. Con la tuya, la IA usa datos reales.",
    demo_cta_btn: "Probar con mi cuenta →",
    how_label: "CÓMO FUNCIONA", how_h2: "Tres pasos. Cero fricción.",
    how_sub: "Sin CSV. Sin entrada manual. Conecta y pregunta.",
    how_s1_title: "Crea tu cuenta", how_s1_desc: "Regístrate y crea una cuenta para cada marca o cliente. Agrega el sitio y contexto — la IA usa todo eso para personalizar cada respuesta.",
    how_s2_title: "Configura tu cuenta", how_s2_desc: "Crea una cuenta por marca. Agrega sitio web, descripción y conecta Meta Ads o Google Ads.",
    how_s3_title: "Pregunta lo que quieras.", how_s3_desc: "Chatea como en ChatGPT — pero AdBrief conoce tu cuenta. Pregunta qué funciona, qué pausar, qué producir.",
    for_label: "PARA QUIÉN", for_h2: "Hecho para equipos de performance.",
    for_tab0: "Agencias", for_tab1: "Media Buyers", for_tab2: "Equipos Internos",
    for_h0: "Gestiona 10 clientes como si tuvieras un equipo de datos.", for_d0: "AdBrief se conecta a cada cuenta y da respuestas reales — qué escalar, qué pausar, qué briefear.",
    for_h1: "Deja de decidir a ciegas.", for_d1: "AdBrief te da respuestas con datos — qué formato underperforma, cuál es el hook ganador.",
    for_h2b: "Tus campañas, finalmente conectadas.", for_d2: "Conecta las cuentas y da acceso a una IA que conoce tu historial de performance.",
    for_cta: "Comenzar gratis",
    for_p0_0: "Cuentas por cliente con Meta Ads", for_p0_1: "Performance en tiempo real", for_p0_2: "Brief calibrado por marca", for_p0_3: "IA que aprende cada cliente",
    for_p1_0: "Datos reales en cada respuesta", for_p1_1: "Detección de patrones", for_p1_2: "Análisis de competidores", for_p1_3: "Memoria que mejora",
    for_p2_0: "Conectado a datos reales", for_p2_1: "Personas por producto", for_p2_2: "Contexto de marca integrado", for_p2_3: "Inteligencia compartida",
    tools_label: "HERRAMIENTAS", tools_h2: "Todo para escalar.",
    tools_sub: "Cada herramienta conectada a tus datos reales.",
    ba_label: "ANTES VS DESPUÉS", ba_h2: "Qué cambia cuando la IA conoce tu cuenta.",
    ba_before_label: "Antes de AdBrief", ba_after_label: "Con AdBrief",
    ba_1_before: "Exportar CSV de Meta cada lunes", ba_1_after: "Pregunta: \"¿Qué corregir esta semana?\" — 10s",
    ba_2_before: "Comparar CTR de 20 conjuntos", ba_2_after: "\"¿Cuáles anuncios underperforman?\" — instantáneo",
    ba_3_before: "Adivinar por qué bajó el ROAS", ba_3_after: "\"¿Por qué bajó el ROAS?\" — diagnóstico específico",
    ba_4_before: "Escribir hooks sin datos", ba_4_after: "\"5 hooks de mis mejores creativos\"",
    pricing_label: "PRECIOS", pricing_h2: "3 días gratis. Quédate porque funciona.",
    pricing_sub: "Todos incluyen 3 días gratis. Sin cargo hasta el día 4.",
    pricing_cta: "Empezar prueba gratis", pricing_note: "3 días gratis · Sin cargo hasta el día 4",
    plan_badge_pro: "Más popular",
    plan_maker_f0: "50 mensajes / día", plan_maker_f1: "1 cuenta de anuncios", plan_maker_f2: "Herramientas básicas", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 mensajes / día", plan_pro_f1: "3 cuentas conectadas", plan_pro_f2: "Todas las herramientas", plan_pro_f3: "Marcas ilimitadas", plan_pro_f4: "Multi-mercado",
    plan_studio_f0: "Mensajes ilimitados", plan_studio_f1: "Cuentas ilimitadas", plan_studio_f2: "Todas las herramientas", plan_studio_f3: "Marcas ilimitadas", plan_studio_f4: "Workspace agencia",
    faq_label: "PREGUNTAS FRECUENTES", faq_h2: "Preguntas comunes",
    faq_q0: "¿Cómo funciona la prueba gratis?", faq_a0: "Al registrarte, tienes acceso completo por 3 días sin cargo. Cancela y no se te cobra.",
    faq_q1: "¿Por qué necesito tarjeta?", faq_a1: "Filtra usuarios serios y te da acceso completo. No cobramos nada en 72h (3 días).",
    faq_q2: "¿A qué se conecta?", faq_a2: "Meta Ads y Google Ads — conectados y leyendo tus datos en tiempo real. TikTok Ads próximamente.",
    faq_q3: "¿Mis datos son seguros?", faq_a3: "Sí. OAuth + tokens cifrados. Nunca almacenamos credenciales.",
    faq_q4: "¿Puedo usar para varios clientes?", faq_a4: "Sí. Pro: 3 cuentas. Studio: ilimitado.",
    faq_q5: "¿Qué es una Cuenta?", faq_a5: "Un perfil de marca conectado a tus cuentas de anuncios (Meta Ads, Google Ads). La IA personaliza cada respuesta.",
    faq_q6: "¿Funciona con catálogo?", faq_a6: "Sí. Todos los tipos de campaña de Meta — DPA, catálogo, Advantage+.",
    faq_q7: "¿Si no funciona?", faq_a7: "Cancela en 72h (3 días), sin cargo. En plan pago, escríbenos.",
    final_label: "EMPIEZA HOY", final_h2: "Tu cuenta está llena de insights.\nEmpieza a preguntar.",
    final_sub: "Conéctate en 2 minutos. Cancela cuando quieras.",
    final_cta: "Probar gratis 3 días", final_fine: "Cualquier plan · 3 días gratis · Cancela antes del día 4",
    trust_1: "Sin tarjeta hasta el día 4", trust_2: "Cancela cuando quieras", trust_3: "Configura en 2 minutos",
    tiktok_soon: "PRONTO",
    footer_copy: "© 2026 AdBrief",
    footer_tagline: "La IA que conoce tu cuenta de anuncios. Para de adivinar, empieza a escalar.",
    footer_product: "Producto",
    footer_legal: "Legal",
    footer_pricing: "Precios",
    footer_how: "Cómo funciona",
    footer_for: "Para quién",
    footer_tools: "Herramientas",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
    footer_faq: "FAQ",
    footer_built: "Hecho para gestores de tráfico que se mueven rápido.",
  },
};

// Demo answers per language
const DEMO_ANSWERS: Record<Lang, string[][]> = {
  en: [
    [
      "I found 3 simultaneous causes in your account:",
      "**Creative fatigue** — Creative_042 has been running 22 days. Hook rate dropped from 31% to 11%.",
      "**Frequency 4.8x** — BR-Women-25-34 is oversaturated. Every dollar goes to someone who saw it 5x.",
      "**CPM +38%** — the algorithm detected the relevance drop and is charging more.",
      "Action: pause Creative_042, relaunch Creative_019 (ROAS 3.2x, paused 9 days), split the saturated set.",
    ],
    [
      "3 ads to pause today — each for a different reason:",
      "**Creative_038** — CPM $18, CTR 0.4%, zero conversions in 7 days. Burning $180/day.",
      "**BR-Men-35-44 ad set** — ROAS 0.6x, frequency 5.1. You're paying to annoy an exhausted audience.",
      "**Creative_029** — hook rate 8% (your floor is 15%). 92% left in the first 3 seconds.",
      "Total: $620/day with negative return. Pausing frees budget for Creative_019 (ROAS 3.2x).",
    ],
    [
      "Based on your top 5 converters (avg hook rate 34%, ROAS 3.1x+):",
      '**Hook 1:** "You\'re paying $90 per click and don\'t know why — your data already has the answer."',
      '**Hook 2:** "3 of your 4 highest-spend ads have ROAS below 1x. See which one is worth keeping."',
      '**Hook 3:** "Your best creative from last month has been paused for 9 days. A competitor is scaling the same angle."',
      "Pattern: never generic benefit — always a specific statement that forces the user to stop.",
    ],
  ],
  pt: [
    [
      "Identifiquei 3 causas simultâneas na sua conta:",
      "**Fadiga criativa** — Creative_042 roda há 22 dias. Hook rate caiu de 31% para 11%.",
      "**Frequência 4.8x** — BR-Mulheres-25-34 supersaturado. Cada real vai para quem já viu 5x.",
      "**CPM +38%** — o algoritmo percebeu a queda de relevância e cobra mais.",
      "Ação: pause Creative_042, relance Creative_019 (ROAS 3.2x, parado 9 dias), divida o conjunto.",
    ],
    [
      "3 anúncios para pausar hoje:",
      "**Creative_038** — CPM R$91, CTR 0,4%, zero conversões em 7 dias. Queima R$180/dia.",
      "**BR-Homens-35-44** — ROAS 0,6x, frequência 5.1. Audiência exaurida.",
      "**Creative_029** — hook rate 8% (mínimo 15%). 92% saem nos primeiros 3 segundos.",
      "Total: R$620/dia com retorno negativo. Pausar libera verba para Creative_019.",
    ],
    [
      "Baseado nos seus 5 top converters (hook rate 34%, ROAS 3.1x+):",
      '**Hook 1:** "Você está pagando R$90 por clique e nem sabe por quê — seus dados já têm a resposta."',
      '**Hook 2:** "3 dos seus 4 anúncios que mais gastam têm ROAS abaixo de 1x. Veja qual vale manter."',
      '**Hook 3:** "Seu melhor criativo do mês passado está parado há 9 dias. O concorrente está escalando o mesmo ângulo."',
      "Padrão: nunca benefício genérico — sempre uma afirmação que força o usuário a parar.",
    ],
  ],
  es: [
    [
      "Identifiqué 3 causas simultáneas en tu cuenta:",
      "**Fatiga creativa** — Creative_042 lleva 22 días. Hook rate cayó de 31% a 11%.",
      "**Frecuencia 4.8x** — BR-Mujeres-25-34 supersaturado. Cada peso va a quien ya vio 5x.",
      "**CPM +38%** — el algoritmo detectó la caída de relevancia y cobra más.",
      "Acción: pausa Creative_042, relanza Creative_019 (ROAS 3.2x, pausado 9 días), divide el conjunto.",
    ],
    [
      "3 anuncios para pausar hoy:",
      "**Creative_038** — CPM $18, CTR 0.4%, cero conversiones en 7 días. Quema $180/día.",
      "**BR-Hombres-35-44** — ROAS 0.6x, frecuencia 5.1. Audiencia agotada.",
      "**Creative_029** — hook rate 8% (mínimo 15%). 92% se fueron en los primeros 3 segundos.",
      "Total: $620/día con retorno negativo. Pausar libera presupuesto para Creative_019.",
    ],
    [
      "Basado en tus 5 top converters (hook rate 34%, ROAS 3.1x+):",
      '**Hook 1:** "Estás pagando $90 por clic y no sabes por qué — tus datos ya tienen la respuesta."',
      '**Hook 2:** "3 de tus 4 anuncios que más gastan tienen ROAS bajo 1x. Mira cuál vale mantener."',
      '**Hook 3:** "Tu mejor creativo del mes pasado lleva 9 días pausado. El competidor está escalando el mismo ángulo."',
      "Patrón: nunca beneficio genérico — siempre una afirmación que obliga al usuario a detenerse.",
    ],
  ],
};

// IP-based language detection
async function detectLang(): Promise<Lang> {
  const stored = localStorage.getItem("adbrief_language") as Lang | null;
  if (stored && ["en", "pt", "es"].includes(stored)) return stored;
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const c = data.country_code as string;
    if (["BR","PT","AO","MZ","CV","GW","ST","TL"].includes(c)) return "pt";
    if (["MX","AR","CO","CL","PE","VE","EC","GT","CU","BO","DO","HN","PY","SV","NI","CR","PA","UY","GQ","ES"].includes(c)) return "es";
    return "en";
  } catch {
    const bl = navigator.language.slice(0, 2).toLowerCase();
    if (bl === "pt") return "pt";
    if (bl === "es") return "es";
    return "en";
  }
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span style={{ fontFamily: F, fontSize: "clamp(28px,4vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", background: "linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{value}</span>
        <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 6, letterSpacing: "0.02em" }}>{label}</p>
      </motion.div>
    </div>
  );
}

// ─── Section wrapper with reveal ──────────────────────────────────────────────
function Section({ children, id, className = "", noPadding = false, bg = "default" }: { children: React.ReactNode; id?: string; className?: string; noPadding?: boolean; bg?: "default"|"subtle"|"dark"|"accent" }) {
  const bgMap: Record<string, string> = {
    default: "#06080e",
    subtle:  "#0c1018",
    dark:    "#030407",
    accent:  "#070d1a",
  };
  return (
    <section
      id={id}
      className={className}
      style={noPadding
        ? { background: bgMap[bg] || "transparent" }
        : { padding: "clamp(48px,5vw,80px) clamp(20px,4vw,40px)", background: bgMap[bg] || "transparent" }
      }
    >
      {children}
    </section>
  );
}

// ─── Language switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const flags: Record<Lang, string> = { en: "🇺🇸", pt: "🇧🇷", es: "🇲🇽" };
  const pick = (l: Lang) => { setLang(l); localStorage.setItem("adbrief_language", l); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontFamily: F }}>
        <Globe size={11} /> {flags[lang]} {lang.toUpperCase()}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#161b22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", zIndex: 999, minWidth: 80, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            {(["en", "pt", "es"] as Lang[]).map(l => (
              <button key={l} onClick={() => pick(l)} style={{ width: "100%", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: lang === l ? "rgba(14,165,233,0.08)" : "transparent", border: "none", color: lang === l ? "#0ea5e9" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: F }}>
                {flags[l]} {l.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tools data ───────────────────────────────────────────────────────────────
type ToolDef = {
  id: string;
  color: string;
  accent: string;
  icon: React.ReactNode;
  name: Record<Lang, string>;
  tagline: Record<Lang, string>;
  desc: Record<Lang, string>;
  input: Record<Lang, string>;
  output: Record<Lang, string[]>;
  badge: Record<Lang, string>;
};

const TOOLS_DATA: ToolDef[] = [
  {
    id: "hooks", color: "#0ea5e9", accent: "rgba(14,165,233,0.10)",
    icon: <Zap size={20} />,
    name:    { pt: "Gerador de Hooks",      es: "Generador de Hooks",      en: "Hook Generator"       },
    tagline: { pt: "Dos seus criativos que converteram", es: "De tus creativos que convirtieron", en: "From creatives that already converted" },
    desc:    { pt: "Cola qualquer anúncio seu ou concorrente e receba hooks prontos — calibrados pelo padrão de engajamento dos seus melhores criativos.", es: "Pega cualquier anuncio tuyo o de la competencia y recibe hooks listos — calibrados por el patrón de engagement de tus mejores creativos.", en: "Paste any ad — yours or a competitor's — and get hooks ready to use, calibrated by your best-performing creative patterns." },
    input:   { pt: "Contexto da sua conta + produto", es: "Contexto de tu cuenta + producto", en: "Your account context + product" },
    badge:   { pt: "Output instantâneo", es: "Output instantáneo", en: "Instant output" },
    output:  {
      pt: ['"Creative_019 converteu 2.4x mais essa semana. Veja o padrão."', '"Hook rate 38% — seu melhor criativo prende atenção nos primeiros 3s."', '"Escale R$120 → R$400/dia. Frequência 1.3x — tem muito espaço ainda."'],
      es: ['"Creative_019 convirtió 2.4x más esta semana. Mira el patrón."', '"Hook rate 38% — tu mejor creativo retiene atención en los primeros 3s."', '"Escala $120 → $400/día. Frecuencia 1.3x — hay mucho espacio todavía."'],
      en: ['"Creative_019 converted 2.4x more this week. Here\'s the pattern."', '"Hook rate 38% — your best creative holds attention in the first 3s."', '"Scale $120 → $400/day. Frequency 1.3x — still plenty of room to grow."'],
    },
  },
  {
    id: "script", color: "#a78bfa", accent: "rgba(167,139,250,0.10)",
    icon: <Play size={20} />,
    name:    { pt: "Script de Vídeo",  es: "Script de Video",  en: "Video Script"   },
    tagline: { pt: "UGC e DR prontos para gravar", es: "UGC y DR listos para grabar", en: "UGC & DR ready to record" },
    desc:    { pt: "Gera scripts completos de UGC ou direct-response com gancho, desenvolvimento e CTA — já adaptados ao nicho, mercado e tom da sua conta.", es: "Genera scripts completos de UGC o direct-response con gancho, desarrollo y CTA — ya adaptados al nicho, mercado y tono de tu cuenta.", en: "Generates complete UGC or direct-response scripts with hook, body, and CTA — already adapted to your account's niche, market, and tone." },
    input:   { pt: "Produto + plataforma + tom da marca", es: "Producto + plataforma + tono de marca", en: "Product + platform + brand tone" },
    badge:   { pt: "Script completo", es: "Script completo", en: "Full script" },
    output:  {
      pt: ["[GANCHO] Creative_019 converteu 2.4x mais essa semana. Veja o padrão.", "[DESENVOLVIMENTO] Gestores que escalam rápido têm uma coisa em comum — sabem exatamente qual criativo funciona.", "[CTA] Conecte sua conta agora. 30 segundos. Sem CSV."],
      es: ["[GANCHO] Creative_019 convirtió 2.4x más esta semana. Mira el patrón.", "[DESARROLLO] Los gestores que escalan rápido tienen algo en común — saben exactamente qué creativo funciona.", "[CTA] Conecta tu cuenta ahora. 30 segundos. Sin CSV."],
      en: ["[HOOK] Creative_019 converted 2.4x more this week. Here's the pattern.", "[BODY] Media buyers who scale fast all have one thing in common — they know exactly which creative is working.", "[CTA] Connect your account now. 30 seconds. No CSV."],
    },
  },
  {
    id: "brief", color: "#34d399", accent: "rgba(52,211,153,0.10)",
    icon: <Layers size={20} />,
    name:    { pt: "Brief Criativo",  es: "Brief Creativo",  en: "Creative Brief"   },
    tagline: { pt: "Diz ao time o que produzir e por quê", es: "Dice al equipo qué producir y por qué", en: "Tells your team what to make and why" },
    desc:    { pt: "Gera briefs completos baseados nos seus dados reais — formato que funciona, ângulo, referência de gancho e instrução para o editor. Elimina o vai-e-vem de revisão.", es: "Genera briefs completos basados en tus datos reales — formato que funciona, ángulo, referencia de gancho e instrucción para el editor. Elimina el ida y vuelta.", en: "Generates complete briefs based on your real data — winning format, angle, hook reference, and editor instruction. Eliminates revision back-and-forth." },
    input:   { pt: "Conta ativa + campanha de referência", es: "Cuenta activa + campaña de referencia", en: "Active account + reference campaign" },
    badge:   { pt: "Pronto para enviar", es: "Listo para enviar", en: "Ready to send" },
    output:  {
      pt: ["Formato: Vídeo UGC 9:16 · 30-45s", "Ângulo: Problema → Diagnóstico → Solução", "Referência: Creative_019 (ROAS 3.2x, hook rate 34%)", "Instrução: abrir com dado real, sem música no início"],
      es: ["Formato: Video UGC 9:16 · 30-45s", "Ángulo: Problema → Diagnóstico → Solución", "Referencia: Creative_019 (ROAS 3.2x, hook rate 34%)", "Instrucción: abrir con dato real, sin música al inicio"],
      en: ["Format: UGC Video 9:16 · 30-45s", "Angle: Problem → Diagnosis → Solution", "Reference: Creative_019 (ROAS 3.2x, hook rate 34%)", "Direction: open with real stat, no music at start"],
    },
  },
  {
    id: "competitor", color: "#f97316", accent: "rgba(249,115,22,0.10)",
    icon: <Target size={20} />,
    name:    { pt: "Decodificador",       es: "Decodificador",          en: "Competitor Decode"    },
    tagline: { pt: "Desmonta qualquer anúncio concorrente", es: "Desmonta cualquier anuncio rival", en: "Reverse-engineer any competitor ad" },
    desc:    { pt: "Cole a URL ou descreva um anúncio concorrente. A IA identifica o gancho, ângulo, formato, CTA e o que está funcionando — para você replicar com sua conta.", es: "Pega la URL o describe un anuncio rival. La IA identifica el gancho, ángulo, formato, CTA y lo que funciona — para que lo repliques con tu cuenta.", en: "Paste the URL or describe a competitor ad. The AI identifies the hook, angle, format, CTA, and what's working — so you can replicate with your account." },
    input:   { pt: "URL ou descrição do anúncio", es: "URL o descripción del anuncio", en: "Ad URL or description" },
    badge:   { pt: "Análise estrutural", es: "Análisis estructural", en: "Structural analysis" },
    output:  {
      pt: ["Gancho: dado numérico + problema específico", "Ângulo: medo de perda (FOMO financeiro)", "Formato: talking head com texto onscreen", "CTA: urgência implícita — sem prazo explícito"],
      es: ["Gancho: dato numérico + problema específico", "Ángulo: miedo a perder (FOMO financiero)", "Formato: talking head con texto en pantalla", "CTA: urgencia implícita — sin plazo explícito"],
      en: ["Hook: numeric stat + specific problem", "Angle: loss aversion (financial FOMO)", "Format: talking head with on-screen text", "CTA: implied urgency — no explicit deadline"],
    },
  },
  {
    id: "translate", color: "#ec4899", accent: "rgba(236,72,153,0.10)",
    icon: <Globe size={20} />,
    name:    { pt: "Tradutor de Anúncios",  es: "Traductor de Anuncios",  en: "Ad Translator"        },
    tagline: { pt: "Tom e plataforma adaptados por mercado", es: "Tono y plataforma por mercado", en: "Tone and platform adapted per market" },
    desc:    { pt: "Traduz anúncios entre mercados mantendo o tom, a gíria local e o poder de conversão. Não é só tradução — é adaptação cultural com contexto da sua conta.", es: "Traduce anuncios entre mercados manteniendo el tono, la jerga local y el poder de conversión. No es solo traducción — es adaptación cultural con contexto de tu cuenta.", en: "Translates ads across markets while keeping tone, local slang, and conversion power. Not just translation — cultural adaptation with your account context." },
    input:   { pt: "Anúncio original + mercado de destino", es: "Anuncio original + mercado destino", en: "Original ad + target market" },
    badge:   { pt: "PT · ES · EN · +4", es: "PT · ES · EN · +4", en: "PT · ES · EN · +4" },
    output:  {
      pt: ["BR → MX: \"queimar verba\" → \"quemar presupuesto\"", "Adaptação de CTA: \"Jogue agora\" → \"Pruébalo gratis\"", "Gíria local preservada: \"gestor de tráfego\" → \"media buyer\"", "Tom: mantido direto e urgente nos dois mercados"],
      es: ["BR → MX: \"queimar verba\" → \"quemar presupuesto\"", "Adaptación de CTA: \"Jogue agora\" → \"Pruébalo gratis\"", "Jerga local preservada: \"gestor de tráfego\" → \"media buyer\"", "Tono: directo y urgente en ambos mercados"],
      en: ["BR → MX: \"queimar verba\" → \"quemar presupuesto\"", "CTA adapted: \"Jogue agora\" → \"Pruébalo gratis\"", "Local slang preserved across markets", "Tone: kept direct and urgent in both markets"],
    },
  },
  {
    id: "analysis", color: "#60a5fa", accent: "rgba(96,165,250,0.10)",
    icon: <BarChart3 size={20} />,
    name:    { pt: "Análise de Campanha",  es: "Análisis de Campaña",  en: "Campaign Analysis"    },
    tagline: { pt: "Diagnóstico em segundos, não em planilhas", es: "Diagnóstico en segundos, no en hojas de cálculo", en: "Diagnosis in seconds, not spreadsheets" },
    desc:    { pt: "Pergunte qualquer coisa sobre seus dados do Meta Ads. A IA lê suas campanhas em tempo real e responde com diagnóstico específico — sem exportar CSV, sem fórmulas.", es: "Pregunta lo que quieras sobre tus datos de Meta Ads. La IA lee tus campañas en tiempo real y responde con diagnóstico específico — sin exportar CSV, sin fórmulas.", en: "Ask anything about your Meta Ads data. The AI reads your campaigns in real time and responds with a specific diagnosis — no CSV export, no formulas." },
    input:   { pt: "Qualquer pergunta sobre sua conta", es: "Cualquier pregunta sobre tu cuenta", en: "Any question about your account" },
    badge:   { pt: "Dados em tempo real", es: "Datos en tiempo real", en: "Real-time data" },
    output:  {
      pt: ["CPM médio: R$38 (+22% vs semana passada)", "3 campanhas com frequência acima de 4x → risco de fadiga", "Creative_019: melhor ROAS da conta (3.2x) — orçamento subutilizado", "Recomendação: pausar 2, escalar 1, renovar criativos em BR-F-25-34"],
      es: ["CPM promedio: $38 (+22% vs semana pasada)", "3 campañas con frecuencia sobre 4x → riesgo de fatiga", "Creative_019: mejor ROAS de la cuenta (3.2x) — presupuesto subutilizado", "Recomendación: pausar 2, escalar 1, renovar creativos en MX-F-25-34"],
      en: ["Avg CPM: $18 (+22% vs last week)", "3 campaigns with frequency above 4x → fatigue risk", "Creative_019: best ROAS in account (3.2x) — budget underused", "Recommendation: pause 2, scale 1, refresh creatives in US-F-25-34"],
    },
  },
];

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ onCTA, t, lang, setLang, ctaLoading }: { onCTA: () => void; t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void; ctaLoading?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(5,5,8,0.9)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      transition: 'background 0.4s, border-color 0.4s',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 62, padding: '0 clamp(16px,4vw,32px)' }}>
        <Logo size="lg" />
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32, marginLeft: 44 }}>
          {([[t.nav_how,'#how'],['Casos de Uso' === t.nav_for ? 'Casos de Uso' : t.nav_for,'#for'],[t.nav_pricing,'#pricing'],['Tools','#tools']] as [string,string][]).map(([label,href]) => (
            <a key={href} href={href} style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
              {label}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <LangSwitcher lang={lang} setLang={setLang} />
          <button className="nav-links" onClick={() => window.location.href = '/login'}
            style={{ fontFamily: F, fontSize: 13, padding: '8px 16px', borderRadius: 9, background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.7)'; el.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.4)'; el.style.borderColor = 'rgba(255,255,255,0.15)'; }}>
            {t.nav_signin}
          </button>
          <CTAButton
            onClick={onCTA}
            loading={ctaLoading}
            label={lang === 'pt' ? 'Começar grátis' : lang === 'es' ? 'Comenzar gratis' : 'Start for free'}
            size="sm"
            variant="white"
          />
        </div>
      </div>
    </nav>
  );
}

// ─── Demo conversations data ──────────────────────────────────────────────────
// ─── Industries for demo ──────────────────────────────────────────────────────
const INDUSTRIES_DEMO = [
  { id: "fitness",  emoji: "💪", label: { pt: "Meta · Fitness",   es: "Meta · Fitness",   en: "Meta · Fitness"   }, color: "#34d399", initial: "F" },
  { id: "clinica",  emoji: "🏥", label: { pt: "Google · Clínica", es: "Google · Clínica", en: "Google · Clinic"  }, color: "#60a5fa", initial: "C" },
  { id: "ecomm",    emoji: "🛍️", label: { pt: "Meta · E-comm",    es: "Meta · E-comm",    en: "Meta · E-comm"    }, color: "#0ea5e9", initial: "L" },
  { id: "igaming",  emoji: "🎰", label: { pt: "Meta · iGaming",   es: "Meta · iGaming",   en: "Meta · iGaming"   }, color: "#a78bfa", initial: "E" },
  { id: "saas",     emoji: "⚡", label: { pt: "Meta · SaaS",      es: "Meta · SaaS",      en: "Meta · SaaS"      }, color: "#fbbf24", initial: "S" },
];

const INDUSTRY_ACCOUNTS: Record<string, Record<Lang, { name: string; meta: string; campaigns: string }>> = {
  igaming:  { pt:{name:"Duck Bet",   meta:"Meta · 18 campanhas"}, es:{name:"Duck Bet MX",      meta:"Meta · 22 campañas"},    en:{name:"BetCore US",   meta:"Meta · 31 campaigns"} } as any,
  ecomm:    { pt:{name:"Loja Verde",     meta:"Meta · 41 campanhas"}, es:{name:"ModaRápida MX", meta:"Meta · 38 campañas"},    en:{name:"ShopFlow",     meta:"Meta · 29 campaigns"} } as any,
  fitness:  { pt:{name:"FitCore Brasil", meta:"Meta · 22 campanhas"}, es:{name:"FitMex",        meta:"Meta · 17 campañas"},    en:{name:"FitCore US",   meta:"Meta · 22 campaigns"} } as any,
  finance:  { pt:{name:"WealthBR",       meta:"Meta · 14 campanhas"}, es:{name:"FinMex Pro",    meta:"Meta · 11 campañas"},    en:{name:"WealthApp",    meta:"Meta · 19 campaigns"} } as any,
  saas:     { pt:{name:"StartupAI",      meta:"Meta · 9 campanhas"},  es:{name:"TechStart MX",  meta:"Meta · 8 campañas"},     en:{name:"SaaSBoost",    meta:"Meta · 12 campaigns"} } as any,
  clinica:  { pt:{name:"Clínica Estética BH", meta:"Google Ads · 3 campanhas"}, es:{name:"Clínica Estética MX", meta:"Google Ads · 4 campañas"}, en:{name:"Beauty Clinic", meta:"Google Ads · 3 campaigns"} } as any,
};

const DEMO_QA_BY_INDUSTRY: Record<string, Record<Lang, Array<{ q: string; lines: string[] }>>> = {
  igaming: {
    pt: [
      {
        q: "Qual campanha está trazendo jogadores que mais depositam?",
        lines: [
          "**Campanha_Slots_BR_03** lidera em qualidade de jogador:",
          "Depósito médio R$187 — 2.3x acima da média da conta.",
          "Retenção D7: 41% — jogadores voltam na segunda semana.",
          "Escale de R$200 → R$600/dia. LTV projetado: +R$3.400/semana.",
        ]
      },
      {
        q: "Meu CPR está ótimo, mas os jogadores não estão reativando. O que fazer?",
        lines: [
          "Padrão claro nos dados: aquisição forte, ativação fraca.",
          "**Segmento dormentes D14+** — 2.847 jogadores registrados, 0 depósito.",
          "Campanha de reativação com bônus R$20 converteu 22% no último teste.",
          "Lance remarketing hoje. Potencial: +R$56k de depósitos essa semana.",
        ]
      },
      {
        q: "Escreve hooks para jogadores que já conhecem nossa plataforma.",
        lines: [
          "Padrão dos seus top ads para público warm (hook rate 39%):",
          "\"Seu bônus de R$50 expira amanhã. 1.200 jogadores já resgataram hoje.\"",
          "\"Você jogou semana passada e saiu no lucro. Seus slots favoritos estão rodando.\"",
          "\"Torneio exclusivo começa em 2 horas. Últimas 47 vagas abertas.\"",
        ]
      },
    ],
    es: [
      {
        q: "¿Qué campaña trae jugadores que más depositan?",
        lines: [
          "**Campaña_Slots_MX_03** lidera en calidad de jugador:",
          "Depósito promedio $187 — 2.3x por encima del promedio de la cuenta.",
          "Retención D7: 41% — los jugadores vuelven en la segunda semana.",
          "Escala de $200 → $600/día. LTV proyectado: +$3,400/semana.",
        ]
      },
      {
        q: "Mi CPR está perfecto, pero los jugadores no regresan. ¿Qué hago?",
        lines: [
          "Patrón claro en los datos: adquisición fuerte, activación débil.",
          "**Segmento durmientes D14+** — 2,847 jugadores registrados, 0 depósito.",
          "Campaña de reactivación con bono $20 convirtió 22% en el último test.",
          "Lanza remarketing hoy. Potencial: +$56k en depósitos esta semana.",
        ]
      },
      {
        q: "Escribe hooks para jugadores que ya conocen nuestra plataforma.",
        lines: [
          "Patrón de tus top ads para público warm (hook rate 39%):",
          "\"Tu bono de $50 expira mañana. 1,200 jugadores ya lo canjearon hoy.\"",
          "\"Jugaste la semana pasada y saliste ganando. Tus slots favoritos están activos.\"",
          "\"Torneo exclusivo empieza en 2 horas. Últimos 47 lugares disponibles.\"",
        ]
      },
    ],
    en: [
      {
        q: "Which campaign brings players who deposit the most?",
        lines: [
          "**Campaign_Slots_US_03** leads on player quality:",
          "Average deposit $187 — 2.3x above account average.",
          "D7 retention: 41% — players return in the second week.",
          "Scale from $200 → $600/day. Projected LTV: +$3,400/week.",
        ]
      },
      {
        q: "My CPR is great but players aren't reactivating. What should I do?",
        lines: [
          "Clear pattern in the data: strong acquisition, weak activation.",
          "**Dormant D14+ segment** — 2,847 registered players, 0 deposits.",
          "Reactivation campaign with $20 bonus converted 22% in last test.",
          "Launch remarketing today. Potential: +$56k in deposits this week.",
        ]
      },
      {
        q: "Write hooks for players who already know our platform.",
        lines: [
          "Pattern from your top ads for warm audiences (hook rate 39%):",
          "\"Your $50 bonus expires tomorrow. 1,200 players already claimed it today.\"",
          "\"You played last week and walked away ahead. Your favorite slots are live.\"",
          "\"Exclusive tournament starts in 2 hours. Last 47 spots available.\"",
        ]
      },
    ],
  },
  ecomm: {
    pt: [
      {
        q: "Qual produto está com a melhor margem de retorno essa semana?",
        lines: [
          "**Categoria Eletrônicos** está em outro nível:",
          "ROAS 4.1x, ticket médio R$320, taxa de recompra 18% em 30 dias.",
          "Ad_Eletro_07 com frequência 1.2x — ainda tem muito espaço.",
          "Suba orçamento de R$80 → R$280/dia. Projeção: +R$900/dia líquido.",
        ]
      },
      {
        q: "Tenho muitos cliques mas poucas conversões. O problema é o anúncio ou a página?",
        lines: [
          "O dado aponta claramente para a landing, não o anúncio.",
          "**CTR médio 3.2%** — acima do benchmark. O criativo está funcionando.",
          "**Conversão pós-clique: 0.8%** — benchmark do setor é 2.4%.",
          "Teste: troque o hero da página por vídeo do produto. Projeção: +3x conversão.",
        ]
      },
      {
        q: "Escreve hooks de e-commerce baseados nos meus top criativos.",
        lines: [
          "Padrão dos seus best sellers (hook rate 36%, ROAS 3.8x+):",
          "\"Chegou ontem. Já tem 2.400 avaliações 5 estrelas. Ainda tem estoque.\"",
          "\"Esse produto vendeu 840 unidades hoje. Sua cor favorita ainda está disponível.\"",
          "\"Frete grátis + entrega em 72h para sua cidade. Só até hoje à meia-noite.\"",
        ]
      },
    ],
    es: [
      {
        q: "¿Qué producto tiene el mejor margen de retorno esta semana?",
        lines: [
          "**Categoría Electrónica** está en otro nivel:",
          "ROAS 4.1x, ticket promedio $320, tasa de recompra 18% en 30 días.",
          "Ad_Electro_07 con frecuencia 1.2x — aún hay mucho espacio.",
          "Sube presupuesto de $80 → $280/día. Proyección: +$900/día neto.",
        ]
      },
      {
        q: "Tengo muchos clics pero pocas conversiones. ¿Es el anuncio o la página?",
        lines: [
          "El dato apunta claramente a la landing, no al anuncio.",
          "**CTR promedio 3.2%** — por encima del benchmark. El creativo funciona.",
          "**Conversión post-clic: 0.8%** — benchmark del sector es 2.4%.",
          "Test: cambia el hero de la página por video del producto. Proyección: +3x conversión.",
        ]
      },
      {
        q: "Escribe hooks de e-commerce basados en mis mejores creativos.",
        lines: [
          "Patrón de tus best sellers (hook rate 36%, ROAS 3.8x+):",
          "\"Llegó ayer. Ya tiene 2,400 reseñas de 5 estrellas. Aún hay stock.\"",
          "\"Este producto vendió 840 unidades hoy. Tu color favorito sigue disponible.\"",
          "\"Envío gratis + entrega en 24h a tu ciudad. Solo hasta hoy a medianoche.\"",
        ]
      },
    ],
    en: [
      {
        q: "Which product has the best return margin this week?",
        lines: [
          "**Electronics category** is in a league of its own:",
          "ROAS 4.1x, average order $320, 18% repurchase rate in 30 days.",
          "Ad_Electro_07 at 1.2x frequency — still plenty of room.",
          "Scale budget from $80 → $280/day. Projection: +$900/day net.",
        ]
      },
      {
        q: "I have lots of clicks but few conversions. Is it the ad or the page?",
        lines: [
          "The data clearly points to the landing page, not the ad.",
          "**Average CTR 3.2%** — above benchmark. The creative is working.",
          "**Post-click conversion: 0.8%** — sector benchmark is 2.4%.",
          "Test: swap page hero for product video. Projection: +3x conversion rate.",
        ]
      },
      {
        q: "Write e-commerce hooks based on my top creatives.",
        lines: [
          "Pattern from your best sellers (hook rate 36%, ROAS 3.8x+):",
          "\"Arrived yesterday. Already has 2,400 5-star reviews. Still in stock.\"",
          "\"This product sold 840 units today. Your favorite color is still available.\"",
          "\"Free shipping + 24h delivery to your city. Only until midnight tonight.\"",
        ]
      },
    ],
  },
  fitness: {
    pt: [
      {
        q: "Qual meu melhor criativo essa semana?",
        lines: [
          "**Creative_019** está dominando sua conta:",
          "Hook rate 38% — 2.4x acima da média. Prende nos primeiros 3s.",
          "ROAS 3.8x com frequência 1.3x — ainda tem muito espaço pra escalar.",
          "Suba de R$120 → R$400/dia. Projeção: +R$1.080/dia de retorno.",
        ]
      },
      {
        q: "Qual público está respondendo melhor aos meus criativos de antes e depois?",
        lines: [
          "**BR-Mulheres-28-38** é seu público ouro para before/after:",
          "CTR 4.1%, taxa de lead 8.3% — 3x acima da média da conta.",
          "CPA R$18 — o mais baixo de todos os segmentos ativos.",
          "Ainda em frequência 1.1x. Escale agressivamente: R$50 → R$220/dia.",
        ]
      },
      {
        q: "Escreve hooks para academia baseados nos meus criativos que mais convertem.",
        lines: [
          "Padrão dos seus top performers (hook rate 34-38%, ROAS 3.8x+):",
          "\"Seu corpo mudou em 30 dias. A maioria desiste no 3º. Você não vai.\"",
          "\"Essa técnica aumentou conversão de leads em 3x para academias BR.\"",
          "\"Por que 9 em cada 10 pagam a academia e não vão? Esse vídeo explica.\"",
        ]
      },
    ],
    es: [
      {
        q: "¿Cuál es mi mejor creativo esta semana?",
        lines: [
          "**Creative_019** está dominando tu cuenta:",
          "Hook rate 38% — 2.4x por encima del promedio. Retiene en los primeros 3s.",
          "ROAS 3.8x con frecuencia 1.3x — todavía hay espacio para escalar.",
          "Sube de $120 → $400/día. Proyección: +$1,080/día de retorno.",
        ]
      },
      {
        q: "¿Qué público responde mejor a mis creativos de antes y después?",
        lines: [
          "**MX-Mujeres-28-38** es tu público oro para before/after:",
          "CTR 4.1%, tasa de lead 8.3% — 3x por encima del promedio de la cuenta.",
          "CPA $18 — el más bajo de todos los segmentos activos.",
          "Aún en frecuencia 1.1x. Escala agresivamente: $50 → $220/día.",
        ]
      },
      {
        q: "Escribe hooks para gym basados en mis creativos que más convierten.",
        lines: [
          "Patrón de tus top performers (hook rate 34-38%, ROAS 3.8x+):",
          "\"Tu cuerpo cambió en 30 días. La mayoría abandona el 3ro. Tú no.\"",
          "\"Esta técnica aumentó conversión de leads 3x en gimnasios MX.\"",
          "\"¿Por qué 9 de cada 10 pagan el gym y no van? Este video explica.\"",
        ]
      },
    ],
    en: [
      {
        q: "What's my best creative this week?",
        lines: [
          "**Creative_019** is dominating your account:",
          "Hook rate 38% — 2.4x above average. Holds attention in the first 3 seconds.",
          "ROAS 3.8x at 1.3x frequency — still plenty of room to scale.",
          "Raise from $120 → $400/day. Projection: +$1,080/day in returns.",
        ]
      },
      {
        q: "Which audience responds best to my before & after creatives?",
        lines: [
          "**US-Women-28-38** is your gold audience for before/after content:",
          "CTR 4.1%, lead rate 8.3% — 3x above account average.",
          "CPA $18 — lowest of all active segments.",
          "Still at 1.1x frequency. Scale aggressively: $50 → $220/day.",
        ]
      },
      {
        q: "Write gym hooks based on my best-converting creatives.",
        lines: [
          "Pattern from your top performers (hook rate 34-38%, ROAS 3.8x+):",
          "\"Your body changed in 30 days. Most people quit on day 3. You won't.\"",
          "\"This method increased gym lead conversion by 3x across the US.\"",
          "\"Why do 9 out of 10 people pay for a gym and never go? This video explains.\"",
        ]
      },
    ],
  },
  finance: {
    pt: [
      {
        q: "Qual anúncio está trazendo leads de maior renda?",
        lines: [
          "**Ad_Invest_03** lidera em qualidade de lead:",
          "CPL R$9.40, mas renda declarada média R$12.800/mês — 2.1x acima dos outros.",
          "Taxa de qualificação: 68% — leads chegam sabendo o que querem.",
          "Escale para R$500/dia. Potencial de R$2.500 de retorno diário.",
        ]
      },
      {
        q: "Meu custo por lead caiu, mas a taxa de conversão em cliente também. Por quê?",
        lines: [
          "Clássico trade-off de volume vs qualidade — seus dados confirmam.",
          "**Campanha ampliada BR-Todos-18-65** trouxe CPL R$8, mas conv. 2.1% (era 9%).",
          "**Campanha BR-Homens-35-55** mantém CPL R$18, conv. 14% — 6.7x melhor.",
          "Retorne para segmento qualificado. Receita por lead: R$140 vs R$22.",
        ]
      },
      {
        q: "Escreve hooks de finanças que atraem investidores sérios.",
        lines: [
          "Padrão dos seus top ads para público de alta renda (hook rate 41%):",
          "\"Seu dinheiro rendeu 11% ao ano na poupança. Esse ativo rendeu 180% em 2024.\"",
          "\"O Banco Central mudou as regras do CDI. 94% dos brasileiros ainda não sabem.\"",
          "\"Gestores de patrimônio cobram R$8k/mês para fazer isso. Você pode fazer sozinho.\"",
        ]
      },
    ],
    es: [
      {
        q: "¿Qué anuncio trae leads de mayor ingreso?",
        lines: [
          "**Ad_Invest_03** lidera en calidad de lead:",
          "CPL $9.40, pero ingreso declarado promedio $12,800/mes — 2.1x por encima.",
          "Tasa de calificación: 68% — los leads llegan sabiendo lo que quieren.",
          "Escala a $500/día. Potencial de $2,500 de retorno diario.",
        ]
      },
      {
        q: "Mi costo por lead bajó, pero la tasa de conversión también. ¿Por qué?",
        lines: [
          "Clásico trade-off de volumen vs calidad — tus datos lo confirman.",
          "**Campaña amplia MX-Todos-18-65** trajo CPL $8, pero conv. 2.1% (era 9%).",
          "**Campaña MX-Hombres-35-55** mantiene CPL $18, conv. 14% — 6.7x mejor.",
          "Regresa al segmento calificado. Ingresos por lead: $140 vs $22.",
        ]
      },
      {
        q: "Escribe hooks de finanzas que atraigan inversores serios.",
        lines: [
          "Patrón de tus top ads para público de alto ingreso (hook rate 41%):",
          "\"Tu dinero rindió 11% anual en el banco. Este activo rindió 180% en 2024.\"",
          "\"El Banco de México cambió las reglas de los CETES. El 94% no lo sabe aún.\"",
          "\"Gestores de patrimonio cobran $8k/mes por hacer esto. Tú puedes hacerlo solo.\"",
        ]
      },
    ],
    en: [
      {
        q: "Which ad is bringing in the highest-income leads?",
        lines: [
          "**Ad_Invest_03** leads on lead quality:",
          "CPL $9.40, but average declared income $12,800/mo — 2.1x above others.",
          "Qualification rate: 68% — leads arrive knowing what they want.",
          "Scale to $500/day. Potential $2,500 return per day.",
        ]
      },
      {
        q: "My cost per lead dropped but so did my conversion rate. Why?",
        lines: [
          "Classic volume vs quality trade-off — your data confirms it.",
          "**Broad campaign US-All-18-65** brought CPL $8, but conv. 2.1% (was 9%).",
          "**Campaign US-Men-35-55** holds CPL $18, conv. 14% — 6.7x better.",
          "Return to qualified segment. Revenue per lead: $140 vs $22.",
        ]
      },
      {
        q: "Write finance hooks that attract serious investors.",
        lines: [
          "Pattern from your top ads for high-income audiences (hook rate 41%):",
          "\"Your money earned 11% a year in savings. This asset returned 180% in 2024.\"",
          "\"The Fed changed the yield rules. 94% of Americans still haven't heard.\"",
          "\"Wealth managers charge $8k/month to do this. You can do it yourself.\"",
        ]
      },
    ],
  },
  saas: {
    pt: [
      {
        q: "Qual campanha está trazendo usuários que mais ativam o trial?",
        lines: [
          "**Campanha_Remarketing_Trial** lidera em ativação:",
          "Trial-to-paid 11% — benchmark do setor é 4%. 2.75x acima.",
          "CPL R$23 com ROAS 6.8x — melhor ratio da conta.",
          "Suba de R$40 → R$200/dia. Projeção: +12 pagantes por semana.",
        ]
      },
      {
        q: "Meu trial está cheio, mas poucos convertem em pago. Onde está o problema?",
        lines: [
          "Os dados apontam para o momento de upgrade, não o onboarding.",
          "**Usuários que usam feature X** convertem 14x mais que os demais.",
          "**Usuários que não usam** — 89% cancelam no D7 sem tocar no produto.",
          "Lance campanha in-app para ativação de feature X. Projeção: +34% paid.",
        ]
      },
      {
        q: "Escreve hooks de SaaS para gestores de tráfego.",
        lines: [
          "Padrão dos seus top ads para ICP (hook rate 38%, CPL R$23):",
          "\"Seu time gasta 3 horas por dia em algo que essa IA faz em 4 minutos.\"",
          "\"Testei 12 ferramentas de análise. Só uma conecta direto na conta de anúncios.\"",
          "\"Por que gestores que escalam R$500k/mês usam IA diferente de você?\"",
        ]
      },
    ],
    es: [
      {
        q: "¿Qué campaña trae usuarios que más activan el trial?",
        lines: [
          "**Campaña_Remarketing_Trial** lidera en activación:",
          "Trial-to-paid 11% — benchmark del sector es 4%. 2.75x por encima.",
          "CPL $23 con ROAS 6.8x — mejor ratio de la cuenta.",
          "Sube de $40 → $200/día. Proyección: +12 pagantes por semana.",
        ]
      },
      {
        q: "Mi trial está lleno, pero pocos convierten a pago. ¿Dónde está el problema?",
        lines: [
          "Los datos apuntan al momento de upgrade, no al onboarding.",
          "**Usuarios que usan feature X** convierten 14x más que los demás.",
          "**Usuarios que no la usan** — 89% cancelan en D7 sin tocar el producto.",
          "Lanza campaña in-app para activación de feature X. Proyección: +34% pagos.",
        ]
      },
      {
        q: "Escribe hooks de SaaS para gestores de tráfico.",
        lines: [
          "Patrón de tus top ads para ICP (hook rate 38%, CPL $23):",
          "\"Tu equipo gasta 3 horas al día en algo que esta IA hace en 4 minutos.\"",
          "\"Probé 12 herramientas de análisis. Solo una conecta directo a la cuenta de anuncios.\"",
          "\"¿Por qué gestores que escalan $500k/mes usan IA diferente a la tuya?\"",
        ]
      },
    ],
    en: [
      {
        q: "Which campaign brings users who activate their trial the most?",
        lines: [
          "**Campaign_Remarketing_Trial** leads on activation:",
          "Trial-to-paid 11% — sector benchmark is 4%. 2.75x above.",
          "CPL $23 with ROAS 6.8x — best ratio in the account.",
          "Scale from $40 → $200/day. Projection: +12 paying users per week.",
        ]
      },
      {
        q: "My trial is full but few convert to paid. Where's the problem?",
        lines: [
          "The data points to the upgrade moment, not onboarding.",
          "**Users who activate feature X** convert 14x more than others.",
          "**Users who don't** — 89% churn on D7 without touching the product.",
          "Launch in-app campaign for feature X activation. Projection: +34% paid.",
        ]
      },
      {
        q: "Write SaaS hooks for performance marketers.",
        lines: [
          "Pattern from your top ads for ICP (hook rate 38%, CPL $23):",
          "\"Your team spends 3 hours a day on something this AI handles in 4 minutes.\"",
          "\"I tested 12 analytics tools. Only one connects directly to the ad account.\"",
          "\"Why do media buyers scaling $500k/month use a different AI than you?\"",
        ]
      },
    ],
  },

  clinica: {
    pt: [
      {
        q: "Por que meu CPA subiu 60% essa semana?",
        lines: [
          "Identifiquei a causa: um concorrente novo entrou em leilão para 'clínica estética BH' na segunda.",
          "**Seu CPC médio subiu de R$4,20 → R$6,80** nessa keyword. Está perdendo posição para ele.",
          "**3 keywords afetadas:** 'clínica estética BH' (CPA +82%), 'harmonização BH' (CPA +61%), 'botox Belo Horizonte' (CPA +44%).",
          "Ação: aumente lance em 'harmonização BH' (+25%) — seu Quality Score é 8/10, pode ganhar o leilão sem aumentar muito o CPA.",
          "Para 'clínica estética BH': adicione extensões de local para diferenciar do concorrente.",
        ],
      },
      {
        q: "Quais keywords estão trazendo mais agendamentos?",
        lines: [
          "Top 3 por conversão real nos últimos 30 dias:",
          "**'harmonização facial BH'** — 14 agendamentos, CPA R$38. Sua melhor keyword.",
          "**'botox zona sul BH'** — 9 agendamentos, CPA R$52. Boa, mas pode melhorar com extensão de local.",
          "**'preenchimento labial BH'** — 6 agendamentos, CPA R$71. Funciona, mas só à tarde (13h-18h).",
          "Sugestão: crie agendamento de anúncio só para 'preenchimento labial' nos horários de pico. Pode reduzir CPA 30%.",
        ],
      },
      {
        q: "Cria headlines para o Google baseado no que funciona aqui",
        lines: [
          "Baseado nas suas keywords com menor CPA e maior CTR:",
          "**Headline 1:** 'Harmonização Facial em BH | Agende Hoje' (38 chars)",
          "**Headline 2:** 'Clínica Estética Zona Sul BH | 15 Anos' (39 chars)",
          "**Headline 3:** 'Botox a Partir de R$X | Resultado Real' (39 chars)",
          "**Description:** 'Tratamentos estéticos com resultado comprovado em Belo Horizonte. Primeira avaliação gratuita. Ligue agora.'",
          "Padrão que converte aqui: localização + credencial + CTA direto. Sem urgência artificial.",
        ],
      },
    ],
    es: [
      {
        q: "¿Por qué mi CPA subió 60% esta semana?",
        lines: [
          "Identifiqué la causa: un competidor nuevo entró a pujar por 'clínica estética CDMX' el lunes.",
          "**Tu CPC promedio subió de $42 → $68** en esa keyword. Estás perdiendo posición.",
          "**3 keywords afectadas:** 'clínica estética CDMX' (CPA +82%), 'relleno de labios CDMX' (CPA +61%).",
          "Acción: sube puja en 'harmonización facial CDMX' (+25%) — tu Quality Score es 8/10.",
          "Para 'clínica estética CDMX': agrega extensiones de ubicación para diferenciarte.",
        ],
      },
      {
        q: "¿Qué keywords traen más citas agendadas?",
        lines: [
          "Top 3 por conversión real en los últimos 30 días:",
          "**'harmonización facial CDMX'** — 14 citas, CPA $380. Tu mejor keyword.",
          "**'botox zona rosa CDMX'** — 9 citas, CPA $520. Buena, puede mejorar con extensión de local.",
          "**'relleno labial CDMX'** — 6 citas, CPA $710. Funciona solo en la tarde (13h-18h).",
          "Sugerencia: programa anuncios solo en horarios pico para 'relleno labial'. Puede reducir CPA 30%.",
        ],
      },
      {
        q: "Crea headlines para Google basados en lo que funciona aquí",
        lines: [
          "Basado en tus keywords con menor CPA y mayor CTR:",
          "**Headline 1:** 'Harmonización Facial CDMX | Agenda Hoy' (38 chars)",
          "**Headline 2:** 'Clínica Estética Zona Rosa | 15 Años' (36 chars)",
          "**Headline 3:** 'Botox Desde $X | Resultado Real CDMX' (36 chars)",
          "**Description:** 'Tratamientos estéticos con resultado comprobado en CDMX. Primera evaluación gratis. Llama ahora.'",
          "Patrón que convierte: ubicación + credencial + CTA directo. Sin urgencia artificial.",
        ],
      },
    ],
    en: [
      {
        q: "Why did my CPA jump 60% this week?",
        lines: [
          "Found the cause: a new competitor started bidding on 'aesthetics clinic Miami' on Monday.",
          "**Your avg CPC jumped from $4.20 → $6.80** on that keyword. You're losing position.",
          "**3 affected keywords:** 'aesthetics clinic Miami' (CPA +82%), 'lip filler Miami' (CPA +61%).",
          "Action: raise bid on 'facial harmonization Miami' (+25%) — your Quality Score is 8/10.",
          "For 'aesthetics clinic Miami': add location extensions to differentiate from the competitor.",
        ],
      },
      {
        q: "Which keywords are driving actual appointments?",
        lines: [
          "Top 3 by real conversions in the last 30 days:",
          "**'facial harmonization Miami'** — 14 bookings, CPA $38. Your best keyword.",
          "**'botox south beach'** — 9 bookings, CPA $52. Good, can improve with location extension.",
          "**'lip filler Miami'** — 6 bookings, CPA $71. Works, but only afternoons (1pm-6pm).",
          "Suggestion: schedule ads only during peak hours for 'lip filler'. Could cut CPA 30%.",
        ],
      },
      {
        q: "Write Google headlines based on what converts here",
        lines: [
          "Based on your lowest-CPA, highest-CTR keywords:",
          "**Headline 1:** 'Facial Harmonization Miami | Book Today' (38 chars)",
          "**Headline 2:** 'Aesthetics Clinic South Beach | 15 Yrs' (38 chars)",
          "**Headline 3:** 'Botox from $X | Real Results Miami' (34 chars)",
          "**Description:** 'Proven aesthetic treatments in Miami. Free first consultation. Call now.'",
          "Pattern that converts here: location + credential + direct CTA. No fake urgency.",
        ],
      },
    ],
  },
};

// Keep DEMO_QA as alias for backward compat (uses fitness industry)
const DEMO_QA: Record<Lang, Array<{ q: string; lines: string[] }>> = {
  pt: DEMO_QA_BY_INDUSTRY.fitness.pt,
  es: DEMO_QA_BY_INDUSTRY.fitness.es,
  en: DEMO_QA_BY_INDUSTRY.fitness.en,
};

// ─── Streaming hook — plays once, stays done. User clicks sidebar to change. ──
function useStreaming(lang: Lang, externalQa?: Array<{ q: string; lines: string[] }>) {
  const [qi, setQi]               = useState(0);
  const [phase, setPhase]         = useState<'idle'|'typing'|'thinking'|'streaming'|'done'>('idle');
  const [typedQ, setTypedQ]       = useState('');
  const [lines, setLines]         = useState<string[]>([]);    // all committed lines
  const [activeLine, setActiveLine] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qaRef = useRef(externalQa || DEMO_QA[lang]);

  const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const play = useRef((idx: number) => {
    stop();
    const qa = qaRef.current[idx];
    setQi(idx);
    setPhase('idle');
    setTypedQ('');
    setLines([]);
    setActiveLine('');

    // — type question char by char —
    let ci = 0;
    const typeChar = () => {
      ci++;
      setTypedQ(qa.q.slice(0, ci));
      setPhase('typing');
      // SFX: subtle tick on every 3rd char
      if (ci % 3 === 0) playTick(800 + Math.random() * 200, 0.03, 0.03);
      if (ci < qa.q.length) {
        timer.current = setTimeout(typeChar, ci < 3 ? 55 : Math.random() * 35 + 18);
      } else {
        setPhase('thinking');
        // SFX: send sound when question done
        playTick(1100, 0.06, 0.05);
        timer.current = setTimeout(streamAnswer, 900);
      }
    };

    // — stream answer lines —
    const streamAnswer = () => {
      setPhase('streaming');
      // SFX: soft pop when AI starts answering
      playPop(0.04);
      let li = 0, lci = 0;
      const committed: string[] = [];
      const tick = () => {
        const line = qa.lines[li];
        if (lci <= line.length) {
          setActiveLine(line.slice(0, lci));
          lci++;
          timer.current = setTimeout(tick, lci < 2 ? 0 : Math.random() * 12 + 6);
        } else {
          committed.push(line);
          setLines([...committed]);
          setActiveLine('');
          li++; lci = 0;
          if (li < qa.lines.length) {
            playTick(600, 0.02, 0.04);
            timer.current = setTimeout(tick, 120);
          } else {
            setPhase('done'); // stays here — no loop
          }
        }
      };
      timer.current = setTimeout(tick, 0);
    };

    timer.current = setTimeout(typeChar, 280);
  }).current;

  // Start on mount / lang change / industry change — play first question once
  useEffect(() => {
    qaRef.current = externalQa || DEMO_QA[lang];
    play(0);
    return stop;
  }, [lang, externalQa]);

  const jump = (idx: number) => play(idx);

  return { qi, phase, typedQ, lines, activeLine, jump };
}

// ─── Render bold markdown ─────────────────────────────────────────────────────
const MdLine = React.forwardRef<HTMLParagraphElement, { text: string; style: React.CSSProperties }>(
  function MdLine({ text, style }, ref) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p ref={ref} style={style}>
        {parts.map((p, i) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={i} style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{p.slice(2,-2)}</strong>
            : <span key={i}>{p}</span>
        )}
      </p>
    );
  }
);

// ─── Thinking dots ────────────────────────────────────────────────────────────
const Dots = React.forwardRef<HTMLDivElement>(function Dots(_props, ref) {
  return (
    <div ref={ref} style={{ display: 'flex', gap: 5, padding: '8px 0', alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <motion.div key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
});

// ─── Inline suggestions — appear in chat after AI responds ───────────────────
function InlineSuggestions({ qa, qi, jump, lang, industry }: {
  qa: Array<{q:string;lines:string[]}>; qi: number;
  jump: (i:number) => void; lang: string;
  industry: typeof INDUSTRIES_DEMO[0];
}) {
  const [visible, setVisible] = React.useState(false);
  const label = lang === 'pt' ? 'Continuar com:' : lang === 'es' ? 'Continuar con:' : 'Continue with:';

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 320);
    return () => clearTimeout(t);
  }, [qi]);

  if (!visible) return null;

  const others = qa.map((item, i) => ({ item, i })).filter(({ i }) => i !== qi);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 40 }}>
      <p style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', margin: '0 0 4px', textTransform: 'uppercase' as const, fontWeight: 600 }}>{label}</p>
      {others.map(({ item, i }) => (
        <button key={i} onClick={() => { setVisible(false); jump(i); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'transparent', border: `1px solid rgba(255,255,255,0.06)`, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s', fontFamily: F }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontFamily: 'monospace' }}>↗</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.4 }}>
            {item.q.slice(0, 56)}{item.q.length > 56 ? '…' : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Suggestion Bubble — kept for mobile pills only ───────────────────────────
function SuggestionBubble({ qa, qi, phase, jump, lang, industry }: {
  qa: Array<{q:string; lines:string[]}>; qi: number; phase: string;
  jump: (i:number) => void; lang: string;
  industry: typeof INDUSTRIES_DEMO[0];
}) {
  const [open, setOpen] = React.useState(false);
  const sugLabel = lang === 'pt' ? 'sugestões' : lang === 'es' ? 'sugerencias' : 'suggestions';
  const icons = ['📉','⚡','✍️'];
  const activeQ = qa[qi];
  const isLive = phase === 'typing' || phase === 'thinking' || phase === 'streaming';

  return (
    <div style={{ marginTop: 4, marginBottom: 4 }}>
      {/* Active question bubble */}
      <div style={{ position: 'relative', padding: '10px 12px 10px 10px', borderRadius: 11, background: `${industry.color}12`, border: `1px solid ${industry.color}28`, transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{icons[qi]}</span>
          <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.45, margin: 0, flex: 1 }}>
            {activeQ?.q.slice(0,52)}{activeQ?.q.length > 52 ? '…' : ''}
          </p>
          {isLive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0ea5e9', flexShrink: 0, marginTop: 3, boxShadow: '0 0 5px #0ea5e9', animation: 'dotBounce2 1s ease-in-out infinite' }} />}
          {phase === 'done' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0, marginTop: 3 }} />}
        </div>
      </div>

      {/* Suggestions toggle */}
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', marginTop: 5, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          {open ? '↑' : '↓'} {sugLabel}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </button>

      {/* Collapsible other questions */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, animation: 'toolSlideIn 0.18s ease' }}>
          {qa.map((item, i) => i === qi ? null : (
            <button key={i} onClick={() => { jump(i); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}>
              <span style={{ fontSize: 12, flexShrink: 0, opacity: 0.55, marginTop: 1 }}>{icons[i]}</span>
              <span style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                {item.q.slice(0,42)}{item.q.length > 42 ? '…' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Demo Card — substitui o frame no mobile ─────────────────────────
function MobileDemoCard({ onCTA, lang, ctaLoading }: { onCTA: () => void; lang: Lang; ctaLoading?: boolean }) {
  const [active, setActive] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);

  const scenarios: Record<Lang, Array<{q: string; lines: Array<{text: string; accent?: boolean; highlight?: boolean}>}>> = {
    pt: [
      {
        q: "Qual meu melhor criativo essa semana?",
        lines: [
          { text: "Creative_019 está dominando sua conta:" },
          { text: "Hook rate 38% — 2.4x acima da média. Prende nos primeiros 3s.", highlight: true },
          { text: "ROAS 3.8x com frequência 1.3x — ainda tem espaço." },
          { text: "Suba de R$120 → R$400/dia. Projeção: +R$1.080/dia.", accent: true },
        ]
      },
      {
        q: "Quanto posso escalar essa semana?",
        lines: [
          { text: "Headroom claro na sua conta:" },
          { text: "Creative_019 — freq. 1.3x, ROAS 3.8x. Pode ir para R$400/dia.", highlight: true },
          { text: "BR-Mulheres-25-34 — saturação baixa, CPM estável." },
          { text: "Projeção conservadora: +R$2.200 de receita essa semana.", accent: true },
        ]
      },
      {
        q: "Escreve hooks dos meus winners.",
        lines: [
          { text: "Padrão dos seus top converters (hook rate 34-38%):" },
          { text: "\"Seu corpo mudou em 30 dias. A maioria desiste no 3º.\"", highlight: true },
          { text: "\"Essa técnica aumentou conversão de leads em 3x para academias BR.\"" },
          { text: "\"Por que 9 em 10 pagam a academia e não vão? Esse vídeo explica.\"", accent: true },
        ]
      },
    ],
    es: [
      {
        q: "¿Cuál es mi mejor creativo esta semana?",
        lines: [
          { text: "Creative_019 está dominando tu cuenta:" },
          { text: "Hook rate 38% — 2.4x por encima del promedio. Retiene en los 3s.", highlight: true },
          { text: "ROAS 3.8x con frecuencia 1.3x — todavía hay espacio." },
          { text: "Sube de $120 → $400/día. Proyección: +$1,080/día.", accent: true },
        ]
      },
      {
        q: "¿Cuánto puedo escalar esta semana?",
        lines: [
          { text: "Headroom claro en tu cuenta:" },
          { text: "Creative_019 — freq. 1.3x, ROAS 3.8x. Puede ir a $400/día.", highlight: true },
          { text: "MX-Mujeres-25-34 — saturación baja, CPM estable." },
          { text: "Proyección conservadora: +$2,200 de ingresos esta semana.", accent: true },
        ]
      },
      {
        q: "Escribe hooks de mis winners.",
        lines: [
          { text: "Patrón de tus top converters (hook rate 34-38%):" },
          { text: "\"Tu cuerpo cambió en 30 días. La mayoría abandona el 3ro.\"", highlight: true },
          { text: "\"Esta técnica aumentó conversión de leads 3x en gimnasios MX.\"" },
          { text: "\"¿Por qué 9 de 10 pagan el gym y no van? Este video explica.\"", accent: true },
        ]
      },
    ],
    en: [
      {
        q: "What's my best creative this week?",
        lines: [
          { text: "Creative_019 is dominating your account:" },
          { text: "Hook rate 38% — 2.4x above average. Holds attention in first 3s.", highlight: true },
          { text: "ROAS 3.8x at 1.3x frequency — still plenty of room to scale." },
          { text: "Scale from $120 → $400/day. Projection: +$1,080/day.", accent: true },
        ]
      },
      {
        q: "How much can I scale this week?",
        lines: [
          { text: "Clear headroom in your account:" },
          { text: "Creative_019 — 1.3x freq, 3.8x ROAS. Can go to $400/day.", highlight: true },
          { text: "US-Women-25-34 — low saturation, stable CPM." },
          { text: "Conservative projection: +$2,200 extra revenue this week.", accent: true },
        ]
      },
      {
        q: "Write hooks from my best-converting creatives.",
        lines: [
          { text: "Pattern from your top converters (hook rate 34-38%):" },
          { text: "\"Your body changed in 30 days. Most people quit on day 3.\"", highlight: true },
          { text: "\"This method increased gym lead conversion by 3x across the US.\"" },
          { text: "\"Why do 9 in 10 pay for a gym and never go? This video explains.\"", accent: true },
        ]
      },
    ],
  };

  const items = scenarios[lang] || scenarios.en;
  const current = items[active];

  const goTo = (i: number) => {
    if (i === active || animating) return;
    setAnimating(true);
    setTimeout(() => { setActive(i); setAnimating(false); }, 180);
  };

  return (
    <div style={{ width: '100%', padding: '0 16px' }}>
      {/* Scenario dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {items.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            width: active === i ? 20 : 6, height: 6,
            borderRadius: 3, border: 'none', cursor: 'pointer',
            background: active === i ? '#0ea5e9' : 'rgba(255,255,255,0.18)',
            transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
            padding: 0,
          }} />
        ))}
      </div>

      {/* Chat card */}
      <div style={{
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid rgba(14,165,233,0.18)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0d1017', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, letterSpacing: '-0.03em' }}>
              <span style={{ color: '#eef0f6' }}>ad</span><span style={{ color: '#38bdf8' }}>brief</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.22)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#818cf8', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: F, fontSize: 9.5, color: '#a5b4fc', fontWeight: 700 }}>
                {lang === 'pt' ? 'IA · Chat' : lang === 'es' ? 'IA · Chat' : 'AI · Chat'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(52,211,153,0.9)', fontWeight: 600 }}>Meta</span>
          </div>
        </div>

        {/* Chat content */}
        <div style={{ background: '#0d1117', padding: '20px 16px 16px' }}>

          {/* User question */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <p style={{ fontFamily: F, fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, margin: 0 }}>{current.q}</p>
            </div>
          </div>

          {/* AI response */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <span style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>AB</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {current.lines.map((line, i) => (
                <div key={i} style={{
                  padding: line.accent || line.highlight ? '9px 12px' : '0',
                  borderRadius: line.accent || line.highlight ? 9 : 0,
                  background: line.accent ? 'rgba(14,165,233,0.08)' : line.highlight ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: line.accent ? '1px solid rgba(14,165,233,0.18)' : line.highlight ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                  <p style={{
                    fontFamily: F,
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: 0,
                    color: line.accent ? '#38bdf8' : i === 0 ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.82)',
                    fontWeight: line.accent ? 600 : 400,
                  }}>{line.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <CTAButton
              onClick={onCTA}
              loading={ctaLoading}
              label={lang === 'pt' ? 'Testar com minha conta' : lang === 'es' ? 'Probar con mi cuenta' : 'Try with my account'}
              size="md"
              variant="white"
            />
          </div>

          <p style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            {lang === 'pt' ? 'Demo · com sua conta, usa dados reais' : lang === 'es' ? 'Demo · con tu cuenta, usa datos reales' : 'Demo · with your account, uses real data'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Animated KPI counter ─────────────────────────────────────────────────────
function AnimatedKPI({ value, suffix = '', duration = 1200 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = React.useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(parseFloat((from + (value - from) * ease).toFixed(1)));
      if (progress < 1) requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { requestAnimationFrame(step); obs.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, duration]);
  return <span ref={ref}>{display}{suffix}</span>;
}

// ─── Platform SVG badges ─────────────────────────────────────────────────────
function MetaBadge() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:5, background:'rgba(24,119,242,0.12)', border:'1px solid rgba(24,119,242,0.28)' }}>
      <svg width="11" height="6" viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metaOff11" x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0082FB"/>
          <stop offset="1" stopColor="#0064E0"/>
        </linearGradient>
      </defs>
      <path d="M13.5 0C8.5 0 4.7 2.6 2.2 6.3 0.8 8.4 0 10.9 0 13.7 0 18.5 2.3 22.1 5.9 23.9c1.6 0.8 3.3 1.1 5 1.1 3.2 0 6.1-1.2 8.7-3.8L28 13.7l8.4 7.5c2.6 2.6 5.5 3.8 8.7 3.8 1.7 0 3.4-0.3 5-1.1 3.6-1.8 5.9-5.4 5.9-10.2 0-2.8-0.8-5.3-2.2-7.4C51.3 2.6 47.5 0 42.5 0c-3.8 0-7.2 1.7-10.3 5.1L28 9.8 23.8 5.1C20.7 1.7 17.3 0 13.5 0zm0 5c2.6 0 5 1.3 7.5 4.1l3.3 3.7-3.3 3.7c-2.5 2.8-4.9 4.1-7.5 4.1-1.9 0-3.7-0.6-5.1-1.8C6.6 17.4 5.5 15.7 5.5 13.5c0-2.2 1.1-3.9 2.9-5.3C9.8 7.4 11.6 5 13.5 5zm29 0c1.9 0 3.7 0.6 5.1 1.8 1.8 1.4 2.9 3.1 2.9 5.3 0 2.2-1.1 3.9-2.9 5.3C45.7 18.6 43.9 19 42 19c-2.6 0-5-1.3-7.5-4.1L31.2 11.2 34.5 7.5C37 4.7 39.4 5 42.5 5z" fill="url(#metaOff11)"/>
    </svg>
      <span style={{ fontFamily:F, fontSize:9.5, color:'#6ba3f5', fontWeight:700, letterSpacing:'0.02em' }}>Meta Ads</span>
    </div>
  );
}
function GoogleBadge() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:5, background:'rgba(66,133,244,0.10)', border:'1px solid rgba(66,133,244,0.28)' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      <span style={{ fontFamily:F, fontSize:9.5, color:'#7ab4f5', fontWeight:700, letterSpacing:'0.02em' }}>Google Ads</span>
    </div>
  );
}

// ─── Selling Point Demo — UAU moments ───────────────────────────────────────

// Selling point scenarios — indexed by Lang
type SPScene = { tab: string; q: string; platform: 'meta' | 'google'; account: string; metric: string; metricLabel: string; points: string[]; action: string; };

const SELLING_POINTS: Record<Lang, SPScene[]> = {
  pt: [
    {
      tab: "Por que caiu?",
      q: "Meu ROAS caiu 40% essa semana. O que aconteceu?",
      platform: "meta", account: "FitCore Brasil",
      metric: "−40% ROAS",
      metricLabel: "3 causas identificadas — resolvidas em 1 resposta",
      points: [
        "**Creative_042** rodando há 22 dias: hook rate caiu de 31% → 8%. Audiência saturada.",
        "**Frequência 4.8x** em BR-Mulheres-25-34 — cada real vai pra quem já ignorou.",
        "**CPM subiu 38%** — o algoritmo penalizou a queda de relevância automaticamente.",
      ],
      action: "Pause Creative_042 agora. Relance Creative_019 — ROAS 3.2x antes de ser pausado.",
    },
    {
      tab: "O que escalar?",
      q: "Tem algum criativo pronto pra escalar?",
      platform: "meta", account: "FitCore Brasil",
      metric: "+R$1.080/dia",
      metricLabel: "retorno líquido projetado — triplicando o orçamento atual",
      points: [
        "**Creative_019** com hook rate 38% — 2.4x acima da média da conta.",
        "**ROAS 3.8x** e frequência 1.3x — ainda longe da saturação, muito espaço.",
        "Roda com R$120/dia. Pode ir para **R$400/dia com segurança** já hoje.",
      ],
      action: "Suba o orçamento de Creative_019 para R$400/dia. Projeção: +R$1.080/dia líquido.",
    },
    {
      tab: "Avisa antes",
      q: "Algum criativo vai falhar em breve?",
      platform: "meta", account: "FitCore Brasil",
      metric: "5 dias antes",
      metricLabel: "antecipação — detectado antes de queimar qualquer verba",
      points: [
        "**Creative_031** em colapso: frequência 3.9x, hook rate caindo 4%/dia.",
        "**BR-Homens-25-34**: CTR caiu de 2.8% → 1.1% em 6 dias. Audiência se esgotando.",
        "Ainda não custou caro — mas em 5 dias vai queimar sem retorno.",
      ],
      action: "Prepare uma variação de Creative_031 hoje. Zero interrupção de resultado.",
    },
    {
      tab: "Cria hooks",
      q: "Cria 3 hooks dos meus criativos que mais converteram",
      platform: "meta", account: "FitCore Brasil",
      metric: "hook rate 38%",
      metricLabel: "padrão dos seus top criativos — base dos hooks abaixo",
      points: [
        "**\u201cVocê treina há 3 meses e o ponteiro não se move — seus anúncios já sabem o porquê.\u201d**",
        "**\u201c3 de 4 transformações que você viu aqui custaram menos de R$18 de CAC. Quer ver a conta?\u201d**",
        "**\u201cSeu concorrente está rodando o mesmo ângulo do seu melhor UGC — pausado há 9 dias.\u201d**",
      ],
      action: "Padrão dos seus winners: dor específica com dado real → sem clichê de motivação.",
    },
  ],
  es: [
    {
      tab: "¿Por qué bajó?",
      q: "Mi ROAS bajó 40% esta semana. ¿Qué pasó?",
      platform: "meta", account: "FitMex",
      metric: "−40% ROAS",
      metricLabel: "3 causas identificadas — resueltas en 1 respuesta",
      points: [
        "**Creative_042** con 22 días activo: hook rate cayó de 31% → 8%. Audiencia saturada.",
        "**Frecuencia 4.8x** en MX-Mujeres-25-34 — cada peso va a quien ya ignoró el anuncio.",
        "**CPM subió 38%** — el algoritmo penalizó automáticamente la caída de relevancia.",
      ],
      action: "Pausa Creative_042 ahora. Relanza Creative_019 — tenía ROAS 3.2x antes de pausarse.",
    },
    {
      tab: "¿Qué escalar?",
      q: "¿Hay algún creativo listo para escalar?",
      platform: "meta", account: "FitMex",
      metric: "+$1.080/día",
      metricLabel: "retorno neto proyectado — triplicando el presupuesto actual",
      points: [
        "**Creative_019** con hook rate 38% — 2.4x sobre el promedio de la cuenta.",
        "**ROAS 3.8x** y frecuencia 1.3x — lejos de la saturación, mucho espacio.",
        "Corre con $120/día. Puede ir a **$400/día con seguridad** desde hoy.",
      ],
      action: "Sube el presupuesto de Creative_019 a $400/día. Proyección: +$1.080/día neto.",
    },
    {
      tab: "Avisa antes",
      q: "¿Algún creativo va a fallar pronto?",
      platform: "meta", account: "FitMex",
      metric: "5 días antes",
      metricLabel: "anticipación — detectado antes de quemar presupuesto",
      points: [
        "**Creative_031** en colapso: frecuencia 3.9x, hook rate cayendo 4%/día.",
        "**MX-Hombres-25-34**: CTR cayó de 2.8% → 1.1% en 6 días. Audiencia agotándose.",
        "Todavía no costó caro — pero en 5 días quemará sin retorno.",
      ],
      action: "Prepara una variación de Creative_031 hoy. Cero interrupción de resultados.",
    },
    {
      tab: "Crea hooks",
      q: "Crea 3 hooks de mis creativos que más convirtieron",
      platform: "meta", account: "FitMex",
      metric: "hook rate 38%",
      metricLabel: "patrón de tus top creativos — base de los hooks abajo",
      points: [
        "**\u201cLlevas 3 meses entrenando y la báscula no se mueve — tus anuncios ya saben por qué.\u201d**",
        "**\u201c3 de 4 transformaciones que viste aquí costaron menos de $18 de CAC. ¿Quieres ver la cuenta?\u201d**",
        "**\u201cTu competidor está escalando el mismo ángulo de tu mejor UGC — pausado hace 9 días.\u201d**",
      ],
      action: "Patrón de tus winners: dolor específico con dato real → sin clichés de motivación.",
    },
  ],
  en: [
    {
      tab: "Why did it drop?",
      q: "My ROAS dropped 40% this week. What happened?",
      platform: "meta", account: "FitCore US",
      metric: "−40% ROAS",
      metricLabel: "3 causes identified — solved in 1 answer",
      points: [
        "**Creative_042** running 22 days: hook rate fell from 31% → 8%. Audience saturated.",
        "**Frequency 4.8x** on US-Women-25-34 — every dollar goes to someone who already ignored it.",
        "**CPM up 38%** — the algorithm automatically penalized the relevance drop.",
      ],
      action: "Pause Creative_042 now. Relaunch Creative_019 — it had ROAS 3.2x before being paused.",
    },
    {
      tab: "What to scale?",
      q: "Is there a creative ready to scale?",
      platform: "meta", account: "FitCore US",
      metric: "+$1,080/day",
      metricLabel: "projected net return — tripling current budget",
      points: [
        "**Creative_019** with hook rate 38% — 2.4x above account average.",
        "**ROAS 3.8x** at frequency 1.3x — far from saturation, lots of room.",
        "Running at $120/day. Can go to **$400/day safely** starting today.",
      ],
      action: "Raise Creative_019 budget to $400/day. Projection: +$1,080/day net.",
    },
    {
      tab: "Warns you first",
      q: "Is any creative about to fail?",
      platform: "meta", account: "FitCore US",
      metric: "5 days early",
      metricLabel: "detected before burning any budget",
      points: [
        "**Creative_031** collapsing: frequency 3.9x, hook rate falling 4%/day.",
        "**US-Men-25-34**: CTR fell from 2.8% → 1.1% in 6 days. Audience burning out.",
        "Hasn't cost much yet — in 5 days it will burn with zero return.",
      ],
      action: "Prepare a Creative_031 variation today. Zero results interruption.",
    },
    {
      tab: "Write hooks",
      q: "Write 3 hooks from my best converting creatives",
      platform: "meta", account: "FitCore US",
      metric: "hook rate 38%",
      metricLabel: "your top creatives' pattern — basis for the hooks below",
      points: [
        "**\u201cYou've been training for 3 months and the scale hasn't moved — your ads already know why.\u201d**",
        "**\u201c3 of 4 transformations you've seen here cost under $18 CAC. Want to see the math?\u201d**",
        "**\u201cYour competitor is scaling the same angle as your best UGC — which you paused 9 days ago.\u201d**",
      ],
      action: "Pattern from your winners: specific pain with real data → no generic motivation.",
    },
  ],
};

function HeroDemo({ lang, onCTA }: { lang: Lang; onCTA: () => void }) {
  const scenes = SELLING_POINTS[lang];
  const [activeIdx, setActiveIdx] = React.useState(0);
  const scene = scenes[activeIdx];

  // Auto-rotate every 10s — pausa ao clicar manualmente
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActiveIdx(i => (i + 1) % scenes.length), 10000);
    return () => clearInterval(t);
  }, [scenes.length, paused]);

  const ctabtn = lang==='pt' ? 'Testar com minha conta' : lang==='es' ? 'Probar con mi cuenta' : 'Try with my account';
  const sampleLabel = lang==='pt' ? 'Conta de exemplo' : lang==='es' ? 'Cuenta de ejemplo' : 'Sample account';

  return (
    <div style={{ position:'relative', zIndex:1 }}>

      {/* Glow */}
      <div style={{ position:'absolute', bottom:-60, left:'5%', right:'5%', height:140, background:'radial-gradient(ellipse, rgba(14,165,233,0.18) 0%, transparent 70%)', pointerEvents:'none', filter:'blur(24px)', zIndex:0 }} />

      {/* Main card */}
      <div style={{
        position:'relative', zIndex:1, borderRadius:18, overflow:'hidden',
        background:'#080d1a',
        border:'1px solid rgba(255,255,255,0.09)',
        boxShadow:'0 0 0 1px rgba(14,165,233,0.07), 0 40px 100px rgba(0,0,0,0.7)',
      }}>

        {/* ── TOP BAR ── */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Left: AdBrief + account */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, overflow:'hidden', flexShrink:0, background:'#0a0c10' }}>
                <img src="/ab-avatar.png" alt="AdBrief" width={30} height={30} style={{ width:30, height:30, objectFit:'cover', display:'block' }} />
              </div>
            <div>
              <div style={{ fontFamily:F, fontSize:13, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.2 }}>AdBrief</div>
              <div style={{ fontFamily:F, fontSize: 12, color:'rgba(255,255,255,0.3)', marginTop:1 }}>{sampleLabel} · {scene.account}</div>
            </div>
          </div>
          {/* Right: live dot */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <MetaBadge />
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20, border:'1px solid rgba(34,197,94,0.25)', background:'rgba(34,197,94,0.06)' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px rgba(34,197,94,0.8)', animation:'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily:F, fontSize: 12, color:'#4ade80', letterSpacing:'0.06em', textTransform:'uppercase' as const, fontWeight:600 }}>live</span>
            </div>
          </div>
        </div>

        {/* ── SCENARIO TABS ── */}
        <div style={{ padding:'12px 20px', display:'flex', gap:6, overflowX:'auto' as const, borderBottom:'1px solid rgba(255,255,255,0.05)', flexWrap:'wrap' as const }}>
          {scenes.map((s, i) => {
            const isAct = i === activeIdx;
            return (
              <button key={i} onClick={() => { setActiveIdx(i); setPaused(true); }} style={{
                fontFamily:F, fontSize:12, fontWeight: isAct ? 700 : 500,
                padding:'8px 16px', borderRadius:8, cursor:'pointer',
                transition:'all 0.18s', whiteSpace:'nowrap' as const, flexShrink:0,
                background: isAct ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.04)',
                color: isAct ? '#38bdf8' : 'rgba(255,255,255,0.45)',
                border: isAct ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isAct ? '0 0 14px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
                letterSpacing:'-0.01em',
              }}
              onMouseEnter={e => { if(!isAct) { const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.07)'; el.style.color='rgba(255,255,255,0.75)'; el.style.borderColor='rgba(255,255,255,0.14)'; }}}
              onMouseLeave={e => { if(!isAct) { const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.04)'; el.style.color='rgba(255,255,255,0.45)'; el.style.borderColor='rgba(255,255,255,0.07)'; }}}>
                {s.tab}
              </button>
            );
          })}
        </div>

        {/* ── SCENARIO CONTENT ── */}
        <div key={activeIdx} style={{ padding:'20px 20px 16px', animation:'fadeSlide 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>

          {/* User question pill */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <div style={{ padding:'8px 14px', borderRadius:10, borderBottomRightRadius:3, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', maxWidth:'80%' }}>
              <p style={{ fontFamily:F, fontSize:12.5, color:'rgba(255,255,255,0.7)', lineHeight:1.4, margin:0, fontStyle:'italic' }}>{scene.q}</p>
            </div>
          </div>

          {/* AI response card — the hero */}
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div style={{ width:28, height:28, borderRadius:8, overflow:'hidden', flexShrink:0, marginTop:1, background:'#0a0c10' }}>
              <img src="/ab-avatar.png" alt="AdBrief" width={28} height={28} style={{ width:28, height:28, objectFit:'cover', display:'block' }} />
            </div>
            <div style={{ flex:1 }}>

              {/* Big result number — the first thing eyes go to */}
              <div style={{ marginBottom:12, padding:'12px 16px', borderRadius:12, background:'linear-gradient(135deg, rgba(14,165,233,0.10) 0%, rgba(14,165,233,0.04) 100%)', border:'1px solid rgba(14,165,233,0.2)' }}>
                <div style={{ fontFamily:F, fontSize:22, fontWeight:900, letterSpacing:'-0.04em', color:'#38bdf8', lineHeight:1 }}>{scene.metric}</div>
                <div style={{ fontFamily:F, fontSize: 12, color:'rgba(255,255,255,0.45)', marginTop:4, letterSpacing:'0.01em' }}>{scene.metricLabel}</div>
              </div>

              {/* Key points — hook tabs get numbered style, others get icon style */}
              <div style={{ display:'flex', flexDirection:'column' as const, gap:7 }}>
                {scene.points.map((pt, i) => {
                  const isHook = scene.tab.toLowerCase().includes('hook') || scene.tab.toLowerCase().includes('cria') || scene.tab.toLowerCase().includes('crea') || scene.tab.toLowerCase().includes('write');
                  if (isHook) {
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                        <div style={{ width:16, height:16, borderRadius:4, background:'rgba(14,165,233,0.12)', border:'1px solid rgba(14,165,233,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2, fontSize:8, fontWeight:700, color:'#38bdf8', fontFamily:F }}>
                          {i+1}
                        </div>
                        <p style={{ fontFamily:F, fontSize:12.5, color:'rgba(255,255,255,0.88)', lineHeight:1.55, margin:0, fontStyle:'italic' }} dangerouslySetInnerHTML={{ __html: pt.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700;font-style:normal">$1</strong>') }} />
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                      <div style={{ width:16, height:16, borderRadius:4, background: i===0 ? 'rgba(248,113,113,0.15)' : i===1 ? 'rgba(251,191,36,0.15)' : 'rgba(14,165,233,0.15)', border:`1px solid ${i===0 ? 'rgba(248,113,113,0.3)' : i===1 ? 'rgba(251,191,36,0.3)' : 'rgba(14,165,233,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2, fontSize:8 }}>
                        {i===0 ? '!' : i===1 ? '↓' : '→'}
                      </div>
                      <p style={{ fontFamily:F, fontSize:13, color:'rgba(255,255,255,0.82)', lineHeight:1.5, margin:0 }} dangerouslySetInnerHTML={{ __html: pt.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700">$1</strong>') }} />
                    </div>
                  );
                })}
              </div>

              {/* Action line */}
              <div style={{ marginTop:12, padding:'9px 13px', borderRadius:8, background:'rgba(14,165,233,0.08)', border:'1px solid rgba(14,165,233,0.18)', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:12, flexShrink:0 }}>⚡</span>
                <p style={{ fontFamily:F, fontSize:12.5, color:'#7dd3fc', fontWeight:600, lineHeight:1.4, margin:0 }}>{scene.action}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── PROGRESS + INPUT ── */}
        {/* Progress bar */}
        <div style={{ height:2, background:'rgba(255,255,255,0.04)' }}>
          <div key={`prog-${activeIdx}`} style={{ height:'100%', background:'linear-gradient(90deg,#0ea5e9,#38bdf8)', animation:'progressBar 10s linear forwards' }} />
        </div>

        {/* Input bar */}
        <div style={{ padding:'12px 16px 14px', background:'rgba(0,0,0,0.2)' }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'9px 12px 9px 16px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontFamily:F, fontSize:12, color:'rgba(255,255,255,0.22)', margin:0, flex:1, fontStyle:'italic' }}>
              {lang==='pt' ? 'Pergunte sobre sua conta...' : lang==='es' ? 'Pregunta sobre tu cuenta...' : 'Ask about your account...'}
            </p>
            <button onClick={onCTA} style={{
              fontFamily:F, fontSize:12, fontWeight:700, padding:'8px 16px', borderRadius:8,
              background:'linear-gradient(135deg,#0ea5e9,#0284c7)', color:'#fff',
              border:'none', cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0,
              boxShadow:'0 2px 14px rgba(14,165,233,0.4)', transition:'all 0.15s',
            }}
            onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-1px)'; el.style.boxShadow='0 4px 20px rgba(14,165,233,0.6)'; }}
            onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.transform='none'; el.style.boxShadow='0 2px 14px rgba(14,165,233,0.4)'; }}>
              {ctabtn} →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


// ─── Hero Left — Impactful, clean, cycling verb ──────────────────────────────
function HeroLeft({ lang, onCTA, ctaLoading }: { lang: Lang; onCTA: () => void; ctaLoading?: boolean }) {
  const t = T[lang];
  const verbs = lang === 'pt'
    ? ['analisa.', 'aprende.', 'avisa.', 'escala.']
    : lang === 'es'
    ? ['responde.', 'analiza.', 'aprende.', 'avisa.']
    : ['responds.', 'analyzes.', 'learns.', 'alerts.'];

  const [verbIdx, setVerbIdx] = React.useState(0);
  const [fade, setFade] = React.useState(true);

  React.useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVerbIdx(i => (i + 1) % verbs.length);
        setFade(true);
      }, 220);
    }, 2200);
    return () => clearInterval(t);
  }, [lang]);

  const line1 = lang === 'pt' ? 'Converse com' : lang === 'es' ? 'Habla con' : 'Talk to';
  const line2 = lang === 'pt' ? 'seus anúncios.' : lang === 'es' ? 'tus anuncios.' : 'your ads.';
  const line3prefix = lang === 'pt' ? 'A IA ' : lang === 'es' ? 'La IA ' : 'The AI ';
  const sub = lang === 'pt'
    ? 'Conecta em Meta Ads ou Google Ads. Lê seus dados reais. Responde como um analista que conhece cada campanha.'
    : lang === 'es'
    ? 'Conecta Meta Ads o Google Ads. Lee tus datos reales. Responde como un analista que conoce cada campaña.'
    : 'Connects to Meta Ads or Google Ads. Reads your real data. Responds like an analyst who knows every campaign.';
  const finePrint = lang === 'pt' ? '3 dias grátis · Sem cobrança até o 4º dia · Cancele quando quiser' : lang === 'es' ? '3 días gratis · Sin cargo hasta el 4º día · Cancela cuando quieras' : '3 days free · No charge until day 4 · Cancel anytime';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, justifyContent: 'center' }}>
      {/* Eyebrow */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 28, width: 'fit-content' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', boxShadow: '0 0 10px #0ea5e9' }} />
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#0ea5e9' }}>
          {lang === 'pt' ? 'IA conectada na sua conta' : lang === 'es' ? 'IA conectada en tu cuenta' : 'AI connected to your account'}
        </span>
      </div>

      {/* Headline — massive, bold */}
      <h1 style={{
        fontFamily: F, fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1.0,
        margin: '0 0 28px', color: '#fff',
        fontSize: 'clamp(42px, 4.8vw, 68px)',
      }}>
        {line1}<br />
        {line2}<br />
        <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>{line3prefix}</span>
        <span style={{
          background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #7dd3fc 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          display: 'inline-block',
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}>
          {verbs[verbIdx]}
        </span>
      </h1>

      {/* Subline — single sentence, max impact */}
      <p style={{
        fontFamily: F, fontSize: 'clamp(15px,1.1vw,17px)',
        color: 'rgba(255,255,255,0.48)', lineHeight: 1.6,
        margin: '0 0 36px', maxWidth: 430,
      }}>
        {sub}
      </p>

      {/* CTA row */}
      <div className="hero-cta-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' as const }}>
        <CTAButton
          onClick={onCTA}
          loading={ctaLoading}
          label={lang === 'pt' ? 'Começar grátis' : lang === 'es' ? 'Comenzar gratis' : 'Start for free'}
          size="md"
          variant="primary"
        />
        <button
          onClick={() => document.querySelector('#how')?.scrollIntoView({ behavior: 'smooth' })}
          style={{ fontFamily: F, fontSize: 13, fontWeight: 500, padding: '14px 20px', borderRadius: 12, background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.75)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.1)'; }}>
          {lang === 'pt' ? 'Ver como funciona' : lang === 'es' ? 'Ver cómo funciona' : 'See how it works'}
        </button>
      </div>

      {/* Fine print */}
      <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.22)', margin: '0 0 28px' }}>{finePrint}</p>

      {/* Platform badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          {lang === 'pt' ? 'Conecta com' : lang === 'es' ? 'Conecta con' : 'Connects with'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <svg width="11" height="6" viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metaOff11" x1="0" y1="14" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0082FB"/>
          <stop offset="1" stopColor="#0064E0"/>
        </linearGradient>
      </defs>
      <path d="M13.5 0C8.5 0 4.7 2.6 2.2 6.3 0.8 8.4 0 10.9 0 13.7 0 18.5 2.3 22.1 5.9 23.9c1.6 0.8 3.3 1.1 5 1.1 3.2 0 6.1-1.2 8.7-3.8L28 13.7l8.4 7.5c2.6 2.6 5.5 3.8 8.7 3.8 1.7 0 3.4-0.3 5-1.1 3.6-1.8 5.9-5.4 5.9-10.2 0-2.8-0.8-5.3-2.2-7.4C51.3 2.6 47.5 0 42.5 0c-3.8 0-7.2 1.7-10.3 5.1L28 9.8 23.8 5.1C20.7 1.7 17.3 0 13.5 0zm0 5c2.6 0 5 1.3 7.5 4.1l3.3 3.7-3.3 3.7c-2.5 2.8-4.9 4.1-7.5 4.1-1.9 0-3.7-0.6-5.1-1.8C6.6 17.4 5.5 15.7 5.5 13.5c0-2.2 1.1-3.9 2.9-5.3C9.8 7.4 11.6 5 13.5 5zm29 0c1.9 0 3.7 0.6 5.1 1.8 1.8 1.4 2.9 3.1 2.9 5.3 0 2.2-1.1 3.9-2.9 5.3C45.7 18.6 43.9 19 42 19c-2.6 0-5-1.3-7.5-4.1L31.2 11.2 34.5 7.5C37 4.7 39.4 5 42.5 5z" fill="url(#metaOff11)"/>
    </svg>
          <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Meta Ads</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Google Ads</span>
        </div>
        <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          TikTok <span style={{ fontSize: 8.5, letterSpacing: '0.05em' }}>{t.tiktok_soon}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Immersive Hero ──────────────────────────────────────────────────────────
function playTick(freq = 880, vol = 0.06, dur = 0.04) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}
function playPop(vol = 0.05) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, 512, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < 512; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/512, 3);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf; src.connect(gain); gain.connect(ctx.destination);
    gain.gain.value = vol;
    src.start();
    setTimeout(() => ctx.close(), 200);
  } catch {}
}


function ImmersiveHero({ onCTA, t, lang, ctaLoading }: { onCTA: () => void; t: Record<string, string>; lang: Lang; ctaLoading?: boolean }) {
  const [activeIndustry, setActiveIndustry] = React.useState('fitness');
  const industry = INDUSTRIES_DEMO.find(i => i.id === activeIndustry) || INDUSTRIES_DEMO[2];
  const account = INDUSTRY_ACCOUNTS[activeIndustry]?.[lang] || INDUSTRY_ACCOUNTS.fitness[lang];
  const qa = DEMO_QA_BY_INDUSTRY[activeIndustry]?.[lang] || DEMO_QA_BY_INDUSTRY.fitness[lang];
  const { qi, phase, typedQ, lines, activeLine, jump } = useStreaming(lang, qa);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [lines, activeLine, phase]);

  const ctabtn = lang === 'pt' ? 'Testar com minha conta' : lang === 'es' ? 'Probar con mi cuenta' : 'Try with my account';
  const note = lang === 'pt' ? 'Pergunte qualquer coisa...' : lang === 'es' ? 'Pregunta lo que quieras...' : 'Ask anything...';

  const quickActions = lang === 'pt'
    ? ['Qual meu melhor criativo?', 'O que posso escalar?', 'O que pausar?']
    : lang === 'es'
    ? ['¿Cuál es mi mejor creativo?', '¿Qué puedo escalar?', '¿Qué pausar?']
    : ['What\'s my best creative?', 'What can I scale?', 'What to pause?'];

  const bullets = lang === 'pt' ? [
    { bold: 'Respostas em segundos', rest: ' sobre CTR, ROAS e gasto' },
    { bold: 'Sabe o que pausar', rest: ' e o que escalar agora' },
    { bold: 'Gera hooks e roteiros', rest: ' dos seus anúncios winners' },
    { bold: 'Alerta proativo', rest: ' quando algo crítico acontece' },
  ] : lang === 'es' ? [
    { bold: 'Respuestas en segundos', rest: ' sobre CTR, ROAS y gasto' },
    { bold: 'Sabe qué pausar', rest: ' y qué escalar ahora' },
    { bold: 'Genera hooks y guiones', rest: ' de tus ads ganadores' },
    { bold: 'Alerta proactiva', rest: ' cuando algo crítico ocurre' },
  ] : [
    { bold: 'Instant answers', rest: ' on CTR, ROAS and spend' },
    { bold: 'Knows what to pause', rest: ' and what to scale now' },
    { bold: 'Generates hooks and scripts', rest: ' from your winning ads' },
    { bold: 'Proactive alerts', rest: ' when something critical happens' },
  ];

  // Color palette — modern, no green/teal
  // accent: indigo/violet for AI, amber for wins, slate for neutral
  const WIN_COLOR = '#38bdf8';    // violet-300 — AI wins
  const ACT_COLOR = '#0ea5e9';    // violet-400 — actions
  const CARD_WIN = 'rgba(14,165,233,0.12)';
  const CARD_WIN_B = 'rgba(14,165,233,0.28)';
  const CARD_INS = 'rgba(255,255,255,0.07)';
  const CARD_INS_B = 'rgba(255,255,255,0.14)';

  const renderAI = () => {
    if (phase === 'thinking') return <Dots />;
    if (phase !== 'streaming' && phase !== 'done') return null;
    const allLines = activeLine ? [...lines, activeLine] : lines;
    if (!allLines.length) return null;
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <img src="/ab-avatar.png" alt="AB" width={24} height={24}
          style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
          {allLines.map((line, i) => {
            const isAction = /^(Fix:|Ação:|Action:|Acción:|→)/i.test(line.replace(/\*\*/g, ''));
            const isLast = i === allLines.length - 1 && phase === 'streaming';
            const isWin = /\+|↑|2\.4x|3\.8x|3\.2x|winner|melhor|dominando|escalando/i.test(line);
            return (
              <MdLine key={i} text={line} style={{
                fontFamily: F, fontSize: 13, lineHeight: 1.6, margin: 0,
                color: isAction ? ACT_COLOR : isWin ? WIN_COLOR : i === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.82)',
                fontWeight: isAction ? 600 : 400, opacity: isLast ? 0.6 : 1,
                animation: `lineEnter 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both`,
              }} />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="hero-main-section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: 'clamp(80px,8vw,100px) clamp(24px,5vw,80px) clamp(40px,4vw,60px)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(14,165,233,0.07) 0%, transparent 65%), #06080e' }}>

      {/* Subtle radial glow — violet, not green */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 70% at 72% 48%, rgba(14,165,233,0.14) 0%, rgba(6,182,212,0.06) 45%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Grid */}
      <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 'clamp(40px,5vw,80px)', alignItems: 'center', position: 'relative', zIndex: 1 }} className="hero-grid">

        {/* ── LEFT ── */}
        <HeroLeft lang={lang} onCTA={onCTA} ctaLoading={ctaLoading} />

        {/* ── RIGHT — demo ── */}
        {/* ── RIGHT — Demo redesign ── */}
        <div className="hero-demo-col" style={{ position: 'relative' }}>
          <HeroDemo lang={lang} onCTA={onCTA} />
        </div>

      </div>
    </section>
  );
}

// ─── Tools ─────────────────────────────────────────────────────────────────────
function Tools({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const [active, setActive] = useState("hooks");
  const tool = TOOLS_DATA.find(d => d.id === active)!;

  const inputLabel: Record<Lang, string> = { pt: "Input", es: "Input", en: "Input" };
  const outputLabel: Record<Lang, string> = { pt: "Output gerado", es: "Output generado", en: "Generated output" };

  return (
    <Section id="tools" bg="subtle">
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, color: "rgba(14,165,233,0.7)", textTransform: "uppercase" as const }}>{t.tools_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "12px 0 10px", color: "#fff" }}>{t.tools_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>{t.tools_sub}</p>
        </div>

        {/* Bento layout: pill nav left + preview right */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, alignItems: "start" }} className="tools-bento">

          {/* Left — pill nav list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TOOLS_DATA.map(d => {
              const isAct = d.id === active;
              return (
                <button key={d.id} onClick={() => setActive(d.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    borderRadius: 14, border: `1px solid ${isAct ? d.color + "40" : "rgba(255,255,255,0.07)"}`,
                    background: isAct ? d.accent : "rgba(255,255,255,0.03)",
                    cursor: "pointer", textAlign: "left" as const, transition: "all 0.18s", width: "100%",
                  }}
                  onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: isAct ? d.color + "20" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: isAct ? d.color : "rgba(255,255,255,0.4)", flexShrink: 0, transition: "all 0.18s" }}>
                    {d.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: isAct ? "#fff" : "rgba(255,255,255,0.55)", margin: 0, transition: "color 0.18s" }}>{d.name[lang]}</p>
                    <p style={{ fontFamily: F, fontSize: 12, color: isAct ? d.color : "rgba(255,255,255,0.25)", margin: "2px 0 0", lineHeight: 1.3, transition: "color 0.18s", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{d.tagline[lang]}</p>
                  </div>
                  {isAct && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: tool.color, flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right — tool detail card */}
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ borderRadius: 20, border: `1px solid ${tool.color}30`, background: `linear-gradient(135deg, ${tool.color}10 0%, rgba(255,255,255,0.04) 100%)`, overflow: "hidden" }}
            >
              {/* Card header */}
              <div style={{ padding: "28px 28px 20px", borderBottom: `1px solid ${tool.color}15` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: tool.color + "18", border: `1px solid ${tool.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: tool.color, flexShrink: 0 }}>
                    {tool.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" as const }}>
                      <h3 style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.03em" }}>{tool.name[lang]}</h3>
                      <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: tool.color + "18", color: tool.color, border: `1px solid ${tool.color}30`, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{tool.badge[lang]}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: 13.5, color: "rgba(255,255,255,0.62)", lineHeight: 1.65, margin: 0 }}>{tool.desc[lang]}</p>
                  </div>
                </div>
              </div>

              {/* IO preview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 220 }} className="tools-io-grid">

                {/* Input */}
                <div style={{ padding: "20px 24px", borderRight: `1px solid ${tool.color}12` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{inputLabel[lang]}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: tool.color, flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ fontFamily: F, fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{tool.input[lang]}</span>
                  </div>
                </div>

                {/* Output */}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: tool.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke={tool.color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: tool.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, opacity: 0.8 }}>{outputLabel[lang]}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {tool.output[lang].map((line, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, background: i === 0 ? tool.color + "0d" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? tool.color + "22" : "rgba(255,255,255,0.06)"}` }}>
                        <span style={{ fontFamily: F, fontSize: 12, color: i === 0 ? tool.color : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{i + 1}</span>
                        <span style={{ fontFamily: F, fontSize: 12, color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </Section>
  );
}


// ─── How It Works ─────────────────────────────────────────────────────────────
// ─── Pain → Solution section ──────────────────────────────────────────────────
function SocialProofStrip({ lang }: { lang: Lang }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const stats = lang === "pt"
    ? [
        { n: "30s", label: "Para conectar sua conta" },
        { n: "90 dias", label: "De dados reais analisados" },
        { n: "7", label: "Ferramentas de IA integradas" },
        { n: "24h", label: "Monitoramento via Telegram" },
      ]
    : lang === "es"
    ? [
        { n: "30s", label: "Para conectar tu cuenta" },
        { n: "90 días", label: "De datos reales analizados" },
        { n: "7", label: "Herramientas integradas" },
        { n: "24h", label: "Monitoreo vía Telegram" },
      ]
    : [
        { n: "30s", label: "To connect your account" },
        { n: "90 days", label: "Of real data analyzed" },
        { n: "7", label: "Integrated AI tools" },
        { n: "24h", label: "Telegram monitoring" },
      ];

  return (
    <div style={{
      background: "rgba(14,165,233,0.06)",
      borderTop: "1px solid rgba(14,165,233,0.18)",
      borderBottom: "1px solid rgba(14,165,233,0.18)",
      padding: "28px clamp(20px,5vw,80px)",
    }}>
      <div style={{
        maxWidth: 960, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap" as const, gap: 24,
      }}>
        {stats.map(({ n, label }, i) => (
          <div key={i} style={{ textAlign: "center", flex: "1 1 140px", padding: "0 8px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
            <div style={{ fontFamily: F, fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, color: "#38bdf8", letterSpacing: "-0.04em", lineHeight: 1 }}>{n}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainSection({ onCTA, lang, ctaLoading }: { onCTA: () => void; lang: "pt" | "es" | "en"; ctaLoading?: boolean }) {
  const copy = {
    pt: {
      label: "O PROBLEMA",
      title: "Gestores de tráfego\nperdendo horas todo dia.",
      pains: [
        { icon: "⏳", text: "Você monta relatórios manualmente toda semana" },
        { icon: "📊", text: "Dados em 5 ferramentas diferentes que não se conversam" },
        { icon: "❓", text: "Você não sabe exatamente o que pausar e escalar agora" },
        { icon: "🔥", text: "Descobre fadiga criativa tarde demais — depois de queimar verba" },
      ],
      divider: "AdBrief resolve isso.",
      solutions: [
        { icon: "⚡", text: "Responde qualquer pergunta sobre sua conta em segundos" },
        { icon: "🎯", text: "Diz exatamente o que pausar e o que escalar agora" },
        { icon: "✍️", text: "Gera hooks e roteiros dos seus anúncios vencedores" },
        { icon: "🔔", text: "Alertas proativos no Telegram antes de queimar verba" },
      ],
      cta: "Começar grátis",
    },
    es: {
      label: "EL PROBLEMA",
      title: "Los gestores pierden horas\nanalizando datos.",
      pains: [
        { icon: "⏳", text: "Construyes reportes manualmente cada semana" },
        { icon: "📊", text: "Datos en 5 herramientas distintas que no se comunican" },
        { icon: "❓", text: "No sabes exactamente qué pausar y qué escalar ahora" },
        { icon: "🔥", text: "Descubres la fatiga creativa tarde — después de quemar presupuesto" },
      ],
      divider: "AdBrief lo resuelve.",
      solutions: [
        { icon: "⚡", text: "Responde cualquier pregunta sobre tu cuenta en segundos" },
        { icon: "🎯", text: "Te dice exactamente qué pausar y qué escalar ahora" },
        { icon: "✍️", text: "Genera hooks y guiones de tus anuncios ganadores" },
        { icon: "🔔", text: "Alertas proactivas en Telegram antes de quemar presupuesto" },
      ],
      cta: "Comenzar gratis",
    },
    en: {
      label: "THE PROBLEM",
      title: "Media buyers waste hours\nanalyzing data.",
      pains: [
        { icon: "⏳", text: "You build reports manually every single week" },
        { icon: "📊", text: "Data across 5 different tools, none of them talk to each other" },
        { icon: "❓", text: "You don't know exactly what to pause and what to scale right now" },
        { icon: "🔥", text: "You discover creative fatigue too late — after burning budget" },
      ],
      divider: "AdBrief fixes that.",
      solutions: [
        { icon: "⚡", text: "Answers any question about your account in seconds" },
        { icon: "🎯", text: "Tells you exactly what to pause and what to scale now" },
        { icon: "✍️", text: "Generates hooks and scripts from your winning ads" },
        { icon: "🔔", text: "Proactive Telegram alerts before you burn budget" },
      ],
      cta: "Start for free",
    },
  };

  const c = copy[lang];

  return (
    <section style={{
      position: "relative",
      padding: "96px 24px",
      overflow: "hidden",
      background: "linear-gradient(180deg, #080c14 0%, #0b1120 40%, #080c14 100%)",
    }}>
      {/* Background radial glows */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: "10%", right: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 2, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.10), transparent)" }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>

        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, margin: 0 }}>
            {c.label}
          </p>
          <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(24px,3.5vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, textAlign: "center", color: "#fff", whiteSpace: "pre-line" as const, marginBottom: 48 }}>
          {c.title}
        </h2>

        {/* 2-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "clamp(16px,2.5vw,40px)", alignItems: "center" }} className="pain-grid">

          {/* PAINS column */}
          <div className="pain-col-left" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, width: "fit-content" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(239,68,68,0.8)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                {lang === "pt" ? "Sem AdBrief" : lang === "es" ? "Sin AdBrief" : "Without AdBrief"}
              </span>
            </div>
            {c.pains.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)",
                border: "1px solid rgba(239,68,68,0.18)",
                backdropFilter: "blur(8px)",
                transition: "border-color 0.2s",
              }}>
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2, opacity: 0.7 }}>{p.icon}</span>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.55 }}>{p.text}</p>
              </div>
            ))}
          </div>

          {/* CENTER DIVIDER */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08))", minHeight: 60 }} />
            <div style={{
              padding: "8px 16px", borderRadius: 24,
              background: "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(99,102,241,0.2))",
              border: "1px solid rgba(14,165,233,0.45)",
              boxShadow: "0 0 20px rgba(14,165,233,0.15)",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap" as const,
            }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.04em" }}>{c.divider}</span>
            </div>
            <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)", minHeight: 60 }} />
          </div>

          {/* SOLUTIONS column */}
          <div className="pain-col-right" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, width: "fit-content" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", display: "inline-block", boxShadow: "0 0 6px #0ea5e9" }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(14,165,233,0.8)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                {lang === "pt" ? "Com AdBrief" : lang === "es" ? "Con AdBrief" : "With AdBrief"}
              </span>
            </div>
            {c.solutions.map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.05) 100%)",
                border: "1px solid rgba(14,165,233,0.22)",
                backdropFilter: "blur(8px)",
              }}>
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{s.icon}</span>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.55 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <CTAButton onClick={onCTA} loading={ctaLoading} label={c.cta} size="md" variant="primary" icon={<ArrowRight size={15} />} />
        </div>
      </div>
    </section>
  );
}


function HowItWorks({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const results: Record<Lang, string[]> = {
    pt: ["Conta criada em menos de 1 minuto", "Meta ou Google Ads conectados via OAuth", "Respostas com dados reais da sua conta"],
    es: ["Cuenta creada en menos de 1 minuto", "Meta o Google Ads conectados vía OAuth", "Respuestas con datos reales de tu cuenta"],
    en: ["Account created in under 1 minute", "Meta or Google Ads connected via OAuth", "Answers using real data from your account"],
  };
  const steps = [
    { n: "01", icon: <Plug size={22} />, color: "#0ea5e9", title: t.how_s1_title, desc: t.how_s1_desc, result: results[lang][0] },
    { n: "02", icon: <Users size={22} />, color: "#06b6d4", title: t.how_s2_title, desc: t.how_s2_desc, result: results[lang][1] },
    { n: "03", icon: <MessageSquare size={22} />, color: "#34d399", title: t.how_s3_title, desc: t.how_s3_desc, result: results[lang][2] },
  ];
  return (
    <Section id="how" bg="dark">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, color: "rgba(14,165,233,0.7)", textTransform: "uppercase" as const }}>{t.how_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.how_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 400, margin: "0 auto" }}>{t.how_sub}</p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ padding: "32px 28px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `1px solid ${step.color}22`, position: "relative", overflow: "hidden", transition: "border-color 0.2s, background 0.2s, transform 0.2s", display: "flex", flexDirection: "column", boxShadow: `0 0 40px ${step.color}08` }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${step.color}30`; el.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.background = 'rgba(255,255,255,0.04)'; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: "rgba(255,255,255,0.55)" }}>{step.icon}</div>
              <h3 style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3, letterSpacing: "-0.02em" }}>{step.title}</h3>
              <p style={{ fontFamily: F, fontSize: 13.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, flex: 1, marginBottom: 20 }}>{step.desc}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, background: `${step.color}08`, border: `1px solid ${step.color}18` }}>
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke={step.color} strokeOpacity="0.4" strokeWidth="1"/><path d="M4 6.5l1.8 1.8L9 4.5" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontFamily: F, fontSize: 13, color: step.color, fontWeight: 500, opacity: 0.85 }}>{step.result}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── For Who ──────────────────────────────────────────────────────────────────
function ForWho({ onCTA, t, ctaLoading }: { onCTA: () => void; t: Record<string, string>; ctaLoading?: boolean }) {
  const [active, setActive] = useState(0);
  const profiles = [
    { emoji: "🏢", label: t.for_tab0, color: "#0ea5e9", headline: t.for_h0, desc: t.for_d0, points: [t.for_p0_0, t.for_p0_1, t.for_p0_2, t.for_p0_3] },
    { emoji: "📈", label: t.for_tab1, color: "#34d399", headline: t.for_h1, desc: t.for_d1, points: [t.for_p1_0, t.for_p1_1, t.for_p1_2, t.for_p1_3] },
    { emoji: "⚡", label: t.for_tab2, color: "#a78bfa", headline: t.for_h2b, desc: t.for_d2, points: [t.for_p2_0, t.for_p2_1, t.for_p2_2, t.for_p2_3] },
  ];
  const p = profiles[active];
  return (
    <Section id="for" bg="default">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, color: "rgba(14,165,233,0.7)", textTransform: "uppercase" as const }}>{t.for_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 0", color: "#fff" }}>{t.for_h2}</h2>
        </div>
        <div className="for-who-tabs" style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 40, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "4px", width: "fit-content", margin: "0 auto 40px" }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              fontFamily: F, fontSize: 13, fontWeight: active === i ? 600 : 400,
              padding: "8px 16px", borderRadius: 9, cursor: "pointer", transition: "all 0.18s",
              background: active === i ? "rgba(255,255,255,0.10)" : "transparent",
              color: active === i ? "#fff" : "rgba(255,255,255,0.45)",
              border: "none", whiteSpace: "nowrap" as const,
            }}>
              {pr.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            className="for-who-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div className="for-who-card" style={{ padding: "32px 28px", borderRadius: 20, background: `linear-gradient(135deg, ${p.color}10 0%, rgba(255,255,255,0.03) 100%)`, border: `1px solid ${p.color}25` }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color}18`, border: `1px solid ${p.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 20 }}>{p.emoji}</div>
              <h3 style={{ fontFamily: F, fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 10, color: "#fff" }}>{p.headline}</h3>
              <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 24 }}>{p.desc}</p>
              <CTAButton onClick={onCTA} loading={ctaLoading} label={t.for_cta} size="sm" variant="white" icon={<ArrowRight size={14} />} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {p.points.map((point) => (
                <div key={point} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", borderRadius: 12, background: `${p.color}08`, border: `1px solid ${p.color}18` }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${p.color}20`, border: `1px solid ${p.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Check size={10} color={p.color} />
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: 0 }}>{point}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Section>
  );
}

// ─── Before/After ─────────────────────────────────────────────────────────────

// ─── Telegram Differentiator ──────────────────────────────────────────────────
function TelegramSection({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const items = lang === "pt" ? [
    { icon: "⚠️", title: "Alertas críticos automáticos", desc: "CTR caiu? CPM explodiu? Você recebe no Telegram antes de perder mais." },
    { icon: "⏸️", title: "Pause anúncios pelo bot", desc: "/pausar [nome] — pede confirmação e executa via Meta API. Registrado no AdBrief." },
    { icon: "📊", title: "Resumo diário", desc: "/status — spend, CTR, winners e losers. Tudo em uma mensagem." },
    { icon: "🧠", title: "A IA aprende com cada ação", desc: "Criativos pausados, alertas dispensados — tudo vira contexto para as próximas respostas." },
  ] : lang === "es" ? [
    { icon: "⚠️", title: "Alertas críticos automáticos", desc: "¿CTR cayó? ¿CPM explotó? Lo recibes en Telegram antes de perder más." },
    { icon: "⏸️", title: "Pausa anuncios desde el bot", desc: "/pausar [nombre] — pide confirmación y ejecuta vía Meta API. Registrado en AdBrief." },
    { icon: "📊", title: "Resumen diario", desc: "/status — spend, CTR, ganadores y perdedores. Todo en un mensaje." },
    { icon: "🧠", title: "La IA aprende con cada acción", desc: "Creativos pausados, alertas ignorados — todo se convierte en contexto para las próximas respuestas." },
  ] : [
    { icon: "⚠️", title: "Automatic critical alerts", desc: "CTR dropped? CPM spiked? You get it on Telegram before losing more." },
    { icon: "⏸️", title: "Pause ads from the bot", desc: "/pause [name] — asks confirmation, executes via Meta API. Logged in AdBrief." },
    { icon: "📊", title: "Daily summary", desc: "/status — spend, CTR, winners and losers. Everything in one message." },
    { icon: "🧠", title: "AI learns from every action", desc: "Paused creatives, dismissed alerts — all becomes context for the next response." },
  ];

  return (
    <Section bg="dark">
      <div style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: 52, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(39,175,225,0.15)", border: "1px solid rgba(39,175,225,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/>
                <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.14em", fontWeight: 700, color: "rgba(14,165,233,0.7)", textTransform: "uppercase" as const }}>
              TELEGRAM ALERTS
            </span>
          </div>
          <h2 style={{ fontFamily: F, fontSize: "clamp(26px,3.8vw,44px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "0 0 14px", color: "#fff", lineHeight: 1.15 }}>
            {lang === "pt" ? "O AdBrief chega no seu celular." : lang === "es" ? "AdBrief llega a tu celular." : "AdBrief comes to your phone."}
          </h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 480, lineHeight: 1.65 }}>
            {lang === "pt" ? "Sem app extra. Sem notificação perdida. O bot do AdBrief no Telegram monitora sua conta 24h e age quando você manda." : lang === "es" ? "Sin app extra. Sin notificación perdida. El bot de AdBrief en Telegram monitorea tu cuenta 24h y actúa cuando lo indicas." : "No extra app. No missed notification. The AdBrief Telegram bot monitors your account 24/7 and acts on your command."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="telegram-grid">
          {items.map((item, i) => (
            <div key={i} style={{ padding: "22px 24px", borderRadius: 16, background: "rgba(39,175,225,0.07)", border: "1px solid rgba(39,175,225,0.18)", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(39,175,225,0.15)", border: "1px solid rgba(39,175,225,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#e2f4ff", margin: "0 0 5px", letterSpacing: "-0.01em" }}>{item.title}</p>
                <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, maxWidth: 480, margin: "48px auto 0" }}>
          {/* Telegram mock conversation */}
          <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)", background: "#17212b" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "#232e3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(39,175,225,0.2)", border: "1px solid rgba(39,175,225,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/><path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>AdBrief Alerts</p>
                <p style={{ fontFamily: F, fontSize: 12, color: "#27AEE1", margin: 0 }}>bot</p>
              </div>
            </div>
            {/* Messages */}
            <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Bot alert */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(39,175,225,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/><path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/></svg>
                </div>
                <div style={{ maxWidth: "78%", padding: "10px 13px", borderRadius: "14px 14px 14px 2px", background: "#232e3c" }}>
                  <p style={{ fontFamily: F, fontSize: 12, color: "#27AEE1", fontWeight: 700, margin: "0 0 4px" }}>⚠️ Alerta AdBrief</p>
                  <p style={{ fontFamily: F, fontSize: 12.5, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.55 }}>
                    <strong style={{ color: "#fff" }}>Creative_042</strong> com frequência 4.8x. CTR caiu de 2.1% → 0.4% nas últimas 6h.<br/>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>FitCore Brasil · agora</span>
                  </p>
                </div>
              </div>
              {/* User message */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "68%", padding: "9px 13px", borderRadius: "14px 14px 2px 14px", background: "#2b5278" }}>
                  <p style={{ fontFamily: F, fontSize: 12.5, color: "#fff", margin: 0 }}>/pausar Creative_042</p>
                </div>
              </div>
              {/* Bot confirmation */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(39,175,225,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/><path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/></svg>
                </div>
                <div style={{ maxWidth: "78%", padding: "10px 13px", borderRadius: "14px 14px 14px 2px", background: "#232e3c" }}>
                  <p style={{ fontFamily: F, fontSize: 12.5, color: "rgba(255,255,255,0.9)", margin: 0, lineHeight: 1.55 }}>
                    ✅ <strong style={{ color: "#fff" }}>Creative_042 pausado</strong> via Meta API.<br/>
                    Registrado no AdBrief às 14:32.<br/>
                    <span style={{ color: "#34d399", fontSize: 13 }}>Economia estimada: R$180/dia</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>
            {lang === "pt" ? "Conecta em 30 segundos. Disponível em todos os planos." : lang === "es" ? "Conecta en 30 segundos. Disponible en todos los planes." : "Connects in 30 seconds. Available on all plans."}
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing({ onCTA, t, lang }: { onCTA: () => void; t: Record<string, string>; lang: Lang }) {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const plans = [
    {
      name: "Maker", price: annual ? "$15" : "$19", desc: annual ? "/mo billed annually" : "/mo",
      features: [t.plan_maker_f0, t.plan_maker_f1, t.plan_maker_f2, t.plan_maker_f3],
      highlight: false, badge: null,
      action: () => navigate(`/signup?plan=maker${annual ? "&billing=annual" : ""}`),
    },
    {
      name: "Pro", price: annual ? "$39" : "$49", desc: annual ? "/mo billed annually" : "/mo",
      features: [t.plan_pro_f0, t.plan_pro_f1, t.plan_pro_f2, t.plan_pro_f3, t.plan_pro_f4],
      highlight: true, badge: t.plan_badge_pro,
      action: () => navigate(`/signup?plan=pro${annual ? "&billing=annual" : ""}`),
    },
    {
      name: "Studio", price: annual ? "$119" : "$149", desc: annual ? "/mo billed annually" : "/mo",
      features: [t.plan_studio_f0, t.plan_studio_f1, t.plan_studio_f2, t.plan_studio_f3, t.plan_studio_f4,
        lang === "pt" ? "Suporte prioritário via WhatsApp" : lang === "es" ? "Soporte prioritario por WhatsApp" : "Priority WhatsApp support"
      ],
      highlight: false, badge: null,
      action: () => navigate(`/signup?plan=studio${annual ? "&billing=annual" : ""}`),
    },
  ];

  return (
    <Section id="pricing" bg="accent">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.pricing_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,2.8vw,38px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "10px 0 10px", color: "#fff" }}>{t.pricing_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 420, margin: "0 auto 24px" }}>{t.pricing_sub}</p>
          {/* Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 500, transition: "color 0.2s" }}>
              {lang === 'pt' ? 'Mensal' : lang === 'es' ? 'Mensual' : 'Monthly'}
            </span>
            <button onClick={() => setAnnual(v => !v)}
              style={{ width: 46, height: 24, borderRadius: 12, background: annual ? "#fff" : "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 3, left: annual ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: annual ? "#000" : "#fff", transition: "left 0.2s", display: "block" }} />
            </button>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: 500, transition: "color 0.2s" }}>
              {lang === 'pt' ? 'Anual' : lang === 'es' ? 'Anual' : 'Annual'}
            </span>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: annual ? "rgba(52,211,153,0.15)" : "rgba(52,211,153,0.06)", color: annual ? "#34d399" : "rgba(52,211,153,0.5)", border: "1px solid rgba(52,211,153,0.2)", transition: "all 0.2s" }}>{lang === "pt" ? "Economize 20%" : lang === "es" ? "Ahorra 20%" : "Save 20%"}</span>
          </div>
        </div>
        <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              padding: "28px 24px", borderRadius: 18,
              background: plan.highlight
                ? "linear-gradient(135deg, rgba(14,165,233,0.10) 0%, rgba(99,102,241,0.08) 100%)"
                : "rgba(255,255,255,0.02)",
              border: plan.highlight
                ? "1px solid rgba(14,165,233,0.30)"
                : "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column", gap: 20, position: "relative",
              transform: plan.highlight ? "scale(1.03)" : "scale(1)",
              zIndex: plan.highlight ? 2 : 1,
              boxShadow: plan.highlight ? "0 0 40px rgba(14,165,233,0.12), 0 24px 48px rgba(0,0,0,0.3)" : "none",
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #0ea5e9, #6366f1)", borderRadius: 6, padding: "4px 14px", whiteSpace: "nowrap" as const, boxShadow: "0 0 16px rgba(14,165,233,0.4)" }}>
                  <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#fff", fontWeight: 800 }}>{plan.badge}</span>
                </div>
              )}
              <div>
                <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{plan.name}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="7" cy="7" r="6.5" stroke="rgba(255,255,255,0.12)"/>
                      <path d="M4.5 7l1.8 1.8L9.5 5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{
                fontFamily: F, width: "100%", padding: "13px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: plan.highlight
                  ? "linear-gradient(135deg, #0ea5e9, #6366f1)"
                  : "rgba(255,255,255,0.06)",
                color: plan.highlight ? "#fff" : "rgba(255,255,255,0.5)",
                border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: plan.highlight ? "0 0 20px rgba(14,165,233,0.25)" : "none",
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if(el.style.background.includes('gradient')){el.style.transform='translateY(-1px)';el.style.boxShadow='0 0 32px rgba(14,165,233,0.4)';}else{el.style.opacity='0.8';} }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform='translateY(0)'; el.style.opacity='1'; el.style.boxShadow=el.style.background.includes('gradient')?'0 0 20px rgba(14,165,233,0.25)':'none'; }}
              >{t.pricing_cta}</button>
              <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" as const }}>{t.pricing_note}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ({ t }: { t: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = [0,1,2,3,4,5,6,7].map(i => ({ q: t[`faq_q${i}`], a: t[`faq_a${i}`] })).filter(item => item.q);
  return (
    <Section bg="dark">
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontFamily: F, fontSize: 12, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.faq_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "14px 0 0", color: "#fff" }}>{t.faq_h2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderRadius: 14, background: open === i ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${open === i ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.08)"}`, overflow: "hidden", transition: "all 0.2s" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 14, textAlign: "left" }}>
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>{item.q}</span>
                <ChevronDown size={14} color={open === i ? "#fff" : "rgba(255,255,255,0.2)"} style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div style={{ padding: "0 22px 18px" }}>
                      <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.75 }}>{item.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
// ── SFX helpers ───────────────────────────────────────────────────────────────

// ── MobileDemoSection — chat simulation, only shown on mobile ────────────────
function MobileDemoSection({ lang }: { lang: "pt" | "es" | "en" }) {
  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";

  const messages = {
    pt: [
      { role: "user", text: "qual meu melhor criativo agora?" },
      { role: "ai", lines: [
        "Creative_019 está dominando: CTR 3.8%, ROAS 3.2x.",
        "Escale de R$120 → R$400/dia. Frequência 1.3x — tem espaço.",
      ]},
      { role: "user", text: "o que eu pausaria hoje?" },
      { role: "ai", lines: [
        "Creative_042 está queimando R$620/dia com ROAS 0.8x.",
        "Pause agora e realoque para Creative_019.",
      ]},
    ],
    en: [
      { role: "user", text: "what's my best creative right now?" },
      { role: "ai", lines: [
        "Creative_019 is dominating: 3.8% CTR, 3.2x ROAS.",
        "Scale from $120 → $400/day. Frequency 1.3x — plenty of room.",
      ]},
      { role: "user", text: "what would you pause today?" },
      { role: "ai", lines: [
        "Creative_042 is burning $620/day at 0.8x ROAS.",
        "Pause now and reallocate to Creative_019.",
      ]},
    ],
    es: [
      { role: "user", text: "¿cuál es mi mejor creativo ahora?" },
      { role: "ai", lines: [
        "Creative_019 está dominando: CTR 3.8%, ROAS 3.2x.",
        "Escala de $120 → $400/día. Frecuencia 1.3x — hay margen.",
      ]},
      { role: "user", text: "¿qué pausarías hoy?" },
      { role: "ai", lines: [
        "Creative_042 está quemando $620/día con ROAS 0.8x.",
        "Pausa ahora y reasigna a Creative_019.",
      ]},
    ],
  };

  const msgs = messages[lang] || messages.en;
  const label = lang === "pt" ? "SIMULAÇÃO" : lang === "es" ? "SIMULACIÓN" : "DEMO";
  const [visible, setVisible] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Use scroll listener since IntersectionObserver doesn't work on display:none
    let triggered = false;
    const check = () => {
      const el = sectionRef.current;
      if (!el || triggered) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
        triggered = true;
        started.current = true;
        msgs.forEach((msg, i) => {
          setTimeout(() => {
            setVisible(v => v + 1);
            if (msg.role === 'user') playTick(900, 0.05, 0.035);
            else playPop(0.04);
          }, i * 900 + 200);
        });
      }
    };
    // Check immediately (in case already in view) and on scroll
    setTimeout(check, 300);
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [lang]);
  const subtitle = lang === "pt"
    ? "Veja como o AdBrief analisa sua conta em tempo real"
    : lang === "es"
    ? "Mira cómo AdBrief analiza tu cuenta en tiempo real"
    : "See how AdBrief analyzes your account in real time";

  return (
    <section ref={sectionRef as any} className="mobile-demo-section" style={{
      background: "linear-gradient(180deg, #0a0f1e 0%, #080c14 100%)",
      padding: "16px 20px 40px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, background: "radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Label — mesmo estilo de "O PROBLEMA" */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
        <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, margin: 0 }}>{label}</p>
        <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
      </div>

      <p style={{ fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>{subtitle}</p>

      {/* Chat window */}
      <div style={{
        borderRadius: 16,
        border: "1px solid rgba(14,165,233,0.2)",
        background: "rgba(8,12,20,0.9)",
        overflow: "hidden",
        boxShadow: "0 0 40px rgba(14,165,233,0.08), 0 24px 48px rgba(0,0,0,0.5)",
        maxWidth: 360,
        margin: "0 auto",
      }}>
        {/* Window chrome */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#ff5f57","#febc2e","#28c840"].map(c => <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />)}
          </div>
          <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.3)", flex: 1, textAlign: "center" }}>adbrief.pro/ai</span>
          <span style={{ fontFamily: M, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(14,165,233,0.1)", color: "rgba(14,165,233,0.7)", border: "1px solid rgba(14,165,233,0.15)" }}>
            {lang === "pt" ? "∞ Meta" : lang === "es" ? "∞ Meta" : "∞ Meta"}
          </span>
        </div>

        {/* Messages */}
        <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.slice(0, visible).map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 0, animation: "msgIn 0.25s cubic-bezier(0.16,1,0.3,1) both" }}>
              {msg.role === "user" ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: "12px 12px 3px 12px",
                    background: "rgba(255,255,255,0.07)",
                    fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.85)",
                    maxWidth: "80%", lineHeight: 1.45,
                  }}>{msg.text}</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, color: "#0ea5e9" }}>ab</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                    {(msg.lines || []).map((line: string, li: number) => (
                      <p key={li} style={{
                        margin: 0, fontFamily: M, fontSize: 13, lineHeight: 1.55,
                        color: li === 0 ? "rgba(238,240,246,0.85)" : "rgba(238,240,246,0.55)",
                      }}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.01)" }}>
          <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            {lang === "pt" ? "Pergunte algo..." : lang === "es" ? "Pregunta algo..." : "Ask anything..."}
          </div>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onCTA, t, ctaLoading }: { onCTA: () => void; t: Record<string, string>; ctaLoading?: boolean }) {
  return (
    <section style={{ position: "relative", padding: "80px 24px 96px", overflow: "hidden", background: "linear-gradient(160deg, #04060c 0%, #071020 50%, #04060c 100%)" }}>
      {/* Grid pattern overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(14,165,233,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
      {/* Top glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 800, height: 2, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.3), transparent)" }} />
      {/* Center radial */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: "radial-gradient(ellipse, rgba(14,165,233,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", position: "relative" }}>
        {/* Label — mesmo padrão de "O PROBLEMA" */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
          <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(14,165,233,0.7)", textTransform: "uppercase" as const, margin: 0 }}>{t.final_label}</p>
          <div style={{ height: 1, width: 40, background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
        </div>

        <h2 style={{ fontFamily: F, fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 20, whiteSpace: "pre-line", color: "#fff" }}>{t.final_h2}</h2>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 44, lineHeight: 1.65, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>{t.final_sub}</p>

        <CTAButton
          onClick={onCTA}
          loading={ctaLoading}
          label={t.final_cta}
          size="lg"
          variant="primary"
          icon={<ArrowRight size={17} />}
        />

        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.22)", marginTop: 20, lineHeight: 1.6 }}>{t.final_fine}</p>

        {/* Trust badges */}
        <div className="trust-badges" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 36, flexWrap: "wrap" as const }}>
          {[t.trust_1, t.trust_2, t.trust_3].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#34d399", fontSize: 13 }}>✓</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }: { t: Record<string, string> }) {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#060810", padding: "48px clamp(16px,4vw,40px) 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="footer-inner" style={{ display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap" as const, marginBottom: 40 }}>
          {/* Brand */}
          <div style={{ maxWidth: 260 }}>
            <Logo size="lg" />
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.65, marginTop: 12 }}>
              {t.footer_tagline}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {["Meta Ads", "Google Ads"].map(p => (
                <span key={p} style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 8px" }}>{p}</span>
              ))}
            </div>
          </div>
          {/* Links */}
          <div className="footer-links" style={{ display: "flex", gap: 48, flexWrap: "wrap" as const }}>
            <div>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>{t.footer_product}</p>
              {([[t.footer_pricing, "/pricing"], [t.footer_how, "#how"], [t.footer_for, "#for"], [t.footer_tools, "/tools"]] as [string, string][]).map(([l, h]) => (
                <a key={h} href={h} style={{ display: "block", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none", marginBottom: 8, transition: "color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                >{l}</a>
              ))}
            </div>
            <div>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>{t.footer_legal}</p>
              {([[t.footer_privacy, "/privacy"], [t.footer_terms, "/terms"], [t.footer_faq, "/faq"]] as [string, string][]).map(([l, h]) => (
                <a key={h} href={h} style={{ display: "block", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none", marginBottom: 8, transition: "color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                >{l}</a>
              ))}
            </div>
          </div>
        </div>
        {/* Bottom bar */}
        <div className="footer-bottom" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>{t.footer_copy}</p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.12)" }}>{t.footer_built}</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function IndexNew() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [ctaLoading, setCtaLoading] = useState(false);

  useEffect(() => {
    detectLang().then(l => { setLang(l); setReady(true); });
  }, []);

  const t = T[lang];
  const handleCTA = () => {
    if (ctaLoading) return;
    setCtaLoading(true);
    navigate("/signup");
  };

  const titleMap: Record<Lang, string> = {
    en: "AdBrief — Ask Your Meta Ads Anything. Get Real Answers.",
    pt: "AdBrief — Pergunte tudo sobre sua conta de anúncios. IA com dados reais.",
    es: "AdBrief — Pregunta todo sobre tu cuenta de anuncios. IA con datos reales.",
  };
  const descMap: Record<Lang, string> = {
    en: "Connect Meta Ads and ask anything. AdBrief reads your real account data and answers like a senior media buyer — ROAS, hooks, what to pause, what to scale. 3-day free trial.",
    pt: "Conecte o Meta Ads e pergunte qualquer coisa. O AdBrief lê sua conta real e responde como um especialista — ROAS, hooks, o que pausar, o que escalar. Teste grátis por 3 dias.",
    es: "Conecta Meta Ads y pregunta lo que quieras. AdBrief lee tu cuenta real y responde como un experto — ROAS, hooks, qué pausar, qué escalar. Prueba gratis 3 días.",
  };

  if (!ready) return <div style={{ minHeight: "100vh", background: BG }} />;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: F }}>
      <Helmet>
        <title>{titleMap[lang]}</title>
        <meta name="description" content={descMap[lang]} />
        <link rel="canonical" href="https://adbrief.pro/" />
        <link rel="alternate" hrefLang="en" href="https://adbrief.pro/" />
        <link rel="alternate" hrefLang="pt-BR" href="https://adbrief.pro/?lang=pt" />
        <link rel="alternate" hrefLang="es" href="https://adbrief.pro/?lang=es" />
        <link rel="alternate" hrefLang="x-default" href="https://adbrief.pro/" />
        <meta property="og:title" content={titleMap[lang]} />
        <meta property="og:description" content={descMap[lang]} />
        <meta property="og:url" content="https://adbrief.pro/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://adbrief.pro/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <html lang={lang} />
        <style>{`          @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
          .cursor-blink{animation:blink 1s step-end infinite}
          
          /* Line enter — used for AI response lines and greeting cards */
          @keyframes lineEnter{
            from{opacity:0;transform:translateY(10px)}
            to{opacity:1;transform:translateY(0)}
          }
          @keyframes progressBar{from{width:0%}to{width:100%}} @keyframes fadeSlide{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

          /* KPI slide in from sidebar bottom */
          @keyframes kpiSlideIn{
            from{opacity:0;transform:translateX(-8px)}
            to{opacity:1;transform:translateX(0)}
          }
          
          /* Demo window */
          .demo-window{box-shadow:0 40px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.06)}
          @keyframes msg-pop{0%{opacity:0;transform:translateY(6px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
          .msg-new{animation:msg-pop 0.3s cubic-bezier(0.16,1,0.3,1) forwards}
          @keyframes dotBounce2{0%,100%{opacity:0.5;transform:scale(0.8)}50%{opacity:1;transform:scale(1.3)}}
          @keyframes thinking-glow{0%,100%{opacity:0.5}50%{opacity:1}}
          .thinking-dot{animation:thinking-glow 1.1s ease-in-out infinite}
          @keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.5);opacity:1}}
          
          /* AB avatar glow pulse */
          @keyframes avatarGlow{0%,100%{box-shadow:0 0 10px rgba(14,165,233,0.25)}50%{box-shadow:0 0 22px rgba(14,165,233,0.55)}}
          .ab-avatar{animation:avatarGlow 2.4s ease-in-out infinite}

          /* KPI floating cards */
          @keyframes kpiIn{from{opacity:0;transform:translateY(8px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}
          .kpi-card{animation:kpiIn 0.5s cubic-bezier(0.16,1,0.3,1) both}
          .kpi-card:nth-child(1){animation-delay:0.2s}
          .kpi-card:nth-child(2){animation-delay:0.35s}

          /* ── Mobile ── */
          .mobile-demo-section{display:none}
          @media(max-width:860px){
            .hero-grid{grid-template-columns:1fr!important;gap:0!important}
            .hero-demo-col{display:none!important}
            .pain-grid{grid-template-columns:1fr!important}
            .pain-grid>div:nth-child(2){display:none!important}
            .hero-main-section{min-height:auto!important;align-items:flex-start!important;padding-top:72px!important;padding-bottom:24px!important}
            .mobile-demo-section{display:block}
          }
          @media(max-width:480px){
            .hero-main-section{padding:80px 20px 24px!important;min-height:auto!important;align-items:flex-start!important}
            .hero-cta-row{flex-direction:column!important;align-items:stretch!important;gap:10px!important}
            .hero-cta-row button{width:100%!important;justify-content:center!important}
          }
          @media(max-width:768px){
            /* Fix hero section overflow */
            .hero-main-section{overflow-x:hidden!important}
            /* Nav */
            .nav-links{display:none!important}

            /* Hero text — wrap naturally, smaller size */
            h1,.hero-h1{font-size:clamp(28px,7vw,38px)!important;white-space:normal!important;letter-spacing:-0.04em!important;line-height:1.1!important}
            .hero-sub-p{font-size:14px!important;white-space:normal!important;max-width:100%!important}

            /* Demo: hide desktop frame, show mobile card */
            .demo-desktop-only{display:none!important}
            .demo-mobile-card{display:block!important}

            /* Sections */
            .how-grid{grid-template-columns:1fr!important}
            .for-who-tabs{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;width:100%!important;justify-content:flex-start!important;scrollbar-width:none!important}
            .for-who-tabs::-webkit-scrollbar{display:none!important}
            .for-who-grid{grid-template-columns:1fr!important}
            .for-who-card{padding:20px 18px!important}
            .pricing-grid{grid-template-columns:1fr!important}
            .tools-bento{grid-template-columns:1fr!important}
            .tools-io-grid{grid-template-columns:1fr!important}
          }
          @media(max-width:480px){
            h1,.hero-h1{font-size:clamp(22px,7vw,30px)!important}
          }

          @media(max-width:480px){
            .hero-social-proof{margin-bottom:10px!important}
            .hero-headline{margin-bottom:10px!important}
            .hero-sub{margin-bottom:16px!important}
            .hero-bullets{margin-bottom:16px!important}
            .hero-connects{margin-bottom:16px!important}
          }

          /* ── Comprehensive mobile fixes 640px ── */
          @media(max-width:640px){
            /* Pain section */
            .pain-grid{grid-template-columns:1fr!important;gap:20px!important}
            .pain-grid>div:nth-child(2){display:none!important}
            .pain-col-left,.pain-col-right{padding:0!important}

            /* How */
            .how-grid{grid-template-columns:1fr!important;gap:12px!important}

            /* For who */
            .for-who-tabs{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;width:100%!important;box-sizing:border-box!important;justify-content:flex-start!important;scrollbar-width:none!important}
            .for-who-tabs::-webkit-scrollbar{display:none!important}
            .for-who-grid{grid-template-columns:1fr!important}
            .for-who-card{padding:20px 18px!important}

            /* Pricing */
            .pricing-grid{grid-template-columns:1fr!important;gap:12px!important}

            /* Tools */
            .tools-bento{grid-template-columns:1fr!important}
            .tools-list{display:none!important}
            .tools-io-grid{grid-template-columns:1fr!important;gap:12px!important}

            /* Telegram */
            .telegram-grid{grid-template-columns:1fr!important;gap:12px!important}

            /* Footer */
            .footer-inner{flex-direction:column!important;gap:32px!important}
            .footer-links{gap:32px!important}
            .footer-bottom{flex-direction:column!important;align-items:flex-start!important;gap:8px!important}

            /* FinalCTA */
            .trust-badges{flex-direction:column!important;align-items:center!important;gap:12px!important}

            /* Sections: reduce padding */
            section{padding-left:20px!important;padding-right:20px!important}
          }
        `}</style>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "AdBrief",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://adbrief.pro",
          "description": descMap["en"],
          "offers": [
            { "@type": "Offer", "name": "Maker", "price": "19", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Pro", "price": "49", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Studio", "price": "149", "priceCurrency": "USD" }
          ],
          "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "127" }
        })}</script>
      </Helmet>
      <Nav onCTA={handleCTA} t={t} lang={lang} setLang={setLang} ctaLoading={ctaLoading} />
      <ImmersiveHero onCTA={handleCTA} t={t} lang={lang} ctaLoading={ctaLoading} />
      <SocialProofStrip lang={lang} />
      <PainSection onCTA={handleCTA} lang={lang} ctaLoading={ctaLoading} />
      <HowItWorks t={t} lang={lang} />
      <Tools t={t} lang={lang} />
      <ForWho onCTA={handleCTA} t={t} ctaLoading={ctaLoading} />
      <TelegramSection t={t} lang={lang} />
      <Pricing onCTA={handleCTA} t={t} lang={lang} />
      <FAQ t={t} />
      <FinalCTA onCTA={handleCTA} t={t} ctaLoading={ctaLoading} />
      <Footer t={t} />
      <CookieConsent />
    </div>
  );
}

// force-sync 2026-03-24T23:23:48Z// build 037868
// build 037873
// build 038117
// build 038341
// build 038419
// build 038567
// build 038739
// build 038884
// build 039031
// build 039466
// build 039929
// build 040086
// build 040384
// build 040734
// build 040979
// build 041799
// build 042101
// build 042584
// build 043084
// build 045577
// build 047361
// build 048102
// build 1775048278
// build 048365
// build 048504
// build 048725
// build 049292
// build 049522
// build 049762
// build 050157
// trigger 1775050169
// build 050493
// build 051734
// trigger 1775051742
// build 052123
// build 052998
// build 053636
// build 053934
// build 054351
// build 055366
// build 055518
// build 057453
// build 057620
// build 059100
// build 059531
// build 063130
// build 064406
// build 064723
// build 064880
// build 065476
// build 065622
// build 065845
// build 070705
// build 071407
// build 071710
// build 071884
// build 072454
// build 072700
// build 072957
// build 073262
// build 074593
// build 074801
// build 075490
// build 075677
// build 075821
// build 076121
// build 076484
// build 076948
// build 077149
// build 077407
// build 077751
// build 077994
// build 078540
// build 078792
