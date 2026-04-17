// IndexNew.tsx — Staff-level landing · Decision engine for Meta Ads
// Complete from-scratch rebuild with depth system, real SVG logos, visual flow
import { useNavigate } from "react-router-dom";
import { storage } from "@/lib/storage";
import { Globe, ChevronDown, ArrowRight, CheckCircle2, Pause, TrendingUp, ChevronRight, Zap, Brain } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import CookieConsent from "@/components/CookieConsent";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

// ── Design tokens ───────────────────────────────────────────────────────────
const F = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const BG = "#070d1a";
const BG2 = "#0a1020";
const SURFACE = "#0d1117";
const SURFACE2 = "#161B22";
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
    hero_tag: "MOTOR DE DECISÃO PARA META ADS",
    hero_title: "Sua campanha te diz\no que fazer agora.",
    hero_sub: "AdBrief analisa suas campanhas em tempo real, encontra oportunidades e deixa você aplicar em um clique.",
    hero_support: "Sem análise manual. Sem achismo.",
    hero_cta: "Começar grátis",
    hero_cta_sub: "Sem cartão · Sem configuração · 15 melhorias grátis",
    hero_login: "Já tem conta? Entrar",
    // mockup — realistic scaling campaign
    mock_decisions: "DECISÕES",
    mock_7d: "7 dias",
    mock_invested: "INVESTIDO",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_campaign: "Escala Lookalike — Top Criativos",
    mock_campaign_status: "Ativa",
    mock_ads_count: "4 anúncios",
    mock_ad1: "UGC_Depoimento_v3",
    mock_ad1_status: "Ativo",
    mock_ad1_metrics: "CTR 3.8% · CPA R$22 · ROAS 4.2x",
    mock_scale: "Escalar — ROAS 4.2x com CPA estável há 7 dias",
    mock_scale_d: "Frequência 1.4 e CPM caindo. Janela de escala aberta — aumentar 20% do budget mantém eficiência.",
    mock_scale_cta: "+20% budget",
    mock_intel_title: "INTELIGÊNCIA",
    mock_intel1: "UGC com prova social converte 2.3x mais que produto isolado",
    mock_intel1_conf: "Confiança alta · 12 criativos analisados",
    mock_intel2: "Hook nos primeiros 2s retém 68% mais audiência neste nicho",
    mock_intel2_conf: "Confiança média · 8 vídeos",
    mock_opp: "PRÓXIMA OPORTUNIDADE",
    mock_opp_t: "Criar variação UGC do criativo top",
    mock_apply: "Gerar com IA",
    mock_applied: "Gerado",
    mock_estimated: "+26% ROAS estimado",
    // concept
    concept_title: "Não é um dashboard.\nÉ um sistema de decisão.",
    concept_s1: "Análise contínua",
    concept_s1d: "Monitora suas campanhas 24/7 e identifica oportunidades que você perderia.",
    concept_s2: "Decisões claras",
    concept_s2d: "Cada oportunidade vem com uma recomendação específica: pausar, escalar ou ajustar.",
    concept_s3: "Execução imediata",
    concept_s3d: "Aplique a melhoria direto no AdBrief. Sem abrir o Gerenciador de Anúncios.",
    // flow
    flow_title: "Como funciona",
    flow_s1: "Você conecta sua conta",
    flow_s2: "O sistema analisa",
    flow_s3: "Oportunidades aparecem",
    flow_s4: "Você aplica",
    flow_s5: "A performance melhora",
    // loop
    loop_title: "Cada melhoria gera a próxima.",
    loop_sub: "O sistema aprende com cada ação e fica mais preciso a cada ciclo.",
    loop_s1: "Você aplica",
    loop_s1d: "Aceita a decisão direto no feed. Um clique.",
    loop_s2: "O sistema aprende",
    loop_s2d: "Cada resultado vira padrão. A IA evolui com seus dados.",
    loop_s3: "Nova oportunidade",
    loop_s3d: "Recomendações cada vez mais específicas pro seu negócio.",
    // pricing
    pricing_title: "Quanto você quer melhorar?",
    pricing_sub: "Você paga pelas melhorias aplicadas na sua campanha.",
    pricing_free: "Free",
    pricing_free_d: "Para começar",
    pricing_free_f1: "15 melhorias",
    pricing_free_f2: "Acesso completo",
    pricing_free_cta: "Criar conta",
    pricing_maker: "Maker",
    pricing_maker_d: "Para rodar com consistência",
    pricing_maker_f1: "1.000 melhorias",
    pricing_maker_f2: "Uso contínuo",
    pricing_maker_cta: "Começar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Plano mais escolhido",
    pricing_pro_d: "Escala com clareza",
    pricing_pro_f1: "2.500 melhorias",
    pricing_pro_f2: "Escala com clareza",
    pricing_pro_cta: "Começar com Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Sem limites",
    pricing_studio_f1: "Melhorias ilimitadas",
    pricing_studio_f2: "Para operações reais",
    pricing_studio_cta: "Ir para Studio",
    pricing_details: "Ver todos os detalhes",
    pricing_mo: "/mês",
    // final
    final_title: "Você já viu como funciona.",
    final_sub: "Aplique sua primeira melhoria agora.",
    final_cta: "Começar grátis",
    final_sub2: "Leva menos de 10 segundos",
    final_login: "Já tem conta? Entrar",
    // sticky
    sticky_cta: "Aplicar melhorias agora",
    // footer
    footer_tagline: "Sistema de decisão para Meta Ads",
    footer_product: "Produto",
    footer_how: "Como funciona",
    footer_pricing: "Preços",
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
    hero_tag: "DECISION ENGINE FOR META ADS",
    hero_title: "Your campaign tells you\nwhat to do now.",
    hero_sub: "AdBrief analyzes your campaigns in real time, finds opportunities, and lets you apply them in one click.",
    hero_support: "No manual analysis. No guessing.",
    hero_cta: "Start free",
    hero_cta_sub: "No card · No setup · 15 free improvements",
    hero_login: "Already have an account? Log in",
    mock_decisions: "DECISIONS",
    mock_7d: "7 days",
    mock_invested: "INVESTED",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_campaign: "Scale Lookalike — Top Creatives",
    mock_campaign_status: "Active",
    mock_ads_count: "4 ads",
    mock_ad1: "UGC_Testimonial_v3",
    mock_ad1_status: "Active",
    mock_ad1_metrics: "CTR 3.8% · CPA $6.20 · ROAS 4.2x",
    mock_scale: "Scale — ROAS 4.2x with stable CPA for 7 days",
    mock_scale_d: "Frequency 1.4 and CPM declining. Scale window open — 20% budget increase maintains efficiency.",
    mock_scale_cta: "+20% budget",
    mock_intel_title: "INTELLIGENCE",
    mock_intel1: "UGC with social proof converts 2.3x more than product-only",
    mock_intel1_conf: "High confidence · 12 creatives analyzed",
    mock_intel2: "Hook in first 2s retains 68% more audience in this niche",
    mock_intel2_conf: "Medium confidence · 8 videos",
    mock_opp: "NEXT OPPORTUNITY",
    mock_opp_t: "Create UGC variation of top creative",
    mock_apply: "Generate with AI",
    mock_applied: "Generated",
    mock_estimated: "+26% estimated ROAS",
    concept_title: "Not a dashboard.\nA decision system.",
    concept_s1: "Continuous analysis",
    concept_s1d: "Monitors your campaigns 24/7 and identifies opportunities you'd miss.",
    concept_s2: "Clear decisions",
    concept_s2d: "Each opportunity comes with a specific recommendation: pause, scale, or adjust.",
    concept_s3: "Immediate execution",
    concept_s3d: "Apply the improvement directly in AdBrief. No need to open Ads Manager.",
    flow_title: "How it works",
    flow_s1: "You connect your account",
    flow_s2: "The system analyzes",
    flow_s3: "Opportunities appear",
    flow_s4: "You apply",
    flow_s5: "Performance improves",
    loop_title: "Each improvement generates the next.",
    loop_sub: "The system learns from every action and gets sharper each cycle.",
    loop_s1: "You apply",
    loop_s1d: "Accept the decision right in the feed. One click.",
    loop_s2: "System learns",
    loop_s2d: "Every result becomes a pattern. The AI evolves with your data.",
    loop_s3: "New opportunity",
    loop_s3d: "Recommendations increasingly specific to your business.",
    pricing_title: "How much do you want to improve?",
    pricing_sub: "You pay for improvements applied to your campaign.",
    pricing_free: "Free",
    pricing_free_d: "To get started",
    pricing_free_f1: "15 improvements",
    pricing_free_f2: "Full access",
    pricing_free_cta: "Create account",
    pricing_maker: "Maker",
    pricing_maker_d: "For running consistently",
    pricing_maker_f1: "1,000 improvements",
    pricing_maker_f2: "Continuous use",
    pricing_maker_cta: "Get started",
    pricing_pro: "Pro",
    pricing_pro_badge: "Most chosen plan",
    pricing_pro_d: "Scale with clarity",
    pricing_pro_f1: "2,500 improvements",
    pricing_pro_f2: "Scale with clarity",
    pricing_pro_cta: "Start with Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "No limits",
    pricing_studio_f1: "Unlimited improvements",
    pricing_studio_f2: "For real operations",
    pricing_studio_cta: "Go Studio",
    pricing_details: "See all details",
    pricing_mo: "/mo",
    final_title: "You've seen how it works.",
    final_sub: "Apply your first improvement now.",
    final_cta: "Start free",
    final_sub2: "Takes less than 10 seconds",
    final_login: "Already have an account? Log in",
    sticky_cta: "Apply improvements now",
    footer_tagline: "Decision system for Meta Ads",
    footer_product: "Product",
    footer_how: "How it works",
    footer_pricing: "Pricing",
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
    hero_tag: "MOTOR DE DECISIÓN PARA META ADS",
    hero_title: "Tu campaña te dice\nqué hacer ahora.",
    hero_sub: "AdBrief analiza tus campañas en tiempo real, encuentra oportunidades y te deja aplicarlas en un clic.",
    hero_support: "Sin análisis manual. Sin suposiciones.",
    hero_cta: "Empezar gratis",
    hero_cta_sub: "Sin tarjeta · Sin configuración · 15 mejoras gratis",
    hero_login: "¿Ya tienes cuenta? Entrar",
    mock_decisions: "DECISIONES",
    mock_7d: "7 días",
    mock_invested: "INVERTIDO",
    mock_cpa: "CPA",
    mock_ctr: "CTR",
    mock_roas: "ROAS",
    mock_campaign: "Escala Lookalike — Top Creativos",
    mock_campaign_status: "Activa",
    mock_ads_count: "4 anuncios",
    mock_ad1: "UGC_Testimonio_v3",
    mock_ad1_status: "Activo",
    mock_ad1_metrics: "CTR 3.8% · CPA $6.20 · ROAS 4.2x",
    mock_scale: "Escalar — ROAS 4.2x con CPA estable hace 7 días",
    mock_scale_d: "Frecuencia 1.4 y CPM bajando. Ventana de escala abierta — subir 20% del budget mantiene eficiencia.",
    mock_scale_cta: "+20% budget",
    mock_intel_title: "INTELIGENCIA",
    mock_intel1: "UGC con prueba social convierte 2.3x más que producto solo",
    mock_intel1_conf: "Confianza alta · 12 creativos analizados",
    mock_intel2: "Hook en primeros 2s retiene 68% más audiencia en este nicho",
    mock_intel2_conf: "Confianza media · 8 videos",
    mock_opp: "PRÓXIMA OPORTUNIDAD",
    mock_opp_t: "Crear variación UGC del creativo top",
    mock_apply: "Generar con IA",
    mock_applied: "Generado",
    mock_estimated: "+26% ROAS estimado",
    concept_title: "No es un dashboard.\nEs un sistema de decisión.",
    concept_s1: "Análisis continuo",
    concept_s1d: "Monitorea tus campañas 24/7 e identifica oportunidades que perderías.",
    concept_s2: "Decisiones claras",
    concept_s2d: "Cada oportunidad viene con una recomendación específica: pausar, escalar o ajustar.",
    concept_s3: "Ejecución inmediata",
    concept_s3d: "Aplica la mejora directo en AdBrief. Sin abrir el Administrador de Anuncios.",
    flow_title: "Cómo funciona",
    flow_s1: "Conectas tu cuenta",
    flow_s2: "El sistema analiza",
    flow_s3: "Aparecen oportunidades",
    flow_s4: "Las aplicas",
    flow_s5: "La performance mejora",
    loop_title: "Cada mejora genera la siguiente.",
    loop_sub: "El sistema aprende de cada acción y se vuelve más preciso en cada ciclo.",
    loop_s1: "Tú aplicas",
    loop_s1d: "Acepta la decisión directo en el feed. Un clic.",
    loop_s2: "El sistema aprende",
    loop_s2d: "Cada resultado se vuelve patrón. La IA evoluciona con tus datos.",
    loop_s3: "Nueva oportunidad",
    loop_s3d: "Recomendaciones cada vez más específicas para tu negocio.",
    pricing_title: "¿Cuánto quieres mejorar?",
    pricing_sub: "Pagas por las mejoras aplicadas en tu campaña.",
    pricing_free: "Free",
    pricing_free_d: "Para empezar",
    pricing_free_f1: "15 mejoras",
    pricing_free_f2: "Acceso completo",
    pricing_free_cta: "Crear cuenta",
    pricing_maker: "Maker",
    pricing_maker_d: "Para rodar con consistencia",
    pricing_maker_f1: "1.000 mejoras",
    pricing_maker_f2: "Uso continuo",
    pricing_maker_cta: "Empezar",
    pricing_pro: "Pro",
    pricing_pro_badge: "Plan más elegido",
    pricing_pro_d: "Escala con claridad",
    pricing_pro_f1: "2.500 mejoras",
    pricing_pro_f2: "Escala con claridad",
    pricing_pro_cta: "Empezar con Pro",
    pricing_studio: "Studio",
    pricing_studio_d: "Sin límites",
    pricing_studio_f1: "Mejoras ilimitadas",
    pricing_studio_f2: "Para operaciones reales",
    pricing_studio_cta: "Ir a Studio",
    pricing_details: "Ver todos los detalles",
    pricing_mo: "/mes",
    final_title: "Ya viste cómo funciona.",
    final_sub: "Aplica tu primera mejora ahora.",
    final_cta: "Empezar gratis",
    final_sub2: "Toma menos de 10 segundos",
    final_login: "¿Ya tienes cuenta? Entrar",
    sticky_cta: "Aplicar mejoras ahora",
    footer_tagline: "Sistema de decisión para Meta Ads",
    footer_product: "Producto",
    footer_how: "Cómo funciona",
    footer_pricing: "Precios",
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
      background: "rgba(255,255,255,0.025)", borderBottom: `1px solid ${BORDER}`,
      padding: "7px clamp(16px,4vw,32px)",
    }}>
      <div className="trust-inner" style={{
        maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center",
        justifyContent: "center", gap: "clamp(12px, 3vw, 24px)", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: F, fontSize: 11, color: TEXT3, opacity: 0.7, fontWeight: 500 }}>{t.trust_powered}</span>
          <OpenAILogo size={14} opacity={0.65} />
          <span style={{ fontFamily: F, fontSize: 10, color: TEXT3, opacity: 0.35 }}>·</span>
          <ClaudeLogo size={14} opacity={0.65} />
        </div>
        <span style={{ fontFamily: F, fontSize: 10, color: TEXT3, opacity: 0.25 }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MetaLogo size={15} opacity={0.7} />
          <span style={{ fontFamily: F, fontSize: 11, color: TEXT3, opacity: 0.7, fontWeight: 500 }}>{t.trust_meta}</span>
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
      background: scrolled ? "rgba(7,13,26,0.92)" : "transparent",
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

// ── Live Product (hero visual — auto-demo) ──────────────────────────────────
function LiveProduct({ t }: { t: Record<string, string> }) {
  const [applied, setApplied] = useState(false);
  const [roas, setRoas] = useState("4.2x");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const doApply = () => {
      setApplied(true);
      setRoas("4.8x");
      setTimeout(() => { setApplied(false); setRoas("4.2x"); }, 2500);
    };
    const first = setTimeout(doApply, 1800);
    const interval = setInterval(doApply, 7000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  return (
    <div className="product-mockup" style={{
      background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
      overflow: "hidden", fontFamily: F, width: "100%", maxWidth: 520,
      transform: "perspective(1400px) rotateY(-2deg) rotateX(0.5deg)",
      transition: `all 0.6s ${EASE}`,
      boxShadow: `
        0 0 0 1px rgba(255,255,255,0.03),
        0 8px 32px rgba(0,0,0,0.35),
        0 40px 100px rgba(0,0,0,0.55)
      `,
      animation: "mockFloat 6s ease-in-out infinite",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px", borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: TEXT3, letterSpacing: "0.12em" }}>
          {t.mock_decisions}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", padding: "2px 8px",
          background: "rgba(255,255,255,0.03)", borderRadius: 4,
        }}>{t.mock_7d}</span>
      </div>

      {/* Metrics — green-dominant */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
        borderBottom: `1px solid ${BORDER}`, padding: "14px 16px",
      }}>
        {[
          { label: t.mock_invested, value: "R$8.740", color: TEXT },
          { label: t.mock_cpa, value: "R$22", color: GREEN },
          { label: t.mock_ctr, value: "3.8%", color: GREEN },
          { label: t.mock_roas, value: roas, color: GREEN },
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em", marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: m.color, letterSpacing: "-0.02em",
              transition: `all 0.5s ${EASE}`,
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Campaign card — expandable */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.08)",
          borderRadius: 9, overflow: "hidden",
        }}>
          {/* Campaign header — clickable */}
          <div
            onClick={() => setExpanded(!expanded)}
            style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <ChevronRight size={12} style={{
              color: TEXT3, transition: `transform 0.3s ${EASE}`,
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: "0 0 8px rgba(34,197,94,0.4)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT, flex: 1 }}>{t.mock_campaign}</span>
            <span style={{ fontSize: 9, color: TEXT3, fontWeight: 600 }}>{t.mock_ads_count}</span>
          </div>

          {/* Expanded: ad row inside */}
          <div style={{
            maxHeight: expanded ? 60 : 0, overflow: "hidden",
            transition: `max-height 0.4s ${EASE}`,
          }}>
            <div style={{
              padding: "6px 14px 10px 38px",
              borderTop: `1px solid rgba(255,255,255,0.04)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: GREEN, opacity: 0.7 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: TEXT2 }}>{t.mock_ad1}</span>
                <span style={{ fontSize: 8.5, color: GREEN, fontWeight: 700, marginLeft: "auto" }}>{t.mock_ad1_status}</span>
              </div>
              <div style={{ fontSize: 9, color: TEXT3, paddingLeft: 10, opacity: 0.8 }}>{t.mock_ad1_metrics}</div>
            </div>
          </div>
        </div>

        {/* Scale decision — the big card */}
        <div style={{
          background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.10)",
          borderRadius: 9, padding: "10px 14px",
          boxShadow: "0 0 20px rgba(34,197,94,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <TrendingUp size={12} style={{ color: GREEN }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT, flex: 1 }}>{t.mock_scale}</span>
          </div>
          <p style={{ fontSize: 10, color: TEXT2, margin: "0 0 8px", paddingLeft: 19, lineHeight: 1.5 }}>{t.mock_scale_d}</p>
          <div style={{ paddingLeft: 19 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: GREEN, padding: "3px 10px",
              borderRadius: 5, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <TrendingUp size={9} /> {t.mock_scale_cta}
            </span>
          </div>
        </div>
      </div>

      {/* Intelligence section */}
      <div style={{
        margin: "2px 14px 6px", padding: "10px 14px", borderRadius: 9,
        background: "rgba(255,255,255,0.015)", border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Brain size={11} style={{ color: INDIGO, opacity: 0.7 }} />
          <span style={{ fontSize: 8.5, fontWeight: 800, color: INDIGO, letterSpacing: "0.1em", opacity: 0.6 }}>
            {t.mock_intel_title}
          </span>
        </div>

        {/* Pattern 1 */}
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 10, color: TEXT2, margin: 0, lineHeight: 1.45, fontWeight: 500 }}>{t.mock_intel1}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: GREEN }} />
            <span style={{ fontSize: 8.5, color: GREEN, fontWeight: 600, opacity: 0.8 }}>{t.mock_intel1_conf}</span>
          </div>
        </div>

        {/* Pattern 2 */}
        <div>
          <p style={{ fontSize: 10, color: TEXT2, margin: 0, lineHeight: 1.45, fontWeight: 500 }}>{t.mock_intel2}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#eab308" }} />
            <span style={{ fontSize: 8.5, color: "#eab308", fontWeight: 600, opacity: 0.8 }}>{t.mock_intel2_conf}</span>
          </div>
        </div>
      </div>

      {/* Opportunity — focal point */}
      <div style={{
        margin: "2px 14px 14px", padding: "14px 16px", borderRadius: 10,
        borderLeft: `3px solid ${applied ? GREEN : GREEN}`,
        background: applied ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.03)",
        boxShadow: applied ? "0 0 30px rgba(34,197,94,0.10)" : "0 0 16px rgba(34,197,94,0.04)",
        transition: `all 0.5s ${EASE}`,
      }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: GREEN, letterSpacing: "0.12em", marginBottom: 6, opacity: 0.5 }}>
          {t.mock_opp}
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: "0 0 10px" }}>
          {t.mock_opp_t} · <span style={{ color: GREEN, fontWeight: 700 }}>{t.mock_estimated}</span>
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#fff",
            padding: "7px 16px", borderRadius: 7,
            background: GREEN, cursor: "default",
            display: "inline-flex", alignItems: "center", gap: 5,
            boxShadow: applied ? "0 2px 16px rgba(34,197,94,0.35)" : "0 2px 10px rgba(34,197,94,0.2)",
            transition: `all 0.4s ${EASE}`,
            transform: applied ? "scale(1.03)" : "scale(1)",
          }}>
            {applied ? <><CheckCircle2 size={12} strokeWidth={2.2} /> {t.mock_applied}</> : <><Zap size={11} /> {t.mock_apply}</>}
          </span>
        </div>
      </div>
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
      {/* Ambient light sources */}
      <div style={{
        position: "absolute", top: "-5%", right: "0%",
        width: 800, height: 800, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 50%)",
        pointerEvents: "none", filter: "blur(100px)",
      }} />
      <div style={{
        position: "absolute", bottom: "5%", left: "-5%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.025) 0%, transparent 50%)",
        pointerEvents: "none", filter: "blur(80px)",
      }} />
      {/* Noise texture overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.015, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat", backgroundSize: "128px",
      }} />

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

        {/* Right — live product */}
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
          <LiveProduct t={t} />
        </div>
      </div>
    </section>
  );
}

// ── Section 2 — Concept break (asymmetric) ──────────────────────────────────
function ConceptSection({ t }: { t: Record<string, string> }) {
  const r1 = useReveal();
  const r2 = useReveal();
  const r3 = useReveal();

  const items = [
    { title: t.concept_s1, desc: t.concept_s1d, color: ACCENT },
    { title: t.concept_s2, desc: t.concept_s2d, color: INDIGO },
    { title: t.concept_s3, desc: t.concept_s3d, color: GREEN },
  ];

  const refs = [r1, r2, r3];

  return (
    <section style={{
      background: BG2, padding: "clamp(80px,10vw,120px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div className="concept-grid" style={{
        maxWidth: 960, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "clamp(48px,6vw,80px)", alignItems: "start",
      }}>
        {/* Left — big statement */}
        <div>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800,
            letterSpacing: "-0.04em", lineHeight: 1.08,
            color: TEXT, margin: 0, whiteSpace: "pre-line",
          }}>
            {t.concept_title}
          </h2>
        </div>

        {/* Right — stacked explanation blocks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 8 }}>
          {items.map((item, i) => (
            <div
              key={i}
              ref={refs[i].ref}
              style={{
                opacity: refs[i].visible ? 1 : 0,
                transform: refs[i].visible ? "translateY(0)" : "translateY(16px)",
                transition: `all 0.6s ${EASE} ${i * 0.12}s`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", background: item.color,
                  boxShadow: `0 0 10px ${item.color}40`,
                }} />
                <span style={{
                  fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT,
                  letterSpacing: "-0.02em",
                }}>
                  {item.title}
                </span>
              </div>
              <p style={{
                fontFamily: F, fontSize: 13, color: TEXT3, lineHeight: 1.65, margin: 0,
                paddingLeft: 16, fontWeight: 400,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 3 — Visual flow "How it works" ──────────────────────────────────
function FlowSection({ t }: { t: Record<string, string> }) {
  const { ref, visible } = useReveal(0.2);
  const steps = [
    { text: t.flow_s1, icon: <MetaLogo size={18} opacity={0.8} />, color: "#0082FB" },
    { text: t.flow_s2, icon: null, color: ACCENT },
    { text: t.flow_s3, icon: null, color: INDIGO },
    { text: t.flow_s4, icon: null, color: GREEN },
    { text: t.flow_s5, icon: null, color: GREEN },
  ];

  return (
    <section style={{
      background: BG, padding: "clamp(80px,10vw,120px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }} ref={ref}>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 56px",
        }}>
          {t.flow_title}
        </h2>

        <div className="flow-steps" style={{
          display: "flex", flexDirection: "column", gap: 0, position: "relative",
        }}>
          {/* Vertical connector line */}
          <div style={{
            position: "absolute", left: 15, top: 20, bottom: 20, width: 1,
            background: `linear-gradient(to bottom, ${ACCENT}30, ${GREEN}30)`,
          }} />

          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, padding: "16px 0",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(-20px)",
              transition: `all 0.5s ${EASE} ${i * 0.1}s`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: `${step.color}08`, border: `1px solid ${step.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1,
                boxShadow: `0 0 20px ${step.color}10`,
              }}>
                {step.icon || (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: step.color, boxShadow: `0 0 8px ${step.color}40`,
                  }} />
                )}
              </div>
              <span style={{
                fontFamily: F, fontSize: 14, fontWeight: 600, color: TEXT2,
                letterSpacing: "-0.01em",
              }}>
                {step.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section 4 — Loop (horizontal + animated) ───────────────────────────────
function LoopSection({ t }: { t: Record<string, string> }) {
  const [active, setActive] = useState(0);
  const steps = [
    { label: t.loop_s1, icon: <Zap size={18} />, color: GREEN, desc: t.loop_s1d || "" },
    { label: t.loop_s2, icon: <Brain size={18} />, color: INDIGO, desc: t.loop_s2d || "" },
    { label: t.loop_s3, icon: <TrendingUp size={18} />, color: ACCENT, desc: t.loop_s3d || "" },
  ];

  useEffect(() => {
    const interval = setInterval(() => setActive(a => (a + 1) % 3), 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{
      background: BG2, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{
          fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
          letterSpacing: "-0.04em", color: TEXT, margin: "0 0 16px", textAlign: "center",
        }}>
          {t.loop_title}
        </h2>
        <p style={{
          fontFamily: F, fontSize: "clamp(13px,1.1vw,15px)", color: TEXT3,
          margin: "0 0 48px", textAlign: "center", maxWidth: 480, marginLeft: "auto", marginRight: "auto",
          lineHeight: 1.6,
        }}>
          {t.loop_sub || ""}
        </p>

        {/* Cards grid */}
        <div className="loop-flow" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: "clamp(10px, 2vw, 16px)", position: "relative",
        }}>
          {steps.map((step, i) => {
            const isActive = active === i;
            return (
              <div key={i} style={{
                padding: "clamp(20px,2.5vw,28px) clamp(16px,2vw,22px)",
                borderRadius: 14,
                background: isActive ? `${step.color}08` : "rgba(255,255,255,0.015)",
                border: `1px solid ${isActive ? `${step.color}25` : BORDER}`,
                boxShadow: isActive ? `0 0 32px ${step.color}10, 0 8px 24px rgba(0,0,0,0.2)` : "0 2px 8px rgba(0,0,0,0.1)",
                transition: `all 0.5s ${EASE}`,
                transform: isActive ? "translateY(-4px)" : "translateY(0)",
                textAlign: "center", position: "relative", overflow: "hidden",
              }}>
                {/* Step number */}
                <div style={{
                  fontSize: 10, fontWeight: 800, color: isActive ? step.color : TEXT3,
                  letterSpacing: "0.1em", marginBottom: 12, opacity: isActive ? 0.6 : 0.3,
                  transition: `all 0.4s ${EASE}`,
                }}>
                  0{i + 1}
                </div>

                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, margin: "0 auto 14px",
                  background: isActive ? `${step.color}12` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? `${step.color}20` : "rgba(255,255,255,0.04)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isActive ? step.color : TEXT3,
                  transition: `all 0.4s ${EASE}`,
                  boxShadow: isActive ? `0 0 16px ${step.color}15` : "none",
                }}>
                  {step.icon}
                </div>

                {/* Label */}
                <div style={{
                  fontFamily: F, fontSize: "clamp(13px,1.1vw,15px)", fontWeight: 700,
                  color: isActive ? TEXT : TEXT2,
                  marginBottom: 8, transition: `color 0.4s ${EASE}`,
                }}>
                  {step.label}
                </div>

                {/* Description */}
                {step.desc && (
                  <div style={{
                    fontFamily: F, fontSize: 11, color: TEXT3,
                    lineHeight: 1.55, opacity: isActive ? 0.8 : 0.5,
                    transition: `opacity 0.4s ${EASE}`,
                  }}>
                    {step.desc}
                  </div>
                )}

                {/* Active indicator dot */}
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: step.color, margin: "14px auto 0",
                  opacity: isActive ? 1 : 0.15,
                  boxShadow: isActive ? `0 0 8px ${step.color}` : "none",
                  transition: `all 0.4s ${EASE}`,
                }} />
              </div>
            );
          })}

          {/* Connecting arrows between cards — desktop only */}
          <div className="loop-arrows" style={{
            position: "absolute", top: "50%", left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: "30%",
            pointerEvents: "none", transform: "translateY(-50%)",
          }}>
            <ArrowRight size={14} style={{ color: "rgba(255,255,255,0.08)" }} />
            <ArrowRight size={14} style={{ color: "rgba(255,255,255,0.08)" }} />
          </div>
        </div>

        {/* Loop-back indicator */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, marginTop: 28, opacity: 0.25,
        }}>
          <div style={{ width: 40, height: 1, background: `linear-gradient(to right, transparent, ${ACCENT})` }} />
          <ArrowRight size={11} style={{ color: ACCENT, transform: "rotate(180deg)" }} />
          <span style={{ fontFamily: F, fontSize: 9, color: ACCENT, fontWeight: 600, letterSpacing: "0.1em" }}>LOOP</span>
          <ArrowRight size={11} style={{ color: ACCENT }} />
          <div style={{ width: 40, height: 1, background: `linear-gradient(to left, transparent, ${ACCENT})` }} />
        </div>
      </div>
    </section>
  );
}

