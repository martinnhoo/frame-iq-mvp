// v3
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, MessageSquare, Plug, Users, ChevronDown, Globe } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const BG = "#060812";
// Static — no animations (better mobile compatibility)
const fade = (_delay = 0) => ({});
const fadeIn = (_delay = 0) => ({});

// ─── Types & Translations ────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_how: "How it works", nav_for: "Who it's for", nav_pricing: "Pricing", nav_signin: "Sign in", nav_cta: "Try free for 1 day →",
    hero_badge: "AI FOR PERFORMANCE MARKETING", hero_h1a: "Stop guessing.", hero_h1b: "Your ads already know.",
    hero_sub: "Connect Meta Ads in one click. Ask anything about your campaigns. Get answers in seconds — not reports.",
    hero_cta: "Try free for 1 day", hero_see: "See how it works", stat_budget: "Ad budget analyzed", stat_hooks: "Hooks generated", stat_rating: "Average rating", stat_roas: "Avg ROAS improvement",
    hero_fine: "1-day free trial · No charge for 24h · Cancel anytime", hero_roi: "Gestores recover 5–8h/week they were losing to manual reporting.", hero_built: "BUILT ON",
    how_label: "HOW IT WORKS", how_h2: "Three steps to your AI strategy partner.", how_sub: "Connect once. Ask forever. No CSV uploads. No manual data entry. Google Ads & TikTok coming Q2 2026.",
    how_s1_title: "Connect your ad accounts", how_s1_desc: "Link Meta, TikTok, or Google Ads in one click. AdBrief reads your real campaign data — spend, CTR, CPM, creative performance — in real time.",
    how_s2_title: "Set up your account", how_s2_desc: "Create an account for each brand or client. Add website, description, and connect Meta Ads — the AI uses this context for every answer.",
    how_s3_title: "Ask anything. Get real answers.", how_s3_desc: "Chat like ChatGPT — but AdBrief knows your actual account. Ask what's working, what to kill, what to produce next. It answers with your numbers.",
    for_label: "WHO IT'S FOR", for_h2: "Built for performance teams.", for_tab0: "Agencies", for_tab1: "Media Buyers", for_tab2: "In-house Teams",
    for_h0: "Manage 10 clients like you have a full data team.", for_d0: "Your team produces 20+ creatives a week across multiple brands. AdBrief connects to each client's ad account and gives your strategists real answers — which creatives to scale, which to kill, what to brief next.",
    for_h1: "Stop flying blind on creative decisions.", for_d1: "You're accountable for ROAS but don't always control the creative. AdBrief gives you data-backed answers — which format is underperforming, what the winning hook pattern is, what to brief next.",
    for_h2b: "Your campaigns, finally speaking to each other.", for_d2: "Connect your company's ad accounts and give your whole team access to a shared AI that knows your performance history. One place to ask, one place to know.",
    for_cta: "Try free for 1 day",
    for_p0_0: "Per-client accounts with their own Meta Ads connection",
    for_p0_1: "Real-time campaign performance in the chat",
    for_p0_2: "Brief generation tuned to each brand's winners",
    for_p0_3: "AI that knows each client's ad history and top hooks",
    for_p1_0: "Real spend and CTR data in every answer",
    for_p1_1: "Pattern detection across top and bottom performers",
    for_p1_2: "Competitor analysis and hook benchmarking",
    for_p1_3: "AI that learns your account patterns over time",
    for_p2_0: "Connected to your real Meta/TikTok/Google data",
    for_p2_1: "Personas for each product line or audience segment",
    for_p2_2: "Company profiles with brand context baked in",
    for_p2_3: "Team-wide access to shared campaign intelligence",
    pricing_label: "PRICING", pricing_h2: "Start with a free day. Stay because it works.", pricing_sub: "Every plan includes a 1-day free trial. No charge until it's over.", pricing_anchor: "For a gestor managing $5k/month in ads: AdBrief costs less than 0.4% of your budget.",
    pricing_card: "No charge for 24 hours · Cancel anytime · Refund policy available", pricing_cta: "Start free trial", pricing_note: "1-day trial · Cancel anytime",
    plan_badge_pro: "Most popular",
    plan_maker_f0: "50 AI messages / day",
    plan_maker_f1: "1 ad account (Meta, TikTok or Google)",
    plan_maker_f2: "All tools unlocked (hooks, scripts, briefs)",
    plan_maker_f3: "Up to 3 ad accounts",
    plan_pro_f0: "200 AI messages / day",
    plan_pro_f1: "3 ad accounts connected",
    plan_pro_f2: "All tools unlocked",
    plan_pro_f3: "Unlimited accounts + brands",
    plan_pro_f4: "Multi-market support",
    plan_studio_f0: "Unlimited AI messages",
    plan_studio_f1: "Unlimited ad accounts",
    plan_studio_f2: "All tools unlocked",
    plan_studio_f3: "Unlimited accounts + brands",
    plan_studio_f4: "Agency client workspace",
    faq_label: "FAQ", faq_h2: "Common questions",
    faq_q0: "How does the 1-day free trial work?", faq_a0: "When you sign up for any plan, you get full access for 24 hours at no charge. If you cancel within that period, you won't be billed. If you don't cancel, your subscription starts automatically after 24 hours.",
    faq_q1: "Why do I need a card to start?", faq_a1: "Requiring a card filters for serious users and lets us give you genuine full access — not a watered-down demo. We don't charge anything for 24 hours and you can cancel instantly from your account settings.",
    faq_q2: "What does AdBrief connect to?", faq_a2: "Meta Ads (Facebook & Instagram), TikTok Ads, and Google Ads. Once connected, AdBrief reads your campaign data in real time and uses it to answer your questions in the AI chat.",
    faq_q3: "Is my ad account data secure?", faq_a3: "Yes. We use OAuth — the same standard used by every major ad tool. We never store your login credentials. Access tokens are encrypted at rest. You can disconnect any account at any time.",
    faq_q4: "Can I use AdBrief for multiple clients?", faq_a4: "Yes. Pro supports 3 ad accounts and unlimited personas/brands. Studio supports unlimited connections and includes a dedicated agency workspace. Most agencies use one persona per brand or market.",
    faq_q5: "What is an Account in AdBrief?", faq_a5: "An Account is a brand or client profile that connects to its own Meta Ads account. Add a name, website, and description — the AI uses this context to give you specific, relevant answers for that account.",
    faq_q6: "Does it work with catalog ads and DPA?", faq_a6: "Yes. AdBrief reads all campaign types from Meta — including dynamic ads, catalog campaigns, and Advantage+ Shopping. You can ask questions about any of them in the chat.",
    faq_q7: "What if it doesn't work for me?", faq_a7: "If you don't see value in the first 24 hours, cancel and you won't be charged. If you're on a paid plan and feel the product didn't deliver, email us — we handle refund requests case by case and we'd rather keep you happy than keep your money.",
    final_label: "START TODAY", final_h2: "Your ad account is full of insights. Start asking.", final_sub: "Connect in 2 minutes. Cancel anytime within the first day.",
    final_cta: "Try free for 1 day", final_fine: "Any plan · 1-day free trial · Cancel before 24h, pay nothing", footer_copy: "© 2026 AdBrief",
    chat_q1: "My fitness ads ROAS dropped 40% — what's happening?",
    chat_a1: "FitCore's top 3 gym ads hit creative fatigue — same transformation visuals for 22 days. CPM up 41%, CTR dropped from 3.1% to 1.4%. Your January winner (before/after hook + limited-time offer) hasn't run since week 3. That's your fix.",
    chat_q2: "Write 3 hooks for FitCore's new summer cut program",
    chat_a2: "Based on FitCore's top converters, 3 hooks for the summer cut:\n\n1. \"Still carrying winter weight in July? FitCore's 8-week cut plan starts today.\"\n2. \"Your gym membership isn't enough. Here's what FitCore members do differently.\"\n3. \"3,200 people started FitCore's summer program this month. Most saw results in week 2.\"",
    chat_placeholder: "Ask anything about your campaigns...",
  },
  pt: {
    nav_how: "Como funciona", nav_for: "Para quem é", nav_pricing: "Preços", nav_signin: "Entrar", nav_cta: "Testar grátis por 1 dia →",
    hero_badge: "IA PARA PERFORMANCE MARKETING", hero_h1a: "A IA que conhece", hero_h1b: "a sua conta de anúncios.",
    hero_sub: "Conexão oficial com Meta Ads. Dados reais de campanha. IA que pensa como um gestor de tráfego sênior.",
    hero_cta: "Testar grátis por 1 dia", hero_see: "Ver como funciona", stat_budget: "Budget de anúncios analisado", stat_hooks: "Hooks gerados", stat_rating: "Avaliação média", stat_roas: "Melhoria média de ROAS",
    hero_fine: "1 dia de teste grátis · Sem cobrança por 24h · Cancele quando quiser", hero_roi: "Gestores recuperam 5–8h/semana que perdiam em relatórios manuais.", hero_built: "DESENVOLVIDO COM",
    how_label: "COMO FUNCIONA", how_h2: "Três passos para seu parceiro de estratégia com IA.", how_sub: "Conecte uma vez. Pergunte para sempre. Sem uploads de CSV. Sem entrada manual. Google Ads & TikTok em breve.",
    how_s1_title: "Conecte suas contas de anúncios", how_s1_desc: "Vincule Meta, TikTok ou Google Ads com um clique. O AdBrief lê seus dados reais de campanha — investimento, CTR, CPM, performance de criativos — em tempo real.",
    how_s2_title: "Configure sua conta", how_s2_desc: "Crie uma conta para cada marca ou cliente. Adicione site, descrição e conecte o Meta Ads — a IA usa esse contexto em cada resposta.",
    how_s3_title: "Pergunte qualquer coisa. Receba respostas reais.", how_s3_desc: "Converse como no ChatGPT — mas o AdBrief conhece sua conta de verdade. Pergunte o que está funcionando, o que cortar, o que produzir a seguir. Ele responde com seus números.",
    for_label: "PARA QUEM É", for_h2: "Feito para equipes de performance.", for_tab0: "Agências", for_tab1: "Media Buyers", for_tab2: "Times Internos",
    for_h0: "Gerencie 10 clientes como se tivesse um time de dados completo.", for_d0: "Seu time produz mais de 20 criativos por semana para várias marcas. O AdBrief conecta à conta de anúncios de cada cliente e dá respostas reais aos seus estrategistas — quais criativos escalar, quais pausar, o que briefar a seguir.",
    for_h1: "Pare de tomar decisões criativas no escuro.", for_d1: "Você é responsável pelo ROAS mas nem sempre controla o criativo. O AdBrief te dá respostas baseadas em dados — qual formato está underperformando, qual é o padrão de hook vencedor, o que briefar a seguir.",
    for_h2b: "Suas campanhas finalmente falando entre si.", for_d2: "Conecte as contas de anúncios da sua empresa e dê ao seu time inteiro acesso a uma IA compartilhada que conhece seu histórico de performance. Um lugar para perguntar, um lugar para saber.",
    for_cta: "Testar grátis por 1 dia",
    for_p0_0: "Contas por cliente com conexão própria ao Meta Ads",
    for_p0_1: "Performance das campanhas em tempo real no chat",
    for_p0_2: "Geração de brief calibrada nos vencedores de cada marca",
    for_p0_3: "IA que conhece o histórico e os melhores hooks de cada cliente",
    for_p1_0: "Dados reais de investimento e CTR em cada resposta",
    for_p1_1: "Detecção de padrões entre os melhores e piores performers",
    for_p1_2: "Análise de concorrentes e benchmarking de hooks",
    for_p1_3: "Memória da conta que melhora a cada consulta",
    for_p2_0: "Conectado aos seus dados reais de Meta/TikTok/Google",
    for_p2_1: "Personas para cada linha de produto ou segmento de audiência",
    for_p2_2: "Perfis de empresa com contexto de marca integrado",
    for_p2_3: "Acesso de toda a equipe à inteligência compartilhada de campanhas",
    pricing_label: "PREÇOS", pricing_h2: "Comece com um dia grátis. Fique porque funciona.", pricing_sub: "Todo plano inclui 1 dia de teste grátis. Sem cobrança enquanto durar.",
    pricing_card: "Sem cobrança por 24h · Cancele quando quiser · Política de reembolso disponível", pricing_cta: "Começar teste grátis", pricing_note: "1 dia de teste · Cancele quando quiser",
    plan_badge_pro: "Mais popular",
    plan_maker_f0: "50 mensagens de IA / dia",
    plan_maker_f1: "1 conta de anúncios (Meta, TikTok ou Google)",
    plan_maker_f2: "Todas as ferramentas liberadas (hooks, scripts, briefs)",
    plan_maker_f3: "Até 3 contas de anúncios",
    plan_pro_f0: "200 mensagens de IA / dia",
    plan_pro_f1: "3 contas de anúncios conectadas",
    plan_pro_f2: "Todas as ferramentas liberadas",
    plan_pro_f3: "Contas e marcas ilimitadas",
    plan_pro_f4: "Suporte a múltiplos mercados",
    plan_studio_f0: "Mensagens de IA ilimitadas",
    plan_studio_f1: "Contas de anúncios ilimitadas",
    plan_studio_f2: "Todas as ferramentas liberadas",
    plan_studio_f3: "Contas e marcas ilimitadas",
    plan_studio_f4: "Workspace para clientes de agência",
    faq_label: "PERGUNTAS FREQUENTES", faq_h2: "Dúvidas comuns",
    faq_q0: "Como funciona o teste grátis de 1 dia?", faq_a0: "Ao se cadastrar em qualquer plano, você tem acesso completo por 24 horas sem nenhuma cobrança. Se cancelar dentro desse período, não será cobrado. Se não cancelar, sua assinatura começa automaticamente após 24 horas.",
    faq_q1: "Por que preciso de cartão para começar?", faq_a1: "Exigir cartão filtra usuários sérios e nos permite dar acesso genuíno — não uma demo limitada. Não cobramos nada em 24 horas e você pode cancelar instantaneamente nas configurações da sua conta.",
    faq_q2: "O que o AdBrief conecta?", faq_a2: "Meta Ads (Facebook e Instagram), TikTok Ads e Google Ads. Ao conectar, o AdBrief lê seus dados de campanha em tempo real e os usa para responder suas perguntas no chat de IA.",
    faq_q3: "Os dados da minha conta de anúncios são seguros?", faq_a3: "Sim. Usamos OAuth — o mesmo padrão usado por todas as principais ferramentas de anúncios. Nunca armazenamos suas credenciais de login. Os tokens de acesso são criptografados. Você pode desconectar qualquer conta a qualquer momento.",
    faq_q4: "Posso usar o AdBrief para vários clientes?", faq_a4: "Sim. O Pro suporta 3 contas de anúncios e personas/marcas ilimitadas. O Studio suporta conexões ilimitadas e inclui um workspace dedicado para agências. A maioria usa uma persona por marca ou mercado.",
    faq_q5: "O que é uma Conta no AdBrief?", faq_a5: "Uma Conta é o perfil de uma marca ou cliente que conecta à própria conta do Meta Ads. Adicione nome, site e descrição — a IA usa esse contexto para te dar respostas específicas para aquela conta.",
    faq_q6: "Funciona com anúncios de catálogo e DPA?", faq_a6: "Sim. O AdBrief lê todos os tipos de campanha do Meta — incluindo anúncios dinâmicos, campanhas de catálogo e Advantage+ Shopping. Você pode perguntar sobre qualquer um deles no chat.",
    faq_q7: "E se não funcionar para mim?", faq_a7: "Se não ver valor nas primeiras 24 horas, cancele e não será cobrado. Se estiver em um plano pago e sentir que o produto não entregou, mande um e-mail — resolvemos casos de reembolso individualmente. Preferimos manter você feliz do que ficar com o seu dinheiro.",
    final_label: "COMECE HOJE", final_h2: "Sua conta de anúncios está cheia de insights. Comece a perguntar.", final_sub: "Conecte em 2 minutos. Cancele quando quiser dentro do primeiro dia.",
    final_cta: "Testar grátis por 1 dia", final_fine: "Qualquer plano · 1 dia de teste grátis · Cancele antes de 24h, não paga nada", footer_copy: "© 2026 AdBrief",
    chat_q1: "Meu ROAS de fitness caiu 40% — o que está acontecendo?",
    chat_a1: "Os 3 principais anúncios da FitCore estão em fadiga — mesmos visuais de transformação há 22 dias. CPM subiu 41%, CTR caiu de 3,1% para 1,4%. Seu hook vencedor de janeiro (antes/depois + oferta limitada) não roda desde a semana 3. É aí que está o problema.",
    chat_q2: "Escreva 3 hooks para o novo programa de cutting de verão da FitCore",
    chat_a2: "Com base nos melhores conversores da FitCore, 3 hooks para o cutting de verão:\n\n1. \"Ainda carregando o peso do inverno em julho? O programa de 8 semanas da FitCore começa hoje.\"\n2. \"Sua academia não é suficiente. Veja o que os membros da FitCore fazem de diferente.\"\n3. \"3.200 pessoas começaram o programa de verão da FitCore esse mês. A maioria viu resultado na semana 2.\"",
    chat_placeholder: "Pergunte qualquer coisa sobre suas campanhas...",
  },
  es: {
    nav_how: "Cómo funciona", nav_for: "Para quién es", nav_pricing: "Precios", nav_signin: "Iniciar sesión", nav_cta: "Probar gratis 1 día →",
    hero_badge: "IA PARA PERFORMANCE MARKETING", hero_h1a: "La IA que conoce", hero_h1b: "tu cuenta de anuncios.",
    hero_sub: "Conexión oficial con Meta Ads. Datos reales de campaña. IA que piensa como un media buyer senior.",
    hero_cta: "Probar gratis 1 día", hero_see: "Ver cómo funciona", stat_budget: "Budget de anuncios analizado", stat_hooks: "Hooks generados", stat_rating: "Valoración media", stat_roas: "Mejora media de ROAS",
    hero_fine: "1 día de prueba gratis · Sin cobro por 24h · Cancela cuando quieras", hero_roi: "Los gestores recuperan 5–8h/semana que perdían en reportes manuales.", hero_built: "DESARROLLADO CON",
    how_label: "CÓMO FUNCIONA", how_h2: "Tres pasos para tu socio de estrategia con IA.", how_sub: "Conecta una vez. Pregunta para siempre. Sin subidas de CSV. Sin entrada manual de datos.",
    how_s1_title: "Conecta tus cuentas de anuncios", how_s1_desc: "Vincula Meta, TikTok o Google Ads con un clic. AdBrief lee tus datos reales de campaña — inversión, CTR, CPM, rendimiento de creativos — en tiempo real.",
    how_s2_title: "Configura tu persona o marca", how_s2_desc: "Dile a AdBrief a quién le estás anunciando. Crea perfiles de audiencia o de marca — la IA los usa para darte respuestas específicas para tu mercado.",
    how_s3_title: "Pregunta lo que quieras. Obtén respuestas reales.", how_s3_desc: "Chatea como con ChatGPT — pero AdBrief conoce tu cuenta de verdad. Pregunta qué está funcionando, qué pausar, qué producir a continuación. Responde con tus números.",
    for_label: "PARA QUIÉN ES", for_h2: "Hecho para equipos de performance.", for_tab0: "Agencias", for_tab1: "Media Buyers", for_tab2: "Equipos Internos",
    for_h0: "Gestiona 10 clientes como si tuvieras un equipo de datos completo.", for_d0: "Tu equipo produce más de 20 creativos por semana para varias marcas. AdBrief se conecta a la cuenta de anuncios de cada cliente y da respuestas reales a tus estrategas — qué creativos escalar, cuáles pausar, qué briefear a continuación.",
    for_h1: "Deja de tomar decisiones creativas a ciegas.", for_d1: "Eres responsable del ROAS pero no siempre controlas el creativo. AdBrief te da respuestas basadas en datos — qué formato está bajo rendimiento, cuál es el patrón de hook ganador, qué briefear a continuación.",
    for_h2b: "Tus campañas finalmente hablando entre sí.", for_d2: "Conecta las cuentas de anuncios de tu empresa y da a todo tu equipo acceso a una IA compartida que conoce tu historial de rendimiento. Un lugar para preguntar, un lugar para saber.",
    for_cta: "Probar gratis 1 día",
    for_p0_0: "Personas por cliente con su propio contexto de datos",
    for_p0_1: "Rendimiento de campañas en tiempo real en el chat",
    for_p0_2: "Generación de brief ajustada a los ganadores de cada marca",
    for_p0_3: "Memoria de IA que aprende los mejores hooks de cada cliente",
    for_p1_0: "Datos reales de inversión y CTR en cada respuesta",
    for_p1_1: "Detección de patrones entre los mejores y peores performers",
    for_p1_2: "Análisis de competidores y benchmarking de hooks",
    for_p1_3: "Memoria de cuenta que mejora con cada consulta",
    for_p2_0: "Conectado a tus datos reales de Meta/TikTok/Google",
    for_p2_1: "Personas para cada línea de producto o segmento de audiencia",
    for_p2_2: "Perfiles de empresa con contexto de marca integrado",
    for_p2_3: "Acceso de todo el equipo a la inteligencia compartida de campañas",
    pricing_label: "PRECIOS", pricing_h2: "Empieza con un día gratis. Quédate porque funciona.", pricing_sub: "Todos los planes incluyen 1 día de prueba gratis. Sin cargo hasta que termine.",
    pricing_card: "Sin cobro por 24h · Cancela cuando quieras", pricing_cta: "Empezar prueba gratis", pricing_note: "1 día de prueba · Cancela cuando quieras",
    plan_badge_pro: "Más popular",
    plan_maker_f0: "50 mensajes de IA / día",
    plan_maker_f1: "1 cuenta de anuncios (Meta, TikTok o Google)",
    plan_maker_f2: "Todas las herramientas desbloqueadas (hooks, scripts, briefs)",
    plan_maker_f3: "Hasta 3 personas o marcas",
    plan_pro_f0: "200 mensajes de IA / día",
    plan_pro_f1: "3 cuentas de anuncios conectadas",
    plan_pro_f2: "Todas las herramientas desbloqueadas",
    plan_pro_f3: "Personas y marcas ilimitadas",
    plan_pro_f4: "Soporte multi-mercado",
    plan_studio_f0: "Mensajes de IA ilimitados",
    plan_studio_f1: "Cuentas de anuncios ilimitadas",
    plan_studio_f2: "Todas las herramientas desbloqueadas",
    plan_studio_f3: "Personas y marcas ilimitadas",
    plan_studio_f4: "Workspace para clientes de agencia",
    faq_label: "PREGUNTAS FRECUENTES", faq_h2: "Preguntas comunes",
    faq_q0: "¿Cómo funciona la prueba gratis de 1 día?", faq_a0: "Al registrarte en cualquier plan, obtienes acceso completo durante 24 horas sin ningún cargo. Si cancelas dentro de ese período, no se te cobrará. Si no cancelas, tu suscripción comienza automáticamente después de 24 horas.",
    faq_q1: "¿Por qué necesito una tarjeta para empezar?", faq_a1: "Requerir tarjeta filtra a los usuarios serios y nos permite darte acceso genuino — no una demo limitada. No cobramos nada durante 24 horas y puedes cancelar instantáneamente desde la configuración de tu cuenta.",
    faq_q2: "¿A qué se conecta AdBrief?", faq_a2: "Meta Ads (Facebook e Instagram), TikTok Ads y Google Ads. Una vez conectado, AdBrief lee tus datos de campaña en tiempo real y los usa para responder tus preguntas en el chat de IA.",
    faq_q3: "¿Son seguros los datos de mi cuenta de anuncios?", faq_a3: "Sí. Usamos OAuth — el mismo estándar que usan todas las principales herramientas de anuncios. Nunca almacenamos tus credenciales de inicio de sesión. Los tokens de acceso están cifrados. Puedes desconectar cualquier cuenta en cualquier momento.",
    faq_q4: "¿Puedo usar AdBrief para varios clientes?", faq_a4: "Sí. Pro soporta 3 cuentas de anuncios y personas/marcas ilimitadas. Studio soporta conexiones ilimitadas e incluye un workspace dedicado para clientes de agencia.",
    faq_q5: "¿Qué es una persona en AdBrief?", faq_a5: "Una persona es un perfil de audiencia que le da contexto a la IA — a quién le estás segmentando, qué mercado, qué plataforma, cuáles son sus objeciones. La IA usa esto para personalizar cada respuesta a esa audiencia específica.", faq_q6: "¿Funciona con anuncios de catálogo y DPA?", faq_a6: "Sí. AdBrief lee todos los tipos de campaña de Meta — incluyendo anuncios dinámicos, campañas de catálogo y Advantage+ Shopping. Puedes preguntar sobre cualquiera de ellos en el chat.", faq_q7: "¿Qué pasa si no funciona para mí?", faq_a7: "Si no ves valor en las primeras 24 horas, cancela y no se te cobrará. Si estás en un plan de pago y sientes que el producto no entregó, escríbenos — manejamos reembolsos caso por caso. Preferimos que estés feliz.",
    final_label: "EMPIEZA HOY", final_h2: "Tu cuenta de anuncios está llena de insights. Empieza a preguntar.", final_sub: "Conéctate en 2 minutos. Cancela cuando quieras dentro del primer día.",
    final_cta: "Probar gratis 1 día", final_fine: "Cualquier plan · 1 día de prueba gratis · Cancela antes de 24h, no pagas nada", footer_copy: "© 2026 AdBrief",
    chat_q1: "Mi ROAS de fitness bajó 40% — ¿qué está pasando?",
    chat_a1: "Los 3 anuncios principales de FitCore están en fatiga creativa — los mismos visuales de transformación llevan 22 días. CPM subió 41%, CTR cayó de 3,1% a 1,4%. Tu hook ganador de enero (antes/después + oferta limitada) no corre desde la semana 3. Ahí está el problema.",
    chat_q2: "Escríbeme 3 hooks para el nuevo programa de cutting de verano de FitCore",
    chat_a2: "Basándome en los mejores conversores de FitCore, 3 hooks para el cutting de verano:\n\n1. \"¿Todavía cargando el peso del invierno en julio? El programa de 8 semanas de FitCore empieza hoy.\"\n2. \"Tu gimnasio no es suficiente. Mira lo que hacen diferente los miembros de FitCore.\"\n3. \"3.200 personas empezaron el programa de verano de FitCore este mes. La mayoría vio resultados en la semana 2.\"",
    chat_placeholder: "Pregunta lo que quieras sobre tus campañas...",
  },
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

