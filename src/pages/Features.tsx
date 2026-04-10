import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ArrowRight, Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, any>> = {
  en: {
    tagline: "Everything you need",
    title_line1: "The AI that saves your",
    title_line2: "ad budget.",
    subtitle: "Every tool AdBrief ships is designed to catch money being wasted before you spend it — or to maximize the return on what you do spend.",
    hero_cta: "Start saving budget — free",
    hero_sub: "3-day free trial · Cancel anytime · 60s to first insight",
    start_free: "Start free",

    feature_0_tag: "Core",
    feature_0_title: "Ad Analysis",
    feature_0_headline: "Know exactly why your ad is burning budget — in 60 seconds.",
    feature_0_desc: "Upload any video. AdBrief scores the hook, flags the weak point, and tells you what to fix before you spend another dollar. Average team saves $340/week catching bad hooks early.",
    feature_0_bullet_1: "Hook score 0–10 with breakdown",
    feature_0_bullet_2: "Identifies weak CTA, wrong pacing, format mismatch",
    feature_0_bullet_3: "Improvement suggestions ready to act on",
    feature_0_bullet_4: "Works with TikTok, Meta, YouTube, Reels",
    feature_0_cta: "Analyze your first ad free",

    feature_1_tag: "AI",
    feature_1_title: "Hook Generator",
    feature_1_headline: "Test 10 hook angles before committing a dollar to production.",
    feature_1_desc: "Stop producing ads with weak hooks. Generate 10 hook variations in 30 seconds, each with a predicted CTR score based on your account data.",
    feature_1_bullet_1: "10 hooks per generation with predicted CTR",
    feature_1_bullet_2: "Calibrated to your market and platform",
    feature_1_bullet_3: "Curiosity, social proof, pain, transformation angles",
    feature_1_bullet_4: "Rate hooks to train your AI",
    feature_1_cta: "Generate hooks free",

    feature_2_tag: "Production",
    feature_2_title: "Brief Generator",
    feature_2_headline: "Brief your editor in 30 seconds. Zero revision rounds.",
    feature_2_desc: "Turn any insight into a production-ready brief. Scene-by-scene breakdown, voiceover script, visual direction, editor notes. One doc, zero ambiguity.",
    feature_2_bullet_1: "Scene-by-scene breakdown with timing",
    feature_2_bullet_2: "Full voiceover script with tone notes",
    feature_2_bullet_3: "Visual direction per scene",
    feature_2_bullet_4: "Export to Notion, Google Docs, PDF",
    feature_2_cta: "Create a brief",

    feature_3_tag: "Intelligence",
    feature_3_title: "AdBrief AI",
    feature_3_headline: "Ask your AI what's wasting budget and what to produce next.",
    feature_3_desc: "AdBrief AI knows your account — your patterns, your winners, your fatigue signals. Ask it anything. It responds with data-backed actions, not generic tips.",
    feature_3_bullet_1: "Full account context in every response",
    feature_3_bullet_2: "Detects creative fatigue before CTR drops",
    feature_3_bullet_3: "Links directly to tools with pre-filled context",
    feature_3_bullet_4: "Knows Meta Andromeda 2026 rules",
    feature_3_cta: "Ask AdBrief AI",

    feature_4_tag: "Intelligence",
    feature_4_title: "Creative Performance Loop",
    feature_4_headline: "Import your Meta data. Let the AI find your winning patterns.",
    feature_4_desc: "Upload your Meta or TikTok CSV. AdBrief identifies which hook types, formats, and markets are winning in YOUR account — then calibrates every output to match.",
    feature_4_bullet_1: "Import Meta Ads Manager CSV",
    feature_4_bullet_2: "Identifies winning hook × format × market combos",
    feature_4_bullet_3: "Tracks performance by editor",
    feature_4_bullet_4: "Feeds every tool with your real data",
    feature_4_cta: "Start the loop",

    feature_5_tag: "Quality",
    feature_5_title: "Pre-flight Check",
    feature_5_headline: "Score any ad before it goes live. Catch problems before you spend.",
    feature_5_desc: "Run any creative through AdBrief before launching. Get a go/no-go score with specific issues flagged. Never launch a weak ad again.",
    feature_5_bullet_1: "Hook strength score",
    feature_5_bullet_2: "Platform fit check (9:16, length, format)",
    feature_5_bullet_3: "CTA effectiveness rating",
    feature_5_bullet_4: "Instant go/no-go recommendation",
    feature_5_cta: "Run a pre-flight",

    feature_6_tag: "Production",
    feature_6_title: "Script Generator",
    feature_6_headline: "Full ad scripts calibrated to what's working in your account.",
    feature_6_desc: "Generate complete 30–60s ad scripts using your proven hook types, pacing, and structure. Not generic templates — scripts shaped by your real performance data.",
    feature_6_bullet_1: "UGC, VSL, tutorial, problem-solution formats",
    feature_6_bullet_2: "Calibrated to your winning hook type",
    feature_6_bullet_3: "VO notes with tone and delivery guidance",
    feature_6_bullet_4: "Market and platform specific",
    feature_6_cta: "Generate a script",

    feature_7_tag: "Scale",
    feature_7_title: "Translation & Localization",
    feature_7_headline: "Take your winning creative to a new market. Not just translated — localized.",
    feature_7_desc: "AI adapts your scripts for cultural context, slang, and tone — not just language. The same performance, new market.",
    feature_7_bullet_1: "7 languages + market adaptation",
    feature_7_bullet_2: "Preserves tone and hook structure",
    feature_7_bullet_3: "Cultural slang and phrasing built in",
    feature_7_bullet_4: "Instant turnaround",
    feature_7_cta: "Translate a script",

    cta_title: "1 caught weak ad = plan pays for itself.",
    cta_sub: "Most users recover 10× the plan cost in the first week.",
    cta_button: "Try free for 3 days →",
  },
  pt: {
    tagline: "Tudo que você precisa",
    title_line1: "A IA que economiza seu",
    title_line2: "orçamento de anúncios.",
    subtitle: "Cada ferramenta que o AdBrief oferece foi projetada para capturar dinheiro sendo desperdiçado antes que você gaste — ou para maximizar o retorno do que você gasta.",
    hero_cta: "Comece a economizar orçamento — grátis",
    hero_sub: "Teste gratuito de 3 dias · Cancele quando quiser · 60s para primeiro resultado",
    start_free: "Começar grátis",

    feature_0_tag: "Núcleo",
    feature_0_title: "Análise de Anúncios",
    feature_0_headline: "Saiba exatamente por que seu anúncio está queimando orçamento — em 60 segundos.",
    feature_0_desc: "Envie qualquer vídeo. AdBrief pontua o hook, marca o ponto fraco e diz o que corrigir antes de gastar mais um centavo. Time médio economiza $340/semana pegando hooks fracos cedo.",
    feature_0_bullet_1: "Pontuação de hook 0-10 com detalhamento",
    feature_0_bullet_2: "Identifica CTA fraco, ritmo errado, incompatibilidade de formato",
    feature_0_bullet_3: "Sugestões de melhoria prontas para agir",
    feature_0_bullet_4: "Funciona com TikTok, Meta, YouTube, Reels",
    feature_0_cta: "Analise seu primeiro anúncio grátis",

    feature_1_tag: "IA",
    feature_1_title: "Gerador de Hooks",
    feature_1_headline: "Teste 10 ângulos de hook antes de gastar um centavo em produção.",
    feature_1_desc: "Pare de produzir anúncios com hooks fracos. Gere 10 variações de hook em 30 segundos, cada uma com uma pontuação de CTR prevista com base nos dados da sua conta.",
    feature_1_bullet_1: "10 hooks por geração com CTR previsto",
    feature_1_bullet_2: "Calibrado para seu mercado e plataforma",
    feature_1_bullet_3: "Ângulos de curiosidade, prova social, dor, transformação",
    feature_1_bullet_4: "Avalie hooks para treinar sua IA",
    feature_1_cta: "Gere hooks grátis",

    feature_2_tag: "Produção",
    feature_2_title: "Gerador de Briefs",
    feature_2_headline: "Briefar seu editor em 30 segundos. Zero rodadas de revisão.",
    feature_2_desc: "Transforme qualquer insight em um brief pronto para produção. Detalhamento cena a cena, script de voz, direção visual, notas do editor. Um doc, zero ambiguidade.",
    feature_2_bullet_1: "Detalhamento cena a cena com timing",
    feature_2_bullet_2: "Script de voz completo com notas de tom",
    feature_2_bullet_3: "Direção visual por cena",
    feature_2_bullet_4: "Exportar para Notion, Google Docs, PDF",
    feature_2_cta: "Crie um brief",

    feature_3_tag: "Inteligência",
    feature_3_title: "AdBrief IA",
    feature_3_headline: "Pergunte à sua IA o que está desperdiçando orçamento e o que produzir em seguida.",
    feature_3_desc: "AdBrief IA conhece sua conta — seus padrões, seus vencedores, seus sinais de fadiga. Pergunte qualquer coisa. Ela responde com ações apoiadas em dados, não dicas genéricas.",
    feature_3_bullet_1: "Contexto completo da conta em cada resposta",
    feature_3_bullet_2: "Detecta fadiga criativa antes que o CTR caia",
    feature_3_bullet_3: "Vincula diretamente a ferramentas com contexto pré-preenchido",
    feature_3_bullet_4: "Conhece as regras Meta Andromeda 2026",
    feature_3_cta: "Pergunte ao AdBrief IA",

    feature_4_tag: "Inteligência",
    feature_4_title: "Loop de Performance Criativa",
    feature_4_headline: "Importe seus dados Meta. Deixe a IA encontrar seus padrões vencedores.",
    feature_4_desc: "Envie seu CSV Meta ou TikTok. AdBrief identifica quais combos de tipo de hook × formato × mercado estão vencendo em SUA conta — depois calibra cada saída para corresponder.",
    feature_4_bullet_1: "Importe CSV do Meta Ads Manager",
    feature_4_bullet_2: "Identifica combos vencedores de hook × formato × mercado",
    feature_4_bullet_3: "Rastreia performance por editor",
    feature_4_bullet_4: "Alimenta cada ferramenta com seus dados reais",
    feature_4_cta: "Inicie o loop",

    feature_5_tag: "Qualidade",
    feature_5_title: "Verificação Pré-voo",
    feature_5_headline: "Pontue qualquer anúncio antes de ele ficar ao vivo. Pegue problemas antes de gastar.",
    feature_5_desc: "Execute qualquer criativo através do AdBrief antes de lançar. Obtenha uma pontuação go/no-go com problemas específicos sinalizados. Nunca lance um anúncio fraco novamente.",
    feature_5_bullet_1: "Pontuação de força do hook",
    feature_5_bullet_2: "Verificação de compatibilidade de plataforma (9:16, duração, formato)",
    feature_5_bullet_3: "Classificação de eficácia do CTA",
    feature_5_bullet_4: "Recomendação go/no-go instantânea",
    feature_5_cta: "Execute uma verificação pré-voo",

    feature_6_tag: "Produção",
    feature_6_title: "Gerador de Scripts",
    feature_6_headline: "Scripts de anúncio completos calibrados para o que está funcionando em sua conta.",
    feature_6_desc: "Gere scripts de anúncio completos de 30-60s usando seus tipos de hook comprovados, ritmo e estrutura. Não templates genéricos — scripts moldados por seus dados de performance reais.",
    feature_6_bullet_1: "Formatos UGC, VSL, tutorial, solução de problemas",
    feature_6_bullet_2: "Calibrado para seu tipo de hook vencedor",
    feature_6_bullet_3: "Notas de VO com tom e orientação de entrega",
    feature_6_bullet_4: "Específico do mercado e plataforma",
    feature_6_cta: "Gere um script",

    feature_7_tag: "Escala",
    feature_7_title: "Tradução & Localização",
    feature_7_headline: "Leve seu criativo vencedor para um novo mercado. Não apenas traduzido — localizado.",
    feature_7_desc: "A IA adapta seus scripts para contexto cultural, gíria e tom — não apenas idioma. O mesmo desempenho, novo mercado.",
    feature_7_bullet_1: "7 idiomas + adaptação de mercado",
    feature_7_bullet_2: "Preserva tom e estrutura do hook",
    feature_7_bullet_3: "Gíria cultural e fraseado integrados",
    feature_7_bullet_4: "Retorno instantâneo",
    feature_7_cta: "Traduza um script",

    cta_title: "1 anúncio fraco capturado = plano se paga.",
    cta_sub: "A maioria dos usuários recupera 10× o custo do plano na primeira semana.",
    cta_button: "Experimente gratuitamente por 3 dias →",
  },
  es: {
    tagline: "Todo lo que necesitas",
    title_line1: "La IA que ahorra tu",
    title_line2: "presupuesto de anuncios.",
    subtitle: "Cada herramienta que ofrece AdBrief está diseñada para capturar dinero siendo desperdiciado antes de que lo gastes — o para maximizar el retorno de lo que sí gastes.",
    hero_cta: "Comienza a ahorrar presupuesto — gratis",
    hero_sub: "Prueba gratuita de 3 días · Cancela en cualquier momento · 60s para el primer resultado",
    start_free: "Comenzar gratis",

    feature_0_tag: "Núcleo",
    feature_0_title: "Análisis de Anuncios",
    feature_0_headline: "Sabe exactamente por qué tu anuncio está quemando presupuesto — en 60 segundos.",
    feature_0_desc: "Carga cualquier video. AdBrief puntúa el hook, marca el punto débil y te dice qué arreglar antes de gastar otro dólar. El equipo promedio ahorra $340/semana detectando hooks débiles temprano.",
    feature_0_bullet_1: "Puntuación de hook 0-10 con desglose",
    feature_0_bullet_2: "Identifica CTA débil, ritmo incorrecto, incompatibilidad de formato",
    feature_0_bullet_3: "Sugerencias de mejora listas para actuar",
    feature_0_bullet_4: "Funciona con TikTok, Meta, YouTube, Reels",
    feature_0_cta: "Analiza tu primer anuncio gratis",

    feature_1_tag: "IA",
    feature_1_title: "Generador de Hooks",
    feature_1_headline: "Prueba 10 ángulos de hook antes de comprometer un dólar en producción.",
    feature_1_desc: "Deja de producir anuncios con hooks débiles. Genera 10 variaciones de hook en 30 segundos, cada una con una puntuación CTR predicha basada en los datos de tu cuenta.",
    feature_1_bullet_1: "10 hooks por generación con CTR predicho",
    feature_1_bullet_2: "Calibrado para tu mercado y plataforma",
    feature_1_bullet_3: "Ángulos de curiosidad, prueba social, dolor, transformación",
    feature_1_bullet_4: "Califica los hooks para entrenar tu IA",
    feature_1_cta: "Genera hooks gratis",

    feature_2_tag: "Producción",
    feature_2_title: "Generador de Briefs",
    feature_2_headline: "Briefea a tu editor en 30 segundos. Cero rondas de revisión.",
    feature_2_desc: "Convierte cualquier insight en un brief listo para producción. Desglose escena por escena, guión de voz, dirección visual, notas del editor. Un documento, cero ambigüedad.",
    feature_2_bullet_1: "Desglose escena por escena con tiempo",
    feature_2_bullet_2: "Guión de voz completo con notas de tono",
    feature_2_bullet_3: "Dirección visual por escena",
    feature_2_bullet_4: "Exportar a Notion, Google Docs, PDF",
    feature_2_cta: "Crea un brief",

    feature_3_tag: "Inteligencia",
    feature_3_title: "AdBrief IA",
    feature_3_headline: "Pregúntale a tu IA qué está desperdiciando presupuesto y qué producir después.",
    feature_3_desc: "AdBrief IA conoce tu cuenta — tus patrones, tus ganadores, tus señales de fatiga. Pregúntale cualquier cosa. Responde con acciones respaldadas por datos, no consejos genéricos.",
    feature_3_bullet_1: "Contexto completo de la cuenta en cada respuesta",
    feature_3_bullet_2: "Detecta fatiga creativa antes de que caiga el CTR",
    feature_3_bullet_3: "Vincula directamente a herramientas con contexto precompletado",
    feature_3_bullet_4: "Conoce las reglas Meta Andromeda 2026",
    feature_3_cta: "Pregunta al AdBrief IA",

    feature_4_tag: "Inteligencia",
    feature_4_title: "Loop de Desempeño Creativo",
    feature_4_headline: "Importa tus datos de Meta. Deja que la IA encuentre tus patrones ganadores.",
    feature_4_desc: "Carga tu CSV de Meta o TikTok. AdBrief identifica qué combos de tipo de hook × formato × mercado están ganando en TU cuenta — luego calibra cada salida para que coincida.",
    feature_4_bullet_1: "Importa CSV de Meta Ads Manager",
    feature_4_bullet_2: "Identifica combos ganadores de hook × formato × mercado",
    feature_4_bullet_3: "Rastrea el rendimiento por editor",
    feature_4_bullet_4: "Alimenta cada herramienta con tus datos reales",
    feature_4_cta: "Inicia el loop",

    feature_5_tag: "Calidad",
    feature_5_title: "Verificación Previa al Vuelo",
    feature_5_headline: "Puntúa cualquier anuncio antes de que se publique. Detecta problemas antes de que gastes.",
    feature_5_desc: "Ejecuta cualquier creativo a través de AdBrief antes de lanzar. Obtén una puntuación go/no-go con problemas específicos marcados. Nunca lances un anuncio débil de nuevo.",
    feature_5_bullet_1: "Puntuación de fortaleza del hook",
    feature_5_bullet_2: "Verificación de compatibilidad de plataforma (9:16, duración, formato)",
    feature_5_bullet_3: "Clasificación de efectividad del CTA",
    feature_5_bullet_4: "Recomendación go/no-go instantánea",
    feature_5_cta: "Ejecuta una verificación previa al vuelo",

    feature_6_tag: "Producción",
    feature_6_title: "Generador de Scripts",
    feature_6_headline: "Scripts de anuncio completos calibrados para lo que funciona en tu cuenta.",
    feature_6_desc: "Genera scripts de anuncio completos de 30-60s usando tus tipos de hook probados, ritmo y estructura. No plantillas genéricas — scripts moldeados por tus datos de desempeño reales.",
    feature_6_bullet_1: "Formatos UGC, VSL, tutorial, solución de problemas",
    feature_6_bullet_2: "Calibrado para tu tipo de hook ganador",
    feature_6_bullet_3: "Notas de VO con tono y orientación de entrega",
    feature_6_bullet_4: "Específico del mercado y plataforma",
    feature_6_cta: "Genera un script",

    feature_7_tag: "Escala",
    feature_7_title: "Traducción y Localización",
    feature_7_headline: "Lleva tu creativo ganador a un nuevo mercado. No solo traducido — localizado.",
    feature_7_desc: "La IA adapta tus scripts para contexto cultural, jerga y tono — no solo idioma. El mismo desempeño, nuevo mercado.",
    feature_7_bullet_1: "7 idiomas + adaptación de mercado",
    feature_7_bullet_2: "Preserva tono y estructura del hook",
    feature_7_bullet_3: "Jerga cultural y frases integradas",
    feature_7_bullet_4: "Retorno instantáneo",
    feature_7_cta: "Traduce un script",

    cta_title: "1 anuncio débil detectado = el plan se paga solo.",
    cta_sub: "La mayoría de los usuarios recuperan 10× el costo del plan en la primera semana.",
    cta_button: "Prueba gratis durante 3 días →",
  },
};