// ── Section 5 — Pricing (non-generic, with hierarchy) ──────────────────────
function PricingSection({ t }: { t: Record<string, string> }) {
  const navigate = useNavigate();

  const plans = [
    {
      name: t.pricing_free, desc: t.pricing_free_d, price: "$0", mo: false,
      f1: t.pricing_free_f1, f2: t.pricing_free_f2,
      cta: t.pricing_free_cta, action: () => navigate("/signup"),
      tier: "free" as const,
    },
    {
      name: t.pricing_maker, desc: t.pricing_maker_d, price: "$19", mo: true,
      f1: t.pricing_maker_f1, f2: t.pricing_maker_f2,
      cta: t.pricing_maker_cta, action: () => navigate("/signup?plan=maker"),
      tier: "maker" as const,
    },
    {
      name: t.pricing_pro, desc: t.pricing_pro_d, price: "$49", mo: true,
      f1: t.pricing_pro_f1, f2: t.pricing_pro_f2,
      cta: t.pricing_pro_cta, action: () => navigate("/signup?plan=pro"),
      tier: "pro" as const,
    },
    {
      name: t.pricing_studio, desc: t.pricing_studio_d, price: "$299", mo: true,
      f1: t.pricing_studio_f1, f2: t.pricing_studio_f2,
      cta: t.pricing_studio_cta, action: () => navigate("/signup?plan=studio"),
      tier: "studio" as const,
    },
  ];

  return (
    <section id="pricing" style={{
      background: BG, padding: "clamp(72px,9vw,100px) clamp(20px,4vw,40px)",
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{
            fontFamily: F, fontSize: "clamp(24px,2.8vw,34px)", fontWeight: 800,
            letterSpacing: "-0.04em", color: TEXT, margin: "0 0 10px",
          }}>
            {t.pricing_title}
          </h2>
          <p style={{
            fontFamily: F, fontSize: 14, color: TEXT3, margin: 0,
          }}>
            {t.pricing_sub}
          </p>
        </div>

        <div className="pricing-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: "clamp(10px, 1.5vw, 16px)", alignItems: "stretch",
        }}>
          {plans.map((plan) => {
            const isPro = plan.tier === "pro";
            return (
              <div key={plan.tier} className="pricing-card" style={{
                background: isPro ? "rgba(99,102,241,0.05)" : SURFACE,
                border: isPro
                  ? "1.5px solid rgba(99,102,241,0.30)"
                  : `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: "clamp(20px, 2.5vw, 28px) clamp(16px, 2vw, 22px)",
                display: "flex", flexDirection: "column",
                position: "relative",
                transition: `all 0.3s ${EASE}`,
                boxShadow: isPro ? "0 0 40px rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.2)" : "none",
              }}>
                {/* Badge — Pro only */}
                {isPro && t.pricing_pro_badge && (
                  <span style={{
                    fontFamily: F, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                    color: INDIGO, marginBottom: 14, display: "inline-block",
                    background: "rgba(99,102,241,0.10)", padding: "4px 10px", borderRadius: 5,
                    border: "1px solid rgba(99,102,241,0.18)", alignSelf: "flex-start",
                  }}>
                    {t.pricing_pro_badge}
                  </span>
                )}

                {/* Name */}
                <h3 style={{
                  fontFamily: F, fontSize: 16, fontWeight: 700,
                  color: isPro ? TEXT : "rgba(255,255,255,0.85)",
                  margin: "0 0 3px", letterSpacing: "-0.02em",
                }}>
                  {plan.name}
                </h3>

                {/* Description */}
                <p style={{
                  fontFamily: F, fontSize: 11.5, color: TEXT3, margin: "0 0 20px",
                  fontWeight: 400, lineHeight: 1.4,
                }}>
                  {plan.desc}
                </p>

                {/* Price */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{
                    fontFamily: F, fontSize: 32, fontWeight: 900,
                    color: isPro ? TEXT : "rgba(255,255,255,0.88)", letterSpacing: "-0.04em",
                  }}>
                    {plan.price}
                  </span>
                  {plan.mo && (
                    <span style={{ fontFamily: F, fontSize: 12, color: TEXT3, marginLeft: 2 }}>{t.pricing_mo}</span>
                  )}
                </div>

                {/* Features */}
                <div style={{ marginBottom: 24, flex: 1 }}>
                  <p style={{ fontFamily: F, fontSize: 12.5, color: TEXT2, margin: "0 0 4px", fontWeight: 500 }}>{plan.f1}</p>
                  <p style={{ fontFamily: F, fontSize: 11.5, color: TEXT3, margin: 0, fontWeight: 400 }}>{plan.f2}</p>
                </div>

                {/* CTA */}
                <button onClick={plan.action} className="pricing-cta-btn" style={{
                  width: "100%", fontFamily: F, fontSize: 13,
                  fontWeight: 700, padding: "11px 0", borderRadius: 8,
                  background: isPro ? INDIGO : "rgba(255,255,255,0.04)",
                  color: isPro ? "#fff" : TEXT2,
                  border: isPro ? "none" : `1px solid rgba(255,255,255,0.08)`,
                  cursor: "pointer", transition: `all 0.2s ${EASE}`,
                  boxShadow: isPro ? "0 2px 16px rgba(99,102,241,0.25)" : "none",
                  marginTop: "auto",
                }}>
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <a href="/pricing" className="pricing-details-link" style={{
            fontFamily: F, fontSize: 13, fontWeight: 500, color: TEXT3,
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
            transition: `color 0.2s ${EASE}`,
          }}>
            {t.pricing_details} <ArrowRight size={13} />
          </a>
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
    { title: t.footer_product, links: [{ label: t.footer_how, href: "/#flow" }, { label: t.footer_pricing, href: "/pricing" }] },
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
        <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.15)" }}>{t.footer_copy}</span>
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
      background: "rgba(7,13,26,0.92)",
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
      <LoopSection t={t} />
      <PricingSection t={t} />
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
        @keyframes mockFloat {
          0%, 100% { transform: perspective(1400px) rotateY(-2deg) rotateX(0.5deg) translateY(0); }
          50% { transform: perspective(1400px) rotateY(-2deg) rotateX(0.5deg) translateY(-4px); }
        }
        .hero-tag-fade { animation: fadeUp 0.6s ${EASE} 0.05s both; }
        .hero-sub-fade { animation: fadeUp 0.6s ${EASE} 0.15s both; }
        .hero-cta-fade { animation: fadeUp 0.6s ${EASE} 0.25s both; }
        .hero-detail-fade { animation: fadeUp 0.5s ${EASE} 0.35s both; }

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
            margin-top: 20px;
          }
          .product-mockup {
            max-width: 100% !important;
            transform: none !important;
            animation: none !important;
          }
          .concept-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .concept-grid h2 { text-align: center; }
          .flow-steps { padding-left: 0 !important; }
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
          .concept-grid { gap: 40px !important; }
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
          .hero-grid:hover .product-mockup {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.4), 0 50px 120px rgba(0,0,0,0.6) !important;
          }
          .pricing-cta-btn:hover { opacity: 0.85; transform: translateY(-0.5px); }
          .pricing-card:hover {
            border-color: rgba(255,255,255,0.12) !important;
            transform: translateY(-4px) !important;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3) !important;
          }
          .nav-signup-btn:hover { background: rgba(255,255,255,0.9) !important; transform: translateY(-1px); }
          .nav-login-btn:hover { color: ${TEXT} !important; }
          .footer-link:hover { color: ${TEXT2} !important; }
          .pricing-details-link:hover { color: ${ACCENT} !important; }
        }

        /* ── Global ──────────────────────────────────────────── */
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(14,165,233,0.25); }
        body, html { overflow-x: hidden; }
      `}</style>
    </div>
  );
}
