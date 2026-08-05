/**
 * sidebarConfig — fonte única da navegação do produto.
 *
 * Nenhum item de menu deve ser escrito à mão em outro lugar. Todas as
 * rotas aqui já existem em App.tsx — nada de página inventada.
 */
import {
  House, Tags, Folder, Image, Video, Mic, Workflow, PanelsTopLeft,
  GalleryHorizontal, FlaskConical, Users, Captions, AudioLines,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Lang = string;

export interface SidebarItem {
  /** rota real da aplicação */
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = ativo só em match exato (sem subrotas) */
  exact?: boolean;
  /** plano mínimo necessário; ausente = livre */
  requiredPlan?: "creator" | "pro" | "studio";
  badge?: string;
}

export interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const dict = {
  pt: {
    main: "Principal", create: "Criar", auto: "Automações", intel: "Inteligência",
    home: "Início", brands: "Marcas", library: "Biblioteca",
    image: "Imagem", video: "Vídeo", voice: "Locução",
    workflows: "Workflows", storyboard: "Storyboard", carousel: "Carrossel", ab: "Variações A/B",
    personas: "Personas", captions: "Legendas", transcribe: "Transcrição", analytics: "Analytics",
    cta: "Criar criativo", plans: "Planos e créditos", settings: "Configurações", logout: "Sair",
    collapse: "Recolher menu", expand: "Expandir menu",
    upgrade: "Fazer upgrade", credits: "créditos", used: "usado",
    lockedPlan: "Disponível em planos superiores",
  },
  en: {
    main: "Main", create: "Create", auto: "Automations", intel: "Intelligence",
    home: "Home", brands: "Brands", library: "Library",
    image: "Image", video: "Video", voice: "Voiceover",
    workflows: "Workflows", storyboard: "Storyboard", carousel: "Carousel", ab: "A/B variations",
    personas: "Personas", captions: "Captions", transcribe: "Transcription", analytics: "Analytics",
    cta: "Create creative", plans: "Plans & credits", settings: "Settings", logout: "Sign out",
    collapse: "Collapse menu", expand: "Expand menu",
    upgrade: "Upgrade", credits: "credits", used: "used",
    lockedPlan: "Available on higher plans",
  },
  es: {
    main: "Principal", create: "Crear", auto: "Automatizaciones", intel: "Inteligencia",
    home: "Inicio", brands: "Marcas", library: "Biblioteca",
    image: "Imagen", video: "Video", voice: "Locución",
    workflows: "Workflows", storyboard: "Storyboard", carousel: "Carrusel", ab: "Variaciones A/B",
    personas: "Personas", captions: "Subtítulos", transcribe: "Transcripción", analytics: "Analytics",
    cta: "Crear creativo", plans: "Planes y créditos", settings: "Configuración", logout: "Cerrar sesión",
    collapse: "Contraer menú", expand: "Expandir menú",
    upgrade: "Mejorar plan", credits: "créditos", used: "usado",
    lockedPlan: "Disponible en planes superiores",
  },
} as const;

export type SidebarCopy = typeof dict.pt;

export function getSidebarCopy(lang: Lang): SidebarCopy {
  if (lang === "en") return dict.en as unknown as SidebarCopy;
  if (lang === "es") return dict.es as unknown as SidebarCopy;
  return dict.pt;
}

export function getSidebarSections(lang: Lang): SidebarSection[] {
  const t = getSidebarCopy(lang);
  return [
    {
      label: t.main,
      items: [
        { href: "/dashboard/hub", label: t.home, icon: House, exact: true },
        { href: "/dashboard/hub/brands", label: t.brands, icon: Tags },
        { href: "/dashboard/hub/library", label: t.library, icon: Folder },
      ],
    },
    {
      label: t.create,
      items: [
        { href: "/dashboard/hub/image", label: t.image, icon: Image },
        { href: "/dashboard/hub/video", label: t.video, icon: Video },
        { href: "/dashboard/hub/voice", label: t.voice, icon: Mic },
      ],
    },
    {
      label: t.auto,
      items: [
        { href: "/dashboard/hub/workflows", label: t.workflows, icon: Workflow, requiredPlan: "creator" },
        { href: "/dashboard/hub/storyboard", label: t.storyboard, icon: PanelsTopLeft },
        { href: "/dashboard/hub/carousel", label: t.carousel, icon: GalleryHorizontal },
        { href: "/dashboard/hub/ab", label: t.ab, icon: FlaskConical },
      ],
    },
    {
      label: t.intel,
      items: [
        { href: "/dashboard/persona", label: t.personas, icon: Users },
        { href: "/dashboard/hub/captions", label: t.captions, icon: Captions },
        { href: "/dashboard/hub/transcribe", label: t.transcribe, icon: AudioLines },
        { href: "/dashboard/hub/analytics", label: t.analytics, icon: ChartNoAxesColumnIncreasing },
      ],
    },
  ];
}

/** Destino do CTA principal — o fluxo de criação atual do produto. */
export const CREATE_CTA_HREF = "/dashboard/hub/image";

export const SIDEBAR_COLLAPSED_KEY = "adbrief-sidebar-collapsed";
