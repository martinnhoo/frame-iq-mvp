import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Languages,
  Layers3,
  Megaphone,
  Play,
  Rocket,
  Sparkles,
  Target,
  Video,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import HomeBrandSelector from "@/components/hub/HomeBrandSelector";

type Lang = "pt" | "en" | "es" | "zh";

type ObjectiveId =
  | "static"
  | "video"
  | "campaign"
  | "carousel"
  | "adapt"
  | "social";

type ChannelId =
  | "meta"
  | "instagram"
  | "tiktok"
  | "linkedin";

type OutputLanguageId =
  | "pt"
  | "en"
  | "es";

type StepKey =
  | "brand"
  | "offer"
  | "persona"
  | "concept"
  | "copy"
  | "script"
  | "images"
  | "video"
  | "carousel"
  | "variations"
  | "channels"
  | "schedule";

interface Objective {
  id: ObjectiveId;
  label: string;
  description: string;
  example: string;
  icon: LucideIcon;
}

interface Template {
  id: string;
  title: string;
  description: string;
  objective: ObjectiveId;
  prompt: string;
  icon: LucideIcon;
}

interface WorkflowSeed {
  brief: string;
  objective: ObjectiveId;
  channel: ChannelId;
  outputLanguage: OutputLanguageId;
  createdAt: string;
}

