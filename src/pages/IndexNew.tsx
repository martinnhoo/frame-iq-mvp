// v5 — Immersive streaming demo
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, Plug, Users, ChevronDown, Globe, Play, Zap, BarChart3, Target, Layers } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";
import { motion, useInView, AnimatePresence } from "framer-motion";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const BG = "#050508";
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Types & Translations ────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_how: "How it works", nav_for: "Who it's for", nav_pricing: "Pricing", nav_signin: "Sign in", nav_cta: "Try free for 1 day",
    hero_badge: "AI FOR PERFORMANCE MARKETING",
    hero_h1: "Your ads know\nmore than you think.",
    hero_sub: "Connect Meta Ads. Ask anything. Get answers with your real data — not generic advice.",
    hero_cta: "Try free for 1 day", hero_see: "See how it works",
    hero_fine: "1-day free trial · No charge for 24h · Cancel anytime",
    stat_1: "$2.4M+", stat_1_label: "Ad spend analyzed",
    stat_2: "34,000+", stat_2_label: "Hooks generated",
    stat_3: "4.8", stat_3_label: "Average rating",
    stat_4: "+22%", stat_4_label: "Avg ROAS lift",
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
    for_p2_0: "Connected to your real data", for_p2_1: "Personas for each product line", for_p2_2: "Brand context baked in", for_p2_3: "Team-wide shared intelligence",
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
    plan_maker_f0: "50 AI messages / day", plan_maker_f1: "1 ad account", plan_maker_f2: "All tools unlocked", plan_maker_f3: "Up to 3 accounts",
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
    hero_badge: "IA PARA PERFORMANCE MARKETING",
    hero_h1: "Seus anúncios sabem\nmais do que você pensa.",
    hero_sub: "Conecte o Meta Ads. Pergunte qualquer coisa. Receba respostas com seus dados reais — não conselhos genéricos.",
    hero_cta: "Testar grátis por 1 dia", hero_see: "Ver como funciona",
    hero_fine: "1 dia grátis · Sem cobrança por 24h · Cancele quando quiser",
    stat_1: "R$12M+", stat_1_label: "Budget analisado",
    stat_2: "34.000+", stat_2_label: "Hooks gerados",
    stat_3: "4.8", stat_3_label: "Avaliação média",
    stat_4: "+22%", stat_4_label: "Melhoria de ROAS",
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
    for_tab0: "Agências", for_tab1: "Media Buyers", for_tab2: "Times Internos",
    for_h0: "Gerencie 10 clientes como se tivesse um time de dados.", for_d0: "O AdBrief conecta à conta de cada cliente e dá respostas reais — quais criativos escalar, quais pausar, o que briefar.",
    for_h1: "Pare de decidir no escuro.", for_d1: "AdBrief te dá respostas baseadas em dados — qual formato underperforma, qual hook vence, o que briefar.",
    for_h2b: "Suas campanhas finalmente conectadas.", for_d2: "Conecte as contas e dê ao time acesso a uma IA que conhece seu histórico de performance.",
    for_cta: "Testar grátis por 1 dia",
    for_p0_0: "Contas por cliente com Meta Ads", for_p0_1: "Performance em tempo real", for_p0_2: "Brief calibrado por marca", for_p0_3: "IA que aprende cada cliente",
    for_p1_0: "Dados reais em cada resposta", for_p1_1: "Detecção de padrões", for_p1_2: "Análise de concorrentes", for_p1_3: "Memória que melhora",
    for_p2_0: "Conectado aos dados reais", for_p2_1: "Personas por produto", for_p2_2: "Contexto de marca integrado", for_p2_3: "Inteligência compartilhada",
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
    plan_maker_f0: "50 mensagens / dia", plan_maker_f1: "1 conta de anúncios", plan_maker_f2: "Todas as ferramentas", plan_maker_f3: "Até 3 contas",
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
    final_label: "COMECE HOJE", final_h2: "Sua conta de anúncios está cheia de insights.\nComece a perguntar.",
    final_sub: "Conecte em 2 minutos. Cancele quando quiser.",
    final_cta: "Testar grátis por 1 dia", final_fine: "Qualquer plano · 1 dia grátis · Cancele antes de 24h",
    footer_copy: "© 2026 AdBrief",
  },
  es: {
    nav_how: "Cómo funciona", nav_for: "Para quién", nav_pricing: "Precios", nav_signin: "Iniciar sesión", nav_cta: "Probar gratis 1 día",
    hero_badge: "IA PARA PERFORMANCE MARKETING",
    hero_h1: "Tus anuncios saben\nmás de lo que crees.",
    hero_sub: "Conecta Meta Ads. Pregunta lo que quieras. Recibe respuestas con tus datos reales.",
    hero_cta: "Probar gratis 1 día", hero_see: "Ver cómo funciona",
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
    plan_maker_f0: "50 mensajes / día", plan_maker_f1: "1 cuenta de anuncios", plan_maker_f2: "Todas las herramientas", plan_maker_f3: "Hasta 3 cuentas",
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
        <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, letterSpacing: "0.02em" }}>{label}</p>
      </motion.div>
    </div>
  );
}

