// v3
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, MessageSquare, Plug, Users, ChevronDown, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const BG = "#060812";
const fade = (delay = 0) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as any } });
const fadeIn = (delay = 0) => ({ initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as any } });

// ─── Types & Translations ────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_how: "How it works", nav_for: "Who it's for", nav_pricing: "Pricing", nav_signin: "Sign in", nav_cta: "Try free for 1 day →",
    hero_badge: "AI FOR PERFORMANCE MARKETING", hero_h1a: "The AI that knows", hero_h1b: "your ad account.",
    hero_sub: "Official Meta Ads connection. Real campaign data. AI that thinks like a senior media buyer.",
    hero_cta: "Try free for 1 day", hero_see: "See how it works", hero_fine: "1-day free trial on any plan · Cancel anytime · No setup required", hero_built: "BUILT ON",
    coming_soon_badge: "Coming soon",
    coming_soon_popup: "We're working on it! TikTok and Google Ads integration is coming soon. Meta Ads is fully available now.",
    how_label: "HOW IT WORKS", how_h2: "Three steps to your AI strategy partner.", how_sub: "Connect once. Ask forever. No CSV uploads. No manual data entry.",
    how_s1_title: "Connect your ad accounts", how_s1_desc: "Link Meta, TikTok, or Google Ads in one click. AdBrief reads your real campaign data — spend, CTR, CPM, creative performance — in real time.",
    how_s2_title: "Set up your persona or brand", how_s2_desc: "Tell AdBrief who you're advertising to. Create audience personas or brand profiles — the AI uses this to give you market-specific answers.",
    how_s3_title: "Ask anything. Get real answers.", how_s3_desc: "Chat like ChatGPT — but AdBrief knows your actual account. Ask what's working, what to kill, what to produce next. It answers with your numbers.",
    for_label: "WHO IT'S FOR", for_h2: "Built for performance teams.", for_tab0: "Agencies", for_tab1: "Media Buyers", for_tab2: "In-house Teams",
    for_h0: "Manage 10 clients like you have a full data team.", for_d0: "Your team produces 20+ creatives a week across multiple brands. AdBrief connects to each client's ad account and gives your strategists real answers — which creatives to scale, which to kill, what to brief next.",
    for_h1: "Stop flying blind on creative decisions.", for_d1: "You're accountable for ROAS but don't always control the creative. AdBrief gives you data-backed answers — which format is underperforming, what the winning hook pattern is, what to brief next.",
    for_h2b: "Your campaigns, finally speaking to each other.", for_d2: "Connect your company's ad accounts and give your whole team access to a shared AI that knows your performance history. One place to ask, one place to know.",
    for_cta: "Try free for 1 day",
    for_p0_0: "Per-client personas with their own data context",
    for_p0_1: "Real-time campaign performance in the chat",
    for_p0_2: "Brief generation tuned to each brand's winners",
    for_p0_3: "AI memory that learns each client's best hooks",
    for_p1_0: "Real spend and CTR data in every answer",
    for_p1_1: "Pattern detection across top and bottom performers",
    for_p1_2: "Competitor analysis and hook benchmarking",
    for_p1_3: "Account memory that improves with every query",
    for_p2_0: "Connected to your real Meta/TikTok/Google data",
    for_p2_1: "Personas for each product line or audience segment",
    for_p2_2: "Company profiles with brand context baked in",
    for_p2_3: "Team-wide access to shared campaign intelligence",
    pricing_label: "PRICING", pricing_h2: "Start with a free day. Stay because it works.", pricing_sub: "Every plan includes a 1-day free trial. No charge until it's over.",
    pricing_card: "Card required · No charge for 24 hours · Cancel anytime", pricing_cta: "Start free trial", pricing_note: "1-day trial · Cancel anytime",
    plan_badge_pro: "Most popular",
    plan_maker_f0: "50 AI messages / day",
    plan_maker_f1: "1 ad account (Meta, TikTok or Google)",
    plan_maker_f2: "All tools unlocked (hooks, scripts, briefs)",
    plan_maker_f3: "Up to 3 personas or brands",
    plan_pro_f0: "200 AI messages / day",
    plan_pro_f1: "3 ad accounts connected",
    plan_pro_f2: "All tools unlocked",
    plan_pro_f3: "Unlimited personas + brands",
    plan_pro_f4: "Multi-market support",
    plan_studio_f0: "Unlimited AI messages",
    plan_studio_f1: "Unlimited ad accounts",
    plan_studio_f2: "All tools unlocked",
    plan_studio_f3: "Unlimited personas + brands",
    plan_studio_f4: "Agency client workspace",
    faq_label: "FAQ", faq_h2: "Common questions",
    faq_q0: "How does the 1-day free trial work?", faq_a0: "When you sign up for any plan, you get full access for 24 hours at no charge. If you cancel within that period, you won't be billed. If you don't cancel, your subscription starts automatically after 24 hours.",
    faq_q1: "Why do I need a card to start?", faq_a1: "Requiring a card filters for serious users and lets us give you genuine full access — not a watered-down demo. We don't charge anything for 24 hours and you can cancel instantly from your account settings.",
    faq_q2: "What does AdBrief connect to?", faq_a2: "Meta Ads (Facebook & Instagram), TikTok Ads, and Google Ads. Once connected, AdBrief reads your campaign data in real time and uses it to answer your questions in the AI chat.",
    faq_q3: "Is my ad account data secure?", faq_a3: "Yes. We use OAuth — the same standard used by every major ad tool. We never store your login credentials. Access tokens are encrypted at rest. You can disconnect any account at any time.",
    faq_q4: "Can I use AdBrief for multiple clients?", faq_a4: "Yes. Pro supports 3 ad accounts and unlimited personas/brands. Studio supports unlimited connections and includes a dedicated agency client workspace.",
    faq_q5: "What's a persona in AdBrief?", faq_a5: "A persona is an audience profile that gives the AI context — who you're targeting, what market, what platform, what their objections are. The AI uses this to tailor every answer to that specific audience.",
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
    hero_sub: "Conexão oficial com Meta Ads. Dados reais de campanha. IA que pensa como um media buyer sênior.",
    hero_cta: "Testar grátis por 1 dia", hero_see: "Ver como funciona", hero_fine: "1 dia de teste grátis em qualquer plano · Cancele quando quiser · Sem configuração", hero_built: "DESENVOLVIDO COM",
    coming_soon_badge: "Em breve",
    coming_soon_popup: "Estamos trabalhando nisso! A integração com TikTok e Google Ads está chegando em breve. O Meta Ads já está disponível agora.",
    how_label: "COMO FUNCIONA", how_h2: "Três passos para seu parceiro de estratégia com IA.", how_sub: "Conecte uma vez. Pergunte para sempre. Sem uploads de CSV. Sem entrada manual de dados.",
    how_s1_title: "Conecte suas contas de anúncios", how_s1_desc: "Vincule Meta, TikTok ou Google Ads com um clique. O AdBrief lê seus dados reais de campanha — investimento, CTR, CPM, performance de criativos — em tempo real.",
    how_s2_title: "Configure sua persona ou marca", how_s2_desc: "Diga ao AdBrief para quem você está anunciando. Crie personas de audiência ou perfis de marca — a IA usa isso para te dar respostas específicas para o seu mercado.",
    how_s3_title: "Pergunte qualquer coisa. Receba respostas reais.", how_s3_desc: "Converse como no ChatGPT — mas o AdBrief conhece sua conta de verdade. Pergunte o que está funcionando, o que cortar, o que produzir a seguir. Ele responde com seus números.",
    for_label: "PARA QUEM É", for_h2: "Feito para equipes de performance.", for_tab0: "Agências", for_tab1: "Media Buyers", for_tab2: "Times Internos",
    for_h0: "Gerencie 10 clientes como se tivesse um time de dados completo.", for_d0: "Seu time produz mais de 20 criativos por semana para várias marcas. O AdBrief conecta à conta de anúncios de cada cliente e dá respostas reais aos seus estrategistas — quais criativos escalar, quais pausar, o que briefar a seguir.",
    for_h1: "Pare de tomar decisões criativas no escuro.", for_d1: "Você é responsável pelo ROAS mas nem sempre controla o criativo. O AdBrief te dá respostas baseadas em dados — qual formato está underperformando, qual é o padrão de hook vencedor, o que briefar a seguir.",
    for_h2b: "Suas campanhas finalmente falando entre si.", for_d2: "Conecte as contas de anúncios da sua empresa e dê ao seu time inteiro acesso a uma IA compartilhada que conhece seu histórico de performance. Um lugar para perguntar, um lugar para saber.",
    for_cta: "Testar grátis por 1 dia",
    for_p0_0: "Personas por cliente com o próprio contexto de dados",
    for_p0_1: "Performance das campanhas em tempo real no chat",
    for_p0_2: "Geração de brief calibrada nos vencedores de cada marca",
    for_p0_3: "Memória de IA que aprende os melhores hooks de cada cliente",
    for_p1_0: "Dados reais de investimento e CTR em cada resposta",
    for_p1_1: "Detecção de padrões entre os melhores e piores performers",
    for_p1_2: "Análise de concorrentes e benchmarking de hooks",
    for_p1_3: "Memória da conta que melhora a cada consulta",
    for_p2_0: "Conectado aos seus dados reais de Meta/TikTok/Google",
    for_p2_1: "Personas para cada linha de produto ou segmento de audiência",
    for_p2_2: "Perfis de empresa com contexto de marca integrado",
    for_p2_3: "Acesso de toda a equipe à inteligência compartilhada de campanhas",
    pricing_label: "PREÇOS", pricing_h2: "Comece com um dia grátis. Fique porque funciona.", pricing_sub: "Todo plano inclui 1 dia de teste grátis. Sem cobrança enquanto durar.",
    pricing_card: "Cartão obrigatório · Sem cobrança por 24 horas · Cancele quando quiser", pricing_cta: "Começar teste grátis", pricing_note: "1 dia de teste · Cancele quando quiser",
    plan_badge_pro: "Mais popular",
    plan_maker_f0: "50 mensagens de IA / dia",
    plan_maker_f1: "1 conta de anúncios (Meta, TikTok ou Google)",
    plan_maker_f2: "Todas as ferramentas liberadas (hooks, scripts, briefs)",
    plan_maker_f3: "Até 3 personas ou marcas",
    plan_pro_f0: "200 mensagens de IA / dia",
    plan_pro_f1: "3 contas de anúncios conectadas",
    plan_pro_f2: "Todas as ferramentas liberadas",
    plan_pro_f3: "Personas e marcas ilimitadas",
    plan_pro_f4: "Suporte a múltiplos mercados",
    plan_studio_f0: "Mensagens de IA ilimitadas",
    plan_studio_f1: "Contas de anúncios ilimitadas",
    plan_studio_f2: "Todas as ferramentas liberadas",
    plan_studio_f3: "Personas e marcas ilimitadas",
    plan_studio_f4: "Workspace para clientes de agência",
    faq_label: "PERGUNTAS FREQUENTES", faq_h2: "Dúvidas comuns",
    faq_q0: "Como funciona o teste grátis de 1 dia?", faq_a0: "Ao se cadastrar em qualquer plano, você tem acesso completo por 24 horas sem nenhuma cobrança. Se cancelar dentro desse período, não será cobrado. Se não cancelar, sua assinatura começa automaticamente após 24 horas.",
    faq_q1: "Por que preciso de cartão para começar?", faq_a1: "Exigir cartão filtra usuários sérios e nos permite dar acesso genuíno — não uma demo limitada. Não cobramos nada em 24 horas e você pode cancelar instantaneamente nas configurações da sua conta.",
    faq_q2: "O que o AdBrief conecta?", faq_a2: "Meta Ads (Facebook e Instagram), TikTok Ads e Google Ads. Ao conectar, o AdBrief lê seus dados de campanha em tempo real e os usa para responder suas perguntas no chat de IA.",
    faq_q3: "Os dados da minha conta de anúncios são seguros?", faq_a3: "Sim. Usamos OAuth — o mesmo padrão usado por todas as principais ferramentas de anúncios. Nunca armazenamos suas credenciais de login. Os tokens de acesso são criptografados. Você pode desconectar qualquer conta a qualquer momento.",
    faq_q4: "Posso usar o AdBrief para vários clientes?", faq_a4: "Sim. O Pro suporta 3 contas de anúncios e personas/marcas ilimitadas. O Studio suporta conexões ilimitadas e inclui um workspace dedicado para clientes de agência.",
    faq_q5: "O que é uma persona no AdBrief?", faq_a5: "Uma persona é um perfil de audiência que dá contexto à IA — para quem você está segmentando, qual mercado, qual plataforma, quais são as objeções. A IA usa isso para personalizar cada resposta para aquela audiência específica.",
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
    hero_cta: "Probar gratis 1 día", hero_see: "Ver cómo funciona", hero_fine: "1 día de prueba gratis en cualquier plan · Cancela cuando quieras · Sin configuración", hero_built: "DESARROLLADO CON",
    coming_soon_badge: "Próximamente",
    coming_soon_popup: "¡Estamos trabajando en ello! La integración con TikTok y Google Ads llega pronto. Meta Ads ya está disponible.",
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
    pricing_card: "Tarjeta requerida · Sin cargo por 24 horas · Cancela cuando quieras", pricing_cta: "Empezar prueba gratis", pricing_note: "1 día de prueba · Cancela cuando quieras",
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
    faq_q5: "¿Qué es una persona en AdBrief?", faq_a5: "Una persona es un perfil de audiencia que le da contexto a la IA — a quién le estás segmentando, qué mercado, qué plataforma, cuáles son sus objeciones. La IA usa esto para personalizar cada respuesta a esa audiencia específica.",
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

