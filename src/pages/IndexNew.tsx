// v8.3 — no-animation section 2026-03-23
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
    for_cta: "Try free for 1 day",
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
    for_cta: "Testar grátis por 1 dia",
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
    for_cta: "Probar gratis 1 día",
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
    subtle:  "rgba(255,255,255,0.022)",
    dark:    "rgba(0,0,0,0.38)",
    accent:  "rgba(14,165,233,0.04)",
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
const TOOLS_DATA = [
  { id: "hooks", icon: <Zap size={18} />, name: { en: "Hook Generator", pt: "Gerador de Hooks", es: "Generador de Hooks" }, desc: { en: "AI-generated hooks based on your winning creatives.", pt: "Hooks gerados pela IA baseados nos seus melhores criativos.", es: "Hooks generados por IA basados en tus ganadores." }, color: "#0ea5e9" },
  { id: "script", icon: <Play size={18} />, name: { en: "Video Script", pt: "Script de Vídeo", es: "Script de Video" }, desc: { en: "Full UGC and direct-response scripts tuned to your account.", pt: "Scripts completos calibrados para sua conta.", es: "Scripts completos calibrados para tu cuenta." }, color: "#a78bfa" },
  { id: "brief", icon: <Layers size={18} />, name: { en: "Creative Brief", pt: "Brief Criativo", es: "Brief Creativo" }, desc: { en: "Data-backed briefs that tell your team what to produce next.", pt: "Briefs baseados em dados para seu time.", es: "Briefs basados en datos para tu equipo." }, color: "#34d399" },
  { id: "competitor", icon: <Target size={18} />, name: { en: "Competitor Decode", pt: "Decodificador", es: "Decodificador" }, desc: { en: "Break down any competitor ad — hook, format, angle, CTA.", pt: "Desmonte qualquer anúncio concorrente.", es: "Desmonta cualquier anuncio competidor." }, color: "#f97316" },
  { id: "translate", icon: <Globe size={18} />, name: { en: "Ad Translator", pt: "Tradutor de Anúncios", es: "Traductor" }, desc: { en: "Translate ads across markets with tone and platform adaptation.", pt: "Traduza anúncios adaptando tom e plataforma.", es: "Traduce anuncios adaptando tono y plataforma." }, color: "#ec4899" },
  { id: "analysis", icon: <BarChart3 size={18} />, name: { en: "Campaign Analysis", pt: "Análise de Campanha", es: "Análisis" }, desc: { en: "Ask anything about your Meta Ads data. Direct diagnosis.", pt: "Pergunte sobre seus dados do Meta Ads.", es: "Pregunta sobre tus datos de Meta Ads." }, color: "#0ea5e9" },
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
          {([[t.nav_how,'#how'],[t.nav_for,'#for'],[t.nav_pricing,'#pricing'],['Tools','#tools']] as [string,string][]).map(([label,href]) => (
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
            {t.nav_cta}
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
  const label = lang === 'pt' ? 'Perguntar também:' : lang === 'es' ? 'Preguntar también:' : 'Ask next:';
  const icons = ['📉','⚡','✍️'];

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 320);
    return () => clearTimeout(t);
  }, [qi]);

  if (!visible) return null;

  const others = qa.map((item, i) => ({ item, i })).filter(({ i }) => i !== qi);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 36, animation: 'toolSlideIn 0.22s ease' }}>
      <p style={{ fontFamily: F, fontSize: 9.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', margin: '0 0 3px', fontWeight: 500 }}>{label}</p>
      {others.map(({ item, i }) => (
        <button key={i} onClick={() => { setVisible(false); jump(i); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.13s', fontFamily: F }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${industry.color}10`; el.style.borderColor = `${industry.color}30`; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>{icons[i]}</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.35, letterSpacing: '-0.01em' }}>
            {item.q.slice(0, 52)}{item.q.length > 52 ? '…' : ''}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: industry.color, flexShrink: 0, opacity: 0.7 }}>→</span>
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
    ? ['IA Chat','Contas','Concorrentes','Análises']
    : lang === 'es'
    ? ['IA Chat','Cuentas','Competidores','Análisis']
    : ['AI Chat','Accounts','Competitors','Analytics'];
  const navTools = lang === 'pt'
    ? ['Gerador de Hooks','Roteiro','Traduzir','Check Criativo','Templates','Boards']
    : lang === 'es'
    ? ['Generador de Hooks','Guion','Traducir','Check Creativo','Templates','Boards']
    : ['Hook Generator','Script','Translate','Creative Check','Templates','Boards'];
  const toolsLabel = lang === 'pt' ? 'FERRAMENTAS' : lang === 'es' ? 'HERRAMIENTAS' : 'TOOLS';
  const greetLabel = lang === 'pt' ? 'Boa noite' : lang === 'es' ? 'Buenas noches' : 'Good evening';
  const quickActions = lang === 'pt'
    ? [['📊','Resumo da conta'],['⚡','Gerar hooks'],['✍️','Escrever roteiro'],['🎯','O que pausar?']]
    : lang === 'es'
    ? [['📊','Resumen'],['⚡','Generar hooks'],['✍️','Escribir guión'],['🎯','¿Qué pausar?']]
    : [['📊','Account summary'],['⚡','Generate hooks'],['✍️','Write script'],['🎯','What to pause?']];

  // Render AI lines as beautiful structured cards
  const renderAI = () => {
    if (phase === 'thinking') return <Dots />;
    if (phase !== 'streaming' && phase !== 'done') return null;
    const allLines = activeLine ? [...lines, activeLine] : lines;
    if (!allLines.length) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
        {/* Intro */}
        <p style={{ fontFamily: F, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, margin: '0 0 4px' }}>
          <MdLine text={allLines[0]} style={{ fontFamily: F, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, margin: 0 }} />
        </p>
        {/* Cards */}
        {allLines.slice(1).map((line, i) => {
          const clean = line.replace(/\*\*/g, '');
          const isAction = /^(Fix:|Ação:|Action:|Acción:|Pausar|Pause|Pausa|Recom|Total)/i.test(clean);
          const isBold = line.startsWith('**') && line.includes('**—') || line.includes('**—');
          const isLast = i === allLines.slice(1).length - 1 && phase === 'streaming';
          const icons = ['🔴','📊','⚡','→'];
          const icon = isAction ? '→' : icons[i] || '•';
          const cardBg = isAction
            ? `${industry.color}12`
            : i === 0 ? 'rgba(248,113,113,0.06)'
            : 'rgba(255,255,255,0.04)';
          const cardBorder = isAction
            ? `1px solid ${industry.color}35`
            : i === 0 ? '1px solid rgba(248,113,113,0.18)'
            : '1px solid rgba(255,255,255,0.07)';

          return (
            <div key={i} style={{
              padding: '9px 13px 9px 11px',
              borderRadius: 12,
              background: cardBg,
              border: cardBorder,
              display: 'flex', gap: 9, alignItems: 'flex-start',
              opacity: isLast ? 0.75 : 1,
              transition: 'opacity 0.2s',
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1, color: isAction ? industry.color : undefined }}>{icon}</span>
              <MdLine text={line} style={{
                fontFamily: F, fontSize: 13, lineHeight: 1.6, margin: 0,
                color: isAction ? industry.color : 'rgba(255,255,255,0.85)',
                fontWeight: isAction ? 600 : 400,
              }} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(60px,6vw,80px) clamp(16px,3vw,32px) clamp(24px,3vw,36px)', position: 'relative', overflow: 'hidden' }}>

      {/* Ambient glow reacts to industry */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% -5%, ${industry.color}10 0%, transparent 65%)`, transition: 'background 0.8s ease', pointerEvents: 'none' }} />

      {/* ── HEADLINE — compact, one visual line ── */}
      <div style={{ textAlign: 'center', marginBottom: 16, maxWidth: 960, width: '100%' }}>
        <h1 className="hero-h1" style={{ fontFamily: F, fontSize: 'clamp(22px,2.8vw,38px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 8px', color: '#fff' }}>
          {h1p[0]}
          {h1p[1] && <span style={{ background: `linear-gradient(90deg, ${industry.color} 0%, #34d399 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', transition: 'background 0.7s' }}> {h1p[1]}</span>}
        </h1>
        <p className="hero-sub-p" style={{ fontFamily: F, fontSize: 'clamp(13px,1vw,15px)', color: 'rgba(255,255,255,0.42)', lineHeight: 1.5, margin: '0 auto', maxWidth: 560 }}>{t.hero_sub}</p>
      </div>



      {/* ── DEMO WINDOW ── */}
      <div style={{ width: '100%', maxWidth: 1020 }}>
        <div className="demo-window" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Browser chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#0b0e14', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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

          {/* App body — exact replica of real product */}
          <div style={{ display: 'flex', background: '#0d1117', minHeight: 400, maxHeight: 400, overflow: 'hidden' }} className="demo-app-body">

            {/* ─ SIDEBAR — faithful replica ─ */}
            <div className="demo-sidebar-inner" style={{ width: 210, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: '#0b0f18' }}>
              {/* Logo */}
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontFamily: F, fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                  <span style={{ color: '#0ea5e9' }}>ad</span>brief
                </span>
              </div>
              {/* Main nav */}
              <div style={{ padding: '8px 8px 4px', flex: 1 }}>
                {navMain.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 9, marginBottom: 1, background: i === 0 ? 'rgba(14,165,233,0.10)' : 'transparent', cursor: 'pointer' }}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, background: i === 0 ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: i === 0 ? '#0ea5e9' : 'rgba(255,255,255,0.25)' }} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12.5, color: i === 0 ? '#e2f4ff' : 'rgba(255,255,255,0.38)', fontWeight: i === 0 ? 600 : 400 }}>{item}</span>
                    {i === 0 && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }} />}
                  </div>
                ))}
                {/* Tools section */}
                <div style={{ margin: '10px 0 6px 9px' }}>
                  <span style={{ fontFamily: F, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.20)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{toolsLabel}</span>
                </div>
                {navTools.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 9px', borderRadius: 9, marginBottom: 1, cursor: 'pointer' }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}>{item}</span>
                  </div>
                ))}
              </div>
              {/* Bottom: language + user */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', marginBottom: 8, width: 'fit-content' }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
                    {lang === 'pt' ? 'BR PT' : lang === 'es' ? 'MX ES' : 'US EN'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {account?.name?.charAt(0) || 'F'}
                  </div>
                  <div>
                    <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{account?.name || 'FitCore'}</p>
                    <p style={{ fontFamily: F, fontSize: 10, color: industry.color, margin: 0, fontWeight: 600 }}>∞ Lifetime</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ─ CHAT PANEL ─ */}
            <div className="demo-chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

              {/* Topbar — account picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d1117', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 8px', borderRadius: 8, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.20)', cursor: 'pointer' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, background: `${industry.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: industry.color }}>
                    {account?.name?.charAt(0) || 'F'}
                  </div>
                  <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 600, color: '#e2f4ff' }}>{account?.name || 'FitCore Brasil'}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 4L5 6.5L7.5 4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
                <div style={{ flex: 1 }} />
                {/* Telegram icon */}
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(39,175,225,0.10)', border: '1px solid rgba(39,175,225,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/><path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/></svg>
                </div>
                {/* Avatar */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                  {account?.name?.charAt(0) || 'L'}
                </div>
              </div>

              {/* Messages */}
              <div ref={chatRef} className="demo-chat" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 12px', display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
                <div style={{ maxWidth: 700, margin: '0 auto', width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

                  {/* Proactive greeting — exact match to real product */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: industry.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{greetLabel}</span>
                      </div>
                      <p style={{ fontFamily: F, fontSize: 13.5, color: 'rgba(255,255,255,0.68)', lineHeight: 1.65, margin: '0 0 14px', maxWidth: 560 }}>
                        {lang === 'pt'
                          ? `Sua conta Meta Ads está conectada — ${account?.meta || 'Meta · 22 campanhas'}. Identifiquei 3 alertas hoje. O que você quer analisar?`
                          : lang === 'es'
                          ? `Tu cuenta Meta Ads está conectada — ${account?.meta || 'Meta · 22 campañas'}. Identifiqué 3 alertas hoy. ¿Qué quieres analizar?`
                          : `Your Meta Ads account is connected — ${account?.meta || 'Meta · 22 campaigns'}. I found 3 alerts today. What do you want to analyze?`}
                      </p>
                      {/* Quick action pills — exact match to real product */}
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                        {quickActions.map(([emoji, label], i) => (
                          <button key={i} onClick={() => { if (i < qa.length) jump(i); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', fontFamily: F, fontSize: 12, color: 'rgba(238,240,246,0.55)', transition: 'all 0.13s', whiteSpace: 'nowrap' as const }}
                            onMouseEnter={e => { e.currentTarget.style.background='rgba(14,165,233,0.08)'; e.currentTarget.style.borderColor='rgba(14,165,233,0.25)'; e.currentTarget.style.color='#eef0f6'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; e.currentTarget.style.color='rgba(238,240,246,0.55)'; }}>
                            <span style={{ fontSize: 12 }}>{emoji}</span>{label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* User message */}
                  {phase !== 'idle' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ maxWidth: '72%', padding: '10px 15px', borderRadius: '18px 18px 4px 18px', background: `linear-gradient(135deg, rgba(14,165,233,0.22), rgba(99,102,241,0.15))`, border: '1px solid rgba(14,165,233,0.22)' }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: '#fff', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                          {typedQ}
                          {phase === 'typing' && <span className="cursor-blink" style={{ display: 'inline-block', width: 2, height: 13, background: '#0ea5e9', marginLeft: 2, verticalAlign: 'middle', borderRadius: 1 }} />}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI response */}
                  {(phase === 'thinking' || phase === 'streaming' || phase === 'done') && (
                    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: industry.color, flexShrink: 0 }} />
                        </div>
                        {renderAI()}
                      </div>
                    </div>
                  )}

                  {/* Suggestion chips after done */}
                  {phase === 'done' && (
                    <InlineSuggestions qa={qa} qi={qi} jump={jump} lang={lang} industry={industry} />
                  )}
                </div>
              </div>

              {/* Input bar — exact match to real product */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 0 10px', flexShrink: 0 }}>
                <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="demo-cta-bar">
                    <div style={{ flex: 1, padding: '10px 14px', borderRadius: 14, background: '#1a2032', border: '1px solid rgba(255,255,255,0.09)' }}>
                      <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.18)', margin: 0, fontStyle: 'italic' }}>{note}</p>
                    </div>
                    <button onClick={onCTA} className="demo-cta-btn"
                      style={{ fontFamily: F, fontSize: 12.5, fontWeight: 800, padding: '10px 18px', borderRadius: 12, background: `linear-gradient(135deg, #0ea5e9, #06b6d4)`, color: '#000', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0, transition: 'all 0.15s', letterSpacing: '-0.01em', boxShadow: '0 0 20px rgba(14,165,233,0.25)' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform='translateY(-1px)'; el.style.boxShadow='0 0 32px rgba(14,165,233,0.4)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform='translateY(0)'; el.style.boxShadow='0 0 20px rgba(14,165,233,0.25)'; }}>
                      {ctabtn} →
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile pills */}
              <div className="demo-mobile-pills" style={{ display: 'none', gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', flexShrink: 0 }}>
                {qa.slice(0,3).map((item, i) => (
                  <button key={i} onClick={() => jump(i)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: qi === i ? `${industry.color}20` : 'rgba(255,255,255,0.05)', border: `1px solid ${qi === i ? industry.color+'40' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const, fontFamily: F, fontSize: 11, color: qi === i ? industry.color : 'rgba(255,255,255,0.55)', fontWeight: qi === i ? 600 : 400 }}>
                    {['📉','⚡','✍️'][i]} {item.q.slice(0,22)}{item.q.length > 22 ? '…' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Proof bar below demo */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }} className="hero-proofs">
          {(lang === 'pt'
            ? ['Meta Ads conectado em 30s', 'Dados reais dos últimos 90 dias', 'Cancele antes de 24h, sem cobrança']
            : lang === 'es'
            ? ['Meta Ads conectado en 30s', 'Datos reales de los últimos 90 días', 'Cancela antes de 24h, sin cobro']
            : ['Meta Ads connected in 30s', 'Real data from last 90 days', 'Cancel before 24h, no charge']
          ).map((pt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6" stroke="rgba(52,211,153,0.45)" strokeWidth="1"/><path d="M4 6.5l1.8 1.8L9 4.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{pt}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ─── Tools ─────────────────────────────────────────────────────────────────────
function Tools({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Section id="tools" bg="subtle">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase' }}>{t.tools_label}</span>
          <h2 style={{ fontFamily: F, fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-0.04em', margin: '12px 0 10px', color: '#fff' }}>{t.tools_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: 'rgba(255,255,255,0.55)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>{t.tools_sub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 8 }}>
          {TOOLS_DATA.map(tool => {
            const isOpen = open === tool.id;
            return (
              <div key={tool.id}
                onClick={() => setOpen(isOpen ? null : tool.id)}
                style={{ borderRadius: 14, background: isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (isOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.12)'), cursor: 'pointer', transition: 'all 0.18s', overflow: 'hidden' }}
                onMouseEnter={e => { if (!isOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.borderColor = 'rgba(255,255,255,0.18)'; }}}
                onMouseLeave={e => { if (!isOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.borderColor = 'rgba(255,255,255,0.12)'; }}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', flexShrink: 0 }}>{tool.icon}</div>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', margin: 0, flex: 1 }}>{tool.name[lang]}</p>
                  <div style={{ color: 'rgba(255,255,255,0.2)', transition: 'transform 0.18s', transform: isOpen ? 'rotate(45deg)' : 'none', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </div>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: '12px 0 0' }}>{tool.desc[lang]}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}


// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks({ t }: { t: Record<string, string> }) {
  const steps = [
    { n: "01", icon: <Plug size={22} />, color: "#0ea5e9", title: t.how_s1_title, desc: t.how_s1_desc },
    { n: "02", icon: <Users size={22} />, color: "#06b6d4", title: t.how_s2_title, desc: t.how_s2_desc },
    { n: "03", icon: <MessageSquare size={22} />, color: "#34d399", title: t.how_s3_title, desc: t.how_s3_desc },
  ];
  return (
    <Section id="how" bg="dark">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#0ea5e9" }}>{t.how_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.how_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 400, margin: "0 auto" }}>{t.how_sub}</p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ padding: "36px 28px", borderRadius: 22, background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`, border: `1px solid rgba(255,255,255,0.10)`, position: "relative", overflow: "hidden", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${step.color}40`}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"}>
              <div style={{ position: "absolute", top: -20, right: -4, fontSize: 88, fontWeight: 900, color: "rgba(255,255,255,0.05)", fontFamily: F, lineHeight: 1, pointerEvents: "none", letterSpacing: "-0.05em" }}>{step.n}</div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${step.color}15`, border: `1px solid ${step.color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, color: step.color, boxShadow: `0 0 20px ${step.color}15` }}>{step.icon}</div>
              <h3 style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 12, lineHeight: 1.3, letterSpacing: "-0.02em" }}>{step.title}</h3>
              <p style={{ fontFamily: F, fontSize: 13.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.75 }}>{step.desc}</p>
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
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#0ea5e9" }}>{t.for_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 0", color: "#fff" }}>{t.for_h2}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              fontFamily: F, fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 999, cursor: "pointer", transition: "all 0.2s",
              background: active === i ? `${pr.color}10` : "rgba(255,255,255,0.12)",
              color: active === i ? pr.color : "rgba(255,255,255,0.62)",
              border: `1px solid ${active === i ? pr.color + "28" : "rgba(255,255,255,0.12)"}`,
            }}>
              {pr.emoji} {pr.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            className="for-who-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ padding: "36px 30px", borderRadius: 22, background: `${p.color}12`, border: `1px solid ${p.color}25` }}>
              <span style={{ fontSize: 40, display: "block", marginBottom: 20 }}>{p.emoji}</span>
              <h3 style={{ fontFamily: F, fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 14, color: "#fff" }}>{p.headline}</h3>
              <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 28 }}>{p.desc}</p>
              <button onClick={onCTA} style={{ fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 12, background: "#fff", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {t.for_cta} <ArrowRight size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.points.map((point) => (
                <div key={point} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${p.color}10`, border: `1px solid ${p.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} color={p.color} />
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{point}</p>
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
      features: [t.plan_studio_f0, t.plan_studio_f1, t.plan_studio_f2, t.plan_studio_f3, t.plan_studio_f4],
      highlight: false, badge: null,
      action: () => navigate("/signup?plan=studio"),
    },
  ];

  return (
    <Section id="pricing" bg="accent">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#0ea5e9" }}>{t.pricing_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.pricing_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.72)", maxWidth: 420, margin: "0 auto 24px" }}>{t.pricing_sub}</p>
          {/* Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "rgba(255,255,255,0.3)" : "#fff", fontWeight: 500, transition: "color 0.2s" }}>Monthly</span>
            <button onClick={() => setAnnual(v => !v)}
              style={{ width: 46, height: 24, borderRadius: 12, background: annual ? "#fff" : "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 3, left: annual ? 24 : 3, width: 18, height: 18, borderRadius: "50%", background: annual ? "#000" : "#fff", transition: "left 0.2s", display: "block" }} />
            </button>
            <span style={{ fontFamily: F, fontSize: 13, color: annual ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: 500, transition: "color 0.2s" }}>Annual</span>
            {annual && <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>-20%</span>}
          </div>
        </div>
        <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              padding: "32px 28px", borderRadius: 22,
              background: plan.highlight ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${plan.highlight ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.10)"}`,
              display: "flex", flexDirection: "column", gap: 22, position: "relative",
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 7, padding: "3px 14px", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: F, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#000", fontWeight: 800 }}>{plan.badge}</span>
                </div>
              )}
              <div>
                <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check size={13} color="rgba(255,255,255,0.55)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{
                fontFamily: F, width: "100%", padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: plan.highlight ? "#fff" : "rgba(255,255,255,0.10)",
                color: plan.highlight ? "#000" : "rgba(255,255,255,0.6)",
                border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer", transition: "all 0.2s",
              }}>{t.pricing_cta}</button>
              <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.15)", textAlign: "center" }}>{t.pricing_note}</p>
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
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#0ea5e9" }}>{t.faq_label}</span>
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
            <p style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "#0ea5e9", marginBottom: 20 }}>{t.final_label}</p>
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
            /* Demo container — full width */
            .demo-window{max-width:100%!important;border-radius:12px!important}
            /* Nav */
            .nav-links{display:none!important}

            /* Hero text — wrap naturally, smaller size */
            h1,.hero-h1{font-size:clamp(20px,6vw,30px)!important;white-space:normal!important;letter-spacing:-0.03em!important;line-height:1.15!important}
            .hero-sub-p{font-size:13px!important;white-space:normal!important;max-width:100%!important}

            /* Demo window */
            .demo-window{border-radius:14px!important}
            .demo-app-body{
              flex-direction:column!important;
              min-height:0!important;max-height:none!important;
              height:auto!important;overflow:visible!important
            }
            /* Hide sidebar — show only chat */
            .demo-sidebar-inner{display:none!important}
            /* Show mobile pills */
            .demo-mobile-pills{display:flex!important}
            /* Chat panel fixed height */
            .demo-chat-panel{
              height:360px!important;max-height:360px!important;
              min-height:360px!important;flex:none!important;overflow:hidden!important
            }
            .demo-chat{
              overflow-y:auto!important;
              height:240px!important;max-height:240px!important;
              padding:12px 14px!important
            }
            /* Input area: hide note, CTA full width */
            .demo-note{display:none!important}
            .demo-cta-bar{
              flex-direction:column!important;
              gap:8px!important;padding:10px 14px!important
            }
            .demo-cta-btn{
              width:100%!important;justify-content:center!important;
              font-size:14px!important;padding:12px 18px!important
            }

            /* Sections */
            .how-grid{grid-template-columns:1fr!important}
            .for-who-grid{grid-template-columns:1fr!important}
            .pricing-grid{grid-template-columns:1fr!important}

            /* Proof bar */
            .hero-proofs{flex-direction:column!important;align-items:center!important;gap:8px!important}
          }
          @media(max-width:480px){
            h1,.hero-h1{font-size:clamp(18px,7vw,26px)!important}
            .demo-chat-panel{height:320px!important;max-height:320px!important;min-height:320px!important}
            .demo-chat{height:200px!important;max-height:200px!important}
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
      <HowItWorks t={t} />
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