// Language switcher
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const labels: Record<Lang, string> = { en: "EN", pt: "PT", es: "ES" };
  const flags: Record<Lang, string> = { en: "🇺🇸", pt: "🇧🇷", es: "🇲🇽" };
  const pick = (l: Lang) => { setLang(l); localStorage.setItem("adbrief_language", l); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Globe size={11} /> {flags[lang]} {labels[lang]}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", zIndex: 999, minWidth: 90 }}>
            {(["en", "pt", "es"] as Lang[]).map(l => (
              <button key={l} onClick={() => pick(l)} style={{ width: "100%", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: lang === l ? "rgba(14,165,233,0.1)" : "transparent", border: "none", color: lang === l ? "#0ea5e9" : "rgba(255,255,255,0.55)", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {flags[l]} {labels[l]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tools data (used in Nav + Tools section) ────────────────────────────────
const TOOLS_DATA = [
  {
    id: "hooks",
    icon: "⚡",
    name_en: "Hook Generator", name_pt: "Gerador de Hooks", name_es: "Generador de Hooks",
    desc_en: "Generate scroll-stopping hooks based on your top-performing creatives. The AI analyzes your winners and writes in the same pattern.",
    desc_pt: "Gere hooks que param o scroll baseados nos seus melhores criativos. A IA analisa seus winners e escreve no mesmo padrão.",
    desc_es: "Genera hooks que detienen el scroll basados en tus mejores creativos. La IA analiza tus ganadores y escribe en el mismo patrón.",
    color: "#0ea5e9",
  },
  {
    id: "script",
    icon: "🎬",
    name_en: "Video Script", name_pt: "Script de Vídeo", name_es: "Script de Video",
    desc_en: "Full UGC and direct-response video scripts tuned to your account. VO, on-screen text, and visual notes in one click.",
    desc_pt: "Scripts completos de UGC e direct-response calibrados para sua conta. VO, texto on-screen e notas visuais em um clique.",
    desc_es: "Scripts completos de UGC y direct-response calibrados para tu cuenta. VO, texto en pantalla y notas visuales en un clic.",
    color: "#a78bfa",
  },
  {
    id: "brief",
    icon: "📋",
    name_en: "Creative Brief", name_pt: "Brief Criativo", name_es: "Brief Creativo",
    desc_en: "Data-backed creative briefs that tell your team exactly what to produce next — format, angle, hook, and target audience.",
    desc_pt: "Briefs criativos baseados em dados que dizem ao seu time o que produzir — formato, ângulo, hook e público-alvo.",
    desc_es: "Briefs creativos respaldados por datos que le dicen a tu equipo qué producir — formato, ángulo, hook y audiencia.",
    color: "#34d399",
  },
  {
    id: "competitor",
    icon: "🔍",
    name_en: "Competitor Decode", name_pt: "Decodificador de Concorrente", name_es: "Decodificador de Competidores",
    desc_en: "Paste a competitor ad. The AI breaks down hook type, format, angle, and CTA — and tells you how to beat it.",
    desc_pt: "Cole um anúncio do concorrente. A IA desmonta o hook, formato, ângulo e CTA — e diz como superá-lo.",
    desc_es: "Pega un anuncio de la competencia. La IA desmonta el hook, formato, ángulo y CTA — y te dice cómo superarlo.",
    color: "#f97316",
  },
  {
    id: "translate",
    icon: "🌐",
    name_en: "Ad Translator", name_pt: "Tradutor de Anúncios", name_es: "Traductor de Anuncios",
    desc_en: "Translate and localize your best ads across markets. Not just words — tone, idioms, and platform norms adapted automatically.",
    desc_pt: "Traduza e localize seus melhores anúncios para outros mercados. Não só palavras — tom, expressões e normas da plataforma adaptados.",
    desc_es: "Traduce y localiza tus mejores anuncios para otros mercados. No solo palabras — tono, expresiones y normas de plataforma adaptados.",
    color: "#ec4899",
  },
  {
    id: "analysis",
    icon: "📊",
    name_en: "Campaign Analysis", name_pt: "Análise de Campanha", name_es: "Análisis de Campaña",
    desc_en: "Ask anything about your Meta Ads data. The AI reads your real numbers — CPM, ROAS, CTR, frequency — and gives a direct diagnosis.",
    desc_pt: "Pergunte qualquer coisa sobre seus dados do Meta Ads. A IA lê seus números reais — CPM, ROAS, CTR, frequência — e dá um diagnóstico direto.",
    desc_es: "Pregunta lo que quieras sobre tus datos de Meta Ads. La IA lee tus números reales — CPM, ROAS, CTR, frecuencia — y da un diagnóstico directo.",
    color: "#0ea5e9",
  },
];

function getToolName(tool: typeof TOOLS_DATA[0], lang: string) {
  if (lang === "pt") return tool.name_pt;
  if (lang === "es") return tool.name_es;
  return tool.name_en;
}
function getToolDesc(tool: typeof TOOLS_DATA[0], lang: string) {
  if (lang === "pt") return tool.desc_pt;
  if (lang === "es") return tool.desc_es;
  return tool.desc_en;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ onCTA, t, lang, setLang }: { onCTA: () => void; t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void }) {
  const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,8,18,0.9)", backdropFilter: "blur(20px)", padding: "0 clamp(12px, 4vw, 32px)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <Logo size="lg" />
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {([[t.nav_how, "#how"], [t.nav_for, "#for"], [t.nav_pricing, "#pricing"], [t.nav_tools || "Tools", "#tools"]] as [string, string][]).map(([label, href]) => (
            <a key={href} href={href} style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}>
              {label}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="nav-links"><LangSwitcher lang={lang} setLang={setLang} /></span>
          <button onClick={() => window.location.href = "/login"} className="nav-links"
            style={{ fontFamily: F, fontSize: 13, padding: "8px 16px", borderRadius: 9, background: "transparent", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>{t.nav_signin}</button>
          <button onClick={onCTA}
            style={{ fontFamily: F, fontSize: "clamp(11px,3vw,13px)", fontWeight: 700, padding: "8px clamp(12px,3vw,20px)", borderRadius: 9, background: BRAND, color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>{t.nav_cta}</button>
        </div>
      </div>
    </nav>
  );
}

// ─── Demo Hero (replaces Hero + ChatMockup) ───────────────────────────────────
function DemoHero({ onCTA, t, lang }: { onCTA: () => void; t: Record<string, string>; lang: Lang }) {
  const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  const BLUE = "#0ea5e9";
  const TEAL = "#06b6d4";

  type QA = { id: number; emoji: string; short: string; full: string; answer: string[] };

  const QS: QA[] = [
    {
      id: 0,
      emoji: "📉",
      short: lang === "pt" ? "Meu ROAS caiu 40% essa semana" : lang === "es" ? "Mi ROAS bajó 40% esta semana" : "My ROAS dropped 40% this week",
      full: lang === "pt" ? "Meu ROAS de fitness caiu 40% essa semana. O que está acontecendo?" : lang === "es" ? "Mi ROAS de fitness bajó 40% esta semana. ¿Qué está pasando?" : "My fitness ads ROAS dropped 40% this week. What is happening?",
      answer: lang === "pt" ? [
        "Identifiquei 3 causas simultâneas na sua conta:",
        "**Fadiga criativa** — o Creative_042 tem 22 dias rodando. Hook rate caiu de 31% para 11%. O público decorou o anúncio.",
        "**Frequência 4.8x** — conjunto BR-Mulheres-25-34 supersaturado. Cada real gasto agora vai para quem já viu 5 vezes.",
        "**CPM +38%** — o algoritmo percebeu a queda de relevância e está cobrando mais caro para entregar.",
        "Ação: pause Creative_042, relance Creative_019 (ROAS 3.2x, parado há 9 dias) e divida o conjunto saturado em 2.",
      ] : lang === "es" ? [
        "Identifiqué 3 causas simultáneas en tu cuenta:",
        "**Fatiga creativa** — Creative_042 lleva 22 días corriendo. Hook rate cayó de 31% a 11%. La audiencia memorizó el anuncio.",
        "**Frecuencia 4.8x** — conjunto BR-Mujeres-25-34 supersaturado. Cada peso gastado va a quien ya vio el anuncio 5 veces.",
        "**CPM +38%** — el algoritmo detectó la caída de relevancia y cobra más caro para entregar.",
        "Acción: pausa Creative_042, relanza Creative_019 (ROAS 3.2x, pausado hace 9 días) y divide el conjunto saturado en 2.",
      ] : [
        "I found 3 simultaneous causes in your account:",
        "**Creative fatigue** — Creative_042 has been running 22 days. Hook rate fell from 31% to 11%. The audience has memorized the ad.",
        "**Frequency 4.8x** — BR-Women-25-34 ad set is oversaturated. Every dollar spent goes to someone who saw it 5 times already.",
        "**CPM +38%** — the algorithm detected the relevance drop and is charging more to deliver.",
        "Action: pause Creative_042, relaunch Creative_019 (ROAS 3.2x, paused 9 days) and split the saturated set in 2.",
      ],
    },
    {
      id: 1,
      emoji: "⚡",
      short: lang === "pt" ? "Quais anúncios pausar agora?" : lang === "es" ? "¿Cuáles anuncios pausar ahora?" : "Which ads should I pause now?",
      full: lang === "pt" ? "Quais dos meus anúncios devo pausar imediatamente?" : lang === "es" ? "¿Cuáles de mis anuncios debo pausar inmediatamente?" : "Which of my ads should I pause immediately?",
      answer: lang === "pt" ? [
        "3 anúncios para pausar hoje — cada um por motivo diferente:",
        "**Creative_038** — CPM R$ 91, CTR 0,4%, zero conversões em 7 dias. Queima R$ 180/dia sem retorno.",
        "**Conjunto BR-Homens-35-44** — ROAS 0,6x, frequência 5.1. Você está pagando para irritar audiência exaurida.",
        "**Creative_029** — hook rate 8% (seu mínimo é 15%). 92% dos usuários foram embora nos primeiros 3 segundos.",
        "Total: R$ 620/dia com retorno negativo. Pausar libera verba para Creative_019 (ROAS 3.2x, underserved).",
      ] : lang === "es" ? [
        "3 anuncios para pausar hoy — cada uno por motivo diferente:",
        "**Creative_038** — CPM $18, CTR 0.4%, cero conversiones en 7 días. Quema $180/día sin retorno.",
        "**Conjunto BR-Hombres-35-44** — ROAS 0.6x, frecuencia 5.1. Pagas para irritar a una audiencia agotada.",
        "**Creative_029** — hook rate 8% (tu mínimo es 15%). 92% de usuarios se fueron en los primeros 3 segundos.",
        "Total: $620/día con retorno negativo. Pausar libera presupuesto para Creative_019 (ROAS 3.2x, underserved).",
      ] : [
        "3 ads to pause today — each for a different reason:",
        "**Creative_038** — CPM $18, CTR 0.4%, zero conversions in 7 days. Burning $180/day with no return.",
        "**BR-Men-35-44 ad set** — ROAS 0.6x, frequency 5.1. You are paying to annoy an exhausted audience.",
        "**Creative_029** — hook rate 8% (your floor is 15%). 92% of users left in the first 3 seconds.",
        "Total: $620/day burning with negative return. Pausing frees budget for Creative_019 (ROAS 3.2x, underserved).",
      ],
    },
    {
      id: 2,
      emoji: "✍️",
      short: lang === "pt" ? "Escreve 3 hooks dos meus winners" : lang === "es" ? "Escribe 3 hooks de mis ganadores" : "Write 3 hooks from my winners",
      full: lang === "pt" ? "Escreve 3 hooks baseados nos meus melhores criativos" : lang === "es" ? "Escribe 3 hooks basados en mis mejores creativos" : "Write 3 hooks based on my best performing creatives",
      answer: lang === "pt" ? [
        "Baseado nos seus 5 top converters (hook rate médio 34%, ROAS 3.1x+) — padrão: problema específico + número concreto + quebra de expectativa.",
        '**Hook 1:** "Você está pagando R$ 90 por clique e nem sabe por quê — seus dados já têm a resposta."',
        '**Hook 2:** "3 dos seus 4 anúncios que mais gastam têm ROAS abaixo de 1x. Veja qual o único que vale manter."',
        '**Hook 3:** "Seu melhor criativo do mês passado está parado há 9 dias. O concorrente rodando o mesmo ângulo está escalando."',
        "Padrão dos winners: nunca benefício genérico — sempre uma afirmação que força o usuário a parar.",
      ] : lang === "es" ? [
        "Basado en tus 5 top converters (hook rate promedio 34%, ROAS 3.1x+) — patrón: problema específico + número concreto + quiebre de expectativa.",
        '**Hook 1:** "Estás pagando $90 por clic y ni sabes por qué — tus datos ya tienen la respuesta."',
        '**Hook 2:** "3 de tus 4 anuncios que más gastan tienen ROAS bajo 1x ahora. Mira cuál es el único que vale mantener."',
        '**Hook 3:** "Tu mejor creativo del mes pasado lleva 9 días pausado. El competidor corriendo el mismo ángulo está escalando."',
        "Patrón de los ganadores: nunca beneficio genérico — siempre una afirmación que obliga al usuario a detenerse.",
      ] : [
        "Based on your top 5 converters (avg hook rate 34%, ROAS 3.1x+) — pattern: specific problem + concrete number + expectation break.",
        '**Hook 1:** "You are paying $90 per click and do not know why — your data already has the answer."',
        '**Hook 2:** "3 of your 4 highest-spend ads have ROAS below 1x right now. See which one is worth keeping."',
        '**Hook 3:** "Your best creative from last month has been paused for 9 days. A competitor running the same angle is scaling."',
        "Pattern of your winners: never generic benefit — always a statement that forces the user to stop scrolling.",
      ],
    },
  ];

  const [active, setActive] = useState<number | null>(null);
  const [prevActive, setPrevActive] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const current = active !== null ? QS[active] : null;

  const selectQ = (id: number) => {
    if (active === id) { setActive(null); return; }
    setPrevActive(active);
    setActive(id);
    setAnimKey(k => k + 1);
  };

  const label_en = "SEE IT IN ACTION — NO ACCOUNT NEEDED";
  const label_pt = "EXPERIMENTE — SEM CRIAR CONTA";
  const label_es = "PRUÉBALO — SIN CREAR CUENTA";
  const demoLabel = lang === "pt" ? label_pt : lang === "es" ? label_es : label_en;

  const h1_en = "The AI that reads your ad account.";
  const h1_pt = "A IA que lê sua conta de anúncios.";
  const h1_es = "La IA que lee tu cuenta de anuncios.";
  const h1 = lang === "pt" ? h1_pt : lang === "es" ? h1_es : h1_en;

  const sub_en = "Connect Meta Ads once. Ask anything. Get answers with your real data — not generic advice.";
  const sub_pt = "Conecte o Meta Ads uma vez. Pergunte qualquer coisa. Receba respostas com seus dados reais — não conselhos genéricos.";
  const sub_es = "Conecta Meta Ads una vez. Pregunta lo que quieras. Recibe respuestas con tus datos reales — no consejos genéricos.";
  const sub = lang === "pt" ? sub_pt : lang === "es" ? sub_es : sub_en;

  const ctaTxt = t.hero_cta || (lang === "pt" ? "Testar grátis por 1 dia" : lang === "es" ? "Probar gratis 1 día" : "Try free for 1 day");
  const fineTxt = lang === "pt" ? "1 dia grátis · Sem cobrança por 24h · Cancele quando quiser" : lang === "es" ? "1 día gratis · Sin cobro por 24h · Cancela cuando quieras" : "1-day free trial · No charge for 24h · Cancel anytime";

  const empty_pt = "Selecione uma pergunta ao lado";
  const empty_en = "Select a question on the left";
  const empty_es = "Selecciona una pregunta a la izquierda";
  const emptyText = lang === "pt" ? empty_pt : lang === "es" ? empty_es : empty_en;

  const sample_pt = "Conta de exemplo · Meta conectado";
  const sample_en = "Sample account · Meta connected";
  const sample_es = "Cuenta de ejemplo · Meta conectado";
  const sampleText = lang === "pt" ? sample_pt : lang === "es" ? sample_es : sample_en;

  const subtitle_pt = "FitCore Brasil";
  const subtitle_en = "FitCore Brasil";

  const connected_pt = "conectado à FitCore Brasil";
  const connected_en = "connected to FitCore Brasil";
  const connected_es = "conectado a FitCore Brasil";
  const connectedText = lang === "pt" ? connected_pt : lang === "es" ? connected_es : connected_en;

  const cta_note_pt = "Isso é uma conta de exemplo. Com a sua, a IA usa dados reais.";
  const cta_note_en = "This is a sample account. With yours, the AI uses your real data.";
  const cta_note_es = "Esta es una cuenta de ejemplo. Con la tuya, la IA usa datos reales.";
  const ctaNote = lang === "pt" ? cta_note_pt : lang === "es" ? cta_note_es : cta_note_en;

  const cta_btn_pt = "Testar com minha conta \u2192";
  const cta_btn_en = "Try with my account \u2192";
  const cta_btn_es = "Probar con mi cuenta \u2192";
  const ctaBtn = lang === "pt" ? cta_btn_pt : lang === "es" ? cta_btn_es : cta_btn_en;

  return (
    <section style={{ padding: "clamp(48px,7vw,88px) clamp(16px,4vw,32px) clamp(48px,6vw,80px)", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1020, margin: "0 auto", position: "relative" }}>
        {/* Copy above demo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", marginBottom: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "rgba(14,165,233,0.9)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{demoLabel}</span>
          </div>
          <h1 style={{ fontFamily: F, fontSize: "clamp(32px,5.5vw,68px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 18px", color: "#fff" }}>
            {h1}
          </h1>
          <p style={{ fontFamily: F, fontSize: "clamp(14px,2vw,18px)", color: "rgba(255,255,255,0.48)", lineHeight: 1.65, maxWidth: 540, margin: "0 auto 32px" }}>{sub}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={onCTA}
              style={{ fontFamily: F, fontSize: "clamp(13px,3vw,15px)", fontWeight: 800, padding: "clamp(11px,2vw,14px) clamp(20px,4vw,32px)", borderRadius: 13, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 0 48px rgba(14,165,233,0.28), 0 8px 24px rgba(14,165,233,0.14)" }}>
              {ctaTxt} <ArrowRight size={15} />
            </button>
            <a href="#how"
              style={{ fontFamily: F, fontSize: 14, fontWeight: 500, padding: "14px 24px", borderRadius: 13, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}>
              {t.hero_see || (lang === "pt" ? "Ver como funciona" : lang === "es" ? "Ver cómo funciona" : "See how it works")}
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
            <span style={{ opacity: 0.5 }}>🔒</span>
            <span>{fineTxt}</span>
          </div>
        </div>

        {/* Product window */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(14,165,233,0.18)", boxShadow: "0 0 80px rgba(14,165,233,0.08), 0 40px 80px rgba(0,0,0,0.65)" }}>
          {/* Browser bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: 5 }}>
              {(["rgba(255,96,96,0.45)","rgba(255,190,0,0.45)","rgba(40,200,80,0.45)"] as string[]).map((c, i) => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5, padding: "3px 10px", display: "flex", alignItems: "center", gap: 6, maxWidth: 220, margin: "0 auto" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>adbrief.pro/dashboard/ai</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, opacity: 0.8 }} />
              <span style={{ fontFamily: F, fontSize: 10, color: "rgba(14,165,233,0.65)", fontWeight: 600 }}>{sampleText}</span>
            </div>
          </div>

          {/* Two columns */}
          <div style={{ display: "flex", background: "#09091a" }}>
            {/* Sidebar */}
            <div style={{ width: 264, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.055)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Account chip */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, rgba(14,165,233,0.35), rgba(6,182,212,0.2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>F</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>FitCore Brasil</p>
                  <p style={{ fontFamily: F, fontSize: 10, color: "rgba(14,165,233,0.75)", margin: "1px 0 0" }}>Meta Ads · 22 campaigns</p>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
              </div>

              <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 4px", marginBottom: 2 }}>
                {lang === "pt" ? "Perguntas frequentes" : lang === "es" ? "Preguntas frecuentes" : "Common questions"}
              </p>

              {QS.map((q) => {
                const isAct = active === q.id;
                return (
                  <button key={q.id} onClick={() => selectQ(q.id)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px", borderRadius: 10, background: isAct ? "rgba(14,165,233,0.1)" : "transparent", border: isAct ? "1px solid rgba(14,165,233,0.25)" : "1px solid transparent", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.15s, border-color 0.15s" }}
                    onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{q.emoji}</span>
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: isAct ? 600 : 400, color: isAct ? "#fff" : "rgba(255,255,255,0.52)", lineHeight: 1.45 }}>{q.short}</span>
                  </button>
                );
              })}

              {/* Separator + AI chat label */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 10, paddingLeft: 4 }}>
                <p style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Chat</p>
              </div>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Chat header bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(6,182,212,0.15))", border: "1px solid rgba(14,165,233,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✦</div>
                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#fff" }}>AdBrief AI</span>
                <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.22)", marginLeft: 2 }}>— {connectedText}</span>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 14, minHeight: 320, maxHeight: 400, overflowY: "auto" }}>
                {!current ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: "48px 0", opacity: 0.35 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>✦</div>
                    <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.6 }}>{emptyText}</p>
                  </div>
                ) : (
                  <div key={animKey} className="anim-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* User bubble */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ maxWidth: "74%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(6,182,212,0.11))", border: "1px solid rgba(14,165,233,0.24)" }}>
                        <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.92)", lineHeight: 1.6, margin: 0 }}>{current.full}</p>
                      </div>
                    </div>
                    {/* AI bubble */}
                    <div className="anim-slide" style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, rgba(14,165,233,0.22), rgba(6,182,212,0.14))", border: "1px solid rgba(14,165,233,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 12 }}>✦</div>
                      <div style={{ flex: 1 }}>
                        {current.answer.map((block, bi) => {
                          const parts = block.split(/(\*\*[^*]+\*\*)/g);
                          return (
                            <p key={bi} style={{ fontFamily: F, fontSize: 13, color: bi === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)", lineHeight: 1.75, margin: bi === 0 ? "0 0 10px" : "0 0 8px" }}>
                              {parts.map((part, pi) =>
                                part.startsWith("**") && part.endsWith("**")
                                  ? <strong key={pi} style={{ color: "#fff", fontWeight: 700 }}>{part.slice(2, -2)}</strong>
                                  : <span key={pi}>{part}</span>
                              )}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA footer */}
              <div style={{ padding: "11px 16px", borderTop: "1px solid rgba(255,255,255,0.055)", background: "rgba(14,165,233,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.32)", margin: 0 }}>{ctaNote}</p>
                <button onClick={onCTA}
                  style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 9, background: "linear-gradient(135deg, " + BLUE + ", " + TEAL + ")", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {ctaBtn}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Built on */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 28, flexWrap: "nowrap" }}>
          <span style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {lang === "pt" ? "DESENVOLVIDO COM" : lang === "es" ? "DESARROLLADO CON" : "BUILT ON"}
          </span>
          <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13.827 3.636L20.454 17h-3.09l-1.364-3H7.99L6.636 17H3.545L10.173 3.636h3.654zm-1.827 3.91L9.636 12h4.727L12 7.545z" fill="white"/></svg>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#fff" }}>Anthropic</span>
          </div>
          <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.01 14.19A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.816 2.81a4.5 4.5 0 0 1-.68 8.12v-5.679a.79.79 0 0 0-.389-.7zm2.010-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.814-2.806a4.5 4.5 0 0 1 6.680 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="white"/></svg>
            <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "#fff" }}>OpenAI</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Tools Section ────────────────────────────────────────────────────────────
function Tools({ t, lang }: { t: Record<string, string>; lang: Lang }) {
  const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  const [open, setOpen] = useState<string | null>(null);

  const label = lang === "pt" ? "FERRAMENTAS" : lang === "es" ? "HERRAMIENTAS" : "TOOLS";
  const h2 = lang === "pt" ? "Tudo que você precisa para escalar." : lang === "es" ? "Todo lo que necesitas para escalar." : "Everything you need to scale.";
  const sub = lang === "pt" ? "Cada ferramenta conectada aos seus dados reais. Sem copiar e colar, sem prompt manual." : lang === "es" ? "Cada herramienta conectada a tus datos reales. Sin copiar y pegar, sin prompt manual." : "Every tool connected to your real data. No copy-pasting, no manual prompting.";
  const close_txt = lang === "pt" ? "Fechar" : lang === "es" ? "Cerrar" : "Close";

  return (
    <section id="tools" style={{ padding: "clamp(48px,6vw,80px) clamp(16px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontFamily: F, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 700 }}>{label}</span>
          <h2 style={{ fontFamily: F, fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "12px 0 12px", color: "#fff" }}>{h2}</h2>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 440, margin: "0 auto" }}>{sub}</p>
        </div>

        {/* Tools grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {TOOLS_DATA.map(tool => {
            const isOpen = open === tool.id;
            const name = getToolName(tool, lang);
            const desc = getToolDesc(tool, lang);
            return (
              <div key={tool.id}
                style={{ borderRadius: 14, background: isOpen ? tool.color + "0c" : "rgba(255,255,255,0.025)", border: "1px solid " + (isOpen ? tool.color + "30" : "rgba(255,255,255,0.07)"), overflow: "hidden", transition: "background 0.2s, border-color 0.2s", cursor: "pointer" }}
                onClick={() => setOpen(isOpen ? null : tool.id)}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: tool.color + "18", border: "1px solid " + tool.color + "28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{tool.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{name}</p>
                  </div>
                  <div style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2v10M2 7h10" stroke={isOpen ? tool.color : "rgba(255,255,255,0.3)"} strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                {/* Expandable desc */}
                {isOpen && (
                  <div className="anim-fade" style={{ padding: "0 16px 16px" }}>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />
                    <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0 }}>{desc}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


function HowItWorks({ t }: { t: Record<string, string> }) {
  const steps = [
    { n: "01", icon: <Plug size={18} color="#0ea5e9" />, color: "#0ea5e9", title: t.how_s1_title, desc: t.how_s1_desc },
    { n: "02", icon: <Users size={18} color="#06b6d4" />, color: "#06b6d4", title: t.how_s2_title, desc: t.how_s2_desc },
    { n: "03", icon: <MessageSquare size={18} color="#34d399" />, color: "#34d399", title: t.how_s3_title, desc: t.how_s3_desc },
  ];
  return (
    <section id="how" style={{ padding: "clamp(48px,6vw,80px) clamp(16px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>{t.how_label}</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 12px" }}>{t.how_h2}</h2>
          <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 420, margin: "0 auto" }}>{t.how_sub}</p>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i} {...fadeIn(i * 0.1)} style={{ padding: "28px 24px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -10, fontSize: 72, fontWeight: 900, color: "rgba(255,255,255,0.025)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1, pointerEvents: "none" }}>{step.n}</div>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${step.color}14`, border: `1px solid ${step.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{step.icon}</div>
              <h3 style={{ ...j, fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForWho({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  const [active, setActive] = useState(0);
  const basePoints = [
    [t.for_p0_0, t.for_p0_1, t.for_p0_2, t.for_p0_3],
    [t.for_p1_0, t.for_p1_1, t.for_p1_2, t.for_p1_3],
    [t.for_p2_0, t.for_p2_1, t.for_p2_2, t.for_p2_3],
  ];
  const profiles = [
    { emoji: "🏢", label: t.for_tab0, color: "#0ea5e9", headline: t.for_h0, desc: t.for_d0, points: basePoints[0] },
    { emoji: "📈", label: t.for_tab1, color: "#34d399", headline: t.for_h1, desc: t.for_d1, points: basePoints[1] },
    { emoji: "⚡", label: t.for_tab2, color: "#a78bfa", headline: t.for_h2b, desc: t.for_d2, points: basePoints[2] },
  ];
  const p = profiles[active];
  return (
    <section id="for" style={{ padding: "clamp(48px,6vw,80px) clamp(16px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>{t.for_label}</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 0" }}>{t.for_h2}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 36 }}>
          {profiles.map((pr, i) => (
            <button key={i} onClick={() => setActive(i)} style={{ ...j, fontSize: 13, fontWeight: 600, padding: "9px 20px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s", background: active === i ? `${pr.color}15` : "rgba(255,255,255,0.03)", color: active === i ? pr.color : "rgba(255,255,255,0.38)", border: `1px solid ${active === i ? pr.color + "35" : "rgba(255,255,255,0.07)"}` }}>
              {pr.emoji} {pr.label}
            </button>
          ))}
        </div>
        <div key={active}
          className="for-who-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
          <div style={{ padding: "32px 28px", borderRadius: 20, background: `${p.color}07`, border: `1px solid ${p.color}18` }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 16 }}>{p.emoji}</span>
            <h3 style={{ ...j, fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.25, marginBottom: 14, color: "#fff" }}>{p.headline}</h3>
            <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 24 }}>{p.desc}</p>
            <button onClick={onCTA} style={{ ...j, fontSize: 13, fontWeight: 700, padding: "11px 22px", borderRadius: 10, background: p.color, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {t.for_cta} <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.points.map((point, i) => (
              <div key={point}
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${p.color}15`, border: `1px solid ${p.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={10} color={p.color} />
                </div>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfter({ t, onCTA }: { t: Record<string, string>; onCTA: () => void }) {
  const rows = [
    { before: t.ba_1_before || "Export CSV from Meta every Monday morning", after: t.ba_1_after || 'Ask: "What should I fix this week?" — answered in 10s' },
    { before: t.ba_2_before || "Manually compare CTR across 20 ad sets", after: t.ba_2_after || 'Ask: "Which ads are underperforming?" — list with data' },
    { before: t.ba_3_before || "Guess why ROAS dropped, change 3 things at once", after: t.ba_3_after || 'Ask: "Why did ROAS drop?" — specific hypothesis + fix' },
    { before: t.ba_4_before || "Write hooks from scratch, no data", after: t.ba_4_after || 'Ask: "Write 5 hooks based on my top converters"' },
  ];
  return (
    <section style={{ padding: "clamp(48px,6vw,72px) clamp(16px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>{t.ba_label || "BEFORE VS AFTER"}</span>
          <h2 style={{ ...j, fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "12px 0 8px" }}>
            {t.ba_h2 || "What changes when the AI knows your account."}
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 4 }}>
            <div style={{ padding: "10px 16px", borderRadius: "10px 10px 0 0", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.12)", textAlign: "center" }}>
              <span style={{ ...j, fontSize: 11, fontWeight: 700, color: "rgba(248,113,113,0.8)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.ba_before_label || "Before AdBrief"}</span>
            </div>
            <div style={{ padding: "10px 16px", borderRadius: "10px 10px 0 0", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.12)", textAlign: "center" }}>
              <span style={{ ...j, fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.ba_after_label || "With AdBrief"}</span>
            </div>
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: i === rows.length-1 ? "0 0 0 10px" : 0 }}>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, margin: 0 }}>{row.before}</p>
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)", borderRadius: i === rows.length-1 ? "0 0 10px 0" : 0 }}>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, margin: 0 }}>{row.after}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Time saved callout */}
        <div style={{ marginTop: 28, padding: "20px 24px", borderRadius: 14, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <p style={{ ...j, fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, flex: 1 }}>
            {t.ba_callout || "Average time saved: "}<strong style={{ color: "#fff" }}>{t.ba_callout_time || "5–8 hours per week"}</strong>{t.ba_callout_2 || " on reporting, analysis, and creative decisions."}
          </p>
          <button onClick={onCTA} style={{ ...j, fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.ba_cta || "Stop losing time →"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Pricing({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const annualLabel: Record<string, string> = {
    en: "Annual", pt: "Anual", es: "Anual",
  };
  const monthlyLabel: Record<string, string> = {
    en: "Monthly", pt: "Mensal", es: "Mensual",
  };
  const saveLabel: Record<string, string> = {
    en: "Save 20%", pt: "Economize 20%", es: "Ahorra 20%",
  };
  // Detect lang from hero text
  const lang = t.hero_h1b?.includes("anúncios") ? "pt" : t.hero_h1b?.includes("anuncios") ? "es" : "en";

  const monthly = { maker: 19, pro: 49, studio: 149 };
  const prices = annual
    ? { maker: Math.round(monthly.maker * 0.8), pro: Math.round(monthly.pro * 0.8), studio: Math.round(monthly.studio * 0.8) }
    : monthly;

  const plans = [
    {
      name: "Maker", price: `$${prices.maker}`, desc: "/mo", badge: null, highlight: false, annual,
      action: () => navigate(`/signup?plan=maker${annual ? "&billing=annual" : ""}`),
      features: [t.plan_maker_f0, t.plan_maker_f1, t.plan_maker_f2, t.plan_maker_f3],
    },
    {
      name: "Pro", price: `$${prices.pro}`, desc: "/mo", badge: t.plan_badge_pro, highlight: true, annual,
      action: () => navigate(`/signup?plan=pro${annual ? "&billing=annual" : ""}`),
      features: [t.plan_pro_f0, t.plan_pro_f1, t.plan_pro_f2, t.plan_pro_f3, t.plan_pro_f4],
    },
    {
      name: "Studio", price: `$${prices.studio}`, desc: "/mo", badge: null, highlight: false, annual,
      action: () => navigate(`/signup?plan=studio${annual ? "&billing=annual" : ""}`),
      features: [t.plan_studio_f0, t.plan_studio_f1, t.plan_studio_f2, t.plan_studio_f3, t.plan_studio_f4],
    },
  ];
  return (
    <section id="pricing" style={{ padding: "clamp(48px,6vw,80px) clamp(16px,4vw,32px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>{t.pricing_label}</span>
          <h2 style={{ ...j, fontSize: "clamp(28px,4vw,46px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "14px 0 12px" }}>{t.pricing_h2}</h2>
          <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 460, margin: "0 auto 16px" }}>{t.pricing_sub}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.16)" }}>
            <span style={{ fontSize: 15 }}>💳</span>
            <span style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{t.pricing_card}</span>
          </div>

          {/* Annual/Monthly toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
            <span style={{ ...j, fontSize: 13, color: annual ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)", fontWeight: 500, transition: "color 0.15s" }}>{monthlyLabel[lang] || "Monthly"}</span>
            <button onClick={() => setAnnual(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, background: annual ? BRAND : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: annual ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", display: "block" }} />
            </button>
            <span style={{ ...j, fontSize: 13, color: annual ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s" }}>{annualLabel[lang] || "Annual"}</span>
            {annual && (
              <span style={{ ...j, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                {saveLabel[lang] || "Save 20%"}
              </span>
            )}
          </div>
        </div>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{ padding: "28px 24px", borderRadius: 20, background: plan.highlight ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${plan.highlight ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: BRAND, borderRadius: 6, padding: "3px 12px", whiteSpace: "nowrap" }}>
                  <span style={{ ...j, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#000", fontWeight: 800 }}>{plan.badge}</span>
                </div>
              )}
              <div>
                <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.06em" }}>{plan.name.toUpperCase()}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ ...j, fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>{plan.price}</span>
                  <span style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{plan.desc}</span>
                </div>
                {(plan as any).annual && (
                  <p style={{ ...j, fontSize: 10, color: "rgba(52,211,153,0.7)", marginTop: 2 }}>
                    {lang === "pt" ? "cobrado anualmente" : lang === "es" ? "facturado anualmente" : "billed annually"}
                  </p>
                )}
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check size={12} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ ...j, fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={plan.action} style={{ ...j, width: "100%", padding: "13px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: plan.highlight ? BRAND : "rgba(255,255,255,0.06)", color: plan.highlight ? "#000" : "rgba(255,255,255,0.65)", border: `1px solid ${plan.highlight ? "transparent" : "rgba(255,255,255,0.09)"}`, cursor: "pointer" }}>{t.pricing_cta}</button>
              <p style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>{t.pricing_note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ t }: { t: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = [0,1,2,3,4,5,6,7].map(i => ({ q: t[`faq_q${i}`], a: t[`faq_a${i}`] })).filter(item => item.q);
  return (
    <section style={{ padding: "60px 32px 80px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", fontWeight: 600 }}>{t.faq_label}</span>
          <h2 style={{ ...j, fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "14px 0 0" }}>{t.faq_h2}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderRadius: 14, background: open === i ? "rgba(14,165,233,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${open === i ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.06)"}`, overflow: "hidden", transition: "all 0.15s" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", gap: 12, textAlign: "left" }}>
                <span style={{ ...j, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.82)", lineHeight: 1.4 }}>{item.q}</span>
                <ChevronDown size={14} color={open === i ? "#0ea5e9" : "rgba(255,255,255,0.25)"} style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>
              {open === i && <div style={{ padding: "0 20px 16px" }}><p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.75 }}>{item.a}</p></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  return (
    <section style={{ padding: "60px 32px 100px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
        <div {...fadeIn(0)} style={{ padding: "56px 48px", borderRadius: 28, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <p style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", marginBottom: 16, fontWeight: 600 }}>{t.final_label}</p>
            <h2 style={{ ...j, fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>{t.final_h2}</h2>
            <p style={{ ...j, fontSize: 15, color: "rgba(255,255,255,0.38)", marginBottom: 32 }}>{t.final_sub}</p>
            <button onClick={onCTA} style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 36px", borderRadius: 13, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 0 40px rgba(14,165,233,0.2)" }}>
              {t.final_cta} <ArrowRight size={16} />
            </button>
            <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 14 }}>{t.final_fine}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ t }: { t: Record<string, string> }) {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 32px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <Logo size="lg" />
        <div style={{ display: "flex", gap: 24 }}>
          {[["Blog", "/blog"], ["Pricing", "#pricing"], ["FAQ", "#faq"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <a key={href} href={href} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <p style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.18)" }}>{t.footer_copy}</p>
      </div>
    </footer>
  );
}
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
    en: "AdBrief \u2014 The AI that knows your ad account",
    pt: "AdBrief \u2014 A IA que conhece a sua conta de an\u00fancios",
    es: "AdBrief \u2014 La IA que conoce tu cuenta de anuncios",
  };
  const descMap: Record<Lang, string> = {
    en: "Connect Meta, TikTok or Google Ads. Ask anything about your campaigns. AdBrief reads your data in real time.",
    pt: "Conecte Meta, TikTok ou Google Ads. Pergunte qualquer coisa sobre suas campanhas. O AdBrief l\u00ea seus dados em tempo real.",
    es: "Conecta Meta, TikTok o Google Ads. Pregunta lo que quieras sobre tus campa\u00f1as. AdBrief lee tus datos en tiempo real.",
  };

  if (!ready) return <div style={{ minHeight: "100vh", background: BG }} />;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", ...j }}>
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
        <meta name="twitter:title" content={titleMap[lang]} />
        <meta name="twitter:description" content={descMap[lang]} />
        <meta name="twitter:image" content="https://adbrief.pro/og-image.png" />
        <html lang={lang} />
        <style>{`
          @keyframes answerSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
          @keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}
          .anim-fade{animation:fadeSlideIn 0.28s ease both}
          .anim-slide{animation:answerSlide 0.35s ease 0.12s both}
          @media(max-width:640px){
            .nav-links{display:none!important}
            .how-grid{grid-template-columns:1fr!important}
            .for-who-grid{grid-template-columns:1fr!important}
            .pricing-grid{grid-template-columns:1fr!important}
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
      <DemoHero onCTA={handleCTA} t={t} lang={lang} />
      <Tools t={t} lang={lang} />
      <HowItWorks t={t} />
      <ForWho onCTA={handleCTA} t={t} />
      <BeforeAfter t={t} onCTA={handleCTA} />
      <Pricing onCTA={handleCTA} t={t} />
      <FAQ t={t} />
      <FinalCTA onCTA={handleCTA} t={t} />
      <Footer t={t} />
      <CookieConsent />
    </div>
  );
}
