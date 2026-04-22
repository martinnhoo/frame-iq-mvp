// IndexNew.tsx — Staff-level landing · Decision engine for Meta Ads
// Complete from-scratch rebuild with depth system, real SVG logos, visual flow
import { useNavigate } from "react-router-dom";
import { storage } from "@/lib/storage";
import { Globe, ChevronDown, ArrowRight, CheckCircle2, TrendingUp, Zap, Brain, X, Plus, Minus, Plug, Radar, Bell, Sparkles, Activity } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

// ── Design tokens (true-black palette) ─────────────────────────────────────
const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#000000";
const BG2 = "#070707";
const SURFACE = "#0b0b0b";
const SURFACE2 = "#141414";
const ACCENT = "#0ea5e9";
const TEXT = "#f0f2f8";
const TEXT2 = "rgba(255,255,255,0.55)";
const TEXT3 = "rgba(255,255,255,0.35)";
const BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#22c55e";
const RED = "#ef4444";
const INDIGO = "#6366f1";
const EASE = "cubic-bezier(0.16,1,0.3,1)";

// ── Inline SVG logos ────────────────────────────────────────────────────────
function ClaudeLogo({ size = 16, opacity = 0.6 }: { size?: number; opacity?: number }) {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ opacity, flexShrink: 0 }}>
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero" />
    </svg>
  );
}

function OpenAILogo({ size = 16, opacity = 0.6 }: { size?: number; opacity?: number }) {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ opacity, flexShrink: 0 }}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function MetaLogo({ size = 16, opacity = 0.6 }: { size?: number; opacity?: number }) {
  return (
    <svg height={size} width={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ opacity, flexShrink: 0 }}>
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta0)" />
      <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta1)" />
      <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta2)" />
      <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta3)" />
      <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta4)" />
      <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta5)" />
      <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB" />
      <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta6)" />
      <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB" />
      <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta7)" />
      <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta8)" />
      <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta9)" />
      <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta10)" />
      <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta11)" />
      <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta12)" />
      <defs>
        <linearGradient id="meta0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF" /><stop offset="45.39%" stopColor="#0668E1" /><stop offset="85.91%" stopColor="#0064E0" /></linearGradient>
        <linearGradient id="meta1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF" /><stop offset="99.88%" stopColor="#0064E0" /></linearGradient>
        <linearGradient id="meta2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC" /><stop offset="68.81%" stopColor="#0064DF" /></linearGradient>
        <linearGradient id="meta3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6" /><stop offset="99.43%" stopColor="#0072EC" /></linearGradient>
        <linearGradient id="meta4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9" /><stop offset="100%" stopColor="#007CF6" /></linearGradient>
        <linearGradient id="meta5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9" /><stop offset="100%" stopColor="#0082FB" /></linearGradient>
        <linearGradient id="meta6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8" /><stop offset="91.41%" stopColor="#0082FB" /></linearGradient>
        <linearGradient id="meta7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB" /><stop offset="99.95%" stopColor="#0081FA" /></linearGradient>
        <linearGradient id="meta8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA" /><stop offset="100%" stopColor="#0080F9" /></linearGradient>
        <linearGradient id="meta9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3" /><stop offset="100%" stopColor="#0080F9" /></linearGradient>
        <linearGradient id="meta10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF" /><stop offset="99.94%" stopColor="#0279F1" /></linearGradient>
        <linearGradient id="meta11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9" /><stop offset="100%" stopColor="#0377EF" /></linearGradient>
        <linearGradient id="meta12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF" /><stop offset="100%" stopColor="#0471E9" /></linearGradient>
      </defs>
    </svg>
  );
}

// ── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "en" | "pt" | "es";