const buildFeatures = (t: Record<string, any>) => [
  {
    icon: "", accent: "#0ea5e9",
    tag: t.feature_0_tag,
    title: t.feature_0_title,
    headline: t.feature_0_headline,
    desc: t.feature_0_desc,
    bullets: [t.feature_0_bullet_1, t.feature_0_bullet_2, t.feature_0_bullet_3, t.feature_0_bullet_4],
    url: "/dashboard/analyses/new",
    cta: t.feature_0_cta,
  },
  {
    icon: "", accent: "#fb923c",
    tag: t.feature_1_tag,
    title: t.feature_1_title,
    headline: t.feature_1_headline,
    desc: t.feature_1_desc,
    bullets: [t.feature_1_bullet_1, t.feature_1_bullet_2, t.feature_1_bullet_3, t.feature_1_bullet_4],
    url: "/dashboard/hooks",
    cta: t.feature_1_cta,
  },
  {
    icon: "", accent: "#60a5fa",
    tag: t.feature_2_tag,
    title: t.feature_2_title,
    headline: t.feature_2_headline,
    desc: t.feature_2_desc,
    bullets: [t.feature_2_bullet_1, t.feature_2_bullet_2, t.feature_2_bullet_3, t.feature_2_bullet_4],
    url: "/dashboard/brief",
    cta: t.feature_2_cta,
  },
  {
    icon: "", accent: "#34d399",
    tag: t.feature_3_tag,
    title: t.feature_3_title,
    headline: t.feature_3_headline,
    desc: t.feature_3_desc,
    bullets: [t.feature_3_bullet_1, t.feature_3_bullet_2, t.feature_3_bullet_3, t.feature_3_bullet_4],
    url: "/dashboard/ai",
    cta: t.feature_3_cta,
  },
  {
    icon: "", accent: "#a78bfa",
    tag: t.feature_4_tag,
    title: t.feature_4_title,
    headline: t.feature_4_headline,
    desc: t.feature_4_desc,
    bullets: [t.feature_4_bullet_1, t.feature_4_bullet_2, t.feature_4_bullet_3, t.feature_4_bullet_4],
    url: "/dashboard/ai",
    cta: t.feature_4_cta,
  },
  {
    icon: "", accent: "#fbbf24",
    tag: t.feature_5_tag,
    title: t.feature_5_title,
    headline: t.feature_5_headline,
    desc: t.feature_5_desc,
    bullets: [t.feature_5_bullet_1, t.feature_5_bullet_2, t.feature_5_bullet_3, t.feature_5_bullet_4],
    url: "/dashboard/preflight",
    cta: t.feature_5_cta,
  },
  {
    icon: "", accent: "#0ea5e9",
    tag: t.feature_6_tag,
    title: t.feature_6_title,
    headline: t.feature_6_headline,
    desc: t.feature_6_desc,
    bullets: [t.feature_6_bullet_1, t.feature_6_bullet_2, t.feature_6_bullet_3, t.feature_6_bullet_4],
    url: "/dashboard/script",
    cta: t.feature_6_cta,
  },
  {
    icon: "", accent: "#34d399",
    tag: t.feature_7_tag,
    title: t.feature_7_title,
    headline: t.feature_7_headline,
    desc: t.feature_7_desc,
    bullets: [t.feature_7_bullet_1, t.feature_7_bullet_2, t.feature_7_bullet_3, t.feature_7_bullet_4],
    url: "/dashboard/translate",
    cta: t.feature_7_cta,
  },
];

