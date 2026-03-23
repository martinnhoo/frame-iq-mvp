// v8.4 — ux credibility overhaul 2026-03-23
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

// ─── Types & Translations ────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_how: "How it works", nav_for: "Who it's for", nav_pricing: "Pricing", nav_signin: "Sign in", nav_cta: "Try free for 1 day",
    hero_badge: "THE AI THAT KNOWS YOUR AD ACCOUNT",
    hero_h1: "Stop burning budget.\nStart scaling what works.",
    hero_sub: "Connect Meta Ads. The AI reads your account and answers with your real data.",
    hero_cta: "Try free for 1 day", hero_see: "See it in action",
    hero_fine: "1-day free trial · No charge for 24h · Cancel anytime",
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
    how_s1_title: "Connect your ad accounts", how_s1_desc: "Link Meta, TikTok, or Google Ads in one click. AdBrief reads your real campaign data — spend, CTR, CPM, creative performance — in real time.",
    how_s2_title: "Set up your account", how_s2_desc: "Create an account for each brand or client. Add website, description, and connect Meta Ads — the AI uses this context for every answer.",
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
    pricing_label: "PRICING", pricing_h2: "Start with a free day. Stay because it works.",
    pricing_sub: "Every plan includes a 1-day free trial. No charge until it's over.",
    pricing_cta: "Start free trial", pricing_note: "1 day trial · Cancel anytime",
    plan_badge_pro: "Most popular",
    plan_maker_f0: "50 AI messages / day", plan_maker_f1: "1 ad account", plan_maker_f2: "Basic tools", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 AI messages / day", plan_pro_f1: "3 ad accounts", plan_pro_f2: "All tools unlocked", plan_pro_f3: "Unlimited brands", plan_pro_f4: "Multi-market",
    plan_studio_f0: "Unlimited AI messages", plan_studio_f1: "Unlimited ad accounts", plan_studio_f2: "All tools unlocked", plan_studio_f3: "Unlimited brands", plan_studio_f4: "Agency workspace",
    faq_label: "FAQ", faq_h2: "Common questions",
    faq_q0: "How does the 1-day free trial work?", faq_a0: "When you sign up for any plan, you get full access for 24 hours at no charge. If you cancel within that period, you won't be billed.",
    faq_q1: "Why do I need a card to start?", faq_a1: "Requiring a card filters for serious users and lets us give you genuine full access. We don't charge anything for 24 hours.",
    faq_q2: "What does AdBrief connect to?", faq_a2: "Meta Ads, TikTok Ads, and Google Ads. Once connected, AdBrief reads your campaign data in real time.",
    faq_q3: "Is my data secure?", faq_a3: "Yes. We use OAuth — the same standard used by every major ad tool. We never store your credentials. Tokens are encrypted at rest.",
    faq_q4: "Can I use it for multiple clients?", faq_a4: "Yes. Pro supports 3 ad accounts, Studio unlimited. Most agencies use one persona per brand.",
    faq_q5: "What is an Account?", faq_a5: "An Account is a brand profile connected to its own Meta Ads data. The AI uses this context to personalize every answer.",
    faq_q6: "Works with catalog ads?", faq_a6: "Yes. AdBrief reads all campaign types from Meta — including DPA, catalog, and Advantage+ Shopping.",
    faq_q7: "What if it doesn't work?", faq_a7: "Cancel within 24h and you won't be charged. On a paid plan, email us — we handle refunds case by case.",
    final_label: "START TODAY", final_h2: "Your ad account is full of insights.\nStart asking.",
    final_sub: "Connect in 2 minutes. Cancel anytime.",
    final_cta: "Try free for 1 day", final_fine: "Any plan · 1-day free trial · Cancel before 24h, pay nothing",
    footer_copy: "© 2026 AdBrief",
  },
  pt: {
    nav_how: "Como funciona", nav_for: "Para quem", nav_pricing: "Preços", nav_signin: "Entrar", nav_cta: "Testar grátis por 1 dia",
    hero_badge: "IA QUE CONHECE SUA CONTA DE ANÚNCIOS",
    hero_h1: "Pare de queimar verba.\nEscale o que funciona.",
    hero_sub: "Conecte o Meta Ads. A IA lê sua conta e responde com seus dados reais.",
    hero_cta: "Testar grátis por 1 dia", hero_see: "Ver na prática",
    hero_fine: "1 dia grátis · Sem cobrança por 24h · Cancele quando quiser",
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
    how_label: "COMO FUNCIONA", how_h2: "Três passos. Zero fricção.",
    how_sub: "Sem CSV. Sem entrada manual. Conecte e pergunte.",
    how_s1_title: "Conecte suas contas", how_s1_desc: "Vincule Meta, TikTok ou Google Ads com um clique. O AdBrief lê seus dados reais de campanha em tempo real.",
    how_s2_title: "Configure sua conta", how_s2_desc: "Crie uma conta para cada marca. Adicione site, descrição e conecte o Meta Ads — a IA usa esse contexto.",
    how_s3_title: "Pergunte qualquer coisa.", how_s3_desc: "Converse como no ChatGPT — mas o AdBrief conhece sua conta. Pergunte o que funciona, o que cortar, o que produzir.",
    for_label: "PARA QUEM", for_h2: "Feito para equipes de performance.",
    for_tab0: "Agências", for_tab1: "Gestores de Tráfego", for_tab2: "Times Internos",
    for_h0: "Gerencie 10 clientes como se tivesse um time de dados.", for_d0: "O AdBrief conecta à conta de cada cliente e dá respostas reais — quais criativos escalar, quais pausar, o que briefar.",
    for_h1: "Pare de decidir no escuro.", for_d1: "AdBrief te dá respostas baseadas em dados — qual formato underperforma, qual hook vence, o que briefar.",
    for_h2b: "Suas campanhas finalmente conectadas.", for_d2: "Conecte as contas e dê ao time acesso a uma IA que conhece seu histórico de performance.",
    for_cta: "Começar grátis",
    for_p0_0: "Contas por cliente com Meta Ads", for_p0_1: "Performance em tempo real", for_p0_2: "Brief calibrado por marca", for_p0_3: "IA que aprende cada cliente",
    for_p1_0: "Dados reais em cada resposta", for_p1_1: "Detecção de padrões", for_p1_2: "Análise de concorrentes", for_p1_3: "Memória que melhora",
    for_p2_0: "Conectado aos dados reais", for_p2_1: "Contas por produto", for_p2_2: "Contexto de marca integrado", for_p2_3: "Inteligência compartilhada",
    tools_label: "FERRAMENTAS", tools_h2: "Tudo para escalar.",
    tools_sub: "Cada ferramenta conectada aos seus dados. Sem copiar e colar.",
    ba_label: "ANTES VS DEPOIS", ba_h2: "O que muda quando a IA conhece sua conta.",
    ba_before_label: "Antes do AdBrief", ba_after_label: "Com AdBrief",
    ba_1_before: "Exportar CSV do Meta toda segunda", ba_1_after: "Pergunte: \"O que corrigir essa semana?\" — 10s",
    ba_2_before: "Comparar CTR de 20 conjuntos manualmente", ba_2_after: "\"Quais anúncios estão underperformando?\" — instantâneo",
    ba_3_before: "Adivinhar por que o ROAS caiu", ba_3_after: "\"Por que o ROAS caiu?\" — diagnóstico específico",
    ba_4_before: "Escrever hooks do zero, sem dados", ba_4_after: "\"5 hooks baseados nos meus melhores criativos\"",
    pricing_label: "PREÇOS", pricing_h2: "Comece com um dia grátis. Fique porque funciona.",
    pricing_sub: "Todo plano inclui 1 dia de teste. Sem cobrança enquanto durar.",
    pricing_cta: "Começar teste grátis", pricing_note: "1 dia de teste · Cancele quando quiser",
    plan_badge_pro: "Mais popular",
    plan_maker_f0: "50 mensagens / dia", plan_maker_f1: "1 conta de anúncios", plan_maker_f2: "Ferramentas básicas", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 mensagens / dia", plan_pro_f1: "3 contas conectadas", plan_pro_f2: "Todas as ferramentas", plan_pro_f3: "Marcas ilimitadas", plan_pro_f4: "Multi-mercado",
    plan_studio_f0: "Mensagens ilimitadas", plan_studio_f1: "Contas ilimitadas", plan_studio_f2: "Todas as ferramentas", plan_studio_f3: "Marcas ilimitadas", plan_studio_f4: "Workspace agência",
    faq_label: "PERGUNTAS FREQUENTES", faq_h2: "Dúvidas comuns",
    faq_q0: "Como funciona o teste grátis?", faq_a0: "Ao se cadastrar, você tem acesso completo por 24h sem cobrança. Cancele dentro desse período e não será cobrado.",
    faq_q1: "Por que preciso de cartão?", faq_a1: "Filtra usuários sérios e te dá acesso genuíno. Não cobramos nada em 24h.",
    faq_q2: "O que conecta?", faq_a2: "Meta Ads, TikTok Ads e Google Ads. Lê seus dados em tempo real.",
    faq_q3: "Meus dados são seguros?", faq_a3: "Sim. Usamos OAuth. Nunca armazenamos suas credenciais. Tokens criptografados.",
    faq_q4: "Posso usar para vários clientes?", faq_a4: "Sim. Pro: 3 contas. Studio: ilimitado. A maioria usa uma persona por marca.",
    faq_q5: "O que é uma Conta?", faq_a5: "Um perfil de marca conectado ao Meta Ads. A IA usa esse contexto em cada resposta.",
    faq_q6: "Funciona com catálogo?", faq_a6: "Sim. Lê todos os tipos de campanha — DPA, catálogo, Advantage+.",
    faq_q7: "E se não funcionar?", faq_a7: "Cancele em 24h, sem cobrança. Em plano pago, mande email — resolvemos caso a caso.",
    final_label: "COMECE HOJE", final_h2: "30 segundos para conectar.\nSua conta tem as respostas.",
    final_sub: "Conecte em 2 minutos. Cancele quando quiser.",
    final_cta: "Testar grátis por 1 dia", final_fine: "Qualquer plano · 1 dia grátis · Cancele antes de 24h",
    footer_copy: "© 2026 AdBrief",
  },
  es: {
    nav_how: "Cómo funciona", nav_for: "Para quién", nav_pricing: "Precios", nav_signin: "Iniciar sesión", nav_cta: "Probar gratis 1 día",
    hero_badge: "LA IA QUE CONOCE TU CUENTA DE ANUNCIOS",
    hero_h1: "Deja de quemar presupuesto.\nEscala lo que funciona.",
    hero_sub: "Conecta Meta Ads. La IA lee tu cuenta y responde con tus datos reales.",
    hero_cta: "Probar gratis 1 día", hero_see: "Verlo en acción",
    hero_fine: "1 día gratis · Sin cobro por 24h · Cancela cuando quieras",
    stat_1: "$2.4M+", stat_1_label: "Budget analizado",
    stat_2: "34,000+", stat_2_label: "Hooks generados",
    stat_3: "4.8", stat_3_label: "Valoración media",
    stat_4: "+22%", stat_4_label: "Mejora de ROAS",
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
    how_s1_title: "Conecta tus cuentas", how_s1_desc: "Vincula Meta, TikTok o Google Ads con un clic. AdBrief lee tus datos reales en tiempo real.",
    how_s2_title: "Configura tu cuenta", how_s2_desc: "Crea una cuenta por marca. Agrega sitio web, descripción y conecta Meta Ads.",
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
    pricing_label: "PRECIOS", pricing_h2: "Empieza gratis. Quédate porque funciona.",
    pricing_sub: "Todos incluyen 1 día gratis. Sin cargo hasta que termine.",
    pricing_cta: "Empezar prueba gratis", pricing_note: "1 día de prueba · Cancela cuando quieras",
    plan_badge_pro: "Más popular",
    plan_maker_f0: "50 mensajes / día", plan_maker_f1: "1 cuenta de anuncios", plan_maker_f2: "Herramientas básicas", plan_maker_f3: "1 workspace",
    plan_pro_f0: "200 mensajes / día", plan_pro_f1: "3 cuentas conectadas", plan_pro_f2: "Todas las herramientas", plan_pro_f3: "Marcas ilimitadas", plan_pro_f4: "Multi-mercado",
    plan_studio_f0: "Mensajes ilimitados", plan_studio_f1: "Cuentas ilimitadas", plan_studio_f2: "Todas las herramientas", plan_studio_f3: "Marcas ilimitadas", plan_studio_f4: "Workspace agencia",
    faq_label: "PREGUNTAS FRECUENTES", faq_h2: "Preguntas comunes",
    faq_q0: "¿Cómo funciona la prueba gratis?", faq_a0: "Al registrarte, tienes acceso completo por 24h sin cargo. Cancela y no se te cobra.",
    faq_q1: "¿Por qué necesito tarjeta?", faq_a1: "Filtra usuarios serios y te da acceso completo. No cobramos nada en 24h.",
    faq_q2: "¿A qué se conecta?", faq_a2: "Meta Ads, TikTok Ads y Google Ads. Lee tus datos en tiempo real.",
    faq_q3: "¿Mis datos son seguros?", faq_a3: "Sí. OAuth + tokens cifrados. Nunca almacenamos credenciales.",
    faq_q4: "¿Puedo usar para varios clientes?", faq_a4: "Sí. Pro: 3 cuentas. Studio: ilimitado.",
    faq_q5: "¿Qué es una Cuenta?", faq_a5: "Un perfil de marca conectado a Meta Ads. La IA personaliza cada respuesta.",
    faq_q6: "¿Funciona con catálogo?", faq_a6: "Sí. Todos los tipos de campaña de Meta — DPA, catálogo, Advantage+.",
    faq_q7: "¿Si no funciona?", faq_a7: "Cancela en 24h, sin cargo. En plan pago, escríbenos.",
    final_label: "EMPIEZA HOY", final_h2: "Tu cuenta está llena de insights.\nEmpieza a preguntar.",
    final_sub: "Conéctate en 2 minutos. Cancela cuando quieras.",
    final_cta: "Probar gratis 1 día", final_fine: "Cualquier plan · 1 día gratis · Cancela antes de 24h",
    footer_copy: "© 2026 AdBrief",
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
    default: "transparent",
    subtle:  "#0f1117",
    dark:    "#080a0f",
    accent:  "#0c1220",
  };
  return (
    <section
      id={id}
      className={className}
      style={noPadding
        ? { background: bgMap[bg] || "transparent" }
        : { padding: "clamp(56px,6vw,96px) clamp(20px,4vw,40px)", background: bgMap[bg] || "transparent" }
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
      pt: ['"Você pagou R$90/clique e nem sabe por quê."', '"3 dos seus 4 anúncios têm ROAS abaixo de 1x agora."', '"Seu melhor criativo parou há 9 dias. O concorrente está escalando."'],
      es: ['"Pagaste $90/clic y no sabes por qué."', '"3 de tus 4 anuncios tienen ROAS bajo 1x ahora."', '"Tu mejor creativo lleva 9 días pausado. El competidor está escalando."'],
      en: ['"You\'re paying $90/click and don\'t know why."', '"3 of your 4 top ads have ROAS below 1x right now."', '"Your best creative is paused 9 days. A competitor is scaling it."'],
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
      pt: ["[GANCHO] Você está investindo em tráfego e não sabe o que está funcionando?", "[DESENVOLVIMENTO] A maioria dos gestores descobre tarde demais...", "[CTA] Conecte sua conta agora. 30 segundos. Sem CSV."],
      es: ["[GANCHO] ¿Estás invirtiendo en tráfico y no sabes qué funciona?", "[DESARROLLO] La mayoría de los gestores descubre demasiado tarde...", "[CTA] Conecta tu cuenta ahora. 30 segundos. Sin CSV."],
      en: ["[HOOK] Spending on ads and not knowing what's working?", "[BODY] Most media buyers find out too late...", "[CTA] Connect your account now. 30 seconds. No CSV."],
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
function Nav({ onCTA, t, lang, setLang }: { onCTA: () => void; t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void }) {
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
          <button onClick={onCTA}
            style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: '9px 20px', borderRadius: 9, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
            {lang === 'pt' ? 'Começar grátis' : lang === 'es' ? 'Comenzar gratis' : 'Start for free'}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Demo conversations data ──────────────────────────────────────────────────
// ─── Industries for demo ──────────────────────────────────────────────────────
const INDUSTRIES_DEMO = [
  { id: "igaming",  emoji: "🎰", label: { pt: "iGaming",     es: "iGaming",     en: "iGaming"    }, color: "#a78bfa", initial: "E" },
  { id: "ecomm",    emoji: "🛍️", label: { pt: "E-commerce",  es: "E-commerce",  en: "E-commerce" }, color: "#0ea5e9", initial: "L" },
  { id: "fitness",  emoji: "💪", label: { pt: "Fitness",     es: "Fitness",     en: "Fitness"    }, color: "#34d399", initial: "F" },
  { id: "finance",  emoji: "💸", label: { pt: "Finanças",    es: "Finanzas",    en: "Finance"    }, color: "#fbbf24", initial: "W" },
  { id: "saas",     emoji: "⚡", label: { pt: "SaaS / Tech", es: "SaaS / Tech", en: "SaaS / Tech"}, color: "#60a5fa", initial: "S" },
];

const INDUSTRY_ACCOUNTS: Record<string, Record<Lang, { name: string; meta: string; campaigns: string }>> = {
  igaming:  { pt:{name:"Duck Bet",   meta:"Meta · 18 campanhas"}, es:{name:"Duck Bet MX",      meta:"Meta · 22 campañas"},    en:{name:"BetCore US",   meta:"Meta · 31 campaigns"} } as any,
  ecomm:    { pt:{name:"Loja Verde",     meta:"Meta · 41 campanhas"}, es:{name:"ModaRápida MX", meta:"Meta · 38 campañas"},    en:{name:"ShopFlow",     meta:"Meta · 29 campaigns"} } as any,
  fitness:  { pt:{name:"FitCore Brasil", meta:"Meta · 22 campanhas"}, es:{name:"FitMex",        meta:"Meta · 17 campañas"},    en:{name:"FitCore US",   meta:"Meta · 22 campaigns"} } as any,
  finance:  { pt:{name:"WealthBR",       meta:"Meta · 14 campanhas"}, es:{name:"FinMex Pro",    meta:"Meta · 11 campañas"},    en:{name:"WealthApp",    meta:"Meta · 19 campaigns"} } as any,
  saas:     { pt:{name:"StartupAI",      meta:"Meta · 9 campanhas"},  es:{name:"TechStart MX",  meta:"Meta · 8 campañas"},     en:{name:"SaaSBoost",    meta:"Meta · 12 campaigns"} } as any,
};

const DEMO_QA_BY_INDUSTRY: Record<string, Record<Lang, Array<{ q: string; lines: string[] }>>> = {
  igaming: {
    pt: [
      { q: "Meu ROAS caiu 40% essa semana. O que aconteceu?", lines: ["Identifiquei 3 causas na sua conta:","**Fadiga criativa** — Ad_042 roda há 22 dias. Hook rate: 31% → 11%.","**Frequência 4.8x** — BR-Homens-25-34 saturado. CPM +38%.","Fix: pause Ad_042, relance Ad_019 (ROAS 3.2x, parado 9 dias)."] },
      { q: "Quais anúncios devo pausar agora?", lines: ["3 anúncios para cortar hoje:","**Ad_038** — CPM R$91, CTR 0,4%, zero depósitos em 7 dias.","**Ad_029** — hook rate 8%. 92% saem em 3 segundos.","Pausar libera R$620/dia → redirecionar para Ad_019 (ROAS 3.2x)."] },
      { q: "Escreve 3 hooks para o meu melhor público de iGaming.", lines: ["Dos seus top converters (hook rate 34%):", '"Você apostou R$50 e perdeu? Veja o que os vencedores fazem diferente."', '"Esse app pagou R$847 pra mim essa semana só apostando no celular."', '"Por que 92% dos apostadores perdem? Essa estratégia muda tudo."'] },
    ],
    es: [
      { q: "Mi ROAS bajó 40% esta semana. ¿Qué pasó?", lines: ["Identifiqué 3 causas en tu cuenta:","**Fatiga creativa** — Ad_042 lleva 22 días. Hook rate: 31% → 11%.","**Frecuencia 4.8x** — MX-Hombres-25-34 saturado. CPM +38%.","Fix: pausa Ad_042, relanza Ad_019 (ROAS 3.2x, pausado 9 días)."] },
      { q: "¿Cuáles anuncios pausar ahora mismo?", lines: ["3 anuncios para cortar hoy:","**Ad_038** — $18 CPM, 0.4% CTR, cero depósitos en 7 días.","**Ad_029** — 8% hook rate. 92% se van en 3 segundos.","Pausar libera $620/día → redirigir a Ad_019 (ROAS 3.2x)."] },
      { q: "Escribe 3 hooks para mi mejor público de iGaming.", lines: ["De tus top converters (hook rate 34%):","\"¿Apostaste $50 y perdiste? Mira lo que hacen diferente los ganadores.\"","\"Esta app me pagó $847 esta semana solo apostando en el celular.\"","\"¿Por qué el 92% de apostadores pierde? Esta estrategia cambia todo.\""] },
    ],
    en: [
      { q: "My ROAS dropped 40% this week. What happened?", lines: ["Found 3 causes in your account:","**Creative fatigue** — Ad_042 running 22 days. Hook rate: 31% → 11%.","**Frequency 4.8x** — US-Men-25-34 saturated. CPM +38%.","Fix: pause Ad_042, relaunch Ad_019 (ROAS 3.2x, paused 9 days)."] },
      { q: "Which ads should I pause right now?", lines: ["3 ads to cut today:","**Ad_038** — $18 CPM, 0.4% CTR, zero deposits in 7 days.","**Ad_029** — 8% hook rate. 92% leave in first 3 seconds.","Pausing frees $620/day → redirect to Ad_019 (ROAS 3.2x)."] },
      { q: "Write 3 hooks for my best iGaming audience.", lines: ["From your top converters (hook rate 34%):","\"You bet $50 and lost? See what winners do differently.\"","\"This app paid me $847 last week just betting on my phone.\"","\"Why do 92% of bettors lose? This strategy changes everything.\""] },
    ],
  },
  ecomm: {
    pt: [
      { q: "Quais produtos estão com ROAS abaixo do esperado?", lines: ["Analisei 41 campanhas. 3 categorias críticas:","**Calçados femininos** — ROAS 0.8x, CPM R$48. Pausar hoje.","**Bolsas premium** — CTR 0.3%. Criativo muito genérico.","**Recomendação:** escale Eletrônicos (ROAS 4.1x, margem boa)."] },
      { q: "Qual anúncio devo escalar agora?", lines: ["Ad_Eletro_07 — ROAS 4.1x, CTR 2.8%, hook rate 38%.","Está com orçamento R$80/dia. Pode ir para R$300 sem risco.","Público BR-Homens-30-45 tem espaço — frequência ainda em 1.2x.","Recomendo +R$200/dia por 3 dias e monitore o CPM."] },
      { q: "Escreve 3 hooks de e-commerce para o público BR.", lines: ["Baseado nos seus top converters:","\"Frete grátis hoje? Descubra as 3 marcas que ainda oferecem.\"","\"Todo mundo comprou isso essa semana — e ainda não chegou pra você.\"","\"R$150 de desconto só até meia-noite. 847 pessoas compraram hoje.\""] },
    ],
    es: [
      { q: "¿Qué productos tienen ROAS por debajo de lo esperado?", lines: ["Analicé 38 campañas. 3 categorías críticas:","**Calzado femenino** — ROAS 0.8x, CPM $48. Pausar hoy.","**Bolsos premium** — CTR 0.3%. Creativo muy genérico.","**Recomendación:** escala Electrónica (ROAS 4.1x, buen margen)."] },
      { q: "¿Cuál anuncio escalar ahora?", lines: ["Ad_Electro_07 — ROAS 4.1x, CTR 2.8%, hook rate 38%.","Presupuesto actual $80/día. Puede ir a $300 sin riesgo.","Público MX-Hombres-30-45 tiene espacio — frecuencia en 1.2x.","Recomiendo +$200/día por 3 días y monitorea el CPM."] },
      { q: "Escribe 3 hooks de e-commerce para México.", lines: ["Basado en tus top converters:","\"¿Envío gratis hoy? Descubre las 3 marcas que aún lo ofrecen.\"","\"Todo México compró esto esta semana — y todavía no llegó a ti.\"","\"$150 de descuento solo hasta medianoche. 847 personas compraron hoy.\""] },
    ],
    en: [
      { q: "Which products have ROAS below target?", lines: ["Analyzed 29 campaigns. 3 critical categories:","**Women's shoes** — ROAS 0.8x, $48 CPM. Pause today.","**Premium bags** — CTR 0.3%. Creative too generic.","**Recommendation:** scale Electronics (ROAS 4.1x, good margin)."] },
      { q: "Which ad should I scale right now?", lines: ["Ad_Electro_07 — ROAS 4.1x, CTR 2.8%, hook rate 38%.","Current budget $80/day. Can go to $300 safely.","US-Men-30-45 has room — frequency still at 1.2x.","Recommend +$200/day for 3 days and monitor CPM."] },
      { q: "Write 3 e-commerce hooks for the US market.", lines: ["From your top converters:","\"Free shipping today? Discover the 3 brands still offering it.\"","\"Everyone bought this week — and it hasn't reached you yet.\"","\"$150 off until midnight only. 847 people bought today.\""] },
    ],
  },
  fitness: {
    pt: [
      { q: "Meu ROAS caiu 40% essa semana. O que está acontecendo?", lines: ["Identifiquei 3 causas na sua conta:","**Fadiga criativa** — Creative_042 roda há 22 dias. Hook rate: 31% → 11%.","**Frequência 4.8x** — BR-Mulheres-25-34 saturado. CPM +38%.","Fix: pause Creative_042, relance Creative_019 (ROAS 3.2x, parado 9 dias)."] },
      { q: "Quais anúncios devo pausar agora?", lines: ["3 anúncios para cortar hoje:","**Creative_038** — CPM R$91, CTR 0,4%, zero conversões em 7 dias.","**Creative_029** — hook rate 8%. 92% saem em 3 segundos.","Pausar libera R$620/dia → redirecionar para Creative_019 (ROAS 3.2x)."] },
      { q: "Escreve 3 hooks dos meus melhores criativos de fitness.", lines: ["Dos seus top converters (hook rate 34%, ROAS 3.1x+):","\"Você paga R$90/clique e não sabe por quê. Seus dados têm a resposta.\"","\"3 dos 4 anúncios que mais gastam têm ROAS abaixo de 1x agora.\"","\"Seu melhor criativo está parado há 9 dias. O concorrente está escalando.\""] },
    ],
    es: [
      { q: "Mi ROAS bajó 40% esta semana. ¿Qué está pasando?", lines: ["Identifiqué 3 causas en tu cuenta:","**Fatiga creativa** — Creative_042 lleva 22 días. Hook rate: 31% → 11%.","**Frecuencia 4.8x** — MX-Mujeres-25-34 saturado. CPM +38%.","Fix: pausa Creative_042, relanza Creative_019 (ROAS 3.2x, pausado 9 días)."] },
      { q: "¿Cuáles anuncios pausar ahora mismo?", lines: ["3 anuncios para cortar hoy:","**Creative_038** — $18 CPM, 0.4% CTR, cero conversiones en 7 días.","**Creative_029** — 8% hook rate. 92% se van en 3 segundos.","Pausar libera $620/día → redirigir a Creative_019 (ROAS 3.2x)."] },
      { q: "Escribe 3 hooks de fitness para México.", lines: ["De tus top converters (hook rate 34%):","\"Pagás $90/clic y no sabés por qué. Tus datos tienen la respuesta.\"","\"3 de tus 4 anuncios top gastan con ROAS bajo 1x ahora.\"","\"Tu mejor creativo lleva 9 días pausado. Un competidor lo está escalando.\""] },
    ],
    en: [
      { q: "My ROAS dropped 40% this week. What's happening?", lines: ["Found 3 causes in your account:","**Creative fatigue** — Creative_042 running 22 days. Hook rate: 31% → 11%.","**Frequency 4.8x** — US-Women-25-34 saturated. CPM +38%.","Fix: pause Creative_042, relaunch Creative_019 (ROAS 3.2x, paused 9 days)."] },
      { q: "Which ads should I pause right now?", lines: ["3 ads to cut today:","**Creative_038** — $18 CPM, 0.4% CTR, zero conversions in 7 days.","**Creative_029** — 8% hook rate. 92% leave in first 3 seconds.","Pausing frees $620/day → redirect to Creative_019 (ROAS 3.2x)."] },
      { q: "Write 3 hooks from my best fitness creatives.", lines: ["From your top converters (hook rate 34%, ROAS 3.1x+):","\"You're paying $90/click and don't know why. Your data has the answer.\"","\"3 of your 4 top-spend ads have ROAS below 1x right now.\"","\"Your best creative is paused 9 days. A competitor is scaling it.\""] },
    ],
  },
  finance: {
    pt: [
      { q: "Meu CPL está 3x acima do esperado. Por quê?", lines: ["Analisei 14 campanhas. Problema claro:","**Landing page** — taxa de clique pós-lead caiu 68% vs semana passada.","**Público frio** — BR-Todos-18-65 gastando R$340/dia sem retorno.","Recomendação: pause público amplo, escale BR-Homens-35-55 (CPL R$12)."] },
      { q: "Qual anúncio de finanças está performando melhor?", lines: ["Ad_Invest_03 está destruindo tudo:","ROAS 5.1x, CPL R$9.40, hook rate 41% — muito acima da conta.","Público: BR-Homens-35-55, renda alta. Frequência 1.8x — tem espaço.","Escale para R$500/dia. Potencial de R$2.500 de retorno/dia."] },
      { q: "Escreve 3 hooks de finanças que convertem.", lines: ["Baseado nos seus melhores anúncios:","\"O Banco Central mudou as regras e 94% dos brasileiros não sabem ainda.\"","\"Esse tipo de investimento rendeu 180% em 2024 — e você nunca ouviu falar.\"","\"Quanto você perdeu esse mês por não saber isso sobre o CDI?\""] },
    ],
    es: [
      { q: "Mi CPL está 3x por encima del esperado. ¿Por qué?", lines: ["Analicé 11 campañas. Problema claro:","**Landing page** — tasa de conversión post-lead cayó 68%.","**Público frío** — MX-Todos-18-65 gastando $340/día sin retorno.","Recomendación: pausa público amplio, escala MX-Hombres-35-55 (CPL $12)."] },
      { q: "¿Qué anuncio de finanzas está rindiendo mejor?", lines: ["Ad_Invest_03 está dominando:","ROAS 5.1x, CPL $9.40, hook rate 41% — muy por encima de la cuenta.","Público: MX-Hombres-35-55, ingreso alto. Frecuencia 1.8x — hay espacio.","Escala a $500/día. Potencial de $2,500 de retorno/día."] },
      { q: "Escribe 3 hooks de finanzas que conviertan.", lines: ["Basado en tus mejores anuncios:","\"El Banco de México cambió las reglas y el 94% de los mexicanos no lo sabe.\"","\"Este tipo de inversión rindió 180% en 2024 — y nunca lo escuchaste.\"","\"¿Cuánto perdiste este mes por no saber esto sobre los CETES?\""] },
    ],
    en: [
      { q: "My CPL is 3x above target. Why?", lines: ["Analyzed 19 campaigns. Clear problem:","**Landing page** — post-lead click rate dropped 68% vs last week.","**Cold audience** — US-All-18-65 spending $340/day with no return.","Recommendation: pause broad, scale US-Men-35-55 (CPL $12)."] },
      { q: "Which finance ad is performing best?", lines: ["Ad_Invest_03 is dominating:","ROAS 5.1x, CPL $9.40, hook rate 41% — far above account average.","Audience: US-Men-35-55, high income. Frequency 1.8x — room to grow.","Scale to $500/day. Potential $2,500 return/day."] },
      { q: "Write 3 finance hooks that convert.", lines: ["Based on your top ads:","\"The Fed changed the rules and 94% of Americans don't know yet.\"","\"This investment type returned 180% in 2024 — you've never heard of it.\"","\"How much did you lose this month by not knowing this about yield?\""] },
    ],
  },
  saas: {
    pt: [
      { q: "Meu CAC de SaaS está muito alto. O que fazer?", lines: ["Analisei 9 campanhas. Diagnóstico:","**Trial → paid** — conversão de 2.1% (benchmark: 8%). Problema no onboarding.","**Anúncios** — 3 campanhas com CPL R$180+. Pausar imediatamente.","Foque em remarketing de trial (CPL R$23, conversão 14x maior)."] },
      { q: "Qual campanha de SaaS devo escalar?", lines: ["Campanha_Remarketing_Trial está pronta pra escalar:","CPL R$23, trial-to-paid 11%, ROAS 6.8x — melhor da conta.","Orçamento atual R$40/dia. Pode ir para R$200 sem saturar.","Público: visitou pricing page + usou feature X. Expanda lookalike 1%."] },
      { q: "Escreve 3 hooks de SaaS para gestores.", lines: ["Dos seus top ads (hook rate 38%):","\"Seu time gasta 3 horas por dia em tarefas que essa IA faz em 4 minutos.\"","\"Testei 12 ferramentas de gestão. Só uma reduziu meu CAC em 60%.\"","\"Por que empresas como a sua ainda pagam R$8k/mês por algo que custa R$49?\""] },
    ],
    es: [
      { q: "Mi CAC de SaaS está muy alto. ¿Qué hacer?", lines: ["Analicé 8 campañas. Diagnóstico:","**Trial → paid** — conversión de 2.1% (benchmark: 8%). Problema en el onboarding.","**Anuncios** — 3 campañas con CPL $180+. Pausar inmediatamente.","Enfócate en remarketing de trial (CPL $23, conversión 14x mayor)."] },
      { q: "¿Qué campaña de SaaS escalar?", lines: ["Campaña_Remarketing_Trial lista para escalar:","CPL $23, trial-to-paid 11%, ROAS 6.8x — mejor de la cuenta.","Presupuesto actual $40/día. Puede ir a $200 sin saturar.","Público: visitó pricing page + usó feature X. Expande lookalike 1%."] },
      { q: "Escribe 3 hooks de SaaS para gerentes.", lines: ["De tus top ads (hook rate 38%):","\"Tu equipo gasta 3 horas al día en tareas que esta IA hace en 4 minutos.\"","\"Probé 12 herramientas de gestión. Solo una redujo mi CAC un 60%.\"","\"¿Por qué empresas como la tuya pagan $8k/mes por algo que cuesta $49?\""] },
    ],
    en: [
      { q: "My SaaS CAC is way too high. What should I do?", lines: ["Analyzed 12 campaigns. Diagnosis:","**Trial → paid** — 2.1% conversion (benchmark: 8%). Onboarding issue.","**Ads** — 3 campaigns with CPL $180+. Pause immediately.","Focus on trial remarketing (CPL $23, 14x higher conversion)."] },
      { q: "Which SaaS campaign should I scale?", lines: ["Campaign_Remarketing_Trial is ready to scale:","CPL $23, trial-to-paid 11%, ROAS 6.8x — best in account.","Current budget $40/day. Can go to $200 without saturating.","Audience: visited pricing page + used feature X. Expand lookalike 1%."] },
      { q: "Write 3 SaaS hooks for managers.", lines: ["From your top ads (hook rate 38%):","\"Your team spends 3 hours a day on tasks this AI handles in 4 minutes.\"","\"I tested 12 management tools. Only one reduced my CAC by 60%.\"","\"Why do companies like yours still pay $8k/month for something that costs $49?\""] },
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
      if (ci < qa.q.length) {
        timer.current = setTimeout(typeChar, ci < 3 ? 55 : Math.random() * 35 + 18);
      } else {
        setPhase('thinking');
        timer.current = setTimeout(streamAnswer, 900);
      }
    };

    // — stream answer lines —
    const streamAnswer = () => {
      setPhase('streaming');
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
      <p style={{ fontFamily: F, fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em', margin: '0 0 4px', textTransform: 'uppercase' as const, fontWeight: 600 }}>{label}</p>
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
          <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: '#fff', lineHeight: 1.45, margin: 0, flex: 1 }}>
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
        <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
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
              <span style={{ fontFamily: F, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
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
function MobileDemoCard({ onCTA, lang }: { onCTA: () => void; lang: Lang }) {
  const [active, setActive] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);

  const scenarios: Record<Lang, Array<{q: string; lines: Array<{text: string; accent?: boolean; highlight?: boolean}>}>> = {
    pt: [
      {
        q: "Meu ROAS caiu 40% essa semana. O que está acontecendo?",
        lines: [
          { text: "Identifiquei 3 causas na sua conta:" },
          { text: "Creative_042 roda há 22 dias — hook rate caiu de 31% → 11%.", highlight: true },
          { text: "BR-Mulheres-25-34 com frequência 4.8x. CPM subiu +38%." },
          { text: "Fix: pause Creative_042, relance Creative_019 (ROAS 3.2x).", accent: true },
        ]
      },
      {
        q: "Quais anúncios devo pausar agora?",
        lines: [
          { text: "3 anúncios para pausar hoje:" },
          { text: "Creative_038 — CPM R$91, CTR 0,4%, zero conversões em 7 dias.", highlight: true },
          { text: "Creative_029 — hook rate 8%. 92% saem em 3 segundos." },
          { text: "Pausar libera R$620/dia → redirecionar para Creative_019.", accent: true },
        ]
      },
      {
        q: "Escreve 3 hooks dos meus melhores criativos.",
        lines: [
          { text: "Dos seus top converters (hook rate 34%, ROAS 3.1x+):" },
          { text: "\"Você paga R$90/clique e não sabe por quê.\"", highlight: true },
          { text: "\"3 dos seus 4 anúncios têm ROAS abaixo de 1x agora.\"" },
          { text: "\"Seu melhor criativo está parado há 9 dias.\"", accent: true },
        ]
      },
    ],
    es: [
      {
        q: "Mi ROAS bajó 40% esta semana. ¿Qué pasó?",
        lines: [
          { text: "Identifiqué 3 causas en tu cuenta:" },
          { text: "Creative_042 lleva 22 días — hook rate cayó de 31% → 11%.", highlight: true },
          { text: "MX-Mujeres-25-34 con frecuencia 4.8x. CPM subió +38%." },
          { text: "Fix: pausa Creative_042, relanza Creative_019 (ROAS 3.2x).", accent: true },
        ]
      },
      {
        q: "¿Cuáles anuncios pausar ahora mismo?",
        lines: [
          { text: "3 anuncios para pausar hoy:" },
          { text: "Creative_038 — $18 CPM, 0.4% CTR, cero conversiones en 7 días.", highlight: true },
          { text: "Creative_029 — hook rate 8%. 92% se van en 3 segundos." },
          { text: "Pausar libera $620/día → redirigir a Creative_019.", accent: true },
        ]
      },
      {
        q: "Escribe 3 hooks de mis mejores creativos.",
        lines: [
          { text: "De tus top converters (hook rate 34%, ROAS 3.2x+):" },
          { text: "\"Pagás $90/clic y no sabés por qué.\"", highlight: true },
          { text: "\"3 de tus 4 anuncios top tienen ROAS bajo 1x ahora.\"" },
          { text: "\"Tu mejor creativo lleva 9 días pausado.\"", accent: true },
        ]
      },
    ],
    en: [
      {
        q: "My ROAS dropped 40% this week. What's happening?",
        lines: [
          { text: "Found 3 causes in your account:" },
          { text: "Creative_042 running 22 days — hook rate dropped 31% → 11%.", highlight: true },
          { text: "US-Women-25-34 at 4.8x frequency. CPM up +38%." },
          { text: "Fix: pause Creative_042, relaunch Creative_019 (ROAS 3.2x).", accent: true },
        ]
      },
      {
        q: "Which ads should I pause right now?",
        lines: [
          { text: "3 ads to pause today:" },
          { text: "Creative_038 — $18 CPM, 0.4% CTR, zero conversions in 7 days.", highlight: true },
          { text: "Creative_029 — hook rate 8%. 92% leave in first 3 seconds." },
          { text: "Pausing frees $620/day → redirect to Creative_019.", accent: true },
        ]
      },
      {
        q: "Write 3 hooks from my best creatives.",
        lines: [
          { text: "From your top converters (hook rate 34%, ROAS 3.1x+):" },
          { text: "\"You're paying $90/click and don't know why.\"", highlight: true },
          { text: "\"3 of your 4 top-spend ads have ROAS below 1x right now.\"" },
          { text: "\"Your best creative has been paused for 9 days.\"", accent: true },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: '-0.03em' }}>
              <span style={{ color: '#eef0f6' }}>ad</span><span style={{ color: '#38bdf8' }}>brief</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: F, fontSize: 10, color: 'rgba(52,211,153,0.9)', fontWeight: 600 }}>Meta</span>
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
            <button onClick={onCTA} style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: '#fff', color: '#000', border: 'none',
              fontFamily: F, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '-0.02em',
            }}>
              {lang === 'pt' ? 'Testar com minha conta' : lang === 'es' ? 'Probar con mi cuenta' : 'Try with my account'}
            </button>
          </div>

          <p style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            {lang === 'pt' ? 'Demo · com sua conta, usa dados reais' : lang === 'es' ? 'Demo · con tu cuenta, usa datos reales' : 'Demo · with your account, uses real data'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Immersive Hero ───────────────────────────────────────────────────────────
// ─── Immersive Hero ───────────────────────────────────────────────────────────
// ─── Immersive Hero v12 — mobile + uau 2026-03-24 ──────────────────────────
function ImmersiveHero({ onCTA, t, lang }: { onCTA: () => void; t: Record<string, string>; lang: Lang }) {
  const [activeIndustry, setActiveIndustry] = React.useState('fitness');
  const industry = INDUSTRIES_DEMO.find(i => i.id === activeIndustry) || INDUSTRIES_DEMO[2];
  const account = INDUSTRY_ACCOUNTS[activeIndustry]?.[lang] || INDUSTRY_ACCOUNTS.fitness[lang];
  const qa = DEMO_QA_BY_INDUSTRY[activeIndustry]?.[lang] || DEMO_QA_BY_INDUSTRY.fitness[lang];
  const { qi, phase, typedQ, lines, activeLine, jump } = useStreaming(lang, qa);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [lines, activeLine, phase]);

  const h1 = t.hero_h1 || '';
  const h1p = h1.split('\n');
  const conn = lang === 'pt' ? 'conectado' : lang === 'es' ? 'conectado' : 'connected';
  const ctabtn = lang === 'pt' ? 'Testar com minha conta' : lang === 'es' ? 'Probar con mi cuenta' : 'Try with my account';
  const note = lang === 'pt' ? 'Demo · Com sua conta, usa dados reais' : lang === 'es' ? 'Demo · Con tu cuenta, usa datos reales' : 'Demo · With your account, uses real data';

  // Nav items faithful to the real product
  const navMain = lang === 'pt'
    ? ['IA Chat','Contas','Análises']
    : lang === 'es'
    ? ['IA Chat','Cuentas','Análisis']
    : ['AI Chat','Accounts','Analytics'];
  const navTools = lang === 'pt'
    ? ['Gerador de Hooks','Script de Vídeo','Brief Criativo']
    : lang === 'es'
    ? ['Generador de Hooks','Script de Video','Brief Creativo']
    : ['Hook Generator','Video Script','Creative Brief'];
  const toolsLabel = lang === 'pt' ? 'FERRAMENTAS' : lang === 'es' ? 'HERRAMIENTAS' : 'TOOLS';
  const quickActions = lang === 'pt'
    ? ['O que pausar hoje?', 'Gerar hooks', 'Por que o ROAS caiu?', 'Resumo da semana']
    : lang === 'es'
    ? ['¿Qué pausar hoy?', 'Generar hooks', '¿Por qué bajó el ROAS?', 'Resumen de la semana']
    : ['What to pause today?', 'Generate hooks', 'Why did ROAS drop?', 'Weekly summary'];

  // Render AI response — clean text, no colored cards
  const renderAI = () => {
    if (phase === 'thinking') return <Dots />;
    if (phase !== 'streaming' && phase !== 'done') return null;
    const allLines = activeLine ? [...lines, activeLine] : lines;
    if (!allLines.length) return null;

    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <span style={{ fontFamily: F, fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>AB</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {allLines.map((line, i) => {
            const isAction = /^(Fix:|Ação:|Action:|Acción:|→)/i.test(line.replace(/\*\*/g, ''));
            const isLast = i === allLines.length - 1 && phase === 'streaming';
            return (
              <MdLine key={i} text={line} style={{
                fontFamily: F,
                fontSize: 14,
                lineHeight: 1.65,
                margin: 0,
                color: isAction ? industry.color : i === 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.85)',
                fontWeight: isAction ? 600 : 400,
                opacity: isLast ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }} />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(72px,8vw,96px) clamp(16px,3vw,32px) clamp(32px,4vw,48px)', position: 'relative', overflow: 'hidden' }}>

      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 45% at 50% -10%, ${industry.color}12 0%, transparent 60%)`, transition: 'background 0.8s ease', pointerEvents: 'none' }} />

      {/* ── SOCIAL PROOF ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 1 }}>
          {[0,1,2,3,4].map(i => <svg key={i} width="11" height="11" viewBox="0 0 12 12" fill="#fbbf24"><path d="M6 1l1.3 2.6 2.9.4-2.1 2 .5 2.9L6 7.5l-2.6 1.4.5-2.9L1.8 4l2.9-.4z"/></svg>)}
        </div>
        <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.01em' }}>
          {lang === 'pt' ? '4.9 — 340+ gestores' : lang === 'es' ? '4.9 — 340+ media buyers' : '4.9 — 340+ media buyers'}
        </span>
      </div>

      {/* ── HEADLINE ── */}
      <div style={{ textAlign: 'center', marginBottom: 28, maxWidth: 900, width: '100%' }}>
        <h1 className="hero-h1" style={{ fontFamily: F, fontSize: 'clamp(36px,5.5vw,72px)', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.0, margin: '0 0 20px', color: '#fff', whiteSpace: 'pre-line' as const }}>
          {t.hero_h1}
        </h1>
        <p className="hero-sub-p" style={{ fontFamily: F, fontSize: 'clamp(15px,1.1vw,17px)', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, margin: '0 auto 32px', maxWidth: 600, whiteSpace: 'nowrap' as const }}>
          {lang === 'pt' ? 'Conecte o Meta Ads. A IA lê seus dados e responde como um analista sênior.' : lang === 'es' ? 'Conecta Meta Ads. La IA lee tus datos y responde como un analista senior.' : 'Connect Meta Ads. The AI reads your data and answers like a senior analyst.'}
        </p>
        <button onClick={onCTA} style={{ fontFamily: F, fontSize: 15, fontWeight: 700, padding: '15px 40px', borderRadius: 12, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s, transform 0.15s', letterSpacing: '-0.025em' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.9'; el.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }}>
          {lang === 'pt' ? 'Começar grátis' : lang === 'es' ? 'Comenzar gratis' : 'Start for free'}
        </button>
      </div>

      {/* ── DEMO — desktop frame ── */}
      <div className="demo-desktop-only" style={{ marginTop: 52, width: '100%', maxWidth: 1060, position: 'relative' }}>
        {/* Glow layer behind the window */}
        <div style={{ position: 'absolute', inset: '-1px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(99,102,241,0.10) 50%, rgba(14,165,233,0.06) 100%)', zIndex: 0, filter: 'blur(0px)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '10%', right: '10%', height: 80, background: 'radial-gradient(ellipse, rgba(14,165,233,0.18) 0%, transparent 70%)', zIndex: 0, filter: 'blur(20px)' }} />
        <div className="demo-window" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(14,165,233,0.35)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(14,165,233,0.08)', position: 'relative', zIndex: 1 }}>

          {/* Browser chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#050710', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#ff5f57','#febc2e','#28c840'].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 7, maxWidth: 210, margin: '0 auto' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 5px #34d399' }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono',monospace" }}>adbrief.pro/ai</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: F, fontSize: 9.5, color: '#34d399', fontWeight: 600 }}>
                {lang === 'pt' ? 'Meta conectado' : lang === 'es' ? 'Meta conectado' : 'Meta connected'}
              </span>
            </div>
          </div>

          {/* App body — sidebar + chat */}
          <div style={{ display: 'flex', background: '#07090f', minHeight: 520, maxHeight: 520, overflow: 'hidden' }} className="demo-app-body">

            {/* ─ SIDEBAR — context panel with KPIs ─ */}
            <div className="demo-sidebar-inner" style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', background: '#060810' }}>
              {/* Logo */}
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, letterSpacing: '-0.04em', display: 'inline-flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, color: '#eef0f6' }}>ad</span>
                  <span style={{ fontWeight: 900, color: '#38bdf8' }}>brief</span>
                </span>
              </div>

              {/* Industry selector */}
              <div style={{ padding: '10px 10px 6px' }}>
                <p style={{ fontFamily: F, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 6px 4px' }}>
                  {lang === 'pt' ? 'CONTA ATIVA' : lang === 'es' ? 'CUENTA ACTIVA' : 'ACTIVE ACCOUNT'}
                </p>
                {INDUSTRIES_DEMO.slice(0, 4).map(ind => {
                  const acc = INDUSTRY_ACCOUNTS[ind.id]?.[lang];
                  const isAct = ind.id === activeIndustry;
                  return (
                    <div key={ind.id} onClick={() => setActiveIndustry(ind.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 2, background: isAct ? `${ind.color}12` : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: isAct ? `${ind.color}20` : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                        {ind.emoji}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: F, fontSize: 11.5, fontWeight: isAct ? 600 : 400, color: isAct ? '#fff' : 'rgba(255,255,255,0.35)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {acc?.name || ind.id}
                        </p>
                        <p style={{ fontFamily: F, fontSize: 9.5, color: isAct ? ind.color : 'rgba(255,255,255,0.2)', margin: 0 }}>{acc?.meta || ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KPI cards */}
              <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
                <p style={{ fontFamily: F, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 8px 4px' }}>
                  {lang === 'pt' ? 'ESTA SEMANA' : lang === 'es' ? 'ESTA SEMANA' : 'THIS WEEK'}
                </p>
                {[
                  { label: 'ROAS', value: '2.1x', trend: '↓ 40%', bad: true },
                  { label: 'CPM', value: 'R$91', trend: '↑ 38%', bad: true },
                  { label: 'Hook rate', value: '11%', trend: '↓ 20pt', bad: true },
                ].map((kpi, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
                    <span style={{ fontFamily: F, fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{kpi.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: F, fontSize: 11, color: '#fff', fontWeight: 700 }}>{kpi.value}</span>
                      <span style={{ fontFamily: F, fontSize: 9.5, color: kpi.bad ? '#f87171' : '#34d399', fontWeight: 600 }}>{kpi.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─ CHAT PANEL ─ */}
            <div className="demo-chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

              {/* Topbar — minimal account selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#07090f', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: `${industry.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: industry.color }}>
                    {account?.name?.charAt(0) || 'F'}
                  </div>
                  <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{account?.name || 'FitCore Brasil'}</span>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#34d399' }} />
                  <span style={{ fontFamily: F, fontSize: 9.5, color: 'rgba(52,211,153,0.8)', fontWeight: 600 }}>Meta</span>
                </div>
              </div>

              {/* Messages */}
              <div ref={chatRef} className="demo-chat" style={{ flex: 1, overflowY: 'auto', padding: '24px 0 16px', display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
                <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '0 28px', display: 'flex', flexDirection: 'column' as const, gap: 20 }}>

                  {/* Greeting — starts with active diagnosis */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontFamily: F, fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>AB</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                      {/* Alert card — ROAS problem */}
                      <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>
                          {lang === 'pt'
                            ? <><span style={{ color: '#f87171', fontWeight: 600 }}>⚠ ROAS caiu 40%</span> — <strong style={{ color: '#fff' }}>Creative_042</strong> roda há 22 dias. Hook rate: 31% → 11%.</>
                            : lang === 'es'
                            ? <><span style={{ color: '#f87171', fontWeight: 600 }}>⚠ ROAS cayó 40%</span> — <strong style={{ color: '#fff' }}>Creative_042</strong> lleva 22 días. Hook rate: 31% → 11%.</>
                            : <><span style={{ color: '#f87171', fontWeight: 600 }}>⚠ ROAS dropped 40%</span> — <strong style={{ color: '#fff' }}>Creative_042</strong> running 22 days. Hook rate: 31% → 11%.</>}
                        </p>
                      </div>
                      {/* Fix card */}
                      <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: '#38bdf8', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                          {lang === 'pt'
                            ? <>→ Pause Creative_042. Relance <strong>Creative_019</strong> (ROAS 3.2x, parado 9 dias). Libera R$620/dia.</>
                            : lang === 'es'
                            ? <>→ Pausa Creative_042. Relanza <strong>Creative_019</strong> (ROAS 3.2x, pausado 9 días). Libera $620/día.</>
                            : <>→ Pause Creative_042. Relaunch <strong>Creative_019</strong> (ROAS 3.2x, paused 9 days). Frees $620/day.</>}
                        </p>
                      </div>
                      {/* Quick action pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, paddingTop: 4 }}>
                        {quickActions.slice(0, 3).map((label, i) => (
                          <button key={i} onClick={() => { if (i < qa.length) jump(i); }}
                            style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.38)', transition: 'all 0.13s', whiteSpace: 'nowrap' as const }}
                            onMouseEnter={e => { e.currentTarget.style.background='rgba(14,165,233,0.07)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.18)'; e.currentTarget.style.color='rgba(255,255,255,0.72)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.color='rgba(255,255,255,0.38)'; }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* User message */}
                  {phase !== 'idle' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ maxWidth: '68%', padding: '10px 15px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <p style={{ fontFamily: F, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, margin: 0 }}>
                          {typedQ}
                          {phase === 'typing' && <span className="cursor-blink" style={{ display: 'inline-block', width: 1.5, height: 14, background: 'rgba(255,255,255,0.6)', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1 }} />}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI response */}
                  {(phase === 'thinking' || phase === 'streaming' || phase === 'done') && (
                    <div style={{ flex: 1 }}>
                      {renderAI()}
                    </div>
                  )}

                  {/* Suggestion chips after done */}
                  {phase === 'done' && (
                    <InlineSuggestions qa={qa} qi={qi} jump={jump} lang={lang} industry={industry} />
                  )}
                </div>
              </div>

              {/* Input bar — premium real-product look */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px 12px', flexShrink: 0, background: '#07090f' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px 9px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.22)', margin: 0, flex: 1, fontStyle: 'italic' }}>{note}</p>
                  <button onClick={onCTA}
                    style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 10, background: '#0ea5e9', color: '#000', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0, transition: 'opacity 0.15s', letterSpacing: '-0.01em' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                    {ctabtn} →
                  </button>
                </div>
              </div>

              {/* Mobile pills */}
              <div className="demo-mobile-pills" style={{ display: 'none', gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', flexShrink: 0 }}>
                {qa.slice(0,3).map((item, i) => (
                  <button key={i} onClick={() => jump(i)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: qi === i ? `${industry.color}15` : 'rgba(255,255,255,0.05)', border: `1px solid ${qi === i ? industry.color+'30' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const, fontFamily: F, fontSize: 11, color: qi === i ? industry.color : 'rgba(255,255,255,0.45)', fontWeight: qi === i ? 600 : 400 }}>
                    {item.q.slice(0,28)}{item.q.length > 28 ? '…' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE DEMO — card experience, shown only on mobile ── */}
      <div className="demo-mobile-card" style={{ display: 'none', width: '100%', marginTop: 32 }}>
        <MobileDemoCard onCTA={onCTA} lang={lang} />
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
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)", textTransform: "uppercase" as const }}>{t.tools_label}</span>
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
                    <p style={{ fontFamily: F, fontSize: 11, color: isAct ? d.color : "rgba(255,255,255,0.25)", margin: "2px 0 0", lineHeight: 1.3, transition: "color 0.18s", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{d.tagline[lang]}</p>
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
              style={{ borderRadius: 20, border: `1px solid ${tool.color}25`, background: `linear-gradient(135deg, ${tool.color}08 0%, rgba(255,255,255,0.03) 100%)`, overflow: "hidden" }}
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
                      <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: tool.color + "18", color: tool.color, border: `1px solid ${tool.color}30`, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{tool.badge[lang]}</span>
                    </div>
                    <p style={{ fontFamily: F, fontSize: 13.5, color: "rgba(255,255,255,0.62)", lineHeight: 1.65, margin: 0 }}>{tool.desc[lang]}</p>
                  </div>
                </div>
              </div>

              {/* IO preview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }} className="tools-io-grid">

                {/* Input */}
                <div style={{ padding: "20px 24px", borderRight: `1px solid ${tool.color}12` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{inputLabel[lang]}</span>
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
                    <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: tool.color, letterSpacing: "0.1em", textTransform: "uppercase" as const, opacity: 0.8 }}>{outputLabel[lang]}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {tool.output[lang].map((line, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, background: i === 0 ? tool.color + "0d" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? tool.color + "22" : "rgba(255,255,255,0.06)"}` }}>
                        <span style={{ fontFamily: F, fontSize: 11, color: i === 0 ? tool.color : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{i + 1}</span>
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
function HowItWorks({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const results: Record<Lang, string[]> = {
    pt: ["Meta Ads conectado em ~30 segundos", "IA calibrada para sua marca e mercado", "Respostas com dados reais da sua conta"],
    es: ["Meta Ads conectado en ~30 segundos", "IA calibrada para tu marca y mercado", "Respuestas con datos reales de tu cuenta"],
    en: ["Meta Ads connected in ~30 seconds", "AI calibrated to your brand and market", "Answers using real data from your account"],
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
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.how_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.how_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 400, margin: "0 auto" }}>{t.how_sub}</p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ padding: "36px 28px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, position: "relative", overflow: "hidden", transition: "border-color 0.2s, background 0.2s", display: "flex", flexDirection: "column" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${step.color}30`; el.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.background = 'rgba(255,255,255,0.04)'; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: "rgba(255,255,255,0.55)" }}>{step.icon}</div>
              <h3 style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3, letterSpacing: "-0.02em" }}>{step.title}</h3>
              <p style={{ fontFamily: F, fontSize: 13.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, flex: 1, marginBottom: 20 }}>{step.desc}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, background: `${step.color}08`, border: `1px solid ${step.color}18` }}>
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke={step.color} strokeOpacity="0.4" strokeWidth="1"/><path d="M4 6.5l1.8 1.8L9 4.5" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontFamily: F, fontSize: 11.5, color: step.color, fontWeight: 500, opacity: 0.85 }}>{step.result}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── For Who ──────────────────────────────────────────────────────────────────
function ForWho({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  const [active, setActive] = useState(0);
  const profiles = [
    { emoji: "🏢", label: t.for_tab0, color: "#0ea5e9", headline: t.for_h0, desc: t.for_d0, points: [t.for_p0_0, t.for_p0_1, t.for_p0_2, t.for_p0_3] },
    { emoji: "📈", label: t.for_tab1, color: "#34d399", headline: t.for_h1, desc: t.for_d1, points: [t.for_p1_0, t.for_p1_1, t.for_p1_2, t.for_p1_3] },
    { emoji: "⚡", label: t.for_tab2, color: "#a78bfa", headline: t.for_h2b, desc: t.for_d2, points: [t.for_p2_0, t.for_p2_1, t.for_p2_2, t.for_p2_3] },
  ];
  const p = profiles[active];
  return (
    <Section id="for" bg="subtle">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.for_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 0", color: "#fff" }}>{t.for_h2}</h2>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 40, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "4px", width: "fit-content", margin: "0 auto 40px" }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              fontFamily: F, fontSize: 13, fontWeight: active === i ? 600 : 400,
              padding: "8px 20px", borderRadius: 9, cursor: "pointer", transition: "all 0.18s",
              background: active === i ? "rgba(255,255,255,0.10)" : "transparent",
              color: active === i ? "#fff" : "rgba(255,255,255,0.4)",
              border: "none",
            }}>
              {pr.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            className="for-who-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ padding: "36px 30px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <h3 style={{ fontFamily: F, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 14, color: "#fff" }}>{p.headline}</h3>
              <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.75, marginBottom: 28 }}>{p.desc}</p>
              <button onClick={onCTA} style={{ fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 10, background: "#fff", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                {t.for_cta} <ArrowRight size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {p.points.map((point) => (
                <div key={point} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Check size={10} color="rgba(255,255,255,0.5)" />
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.5, margin: 0 }}>{point}</p>
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
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: 52, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(39,175,225,0.15)", border: "1px solid rgba(39,175,225,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/>
                <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#27AEE1", textTransform: "uppercase" as const }}>
              {lang === "pt" ? "TELEGRAM ALERTS" : lang === "es" ? "TELEGRAM ALERTS" : "TELEGRAM ALERTS"}
            </span>
          </div>
          <h2 style={{ fontFamily: F, fontSize: "clamp(26px,3.8vw,44px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "0 0 14px", color: "#fff", lineHeight: 1.15 }}>
            {lang === "pt" ? "O AdBrief chega no seu celular." : lang === "es" ? "AdBrief llega a tu celular." : "AdBrief comes to your phone."}
          </h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 480, lineHeight: 1.65 }}>
            {lang === "pt" ? "Sem app extra. Sem notificação perdida. O bot do AdBrief no Telegram monitora sua conta 24h e age quando você manda." : lang === "es" ? "Sin app extra. Sin notificación perdida. El bot de AdBrief en Telegram monitorea tu cuenta 24h y actúa cuando lo indicas." : "No extra app. No missed notification. The AdBrief Telegram bot monitors your account 24/7 and acts on your command."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="how-grid">
          {items.map((item, i) => (
            <div key={i} style={{ padding: "28px 28px", borderRadius: 20, background: "rgba(39,175,225,0.04)", border: "1px solid rgba(39,175,225,0.12)", display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(39,175,225,0.1)", border: "1px solid rgba(39,175,225,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <p style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{item.title}</p>
                <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
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
                <p style={{ fontFamily: F, fontSize: 11, color: "#27AEE1", margin: 0 }}>bot</p>
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
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>FitCore Brasil · agora</span>
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
                    <span style={{ color: "#34d399", fontSize: 11.5 }}>Economia estimada: R$180/dia</span>
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
      action: () => navigate("/signup?plan=maker"),
    },
    {
      name: "Pro", price: annual ? "$39" : "$49", desc: annual ? "/mo billed annually" : "/mo",
      features: [t.plan_pro_f0, t.plan_pro_f1, t.plan_pro_f2, t.plan_pro_f3, t.plan_pro_f4],
      highlight: true, badge: t.plan_badge_pro,
      action: () => navigate("/signup?plan=pro"),
    },
    {
      name: "Studio", price: annual ? "$119" : "$149", desc: annual ? "/mo billed annually" : "/mo",
      features: [t.plan_studio_f0, t.plan_studio_f1, t.plan_studio_f2, t.plan_studio_f3, t.plan_studio_f4,
        lang === "pt" ? "Suporte prioritário via WhatsApp" : lang === "es" ? "Soporte prioritario por WhatsApp" : "Priority WhatsApp support"
      ],
      highlight: false, badge: null,
      action: () => navigate("/signup?plan=studio"),
    },
  ];

  return (
    <Section id="pricing" bg="accent">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.pricing_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,2.8vw,38px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "10px 0 10px", color: "#fff" }}>{t.pricing_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 420, margin: "0 auto 24px" }}>{t.pricing_sub}</p>
          {/* Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 500, transition: "color 0.2s" }}>Monthly</span>
            <button onClick={() => setAnnual(v => !v)}
              style={{ width: 46, height: 24, borderRadius: 12, background: annual ? "#fff" : "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 3, left: annual ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: annual ? "#000" : "#fff", transition: "left 0.2s", display: "block" }} />
            </button>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: 500, transition: "color 0.2s" }}>Annual</span>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: annual ? "rgba(52,211,153,0.15)" : "rgba(52,211,153,0.06)", color: annual ? "#34d399" : "rgba(52,211,153,0.5)", border: "1px solid rgba(52,211,153,0.2)", transition: "all 0.2s" }}>Economize 20%</span>
          </div>
        </div>
        <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              padding: "28px 24px", borderRadius: 18,
              background: plan.highlight ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: plan.highlight
                ? "1px solid rgba(255,255,255,0.18)"
                : "1px solid rgba(255,255,255,0.07)",
              display: "flex", flexDirection: "column", gap: 20, position: "relative",
              transform: plan.highlight ? "scale(1.02)" : "scale(1)",
              zIndex: plan.highlight ? 2 : 1,
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 6, padding: "3px 12px", whiteSpace: "nowrap" as const }}>
                  <span style={{ fontFamily: F, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#000", fontWeight: 700 }}>{plan.badge}</span>
                </div>
              )}
              <div>
                <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{plan.name}</p>
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
                background: plan.highlight ? "#fff" : "rgba(255,255,255,0.07)",
                color: plan.highlight ? "#000" : "rgba(255,255,255,0.55)",
                border: "none", cursor: "pointer", transition: "opacity 0.15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >{t.pricing_cta}</button>
              <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center" as const }}>{t.pricing_note}</p>
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
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)" }}>{t.faq_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "14px 0 0", color: "#fff" }}>{t.faq_h2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderRadius: 16, background: open === i ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.01)", border: `1px solid ${open === i ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.10)"}`, overflow: "hidden", transition: "all 0.2s" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 14, textAlign: "left" }}>
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
function FinalCTA({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  return (
    <Section bg="subtle">
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ padding: "72px 48px", borderRadius: 32, background: "linear-gradient(135deg, rgba(14,165,233,0.07) 0%, rgba(6,182,212,0.03) 100%)", border: "1px solid rgba(14,165,233,0.18)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(14,165,233,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -80, right: -60, width: 300, height: 300, background: "radial-gradient(ellipse, rgba(52,211,153,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <p style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.12em", fontWeight: 600, color: "rgba(255,255,255,0.28)", marginBottom: 20 }}>{t.final_label}</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 16, whiteSpace: "pre-line", color: "#fff" }}>{t.final_h2}</h2>
            <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.55)", marginBottom: 40, lineHeight: 1.65 }}>{t.final_sub}</p>
            <button onClick={onCTA} style={{
              fontFamily: F, fontSize: 16, fontWeight: 800, padding: "18px 44px", borderRadius: 14,
              background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 10,
              boxShadow: "0 0 40px rgba(14,165,233,0.28), 0 4px 24px rgba(0,0,0,0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(14,165,233,0.45), 0 8px 32px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(14,165,233,0.28), 0 4px 24px rgba(0,0,0,0.3)"; }}
            >
              {t.final_cta} <ArrowRight size={17} />
            </button>
            <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.18)", marginTop: 18, lineHeight: 1.6 }}>{t.final_fine}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }: { t: Record<string, string> }) {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.10)", padding: "36px clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", gap: 28 }}>
          {[["Blog", "/blog"], ["Pricing", "#pricing"], ["FAQ", "#faq"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <a key={href} href={href} style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.2)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}
            >{label}</a>
          ))}
        </div>
        <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.12)" }}>{t.footer_copy}</p>
      </div>
    </footer>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function IndexNew() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    detectLang().then(l => { setLang(l); setReady(true); });
  }, []);

  const t = T[lang];
  const handleCTA = () => navigate("/signup");

  const titleMap: Record<Lang, string> = {
    en: "AdBrief — Ask Your Meta Ads Anything. Get Real Answers.",
    pt: "AdBrief — Pergunte tudo sobre sua conta de anúncios. IA com dados reais.",
    es: "AdBrief — Pregunta todo sobre tu cuenta de anuncios. IA con datos reales.",
  };
  const descMap: Record<Lang, string> = {
    en: "Connect Meta Ads and ask anything. AdBrief reads your real account data and answers like a senior media buyer — ROAS, hooks, what to pause, what to scale. 1-day free trial.",
    pt: "Conecte o Meta Ads e pergunte qualquer coisa. O AdBrief lê sua conta real e responde como um especialista — ROAS, hooks, o que pausar, o que escalar. Teste grátis por 1 dia.",
    es: "Conecta Meta Ads y pregunta lo que quieras. AdBrief lee tu cuenta real y responde como un experto — ROAS, hooks, qué pausar, qué escalar. Prueba gratis 1 día.",
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
          
          /* Demo window */
          .demo-window{box-shadow:0 40px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.06),inset 0 1px 0 rgba(255,255,255,0.06)}
          @keyframes msg-pop{0%{opacity:0;transform:translateY(6px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
          .msg-new{animation:msg-pop 0.3s cubic-bezier(0.16,1,0.3,1) forwards}
          @keyframes dotBounce2{0%,100%{opacity:0.5;transform:scale(0.8)}50%{opacity:1;transform:scale(1.3)}}
          @keyframes thinking-glow{0%,100%{opacity:0.5}50%{opacity:1}}
          .thinking-dot{animation:thinking-glow 1.1s ease-in-out infinite}
          @keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.5);opacity:1}}
          
          /* KPI floating cards */
          @keyframes kpiIn{from{opacity:0;transform:translateY(8px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}
          .kpi-card{animation:kpiIn 0.5s cubic-bezier(0.16,1,0.3,1) both}
          .kpi-card:nth-child(1){animation-delay:0.2s}
          .kpi-card:nth-child(2){animation-delay:0.35s}

          /* ── Mobile ── */
          @media(max-width:768px){
            /* Fix hero section overflow */
            section:first-of-type{overflow-x:hidden!important}
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
            .for-who-grid{grid-template-columns:1fr!important}
            .pricing-grid{grid-template-columns:1fr!important}
            .tools-bento{grid-template-columns:1fr!important}
            .tools-io-grid{grid-template-columns:1fr!important}
          }
          @media(max-width:480px){
            h1,.hero-h1{font-size:clamp(22px,7vw,30px)!important}
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
      <Nav onCTA={handleCTA} t={t} lang={lang} setLang={setLang} />
      <ImmersiveHero onCTA={handleCTA} t={t} lang={lang} />
      <Tools t={t} lang={lang} />
      <HowItWorks t={t} lang={lang} />
      <ForWho onCTA={handleCTA} t={t} />
      <TelegramSection t={t} lang={lang} />
      <Pricing onCTA={handleCTA} t={t} lang={lang} />
      <FAQ t={t} />
      <FinalCTA onCTA={handleCTA} t={t} />
      <Footer t={t} />
      <CookieConsent />
    </div>
  );
}