const TX: Record<Lang, Record<string, string>> = {
  pt: {
    nav_login: "Entrar",
    nav_signup: "Criar conta",
    // trust bar
    trust_powered: "Powered by",
    trust_meta: "Funciona com Meta Ads",
    // hero
    hero_tag: "GESTOR DE TRÁFEGO COM IA · META ADS",
    hero_title: "Não contrate outro gestor de tráfego.\nAtive um.",
    hero_sub: "AdBrief é um gestor sênior com IA, dentro da sua conta Meta. Lê a performance a cada 15 minutos, decide o que fazer e executa — com o seu OK.",
    hero_support: "Pausar, escalar, ajustar orçamento, reescrever criativo — sem você abrir o Gerenciador de Anúncios.",
    hero_cta: "Testar 3 dias grátis",
    hero_cta_sub: "Sem cartão · Conecta Meta depois, no onboarding",
    hero_login: "Já tem conta? Entrar",
    hero_screenshot_label: "O feed do AdBrief — decisões aplicadas hoje",
    hero_callout_1: "Diagnóstico com os números reais da conta",
    hero_callout_2: "E te diz exatamente o que fazer agora",
    // founder note — substitui social proof enquanto não tem clientes reais suficientes
    // concept
    concept_kicker: "O conceito",
    concept_title: "Não é um dashboard.\nÉ um sistema de decisão.",
    concept_s1: "Análise contínua",
    concept_s1d: "Monitora suas campanhas 24/7 e identifica oportunidades que você perderia.",
    concept_s2: "Decisões claras",
    concept_s2d: "Cada oportunidade vem com uma recomendação específica: pausar, escalar ou ajustar.",
    concept_s3: "Execução imediata",
    concept_s3d: "Aplique a melhoria direto no AdBrief. Sem abrir o Gerenciador de Anúncios.",
    // flow
    flow_kicker: "Como funciona",
    flow_title: "Do primeiro clique\nà primeira decisão.",
    flow_sub: "Cinco passos. Em minutos, o AdBrief já está lendo sua conta e sugerindo as primeiras ações.",
    flow_s1: "Você conecta sua conta",
    flow_s1d: "OAuth com a Meta em menos de 30 segundos. Seus dados ficam na sua conta — a gente só lê.",
    flow_s1b: "Autenticado",
    flow_s2: "O sistema analisa",
    flow_s2d: "A cada 15 minutos varremos campanhas, criativos, públicos e tendências. CTR, hook rate, CPA, fadiga.",
    flow_s2b: "Analisando…",
    flow_s3: "Oportunidades aparecem",
    flow_s3d: "Cada insight chega com a decisão já pronta: o que fazer, por que, e quanto você economiza ou ganha.",
    flow_s3b: "3 decisões novas",
    flow_s4: "Você aplica",
    flow_s4d: "Revisa a recomendação, clica aprovar. A gente executa dentro da sua conta — sem você abrir o Ads Manager.",
    flow_s4b: "Aprovar e aplicar",
    flow_s5: "A performance melhora",
    flow_s5d: "Cada decisão aprovada vira padrão aprendido. Quanto mais tempo rodando, mais afinado com a sua conta.",
    flow_s5b: "CPA ↓ 28%",
    // mini mocks inside flow timeline
    flow_m_acct_meta: "Meta Ads",
    flow_m_acct_sub: "2 contas · 12 campanhas",
    flow_m_dec_urgent: "URGENTE",
    flow_m_dec_scale: "ESCALAR",
    flow_m_dec_test: "TESTAR",
    flow_m_dec_urgent_text: "Pausar UGC 03 — CPA R$87 (meta R$35)",
    flow_m_dec_scale_text: "Subir +30% no criativo Hook-A",
    flow_m_dec_test_text: "Nova variação: ângulo de prova social",
    flow_m_btn_approve: "Aprovar e aplicar",
    flow_m_btn_details: "Detalhes",
    // compare
    compare_kicker: "Comparativo",
    compare_title: "Ads Manager mostra o que aconteceu.\nAdBrief diz o que fazer.",
    compare_sub: "A diferença entre olhar relatório e tomar decisão.",
    compare_ads_title: "Meta Ads Manager",
    compare_ads_sublabel: "O que aconteceu",
    compare_ads_caption: "Números sem contexto. Você lê, interpreta, decide e executa — tudo sozinho.",
    compare_ads_chart_label: "CTR · últimos 14 dias",
    compare_ads_1: "Mostra métricas passadas",
    compare_ads_2: "Você interpreta sozinho",
    compare_ads_3: "Você decide na base do achismo",
    compare_ads_4: "Você executa manualmente",
    compare_ads_5: "Nenhum aprendizado entre contas",
    compare_adbrief_title: "AdBrief",
    compare_adbrief_sublabel: "O que fazer agora",
    compare_adbrief_caption: "Uma decisão por vez, com o motivo, o impacto estimado e um clique pra aplicar.",
    compare_adbrief_mock_tag: "URGENTE",
    compare_adbrief_mock_time: "há 4 min",
    compare_adbrief_mock_headline: "Pausar UGC 03 — economia R$2.150/dia",
    compare_adbrief_mock_reason: "CTR caiu 62% em 48h, CPA R$87 (meta R$35). Sem sinal de recuperação.",
    compare_adbrief_mock_btn: "Aprovar e pausar",
    compare_adbrief_mock_btn2: "Detalhes",
    compare_adbrief_1: "Detecta o problema em 15min",
    compare_adbrief_2: "Explica o que está acontecendo",
    compare_adbrief_3: "Recomenda a ação específica",
    compare_adbrief_4: "Aplica em 1 clique",
    compare_adbrief_5: "Aprende com cada resultado",
    // pricing
    pricing_title: "Preço claro, escala real.",
    pricing_sub: "Comece grátis. Faça upgrade quando a conta crescer.",
    pricing_free: "Free",
    pricing_free_d: "Pra testar antes de decidir",
    pricing_free_f1: "1 conta Meta conectada",
    pricing_free_f2: "15 decisões aplicadas",
    pricing_free_f3: "Acesso completo por 14 dias",
    pricing_free_cta: "Criar conta grátis",
    pricing_maker: "Maker",
    pricing_maker_d: "Pra um gestor, uma conta",
    pricing_maker_f1: "1 conta Meta",
    pricing_maker_f2: "Decisões ilimitadas",
    pricing_maker_f3: "Gasto até R$50k/mês",
    pricing_maker_cta: "Começar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Mais escolhido",
    pricing_pro_d: "Pra agências com vários clientes",
    pricing_pro_f1: "3 contas Meta",
    pricing_pro_f2: "Decisões ilimitadas",
    pricing_pro_f3: "Gasto até R$200k/mês",
    pricing_pro_cta: "Começar com Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Operações grandes, sem teto",
    pricing_studio_f1: "Contas ilimitadas",
    pricing_studio_f2: "Decisões ilimitadas",
    pricing_studio_f3: "Gasto ilimitado",
    pricing_studio_cta: "Falar com vendas",
    pricing_details: "Ver todos os detalhes",
    pricing_mo: "/mês",
    // faq
    faq_title: "Perguntas que todo gestor faz antes",
    faq_q1: "O AdBrief mexe na minha conta sozinho?",
    faq_a1: "Por padrão, não — toda recomendação passa pelo seu clique (escalar, pausar, duplicar, ajustar budget). A única exceção é a proteção automática contra prejuízo: em casos extremos (CPA muito acima da meta, 0 conversões e spend queimando em velocidade anormal), o AdBrief pausa sozinho pra te evitar dano. Essa proteção vem ligada por padrão e pode ser desligada nas configurações.",
    faq_q2: "Preciso ser admin da conta de anúncios?",
    faq_a2: "Precisa de permissão de anunciante ou superior. Funciona com BM compartilhada de cliente e com conta pessoal.",
    faq_q3: "E se o AdBrief recomendar algo errado?",
    faq_a3: "Toda decisão vem com a razão explícita (ex: \"CPA subiu 180% em 24h, 0 conversões\"). Você vê os números antes de aplicar. E pode reverter em 1 clique por até 30 minutos depois.",
    faq_q4: "Funciona pra e-commerce? Agência? Infoproduto?",
    faq_a4: "Sim pros três. O sistema aprende com a sua conta específica — o que funciona pro seu nicho, não genérico.",
    faq_q5: "Quanto custa?",
    faq_a5: "Free dá acesso completo com 1 conta Meta conectada e 15 decisões aplicadas (sem cartão). Maker $19/mês para 1 conta com decisões ilimitadas. Pro $49/mês para 3 contas. Studio $299/mês sem limite de contas nem decisões.",
    faq_q6: "Posso cancelar?",
    faq_a6: "Sim. Mensal, sem contrato, sem multa. Desconectar da Meta também é 1 clique.",
    faq_q7: "Meus dados ficam seguros?",
    faq_a7: "Sim. A conexão é OAuth oficial da Meta — você autoriza leitura, nada é armazenado além do necessário pra análise. Nenhum credencial da sua conta passa pelo AdBrief. Pode revogar o acesso a qualquer momento no próprio Meta Business. Dados de performance são criptografados em trânsito e em repouso no Supabase (hospedado nos EUA, compliance SOC 2).",
    // pricing CTA banner
    pricing_cta_title: "Preço simples por volume de decisões.",
    pricing_cta_sub: "Free pra testar. Pagos a partir de $19/mês.",
    pricing_cta_btn: "Ver planos",
    pricing_cta_secondary: "Começar grátis",
    // final
    final_title: "Você já viu como funciona.",
    final_sub: "Teste 3 dias sem cartão.",
    final_cta: "Testar grátis",
    final_sub2: "Conecte a conta Meta só no onboarding",
    final_login: "Já tem conta? Entrar",
    // sticky
    sticky_cta: "Conectar agora",
    // footer
    footer_tagline: "Sistema de decisão para Meta Ads",
    footer_product: "Produto",
    footer_how: "Como funciona",
    footer_pricing: "Preços",
    footer_faq: "FAQ",
    footer_company: "Empresa",
    footer_about: "Sobre",
    footer_contact: "Contato",
    footer_legal: "Legal",
    footer_terms: "Termos",
    footer_privacy: "Privacidade",
    footer_copy: "© 2026 AdBrief",
  },
  en: {
    nav_login: "Log in",
    nav_signup: "Sign up",
    trust_powered: "Powered by",
    trust_meta: "Works with Meta Ads",
    hero_tag: "AI MEDIA BUYER · META ADS",
    hero_title: "Don't hire another media buyer.\nActivate one.",
    hero_sub: "AdBrief is a senior AI media buyer living inside your Meta Ads account. Reads performance every 15 minutes, decides what to do, and executes — with your approval.",
    hero_support: "Pause, scale, adjust budgets, rewrite creative — without ever opening Ads Manager.",
    hero_cta: "Try 3 days free",
    hero_cta_sub: "No card · Connect Meta later, during onboarding",
    hero_login: "Already have an account? Log in",
    hero_screenshot_label: "The AdBrief feed — decisions applied today",
    hero_callout_1: "Real diagnosis with your actual account data",
    hero_callout_2: "And tells you exactly what to do next",
    // founder note — replaces social proof while real-customer proof is still being gathered
    concept_kicker: "The concept",
    concept_title: "Not a dashboard.\nA decision system.",
    concept_s1: "Continuous analysis",
    concept_s1d: "Monitors your campaigns 24/7 and identifies opportunities you'd miss.",
    concept_s2: "Clear decisions",
    concept_s2d: "Each opportunity comes with a specific recommendation: pause, scale, or adjust.",
    concept_s3: "Immediate execution",
    concept_s3d: "Apply the improvement directly in AdBrief. No need to open Ads Manager.",
    flow_kicker: "How it works",
    flow_title: "From first click\nto first decision.",
    flow_sub: "Five steps. In minutes, AdBrief is already reading your account and suggesting the first actions.",
    flow_s1: "You connect your account",
    flow_s1d: "OAuth with Meta in under 30 seconds. Your data stays in your account — we just read it.",
    flow_s1b: "Connected",
    flow_s2: "The system analyzes",
    flow_s2d: "Every 15 minutes we sweep campaigns, creatives, audiences and trends. CTR, hook rate, CPA, fatigue.",
    flow_s2b: "Analyzing…",
    flow_s3: "Opportunities appear",
    flow_s3d: "Each insight arrives with the decision ready: what to do, why, and how much you save or gain.",
    flow_s3b: "3 new decisions",
    flow_s4: "You apply",
    flow_s4d: "Review the recommendation, click approve. We execute inside your account — no Ads Manager needed.",
    flow_s4b: "Approve & apply",
    flow_s5: "Performance improves",
    flow_s5d: "Every approved decision becomes a learned pattern. The longer it runs, the more tuned to your account.",
    flow_s5b: "CPA ↓ 28%",
    flow_m_acct_meta: "Meta Ads",
    flow_m_acct_sub: "2 accounts · 12 campaigns",
    flow_m_dec_urgent: "URGENT",
    flow_m_dec_scale: "SCALE",
    flow_m_dec_test: "TEST",
    flow_m_dec_urgent_text: "Pause UGC 03 — CPA $87 (target $35)",
    flow_m_dec_scale_text: "Raise budget +30% on Hook-A creative",
    flow_m_dec_test_text: "New variant: social proof angle",
    flow_m_btn_approve: "Approve & apply",
    flow_m_btn_details: "Details",
    compare_kicker: "Comparison",
    compare_title: "Ads Manager shows what happened.\nAdBrief tells you what to do.",
    compare_sub: "The difference between reading a report and making a decision.",
    compare_ads_title: "Meta Ads Manager",
    compare_ads_sublabel: "What happened",
    compare_ads_caption: "Numbers with no context. You read, interpret, decide and execute — all on your own.",
    compare_ads_chart_label: "CTR · last 14 days",
    compare_ads_1: "Shows past metrics",
    compare_ads_2: "You interpret it yourself",
    compare_ads_3: "You decide on gut feel",
    compare_ads_4: "You execute manually",
    compare_ads_5: "No learning across accounts",
    compare_adbrief_title: "AdBrief",
    compare_adbrief_sublabel: "What to do now",
    compare_adbrief_caption: "One decision at a time, with the reason, estimated impact and one click to apply.",
    compare_adbrief_mock_tag: "URGENT",
    compare_adbrief_mock_time: "4 min ago",
    compare_adbrief_mock_headline: "Pause UGC 03 — save $430/day",
    compare_adbrief_mock_reason: "CTR dropped 62% in 48h, CPA $87 (target $35). No sign of recovery.",
    compare_adbrief_mock_btn: "Approve & pause",
    compare_adbrief_mock_btn2: "Details",
    compare_adbrief_1: "Catches the problem in 15min",
    compare_adbrief_2: "Explains what's happening",
    compare_adbrief_3: "Recommends the specific action",
    compare_adbrief_4: "Applies it in 1 click",
    compare_adbrief_5: "Learns from every result",
    pricing_title: "Clear pricing. Real scale.",
    pricing_sub: "Start free. Upgrade when your account grows.",
    pricing_free: "Free",
    pricing_free_d: "Try it before deciding",
    pricing_free_f1: "1 Meta account",
    pricing_free_f2: "15 applied decisions",
    pricing_free_f3: "Full access for 14 days",
    pricing_free_cta: "Create free account",
    pricing_maker: "Maker",
    pricing_maker_d: "One buyer, one account",
    pricing_maker_f1: "1 Meta account",
    pricing_maker_f2: "Unlimited decisions",
    pricing_maker_f3: "Spend up to $10k/mo",
    pricing_maker_cta: "Get started",
    pricing_pro: "Pro",
    pricing_pro_badge: "Most picked",
    pricing_pro_d: "For agencies with multiple clients",
    pricing_pro_f1: "3 Meta accounts",
    pricing_pro_f2: "Unlimited decisions",
    pricing_pro_f3: "Spend up to $40k/mo",
    pricing_pro_cta: "Start with Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Large operations, no ceiling",
    pricing_studio_f1: "Unlimited accounts",
    pricing_studio_f2: "Unlimited decisions",
    pricing_studio_f3: "Unlimited spend",
    pricing_studio_cta: "Talk to sales",
    pricing_details: "See all details",
    pricing_mo: "/mo",
    faq_title: "Questions every media buyer asks first",
    faq_q1: "Will AdBrief touch my account on its own?",
    faq_a1: "By default, no — every recommendation needs your click (scale, pause, duplicate, adjust budget). The only exception is loss protection: in extreme cases (CPA way above target, 0 conversions, and spend burning at an abnormal pace), AdBrief auto-pauses to save you money. This protection is on by default and can be turned off in settings.",
    faq_q2: "Do I need to be admin on the ad account?",
    faq_a2: "Advertiser permission or above works. It runs fine with shared client BMs and personal accounts.",
    faq_q3: "What if AdBrief recommends the wrong thing?",
    faq_a3: "Every decision comes with the raw reason (e.g. \"CPA up 180% in 24h, 0 conversions\"). You see the numbers before applying. You can reverse any decision in 1 click for up to 30 minutes after.",
    faq_q4: "Does it work for e-commerce? Agency? Infoproduct?",
    faq_a4: "Yes to all three. The system learns from your specific account — what works for your niche, not generic advice.",
    faq_q5: "What does it cost?",
    faq_a5: "Free gives full access with 1 connected Meta account and 15 applied decisions (no card). Maker is $19/mo for 1 account with unlimited decisions. Pro is $49/mo for 3 accounts. Studio is $299/mo, no cap on accounts or decisions.",
    faq_q6: "Can I cancel?",
    faq_a6: "Yes. Monthly, no contract, no fee. Disconnecting from Meta is also one click.",
    faq_q7: "Is my data safe?",
    faq_a7: "Yes. We use Meta's official OAuth — you authorize read access, nothing beyond what's needed for analysis is stored. No account credentials pass through AdBrief. You can revoke access anytime from Meta Business. Performance data is encrypted in transit and at rest on Supabase (US-hosted, SOC 2 compliant).",
    pricing_cta_title: "Simple pricing by decision volume.",
    pricing_cta_sub: "Free to try. Paid plans from $19/mo.",
    pricing_cta_btn: "See pricing",
    pricing_cta_secondary: "Start free",
    final_title: "You've seen how it works.",
    final_sub: "Try 3 days, no card needed.",
    final_cta: "Start free trial",
    final_sub2: "Connect your Meta account during onboarding",
    final_login: "Already have an account? Log in",
    sticky_cta: "Connect now",
    footer_tagline: "Decision system for Meta Ads",
    footer_product: "Product",
    footer_how: "How it works",
    footer_pricing: "Pricing",
    footer_faq: "FAQ",
    footer_company: "Company",
    footer_about: "About",
    footer_contact: "Contact",
    footer_legal: "Legal",
    footer_terms: "Terms",
    footer_privacy: "Privacy",
    footer_copy: "© 2026 AdBrief",
  },
  es: {
    nav_login: "Iniciar sesión",
    nav_signup: "Crear cuenta",
    trust_powered: "Powered by",
    trust_meta: "Funciona con Meta Ads",
    hero_tag: "MEDIA BUYER CON IA · META ADS",
    hero_title: "No contrates otro media buyer.\nActiva uno.",
    hero_sub: "AdBrief es un media buyer sénior con IA, viviendo dentro de tu cuenta Meta. Lee la performance cada 15 minutos, decide qué hacer y ejecuta — con tu OK.",
    hero_support: "Pausar, escalar, ajustar presupuesto, reescribir creativo — sin abrir el Administrador de Anuncios.",
    hero_cta: "Probar 3 días gratis",
    hero_cta_sub: "Sin tarjeta · Conectá Meta después, en el onboarding",
    hero_login: "¿Ya tienes cuenta? Entrar",
    hero_screenshot_label: "El feed de AdBrief — decisiones aplicadas hoy",
    hero_callout_1: "Diagnóstico con los datos reales de tu cuenta",
    hero_callout_2: "Y te dice exactamente qué hacer ahora",
    // founder note — reemplaza social proof mientras no haya prueba real de clientes suficiente
    concept_kicker: "El concepto",
    concept_title: "No es un dashboard.\nEs un sistema de decisión.",
    concept_s1: "Análisis continuo",
    concept_s1d: "Monitorea tus campañas 24/7 e identifica oportunidades que perderías.",
    concept_s2: "Decisiones claras",
    concept_s2d: "Cada oportunidad viene con una recomendación específica: pausar, escalar o ajustar.",
    concept_s3: "Ejecución inmediata",
    concept_s3d: "Aplica la mejora directo en AdBrief. Sin abrir el Administrador de Anuncios.",
    flow_kicker: "Cómo funciona",
    flow_title: "Del primer clic\na la primera decisión.",
    flow_sub: "Cinco pasos. En minutos, AdBrief ya está leyendo tu cuenta y sugiriendo las primeras acciones.",
    flow_s1: "Conectas tu cuenta",
    flow_s1d: "OAuth con Meta en menos de 30 segundos. Tus datos se quedan en tu cuenta — nosotros solo leemos.",
    flow_s1b: "Conectado",
    flow_s2: "El sistema analiza",
    flow_s2d: "Cada 15 minutos revisamos campañas, creativos, audiencias y tendencias. CTR, hook rate, CPA, fatiga.",
    flow_s2b: "Analizando…",
    flow_s3: "Aparecen oportunidades",
    flow_s3d: "Cada insight llega con la decisión lista: qué hacer, por qué, y cuánto ahorras o ganas.",
    flow_s3b: "3 decisiones nuevas",
    flow_s4: "Las aplicas",
    flow_s4d: "Revisas la recomendación, haces clic en aprobar. Ejecutamos dentro de tu cuenta — sin abrir Ads Manager.",
    flow_s4b: "Aprobar y aplicar",
    flow_s5: "La performance mejora",
    flow_s5d: "Cada decisión aprobada se vuelve un patrón aprendido. Cuanto más tiempo corre, más afinada a tu cuenta.",
    flow_s5b: "CPA ↓ 28%",
    flow_m_acct_meta: "Meta Ads",
    flow_m_acct_sub: "2 cuentas · 12 campañas",
    flow_m_dec_urgent: "URGENTE",
    flow_m_dec_scale: "ESCALAR",
    flow_m_dec_test: "PROBAR",
    flow_m_dec_urgent_text: "Pausar UGC 03 — CPA R$87 (meta R$35)",
    flow_m_dec_scale_text: "Subir +30% en el creativo Hook-A",
    flow_m_dec_test_text: "Nueva variante: ángulo de prueba social",
    flow_m_btn_approve: "Aprobar y aplicar",
    flow_m_btn_details: "Detalles",
    compare_kicker: "Comparativo",
    compare_title: "Ads Manager muestra lo que pasó.\nAdBrief te dice qué hacer.",
    compare_sub: "La diferencia entre leer un reporte y tomar una decisión.",
    compare_ads_title: "Meta Ads Manager",
    compare_ads_sublabel: "Lo que pasó",
    compare_ads_caption: "Números sin contexto. Tú lees, interpretas, decides y ejecutas — todo solo.",
    compare_ads_chart_label: "CTR · últimos 14 días",
    compare_ads_1: "Muestra métricas pasadas",
    compare_ads_2: "Lo interpretas tú",
    compare_ads_3: "Decides a ciegas",
    compare_ads_4: "Ejecutas manualmente",
    compare_ads_5: "No aprende entre cuentas",
    compare_adbrief_title: "AdBrief",
    compare_adbrief_sublabel: "Qué hacer ahora",
    compare_adbrief_caption: "Una decisión a la vez, con el motivo, el impacto estimado y un clic para aplicar.",
    compare_adbrief_mock_tag: "URGENTE",
    compare_adbrief_mock_time: "hace 4 min",
    compare_adbrief_mock_headline: "Pausar UGC 03 — ahorro $430/día",
    compare_adbrief_mock_reason: "CTR cayó 62% en 48h, CPA $87 (meta $35). Sin señal de recuperación.",
    compare_adbrief_mock_btn: "Aprobar y pausar",
    compare_adbrief_mock_btn2: "Detalles",
    compare_adbrief_1: "Detecta el problema en 15min",
    compare_adbrief_2: "Explica qué está pasando",
    compare_adbrief_3: "Recomienda la acción específica",
    compare_adbrief_4: "Lo aplica en 1 clic",
    compare_adbrief_5: "Aprende de cada resultado",
    pricing_title: "Precio claro. Escala real.",
    pricing_sub: "Empieza gratis. Sube de plan cuando tu cuenta crezca.",
    pricing_free: "Free",
    pricing_free_d: "Para probar antes de decidir",
    pricing_free_f1: "1 cuenta Meta",
    pricing_free_f2: "15 decisiones aplicadas",
    pricing_free_f3: "Acceso completo por 14 días",
    pricing_free_cta: "Crear cuenta gratis",
    pricing_maker: "Maker",
    pricing_maker_d: "Un gestor, una cuenta",
    pricing_maker_f1: "1 cuenta Meta",
    pricing_maker_f2: "Decisiones ilimitadas",
    pricing_maker_f3: "Gasto hasta $10k/mes",
    pricing_maker_cta: "Empezar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Más elegido",
    pricing_pro_d: "Para agencias con varios clientes",
    pricing_pro_f1: "3 cuentas Meta",
    pricing_pro_f2: "Decisiones ilimitadas",
    pricing_pro_f3: "Gasto hasta $40k/mes",
    pricing_pro_cta: "Empezar con Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Operaciones grandes, sin techo",
    pricing_studio_f1: "Cuentas ilimitadas",
    pricing_studio_f2: "Decisiones ilimitadas",
    pricing_studio_f3: "Gasto ilimitado",
    pricing_studio_cta: "Hablar con ventas",
    pricing_details: "Ver todos los detalles",
    pricing_mo: "/mes",
    faq_title: "Preguntas que todo gestor hace antes",
    faq_q1: "¿AdBrief toca mi cuenta solo?",
    faq_a1: "Por defecto, no — cada recomendación pasa por tu clic (escalar, pausar, duplicar, ajustar budget). La única excepción es la protección automática contra pérdida: en casos extremos (CPA muy por encima de la meta, 0 conversiones y spend quemando a ritmo anormal), AdBrief pausa solo para evitarte el daño. Esa protección viene activada por defecto y se puede desactivar en configuración.",
    faq_q2: "¿Tengo que ser admin de la cuenta?",
    faq_a2: "Permiso de anunciante o superior basta. Funciona con BM compartidas de cliente y cuenta personal.",
    faq_q3: "¿Y si recomienda algo mal?",
    faq_a3: "Cada decisión viene con la razón explícita (ej: \"CPA subió 180% en 24h, 0 conversiones\"). Ves los números antes de aplicar. Y puedes revertir en 1 clic hasta 30 minutos después.",
    faq_q4: "¿Funciona para e-commerce? ¿Agencia? ¿Infoproducto?",
    faq_a4: "Sí a los tres. El sistema aprende de tu cuenta específica — lo que funciona para tu nicho, no genérico.",
    faq_q5: "¿Cuánto cuesta?",
    faq_a5: "Free da acceso completo con 1 cuenta Meta conectada y 15 decisiones aplicadas (sin tarjeta). Maker $19/mes para 1 cuenta con decisiones ilimitadas. Pro $49/mes para 3 cuentas. Studio $299/mes sin límite de cuentas ni decisiones.",
    faq_q6: "¿Puedo cancelar?",
    faq_a6: "Sí. Mensual, sin contrato, sin multa. Desconectar de Meta también es 1 clic.",
    faq_q7: "¿Mis datos están seguros?",
    faq_a7: "Sí. Usamos el OAuth oficial de Meta — autorizas acceso de lectura, nada más que lo necesario para el análisis se almacena. Ninguna credencial de cuenta pasa por AdBrief. Puedes revocar el acceso en cualquier momento desde Meta Business. Los datos de performance se cifran en tránsito y en reposo en Supabase (hospedado en EE.UU., compatible con SOC 2).",
    pricing_cta_title: "Precio simple por volumen de decisiones.",
    pricing_cta_sub: "Free para probar. Planes pagos desde $19/mes.",
    pricing_cta_btn: "Ver planes",
    pricing_cta_secondary: "Empezar gratis",
    final_title: "Ya viste cómo funciona.",
    final_sub: "Probá 3 días sin tarjeta.",
    final_cta: "Probar gratis",
    final_sub2: "Conecta tu cuenta Meta en el onboarding",
    final_login: "¿Ya tienes cuenta? Entrar",
    sticky_cta: "Conectar ahora",
    footer_tagline: "Sistema de decisión para Meta Ads",
    footer_product: "Producto",
    footer_how: "Cómo funciona",
    footer_pricing: "Precios",
    footer_faq: "FAQ",
    footer_company: "Empresa",
    footer_about: "Acerca de",
    footer_contact: "Contacto",
    footer_legal: "Legal",
    footer_terms: "Términos",
    footer_privacy: "Privacidad",
    footer_copy: "© 2026 AdBrief",
  },
};