const COPY = {
  pt: {
    pageTitle: "Início — AdBrief",
    title: "O que vamos criar hoje",
    subtitle:
      "Comece pelo resultado. O AdBrief organiza as etapas e conecta as ferramentas necessárias.",

    library: "Biblioteca",
    assetEmpty: "Nenhum criativo",
    assetSingle: "1 criativo",
    assetPlural: "{n} criativos",

    composerEyebrow: "Comece pelo objetivo",
    composerTitle:
      "Descreva o que você precisa criar",
    composerSubtitle:
      "Pode escrever como falaria com um estrategista. O workflow será montado automaticamente.",
    placeholder:
      "Exemplo: Tenho um restaurante nordestino e quero anunciar um novo cardápio de almoço no Instagram.",
    channel: "Canal",
    language: "Idioma",
    buildWorkflow: "Montar meu workflow",
    briefRequired:
      "Descreva primeiro o que você precisa criar.",
    ctrlEnter: "Ctrl + Enter para montar",

    quickStarts: "Atalhos por resultado",
    workflowTitle: "Workflow sugerido",
    workflowSubtitle:
      "As etapas são organizadas de acordo com seu objetivo.",
    steps: "etapas",
    automatic: "Automático",
    editable: "Editável",
    briefLabel: "Objetivo atual",
    noBrief:
      "Descreva seu objetivo acima para personalizar este workflow.",
    openWorkflow: "Abrir no editor",
    executeWorkflow: "Executar workflow",

    continueTitle: "Continuar trabalhando",
    continueSubtitle:
      "Acesse rapidamente as áreas mais importantes do seu processo.",

    workflowCardTitle: "Seus workflows",
    workflowCardDescription:
      "Continue uma automação ou crie um novo processo.",

    imageCardTitle: "Criar uma imagem",
    imageCardDescription:
      "Abra o gerador e produza um criativo individual.",

    libraryCardTitle: "Seus criativos",
    libraryCardDescription:
      "Organize e encontre tudo o que já foi produzido.",

    open: "Abrir",

    templatesTitle: "Workflows recomendados",
    templatesSubtitle:
      "Estruturas prontas para começar sem montar tudo do zero.",
    useTemplate: "Usar workflow",

    recentTitle: "Seus últimos criativos",
    recentSubtitle:
      "Tudo o que você produz fica centralizado na Biblioteca.",
    recentEmptyTitle:
      "Sua Biblioteca ainda está vazia",
    recentEmptyDescription:
      "Crie o primeiro ativo e ele aparecerá automaticamente aqui.",
    createFirst: "Criar primeiro ativo",
    openLibrary: "Abrir Biblioteca",
    storedAssets:
      "Você já possui {n} criativos armazenados no AdBrief.",

    objectiveStatic: "Anúncio estático",
    objectiveStaticDescription:
      "Conceito, copy, imagem e variações.",
    objectiveStaticExample:
      "Quero criar um anúncio estático para apresentar minha oferta no Meta Ads.",

    objectiveVideo: "Vídeo",
    objectiveVideoDescription:
      "Roteiro, cenas, imagens e produção.",
    objectiveVideoExample:
      "Quero criar um vídeo curto para anunciar meu produto no Instagram e TikTok.",

    objectiveCampaign: "Campanha completa",
    objectiveCampaignDescription:
      "Estratégia, peças e variações de campanha.",
    objectiveCampaignExample:
      "Quero criar uma campanha completa para lançar uma nova oferta no Meta Ads.",

    objectiveCarousel: "Carrossel",
    objectiveCarouselDescription:
      "Narrativa, slides, copy e CTA.",
    objectiveCarouselExample:
      "Quero transformar minha oferta em um carrossel educativo para Instagram.",

    objectiveAdapt: "Adaptar criativo",
    objectiveAdaptDescription:
      "Novos formatos, ângulos e mercados.",
    objectiveAdaptExample:
      "Quero adaptar um criativo existente para outro público, formato e canal.",

    objectiveSocial: "Conteúdo para redes",
    objectiveSocialDescription:
      "Ideias, calendário, peças e legendas.",
    objectiveSocialExample:
      "Quero criar uma sequência de conteúdos para uma semana de Instagram.",

    templateLaunchTitle: "Lançamento de produto",
    templateLaunchDescription:
      "Posicionamento, conceito, peças principais e variações.",
    templateLaunchPrompt:
      "Quero lançar um novo produto e preciso de uma campanha completa com conceitos, anúncios e variações.",

    templateMetaTitle: "Campanha Meta Ads",
    templateMetaDescription:
      "Oferta, persona, ângulos, copy e criativos para teste.",
    templateMetaPrompt:
      "Quero criar uma campanha de performance para Meta Ads com diferentes ângulos e variações.",

    templateWeeklyTitle: "Conteúdo semanal",
    templateWeeklyDescription:
      "Planejamento, ideias, formatos, peças e legendas.",
    templateWeeklyPrompt:
      "Quero planejar e produzir uma semana completa de conteúdo para redes sociais.",

    channelMeta: "Meta Ads",
    channelInstagram: "Instagram",
    channelTikTok: "TikTok",
    channelLinkedIn: "LinkedIn",

    languagePt: "Português",
    languageEn: "Inglês",
    languageEs: "Espanhol",

    stepsMap: {
      brand: "Carregar marca",
      offer: "Entender oferta",
      persona: "Definir persona",
      concept: "Criar conceito",
      copy: "Escrever copy",
      script: "Criar roteiro",
      images: "Produzir imagens",
      video: "Gerar vídeo",
      carousel: "Montar carrossel",
      variations: "Criar variações",
      channels: "Adaptar canais",
      schedule: "Organizar calendário",
    } satisfies Record<StepKey, string>,
  },

  en: {
    pageTitle: "Home — AdBrief",
    title: "What are we creating today",
    subtitle:
      "Start with the outcome. AdBrief organizes the steps and connects the tools you need.",

    library: "Library",
    assetEmpty: "No creatives",
    assetSingle: "1 creative",
    assetPlural: "{n} creatives",

    composerEyebrow: "Start with the goal",
    composerTitle:
      "Describe what you need to create",
    composerSubtitle:
      "Write as if you were talking to a strategist. The workflow will be assembled automatically.",
    placeholder:
      "Example: I have a restaurant and want to advertise a new lunch menu on Instagram.",
    channel: "Channel",
    language: "Language",
    buildWorkflow: "Build my workflow",
    briefRequired:
      "Describe what you need to create first.",
    ctrlEnter: "Ctrl + Enter to build",

    quickStarts: "Quick starts",
    workflowTitle: "Suggested workflow",
    workflowSubtitle:
      "The stages are organized according to your goal.",
    steps: "steps",
    automatic: "Automatic",
    editable: "Editable",
    briefLabel: "Current goal",
    noBrief:
      "Describe your goal above to personalize this workflow.",
    openWorkflow: "Open editor",
    executeWorkflow: "Run workflow",

    continueTitle: "Continue working",
    continueSubtitle:
      "Quickly access the most important parts of your process.",

    workflowCardTitle: "Your workflows",
    workflowCardDescription:
      "Continue an automation or create a new process.",

    imageCardTitle: "Create an image",
    imageCardDescription:
      "Open the generator and produce a single creative.",

    libraryCardTitle: "Your creatives",
    libraryCardDescription:
      "Organize and find everything you have produced.",

    open: "Open",

    templatesTitle: "Recommended workflows",
    templatesSubtitle:
      "Ready-made structures so you do not need to start from scratch.",
    useTemplate: "Use workflow",

    recentTitle: "Your latest creatives",
    recentSubtitle:
      "Everything you produce is centralized in the Library.",
    recentEmptyTitle:
      "Your Library is still empty",
    recentEmptyDescription:
      "Create your first asset and it will automatically appear here.",
    createFirst: "Create first asset",
    openLibrary: "Open Library",
    storedAssets:
      "You already have {n} creatives stored in AdBrief.",

    objectiveStatic: "Static ad",
    objectiveStaticDescription:
      "Concept, copy, image and variations.",
    objectiveStaticExample:
      "I want to create a static ad to present my offer on Meta Ads.",

    objectiveVideo: "Video",
    objectiveVideoDescription:
      "Script, scenes, images and production.",
    objectiveVideoExample:
      "I want to create a short video to advertise my product on Instagram and TikTok.",

    objectiveCampaign: "Full campaign",
    objectiveCampaignDescription:
      "Strategy, assets and campaign variations.",
    objectiveCampaignExample:
      "I want to create a complete campaign to launch a new offer on Meta Ads.",

    objectiveCarousel: "Carousel",
    objectiveCarouselDescription:
      "Narrative, slides, copy and CTA.",
    objectiveCarouselExample:
      "I want to turn my offer into an educational Instagram carousel.",

    objectiveAdapt: "Adapt creative",
    objectiveAdaptDescription:
      "New formats, angles and markets.",
    objectiveAdaptExample:
      "I want to adapt an existing creative for another audience, format and channel.",

    objectiveSocial: "Social content",
    objectiveSocialDescription:
      "Ideas, calendar, assets and captions.",
    objectiveSocialExample:
      "I want to create a week of content for Instagram.",

    templateLaunchTitle: "Product launch",
    templateLaunchDescription:
      "Positioning, concept, core assets and variations.",
    templateLaunchPrompt:
      "I want to launch a new product and need a complete campaign with concepts, ads and variations.",

    templateMetaTitle: "Meta Ads campaign",
    templateMetaDescription:
      "Offer, persona, angles, copy and test creatives.",
    templateMetaPrompt:
      "I want to create a performance campaign for Meta Ads with different angles and variations.",

    templateWeeklyTitle: "Weekly content",
    templateWeeklyDescription:
      "Planning, ideas, formats, assets and captions.",
    templateWeeklyPrompt:
      "I want to plan and produce a full week of social media content.",

    channelMeta: "Meta Ads",
    channelInstagram: "Instagram",
    channelTikTok: "TikTok",
    channelLinkedIn: "LinkedIn",

    languagePt: "Portuguese",
    languageEn: "English",
    languageEs: "Spanish",

    stepsMap: {
      brand: "Load brand",
      offer: "Understand offer",
      persona: "Define persona",
      concept: "Create concept",
      copy: "Write copy",
      script: "Create script",
      images: "Produce images",
      video: "Generate video",
      carousel: "Build carousel",
      variations: "Create variations",
      channels: "Adapt channels",
      schedule: "Organize calendar",
    } satisfies Record<StepKey, string>,
  },

  es: {
    pageTitle: "Inicio — AdBrief",
    title: "¿Qué vamos a crear hoy",
    subtitle:
      "Empieza por el resultado. AdBrief organiza las etapas y conecta las herramientas necesarias.",

    library: "Biblioteca",
    assetEmpty: "Sin creativos",
    assetSingle: "1 creativo",
    assetPlural: "{n} creativos",

    composerEyebrow: "Empieza por el objetivo",
    composerTitle:
      "Describe lo que necesitas crear",
    composerSubtitle:
      "Escribe como si hablaras con un estratega. El workflow se montará automáticamente.",
    placeholder:
      "Ejemplo: Tengo un restaurante y quiero anunciar un nuevo menú en Instagram.",
    channel: "Canal",
    language: "Idioma",
    buildWorkflow: "Montar mi workflow",
    briefRequired:
      "Primero describe lo que necesitas crear.",
    ctrlEnter: "Ctrl + Enter para montar",

    quickStarts: "Atajos por resultado",
    workflowTitle: "Workflow sugerido",
    workflowSubtitle:
      "Las etapas se organizan según tu objetivo.",
    steps: "etapas",
    automatic: "Automático",
    editable: "Editable",
    briefLabel: "Objetivo actual",
    noBrief:
      "Describe tu objetivo arriba para personalizar este workflow.",
    openWorkflow: "Abrir editor",
    executeWorkflow: "Ejecutar workflow",

    continueTitle: "Continuar trabajando",
    continueSubtitle:
      "Accede rápidamente a las áreas más importantes de tu proceso.",

    workflowCardTitle: "Tus workflows",
    workflowCardDescription:
      "Continúa una automatización o crea un nuevo proceso.",

    imageCardTitle: "Crear una imagen",
    imageCardDescription:
      "Abre el generador y produce un creativo individual.",

    libraryCardTitle: "Tus creativos",
    libraryCardDescription:
      "Organiza y encuentra todo lo que ya has producido.",

    open: "Abrir",

    templatesTitle: "Workflows recomendados",
    templatesSubtitle:
      "Estructuras listas para empezar sin crear todo desde cero.",
    useTemplate: "Usar workflow",

    recentTitle: "Tus últimos creativos",
    recentSubtitle:
      "Todo lo que produces queda centralizado en la Biblioteca.",
    recentEmptyTitle:
      "Tu Biblioteca todavía está vacía",
    recentEmptyDescription:
      "Crea el primer activo y aparecerá automáticamente aquí.",
    createFirst: "Crear primer activo",
    openLibrary: "Abrir Biblioteca",
    storedAssets:
      "Ya tienes {n} creativos almacenados en AdBrief.",

    objectiveStatic: "Anuncio estático",
    objectiveStaticDescription:
      "Concepto, copy, imagen y variaciones.",
    objectiveStaticExample:
      "Quiero crear un anuncio estático para presentar mi oferta en Meta Ads.",

    objectiveVideo: "Video",
    objectiveVideoDescription:
      "Guion, escenas, imágenes y producción.",
    objectiveVideoExample:
      "Quiero crear un video corto para anunciar mi producto en Instagram y TikTok.",

    objectiveCampaign: "Campaña completa",
    objectiveCampaignDescription:
      "Estrategia, piezas y variaciones de campaña.",
    objectiveCampaignExample:
      "Quiero crear una campaña completa para lanzar una nueva oferta en Meta Ads.",

    objectiveCarousel: "Carrusel",
    objectiveCarouselDescription:
      "Narrativa, slides, copy y CTA.",
    objectiveCarouselExample:
      "Quiero transformar mi oferta en un carrusel educativo para Instagram.",

    objectiveAdapt: "Adaptar creativo",
    objectiveAdaptDescription:
      "Nuevos formatos, ángulos y mercados.",
    objectiveAdaptExample:
      "Quiero adaptar un creativo existente para otro público, formato y canal.",

    objectiveSocial: "Contenido para redes",
    objectiveSocialDescription:
      "Ideas, calendario, piezas y captions.",
    objectiveSocialExample:
      "Quiero crear una semana completa de contenido para Instagram.",

    templateLaunchTitle: "Lanzamiento de producto",
    templateLaunchDescription:
      "Posicionamiento, concepto, piezas principales y variaciones.",
    templateLaunchPrompt:
      "Quiero lanzar un nuevo producto y necesito una campaña completa con conceptos, anuncios y variaciones.",

    templateMetaTitle: "Campaña Meta Ads",
    templateMetaDescription:
      "Oferta, persona, ángulos, copy y creativos de prueba.",
    templateMetaPrompt:
      "Quiero crear una campaña de performance para Meta Ads con diferentes ángulos y variaciones.",

    templateWeeklyTitle: "Contenido semanal",
    templateWeeklyDescription:
      "Planificación, ideas, formatos, piezas y captions.",
    templateWeeklyPrompt:
      "Quiero planificar y producir una semana completa de contenido para redes sociales.",

    channelMeta: "Meta Ads",
    channelInstagram: "Instagram",
    channelTikTok: "TikTok",
    channelLinkedIn: "LinkedIn",

    languagePt: "Portugués",
    languageEn: "Inglés",
    languageEs: "Español",

    stepsMap: {
      brand: "Cargar marca",
      offer: "Entender oferta",
      persona: "Definir persona",
      concept: "Crear concepto",
      copy: "Escribir copy",
      script: "Crear guion",
      images: "Producir imágenes",
      video: "Generar video",
      carousel: "Montar carrusel",
      variations: "Crear variaciones",
      channels: "Adaptar canales",
      schedule: "Organizar calendario",
    } satisfies Record<StepKey, string>,
  },

  zh: {
    pageTitle: "首页 — AdBrief",
    title: "今天要创建什么",
    subtitle:
      "从结果开始。AdBrief 会组织步骤并连接所需工具。",

    library: "资源库",
    assetEmpty: "暂无创意",
    assetSingle: "1 个创意",
    assetPlural: "{n} 个创意",

    composerEyebrow: "从目标开始",
    composerTitle: "描述您需要创建的内容",
    composerSubtitle:
      "像与策略师交流一样描述。工作流将自动构建。",
    placeholder:
      "示例：我经营一家餐厅，想在 Instagram 上推广新的午餐菜单。",
    channel: "渠道",
    language: "语言",
    buildWorkflow: "构建工作流",
    briefRequired:
      "请先描述您需要创建的内容。",
    ctrlEnter: "Ctrl + Enter 构建",

    quickStarts: "快速开始",
    workflowTitle: "建议工作流",
    workflowSubtitle:
      "步骤将根据您的目标自动组织。",
    steps: "个步骤",
    automatic: "自动",
    editable: "可编辑",
    briefLabel: "当前目标",
    noBrief:
      "请在上方描述目标以个性化此工作流。",
    openWorkflow: "打开编辑器",
    executeWorkflow: "运行工作流",

    continueTitle: "继续工作",
    continueSubtitle:
      "快速访问流程中最重要的区域。",

    workflowCardTitle: "您的工作流",
    workflowCardDescription:
      "继续自动化流程或创建新流程。",

    imageCardTitle: "创建图片",
    imageCardDescription:
      "打开生成器并创建单个创意。",

    libraryCardTitle: "您的创意",
    libraryCardDescription:
      "整理并找到您已经创建的所有内容。",

    open: "打开",

    templatesTitle: "推荐工作流",
    templatesSubtitle:
      "使用现成结构，无需从零开始。",
    useTemplate: "使用工作流",

    recentTitle: "最近的创意",
    recentSubtitle:
      "您创建的所有内容都会集中在资源库中。",
    recentEmptyTitle:
      "您的资源库还是空的",
    recentEmptyDescription:
      "创建第一个资产后，它会自动出现在这里。",
    createFirst: "创建第一个资产",
    openLibrary: "打开资源库",
    storedAssets:
      "您已经在 AdBrief 中存储了 {n} 个创意。",

    objectiveStatic: "静态广告",
    objectiveStaticDescription:
      "概念、文案、图片和变体。",
    objectiveStaticExample:
      "我想创建一个静态广告，在 Meta Ads 上展示我的优惠。",

    objectiveVideo: "视频",
    objectiveVideoDescription:
      "脚本、场景、图片和制作。",
    objectiveVideoExample:
      "我想创建一个短视频，在 Instagram 和 TikTok 上推广产品。",

    objectiveCampaign: "完整活动",
    objectiveCampaignDescription:
      "策略、素材和活动变体。",
    objectiveCampaignExample:
      "我想创建一个完整活动，在 Meta Ads 上推出新优惠。",

    objectiveCarousel: "轮播",
    objectiveCarouselDescription:
      "叙事、幻灯片、文案和 CTA。",
    objectiveCarouselExample:
      "我想把我的优惠制作成 Instagram 教育轮播。",

    objectiveAdapt: "调整创意",
    objectiveAdaptDescription:
      "新格式、角度和市场。",
    objectiveAdaptExample:
      "我想为不同受众、格式和渠道调整现有创意。",

    objectiveSocial: "社交内容",
    objectiveSocialDescription:
      "创意、日历、素材和文案。",
    objectiveSocialExample:
      "我想创建一周的 Instagram 内容。",

    templateLaunchTitle: "产品发布",
    templateLaunchDescription:
      "定位、概念、核心素材和变体。",
    templateLaunchPrompt:
      "我想发布一个新产品，需要一个包含概念、广告和变体的完整活动。",

    templateMetaTitle: "Meta Ads 活动",
    templateMetaDescription:
      "优惠、用户画像、角度、文案和测试素材。",
    templateMetaPrompt:
      "我想为 Meta Ads 创建一个包含不同角度和变体的效果活动。",

    templateWeeklyTitle: "每周内容",
    templateWeeklyDescription:
      "规划、创意、格式、素材和文案。",
    templateWeeklyPrompt:
      "我想规划并制作一整周的社交媒体内容。",

    channelMeta: "Meta Ads",
    channelInstagram: "Instagram",
    channelTikTok: "TikTok",
    channelLinkedIn: "LinkedIn",

    languagePt: "葡萄牙语",
    languageEn: "英语",
    languageEs: "西班牙语",

    stepsMap: {
      brand: "加载品牌",
      offer: "理解优惠",
      persona: "定义用户画像",
      concept: "创建概念",
      copy: "撰写文案",
      script: "创建脚本",
      images: "制作图片",
      video: "生成视频",
      carousel: "制作轮播",
      variations: "创建变体",
      channels: "适配渠道",
      schedule: "组织日历",
    } satisfies Record<StepKey, string>,
  },
} as const;