// ─── Section wrapper with reveal ──────────────────────────────────────────────
function Section({ children, id, className = "", noPadding = false }: { children: React.ReactNode; id?: string; className?: string; noPadding?: boolean }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={noPadding ? {} : { padding: "clamp(32px,5vw,72px) clamp(16px,4vw,32px)" }}
    >
      {children}
    </motion.section>
  );
}

// ─── Language switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const flags: Record<Lang, string> = { en: "🇺🇸", pt: "🇧🇷", es: "🇲🇽" };
  const pick = (l: Lang) => { setLang(l); localStorage.setItem("adbrief_language", l); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: F }}>
        <Globe size={11} /> {flags[lang]} {lang.toUpperCase()}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", zIndex: 999, minWidth: 80, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
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
            <a key={href} href={href} style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
              {label}
            </a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <LangSwitcher lang={lang} setLang={setLang} />
          <button className="nav-links" onClick={() => window.location.href = '/login'}
            style={{ fontFamily: F, fontSize: 13, padding: '8px 16px', borderRadius: 9, background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.7)'; el.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(255,255,255,0.4)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
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
const DEMO_QA: Record<Lang, Array<{ q: string; lines: string[] }>> = {
  en: [
    {
      q: "My ROAS dropped 40% this week. What's happening?",
      lines: [
        "Found 3 simultaneous causes in your account:",
        "**Creative fatigue** — Creative_042 has been running 22 days. Hook rate fell from 31% to 11%.",
        "**Frequency 4.8x** — BR-Women-25-34 oversaturated. Every dollar reaches someone who saw it 5 times.",
        "**CPM +38%** — algorithm detected the drop and is charging more to deliver.",
        "Action: pause Creative_042, relaunch Creative_019 (ROAS 3.2x, paused 9 days), split the saturated set.",
      ],
    },
    {
      q: "Which ads should I pause right now?",
      lines: [
        "3 ads to cut today:",
        "**Creative_038** — CPM $18, CTR 0.4%, zero conversions in 7 days. Burning $180/day.",
        "**BR-Men-35-44 set** — ROAS 0.6x, frequency 5.1. Paying to irritate an exhausted audience.",
        "**Creative_029** — hook rate 8%. Your floor is 15%. 92% leave in the first 3 seconds.",
        "Combined: $620/day with negative return. Pausing frees budget for Creative_019 (ROAS 3.2x).",
      ],
    },
    {
      q: "Write 3 hooks from my best performing creatives.",
      lines: [
        "Based on your top 5 converters (avg hook rate 34%, ROAS 3.1x+):",
        "**Hook 1** — \"You are paying $90 per click and still do not know why. Your data already has the answer.\"",
        "**Hook 2** — \"3 of your 4 highest-spend ads have ROAS below 1x right now.\"",
        "**Hook 3** — \"Your best creative from last month has been paused 9 days. A competitor is scaling the same angle.\"",
        "Pattern: never generic benefit — always a specific claim that forces the user to stop.",
      ],
    },
  ],
  pt: [
    {
      q: "Meu ROAS caiu 40% essa semana. O que esta acontecendo?",
      lines: [
        "Identifiquei 3 causas simultaneas na sua conta:",
        "**Fadiga criativa** — Creative_042 roda ha 22 dias. Hook rate caiu de 31% para 11%.",
        "**Frequencia 4.8x** — BR-Mulheres-25-34 supersaturado. Cada real vai para quem ja viu 5 vezes.",
        "**CPM +38%** — o algoritmo percebeu a queda e cobra mais caro para entregar.",
        "Acao: pause Creative_042, relance Creative_019 (ROAS 3.2x, parado 9 dias), divida o conjunto.",
      ],
    },
    {
      q: "Quais anuncios devo pausar agora?",
      lines: [
        "3 anuncios para cortar hoje:",
        "**Creative_038** — CPM R$91, CTR 0,4%, zero conversoes em 7 dias. Queima R$180/dia.",
        "**BR-Homens-35-44** — ROAS 0,6x, frequencia 5.1. Audiencia exaurida.",
        "**Creative_029** — hook rate 8%. Minimo e 15%. 92% saem nos primeiros 3 segundos.",
        "Total: R$620/dia com retorno negativo. Pausar libera verba para Creative_019 (ROAS 3.2x).",
      ],
    },
    {
      q: "Escreve 3 hooks dos meus melhores criativos.",
      lines: [
        "Baseado nos seus 5 top converters (hook rate 34%, ROAS 3.1x+):",
        "**Hook 1** — \"Voce esta pagando R$90 por clique e nao sabe por que. Seus dados ja tem a resposta.\"",
        "**Hook 2** — \"3 dos seus 4 anuncios que mais gastam tem ROAS abaixo de 1x agora.\"",
        "**Hook 3** — \"Seu melhor criativo do mes passado esta parado ha 9 dias. O concorrente esta escalando o mesmo angulo.\"",
        "Padrao: nunca beneficio generico — sempre uma afirmacao especifica que forca o usuario a parar.",
      ],
    },
  ],
  es: [
    {
      q: "Mi ROAS bajo 40% esta semana. Que esta pasando?",
      lines: [
        "Identifique 3 causas simultaneas en tu cuenta:",
        "**Fatiga creativa** — Creative_042 lleva 22 dias. Hook rate cayo de 31% a 11%.",
        "**Frecuencia 4.8x** — BR-Mujeres-25-34 supersaturado. Cada peso va a quien ya vio 5 veces.",
        "**CPM +38%** — el algoritmo detecto la caida y cobra mas caro.",
        "Accion: pausa Creative_042, relanza Creative_019 (ROAS 3.2x, pausado 9 dias), divide el conjunto.",
      ],
    },
    {
      q: "Cuales anuncios pausar ahora mismo?",
      lines: [
        "3 anuncios para cortar hoy:",
        "**Creative_038** — CPM $18, CTR 0.4%, cero conversiones en 7 dias. Quema $180/dia.",
        "**BR-Hombres-35-44** — ROAS 0.6x, frecuencia 5.1. Audiencia agotada.",
        "**Creative_029** — hook rate 8%. Tu minimo es 15%. 92% se van en los primeros 3 segundos.",
        "Total: $620/dia con retorno negativo. Pausar libera presupuesto para Creative_019.",
      ],
    },
    {
      q: "Escribe 3 hooks de mis mejores creativos.",
      lines: [
        "Basado en tus 5 top converters (hook rate 34%, ROAS 3.1x+):",
        "**Hook 1** — \"Estas pagando $90 por clic y no sabes por que. Tus datos ya tienen la respuesta.\"",
        "**Hook 2** — \"3 de tus 4 anuncios que mas gastan tienen ROAS bajo 1x ahora.\"",
        "**Hook 3** — \"Tu mejor creativo del mes pasado lleva 9 dias pausado. Un competidor escala el mismo angulo.\"",
        "Patron: nunca beneficio generico — siempre una afirmacion especifica que obliga a detenerse.",
      ],
    },
  ],
};

// ─── Streaming hook (ref-based, zero stale closures) ──────────────────────────
function useStreaming(lang: Lang) {
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<'idle'|'typing'|'thinking'|'streaming'|'done'>('idle');
  const [typedQ, setTypedQ] = useState('');
  const [doneLines, setDoneLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const ref = useRef({ lang, qa: DEMO_QA['en'], qi: 0, loop: true, timer: null as ReturnType<typeof setTimeout> | null });

  const stop = () => { if (ref.current.timer) { clearTimeout(ref.current.timer); ref.current.timer = null; } };

  const play = (idx: number) => {
    stop();
    ref.current.qi = idx;
    setQi(idx);
    const qa = ref.current.qa[idx];
    setPhase('idle'); setTypedQ(''); setDoneLines([]); setActiveLine('');

    let ci = 0;
    const typeChar = () => {
      ci++;
      setTypedQ(qa.q.slice(0, ci));
      setPhase('typing');
      if (ci < qa.q.length) {
        ref.current.timer = setTimeout(typeChar, ci < 4 ? 60 : Math.random() * 38 + 18);
      } else {
        setPhase('thinking');
        ref.current.timer = setTimeout(streamLines, 950);
      }
    };

    const streamLines = () => {
      setPhase('streaming');
      let li = 0, lci = 0;
      const tick = () => {
        const line = qa.lines[li];
        if (lci <= line.length) {
          setActiveLine(line.slice(0, lci));
          lci++;
          ref.current.timer = setTimeout(tick, lci < 2 ? 0 : Math.random() * 15 + 7);
        } else {
          setDoneLines(prev => [...prev, line]);
          setActiveLine('');
          li++; lci = 0;
          if (li < qa.lines.length) {
            ref.current.timer = setTimeout(tick, 150);
          } else {
            setPhase('done');
            if (ref.current.loop) {
              const next = (idx + 1) % ref.current.qa.length;
              ref.current.timer = setTimeout(() => play(next), 3800);
            }
          }
        }
      };
      ref.current.timer = setTimeout(tick, 0);
    };

    ref.current.timer = setTimeout(typeChar, 260);
  };

  useEffect(() => {
    ref.current.lang = lang;
    ref.current.qa = DEMO_QA[lang];
    ref.current.loop = true;
    stop();
    setQi(0); setPhase('idle'); setTypedQ(''); setDoneLines([]); setActiveLine('');
    const t = setTimeout(() => play(0), 600);
    return () => { clearTimeout(t); stop(); };
  }, [lang]);

  const jump = (idx: number) => {
    ref.current.loop = false;
    play(idx);
  };

  return { qi, phase, typedQ, doneLines, activeLine, jump };
}

// ─── Render bold markdown ─────────────────────────────────────────────────────
function MdLine({ text, style }: { text: string; style: React.CSSProperties }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{p.slice(2,-2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </p>
  );
}

// ─── Thinking dots ────────────────────────────────────────────────────────────
function Dots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '8px 0', alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <motion.div key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Immersive Hero ───────────────────────────────────────────────────────────
function ImmersiveHero({ onCTA, t, lang }: { onCTA: () => void; t: Record<string, string>; lang: Lang }) {
  const qa = DEMO_QA[lang];
  const { qi, phase, typedQ, doneLines, activeLine, jump } = useStreaming(lang);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [doneLines, activeLine, phase]);

  const ms: React.CSSProperties = { fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.58)', lineHeight: 1.75, margin: '0 0 8px', fontWeight: 400 };

  const badge = lang === 'pt' ? 'IA PARA PERFORMANCE MARKETING' : lang === 'es' ? 'IA PARA PERFORMANCE MARKETING' : 'AI FOR PERFORMANCE MARKETING';
  const qlabel = lang === 'pt' ? 'PERGUNTAS' : lang === 'es' ? 'PREGUNTAS' : 'QUESTIONS';
  const note = lang === 'pt' ? 'Conta demo. Com a sua, usa dados reais.' : lang === 'es' ? 'Cuenta demo. Con la tuya, usa datos reales.' : 'Demo. With your account, it uses real data.';
  const ctabtn = lang === 'pt' ? 'Testar com minha conta' : lang === 'es' ? 'Probar con mi cuenta' : 'Try with my account';
  const sample = lang === 'pt' ? 'Demo · Meta conectado' : lang === 'es' ? 'Demo · Meta conectado' : 'Demo · Meta connected';
  const conn = lang === 'pt' ? 'conectado' : lang === 'es' ? 'conectado' : 'connected';
  const h1 = t.hero_h1 || '';
  const h1p = h1.split('\n');
  const proofs: string[] = lang === 'pt'
    ? ['Conecta ao Meta Ads em 1 clique', 'Responde com seus dados reais', 'Cancele antes de 24h, sem cobranca']
    : lang === 'es'
    ? ['Conecta Meta Ads en 1 clic', 'Responde con tus datos reales', 'Cancela antes de 24h, sin cobro']
    : ['Connects to Meta Ads in 1 click', 'Answers with your real data, not templates', 'Cancel within 24h, no charge'];

  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: 'clamp(72px,9vw,100px) clamp(16px,4vw,40px) clamp(32px,5vw,60px)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(14,165,233,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }} className="hero-grid">

          {/* ── Copy ── */}
          <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease: [0.16,1,0.3,1] }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.07)', marginBottom: 22 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
              <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{badge}</span>
            </div>

            <h1 style={{ fontFamily: F, fontSize: 'clamp(36px,5.2vw,62px)', fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 0.97, margin: '0 0 20px', color: '#fff' }}>
              <span style={{ display: 'block' }}>{h1p[0] || h1}</span>
              {h1p[1] && (
                <span style={{ display: 'block', background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.78) 50%, rgba(255,255,255,0.45) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {h1p[1]}
                </span>
              )}
            </h1>

            <p style={{ fontFamily: F, fontSize: 'clamp(14px,1.5vw,16px)', color: 'rgba(255,255,255,0.36)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 390 }}>
              {t.hero_sub}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <button onClick={onCTA}
                style={{ fontFamily: F, fontSize: 15, fontWeight: 800, padding: '14px 30px', borderRadius: 12, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '-0.015em', alignSelf: 'flex-start', transition: 'transform 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                {t.hero_cta} <ArrowRight size={15} />
              </button>
              <a href="#how" style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                {t.hero_see} →
              </a>
            </div>

            <p style={{ fontFamily: F, fontSize: 11, color: 'rgba(255,255,255,0.15)', marginBottom: 18 }}>🔒 {t.hero_fine}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {proofs.map((pt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="6" stroke="rgba(52,211,153,0.4)" strokeWidth="1"/>
                    <path d="M4 6.5l1.8 1.8L9 4.5" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{pt}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Product window ── */}
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.14, ease: [0.16,1,0.3,1] }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(14,165,233,0.03)' }}>
              {/* Browser bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['rgba(255,95,86,0.5)','rgba(255,189,46,0.5)','rgba(39,201,63,0.5)'] as string[]).map((c,i) => (
                    <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 195, margin: '0 auto' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: "'DM Mono',monospace" }}>adbrief.pro/ai</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                  <div style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#0ea5e9', opacity: 0.7 }} />
                  <span style={{ fontFamily: F, fontSize: 9, color: 'rgba(14,165,233,0.5)', fontWeight: 700 }}>{sample}</span>
                </div>
              </div>

              {/* App body */}
              <div style={{ display: 'flex', background: '#06061a' }}>
                {/* Sidebar */}
                <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)', padding: '11px 7px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 9, background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.1)', marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#000', flexShrink: 0 }}>F</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: F, fontSize: 10.5, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>FitCore Brasil</p>
                      <p style={{ fontFamily: F, fontSize: 9, color: 'rgba(14,165,233,0.6)', margin: '1px 0 0' }}>Meta · 22 campaigns</p>
                    </div>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.14)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 3px', marginBottom: 2 }}>{qlabel}</p>
                  {qa.map((item, i) => (
                    <button key={i} onClick={() => jump(i)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 9px', borderRadius: 8, background: qi === i ? 'rgba(255,255,255,0.07)' : 'transparent', border: qi === i ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}
                      onMouseEnter={e => { if (qi !== i) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (qi !== i) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span style={{ fontSize: 11, flexShrink: 0, opacity: qi === i ? 1 : 0.4, marginTop: 1 }}>{['📉','⚡','✍️'][i]}</span>
                      <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: qi === i ? 500 : 400, color: qi === i ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{item.q.slice(0,38)}{item.q.length > 38 ? '...' : ''}</span>
                    </button>
                  ))}
                </div>

                {/* Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 19, height: 19, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✦</div>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: '#fff' }}>AdBrief AI</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                      <div style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#34d399' }} />
                      <span style={{ fontFamily: F, fontSize: 9, color: 'rgba(52,211,153,0.6)' }}>{conn}</span>
                    </div>
                  </div>

                  <div ref={chatRef} style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280, maxHeight: 340 }}>
                    {phase !== 'idle' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: '12px 12px 3px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.09)' }}>
                          <p style={{ fontFamily: F, fontSize: 12, color: 'rgba(255,255,255,0.88)', lineHeight: 1.5, margin: 0 }}>
                            {typedQ}
                            {phase === 'typing' && <span className="cursor-blink" style={{ display: 'inline-block', width: 2, height: 12, background: '#fff', marginLeft: 1, verticalAlign: 'middle' }} />}
                          </p>
                        </div>
                      </div>
                    )}
                    {(phase === 'thinking' || phase === 'streaming' || phase === 'done') && (
                      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 10, color: '#fff' }}>✦</div>
                        <div style={{ flex: 1 }}>
                          {phase === 'thinking' && <Dots />}
                          {(phase === 'streaming' || phase === 'done') && (
                            <>
                              {doneLines.map((line, i) => <MdLine key={i} text={line} style={{ ...ms, margin: (i === doneLines.length - 1 && !activeLine) ? '0' : '0 0 7px' }} />)}
                              {activeLine && <MdLine text={activeLine} style={{ ...ms, margin: '0' }} />}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '9px 13px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontFamily: F, fontSize: 10, color: 'rgba(255,255,255,0.2)', margin: 0 }}>{note}</p>
                    <button onClick={onCTA}
                      style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, padding: '6px 12px', borderRadius: 7, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                      {ctabtn} →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14, opacity: 0.25 }}>
              <span style={{ fontFamily: F, fontSize: 9, color: '#fff', letterSpacing: '0.14em', textTransform: 'uppercase' }}>BUILT ON</span>
              <div style={{ width: 1, height: 11, background: 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Anthropic</span>
              <div style={{ width: 1, height: 11, background: 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: '#fff' }}>OpenAI</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


// ─── Tools ─────────────────────────────────────────────────────────────────────
function Tools({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Section id="tools">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase' }}>{t.tools_label}</span>
          <h2 style={{ fontFamily: F, fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-0.04em', margin: '12px 0 10px', color: '#fff' }}>{t.tools_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: 'rgba(255,255,255,0.28)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>{t.tools_sub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 8 }}>
          {TOOLS_DATA.map(tool => {
            const isOpen = open === tool.id;
            return (
              <div key={tool.id}
                onClick={() => setOpen(isOpen ? null : tool.id)}
                style={{ borderRadius: 14, background: isOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (isOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'), cursor: 'pointer', transition: 'all 0.18s', overflow: 'hidden' }}
                onMouseEnter={e => { if (!isOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; }}}
                onMouseLeave={e => { if (!isOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.02)'; el.style.borderColor = 'rgba(255,255,255,0.05)'; }}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{tool.icon}</div>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', margin: 0, flex: 1 }}>{tool.name[lang]}</p>
                  <div style={{ color: 'rgba(255,255,255,0.2)', transition: 'transform 0.18s', transform: isOpen ? 'rotate(45deg)' : 'none', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </div>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.7, margin: '12px 0 0' }}>{tool.desc[lang]}</p>
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
    { n: "01", icon: <Plug size={20} />, color: "#0ea5e9", title: t.how_s1_title, desc: t.how_s1_desc },
    { n: "02", icon: <Users size={20} />, color: "#06b6d4", title: t.how_s2_title, desc: t.how_s2_desc },
    { n: "03", icon: <MessageSquare size={20} />, color: "#34d399", title: t.how_s3_title, desc: t.how_s3_desc },
  ];
  return (
    <Section id="how">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)" }}>{t.how_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.how_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.3)", maxWidth: 400, margin: "0 auto" }}>{t.how_sub}</p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ padding: "36px 28px", borderRadius: 20, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -25, right: -8, fontSize: 80, fontWeight: 900, color: "rgba(255,255,255,0.02)", fontFamily: F, lineHeight: 1, pointerEvents: "none" }}>{step.n}</div>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: `${step.color}10`, border: `1px solid ${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: step.color }}>{step.icon}</div>
              <h3 style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 12, lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>{step.desc}</p>
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
    <Section id="for">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)" }}>{t.for_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 0", color: "#fff" }}>{t.for_h2}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              fontFamily: F, fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 999, cursor: "pointer", transition: "all 0.2s",
              background: active === i ? `${pr.color}10` : "rgba(255,255,255,0.02)",
              color: active === i ? pr.color : "rgba(255,255,255,0.3)",
              border: `1px solid ${active === i ? pr.color + "28" : "rgba(255,255,255,0.05)"}`,
            }}>
              {pr.emoji} {pr.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            className="for-who-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ padding: "36px 30px", borderRadius: 22, background: `${p.color}05`, border: `1px solid ${p.color}12` }}>
              <span style={{ fontSize: 40, display: "block", marginBottom: 20 }}>{p.emoji}</span>
              <h3 style={{ fontFamily: F, fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 14, color: "#fff" }}>{p.headline}</h3>
              <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.75, marginBottom: 28 }}>{p.desc}</p>
              <button onClick={onCTA} style={{ fontFamily: F, fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 12, background: "#fff", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {t.for_cta} <ArrowRight size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.points.map((point) => (
                <div key={point} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${p.color}10`, border: `1px solid ${p.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} color={p.color} />
                  </div>
                  <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{point}</p>
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
function BeforeAfter({ t }: { t: Record<string, string> }) {
  const rows = [
    { before: t.ba_1_before, after: t.ba_1_after },
    { before: t.ba_2_before, after: t.ba_2_after },
    { before: t.ba_3_before, after: t.ba_3_after },
    { before: t.ba_4_before, after: t.ba_4_after },
  ];
  return (
    <Section>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)" }}>{t.ba_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "14px 0 0", color: "#fff" }}>{t.ba_h2}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <div style={{ padding: "12px 18px", borderRadius: "14px 14px 0 0", background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.ba_before_label}</span>
          </div>
          <div style={{ padding: "12px 18px", borderRadius: "14px 14px 0 0", background: "rgba(52,211,153,0.05)", textAlign: "center" }}>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.ba_after_label}</span>
          </div>
          {rows.map((row, i) => (
            <React.Fragment key={i}>
              <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: i === rows.length - 1 ? "0 0 0 14px" : 0 }}>
                <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.55, margin: 0 }}>{row.before}</p>
              </div>
              <div style={{ padding: "16px 18px", background: "rgba(52,211,153,0.03)", border: "1px solid rgba(52,211,153,0.08)", borderRadius: i === rows.length - 1 ? "0 0 14px 0" : 0 }}>
                <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.55, margin: 0 }}>{row.after}</p>
              </div>
            </React.Fragment>
          ))}
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
    <Section id="pricing">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)" }}>{t.pricing_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", margin: "14px 0 12px", color: "#fff" }}>{t.pricing_h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.3)", maxWidth: 420, margin: "0 auto 24px" }}>{t.pricing_sub}</p>
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
              background: plan.highlight ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
              border: `1px solid ${plan.highlight ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
              display: "flex", flexDirection: "column", gap: 22, position: "relative",
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 7, padding: "3px 14px", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: F, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#000", fontWeight: 800 }}>{plan.badge}</span>
                </div>
              )}
              <div>
                <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: F, fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>{plan.desc}</span>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check size={13} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{
                fontFamily: F, width: "100%", padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: plan.highlight ? "#fff" : "rgba(255,255,255,0.04)",
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
    <Section>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)" }}>{t.faq_label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", margin: "14px 0 0", color: "#fff" }}>{t.faq_h2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderRadius: 16, background: open === i ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.01)", border: `1px solid ${open === i ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`, overflow: "hidden", transition: "all 0.2s" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 14, textAlign: "left" }}>
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>{item.q}</span>
                <ChevronDown size={14} color={open === i ? "#fff" : "rgba(255,255,255,0.2)"} style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div style={{ padding: "0 22px 18px" }}>
                      <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.75 }}>{item.a}</p>
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
    <Section>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div style={{ padding: "72px 48px", borderRadius: 32, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(14,165,233,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <p style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.15em", fontWeight: 700, color: "rgba(14,165,233,0.6)", marginBottom: 20 }}>{t.final_label}</p>
            <h2 style={{ fontFamily: F, fontSize: "clamp(28px,4.5vw,44px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 16, whiteSpace: "pre-line", color: "#fff" }}>{t.final_h2}</h2>
            <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.3)", marginBottom: 36 }}>{t.final_sub}</p>
            <button onClick={onCTA} style={{
              fontFamily: F, fontSize: 16, fontWeight: 800, padding: "17px 40px", borderRadius: 14, background: "#fff", color: "#000", border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 0 60px rgba(255,255,255,0.06)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 0 80px rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(255,255,255,0.06)"; }}
            >
              {t.final_cta} <ArrowRight size={17} />
            </button>
            <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.15)", marginTop: 16 }}>{t.final_fine}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ t }: { t: Record<string, string> }) {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "36px clamp(16px,4vw,40px)" }}>
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
    en: "AdBrief — The AI that knows your ad account",
    pt: "AdBrief — A IA que conhece a sua conta de anúncios",
    es: "AdBrief — La IA que conoce tu cuenta de anuncios",
  };
  const descMap: Record<Lang, string> = {
    en: "Connect Meta, TikTok or Google Ads. Ask anything. AdBrief reads your data in real time.",
    pt: "Conecte Meta, TikTok ou Google Ads. Pergunte qualquer coisa. O AdBrief lê seus dados em tempo real.",
    es: "Conecta Meta, TikTok o Google Ads. Pregunta lo que quieras. AdBrief lee tus datos en tiempo real.",
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
        <style>{`
          @media(max-width:768px){
            .nav-links{display:none!important}
            .how-grid{grid-template-columns:1fr!important}
            .for-who-grid{grid-template-columns:1fr!important}
            .pricing-grid{grid-template-columns:1fr!important}
            .demo-sidebar{display:none!important}
            .hero-grid{grid-template-columns:1fr!important}
          }
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
          .cursor-blink{animation:blink 1s step-end infinite}
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
      <BeforeAfter t={t} />
      <Pricing onCTA={handleCTA} t={t} lang={lang} />
      <FAQ t={t} />
      <FinalCTA onCTA={handleCTA} t={t} />
      <Footer t={t} />
      <CookieConsent />
    </div>
  );
}