// ── Language detection ────────────────────────────────────────────────────────
async function detectLang(): Promise<Lang> {
  const stored = storage.get("adbrief_language") as Lang | null;
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

// ── Scroll reveal hook ──────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// Track scroll progress through an element (0 = just entered viewport, 1 = exiting bottom).
// Used to animate the vertical timeline "fill" in FlowSection.
function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Start filling when top enters 85% of viewport, finish when bottom passes 40%.
      const total = r.height + vh * 0.45;
      const traveled = vh * 0.85 - r.top;
      const p = Math.max(0, Math.min(1, traveled / total));
      setProgress(p);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return { ref, progress };
}

// ── Language switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (l: Lang) => { setLang(l); storage.set("adbrief_language", l); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500,
        padding: "4px 8px", borderRadius: 6, background: "transparent",
        border: "none", color: TEXT3, cursor: "pointer", fontFamily: F,
      }}>
        <Globe size={11} strokeWidth={1.6} /> {lang.toUpperCase()}
        <ChevronDown size={9} style={{ transform: open ? "rotate(180deg)" : "none", opacity: 0.5, transition: `transform 0.2s ${EASE}` }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
            overflow: "hidden", zIndex: 999, minWidth: 80,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)", padding: 3,
          }}>
            {(["en", "pt", "es"] as Lang[]).map(l => (
              <button key={l} onClick={() => pick(l)} style={{
                width: "100%", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
                background: lang === l ? "rgba(14,165,233,0.06)" : "transparent", border: "none", borderRadius: 5,
                color: lang === l ? ACCENT : TEXT3, fontSize: 11, fontWeight: lang === l ? 600 : 400,
                cursor: "pointer", fontFamily: F,
              }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Trust Bar ───────────────────────────────────────────────────────────────
function TrustBar({ t }: { t: Record<string, string> }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderBottom: `1px solid ${BORDER}`,
      padding: "7px clamp(16px,4vw,32px)",
    }}>
      <div className="trust-inner" style={{
        maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: "clamp(12px, 3vw, 24px)", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: F, fontSize: 11, color: TEXT3, opacity: 0.85, fontWeight: 500 }}>{t.trust_powered}</span>
          <OpenAILogo size={14} opacity={0.85} />
          <span style={{ fontFamily: F, fontSize: 10, color: TEXT3, opacity: 0.5 }}>·</span>
          <ClaudeLogo size={14} opacity={0.85} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MetaLogo size={15} opacity={0.9} />
          <span style={{ fontFamily: F, fontSize: 11, color: TEXT3, opacity: 0.85, fontWeight: 500 }}>{t.trust_meta}</span>
        </div>
      </div>
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ t, lang, setLang }: { t: Record<string, string>; lang: Lang; setLang: (l: Lang) => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(0,0,0,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
      borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
      transition: `all 0.4s ${EASE}`,
    }}>
      <div style={{
        maxHeight: scrolled ? 0 : 40, opacity: scrolled ? 0 : 1,
        overflow: "hidden",
        transition: scrolled
          ? `max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out`
          : `max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-in 0.1s`,
      }}>
        <TrustBar t={t} />
      </div>
      <div style={{
        maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center",
        height: 56, padding: "0 clamp(16px,4vw,32px)",
      }}>
        <Logo size="lg" />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LangSwitcher lang={lang} setLang={setLang} />
          <button onClick={() => navigate("/login")} className="nav-login-btn" style={{
            fontFamily: F, fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
            background: "transparent", color: TEXT3, border: "none", cursor: "pointer",
            transition: `color 0.2s ${EASE}`,
          }}>
            {t.nav_login}
          </button>
          <button onClick={() => navigate("/signup")} className="nav-signup-btn" style={{
            fontFamily: F, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 7,
            background: "#fff", color: "#000", border: "none", cursor: "pointer",
            transition: `all 0.2s ${EASE}`,
          }}>
            {t.nav_signup}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── HeroScreenshot — Real product screenshot with callouts ──────────────────
// Image lives at /public/hero-screenshot.png (1647×902, ~1.83:1).
// Shows the AI diagnosing a ROAS drop with real metrics + action list.
// Callouts float outside the frame on >=1024px, collapse to clean image on mobile.
function HeroScreenshot({ t }: { t: Record<string, string> }) {
  // Inline product mockup — sharper than a PNG at every breakpoint, and lets us
  // zoom into the 3 most-important moments of the Central de Comando.
  return (
    <div className="product-mockup" style={{
      width: "100%", maxWidth: 560, position: "relative",
    }}>
      {/* Callout 1 — top-right, points at the real-account number */}
      <div className="hero-callout hero-callout-1" style={{
        position: "absolute",
        top: "18%", right: "-14%",
        zIndex: 3,
        fontFamily: F,
        padding: "9px 13px",
        background: "rgba(8,8,8,0.94)",
        border: `1px solid rgba(239,68,68,0.38)`,
        borderRadius: 10,
        fontSize: 11.5, fontWeight: 600, color: TEXT,
        letterSpacing: "-0.01em",
        boxShadow: "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.1)",
        backdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 8,
        maxWidth: 240,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: RED,
          boxShadow: `0 0 10px ${RED}`,
          flexShrink: 0,
        }} />
        {t.hero_callout_1}
        <svg style={{
          position: "absolute", right: "100%", top: "50%",
          transform: "translateY(-50%)",
          width: 48, height: 2, overflow: "visible",
          pointerEvents: "none",
        }} viewBox="0 0 48 2" preserveAspectRatio="none">
          <line x1="0" y1="1" x2="48" y2="1"
            stroke="rgba(239,68,68,0.45)" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      </div>

      {/* Callout 2 — bottom-left, points at the "Resolver agora" action */}
      <div className="hero-callout hero-callout-2" style={{
        position: "absolute",
        bottom: "22%", left: "-14%",
        zIndex: 3,
        fontFamily: F,
        padding: "9px 13px",
        background: "rgba(8,8,8,0.94)",
        border: `1px solid rgba(34,197,94,0.38)`,
        borderRadius: 10,
        fontSize: 11.5, fontWeight: 600, color: TEXT,
        letterSpacing: "-0.01em",
        boxShadow: "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.1)",
        backdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 8,
        maxWidth: 240,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: GREEN,
          boxShadow: `0 0 10px ${GREEN}`,
          flexShrink: 0,
        }} />
        {t.hero_callout_2}
        <svg style={{
          position: "absolute", left: "100%", top: "50%",
          transform: "translateY(-50%)",
          width: 48, height: 2, overflow: "visible",
          pointerEvents: "none",
        }} viewBox="0 0 48 2" preserveAspectRatio="none">
          <line x1="0" y1="1" x2="48" y2="1"
            stroke="rgba(34,197,94,0.45)" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      </div>

      {/* The product window — rebuilt as a Decision Card: the atomic moment of the product */}
      <div style={{
        position: "relative",
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        background: "#060606",
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.03),
          0 20px 60px rgba(0,0,0,0.5),
          0 60px 140px rgba(0,0,0,0.65)
        `,
        fontFamily: F,
      }}>
        {/* Window chrome */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(255,255,255,0.015)",
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", opacity: 0.8 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", opacity: 0.8 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", opacity: 0.8 }} />
          <div style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.02em" }}>
            adbrief.pro · Decisão sugerida
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "18px 18px 16px" }}>
          {/* AI header — the agent speaking */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <img
              src="/ab-avatar.png"
              alt="AdBrief"
              width={26}
              height={26}
              style={{
                width: 26, height: 26, borderRadius: 7, objectFit: "cover",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.06)", flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: TEXT, letterSpacing: "-0.01em" }}>AdBrief</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9.5, fontWeight: 700, color: ACCENT,
                  padding: "2px 7px", borderRadius: 5,
                  background: "rgba(14,165,233,0.10)",
                  border: "1px solid rgba(14,165,233,0.22)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  Decisão sugerida
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                analisou sua conta há 3 min · baseado nos últimos 7 dias
              </span>
            </div>
          </div>

          {/* Headline — the proposition */}
          <div style={{
            fontSize: 15.5, fontWeight: 700, color: TEXT,
            letterSpacing: "-0.02em", lineHeight: 1.35,
            marginBottom: 14,
          }}>
            Pausar <span style={{
              padding: "1px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.06)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13, fontWeight: 600,
            }}>UGC 03</span> — economia estimada{" "}
            <span style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>R$2.150/dia</span>
          </div>

          {/* Evidence — why the AI decided */}
          <div style={{
            padding: "12px 13px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 9,
            marginBottom: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.42)", letterSpacing: "0.12em", marginBottom: 2 }}>
              POR QUÊ
            </div>
            {[
              { label: "CTR", value: "0.80%", baseline: "base 2.14%", delta: "−62%", tone: "bad" as const },
              { label: "Hook rate", value: "14%", baseline: "base 28%", delta: "−50%", tone: "bad" as const },
              { label: "CPA", value: "R$87", baseline: "meta R$35", delta: "+149%", tone: "bad" as const },
            ].map((m) => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                <span style={{ width: 74, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
                  {m.label}
                </span>
                <span style={{ color: TEXT, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {m.value}
                </span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10.5 }}>
                  {m.baseline}
                </span>
                <span style={{
                  marginLeft: "auto",
                  fontSize: 10.5, fontWeight: 700, padding: "2px 6px",
                  borderRadius: 4,
                  background: m.tone === "bad" ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.10)",
                  color: m.tone === "bad" ? RED : GREEN,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {m.delta}
                </span>
              </div>
            ))}
          </div>

          {/* Confidence + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", fontWeight: 500 }}>
                Confiança
              </span>
              <div style={{
                position: "relative", flex: 1, height: 4, borderRadius: 2,
                background: "rgba(255,255,255,0.06)", overflow: "hidden", maxWidth: 110,
              }}>
                <div style={{
                  position: "absolute", inset: 0, width: "94%",
                  background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`,
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, fontVariantNumeric: "tabular-nums" }}>
                94%
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              flex: 1, fontFamily: F, fontSize: 13, fontWeight: 700,
              padding: "10px 14px", borderRadius: 8,
              background: "#fff", color: "#000", border: "none",
              cursor: "pointer", letterSpacing: "-0.01em",
              boxShadow: "0 2px 10px rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.1)",
            }}>
              Aprovar e pausar
            </button>
            <button style={{
              fontFamily: F, fontSize: 13, fontWeight: 600,
              padding: "10px 14px", borderRadius: 8,
              background: "transparent", color: TEXT, border: `1px solid rgba(255,255,255,0.12)`,
              cursor: "pointer", letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}>
              Ver detalhes
            </button>
          </div>

          {/* Footer meta */}
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", gap: 14,
            fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 500,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
              Reversível a qualquer momento
            </span>
            <span>·</span>
            <span>Log auditável</span>
          </div>
        </div>
      </div>

      {/* "Next in queue" card — shows the system is alive, processing */}
      <div style={{
        marginTop: 12,
        padding: "11px 14px",
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 10,
        fontFamily: F,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "rgba(245,158,11,0.8)",
          flexShrink: 0,
          animation: "heroQueuePulse 2.2s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ color: TEXT, fontWeight: 600 }}>Próxima na fila</span>
          <span style={{ color: "rgba(255,255,255,0.32)" }}> · Escalar UGC 07 (+32% CTR vs baseline)</span>
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.28)", fontWeight: 500, flexShrink: 0 }}>
          em 2 min
        </span>
      </div>

      {/* Subtle caption below the frame */}
      <p style={{
        fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.28)",
        margin: "14px 0 0", textAlign: "center", fontWeight: 500, letterSpacing: "-0.01em",
      }}>
        {t.hero_screenshot_label}
      </p>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  return (
    <section style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "120px clamp(20px,4vw,40px) 56px",
      background: BG, position: "relative", overflow: "hidden",
    }}>
      {/* Layer 1 — Dot grid (technical feel, masked at edges) */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          backgroundPosition: "0 0",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 85%)",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 85%)",
          opacity: 0.55,
        }}
      />

      {/* Layer 2 — Primary spotlight (top-center, brand blue) */}
      <div
        aria-hidden
        className="hero-bg-spotlight"
        style={{
          position: "absolute", top: "-30%", left: "50%",
          width: 1200, height: 900, marginLeft: -600,
          background: "radial-gradient(ellipse at center, rgba(14,165,233,0.22) 0%, rgba(14,165,233,0.08) 25%, rgba(14,165,233,0) 55%)",
          filter: "blur(20px)", pointerEvents: "none",
        }}
      />

      {/* Layer 3 — Ambient indigo (bottom right, adds depth) */}
      <div
        aria-hidden
        className="hero-bg-ambient"
        style={{
          position: "absolute", bottom: "-20%", right: "-10%",
          width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)",
          filter: "blur(80px)", pointerEvents: "none",
        }}
      />

      {/* Layer 4 — Subtle green accent (top-left, completes the triad) */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "10%", left: "-15%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 60%)",
          filter: "blur(90px)", pointerEvents: "none",
        }}
      />

      {/* Layer 5 — Diagonal streak (modernity cue, inspired by Framer/Vercel) */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "20%", right: "-10%",
          width: "60%", height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.30) 40%, rgba(14,165,233,0.50) 60%, transparent 100%)",
          transform: "rotate(-18deg)",
          transformOrigin: "right center",
          pointerEvents: "none",
        }}
      />

      {/* Layer 6 — Noise texture (grain, prevents banding) */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat", backgroundSize: "128px",
          mixBlendMode: "overlay",
        }}
      />

      {/* Layer 7 — Bottom vignette (fades into next section) */}
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 240,
          background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 80%, #000 100%)",
          pointerEvents: "none",
        }}
      />

      <div className="hero-grid" style={{
        maxWidth: 1100, width: "100%", margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1.15fr",
        gap: "clamp(48px,6vw,96px)", alignItems: "center",
      }}>
        {/* Left — copy — slight vertical offset for tension */}
        <div style={{ paddingTop: 24 }}>
          <span className="hero-tag-fade" style={{
            fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            color: ACCENT, display: "inline-block", marginBottom: 20, opacity: 0.7,
          }}>
            {t.hero_tag}
          </span>
          <h1 style={{
            fontFamily: F, fontSize: "clamp(32px,4vw,50px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.08,
            color: TEXT, margin: "0 0 18px", whiteSpace: "pre-line",
          }}>
            {t.hero_title}
          </h1>
          <p className="hero-sub-fade" style={{
            fontFamily: F, fontSize: "clamp(14px,1.15vw,16px)", color: TEXT2,
            lineHeight: 1.65, margin: "0 0 10px", maxWidth: 420, fontWeight: 400,
          }}>
            {t.hero_sub}
          </p>
          <p className="hero-sub-fade" style={{
            fontFamily: F, fontSize: 13, color: TEXT3, margin: "0 0 36px",
            fontWeight: 500, letterSpacing: "-0.01em",
          }}>
            {t.hero_support}
          </p>

          {/* CTA */}
          <div className="hero-cta-fade">
            <button
              onClick={() => navigate("/signup")}
              className="hero-cta-btn"
              style={{
                fontFamily: F, fontSize: 15, fontWeight: 700,
                padding: "14px 36px", borderRadius: 10,
                background: "#fff", color: "#000", border: "none",
                cursor: "pointer", transition: `all 0.25s ${EASE}`,
                letterSpacing: "-0.01em", minWidth: 220,
                boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(255,255,255,0.03)",
              }}
            >
              {t.hero_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
            </button>
            <p className="hero-detail-fade" style={{
              fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.22)",
              margin: "10px 0 0", fontWeight: 400,
            }}>
              {t.hero_cta_sub}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <a href="/login" style={{
              fontFamily: F, fontSize: 12.5, color: TEXT3, textDecoration: "none", fontWeight: 400,
            }}>
              {t.hero_login}
            </a>
          </div>
        </div>

        {/* Right — product carousel */}
        <div className="hero-mockup" style={{
          display: "flex", justifyContent: "flex-end", position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "90%", height: "90%", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 60%)",
            pointerEvents: "none", filter: "blur(60px)",
          }} />
          <HeroScreenshot t={t} />
        </div>
      </div>
    </section>
  );
}