function Nav({ onCTA, t, lang, setLang }: { onCTA: () => void; t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,8,18,0.9)", backdropFilter: "blur(20px)", padding: "0 32px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
        <Logo size="lg" />
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[[t.nav_how, "#how"], [t.nav_for, "#for"], [t.nav_pricing, "#pricing"]].map(([label, href]) => (
            <a key={href} href={href} style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LangSwitcher lang={lang} setLang={setLang} />
          <button onClick={() => window.location.href = "/login"} className="nav-links" style={{ ...j, fontSize: 13, padding: "8px 16px", borderRadius: 9, background: "transparent", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>{t.nav_signin}</button>
          <button onClick={onCTA} style={{ ...j, fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 9, background: BRAND, color: "#000", border: "none", cursor: "pointer" }}>{t.nav_cta}</button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ onCTA, t }: { onCTA: () => void; t: Record<string, string> }) {
  return (
    <section className="hero-section" style={{ padding: "clamp(56px,8vw,90px) clamp(16px,4vw,32px) clamp(48px,6vw,72px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse, rgba(14,165,233,0.09) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
        <motion.div {...fade(0)} style={{ marginBottom: 28 }}><span style={{ ...j, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(14,165,233,0.8)", fontWeight: 600 }}>{t.hero_badge}</span></motion.div>
        <motion.h1 {...fade(0.08)} style={{ ...j, fontSize: "clamp(42px,6.5vw,76px)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.02, margin: "0 0 24px" }}>
          {t.hero_h1a}<br /><span style={{ background: BRAND, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.hero_h1b}</span>
        </motion.h1>
        <motion.p {...fade(0.16)} style={{ ...j, fontSize: 18, color: "rgba(255,255,255,0.42)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 40px" }}>{t.hero_sub}</motion.p>
        <motion.div {...fade(0.24)} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={onCTA} style={{ ...j, fontSize: 15, fontWeight: 800, padding: "15px 32px", borderRadius: 13, background: BRAND, color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 0 40px rgba(14,165,233,0.25)" }}>{t.hero_cta} <ArrowRight size={16} /></button>
          <a href="#how" style={{ ...j, fontSize: 15, fontWeight: 500, padding: "15px 28px", borderRadius: 13, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>{t.hero_see}</a>
        </motion.div>
        <motion.p {...fade(0.3)} style={{ ...j, fontSize: 12, color: "rgba(255,255,255,0.22)" }}>{t.hero_fine}</motion.p>
        <motion.div {...fade(0.38)} style={{ marginTop: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.08)" }} />
          <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>{t.hero_built}</span>
          <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Anthropic Claude</span>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
          <span style={{ ...j, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>OpenAI</span>
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.08)" }} />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Platform Badges ─────────────────────────────────────────────────────────
function PlatformBadges({ t }: { t: Record<string, string> }) {
  const [popup, setPopup] = useState(false);

  const platforms = [
    { name: "Meta Ads", icon: "🔵", active: true, color: "#0ea5e9" },
    { name: "TikTok Ads", icon: "🎵", active: false, color: "#94a3b8" },
    { name: "Google Ads", icon: "🟡", active: false, color: "#94a3b8" },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 32px 56px", flexWrap: "wrap" }}>
        {platforms.map(p => (
          <button key={p.name} onClick={() => !p.active && setPopup(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: p.active ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.active ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)"}`, cursor: p.active ? "default" : "pointer", position: "relative", transition: "all 0.15s" }}
            onMouseEnter={e => { if (!p.active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { if (!p.active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}>
            <span style={{ fontSize: 14 }}>{p.icon}</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: p.active ? "#fff" : "rgba(255,255,255,0.3)" }}>{p.name}</span>
            {p.active
              ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#34d399", fontFamily: "'Plus Jakarta Sans', sans-serif" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />Live</span>
              : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.04em" }}>{t.coming_soon_badge}</span>
            }
          </button>
        ))}
      </div>

      {popup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(6,8,18,0.85)", backdropFilter: "blur(12px)" }} onClick={() => setPopup(false)}>
          <div style={{ background: "#0d0f1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 28px", maxWidth: 380, width: "100%", textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🚀</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>{t.coming_soon_badge}</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 24 }}>{t.coming_soon_popup}</p>
            <button onClick={() => setPopup(false)} style={{ padding: "10px 28px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}

function ChatMockup({ t }: { t: Record<string, string> }) {
  const msgs = [{ role: "user", text: t.chat_q1 }, { role: "ai", text: t.chat_a1 }, { role: "user", text: t.chat_q2 }, { role: "ai", text: t.chat_a2 }];
  return (
    <section style={{ padding: "0 32px 80px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <motion.div {...fadeIn(0)} style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(14,165,233,0.15)", boxShadow: "0 0 100px rgba(14,165,233,0.06), 0 40px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: 6 }}>{["rgba(255,90,90,0.35)", "rgba(255,190,0,0.35)", "rgba(40,200,80,0.35)"].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}</div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6, maxWidth: 260, margin: "0 auto" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.28)" }}>adbrief.pro/dashboard/loop</span>
            </div>
          </div>
          <div style={{ background: "#09091a", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 8px", borderRadius: 999, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)" }}>
                <span style={{ fontSize: 14 }}>🎯</span><span style={{ ...j, fontSize: 11, fontWeight: 600, color: "#0ea5e9" }}>Sarah · FitCore Brand</span><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
              </div>
              <span style={{ ...j, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>18 analyses · Meta connected</span>
            </div>
            {msgs.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10 }}>
                {msg.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, fontSize: 13 }}>✦</div>}
                <div style={{ maxWidth: "75%", padding: "11px 15px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${msg.role === "user" ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)"}` }}>
                  <p style={{ ...j, fontSize: 13, color: msg.role === "user" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.65)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{msg.text}</p>
                </div>
              </motion.div>
            ))}
            <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.18)", flex: 1 }}>{t.chat_placeholder}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowRight size={13} color="#000" /></div>
            </div>
          </div>
        </motion.div>
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
            <motion.div key={i} {...fadeIn(i * 0.1)} style={{ padding: "28px 24px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -10, fontSize: 72, fontWeight: 900, color: "rgba(255,255,255,0.025)", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1, pointerEvents: "none" }}>{step.n}</div>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${step.color}14`, border: `1px solid ${step.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{step.icon}</div>
              <h3 style={{ ...j, fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{step.desc}</p>
            </motion.div>
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
        <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
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
              <motion.div key={point} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${p.color}15`, border: `1px solid ${p.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={10} color={p.color} />
                </div>
                <p style={{ ...j, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{point}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
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
  const items = [0,1,2,3,4,5].map(i => ({ q: t[`faq_q${i}`], a: t[`faq_a${i}`] }));
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
        <motion.div {...fadeIn(0)} style={{ padding: "56px 48px", borderRadius: 28, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", position: "relative", overflow: "hidden" }}>
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
        </motion.div>
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
          {[["Pricing", "#pricing"], ["FAQ", "#faq"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
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
    en: "AdBrief — The AI that knows your ad account",
    pt: "AdBrief — A IA que conhece a sua conta de anúncios",
    es: "AdBrief — La IA que conoce tu cuenta de anuncios",
  };
  const descMap: Record<Lang, string> = {
    en: "Connect Meta, TikTok or Google Ads. Ask anything about your campaigns. AdBrief reads your data in real time.",
    pt: "Conecte Meta, TikTok ou Google Ads. Pergunte qualquer coisa sobre suas campanhas. O AdBrief lê seus dados em tempo real.",
    es: "Conecta Meta, TikTok o Google Ads. Pregunta lo que quieras sobre tus campañas. AdBrief lee tus datos en tiempo real.",
  };

  if (!ready) return <div style={{ minHeight: "100vh", background: BG }} />;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", ...j }}>
      <style>{`
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .how-grid { grid-template-columns: 1fr !important; }
          .for-who-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "How does AdBrief connect to Meta Ads?", "acceptedAnswer": { "@type": "Answer", "text": "AdBrief uses official Meta Ads OAuth. Connect once and AdBrief reads your campaign data — spend, CTR, CPM, creative performance — in real time." } },
            { "@type": "Question", "name": "What is AdBrief?", "acceptedAnswer": { "@type": "Answer", "text": "AdBrief is an AI chat for performance marketers. Connect your Meta Ads account and ask anything about your campaigns. AdBrief reads your real data and responds like a senior media buyer." } },
            { "@type": "Question", "name": "How much does AdBrief cost?", "acceptedAnswer": { "@type": "Answer", "text": "AdBrief starts at $19/month for the Maker plan. All plans include a 1-day free trial. No charge for 24 hours, cancel anytime." } },
            { "@type": "Question", "name": "Does AdBrief work with TikTok and Google Ads?", "acceptedAnswer": { "@type": "Answer", "text": "Meta Ads is fully available. TikTok Ads and Google Ads integrations are coming soon." } }
          ]
        })}</script>
      </Helmet>
      <Nav onCTA={handleCTA} t={t} lang={lang} setLang={setLang} />
      <Hero onCTA={handleCTA} t={t} />
      <PlatformBadges t={t} />
      <ChatMockup t={t} />
      <HowItWorks t={t} />
      <ForWho onCTA={handleCTA} t={t} />
      <Pricing onCTA={handleCTA} t={t} />
      <FAQ t={t} />
      <FinalCTA onCTA={handleCTA} t={t} />
      <Footer t={t} />
      <CookieConsent />
    </div>
  );
}