export default function Features() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];
  const FEATURES = buildFeatures(t);

  return (
    <div style={{ minHeight: "100vh", background: "#060608", color: "#fff", ...j }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,6,8,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer" }}><Logo size="md" /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher />
            <button onClick={() => navigate("/signup")} style={{ padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
              {t.start_free}
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(14,165,233,0.7)", marginBottom: 16 }}>{t.tagline}</p>
          <h1 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 16 }}>
            {t.title_line1}<br />
            <span style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t.title_line2}
            </span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.65 }}>
            {t.subtitle}
          </p>
          <button onClick={() => navigate("/signup")}
            style={{ padding: "13px 28px", borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t.hero_cta} <ArrowRight size={16} />
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>{t.hero_sub}</p>
        </div>

        {/* Features grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ borderRadius: 20, overflow: "hidden", background: "#0d0d15", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${f.accent}12`, border: `1px solid ${f.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {f.icon}
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: f.accent, padding: "2px 8px", borderRadius: 20, background: `${f.accent}12`, border: `1px solid ${f.accent}20` }}>{f.tag}</span>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 4 }}>{f.title}</p>
                  </div>
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)", lineHeight: 1.45, marginBottom: 8 }}>{f.headline}</h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
              {/* Bullets */}
              <div style={{ padding: "16px 24px", flex: 1 }}>
                {f.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Check size={13} style={{ color: f.accent, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{b}</span>
                  </div>
                ))}
              </div>
              {/* CTA */}
              <div style={{ padding: "0 24px 20px" }}>
                <button onClick={() => navigate(f.url)}
                  style={{ width: "100%", padding: "10px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: `${f.accent}15`, color: f.accent, border: `1px solid ${f.accent}30`, cursor: "pointer", textAlign: "center" as const }}>
                  {f.cta} →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: 72, textAlign: "center", padding: "48px 32px", borderRadius: 24, background: "linear-gradient(135deg,rgba(14,165,233,0.1),rgba(6,182,212,0.06))", border: "1px solid rgba(14,165,233,0.2)" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>
            {t.cta_title}
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>{t.cta_sub}</p>
          <button onClick={() => navigate("/signup")}
            style={{ padding: "13px 28px", borderRadius: 14, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
            {t.cta_button}
          </button>
        </div>
      </div>
    </div>
  );
}