const WORKFLOW_STEPS: Record<
  ObjectiveId,
  readonly StepKey[]
> = {
  static: [
    "brand",
    "offer",
    "persona",
    "concept",
    "copy",
    "images",
    "variations",
  ],

  video: [
    "brand",
    "offer",
    "persona",
    "concept",
    "script",
    "images",
    "video",
    "variations",
  ],

  campaign: [
    "brand",
    "offer",
    "persona",
    "concept",
    "copy",
    "images",
    "variations",
    "channels",
  ],

  carousel: [
    "brand",
    "offer",
    "persona",
    "concept",
    "copy",
    "carousel",
    "variations",
  ],

  adapt: [
    "brand",
    "offer",
    "persona",
    "concept",
    "variations",
    "channels",
  ],

  social: [
    "brand",
    "persona",
    "concept",
    "schedule",
    "copy",
    "images",
    "channels",
  ],
};

export default function BrilliantHub() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const lang: Lang = (
    ["pt", "en", "es", "zh"].includes(
      language as string,
    )
      ? language
      : "pt"
  ) as Lang;

  const copy = COPY[lang];

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const workflowRef =
    useRef<HTMLDivElement | null>(null);

  const composerRef =
    useRef<HTMLDivElement | null>(null);

  const [userName, setUserName] =
    useState("");

  const [assetCount, setAssetCount] =
    useState<number | null>(null);

  const [brief, setBrief] =
    useState("");

  const [
    selectedObjective,
    setSelectedObjective,
  ] = useState<ObjectiveId>("campaign");

  const [channel, setChannel] =
    useState<ChannelId>("meta");

  const [
    outputLanguage,
    setOutputLanguage,
  ] =
    useState<OutputLanguageId>("pt");

  const [
    workflowReady,
    setWorkflowReady,
  ] = useState(true);

  const objectives =
    useMemo<Objective[]>(
      () => [
        {
          id: "static",
          label: copy.objectiveStatic,
          description:
            copy.objectiveStaticDescription,
          example:
            copy.objectiveStaticExample,
          icon: ImageIcon,
        },
        {
          id: "video",
          label: copy.objectiveVideo,
          description:
            copy.objectiveVideoDescription,
          example:
            copy.objectiveVideoExample,
          icon: Video,
        },
        {
          id: "campaign",
          label:
            copy.objectiveCampaign,
          description:
            copy.objectiveCampaignDescription,
          example:
            copy.objectiveCampaignExample,
          icon: Rocket,
        },
        {
          id: "carousel",
          label:
            copy.objectiveCarousel,
          description:
            copy.objectiveCarouselDescription,
          example:
            copy.objectiveCarouselExample,
          icon: Layers3,
        },
        {
          id: "adapt",
          label: copy.objectiveAdapt,
          description:
            copy.objectiveAdaptDescription,
          example:
            copy.objectiveAdaptExample,
          icon: Zap,
        },
        {
          id: "social",
          label: copy.objectiveSocial,
          description:
            copy.objectiveSocialDescription,
          example:
            copy.objectiveSocialExample,
          icon: CalendarDays,
        },
      ],
      [copy],
    );

  const templates =
    useMemo<Template[]>(
      () => [
        {
          id: "launch",
          title:
            copy.templateLaunchTitle,
          description:
            copy.templateLaunchDescription,
          objective: "campaign",
          prompt:
            copy.templateLaunchPrompt,
          icon: Rocket,
        },
        {
          id: "meta",
          title:
            copy.templateMetaTitle,
          description:
            copy.templateMetaDescription,
          objective: "campaign",
          prompt:
            copy.templateMetaPrompt,
          icon: Target,
        },
        {
          id: "weekly",
          title:
            copy.templateWeeklyTitle,
          description:
            copy.templateWeeklyDescription,
          objective: "social",
          prompt:
            copy.templateWeeklyPrompt,
          icon: CalendarDays,
        },
      ],
      [copy],
    );

  const selectedObjectiveData =
    objectives.find(
      (objective) =>
        objective.id ===
        selectedObjective,
    ) ?? objectives[0];

  const selectedSteps =
    WORKFLOW_STEPS[
      selectedObjective
    ];

  const assetLabel = useMemo(() => {
    if (
      assetCount === null ||
      assetCount === 0
    ) {
      return copy.assetEmpty;
    }

    if (assetCount === 1) {
      return copy.assetSingle;
    }

    return copy.assetPlural.replace(
      "{n}",
      String(assetCount),
    );
  }, [assetCount, copy]);

  useEffect(() => {
    const hash =
      window.location.hash;

    if (
      !hash ||
      !hash.includes("error=")
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        hash.slice(1),
      );

    const errorCode =
      params.get("error");

    const errorDescription =
      params.get(
        "error_description",
      ) || "";

    if (!errorCode) {
      return;
    }

    const friendlyMessage =
      errorDescription.includes(
        "vendor",
      ) ||
      errorDescription.includes(
        "server_error",
      )
        ? "Servidor de autenticação instável. Tente novamente em alguns segundos."
        : `Erro de login: ${errorDescription}`;

    toast.error(friendlyMessage);

    window.history.replaceState(
      null,
      "",
      window.location.pathname,
    );

    const timeout =
      window.setTimeout(() => {
        navigate("/login");
      }, 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!mounted || !user) {
          return;
        }

        const metadata = (
          user.user_metadata || {}
        ) as {
          full_name?: string;
          name?: string;
        };

        const rawName =
          metadata.full_name ||
          metadata.name ||
          user.email?.split("@")[0] ||
          "";

        setUserName(
          capitalize(
            rawName.split(" ")[0],
          ),
        );

        const cacheKey =
          `hub_asset_count_${user.id}`;

        const ttl = 60_000;

        try {
          const cachedValue =
            sessionStorage.getItem(
              cacheKey,
            );

          if (cachedValue) {
            const cached =
              JSON.parse(
                cachedValue,
              ) as {
                count: number;
                timestamp?: number;
                ts?: number;
              };

            const timestamp =
              cached.timestamp ??
              cached.ts ??
              0;

            if (
              typeof cached.count ===
                "number" &&
              Date.now() -
                timestamp <
                ttl
            ) {
              if (mounted) {
                setAssetCount(
                  cached.count,
                );
              }

              return;
            }
          }
        } catch {
          // Cache indisponível.
        }

        const { count } =
          await supabase
            .from(
              "hub_assets" as never,
            )
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "user_id",
              user.id,
            );

        if (!mounted) {
          return;
        }

        const finalCount =
          count || 0;

        setAssetCount(finalCount);

        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              count: finalCount,
              timestamp: Date.now(),
            }),
          );
        } catch {
          // Session storage indisponível.
        }
      } catch {
        // A Home continua funcionando.
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const selectObjective = (
    objective: Objective,
  ) => {
    setSelectedObjective(
      objective.id,
    );

    setWorkflowReady(true);

    if (!brief.trim()) {
      setBrief(objective.example);
    }
  };

  const buildWorkflow = () => {
    if (!brief.trim()) {
      toast.error(
        copy.briefRequired,
      );

      textareaRef.current?.focus();

      return;
    }

    setWorkflowReady(true);

    window.requestAnimationFrame(
      () => {
        workflowRef.current?.scrollIntoView(
          {
            behavior: "smooth",
            block: "center",
          },
        );
      },
    );
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey ||
        event.metaKey)
    ) {
      event.preventDefault();
      buildWorkflow();
    }
  };

  const applyTemplate = (
    template: Template,
  ) => {
    setSelectedObjective(
      template.objective,
    );

    setBrief(template.prompt);
    setWorkflowReady(true);

    composerRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "center",
      },
    );

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 400);
  };

  const createWorkflowSeed =
    (): WorkflowSeed => ({
      brief: brief.trim(),
      objective:
        selectedObjective,
      channel,
      outputLanguage,
      createdAt:
        new Date().toISOString(),
    });

  const saveWorkflowSeed = (
    seed: WorkflowSeed,
  ) => {
    try {
      sessionStorage.setItem(
        "adbrief_workflow_seed",
        JSON.stringify(seed),
      );
    } catch {
      // A tela ainda abre mesmo sem storage.
    }
  };

  const openWorkflowEditor = () => {
    if (!brief.trim()) {
      toast.error(
        copy.briefRequired,
      );

      composerRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "center",
        },
      );

      textareaRef.current?.focus();

      return;
    }

    const seed =
      createWorkflowSeed();

    saveWorkflowSeed(seed);

    navigate(
      "/dashboard/hub/workflows",
      {
        state: seed,
      },
    );
  };

  const executeWorkflow = () => {
    if (!brief.trim()) {
      toast.error(
        copy.briefRequired,
      );

      composerRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "center",
        },
      );

      textareaRef.current?.focus();

      return;
    }

    const seed =
      createWorkflowSeed();

    saveWorkflowSeed(seed);

    navigate(
      "/dashboard/hub/workflows",
      {
        state: seed,
      },
    );
  };

  const pageHeading = userName
    ? `${copy.title}, ${userName}?`
    : `${copy.title}?`;

  return (
    <>
      <Helmet>
        <title>
          {copy.pageTitle}
        </title>
      </Helmet>

      <div className="home-shell">
        <div className="home-light home-light-one" />
        <div className="home-light home-light-two" />

        <main className="home-container">
          <header className="home-header">
            <div className="home-heading">
              <h1>
                {pageHeading}
              </h1>

              <p>
                {copy.subtitle}
              </p>
            </div>

            <div className="home-header-actions">
              <HomeBrandSelector />

              <button
                type="button"
                className="home-context-button home-library-button"
                onClick={() =>
                  navigate(
                    "/dashboard/hub/library",
                  )
                }
              >
                <span className="home-context-icon">
                  <FolderOpen
                    size={17}
                    strokeWidth={1.8}
                  />
                </span>

                <span className="home-context-copy">
                  <small>
                    {copy.library}
                  </small>

                  <strong>
                    {assetLabel}
                  </strong>
                </span>

                <ChevronRight
                  size={16}
                  strokeWidth={1.8}
                />
              </button>
            </div>
          </header>

          <section
            ref={composerRef}
            className="home-composer"
          >
            <div className="home-composer-top">
              <div>
                <span className="home-eyebrow">
                  <Sparkles
                    size={14}
                    strokeWidth={2}
                  />

                  {
                    copy.composerEyebrow
                  }
                </span>

                <h2>
                  {
                    copy.composerTitle
                  }
                </h2>

                <p>
                  {
                    copy.composerSubtitle
                  }
                </p>
              </div>

              <div className="home-composer-mark">
                <Workflow
                  size={25}
                  strokeWidth={1.7}
                />
              </div>
            </div>

            <div className="home-textarea-wrap">
              <textarea
                ref={textareaRef}
                value={brief}
                onChange={(
                  event,
                ) =>
                  setBrief(
                    event.target
                      .value,
                  )
                }
                onKeyDown={
                  handleComposerKeyDown
                }
                placeholder={
                  copy.placeholder
                }
                rows={5}
                aria-label={
                  copy.composerTitle
                }
              />

              <span className="home-keyboard-hint">
                {copy.ctrlEnter}
              </span>
            </div>

            <div className="home-composer-footer">
              <div className="home-selectors">
                <label className="home-select-field">
                  <span>
                    <Megaphone
                      size={14}
                      strokeWidth={1.8}
                    />

                    {copy.channel}
                  </span>

                  <select
                    value={channel}
                    onChange={(
                      event,
                    ) =>
                      setChannel(
                        event.target
                          .value as ChannelId,
                      )
                    }
                  >
                    <option value="meta">
                      {
                        copy.channelMeta
                      }
                    </option>

                    <option value="instagram">
                      {
                        copy.channelInstagram
                      }
                    </option>

                    <option value="tiktok">
                      {
                        copy.channelTikTok
                      }
                    </option>

                    <option value="linkedin">
                      {
                        copy.channelLinkedIn
                      }
                    </option>
                  </select>
                </label>

                <label className="home-select-field">
                  <span>
                    <Languages
                      size={14}
                      strokeWidth={1.8}
                    />

                    {copy.language}
                  </span>

                  <select
                    value={
                      outputLanguage
                    }
                    onChange={(
                      event,
                    ) =>
                      setOutputLanguage(
                        event.target
                          .value as OutputLanguageId,
                      )
                    }
                  >
                    <option value="pt">
                      {
                        copy.languagePt
                      }
                    </option>

                    <option value="en">
                      {
                        copy.languageEn
                      }
                    </option>

                    <option value="es">
                      {
                        copy.languageEs
                      }
                    </option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="home-primary-button"
                onClick={
                  buildWorkflow
                }
              >
                <Sparkles
                  size={17}
                  strokeWidth={2}
                />

                {
                  copy.buildWorkflow
                }

                <ArrowRight
                  size={17}
                  strokeWidth={2}
                />
              </button>
            </div>

            <div className="home-objectives">
              <span className="home-objectives-label">
                {copy.quickStarts}
              </span>

              <div className="home-objectives-grid">
                {objectives.map(
                  (objective) => {
                    const Icon =
                      objective.icon;

                    const active =
                      objective.id ===
                      selectedObjective;

                    return (
                      <button
                        type="button"
                        key={
                          objective.id
                        }
                        className={`home-objective ${
                          active
                            ? "home-objective-active"
                            : ""
                        }`}
                        onClick={() =>
                          selectObjective(
                            objective,
                          )
                        }
                        aria-pressed={
                          active
                        }
                      >
                        <span className="home-objective-icon">
                          <Icon
                            size={17}
                            strokeWidth={
                              1.8
                            }
                          />
                        </span>

                        <span>
                          <strong>
                            {
                              objective.label
                            }
                          </strong>

                          <small>
                            {
                              objective.description
                            }
                          </small>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </section>

          {workflowReady && (
            <section
              ref={workflowRef}
              className="home-workflow-panel"
            >
              <div className="home-section-heading home-workflow-heading">
                <div>
                  <span className="home-eyebrow">
                    <Workflow
                      size={14}
                      strokeWidth={2}
                    />

                    {
                      copy.workflowTitle
                    }
                  </span>

                  <h2>
                    {
                      selectedObjectiveData.label
                    }
                  </h2>

                  <p>
                    {
                      copy.workflowSubtitle
                    }
                  </p>
                </div>

                <div className="home-workflow-badges">
                  <span>
                    {
                      selectedSteps.length
                    }{" "}
                    {copy.steps}
                  </span>

                  <span>
                    {copy.editable}
                  </span>
                </div>
              </div>

              <div className="home-workflow-scroll">
                <div className="home-workflow-flow">
                  {selectedSteps.map(
                    (
                      step,
                      index,
                    ) => (
                      <div
                        className="home-flow-fragment"
                        key={`${step}-${index}`}
                      >
                        <article className="home-flow-step">
                          <div className="home-flow-step-number">
                            {index ===
                            0 ? (
                              <Check
                                size={
                                  14
                                }
                                strokeWidth={
                                  2.4
                                }
                              />
                            ) : (
                              index +
                              1
                            )}
                          </div>

                          <div>
                            <span>
                              {index ===
                              0
                                ? copy.automatic
                                : `${copy.steps} ${
                                    index +
                                    1
                                  }`}
                            </span>

                            <strong>
                              {
                                copy
                                  .stepsMap[
                                  step
                                ]
                              }
                            </strong>
                          </div>
                        </article>

                        {index <
                          selectedSteps.length -
                            1 && (
                          <div className="home-flow-connector">
                            <span />

                            <ChevronRight
                              size={
                                15
                              }
                              strokeWidth={
                                2
                              }
                            />
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="home-workflow-summary">
                <div className="home-brief-preview">
                  <span>
                    <Target
                      size={15}
                      strokeWidth={1.9}
                    />

                    {
                      copy.briefLabel
                    }
                  </span>

                  <p>
                    {brief.trim() ||
                      copy.noBrief}
                  </p>
                </div>

                <div className="home-workflow-actions">
                  <button
                    type="button"
                    className="home-secondary-button"
                    onClick={
                      openWorkflowEditor
                    }
                  >
                    {
                      copy.openWorkflow
                    }
                  </button>

                  <button
                    type="button"
                    className="home-run-button"
                    onClick={
                      executeWorkflow
                    }
                  >
                    <Play
                      size={16}
                      strokeWidth={2}
                      fill="currentColor"
                    />

                    {
                      copy.executeWorkflow
                    }
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="home-section">
            <div className="home-section-heading">
              <div>
                <h2>
                  {
                    copy.continueTitle
                  }
                </h2>

                <p>
                  {
                    copy.continueSubtitle
                  }
                </p>
              </div>
            </div>

            <div className="home-action-grid">
              <ActionCard
                icon={Workflow}
                title={
                  copy.workflowCardTitle
                }
                description={
                  copy.workflowCardDescription
                }
                action={copy.open}
                onClick={() =>
                  navigate(
                    "/dashboard/hub/workflows",
                  )
                }
              />

              <ActionCard
                icon={ImageIcon}
                title={
                  copy.imageCardTitle
                }
                description={
                  copy.imageCardDescription
                }
                action={copy.open}
                onClick={() =>
                  navigate(
                    "/dashboard/hub/image",
                  )
                }
              />

              <ActionCard
                icon={FolderOpen}
                title={
                  copy.libraryCardTitle
                }
                description={
                  assetCount &&
                  assetCount > 0
                    ? copy.storedAssets.replace(
                        "{n}",
                        String(
                          assetCount,
                        ),
                      )
                    : copy.libraryCardDescription
                }
                action={copy.open}
                onClick={() =>
                  navigate(
                    "/dashboard/hub/library",
                  )
                }
              />
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-heading">
              <div>
                <h2>
                  {
                    copy.templatesTitle
                  }
                </h2>

                <p>
                  {
                    copy.templatesSubtitle
                  }
                </p>
              </div>
            </div>

            <div className="home-template-grid">
              {templates.map(
                (template) => {
                  const Icon =
                    template.icon;

                  return (
                    <button
                      type="button"
                      className="home-template"
                      key={
                        template.id
                      }
                      onClick={() =>
                        applyTemplate(
                          template,
                        )
                      }
                    >
                      <span className="home-template-icon">
                        <Icon
                          size={20}
                          strokeWidth={
                            1.8
                          }
                        />
                      </span>

                      <span className="home-template-content">
                        <strong>
                          {
                            template.title
                          }
                        </strong>

                        <small>
                          {
                            template.description
                          }
                        </small>

                        <span className="home-template-action">
                          {
                            copy.useTemplate
                          }

                          <ArrowRight
                            size={
                              14
                            }
                            strokeWidth={
                              2
                            }
                          />
                        </span>
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </section>

          <section className="home-section">
            <div className="home-section-heading">
              <div>
                <h2>
                  {copy.recentTitle}
                </h2>

                <p>
                  {
                    copy.recentSubtitle
                  }
                </p>
              </div>

              {assetCount !== null &&
                assetCount > 0 && (
                  <button
                    type="button"
                    className="home-text-button"
                    onClick={() =>
                      navigate(
                        "/dashboard/hub/library",
                      )
                    }
                  >
                    {
                      copy.openLibrary
                    }

                    <ArrowRight
                      size={15}
                      strokeWidth={2}
                    />
                  </button>
                )}
            </div>

            {assetCount !== null &&
            assetCount > 0 ? (
              <button
                type="button"
                className="home-library-summary"
                onClick={() =>
                  navigate(
                    "/dashboard/hub/library",
                  )
                }
              >
                <div className="home-library-visual">
                  <div className="home-asset-preview home-asset-preview-one">
                    <ImageIcon
                      size={22}
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="home-asset-preview home-asset-preview-two">
                    <Sparkles
                      size={22}
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="home-asset-preview home-asset-preview-three">
                    <Video
                      size={22}
                      strokeWidth={1.5}
                    />
                  </div>
                </div>

                <div className="home-library-summary-copy">
                  <span>
                    {copy.library}
                  </span>

                  <strong>
                    {copy.storedAssets.replace(
                      "{n}",
                      String(
                        assetCount,
                      ),
                    )}
                  </strong>

                  <small>
                    {
                      copy.openLibrary
                    }
                  </small>
                </div>

                <span className="home-library-arrow">
                  <ArrowRight
                    size={19}
                    strokeWidth={2}
                  />
                </span>
              </button>
            ) : (
              <div className="home-empty-state">
                <span className="home-empty-icon">
                  <ImageIcon
                    size={25}
                    strokeWidth={1.7}
                  />
                </span>

                <div>
                  <strong>
                    {
                      copy.recentEmptyTitle
                    }
                  </strong>

                  <p>
                    {
                      copy.recentEmptyDescription
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="home-secondary-button"
                  onClick={() =>
                    navigate(
                      "/dashboard/hub/image",
                    )
                  }
                >
                  <Sparkles
                    size={15}
                    strokeWidth={2}
                  />

                  {
                    copy.createFirst
                  }
                </button>
              </div>
            )}
          </section>
        </main>

        <style>{`
          .home-shell {
            --home-bg: #050a12;
            --home-panel: rgba(10, 20, 34, 0.88);
            --home-border: rgba(148, 163, 184, 0.13);
            --home-border-hover: rgba(34, 211, 238, 0.32);
            --home-text: #f8fbff;
            --home-muted: #8fa1b7;
            --home-subtle: #64748b;
            --home-blue: #159cf8;
            --home-cyan: #22d3ee;
            --home-radius: 18px;

            position: relative;
            min-height: 100vh;
            overflow: hidden;
            color: var(--home-text);
            background:
              radial-gradient(
                circle at 15% -10%,
                rgba(21, 156, 248, 0.12),
                transparent 34%
              ),
              radial-gradient(
                circle at 90% 2%,
                rgba(34, 211, 238, 0.075),
                transparent 28%
              ),
              linear-gradient(
                180deg,
                #07101c 0%,
                var(--home-bg) 48%,
                #040810 100%
              );
          }

          .home-shell * {
            box-sizing: border-box;
          }

          .home-shell button,
          .home-shell textarea,
          .home-shell select {
            font: inherit;
          }

          .home-light {
            position: absolute;
            border-radius: 999px;
            pointer-events: none;
            filter: blur(110px);
            opacity: 0.19;
          }

          .home-light-one {
            top: 170px;
            left: 20%;
            width: 300px;
            height: 300px;
            background: #159cf8;
          }

          .home-light-two {
            top: 620px;
            right: -80px;
            width: 280px;
            height: 280px;
            background: #22d3ee;
            opacity: 0.09;
          }

          .home-container {
            position: relative;
            z-index: 1;
            width: min(1380px, 100%);
            margin: 0 auto;
            padding: 34px 36px 80px;
          }

          .home-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 28px;
            margin-bottom: 28px;
          }

          .home-heading h1 {
            margin: 0;
            max-width: 760px;
            color: #ffffff;
            font-size: clamp(27px, 3vw, 38px);
            font-weight: 740;
            line-height: 1.12;
            letter-spacing: -0.035em;
          }

          .home-heading p {
            max-width: 660px;
            margin: 10px 0 0;
            color: var(--home-muted);
            font-size: 14px;
            line-height: 1.65;
          }

          .home-header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .home-context-button {
            display: flex;
            width: 100%;
            min-width: 185px;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            color: var(--home-text);
            text-align: left;
            cursor: pointer;
            border: 1px solid var(--home-border);
            border-radius: 12px;
            background: rgba(9, 18, 31, 0.8);
            transition:
              border-color 160ms ease,
              background 160ms ease,
              transform 160ms ease;
          }

          .home-context-button:hover {
            border-color: rgba(21, 156, 248, 0.32);
            background: rgba(12, 25, 43, 0.95);
            transform: translateY(-1px);
          }

          .home-context-icon {
            display: grid;
            flex: 0 0 auto;
            width: 34px;
            height: 34px;
            place-items: center;
            color: var(--home-cyan);
            border: 1px solid rgba(34, 211, 238, 0.15);
            border-radius: 9px;
            background: rgba(34, 211, 238, 0.07);
          }

          .home-context-copy {
            display: flex;
            flex: 1;
            min-width: 0;
            flex-direction: column;
            gap: 2px;
          }

          .home-context-copy small {
            color: var(--home-subtle);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .home-context-copy strong {
            overflow: hidden;
            color: #e8f2ff;
            font-size: 12px;
            font-weight: 650;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .home-composer {
            position: relative;
            overflow: hidden;
            padding: 26px;
            border: 1px solid rgba(21, 156, 248, 0.22);
            border-radius: 22px;
            background:
              linear-gradient(
                145deg,
                rgba(13, 29, 49, 0.96),
                rgba(7, 17, 30, 0.93)
              );
            box-shadow:
              0 24px 80px rgba(0, 0, 0, 0.28),
              inset 0 1px 0 rgba(255, 255, 255, 0.035);
          }

          .home-composer::before {
            position: absolute;
            top: -120px;
            right: -80px;
            width: 300px;
            height: 300px;
            content: "";
            pointer-events: none;
            border-radius: 999px;
            background: rgba(21, 156, 248, 0.11);
            filter: blur(55px);
          }

          .home-composer-top {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 20px;
          }

          .home-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            color: #70d8ff;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .home-composer h2,
          .home-section-heading h2 {
            margin: 8px 0 0;
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            line-height: 1.25;
            letter-spacing: -0.025em;
          }

          .home-composer-top p,
          .home-section-heading p {
            max-width: 690px;
            margin: 7px 0 0;
            color: var(--home-muted);
            font-size: 13px;
            line-height: 1.6;
          }

          .home-composer-mark {
            display: grid;
            flex: 0 0 auto;
            width: 48px;
            height: 48px;
            place-items: center;
            color: var(--home-cyan);
            border: 1px solid rgba(34, 211, 238, 0.18);
            border-radius: 13px;
            background: rgba(34, 211, 238, 0.065);
          }

          .home-textarea-wrap {
            position: relative;
            z-index: 1;
          }

          .home-textarea-wrap textarea {
            width: 100%;
            min-height: 138px;
            resize: vertical;
            padding: 18px 18px 38px;
            color: #f8fbff;
            outline: none;
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 15px;
            background: rgba(3, 9, 17, 0.67);
            font-size: 15px;
            line-height: 1.65;
            transition:
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .home-textarea-wrap textarea::placeholder {
            color: #607289;
          }

          .home-textarea-wrap textarea:focus {
            border-color: rgba(34, 211, 238, 0.44);
            box-shadow:
              0 0 0 3px rgba(34, 211, 238, 0.07);
          }

          .home-keyboard-hint {
            position: absolute;
            right: 14px;
            bottom: 12px;
            color: #53657a;
            font-size: 10px;
            font-weight: 600;
          }

          .home-composer-footer {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 18px;
            margin-top: 14px;
          }

          .home-selectors {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .home-select-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .home-select-field > span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #71849a;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.075em;
            text-transform: uppercase;
          }

          .home-select-field select {
            min-width: 145px;
            padding: 9px 34px 9px 11px;
            color: #dbeafe;
            cursor: pointer;
            outline: none;
            border: 1px solid rgba(148, 163, 184, 0.15);
            border-radius: 10px;
            background: #091321;
            font-size: 12px;
            font-weight: 600;
          }

          .home-primary-button,
          .home-run-button,
          .home-secondary-button,
          .home-text-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition:
              transform 150ms ease,
              border-color 150ms ease,
              background 150ms ease,
              box-shadow 150ms ease;
          }

          .home-primary-button,
          .home-run-button {
            min-height: 43px;
            padding: 0 16px;
            color: #03111d;
            border: 0;
            border-radius: 11px;
            background:
              linear-gradient(
                135deg,
                #30c9ff,
                #159cf8
              );
            box-shadow: 0 10px 30px rgba(21, 156, 248, 0.22);
            font-size: 12px;
            font-weight: 800;
          }

          .home-primary-button:hover,
          .home-run-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 14px 34px rgba(21, 156, 248, 0.3);
          }

          .home-objectives {
            position: relative;
            z-index: 1;
            margin-top: 23px;
            padding-top: 20px;
            border-top: 1px solid rgba(148, 163, 184, 0.1);
          }

          .home-objectives-label {
            display: block;
            margin-bottom: 10px;
            color: #71849a;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .home-objectives-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 8px;
          }

          .home-objective {
            display: flex;
            min-width: 0;
            align-items: flex-start;
            gap: 9px;
            padding: 11px;
            color: #c7d5e6;
            text-align: left;
            cursor: pointer;
            border: 1px solid rgba(148, 163, 184, 0.1);
            border-radius: 11px;
            background: rgba(4, 11, 20, 0.44);
            transition:
              border-color 150ms ease,
              background 150ms ease,
              transform 150ms ease;
          }

          .home-objective:hover {
            border-color: rgba(21, 156, 248, 0.24);
            background: rgba(10, 24, 41, 0.78);
            transform: translateY(-1px);
          }

          .home-objective-active {
            color: #ffffff;
            border-color: rgba(34, 211, 238, 0.35);
            background:
              linear-gradient(
                145deg,
                rgba(21, 156, 248, 0.15),
                rgba(10, 24, 41, 0.78)
              );
          }

          .home-objective-icon {
            display: grid;
            flex: 0 0 auto;
            width: 29px;
            height: 29px;
            place-items: center;
            color: #45cfff;
            border-radius: 8px;
            background: rgba(21, 156, 248, 0.1);
          }

          .home-objective > span:last-child {
            display: flex;
            min-width: 0;
            flex-direction: column;
            gap: 3px;
          }

          .home-objective strong {
            color: inherit;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.3;
          }

          .home-objective small {
            display: -webkit-box;
            overflow: hidden;
            color: #708298;
            font-size: 9px;
            line-height: 1.4;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }

          .home-workflow-panel {
            margin-top: 22px;
            padding: 24px;
            border: 1px solid var(--home-border);
            border-radius: var(--home-radius);
            background: var(--home-panel);
            box-shadow:
              0 20px 60px rgba(0, 0, 0, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.025);
            backdrop-filter: blur(18px);
          }

          .home-section {
            margin-top: 38px;
          }

          .home-section-heading {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 15px;
          }

          .home-section-heading h2 {
            margin-top: 0;
          }

          .home-workflow-heading {
            align-items: flex-start;
            margin-bottom: 22px;
          }

          .home-workflow-heading h2 {
            margin-top: 8px;
          }

          .home-workflow-badges {
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .home-workflow-badges span {
            padding: 6px 9px;
            color: #8ba0b8;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 999px;
            background: rgba(5, 12, 22, 0.58);
            font-size: 10px;
            font-weight: 700;
          }

          .home-workflow-scroll {
            overflow-x: auto;
            padding: 2px 1px 11px;
            scrollbar-width: thin;
            scrollbar-color: rgba(34, 211, 238, 0.22) transparent;
          }

          .home-workflow-flow {
            display: flex;
            width: max-content;
            min-width: 100%;
            align-items: center;
          }

          .home-flow-fragment {
            display: flex;
            align-items: center;
          }

          .home-flow-step {
            display: flex;
            width: 150px;
            min-height: 70px;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 12px;
            background:
              linear-gradient(
                145deg,
                rgba(13, 27, 45, 0.92),
                rgba(6, 14, 25, 0.84)
              );
          }

          .home-flow-step-number {
            display: grid;
            flex: 0 0 auto;
            width: 28px;
            height: 28px;
            place-items: center;
            color: #64d8ff;
            border: 1px solid rgba(34, 211, 238, 0.2);
            border-radius: 9px;
            background: rgba(34, 211, 238, 0.075);
            font-size: 11px;
            font-weight: 800;
          }

          .home-flow-step > div:last-child {
            display: flex;
            min-width: 0;
            flex-direction: column;
            gap: 4px;
          }

          .home-flow-step span {
            color: #586c83;
            font-size: 8px;
            font-weight: 750;
            letter-spacing: 0.07em;
            text-transform: uppercase;
          }

          .home-flow-step strong {
            color: #ddecff;
            font-size: 11px;
            font-weight: 680;
            line-height: 1.35;
          }

          .home-flow-connector {
            display: flex;
            width: 34px;
            align-items: center;
            color: rgba(34, 211, 238, 0.45);
          }

          .home-flow-connector span {
            width: 18px;
            height: 1px;
            background: rgba(34, 211, 238, 0.22);
          }

          .home-workflow-summary {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-top: 8px;
            padding-top: 18px;
            border-top: 1px solid rgba(148, 163, 184, 0.1);
          }

          .home-brief-preview {
            min-width: 0;
          }

          .home-brief-preview > span {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #71849a;
            font-size: 9px;
            font-weight: 750;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .home-brief-preview p {
            display: -webkit-box;
            max-width: 780px;
            margin: 7px 0 0;
            overflow: hidden;
            color: #c5d3e4;
            font-size: 12px;
            line-height: 1.55;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }

          .home-workflow-actions {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            gap: 9px;
          }

          .home-secondary-button {
            min-height: 40px;
            padding: 0 13px;
            color: #c7d5e6;
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 10px;
            background: rgba(8, 17, 29, 0.75);
            font-size: 11px;
            font-weight: 700;
          }

          .home-secondary-button:hover {
            color: #ffffff;
            border-color: rgba(34, 211, 238, 0.27);
            background: rgba(12, 27, 45, 0.92);
            transform: translateY(-1px);
          }

          .home-run-button {
            min-height: 40px;
            font-size: 11px;
          }

          .home-action-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }

          .home-action-card {
            display: flex;
            min-height: 148px;
            flex-direction: column;
            align-items: flex-start;
            padding: 18px;
            color: inherit;
            text-align: left;
            cursor: pointer;
            border: 1px solid var(--home-border);
            border-radius: 15px;
            background:
              linear-gradient(
                145deg,
                rgba(12, 24, 41, 0.84),
                rgba(6, 14, 25, 0.76)
              );
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              background 160ms ease;
          }

          .home-action-card:hover {
            border-color: var(--home-border-hover);
            transform: translateY(-2px);
          }

          .home-action-card-icon {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            color: #51d2ff;
            border: 1px solid rgba(34, 211, 238, 0.14);
            border-radius: 10px;
            background: rgba(34, 211, 238, 0.065);
          }

          .home-action-card strong {
            margin-top: 15px;
            color: #f3f8ff;
            font-size: 13px;
            font-weight: 700;
          }

          .home-action-card p {
            flex: 1;
            margin: 6px 0 14px;
            color: #7e91a7;
            font-size: 11px;
            line-height: 1.55;
          }

          .home-action-card-action,
          .home-template-action {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #52ceff;
            font-size: 10px;
            font-weight: 750;
          }

          .home-template-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }

          .home-template {
            display: flex;
            min-height: 132px;
            align-items: flex-start;
            gap: 13px;
            padding: 17px;
            color: inherit;
            text-align: left;
            cursor: pointer;
            border: 1px solid var(--home-border);
            border-radius: 15px;
            background: rgba(8, 18, 31, 0.75);
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              background 160ms ease;
          }

          .home-template:hover {
            border-color: rgba(21, 156, 248, 0.3);
            transform: translateY(-2px);
          }

          .home-template-icon {
            display: grid;
            flex: 0 0 auto;
            width: 40px;
            height: 40px;
            place-items: center;
            color: #4acfff;
            border-radius: 11px;
            background: rgba(21, 156, 248, 0.1);
          }

          .home-template-content {
            display: flex;
            min-width: 0;
            flex-direction: column;
          }

          .home-template-content > strong {
            color: #f1f7ff;
            font-size: 12px;
            font-weight: 720;
          }

          .home-template-content > small {
            flex: 1;
            margin-top: 6px;
            color: #74879e;
            font-size: 10px;
            line-height: 1.55;
          }

          .home-template-action {
            margin-top: 14px;
          }

          .home-text-button {
            padding: 5px 0;
            color: #6ed8ff;
            border: 0;
            background: transparent;
            font-size: 10px;
            font-weight: 750;
          }

          .home-empty-state {
            display: flex;
            min-height: 122px;
            align-items: center;
            gap: 15px;
            padding: 20px;
            border: 1px dashed rgba(148, 163, 184, 0.17);
            border-radius: 15px;
            background: rgba(7, 15, 26, 0.57);
          }

          .home-empty-icon {
            display: grid;
            flex: 0 0 auto;
            width: 48px;
            height: 48px;
            place-items: center;
            color: #4dcfff;
            border: 1px solid rgba(34, 211, 238, 0.14);
            border-radius: 13px;
            background: rgba(34, 211, 238, 0.055);
          }

          .home-empty-state > div {
            flex: 1;
          }

          .home-empty-state strong {
            color: #eaf4ff;
            font-size: 12px;
            font-weight: 700;
          }

          .home-empty-state p {
            margin: 5px 0 0;
            color: #74879e;
            font-size: 11px;
            line-height: 1.5;
          }

          .home-library-summary {
            display: flex;
            width: 100%;
            min-height: 132px;
            align-items: center;
            gap: 20px;
            padding: 19px;
            color: inherit;
            text-align: left;
            cursor: pointer;
            border: 1px solid var(--home-border);
            border-radius: 16px;
            background:
              linear-gradient(
                110deg,
                rgba(12, 28, 47, 0.93),
                rgba(7, 16, 28, 0.76)
              );
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              background 160ms ease;
          }

          .home-library-summary:hover {
            border-color: rgba(34, 211, 238, 0.28);
            transform: translateY(-2px);
          }

          .home-library-visual {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            padding-left: 12px;
          }

          .home-asset-preview {
            display: grid;
            width: 72px;
            height: 84px;
            place-items: center;
            color: rgba(209, 239, 255, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.09);
            border-radius: 12px;
            background:
              linear-gradient(
                145deg,
                rgba(21, 156, 248, 0.25),
                rgba(6, 17, 31, 0.96)
              );
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.26);
          }

          .home-asset-preview-two {
            margin-left: -20px;
            transform: rotate(3deg);
          }

          .home-asset-preview-three {
            margin-left: -20px;
            transform: rotate(6deg);
          }

          .home-library-summary-copy {
            display: flex;
            flex: 1;
            min-width: 0;
            flex-direction: column;
          }

          .home-library-summary-copy > span {
            color: #57d1ff;
            font-size: 9px;
            font-weight: 760;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }

          .home-library-summary-copy strong {
            margin-top: 7px;
            color: #f4f9ff;
            font-size: 14px;
            font-weight: 720;
          }

          .home-library-summary-copy small {
            margin-top: 6px;
            color: #71849a;
            font-size: 10px;
          }

          .home-library-arrow {
            display: grid;
            flex: 0 0 auto;
            width: 38px;
            height: 38px;
            place-items: center;
            color: #54d1ff;
            border: 1px solid rgba(34, 211, 238, 0.14);
            border-radius: 11px;
            background: rgba(34, 211, 238, 0.06);
          }

          @media (max-width: 1180px) {
            .home-objectives-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 900px) {
            .home-container {
              padding: 26px 22px 64px;
            }

            .home-header {
              flex-direction: column;
            }

            .home-header-actions {
              width: 100%;
            }

            .home-header-actions > * {
              flex: 1;
            }

            .home-composer-footer,
            .home-workflow-summary {
              align-items: stretch;
              flex-direction: column;
            }

            .home-primary-button {
              width: 100%;
            }

            .home-workflow-actions {
              justify-content: flex-end;
            }

            .home-action-grid,
            .home-template-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 620px) {
            .home-container {
              padding: 20px 14px 52px;
            }

            .home-header-actions {
              align-items: stretch;
              flex-direction: column;
            }

            .home-header-actions > * {
              width: 100%;
            }

            .home-context-button {
              width: 100%;
            }

            .home-composer,
            .home-workflow-panel {
              padding: 18px;
              border-radius: 17px;
            }

            .home-composer-mark {
              display: none;
            }

            .home-objectives-grid {
              grid-template-columns: 1fr 1fr;
            }

            .home-selectors {
              display: grid;
              width: 100%;
              grid-template-columns: 1fr 1fr;
            }

            .home-select-field select {
              width: 100%;
              min-width: 0;
            }

            .home-workflow-badges {
              display: none;
            }

            .home-workflow-actions {
              display: grid;
              grid-template-columns: 1fr;
            }

            .home-secondary-button,
            .home-run-button {
              width: 100%;
            }

            .home-empty-state {
              align-items: flex-start;
              flex-direction: column;
            }

            .home-library-summary {
              align-items: flex-start;
              flex-direction: column;
            }

            .home-library-arrow {
              display: none;
            }
          }

          @media (max-width: 420px) {
            .home-objectives-grid,
            .home-selectors {
              grid-template-columns: 1fr;
            }

            .home-heading h1 {
              font-size: 27px;
            }

            .home-library-visual {
              transform: scale(0.88);
              transform-origin: left center;
            }
          }
        `}</style>
      </div>
    </>
  );
}

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}

function ActionCard({
  icon: Icon,
  title,
  description,
  action,
  onClick,
}: ActionCardProps) {
  return (
    <button
      type="button"
      className="home-action-card"
      onClick={onClick}
    >
      <span className="home-action-card-icon">
        <Icon
          size={19}
          strokeWidth={1.8}
        />
      </span>

      <strong>{title}</strong>

      <p>{description}</p>

      <span className="home-action-card-action">
        {action}

        <ArrowRight
          size={14}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}

function capitalize(value: string) {
  if (!value) {
    return "";
  }

  return (
    value
      .charAt(0)
      .toLocaleUpperCase() +
    value.slice(1)
  );
}
