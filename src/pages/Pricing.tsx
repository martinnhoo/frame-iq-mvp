// Pricing.tsx — Detailed pricing page · Clarity removes hesitation
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, Loader2, ChevronDown, Shield, Zap, BarChart3,
  TrendingUp, Clock, Sparkles, MessageSquare, Video, Target, FileText,
  Users, Layers, BrainCircuit, Languages, LayoutGrid, Send, Minus,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lang = "en" | "pt" | "es";
type Cycle = "monthly" | "annual";

const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const BG2 = "#0a1020";
const SURFACE = "#0d1117";
const SURFACE2 = "#0f1626";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const TEXT4 = "rgba(255,255,255,0.22)";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.10)";
const GREEN = "#22c55e";
const INDIGO = "#6366f1";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── Translations ─────────────────────────────────────────────────────────────
const T: Record<Lang, Record<string, any>> = {
  pt: {
    nav_signin: "Entrar",
    // S1 — what you pay for
    s1_eyebrow: "Preços",
    s1_title: "Você não paga por acesso.",
    s1_title2: "Você paga por ação.",
    s1_body: "Cada melhoria é uma ação aplicada direto na sua campanha: pausar anúncios com baixo desempenho, escalar o que está performando, ajustar criativos com potencial. Decisões reais — não relatórios.",
    s1_final: "Você paga pelo que melhora sua conta. Ponto.",
    // S2 — what's included
    s2_title: "O que está incluído em todos os planos",
    s2_items: [
      { title: "Análise contínua", desc: "Suas campanhas são monitoradas todo dia. O sistema identifica oportunidades automaticamente." },
      { title: "Identificação de oportunidades", desc: "Cada decisão vem com contexto: o que está errado, por quê, e o que fazer." },
      { title: "Sistema de decisão", desc: "Não é um relatório. É uma recomendação acionável que você aplica em um clique." },
      { title: "Execução em um clique", desc: "Pause, escale ou ajuste sem sair do AdBrief — sem abrir o Gerenciador de Anúncios." },
      { title: "Histórico de ações", desc: "Tudo o que você fez fica registrado. Veja o impacto de cada decisão ao longo do tempo." },
      { title: "Aprendizado do sistema", desc: "Cada ação alimenta o sistema. As recomendações ficam mais específicas para o seu negócio." },
    ],
    // S3 — plans
    s3_title: "Escolha seu plano",
    s3_sub: "Todos incluem a IA, a execução em um clique e o aprendizado contínuo. A diferença está no volume.",
    s3_toggle_monthly: "Mensal",
    s3_toggle_annual: "Anual",
    s3_save_label: "economize 20%",
    s3_price_suffix_mo: "/mês",
    s3_price_suffix_yr: "/mês, pago anualmente",
    s3_free: {
      name: "Free",
      desc: "Explore antes de conectar",
      credits: "15 créditos",
      accounts: "0 contas",
      melhorias: "sem melhorias",
      context: "Para testar a IA (chat, hooks, análise de vídeo) antes de conectar sua conta. Melhorias exigem plano pago.",
    },
    s3_maker: {
      name: "Maker",
      desc: "1 conta ativa",
      credits: "1.000 créditos/mês",
      accounts: "1 conta",
      melhorias: "~33 melhorias/mês",
      context: "Suficiente pra manter uma conta otimizada mês inteiro. Inclui todas as ferramentas de IA.",
    },
    s3_pro: {
      name: "Pro",
      desc: "Escala com múltiplas contas",
      credits: "2.500 créditos/mês",
      accounts: "até 3 contas",
      melhorias: "~166 melhorias/mês",
      badge: "Plano mais escolhido",
      value: "Melhorias custam 50% menos que no Maker",
      context: "Feito pra quem gerencia múltiplas contas e precisa de decisões frequentes. Mesmo preço unitário bem menor por ação aplicada.",
    },
    s3_studio: {
      name: "Studio",
      desc: "Sem limites",
      credits: "Créditos ilimitados",
      accounts: "Contas ilimitadas",
      melhorias: "Melhorias ilimitadas",
      context: "Pra agências e operações grandes. Nenhum teto de uso. Cada decisão ruim evitada já paga o plano.",
    },
    s3_cta_free: "Criar conta grátis",
    s3_cta_trial: "Testar 3 dias grátis",
    s3_trial_note: "3 dias grátis em todos os planos pagos · Sem cartão pra começar no Free · Cancele quando quiser",
    // S3b — what credits buy
    s3b_title: "O que 1.000 créditos compram",
    s3b_sub: "Você escolhe como usar. A maior parte dos usuários mistura melhorias + ferramentas de IA.",
    s3b_examples: [
      { icon: "target", label: "Melhorias aplicadas", maker: "~33", pro: "~166", note: "ajustes reais na conta (pausar, escalar, orçamento)" },
      { icon: "chat",   label: "Mensagens no AI Chat", maker: "~500", pro: "~1.250", note: "2 créditos cada" },
      { icon: "video",  label: "Análises de vídeo",    maker: "~200", pro: "~500",   note: "5 créditos cada" },
      { icon: "zap",    label: "Hooks + Scripts + Briefs", maker: "~500", pro: "~1.250", note: "2 créditos cada" },
      { icon: "users",  label: "Personas geradas",     maker: "1.000", pro: "2.500", note: "1 crédito cada" },
    ],
    // S4 — how many
    s4_title: "Quantas melhorias você precisa por mês?",
    s4_sub: "Um guia honesto pra você escolher pelo tamanho da operação.",
    s4_scenarios: [
      { label: "Conta pequena", desc: "1 campanha ativa, poucos criativos", plan: "Free ou Maker", melhorias: "~5–15/mês" },
      { label: "Conta ativa", desc: "3–5 campanhas, rotação de criativos", plan: "Maker ou Pro", melhorias: "~30–80/mês" },
      { label: "Conta escalando", desc: "Múltiplas campanhas, orçamento crescendo", plan: "Pro", melhorias: "~100–166/mês" },
      { label: "Operação grande", desc: "Agência, várias contas, volume alto", plan: "Studio", melhorias: "Ilimitadas" },
    ],
    // S5 — feature matrix
    s5_title: "Comparação completa",
    s5_sub: "Todos os detalhes, lado a lado. Pra quem gosta de ler fino.",
    s5_collapsed: "Ver comparação detalhada",
    s5_expanded: "Fechar comparação",
    s5_groups: [
      {
        name: "Núcleo",
        rows: [
          { label: "Contas de anúncio", free: "—", maker: "1", pro: "3", studio: "Ilimitadas", icon: "layers" },
          { label: "Créditos mensais",  free: "15", maker: "1.000", pro: "2.500", studio: "Ilimitados", icon: "zap" },
          { label: "Melhorias aplicáveis (máx)", free: "—", maker: "~33", pro: "~166", studio: "Ilimitadas", icon: "target" },
          { label: "Custo por melhoria", free: "—", maker: "30 créditos", pro: "15 créditos", studio: "Grátis", icon: "trending" },
        ],
      },
      {
        name: "Ferramentas de IA",
        rows: [
          { label: "AI Chat (senior media buyer)", free: true, maker: true, pro: true, studio: true, icon: "chat" },
          { label: "Análise de vídeo",             free: true, maker: true, pro: true, studio: true, icon: "video" },
          { label: "Gerador de hooks",             free: true, maker: true, pro: true, studio: true, icon: "zap" },
          { label: "Scripts & Briefs",             free: true, maker: true, pro: true, studio: true, icon: "filetext" },
          { label: "Competitor Decoder",           free: true, maker: true, pro: true, studio: true, icon: "target" },
          { label: "Preflight Check",              free: true, maker: true, pro: true, studio: true, icon: "shield" },
          { label: "Persona Generator",            free: true, maker: true, pro: true, studio: true, icon: "users" },
          { label: "Tradução multi-idioma",        free: true, maker: true, pro: true, studio: true, icon: "languages" },
          { label: "Production Boards",            free: false, maker: true, pro: true, studio: true, icon: "layoutgrid" },
          { label: "Intelligence Hub",             free: false, maker: true, pro: true, studio: true, icon: "brain" },
        ],
      },
      {
        name: "Suporte & Avançado",
        rows: [
          { label: "Suporte via e-mail",      free: true, maker: true, pro: true, studio: true, icon: "send" },
          { label: "Suporte prioritário",     free: false, maker: false, pro: true, studio: true, icon: "send" },
          { label: "Success manager",         free: false, maker: false, pro: false, studio: true, icon: "users" },
          { label: "Teste gratuito de 3 dias", free: false, maker: true, pro: true, studio: true, icon: "clock" },
        ],
      },
    ],
    // S6 — system behavior
    s6_title: "Como funciona no dia a dia",
    s6_steps: [
      { title: "Você recebe oportunidades", desc: "O sistema analisa suas campanhas e apresenta decisões prontas — com raciocínio causal claro." },
      { title: "Aplica rapidamente", desc: "Um clique. Sem abrir o Gerenciador. Sem configuração manual. Sem planilha." },
      { title: "Sistema continua aprendendo", desc: "Cada ação alimenta o sistema. As recomendações ficam cada vez mais específicas pro seu negócio." },
    ],
    // S7 — final CTA
    s7_title: "Aplique sua primeira melhoria agora.",
    s7_cta: "Começar grátis",
    s7_sub: "Sem cartão · 15 créditos pra explorar · Pagamento só se quiser escalar",
    // FAQ
    faq_title: "Perguntas frequentes",
    faqs: [
      { q: "Qual a diferença entre 'crédito' e 'melhoria'?", a: "Crédito é a moeda do sistema. Melhoria é uma ação aplicada na sua conta (pausar anúncio, escalar, mudar orçamento). No Maker cada melhoria custa 30 créditos; no Pro custa 15. No Studio é grátis. Ferramentas de IA (chat, hooks, scripts) também consomem créditos — mas em valores menores." },
      { q: "O que o Free inclui?", a: "15 créditos pra testar a IA (chat, hooks, análise de vídeo). Não dá pra aplicar melhorias na conta de anúncios no Free — isso exige Maker ou superior. Serve pra ver se a IA te ajuda antes de pagar." },
      { q: "O teste grátis é de verdade?", a: "Sim. 3 dias com 40% dos créditos do plano escolhido. Sem cobrança nos 3 primeiros dias. Cancele antes e não paga nada." },
      { q: "Posso cancelar a qualquer momento?", a: "Sim. Todos os planos são mês a mês (ou ano a ano). Cancele em Configurações — você mantém acesso até o fim do ciclo já pago." },
      { q: "O que acontece quando os créditos acabam?", a: "Você recebe um aviso aos 80% e é bloqueado aos 100%. Créditos renovam no dia 1 de cada mês (ou no aniversário do plano anual). Dá pra comprar pacote extra ou fazer upgrade quando quiser." },
      { q: "Ligar o plano Anual vale a pena?", a: "Se você vai usar todo mês, sim — economiza 20% (equivalente a ~2,4 meses grátis). Se está testando, comece mensal." },
      { q: "Meus dados são seguros?", a: "Sim. Criptografia de 256 bits em trânsito e em repouso. Nunca compartilhamos seus dados com terceiros. Você pode solicitar exclusão total a qualquer momento." },
    ],
    // trust
    trust: ["Criptografia 256-bit", "GDPR Pronto", "99,9% Uptime", "Cancele quando quiser"],
    // footer
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidade",
    footer_terms: "Termos",
  },
  en: {
    nav_signin: "Sign in",
    s1_eyebrow: "Pricing",
    s1_title: "You don't pay for access.",
    s1_title2: "You pay for action.",
    s1_body: "Every improvement is an action applied directly to your campaign: pausing underperforming ads, scaling what works, adjusting creatives with potential. Real decisions — not reports.",
    s1_final: "You pay for what improves your account. That's it.",
    s2_title: "What's included in every plan",
    s2_items: [
      { title: "Continuous analysis", desc: "Your campaigns are monitored every day. The system identifies opportunities automatically." },
      { title: "Opportunity identification", desc: "Each decision comes with context: what's wrong, why, and what to do." },
      { title: "Decision system", desc: "Not a report. An actionable recommendation you can apply in one click." },
      { title: "One-click execution", desc: "Pause, scale, or adjust without leaving AdBrief — no Ads Manager needed." },
      { title: "Action history", desc: "Everything you did is logged. See the impact of each decision over time." },
      { title: "System learning", desc: "Each action feeds the system. Recommendations get more specific to your business." },
    ],
    s3_title: "Choose your plan",
    s3_sub: "All plans include the AI, one-click execution, and continuous learning. The difference is volume.",
    s3_toggle_monthly: "Monthly",
    s3_toggle_annual: "Annual",
    s3_save_label: "save 20%",
    s3_price_suffix_mo: "/mo",
    s3_price_suffix_yr: "/mo, billed annually",
    s3_free: {
      name: "Free",
      desc: "Explore before connecting",
      credits: "15 credits",
      accounts: "0 accounts",
      melhorias: "no improvements",
      context: "To test the AI (chat, hooks, video analysis) before connecting your account. Improvements require a paid plan.",
    },
    s3_maker: {
      name: "Maker",
      desc: "1 active account",
      credits: "1,000 credits/mo",
      accounts: "1 account",
      melhorias: "~33 improvements/mo",
      context: "Enough to keep one account optimized all month. Includes every AI tool.",
    },
    s3_pro: {
      name: "Pro",
      desc: "Scale with multiple accounts",
      credits: "2,500 credits/mo",
      accounts: "up to 3 accounts",
      melhorias: "~166 improvements/mo",
      badge: "Most popular",
      value: "Improvements cost 50% less than Maker",
      context: "Built for anyone managing multiple accounts who needs frequent decisions. Much lower unit cost per applied action.",
    },
    s3_studio: {
      name: "Studio",
      desc: "No limits",
      credits: "Unlimited credits",
      accounts: "Unlimited accounts",
      melhorias: "Unlimited improvements",
      context: "For agencies and large operations. No usage ceiling. One prevented bad decision already pays the plan.",
    },
    s3_cta_free: "Create free account",
    s3_cta_trial: "Start 3-day free trial",
    s3_trial_note: "3 days free on all paid plans · No card to start on Free · Cancel anytime",
    s3b_title: "What 1,000 credits buy",
    s3b_sub: "You choose how to use them. Most users mix improvements with AI tools.",
    s3b_examples: [
      { icon: "target", label: "Improvements applied", maker: "~33", pro: "~166", note: "real account actions (pause, scale, budget)" },
      { icon: "chat",   label: "AI Chat messages",    maker: "~500", pro: "~1,250", note: "2 credits each" },
      { icon: "video",  label: "Video analyses",      maker: "~200", pro: "~500",   note: "5 credits each" },
      { icon: "zap",    label: "Hooks + Scripts + Briefs", maker: "~500", pro: "~1,250", note: "2 credits each" },
      { icon: "users",  label: "Personas generated",  maker: "1,000", pro: "2,500", note: "1 credit each" },
    ],
    s4_title: "How many improvements do you need?",
    s4_sub: "An honest guide based on the size of your operation.",
    s4_scenarios: [
      { label: "Small account", desc: "1 active campaign, few creatives", plan: "Free or Maker", melhorias: "~5–15/mo" },
      { label: "Active account", desc: "3–5 campaigns, creative rotation", plan: "Maker or Pro", melhorias: "~30–80/mo" },
      { label: "Scaling account", desc: "Multiple campaigns, growing budget", plan: "Pro", melhorias: "~100–166/mo" },
      { label: "Large operation", desc: "Agency, multiple accounts, high volume", plan: "Studio", melhorias: "Unlimited" },
    ],
    s5_title: "Full comparison",
    s5_sub: "Every detail, side by side. For those who like the fine print.",
    s5_collapsed: "See full comparison",
    s5_expanded: "Close comparison",
    s5_groups: [
      {
        name: "Core",
        rows: [
          { label: "Ad accounts", free: "—", maker: "1", pro: "3", studio: "Unlimited", icon: "layers" },
          { label: "Monthly credits",  free: "15", maker: "1,000", pro: "2,500", studio: "Unlimited", icon: "zap" },
          { label: "Applicable improvements (max)", free: "—", maker: "~33", pro: "~166", studio: "Unlimited", icon: "target" },
          { label: "Cost per improvement", free: "—", maker: "30 credits", pro: "15 credits", studio: "Free", icon: "trending" },
        ],
      },
      {
        name: "AI Tools",
        rows: [
          { label: "AI Chat (senior media buyer)", free: true, maker: true, pro: true, studio: true, icon: "chat" },
          { label: "Video analysis",               free: true, maker: true, pro: true, studio: true, icon: "video" },
          { label: "Hook generator",               free: true, maker: true, pro: true, studio: true, icon: "zap" },
          { label: "Scripts & Briefs",             free: true, maker: true, pro: true, studio: true, icon: "filetext" },
          { label: "Competitor Decoder",           free: true, maker: true, pro: true, studio: true, icon: "target" },
          { label: "Preflight Check",              free: true, maker: true, pro: true, studio: true, icon: "shield" },
          { label: "Persona Generator",            free: true, maker: true, pro: true, studio: true, icon: "users" },
          { label: "Multi-language translation",   free: true, maker: true, pro: true, studio: true, icon: "languages" },
          { label: "Production Boards",            free: false, maker: true, pro: true, studio: true, icon: "layoutgrid" },
          { label: "Intelligence Hub",             free: false, maker: true, pro: true, studio: true, icon: "brain" },
        ],
      },
      {
        name: "Support & Advanced",
        rows: [
          { label: "Email support",      free: true, maker: true, pro: true, studio: true, icon: "send" },
          { label: "Priority support",   free: false, maker: false, pro: true, studio: true, icon: "send" },
          { label: "Success manager",    free: false, maker: false, pro: false, studio: true, icon: "users" },
          { label: "3-day free trial",   free: false, maker: true, pro: true, studio: true, icon: "clock" },
        ],
      },
    ],
    s6_title: "How it works day to day",
    s6_steps: [
      { title: "You receive opportunities", desc: "The system analyzes your campaigns and presents ready decisions — with clear causal reasoning." },
      { title: "Apply quickly", desc: "One click. No Ads Manager. No manual setup. No spreadsheet." },
      { title: "System keeps learning", desc: "Each action feeds the system. Recommendations get more specific to your business over time." },
    ],
    s7_title: "Apply your first improvement now.",
    s7_cta: "Start free",
    s7_sub: "No card · 15 credits to explore · Pay only if you want to scale",
    faq_title: "Frequently asked questions",
    faqs: [
      { q: "What's the difference between 'credit' and 'improvement'?", a: "A credit is the system currency. An improvement is an action applied to your account (pause ad, scale, change budget). On Maker each improvement costs 30 credits; on Pro 15 credits. On Studio they're free. AI tools (chat, hooks, scripts) also consume credits — in smaller amounts." },
      { q: "What does Free include?", a: "15 credits to test the AI (chat, hooks, video analysis). You can't apply improvements on your ad account on Free — that requires Maker or higher. It's for checking whether the AI helps you before paying." },
      { q: "Is the free trial real?", a: "Yes. 3 days with 40% of the chosen plan's credits. No charge for the first 3 days. Cancel before and pay nothing." },
      { q: "Can I cancel anytime?", a: "Yes. All plans are month-to-month (or year-to-year). Cancel in Settings — you keep access until the end of the paid cycle." },
      { q: "What happens when credits run out?", a: "You get a warning at 80% and are blocked at 100%. Credits renew on the 1st of each month (or on the annual plan's anniversary). You can buy a top-up pack or upgrade anytime." },
      { q: "Is the annual plan worth it?", a: "If you'll use it every month, yes — you save 20% (equivalent to ~2.4 months free). If you're testing, start monthly." },
      { q: "Is my data secure?", a: "Yes. 256-bit encryption in transit and at rest. We never share your data with third parties. You can request full deletion at any time." },
    ],
    trust: ["256-bit Encryption", "GDPR Ready", "99.9% Uptime", "Cancel anytime"],
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
  },
  es: {
    nav_signin: "Iniciar sesión",
    s1_eyebrow: "Precios",
    s1_title: "No pagas por acceso.",
    s1_title2: "Pagas por acción.",
    s1_body: "Cada mejora es una acción aplicada directamente a tu campaña: pausar anuncios con bajo rendimiento, escalar lo que funciona, ajustar creativos con potencial. Decisiones reales — no reportes.",
    s1_final: "Pagas por lo que mejora tu cuenta. Eso es todo.",
    s2_title: "Qué está incluido en todos los planes",
    s2_items: [
      { title: "Análisis continuo", desc: "Tus campañas son monitoreadas todos los días. El sistema identifica oportunidades automáticamente." },
      { title: "Identificación de oportunidades", desc: "Cada decisión viene con contexto: qué está mal, por qué y qué hacer." },
      { title: "Sistema de decisión", desc: "No es un reporte. Es una recomendación accionable que puedes aplicar en un clic." },
      { title: "Ejecución en un clic", desc: "Pausa, escala o ajusta sin salir de AdBrief — sin abrir el Administrador de Anuncios." },
      { title: "Historial de acciones", desc: "Todo lo que hiciste queda registrado. Ve el impacto de cada decisión a lo largo del tiempo." },
      { title: "Aprendizaje del sistema", desc: "Cada acción alimenta al sistema. Las recomendaciones se vuelven más específicas para tu negocio." },
    ],
    s3_title: "Elige tu plan",
    s3_sub: "Todos incluyen la IA, ejecución en un clic y aprendizaje continuo. La diferencia está en el volumen.",
    s3_toggle_monthly: "Mensual",
    s3_toggle_annual: "Anual",
    s3_save_label: "ahorra 20%",
    s3_price_suffix_mo: "/mes",
    s3_price_suffix_yr: "/mes, facturado anualmente",
    s3_free: {
      name: "Free",
      desc: "Explora antes de conectar",
      credits: "15 créditos",
      accounts: "0 cuentas",
      melhorias: "sin mejoras",
      context: "Para probar la IA (chat, hooks, análisis de video) antes de conectar tu cuenta. Las mejoras requieren plan pago.",
    },
    s3_maker: {
      name: "Maker",
      desc: "1 cuenta activa",
      credits: "1.000 créditos/mes",
      accounts: "1 cuenta",
      melhorias: "~33 mejoras/mes",
      context: "Suficiente para mantener una cuenta optimizada todo el mes. Incluye todas las herramientas de IA.",
    },
    s3_pro: {
      name: "Pro",
      desc: "Escala con múltiples cuentas",
      credits: "2.500 créditos/mes",
      accounts: "hasta 3 cuentas",
      melhorias: "~166 mejoras/mes",
      badge: "Plan más elegido",
      value: "Las mejoras cuestan 50% menos que en Maker",
      context: "Hecho para quien gestiona múltiples cuentas y necesita decisiones frecuentes. Costo unitario mucho menor por acción aplicada.",
    },
    s3_studio: {
      name: "Studio",
      desc: "Sin límites",
      credits: "Créditos ilimitados",
      accounts: "Cuentas ilimitadas",
      melhorias: "Mejoras ilimitadas",
      context: "Para agencias y operaciones grandes. Sin techo de uso. Una decisión mala evitada ya paga el plan.",
    },
    s3_cta_free: "Crear cuenta gratis",
    s3_cta_trial: "Probar 3 días gratis",
    s3_trial_note: "3 días gratis en todos los planes pagos · Sin tarjeta para empezar en Free · Cancela cuando quieras",
    s3b_title: "Qué compran 1.000 créditos",
    s3b_sub: "Tú eliges cómo usarlos. La mayoría mezcla mejoras con herramientas de IA.",
    s3b_examples: [
      { icon: "target", label: "Mejoras aplicadas",    maker: "~33", pro: "~166", note: "acciones reales (pausar, escalar, presupuesto)" },
      { icon: "chat",   label: "Mensajes en AI Chat",  maker: "~500", pro: "~1.250", note: "2 créditos c/u" },
      { icon: "video",  label: "Análisis de video",    maker: "~200", pro: "~500",   note: "5 créditos c/u" },
      { icon: "zap",    label: "Hooks + Scripts + Briefs", maker: "~500", pro: "~1.250", note: "2 créditos c/u" },
      { icon: "users",  label: "Personas generadas",   maker: "1.000", pro: "2.500", note: "1 crédito c/u" },
    ],
    s4_title: "¿Cuántas mejoras necesitas al mes?",
    s4_sub: "Una guía honesta según el tamaño de tu operación.",
    s4_scenarios: [
      { label: "Cuenta pequeña", desc: "1 campaña activa, pocos creativos", plan: "Free o Maker", melhorias: "~5–15/mes" },
      { label: "Cuenta activa", desc: "3–5 campañas, rotación de creativos", plan: "Maker o Pro", melhorias: "~30–80/mes" },
      { label: "Cuenta escalando", desc: "Múltiples campañas, presupuesto creciendo", plan: "Pro", melhorias: "~100–166/mes" },
      { label: "Operación grande", desc: "Agencia, varias cuentas, volumen alto", plan: "Studio", melhorias: "Ilimitadas" },
    ],
    s5_title: "Comparación completa",
    s5_sub: "Todos los detalles, lado a lado. Para los que leen la letra fina.",
    s5_collapsed: "Ver comparación detallada",
    s5_expanded: "Cerrar comparación",
    s5_groups: [
      {
        name: "Núcleo",
        rows: [
          { label: "Cuentas de anuncios", free: "—", maker: "1", pro: "3", studio: "Ilimitadas", icon: "layers" },
          { label: "Créditos mensuales",  free: "15", maker: "1.000", pro: "2.500", studio: "Ilimitados", icon: "zap" },
          { label: "Mejoras aplicables (máx)", free: "—", maker: "~33", pro: "~166", studio: "Ilimitadas", icon: "target" },
          { label: "Costo por mejora", free: "—", maker: "30 créditos", pro: "15 créditos", studio: "Gratis", icon: "trending" },
        ],
      },
      {
        name: "Herramientas de IA",
        rows: [
          { label: "AI Chat (media buyer senior)", free: true, maker: true, pro: true, studio: true, icon: "chat" },
          { label: "Análisis de video",            free: true, maker: true, pro: true, studio: true, icon: "video" },
          { label: "Generador de hooks",           free: true, maker: true, pro: true, studio: true, icon: "zap" },
          { label: "Scripts y Briefs",             free: true, maker: true, pro: true, studio: true, icon: "filetext" },
          { label: "Competitor Decoder",           free: true, maker: true, pro: true, studio: true, icon: "target" },
          { label: "Preflight Check",              free: true, maker: true, pro: true, studio: true, icon: "shield" },
          { label: "Generador de personas",        free: true, maker: true, pro: true, studio: true, icon: "users" },
          { label: "Traducción multiidioma",       free: true, maker: true, pro: true, studio: true, icon: "languages" },
          { label: "Production Boards",            free: false, maker: true, pro: true, studio: true, icon: "layoutgrid" },
          { label: "Intelligence Hub",             free: false, maker: true, pro: true, studio: true, icon: "brain" },
        ],
      },
      {
        name: "Soporte y Avanzado",
        rows: [
          { label: "Soporte por email",     free: true, maker: true, pro: true, studio: true, icon: "send" },
          { label: "Soporte prioritario",   free: false, maker: false, pro: true, studio: true, icon: "send" },
          { label: "Success manager",       free: false, maker: false, pro: false, studio: true, icon: "users" },
          { label: "Prueba gratuita de 3 días", free: false, maker: true, pro: true, studio: true, icon: "clock" },
        ],
      },
    ],
    s6_title: "Cómo funciona en el día a día",
    s6_steps: [
      { title: "Recibes oportunidades", desc: "El sistema analiza tus campañas y presenta decisiones listas — con razonamiento causal claro." },
      { title: "Aplicas rápido", desc: "Un clic. Sin Administrador de Anuncios. Sin configuración manual. Sin hoja de cálculo." },
      { title: "El sistema sigue aprendiendo", desc: "Cada acción alimenta al sistema. Las recomendaciones se vuelven más específicas para tu negocio con el tiempo." },
    ],
    s7_title: "Aplica tu primera mejora ahora.",
    s7_cta: "Empezar gratis",
    s7_sub: "Sin tarjeta · 15 créditos para explorar · Solo pagas si quieres escalar",
    faq_title: "Preguntas frecuentes",
    faqs: [
      { q: "¿Cuál es la diferencia entre 'crédito' y 'mejora'?", a: "Un crédito es la moneda del sistema. Una mejora es una acción aplicada a tu cuenta (pausar anuncio, escalar, cambiar presupuesto). En Maker cada mejora cuesta 30 créditos; en Pro 15. En Studio es gratis. Las herramientas de IA (chat, hooks, scripts) también consumen créditos — en cantidades menores." },
      { q: "¿Qué incluye Free?", a: "15 créditos para probar la IA (chat, hooks, análisis de video). No puedes aplicar mejoras en tu cuenta de anuncios en Free — eso requiere Maker o superior. Sirve para ver si la IA te ayuda antes de pagar." },
      { q: "¿La prueba gratuita es real?", a: "Sí. 3 días con 40% de los créditos del plan elegido. Sin cargo en los primeros 3 días. Cancela antes y no pagas nada." },
      { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. Todos los planes son mes a mes (o año a año). Cancela en Configuración — mantienes el acceso hasta el fin del ciclo pagado." },
      { q: "¿Qué pasa cuando se agotan los créditos?", a: "Recibes una advertencia al 80% y te bloqueamos al 100%. Los créditos se renuevan el día 1 de cada mes (o en el aniversario del plan anual). Puedes comprar un paquete extra o actualizar cuando quieras." },
      { q: "¿Vale la pena el plan Anual?", a: "Si vas a usarlo todos los meses, sí — ahorras 20% (equivalente a ~2,4 meses gratis). Si estás probando, empieza mensual." },
      { q: "¿Mis datos son seguros?", a: "Sí. Cifrado de 256 bits en tránsito y en reposo. Nunca compartimos tus datos con terceros. Puedes solicitar eliminación total en cualquier momento." },
    ],
    trust: ["Cifrado 256-bit", "GDPR Listo", "99,9% Uptime", "Cancela cuando quieras"],
    footer_copy: "© 2026 AdBrief",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
  },
};

// ── Stripe mapping ───────────────────────────────────────────────────────────
// Add annual price_ids when available. For now, annual falls back to monthly checkout.
const PLANS = {
  maker:  {
    product_id: "prod_U88ul5IK0HHW19",
    price_id_monthly: "price_1T9sd1Dr9So14XztT3Mqddch",
    price_id_annual:  "price_1T9sd1Dr9So14XztT3Mqddch", // TODO: replace with annual price
    monthly: 19, annual: 15.2,
  },
  pro:    {
    product_id: "prod_U88v5WVcy2NZV7",
    price_id_monthly: "price_1T9sdfDr9So14XztPR3tI14Y",
    price_id_annual:  "price_1T9sdfDr9So14XztPR3tI14Y", // TODO: replace with annual price
    monthly: 49, annual: 39.2,
  },
  studio: {
    product_id: "prod_U88wpX4Bphfifi",
    price_id_monthly: "price_1TMzhCDr9So14Xzt1rUmfs7h",
    price_id_annual:  "price_1TMzhCDr9So14Xzt1rUmfs7h", // TODO: replace with annual price
    monthly: 299, annual: 239.2,
  },
};

// ── Tiny icon map for feature rows ───────────────────────────────────────────
const IconMap: Record<string, JSX.Element> = {
  target:    <Target size={13} />,
  chat:      <MessageSquare size={13} />,
  video:     <Video size={13} />,
  zap:       <Zap size={13} />,
  users:     <Users size={13} />,
  filetext:  <FileText size={13} />,
  shield:    <Shield size={13} />,
  languages: <Languages size={13} />,
  layoutgrid: <LayoutGrid size={13} />,
  brain:     <BrainCircuit size={13} />,
  send:      <Send size={13} />,
  clock:     <Clock size={13} />,
  layers:    <Layers size={13} />,
  trending:  <TrendingUp size={13} />,
};

// ── Component ────────────────────────────────────────────────────────────────
const Pricing = () => {
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const handleUpgrade = async (planKey: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate(`/signup?plan=${planKey}&cycle=${cycle}`); return; }
    const plan = PLANS[planKey as keyof typeof PLANS];
    if (!plan) return;
    setUpgrading(planKey);
    try {
      const priceId = cycle === "annual" ? plan.price_id_annual : plan.price_id_monthly;
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: priceId }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not create checkout session");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally { setUpgrading(null); }
  };

  const fmt = (n: number) => lang === "en" ? `$${n % 1 === 0 ? n : n.toFixed(2)}` : `$${(n % 1 === 0 ? n.toString() : n.toFixed(2)).replace(".", ",")}`;

  const priceFor = (key: "free" | "maker" | "pro" | "studio"): string => {
    if (key === "free") return "$0";
    const p = PLANS[key];
    return cycle === "annual" ? fmt(p.annual) : fmt(p.monthly);
  };

  const plans = [
    {
      key: "free" as const, ...t.s3_free, price: "$0",
      cta: t.s3_cta_free, action: () => navigate("/signup"),
      ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT2,
      ctaBorder: `1px solid ${BORDER2}`, highlight: false,
    },
    {
      key: "maker" as const, ...t.s3_maker, price: priceFor("maker"),
      cta: t.s3_cta_trial, action: () => handleUpgrade("maker"),
      ctaBg: "rgba(14,165,233,0.08)", ctaColor: ACCENT,
      ctaBorder: `1px solid rgba(14,165,233,0.22)`, highlight: false,
    },
    {
      key: "pro" as const, ...t.s3_pro, price: priceFor("pro"),
      cta: t.s3_cta_trial, action: () => handleUpgrade("pro"),
      ctaBg: INDIGO, ctaColor: "#fff", ctaBorder: "none", highlight: true,
    },
    {
      key: "studio" as const, ...t.s3_studio, price: priceFor("studio"),
      cta: t.s3_cta_trial, action: () => handleUpgrade("studio"),
      ctaBg: "rgba(255,255,255,0.04)", ctaColor: TEXT2,
      ctaBorder: `1px solid ${BORDER2}`, highlight: false,
    },
  ];

  const renderFeatureCell = (val: boolean | string) => {
    if (val === true)  return <Check size={13} style={{ color: GREEN }} />;
    if (val === false) return <Minus size={12} style={{ color: TEXT4 }} />;
    return <span style={{ fontSize: 11.5, color: TEXT2, fontWeight: 500 }}>{val}</span>;
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: F }}>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 24px", background: BG }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/"><Logo size="lg" /></Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <button onClick={() => navigate("/login")}
              style={{ fontFamily: F, fontSize: 13, color: TEXT2, background: "none", border: "none", cursor: "pointer", padding: "6px 10px" }}>
              {t.nav_signin}
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ S1 — What you pay for ═══════════════════════════════════════ */}
      <section style={{ padding: "clamp(72px,10vw,120px) 24px clamp(48px,6vw,72px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
            color: ACCENT, fontWeight: 700, marginBottom: 18, opacity: 0.85,
          }}>
            {t.s1_eyebrow}
          </div>
          <h1 style={{
            fontSize: "clamp(32px,4vw,48px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.08, margin: "0 0 2px",
            color: TEXT3,
          }}>
            {t.s1_title}
          </h1>
          <h1 style={{
            fontSize: "clamp(32px,4vw,48px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.08, margin: "0 0 28px",
            color: TEXT,
          }}>
            {t.s1_title2}
          </h1>
          <p style={{ fontSize: 16, color: TEXT2, lineHeight: 1.7, margin: "0 0 24px" }}>
            {t.s1_body}
          </p>
          <p style={{
            fontSize: 14, color: ACCENT, fontWeight: 600, margin: 0, opacity: 0.88,
          }}>
            {t.s1_final}
          </p>
        </div>
      </section>

      {/* ═══ S2 — What's included ════════════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800,
            letterSpacing: "-0.035em", margin: "0 0 48px",
          }}>
            {t.s2_title}
          </h2>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 36px",
          }} className="s2-grid">
            {(t.s2_items as Array<{title: string; desc: string}>).map((item, i) => {
              const icons = [<BarChart3 size={16} />, <Target size={16} />, <Sparkles size={16} />, <ArrowRight size={16} />, <Clock size={16} />, <TrendingUp size={16} />];
              const colors = [ACCENT, GREEN, INDIGO, ACCENT, TEXT3, GREEN];
              return (
                <div key={i} style={{
                  padding: "22px", borderRadius: 12,
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  transition: `all 0.3s ${EASE}`,
                }} className="s2-card">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                    color: colors[i],
                  }}>
                    {icons[i]}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, letterSpacing: "-0.01em" }}>{item.title}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: TEXT3, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ S3 — Plan comparison ════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(72px,9vw,100px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
            <div>
              <h2 style={{
                fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 800,
                letterSpacing: "-0.035em", margin: "0 0 8px",
              }}>
                {t.s3_title}
              </h2>
              <p style={{ fontSize: 13.5, color: TEXT3, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
                {t.s3_sub}
              </p>
            </div>

            {/* Billing toggle */}
            <div role="radiogroup" aria-label="billing cycle" style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: 4, borderRadius: 10, background: SURFACE,
              border: `1px solid ${BORDER}`, position: "relative",
            }} className="billing-toggle">
              <button
                role="radio" aria-checked={cycle === "monthly"}
                onClick={() => setCycle("monthly")}
                style={{
                  fontFamily: F, fontSize: 12.5, fontWeight: 600,
                  padding: "8px 16px", borderRadius: 7, border: "none",
                  background: cycle === "monthly" ? "rgba(255,255,255,0.06)" : "transparent",
                  color: cycle === "monthly" ? TEXT : TEXT3, cursor: "pointer",
                  transition: `all 0.2s ${EASE}`,
                }}>
                {t.s3_toggle_monthly}
              </button>
              <button
                role="radio" aria-checked={cycle === "annual"}
                onClick={() => setCycle("annual")}
                style={{
                  fontFamily: F, fontSize: 12.5, fontWeight: 600,
                  padding: "8px 16px", borderRadius: 7, border: "none",
                  background: cycle === "annual" ? "rgba(34,197,94,0.08)" : "transparent",
                  color: cycle === "annual" ? GREEN : TEXT3, cursor: "pointer",
                  transition: `all 0.2s ${EASE}`,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {t.s3_toggle_annual}
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em",
                  color: cycle === "annual" ? GREEN : TEXT4,
                  background: cycle === "annual" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                  padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                }}>
                  −20%
                </span>
              </button>
            </div>
          </div>

          {/* Plan rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }} className="plans-stack">
            {plans.map((plan) => {
              const priceSuffix = plan.key === "free"
                ? ""
                : cycle === "annual" ? t.s3_price_suffix_yr : t.s3_price_suffix_mo;
              return (
                <div key={plan.key} className="plan-row" style={{
                  display: "grid", gridTemplateColumns: "200px 1fr 180px",
                  alignItems: "center", gap: "clamp(18px,3vw,32px)",
                  padding: plan.highlight ? "28px 30px" : "22px 26px",
                  borderRadius: 14,
                  background: plan.highlight ? "linear-gradient(180deg, rgba(99,102,241,0.07) 0%, rgba(99,102,241,0.02) 100%)" : SURFACE,
                  border: `1px solid ${plan.highlight ? "rgba(99,102,241,0.28)" : BORDER}`,
                  boxShadow: plan.highlight ? "0 8px 32px -12px rgba(99,102,241,0.35)" : "none",
                  position: "relative",
                  transition: `all 0.3s ${EASE}`,
                }}>
                  {/* Left — identity + price */}
                  <div>
                    {plan.badge && (
                      <span style={{
                        fontFamily: F, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
                        color: INDIGO, display: "inline-block", marginBottom: 8,
                        background: "rgba(99,102,241,0.12)", padding: "3px 9px", borderRadius: 5,
                        border: "1px solid rgba(99,102,241,0.22)", textTransform: "uppercase",
                      }}>
                        {plan.badge}
                      </span>
                    )}
                    <div style={{
                      fontSize: plan.highlight ? 19 : 17, fontWeight: 700, color: TEXT,
                      letterSpacing: "-0.02em", marginBottom: 2,
                    }}>
                      {plan.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: TEXT3, marginBottom: 10, lineHeight: 1.4 }}>
                      {plan.desc}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                      <span style={{
                        fontSize: plan.highlight ? 36 : 30, fontWeight: 900,
                        color: plan.highlight ? TEXT : "rgba(255,255,255,0.92)",
                        letterSpacing: "-0.045em", lineHeight: 1,
                      }}>
                        {plan.price}
                      </span>
                      {priceSuffix && (
                        <span style={{ fontSize: 11, color: TEXT3, marginLeft: 2 }}>{priceSuffix}</span>
                      )}
                    </div>
                  </div>

                  {/* Middle — stat chips + context */}
                  <div>
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10,
                    }}>
                      {[plan.credits, plan.accounts, plan.melhorias].map((chip, i) => (
                        <span key={i} style={{
                          fontSize: 11.5, color: TEXT2, fontWeight: 500,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${BORDER}`,
                          padding: "4px 10px", borderRadius: 6,
                          whiteSpace: "nowrap",
                        }}>
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: TEXT3, margin: 0, lineHeight: 1.55, maxWidth: 440 }}>
                      {plan.context}
                    </p>
                    {plan.value && (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        marginTop: 10, fontSize: 11.5, fontWeight: 600,
                        color: GREEN,
                      }}>
                        <Check size={12} />{plan.value}
                      </div>
                    )}
                  </div>

                  {/* Right — CTA */}
                  <button onClick={plan.action} disabled={upgrading !== null} style={{
                    fontFamily: F, fontSize: 13.5, fontWeight: 700,
                    padding: "12px 20px", borderRadius: 9,
                    background: plan.ctaBg, color: plan.ctaColor,
                    border: plan.ctaBorder, cursor: upgrading ? "default" : "pointer",
                    transition: `all 0.2s ${EASE}`, width: "100%",
                    whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    opacity: upgrading && upgrading !== plan.key ? 0.5 : 1,
                  }}>
                    {upgrading === plan.key
                      ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <>{plan.cta}<ArrowRight size={13} /></>
                    }
                  </button>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 11.5, color: TEXT3, marginTop: 20, opacity: 0.7, textAlign: "center" }}>
            {t.s3_trial_note}
          </p>
        </div>
      </section>

      {/* ═══ S3b — What credits buy ══════════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(56px,7vw,84px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 8px",
          }}>
            {t.s3b_title}
          </h2>
          <p style={{ fontSize: 13, color: TEXT3, margin: "0 0 32px", maxWidth: 500, lineHeight: 1.55 }}>
            {t.s3b_sub}
          </p>

          <div style={{
            borderRadius: 12, background: SURFACE,
            border: `1px solid ${BORDER}`, overflow: "hidden",
          }}>
            <div className="credits-head" style={{
              display: "grid", gridTemplateColumns: "1fr 100px 100px",
              padding: "14px 20px", gap: 12,
              fontSize: 11, color: TEXT3, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em",
              background: SURFACE2, borderBottom: `1px solid ${BORDER}`,
            }}>
              <span>Uso</span>
              <span style={{ textAlign: "right" }}>Maker</span>
              <span style={{ textAlign: "right" }}>Pro</span>
            </div>
            {(t.s3b_examples as Array<{ icon: string; label: string; maker: string; pro: string; note: string }>).map((ex, i) => (
              <div key={i} className="credits-row" style={{
                display: "grid", gridTemplateColumns: "1fr 100px 100px",
                padding: "14px 20px", gap: 12, alignItems: "center",
                borderBottom: i < 4 ? `1px solid ${BORDER}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: ACCENT, opacity: 0.8, display: "flex" }}>
                    {ex.icon === "target" ? <Target size={13} />
                      : ex.icon === "chat" ? <MessageSquare size={13} />
                      : ex.icon === "video" ? <Video size={13} />
                      : ex.icon === "zap" ? <Zap size={13} />
                      : <Users size={13} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{ex.label}</div>
                    <div style={{ fontSize: 11, color: TEXT4, marginTop: 2 }}>{ex.note}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: TEXT2, fontWeight: 600, textAlign: "right" }}>{ex.maker}</span>
                <span style={{ fontSize: 13, color: INDIGO, fontWeight: 700, textAlign: "right" }}>{ex.pro}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S4 — How many improvements ══════════════════════════════════ */}
      <section style={{
        padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 6px",
          }}>
            {t.s4_title}
          </h2>
          <p style={{ fontSize: 13, color: TEXT3, margin: "0 0 36px", lineHeight: 1.55 }}>
            {t.s4_sub}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(t.s4_scenarios as Array<{label: string; desc: string; plan: string; melhorias: string}>).map((s, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 120px auto",
                alignItems: "center", gap: 20,
                padding: "18px 22px", borderRadius: 11,
                background: SURFACE, border: `1px solid ${BORDER}`,
                transition: `border-color 0.2s ${EASE}`,
              }} className="scenario-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: TEXT3, lineHeight: 1.4 }}>{s.desc}</div>
                </div>
                <div style={{ fontSize: 12, color: TEXT2, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {s.melhorias}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: ACCENT,
                  padding: "5px 11px", borderRadius: 6,
                  background: "rgba(14,165,233,0.08)",
                  border: "1px solid rgba(14,165,233,0.18)",
                  whiteSpace: "nowrap", letterSpacing: "-0.01em",
                }}>
                  {s.plan}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S5 — Feature matrix (collapsible) ═══════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(56px,7vw,84px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: matrixOpen ? 28 : 0 }}>
            <h2 style={{
              fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
              letterSpacing: "-0.03em", margin: "0 0 6px",
            }}>
              {t.s5_title}
            </h2>
            <p style={{ fontSize: 13, color: TEXT3, margin: "0 0 20px", lineHeight: 1.55 }}>
              {t.s5_sub}
            </p>
            <button
              onClick={() => setMatrixOpen(!matrixOpen)}
              style={{
                fontFamily: F, fontSize: 13, fontWeight: 600,
                padding: "10px 18px", borderRadius: 8,
                background: matrixOpen ? "rgba(255,255,255,0.04)" : "rgba(14,165,233,0.08)",
                color: matrixOpen ? TEXT2 : ACCENT,
                border: `1px solid ${matrixOpen ? BORDER2 : "rgba(14,165,233,0.22)"}`,
                cursor: "pointer", transition: `all 0.2s ${EASE}`,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {matrixOpen ? t.s5_expanded : t.s5_collapsed}
              <ChevronDown size={14} style={{
                transform: matrixOpen ? "rotate(180deg)" : "none",
                transition: `transform 0.2s ${EASE}`,
              }} />
            </button>
          </div>

          {matrixOpen && (
            <div style={{
              borderRadius: 12, background: SURFACE,
              border: `1px solid ${BORDER}`, overflow: "hidden",
              animation: `fadeIn 0.3s ${EASE}`,
            }}>
              {/* Matrix header */}
              <div className="matrix-head" style={{
                display: "grid", gridTemplateColumns: "minmax(200px, 1fr) 90px 90px 90px 90px",
                padding: "14px 20px", gap: 12,
                background: SURFACE2, borderBottom: `1px solid ${BORDER}`,
                fontSize: 11, color: TEXT3, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                <span />
                <span style={{ textAlign: "center" }}>Free</span>
                <span style={{ textAlign: "center" }}>Maker</span>
                <span style={{ textAlign: "center", color: INDIGO }}>Pro</span>
                <span style={{ textAlign: "center" }}>Studio</span>
              </div>

              {(t.s5_groups as Array<{ name: string; rows: any[] }>).map((group, gi) => (
                <div key={gi}>
                  <div style={{
                    padding: "16px 20px 10px", fontSize: 11,
                    color: TEXT3, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    background: "rgba(255,255,255,0.01)",
                    borderTop: gi > 0 ? `1px solid ${BORDER}` : "none",
                  }}>
                    {group.name}
                  </div>
                  {group.rows.map((row, ri) => (
                    <div key={ri} className="matrix-row" style={{
                      display: "grid", gridTemplateColumns: "minmax(200px, 1fr) 90px 90px 90px 90px",
                      padding: "12px 20px", gap: 12, alignItems: "center",
                      borderTop: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: TEXT4, display: "flex" }}>
                          {IconMap[row.icon] || <Check size={13} />}
                        </span>
                        <span style={{ fontSize: 12.5, color: TEXT, fontWeight: 500 }}>{row.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>{renderFeatureCell(row.free)}</div>
                      <div style={{ display: "flex", justifyContent: "center" }}>{renderFeatureCell(row.maker)}</div>
                      <div style={{ display: "flex", justifyContent: "center",
                        background: "rgba(99,102,241,0.03)", borderRadius: 4, padding: "4px 0",
                      }}>{renderFeatureCell(row.pro)}</div>
                      <div style={{ display: "flex", justifyContent: "center" }}>{renderFeatureCell(row.studio)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ S6 — System behavior ════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 44px",
          }}>
            {t.s6_title}
          </h2>

          {(t.s6_steps as Array<{title: string; desc: string}>).map((step, i) => (
            <div key={i} style={{
              display: "flex", gap: 20, marginBottom: i < 2 ? 32 : 0,
              position: "relative",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${[ACCENT, GREEN, INDIGO][i]}12`,
                border: `1px solid ${[ACCENT, GREEN, INDIGO][i]}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: [ACCENT, GREEN, INDIGO][i],
              }}>
                {i + 1}
              </div>
              {i < 2 && (
                <div style={{
                  position: "absolute", left: 15, top: 36, width: 1, height: "calc(100% - 4px)",
                  background: `linear-gradient(to bottom, ${[ACCENT, GREEN][i]}22, transparent)`,
                }} />
              )}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: "0 0 4px" }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: TEXT3, lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═════════════════════════════════════════════════════════ */}
      <section style={{
        background: BG2, padding: "clamp(64px,8vw,96px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(20px,2.3vw,26px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "0 0 32px",
          }}>
            {t.faq_title}
          </h2>

          {(t.faqs as Array<{q: string; a: string}>).map((faq, i) => (
            <div key={i} style={{
              borderBottom: `1px solid ${BORDER}`,
              paddingBottom: 18, marginBottom: 18,
            }}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: F, fontSize: 14, fontWeight: 600, color: TEXT,
                  padding: 0, textAlign: "left",
                }}
              >
                {faq.q}
                <ChevronDown size={14} style={{
                  color: TEXT3, flexShrink: 0, marginLeft: 12,
                  transform: expandedFaq === i ? "rotate(180deg)" : "none",
                  transition: `transform 0.25s ${EASE}`,
                }} />
              </button>
              <div style={{
                maxHeight: expandedFaq === i ? 300 : 0,
                overflow: "hidden",
                transition: `max-height 0.3s ${EASE}`,
              }}>
                <p style={{
                  fontSize: 13, color: TEXT2, lineHeight: 1.65,
                  margin: "12px 0 0",
                }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Trust ═══════════════════════════════════════════════════════ */}
      <section style={{ padding: "36px 24px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 840, margin: "0 auto", display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
          {(t.trust as string[]).map((badge, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT3 }}>
              <Shield size={13} style={{ color: GREEN, opacity: 0.75 }} />
              {badge}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ S7 — Final CTA ══════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(72px,9vw,100px) 24px",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 800,
            letterSpacing: "-0.04em", margin: "0 0 28px", lineHeight: 1.15,
          }}>
            {t.s7_title}
          </h2>
          <button onClick={() => navigate("/signup")} style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 38px", borderRadius: 10,
            background: "#fff", color: "#000", border: "none",
            cursor: "pointer", transition: `all 0.25s ${EASE}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {t.s7_cta} <ArrowRight size={15} />
          </button>
          <p style={{ fontSize: 11.5, color: TEXT3, marginTop: 14, lineHeight: 1.5 }}>
            {t.s7_sub}
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "28px 24px" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.20)" }}>{t.footer_copy}</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_privacy}</Link>
            <Link to="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", textDecoration: "none" }}>{t.footer_terms}</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Mobile ──────────────────────────────────── */
        @media (max-width: 768px) {
          .s2-grid { grid-template-columns: 1fr !important; }
          .plans-stack .plan-row {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
          .plans-stack .plan-row button {
            width: 100%;
          }
          .scenario-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .credits-head, .credits-row {
            grid-template-columns: 1fr 70px 70px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
          .matrix-head, .matrix-row {
            grid-template-columns: minmax(140px, 1fr) 60px 60px 60px 60px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            gap: 6px !important;
          }
        }

        /* ── Tablet ──────────────────────────────────── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .plans-stack .plan-row {
            grid-template-columns: 180px 1fr !important;
          }
          .plans-stack .plan-row button {
            grid-column: span 2;
            width: 100%;
          }
        }

        /* ── Hover ───────────────────────────────────── */
        @media (hover: hover) {
          .s2-card:hover { border-color: ${BORDER2} !important; }
          .plan-row:not(:has(button:hover)):hover { border-color: ${BORDER2} !important; }
          .scenario-row:hover { border-color: ${BORDER2} !important; }
        }
      `}</style>
    </div>
  );
};

export default Pricing;