// ── Section 2 — Concept: "Not a dashboard. A decision system." ──────────────
// Redesign: full-width stage with ambient spotlight, 3 pillar tiles with real
// icons (not dots), staggered scroll reveal. Shares bg with FlowSection below
// so the whole "how it works" arc feels like one continuous story.
function ConceptSection({ t }: { t: Record<string, string> }) {
  const headReveal = useReveal(0.25);
  const r1 = useReveal(0.25);
  const r2 = useReveal(0.25);
  const r3 = useReveal(0.25);

  const items = [
    { title: t.concept_s1, desc: t.concept_s1d, color: ACCENT, Icon: Brain },
    { title: t.concept_s2, desc: t.concept_s2d, color: INDIGO, Icon: Zap },
    { title: t.concept_s3, desc: t.concept_s3d, color: GREEN, Icon: CheckCircle2 },
  ];

  const refs = [r1, r2, r3];

  return (
    <section style={{
      background: BG,
      padding: "clamp(96px,12vw,160px) clamp(20px,4vw,40px) clamp(60px,8vw,80px)",
      borderTop: `1px solid ${BORDER}`,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient spotlight — subtle, draws eye to headline */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: "120%", height: "60%", pointerEvents: "none",
        background: `radial-gradient(ellipse 60% 100% at 50% 0%, ${ACCENT}12 0%, transparent 60%)`,
      }} />
      {/* Faint grid overlay */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.35,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 70% 70% at 50% 30%, #000 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 30%, #000 0%, transparent 75%)",
      }} />

      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative" }}>
        {/* Headline — centered, commanding */}
        <div
          ref={headReveal.ref}
          style={{
            textAlign: "center", maxWidth: 760, margin: "0 auto clamp(56px,7vw,88px)",
            opacity: headReveal.visible ? 1 : 0,
            transform: headReveal.visible ? "translateY(0)" : "translateY(18px)",
            transition: `all 0.7s ${EASE}`,
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 99,
            background: "rgba(14,165,233,0.06)", border: `1px solid ${ACCENT}22`,
            marginBottom: 22,
          }}>
            <Sparkles size={11} strokeWidth={2.4} color={ACCENT} />
            <span style={{
              fontFamily: F, fontSize: 10.5, fontWeight: 700, color: ACCENT,
              letterSpacing: "0.12em", textTransform: "uppercase",
            }}>
              {t.concept_kicker}
            </span>
          </div>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(32px,4.4vw,56px)", fontWeight: 800,
            letterSpacing: "-0.045em", lineHeight: 1.04,
            color: TEXT, margin: 0, whiteSpace: "pre-line",
          }}>
            {t.concept_title}
          </h2>
        </div>

        {/* Pillar tiles — 3 up on desktop, stacked on mobile */}
        <div className="concept-pillars" style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: "clamp(14px,2vw,22px)",
        }}>
          {items.map((item, i) => {
            const { Icon } = item;
            return (
              <div
                key={i}
                ref={refs[i].ref}
                style={{
                  position: "relative", overflow: "hidden",
                  padding: "28px 24px 26px",
                  borderRadius: 18,
                  background: `linear-gradient(180deg, ${item.color}08 0%, rgba(255,255,255,0.01) 60%)`,
                  border: `1px solid ${item.color}18`,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.015) inset, 0 24px 48px -28px ${item.color}30`,
                  opacity: refs[i].visible ? 1 : 0,
                  transform: refs[i].visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.98)",
                  transition: `all 0.7s ${EASE} ${i * 0.12}s, border-color 0.2s, box-shadow 0.2s`,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = `${item.color}3c`;
                  el.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.025) inset, 0 32px 64px -28px ${item.color}50`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = `${item.color}18`;
                  el.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.015) inset, 0 24px 48px -28px ${item.color}30`;
                }}
              >
                {/* Icon tile */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${item.color}10`,
                  border: `1px solid ${item.color}32`,
                  boxShadow: `0 0 24px ${item.color}22, inset 0 0 0 1px rgba(255,255,255,0.03)`,
                  marginBottom: 18,
                  position: "relative",
                }}>
                  <Icon size={20} strokeWidth={2} color={item.color} />
                  {/* Soft glow ring */}
                  <div aria-hidden="true" style={{
                    position: "absolute", inset: -6, borderRadius: 16,
                    background: `radial-gradient(circle at 50% 50%, ${item.color}18 0%, transparent 70%)`,
                    pointerEvents: "none",
                  }} />
                </div>
                <h3 style={{
                  fontFamily: F, fontSize: 16, fontWeight: 700, color: TEXT,
                  letterSpacing: "-0.02em", margin: "0 0 8px",
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontFamily: F, fontSize: 13.5, color: TEXT2, lineHeight: 1.6,
                  margin: 0, fontWeight: 400,
                }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Section 3 — "How it works" timeline ─────────────────────────────────────
// Redesign: vertical timeline with scroll-driven connector fill, rich step
// cards with icon tile + mini mock preview, staggered reveal per row.
function FlowStep({
  index, total, step, progress, reveal,
}: {
  index: number;
  total: number;
  step: {
    title: string; desc: string; badge: string;
    color: string; Icon: any; mock: React.ReactNode;
  };
  progress: number;   // 0–1 overall scroll progress (for fill line anchor logic)
  reveal: boolean;
}) {
  const { Icon } = step;
  // Staggered per-step threshold along the progress band
  const stepStart = index / (total + 0.3);
  const stepEnd = (index + 1) / (total + 0.3);
  const localReveal = reveal && progress >= stepStart * 0.4; // relax threshold

  return (
    <div
      className="flow-step"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "72px 1fr",
        gap: 24,
        paddingBottom: index === total - 1 ? 0 : 44,
        opacity: localReveal ? 1 : 0,
        transform: localReveal ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ${EASE}, transform 0.7s ${EASE}`,
        zIndex: 1,
      }}
    >
      {/* Left rail — number + glowing node */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${step.color}18 0%, ${step.color}05 100%)`,
          border: `1px solid ${step.color}40`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.02) inset, 0 18px 40px -20px ${step.color}60, 0 0 32px ${step.color}22`,
          position: "relative", zIndex: 2,
          transition: `transform 0.4s ${EASE}`,
          transform: localReveal ? "scale(1)" : "scale(0.85)",
        }}>
          <Icon size={22} strokeWidth={1.9} color={step.color} />
          {/* Pulse ring for active step */}
          {localReveal && (
            <span aria-hidden="true" style={{
              position: "absolute", inset: -4, borderRadius: 20,
              border: `1px solid ${step.color}40`,
              animation: "flowNodePulse 2.4s ease-out infinite",
              pointerEvents: "none",
            }} />
          )}
        </div>
        <div style={{
          fontFamily: F, fontSize: 10, fontWeight: 700,
          color: TEXT3, letterSpacing: "0.18em",
          marginTop: 10,
        }}>
          0{index + 1}
        </div>
      </div>

      {/* Right — card with copy + mock */}
      <div style={{
        padding: "20px 22px 20px",
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.008) 100%)",
        border: `1px solid ${BORDER}`,
        transition: `border-color 0.3s ${EASE}, transform 0.6s ${EASE}`,
        transform: localReveal ? "translateX(0)" : "translateX(-14px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <h3 style={{
            fontFamily: F, fontSize: 18, fontWeight: 700, color: TEXT,
            letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2,
          }}>
            {step.title}
          </h3>
          <span style={{
            fontFamily: F, fontSize: 10.5, fontWeight: 700,
            color: step.color, letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 99,
            background: `${step.color}14`, border: `1px solid ${step.color}2a`,
            fontVariantNumeric: "tabular-nums",
          }}>
            {step.badge}
          </span>
        </div>
        <p style={{
          fontFamily: F, fontSize: 13.5, color: TEXT2, lineHeight: 1.6,
          margin: "0 0 16px", fontWeight: 400,
        }}>
          {step.desc}
        </p>
        {/* Mini mock */}
        <div style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.018)",
          border: `1px solid rgba(255,255,255,0.04)`,
        }}>
          {step.mock}
        </div>
      </div>
    </div>
  );
}

function FlowSection({ t }: { t: Record<string, string> }) {
  const head = useReveal(0.25);
  const timeline = useScrollProgress();

  const steps = [
    {
      title: t.flow_s1, desc: t.flow_s1d, badge: t.flow_s1b,
      color: "#0082FB", Icon: Plug,
      mock: (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,130,251,0.08)", border: "1px solid rgba(0,130,251,0.25)",
          }}>
            <MetaLogo size={14} opacity={0.95} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: TEXT }}>{t.flow_m_acct_meta}</div>
            <div style={{ fontFamily: F, fontSize: 11, color: TEXT3 }}>{t.flow_m_acct_sub}</div>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: F, fontSize: 10, fontWeight: 700, color: GREEN,
            padding: "3px 8px", borderRadius: 99,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
          }}>
            <span style={{
              display: "inline-block", width: 5, height: 5, borderRadius: "50%",
              background: GREEN,
              boxShadow: `0 0 6px ${GREEN}`,
            }} />
            {t.flow_s1b}
          </span>
        </div>
      ),
    },
    {
      title: t.flow_s2, desc: t.flow_s2d, badge: t.flow_s2b,
      color: ACCENT, Icon: Radar,
      mock: (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 38 }}>
          {[32, 58, 41, 74, 52, 88, 46, 70, 38, 64, 78, 50].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 2,
              background: `linear-gradient(to top, ${ACCENT}aa, ${ACCENT}40)`,
              animation: `flowBar 1.4s ease-in-out ${i * 0.08}s infinite alternate`,
              minHeight: 3,
            }} />
          ))}
        </div>
      ),
    },
    {
      title: t.flow_s3, desc: t.flow_s3d, badge: t.flow_s3b,
      color: INDIGO, Icon: Bell,
      mock: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { tag: t.flow_m_dec_urgent, color: RED, text: t.flow_m_dec_urgent_text },
            { tag: t.flow_m_dec_scale, color: GREEN, text: t.flow_m_dec_scale_text },
            { tag: t.flow_m_dec_test, color: INDIGO, text: t.flow_m_dec_test_text },
          ].map((it, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 9px", borderRadius: 7,
              background: `${it.color}0c`, border: `1px solid ${it.color}28`,
            }}>
              <span style={{
                fontFamily: F, fontSize: 9.5, fontWeight: 800, color: it.color,
                letterSpacing: "0.1em", minWidth: 54,
              }}>{it.tag}</span>
              <span style={{ fontFamily: F, fontSize: 11.5, color: TEXT2, fontWeight: 500 }}>
                {it.text}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: t.flow_s4, desc: t.flow_s4d, badge: t.flow_s4b,
      color: GREEN, Icon: CheckCircle2,
      mock: (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={{
            flex: 1, padding: "9px 12px",
            borderRadius: 9, border: "none", cursor: "pointer",
            background: "#ffffff", color: "#0a0a0a",
            fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -8px ${GREEN}66`,
          }}>
            <CheckCircle2 size={12} strokeWidth={2.4} /> {t.flow_m_btn_approve}
          </button>
          <button style={{
            padding: "9px 12px", borderRadius: 9,
            border: `1px solid ${BORDER}`, background: "transparent",
            color: TEXT2, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            {t.flow_m_btn_details}
          </button>
        </div>
      ),
    },
    {
      title: t.flow_s5, desc: t.flow_s5d, badge: t.flow_s5b,
      color: GREEN, Icon: TrendingUp,
      mock: (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg viewBox="0 0 120 38" width="100%" height="38" style={{ flex: 1, display: "block" }}>
            <defs>
              <linearGradient id="flowSpark" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity="0.45" />
                <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,30 L15,28 L30,25 L45,22 L60,20 L75,14 L90,10 L105,6 L120,3 L120,38 L0,38 Z" fill="url(#flowSpark)" />
            <path d="M0,30 L15,28 L30,25 L45,22 L60,20 L75,14 L90,10 L105,6 L120,3" fill="none" stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <div style={{ fontFamily: F, fontSize: 10.5, color: TEXT3, fontWeight: 600, letterSpacing: "0.1em" }}>ROAS</div>
            <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>3.2x</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="flow" style={{
      background: BG,
      padding: "clamp(40px,6vw,72px) clamp(20px,4vw,40px) clamp(96px,12vw,160px)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient bottom glow — hands off visually to next section */}
      <div aria-hidden="true" style={{
        position: "absolute", bottom: "-20%", left: "50%", transform: "translateX(-50%)",
        width: "120%", height: "55%", pointerEvents: "none",
        background: `radial-gradient(ellipse 60% 100% at 50% 100%, ${GREEN}10 0%, transparent 60%)`,
      }} />

      <div style={{ maxWidth: 840, margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div
          ref={head.ref}
          style={{
            textAlign: "center", maxWidth: 640, margin: "0 auto clamp(56px,7vw,80px)",
            opacity: head.visible ? 1 : 0,
            transform: head.visible ? "translateY(0)" : "translateY(16px)",
            transition: `all 0.7s ${EASE}`,
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 99,
            background: "rgba(34,197,94,0.06)", border: `1px solid ${GREEN}22`,
            marginBottom: 20,
          }}>
            <Activity size={11} strokeWidth={2.4} color={GREEN} />
            <span style={{
              fontFamily: F, fontSize: 10.5, fontWeight: 700, color: GREEN,
              letterSpacing: "0.12em", textTransform: "uppercase",
            }}>
              {t.flow_kicker}
            </span>
          </div>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(28px,3.8vw,46px)", fontWeight: 800,
            letterSpacing: "-0.045em", lineHeight: 1.06,
            color: TEXT, margin: "0 0 14px", whiteSpace: "pre-line",
          }}>
            {t.flow_title}
          </h2>
          <p style={{
            fontFamily: F, fontSize: 15, color: TEXT2, lineHeight: 1.55,
            margin: 0, maxWidth: 520, marginLeft: "auto", marginRight: "auto",
          }}>
            {t.flow_sub}
          </p>
        </div>

        {/* Timeline */}
        <div ref={timeline.ref} style={{ position: "relative" }}>
          {/* Connector rail — full-length faint track (behind everything) */}
          <div aria-hidden="true" style={{
            position: "absolute", left: 35, top: 28, bottom: 28,
            width: 2, borderRadius: 2,
            background: "linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            zIndex: 0, pointerEvents: "none",
          }} />
          {/* Connector fill — driven by scroll progress, behind cards and nodes */}
          <div aria-hidden="true" style={{
            position: "absolute", left: 35, top: 28,
            width: 2, borderRadius: 2,
            height: `calc(${Math.min(timeline.progress * 100, 100)}% - 56px)`,
            maxHeight: "calc(100% - 56px)",
            background: `linear-gradient(to bottom, ${ACCENT} 0%, ${INDIGO} 45%, ${GREEN} 100%)`,
            boxShadow: `0 0 12px ${ACCENT}40`,
            transition: `height 0.5s cubic-bezier(0.22, 1, 0.36, 1)`,
            zIndex: 0, pointerEvents: "none",
            willChange: "height",
          }} />

          {steps.map((step, i) => (
            <FlowStep
              key={i}
              index={i}
              total={steps.length}
              step={step}
              progress={timeline.progress}
              reveal={head.visible}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes flowNodePulse {
          0% { transform: scale(1); opacity: 0.6; }
          80% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes flowBar {
          from { transform: scaleY(0.85); opacity: 0.7; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @media (max-width: 720px) {
          .flow-step { grid-template-columns: 56px 1fr !important; gap: 16px !important; padding-bottom: 32px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .flow-step { transition: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}

// ── Section 3.5 — Compare (AdBrief vs Ads Manager) ─────────────────────────
// Side-by-side comparison. Each column leads with a real product-like
// visual so the difference reads at a glance before any copy does.
function CompareSection({ t }: { t: Record<string, string> }) {
  const head = useReveal(0.25);
  const left = useReveal(0.2);
  const right = useReveal(0.2);

  const adsRows = [t.compare_ads_1, t.compare_ads_2, t.compare_ads_3, t.compare_ads_4];
  const adbriefRows = [t.compare_adbrief_1, t.compare_adbrief_2, t.compare_adbrief_3, t.compare_adbrief_4];

  // Left mock: a dense, cold KPI grid + messy little chart. Numbers without
  // narrative — the "dashboard" experience.
  const kpis = [
    { label: "Spend", val: "R$21.540", hint: "7d" },
    { label: "CTR", val: "0.82%", hint: "↓" },
    { label: "CPM", val: "R$42.10", hint: "↑" },
    { label: "Freq", val: "3.8", hint: "7d" },
    { label: "Conv", val: "24", hint: "7d" },
    { label: "CPA", val: "R$87", hint: "↑" },
  ];

  return (
    <section style={{
      background: BG2,
      padding: "clamp(88px,11vw,140px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Soft ambient divide — top edge of section catches a slight cool tint */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: "120%", height: "55%", pointerEvents: "none",
        background: `radial-gradient(ellipse 60% 100% at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 60%)`,
      }} />

      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div
          ref={head.ref}
          style={{
            textAlign: "center", maxWidth: 720, margin: "0 auto clamp(48px,6vw,72px)",
            opacity: head.visible ? 1 : 0,
            transform: head.visible ? "translateY(0)" : "translateY(16px)",
            transition: `all 0.7s ${EASE}`,
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 99,
            background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
            marginBottom: 20,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: TEXT3 }} />
            <span style={{
              fontFamily: F, fontSize: 10.5, fontWeight: 700, color: TEXT2,
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              {t.compare_kicker}
            </span>
          </div>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 800,
            letterSpacing: "-0.045em", lineHeight: 1.08,
            color: TEXT, margin: "0 0 12px", whiteSpace: "pre-line",
          }}>
            {t.compare_title}
          </h2>
          <p style={{
            fontFamily: F, fontSize: 15, color: TEXT2, margin: 0, lineHeight: 1.55,
          }}>
            {t.compare_sub}
          </p>
        </div>

        <div className="compare-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "clamp(14px,2vw,22px)",
          alignItems: "stretch",
        }}>
          {/* ─────── Left: Meta Ads Manager — cold, dense, "what happened" ─────── */}
          <div
            ref={left.ref}
            style={{
              position: "relative",
              padding: "28px 26px 28px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.018)",
              border: `1px solid ${BORDER}`,
              display: "flex", flexDirection: "column",
              opacity: left.visible ? 1 : 0,
              transform: left.visible ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.7s ${EASE}`,
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
            }}>
              <MetaLogo size={18} opacity={0.6} />
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT2, letterSpacing: "-0.01em" }}>
                {t.compare_ads_title}
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: F, fontSize: 9.5, fontWeight: 700,
                color: TEXT3, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 99,
                background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`,
              }}>
                {t.compare_ads_sublabel}
              </span>
            </div>
            <p style={{
              fontFamily: F, fontSize: 12.5, color: TEXT3, lineHeight: 1.55,
              margin: "0 0 20px",
            }}>
              {t.compare_ads_caption}
            </p>

            {/* KPI grid mock — dense numbers, no narrative */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6, marginBottom: 14,
            }}>
              {kpis.map((k, i) => (
                <div key={i} style={{
                  padding: "10px 11px",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${BORDER}`,
                }}>
                  <div style={{
                    fontFamily: F, fontSize: 9.5, color: TEXT3,
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
                  }}>
                    <span>{k.label}</span>
                    <span style={{ fontWeight: 700, opacity: 0.7 }}>{k.hint}</span>
                  </div>
                  <div style={{
                    fontFamily: F, fontSize: 13.5, fontWeight: 700, color: TEXT2,
                    letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums",
                  }}>
                    {k.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Tiny bar chart — "you figure it out" energy */}
            <div style={{
              padding: "12px 14px 10px",
              borderRadius: 9,
              background: "rgba(255,255,255,0.015)",
              border: `1px solid ${BORDER}`,
              marginBottom: 22,
            }}>
              <div style={{
                fontFamily: F, fontSize: 9.5, color: TEXT3,
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8,
              }}>
                {t.compare_ads_chart_label}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 30 }}>
                {[42, 58, 31, 74, 29, 55, 46, 68, 52, 35, 48, 62, 40, 30].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`,
                    background: "rgba(255,255,255,0.16)", borderRadius: 1.5,
                    minHeight: 2,
                  }} />
                ))}
              </div>
            </div>

            {/* Limitations list — muted */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              {adsRows.map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.16)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <X size={9} color={RED} strokeWidth={2.6} />
                  </span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: TEXT3, lineHeight: 1.5 }}>
                    {row}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─────── Right: AdBrief — warm, focused, "what to do" ─────── */}
          <div
            ref={right.ref}
            style={{
              position: "relative",
              padding: "28px 26px 28px",
              borderRadius: 18,
              background: `linear-gradient(180deg, rgba(14,165,233,0.06) 0%, rgba(34,197,94,0.03) 100%)`,
              border: `1px solid rgba(14,165,233,0.22)`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.02) inset, 0 32px 64px -32px rgba(14,165,233,0.35)`,
              display: "flex", flexDirection: "column",
              opacity: right.visible ? 1 : 0,
              transform: right.visible ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.7s ${EASE} 0.08s`,
            }}
          >
            {/* Subtle internal glow */}
            <div aria-hidden="true" style={{
              position: "absolute", inset: 0, borderRadius: 18, pointerEvents: "none",
              background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08) 0%, transparent 70%)`,
            }} />

            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <img
                src="/ab-avatar.png"
                alt="AdBrief"
                width={18}
                height={18}
                loading="lazy"
                decoding="async"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  objectFit: "cover", display: "block",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
                }}
              />
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.01em" }}>
                {t.compare_adbrief_title}
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: F, fontSize: 9.5, fontWeight: 700,
                color: ACCENT, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 99,
                background: "rgba(14,165,233,0.1)", border: `1px solid rgba(14,165,233,0.3)`,
              }}>
                {t.compare_adbrief_sublabel}
              </span>
            </div>
            <p style={{
              fontFamily: F, fontSize: 12.5, color: TEXT2, lineHeight: 1.55,
              margin: "0 0 20px",
              position: "relative",
            }}>
              {t.compare_adbrief_caption}
            </p>

            {/* Decision card mock — single focus, actionable */}
            <div style={{
              position: "relative",
              padding: "16px 16px 14px",
              borderRadius: 12,
              background: "rgba(10,12,18,0.55)",
              border: `1px solid rgba(14,165,233,0.28)`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.02) inset, 0 18px 40px -20px rgba(14,165,233,0.5)`,
              marginBottom: 22,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: F, fontSize: 9.5, fontWeight: 800,
                  color: "#fca5a5", letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "3px 8px", borderRadius: 99,
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)",
                }}>
                  {t.compare_adbrief_mock_tag}
                </span>
                <span style={{
                  fontFamily: F, fontSize: 10.5, color: TEXT3,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {t.compare_adbrief_mock_time}
                </span>
              </div>
              <div style={{
                fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT,
                letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 4,
              }}>
                {t.compare_adbrief_mock_headline}
              </div>
              <div style={{
                fontFamily: F, fontSize: 12, color: TEXT2, lineHeight: 1.5,
                marginBottom: 12,
              }}>
                {t.compare_adbrief_mock_reason}
              </div>

              {/* Confidence bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              }}>
                <div style={{
                  flex: 1, height: 4, borderRadius: 99,
                  background: "rgba(255,255,255,0.04)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: "94%",
                    background: `linear-gradient(to right, ${ACCENT}, ${GREEN})`,
                    borderRadius: 99,
                    boxShadow: `0 0 10px ${ACCENT}80`,
                  }} />
                </div>
                <span style={{
                  fontFamily: F, fontSize: 10.5, fontWeight: 700,
                  color: GREEN, letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  94%
                </span>
              </div>

              {/* Action row */}
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{
                  flex: 1, padding: "8px 12px", border: "none", cursor: "pointer",
                  borderRadius: 8,
                  background: "#ffffff", color: "#0a0a0a",
                  fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: `0 8px 20px -8px ${ACCENT}66`,
                }}>
                  <CheckCircle2 size={12} strokeWidth={2.4} /> {t.compare_adbrief_mock_btn}
                </button>
                <button style={{
                  padding: "8px 12px", borderRadius: 8,
                  border: `1px solid rgba(255,255,255,0.1)`, background: "transparent",
                  color: TEXT2, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {t.compare_adbrief_mock_btn2}
                </button>
              </div>
            </div>

            {/* Advantages list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              {adbriefRows.map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.26)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                    boxShadow: `0 0 10px rgba(34,197,94,0.15)`,
                  }}>
                    <CheckCircle2 size={10} color={GREEN} strokeWidth={2.5} />
                  </span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: TEXT, lineHeight: 1.5, fontWeight: 500 }}>
                    {row}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .compare-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .compare-grid > div { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>
    </section>
  );
}

// ── Section 5 — Pricing (non-generic, with hierarchy) ──────────────────────
function PricingCTA({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  const { ref, visible } = useReveal(0.2);

  return (
    <section id="pricing" style={{
      background: BG, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }} ref={ref}>
      <div style={{
        maxWidth: 680, margin: "0 auto", textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `all 0.5s ${EASE}`,
      }}>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 12px", lineHeight: 1.15,
        }}>
          {t.pricing_cta_title}
        </h2>
        <p style={{
          fontFamily: F, fontSize: 15, color: TEXT3, margin: "0 0 32px", lineHeight: 1.5,
        }}>
          {t.pricing_cta_sub}
        </p>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <button
            onClick={() => navigate("/pricing")}
            style={{
              fontFamily: F, fontSize: 14, fontWeight: 700,
              padding: "12px 22px", borderRadius: 10,
              background: TEXT, color: "#000",
              border: "none", cursor: "pointer",
              transition: `all 0.2s ${EASE}`,
              display: "inline-flex", alignItems: "center", gap: 7,
            }}
          >
            {t.pricing_cta_btn}
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>
          <button
            onClick={() => navigate("/signup")}
            style={{
              fontFamily: F, fontSize: 14, fontWeight: 600,
              padding: "12px 22px", borderRadius: 10,
              background: "transparent", color: TEXT2,
              border: `1px solid ${BORDER}`, cursor: "pointer",
              transition: `all 0.2s ${EASE}`,
            }}
          >
            {t.pricing_cta_secondary}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Section 5.5 — FAQ (6 objections) ───────────────────────────────────────
function FAQSection({ t }: { t: Record<string, string> }) {
  const qa = [
    { q: t.faq_q1, a: t.faq_a1 },
    { q: t.faq_q2, a: t.faq_a2 },
    { q: t.faq_q3, a: t.faq_a3 },
    { q: t.faq_q4, a: t.faq_a4 },
    { q: t.faq_q5, a: t.faq_a5 },
    { q: t.faq_q6, a: t.faq_a6 },
    { q: t.faq_q7, a: t.faq_a7 },
  ];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" style={{
      background: BG2, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(22px,2.6vw,30px)", fontWeight: 800,
          letterSpacing: "-0.03em", color: TEXT, margin: "0 0 36px", textAlign: "center",
        }}>
          {t.faq_title}
        </h2>

        <div style={{
          background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`,
          overflow: "hidden",
        }}>
          {qa.map((item, i) => {
            const isOpen = open === i;
            const isLast = i === qa.length - 1;
            return (
              <div key={i} style={{
                borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
              }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{
                    width: "100%", padding: "18px 20px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "transparent", border: "none", cursor: "pointer",
                    textAlign: "left", fontFamily: F,
                    transition: `background 0.2s ${EASE}`,
                  }}
                  className="faq-row"
                >
                  <span style={{
                    fontSize: 14, fontWeight: 600, color: isOpen ? TEXT : TEXT2,
                    letterSpacing: "-0.01em", lineHeight: 1.4, paddingRight: 16,
                  }}>
                    {item.q}
                  </span>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: isOpen ? `${ACCENT}10` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isOpen ? `${ACCENT}25` : BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isOpen ? ACCENT : TEXT3,
                    transition: `all 0.25s ${EASE}`,
                  }}>
                    {isOpen ? <Minus size={12} strokeWidth={2.2} /> : <Plus size={12} strokeWidth={2.2} />}
                  </span>
                </button>
                <div style={{
                  maxHeight: isOpen ? 260 : 0,
                  overflow: "hidden",
                  transition: `max-height 0.35s ${EASE}`,
                }}>
                  <p style={{
                    fontFamily: F, fontSize: 13, color: TEXT3, lineHeight: 1.6,
                    padding: "0 20px 20px", margin: 0,
                  }}>
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Section 6 — Final CTA ──────────────────────────────────────────────────
function FinalCTA({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  return (
    <section style={{
      background: BG2, padding: "clamp(80px,10vw,120px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`, position: "relative", overflow: "hidden",
    }}>
      {/* Subtle ambient */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.03) 0%, transparent 60%)",
        pointerEvents: "none", filter: "blur(80px)",
      }} />
      <div style={{ maxWidth: 500, margin: "0 auto", position: "relative" }}>
        <p style={{ fontFamily: F, fontSize: 14, color: TEXT3, margin: "0 0 8px" }}>
          {t.final_title}
        </p>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,3vw,36px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 36px",
        }}>
          {t.final_sub}
        </h2>

        <div>
          <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
            fontFamily: F, fontSize: 15, fontWeight: 700,
            padding: "14px 36px", borderRadius: 10,
            background: "#fff", color: "#000", border: "none",
            cursor: "pointer", transition: `all 0.25s ${EASE}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            {t.final_cta} <ArrowRight size={15} strokeWidth={2.2} style={{ marginLeft: 6, verticalAlign: "middle", position: "relative", top: -0.5 }} />
          </button>
          <p style={{
            fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.22)",
            margin: "10px 0 0",
          }}>
            {t.final_sub2}
          </p>
        </div>

        <div style={{ marginTop: 14 }}>
          <a href="/login" style={{ fontFamily: F, fontSize: 12, color: TEXT3, textDecoration: "none" }}>
            {t.final_login}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer (proper, with columns) ──────────────────────────────────────────
function Footer({ t }: { t: Record<string, string> }) {
  const cols = [
    { title: t.footer_product, links: [{ label: t.footer_how, href: "/#flow" }, { label: t.footer_pricing, href: "/pricing" }, { label: t.footer_faq, href: "/#faq" }] },
    { title: t.footer_company, links: [{ label: t.footer_about, href: "/about" }, { label: t.footer_contact, href: "mailto:hello@adbrief.pro" }] },
    { title: t.footer_legal, links: [{ label: t.footer_terms, href: "/terms" }, { label: t.footer_privacy, href: "/privacy" }] },
  ];

  return (
    <footer style={{
      background: BG, borderTop: `1px solid ${BORDER}`,
      padding: "48px clamp(20px,4vw,40px) 32px",
    }}>
      <div className="footer-inner" style={{
        maxWidth: 1120, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "clamp(24px,4vw,48px)",
      }}>
        {/* Brand */}
        <div>
          <Logo size="lg" />
          <p style={{
            fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.22)",
            margin: "10px 0 0", lineHeight: 1.5,
          }}>
            {t.footer_tagline}
          </p>
        </div>

        {/* Columns */}
        {cols.map((col, i) => (
          <div key={i}>
            <span style={{
              fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.25)", display: "block", marginBottom: 12,
              textTransform: "uppercase",
            }}>
              {col.title}
            </span>
            {col.links.map((link, j) => (
              <a key={j} href={link.href} style={{
                fontFamily: F, fontSize: 12.5, color: TEXT3, textDecoration: "none",
                display: "block", marginBottom: 8, transition: `color 0.2s ${EASE}`,
              }}
                className="footer-link"
              >
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{
        maxWidth: 1120, margin: "0 auto", paddingTop: 28, marginTop: 28,
        borderTop: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{t.footer_copy}</span>
      </div>
    </footer>
  );
}

// ── Sticky CTA bar ──────────────────────────────────────────────────────────
function StickyBar({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="sticky-bar" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: "blur(16px) saturate(1.4)",
      borderTop: `1px solid ${BORDER}`,
      padding: "10px clamp(16px,4vw,32px)",
      transform: visible ? "translateY(0)" : "translateY(100%)",
      transition: `transform 0.4s ${EASE}`,
      pointerEvents: visible ? "auto" : "none",
    }}>
      <div style={{
        maxWidth: 1120, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12,
      }}>
        <button onClick={() => navigate("/signup")} className="hero-cta-btn" style={{
          fontFamily: F, fontSize: 13, fontWeight: 700,
          padding: "9px 24px", borderRadius: 8,
          background: "#fff", color: "#000", border: "none",
          cursor: "pointer", transition: `all 0.2s ${EASE}`,
        }}>
          {t.sticky_cta} <ArrowRight size={13} strokeWidth={2.2} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function IndexNew() {
  const { language: ctxLang } = useLanguage();
  const [lang, setLang] = useState<Lang>((ctxLang as Lang) || "pt");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    detectLang().then(l => { setLang(l); setReady(true); });
  }, []);

  const t = TX[lang] || TX.en;
  if (!ready) return <div style={{ background: BG, minHeight: "100vh" }} />;

  const titleMap: Record<Lang, string> = {
    pt: "AdBrief — Motor de decisão para Meta Ads",
    en: "AdBrief — Decision engine for Meta Ads",
    es: "AdBrief — Motor de decisión para Meta Ads",
  };
  const descMap: Record<Lang, string> = {
    pt: "Analisa suas campanhas, mostra o que fazer e deixa você aplicar em um clique.",
    en: "Analyzes your campaigns, shows what to do, and lets you apply it in one click.",
    es: "Analiza tus campañas, muestra qué hacer y te deja aplicarlo en un clic.",
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <Helmet>
        <title>{titleMap[lang]}</title>
        <meta name="description" content={descMap[lang]} />
        <meta property="og:title" content={titleMap[lang]} />
        <meta property="og:description" content={descMap[lang]} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://adbrief.pro" />
        <link rel="canonical" href="https://adbrief.pro" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "AdBrief",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://adbrief.pro",
          "description": descMap.en,
          "offers": [
            { "@type": "Offer", "name": "Maker", "price": "19", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Pro", "price": "49", "priceCurrency": "USD" },
            { "@type": "Offer", "name": "Studio", "price": "299", "priceCurrency": "USD" },
          ],
        })}</script>
      </Helmet>

      <Nav t={t} lang={lang} setLang={setLang} />
      <Hero t={t} />
      <ConceptSection t={t} />
      <FlowSection t={t} />
      <CompareSection t={t} />
      <PricingCTA t={t} />
      <FAQSection t={t} />
      <FinalCTA t={t} />
      <Footer t={t} />
      <StickyBar t={t} />
      <CookieConsent />

      <style>{`
        /* ── Animations ──────────────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-tag-fade { animation: fadeUp 0.6s ${EASE} 0.05s both; }
        .hero-sub-fade { animation: fadeUp 0.6s ${EASE} 0.15s both; }
        .hero-cta-fade { animation: fadeUp 0.6s ${EASE} 0.25s both; }
        .hero-detail-fade { animation: fadeUp 0.5s ${EASE} 0.35s both; }

        /* ── Hero background breathing ────────────────────────── */
        @keyframes heroSpotlightPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.04); }
        }
        @keyframes heroAmbientDrift {
          0%, 100% { transform: translate(0, 0); opacity: 0.9; }
          50%      { transform: translate(-30px, -20px); opacity: 1; }
        }
        .hero-bg-spotlight { animation: heroSpotlightPulse 9s ${EASE} infinite; }
        .hero-bg-ambient   { animation: heroAmbientDrift 14s ${EASE} infinite; }

        /* ── Decision card "next in queue" dot ──────────────────── */
        @keyframes heroQueuePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50%      { opacity: 1;   transform: scale(1.15); box-shadow: 0 0 10px 2px rgba(245,158,11,0.35); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-bg-spotlight, .hero-bg-ambient { animation: none !important; }
        }

        /* ── Hero callouts — fade in after image ───────────────── */
        .hero-callout {
          animation: calloutIn 0.6s ${EASE} 0.8s both;
        }
        .hero-callout-2 { animation-delay: 1.05s; }
        @keyframes calloutIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Mobile ≤768px ────────────────────────────────────── */
        @media (max-width: 768px) {
          .nav-signup-btn { display: none !important; }
          .trust-inner { gap: 8px !important; }
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .hero-grid h1 { text-align: center; }
          .hero-grid p { margin-left: auto; margin-right: auto; }
          .hero-mockup {
            justify-content: center !important;
            margin-top: 24px;
          }
          .product-mockup {
            max-width: 100% !important;
          }
          /* Hide callouts on mobile — they'd overflow the screen */
          .hero-callout { display: none !important; }
          .concept-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .concept-grid h2 { text-align: center; }
          .flow-steps { padding-left: 0 !important; }
          .social-logos {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }
          .social-logos > :nth-child(4),
          .social-logos > :nth-child(5) { display: none !important; }
          .social-stats {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            padding: 18px !important;
          }
          .social-stats .social-stat:nth-child(odd) { border-left: none !important; padding-left: 0 !important; }
          .social-stats .social-stat:nth-child(3),
          .social-stats .social-stat:nth-child(4) {
            border-top: 1px solid ${BORDER}; padding-top: 14px; margin-top: 6px;
          }
          .social-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .compare-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          .pricing-card { transform: none !important; }
          .loop-flow {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .loop-arrows { display: none !important; }
          .footer-inner {
            grid-template-columns: 1fr 1fr !important;
            gap: 28px !important;
          }
          .sticky-bar { display: none !important; }
        }

        /* ── Small phones ≤375px ──────────────────────────────── */
        @media (max-width: 375px) {
          .hero-grid h1 { font-size: 26px !important; line-height: 1.12 !important; }
          .hero-grid p { font-size: 13px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; max-width: 340px !important; margin: 0 auto !important; }
          .footer-inner { grid-template-columns: 1fr !important; }
        }

        /* ── Tablet 769-1023px ────────────────────────────────── */
        @media (min-width: 769px) and (max-width: 1023px) {
          .hero-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 36px !important;
          }
          .product-mockup { max-width: 100% !important; }
          /* Callouts overflow the narrow column on tablet — hide */
          .hero-callout { display: none !important; }
          .concept-grid { gap: 40px !important; }
          .social-grid { gap: 14px !important; }
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          .footer-inner { grid-template-columns: 1fr 1fr 1fr 1fr !important; }
          .loop-arrows { display: none !important; }
        }

        /* ── iPad Pro gap ──────────────────────────────────────── */
        @media (min-width: 1024px) and (max-width: 1120px) {
          .pricing-grid { gap: 10px !important; }
        }

        /* ── Hover (desktop only) ─────────────────────────────── */
        @media (hover: hover) {
          .hero-cta-btn:hover {
            transform: scale(1.03) !important;
            box-shadow: 0 4px 24px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.1), 0 0 60px rgba(255,255,255,0.04) !important;
          }
          .hero-cta-btn:active {
            transform: scale(0.98) !important;
          }
          .pricing-cta-btn:hover { opacity: 0.85; transform: translateY(-0.5px); }
          .pricing-card:hover {
            border-color: rgba(255,255,255,0.12) !important;
            transform: translateY(-4px) !important;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3) !important;
          }
          .faq-row:hover { background: rgba(255,255,255,0.015) !important; }
          .nav-signup-btn:hover { background: rgba(255,255,255,0.9) !important; transform: translateY(-1px); }
          .nav-login-btn:hover { color: ${TEXT} !important; }
          .footer-link:hover { color: ${TEXT2} !important; }
          .pricing-details-link:hover { color: ${ACCENT} !important; }
          .client-logo:hover { color: rgba(255,255,255,0.85) !important; }
        }

        /* ── Global ──────────────────────────────────────────── */
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(14,165,233,0.25); }
        body, html { overflow-x: hidden; }
      `}</style>
    </div>
  );
}
