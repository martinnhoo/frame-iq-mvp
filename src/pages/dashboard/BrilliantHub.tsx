// BrilliantHub — Central criativa interna.
//
// Subproduto isolado, sem cruzar dependências com produto comercial.
// Todos os textos traduzidos via useLanguage (pt/en/es/zh).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Image as ImageIcon, Clapperboard, Video,
  SplitSquareVertical, FolderOpen, BarChart3,
  Type, Mic, Maximize, Sparkles, Captions,
  Gem,
} from "lucide-react";

// ── i18n ────────────────────────────────────────────────────────────────

type Lang = "pt" | "en" | "es" | "zh";
const STR: Record<Lang, Record<string, string>> = {
  pt: {
    kicker: "Central Criativa",
    main_section: "Ferramentas principais",
    support_section: "Ferramentas de apoio",
    recent_section: "Atividades recentes",
    recent_empty: "Nenhuma atividade ainda. Comece gerando uma imagem.",
    soon_badge: "Em breve",
    img_title: "Image Generator",
    img_desc: "Gere imagens com IA em segundos com base no seu prompt.",
    img_cta: "Gerar imagem",
    board_title: "Production Board",
    board_desc: "Organize produções, status, etapas e prazos.",
    board_cta: "Acessar board",
    transcript_title: "Transcript",
    transcript_desc: "Transcreva áudio dos seus vídeos para texto.",
    transcript_cta: "Transcrever",
    ab_title: "AB Variants",
    ab_desc: "Gere variações pra testar e encontrar a melhor.",
    ab_cta: "Criar variações",
    library_title: "Biblioteca",
    library_desc: "Sua central de criativos. Organize, filtre, encontre.",
    library_cta: "Acessar biblioteca",
    analytics_title: "Analytics",
    analytics_desc: "Acompanhe o desempenho dos criativos gerados.",
    analytics_cta: "Ver analytics",
    copywriter_title: "Copywriter",
    copywriter_desc: "Gere copies que vendem.",
    voice_title: "Narração IA",
    voice_desc: "Gere vozes realistas para seus vídeos.",
    resize_title: "Resize",
    resize_desc: "Redimensione criativos para qualquer formato.",
    enhancer_title: "Enhancer",
    enhancer_desc: "Melhore a qualidade das imagens e vídeos.",
    captions_title: "Legendas",
    captions_desc: "Gere legendas automáticas para vídeos.",
    open: "Abrir",
    soon: "Em breve",
    rel_now: "agora",
    rel_min: "min atrás",
    rel_h: "h atrás",
    rel_d: "d atrás",
    activity_image_generated: "Imagem gerada",
    activity_image_alt: "Imagem",
  },
  en: {
    kicker: "Creative Hub",
    main_section: "Main tools",
    support_section: "Support tools",
    recent_section: "Recent activity",
    recent_empty: "No activity yet. Start by generating an image.",
    soon_badge: "Soon",
    img_title: "Image Generator",
    img_desc: "Generate AI images in seconds from a prompt.",
    img_cta: "Generate image",
    board_title: "Production Board",
    board_desc: "Organize productions, status, stages and deadlines.",
    board_cta: "Open board",
    transcript_title: "Transcript",
    transcript_desc: "Transcribe video audio to text.",
    transcript_cta: "Transcribe",
    ab_title: "AB Variants",
    ab_desc: "Generate variations to test and find the best.",
    ab_cta: "Create variations",
    library_title: "Library",
    library_desc: "Your creatives hub. Organize, filter, find.",
    library_cta: "Open library",
    analytics_title: "Analytics",
    analytics_desc: "Track performance of generated creatives.",
    analytics_cta: "View analytics",
    copywriter_title: "Copywriter",
    copywriter_desc: "Generate copy that sells.",
    voice_title: "AI Voiceover",
    voice_desc: "Generate realistic voices for your videos.",
    resize_title: "Resize",
    resize_desc: "Resize creatives to any format.",
    enhancer_title: "Enhancer",
    enhancer_desc: "Upscale image and video quality.",
    captions_title: "Captions",
    captions_desc: "Generate automatic captions for videos.",
    open: "Open",
    soon: "Soon",
    rel_now: "now",
    rel_min: "min ago",
    rel_h: "h ago",
    rel_d: "d ago",
    activity_image_generated: "Image generated",
    activity_image_alt: "Image",
  },
  es: {
    kicker: "Central Creativa",
    main_section: "Herramientas principales",
    support_section: "Herramientas de apoyo",
    recent_section: "Actividad reciente",
    recent_empty: "Sin actividad aún. Empieza generando una imagen.",
    soon_badge: "Pronto",
    img_title: "Image Generator",
    img_desc: "Genera imágenes con IA en segundos desde un prompt.",
    img_cta: "Generar imagen",
    board_title: "Production Board",
    board_desc: "Organiza producciones, estado, etapas y plazos.",
    board_cta: "Abrir board",
    transcript_title: "Transcript",
    transcript_desc: "Transcribe audio de videos a texto.",
    transcript_cta: "Transcribir",
    ab_title: "AB Variants",
    ab_desc: "Genera variaciones para encontrar la mejor.",
    ab_cta: "Crear variaciones",
    library_title: "Biblioteca",
    library_desc: "Tu central de creativos. Organiza, filtra, encuentra.",
    library_cta: "Abrir biblioteca",
    analytics_title: "Analytics",
    analytics_desc: "Sigue el rendimiento de los creativos.",
    analytics_cta: "Ver analytics",
    copywriter_title: "Copywriter",
    copywriter_desc: "Genera copy que vende.",
    voice_title: "Voz IA",
    voice_desc: "Genera voces realistas para tus videos.",
    resize_title: "Resize",
    resize_desc: "Redimensiona creativos a cualquier formato.",
    enhancer_title: "Enhancer",
    enhancer_desc: "Mejora calidad de imágenes y videos.",
    captions_title: "Subtítulos",
    captions_desc: "Genera subtítulos automáticos para videos.",
    open: "Abrir",
    soon: "Pronto",
    rel_now: "ahora",
    rel_min: "min atrás",
    rel_h: "h atrás",
    rel_d: "d atrás",
    activity_image_generated: "Imagen generada",
    activity_image_alt: "Imagen",
  },
  zh: {
    kicker: "创作中心",
    main_section: "主要工具",
    support_section: "辅助工具",
    recent_section: "最近活动",
    recent_empty: "暂无活动。开始生成图像。",
    soon_badge: "即将推出",
    img_title: "图像生成器",
    img_desc: "通过提示词在几秒内生成 AI 图像。",
    img_cta: "生成图像",
    board_title: "制作看板",
    board_desc: "管理制作、状态、阶段和截止日期。",
    board_cta: "打开看板",
    transcript_title: "转录",
    transcript_desc: "将视频音频转录为文本。",
    transcript_cta: "转录",
    ab_title: "AB 变体",
    ab_desc: "生成变体以测试并找到最佳版本。",
    ab_cta: "创建变体",
    library_title: "素材库",
    library_desc: "您的创意中心。组织、筛选、查找。",
    library_cta: "打开素材库",
    analytics_title: "分析",
    analytics_desc: "跟踪生成创意的表现。",
    analytics_cta: "查看分析",
    copywriter_title: "文案",
    copywriter_desc: "生成有销售力的文案。",
    voice_title: "AI 配音",
    voice_desc: "为视频生成逼真的语音。",
    resize_title: "调整大小",
    resize_desc: "将创意调整为任意格式。",
    enhancer_title: "增强器",
    enhancer_desc: "提升图像和视频质量。",
    captions_title: "字幕",
    captions_desc: "为视频自动生成字幕。",
    open: "打开",
    soon: "即将推出",
    rel_now: "刚刚",
    rel_min: "分钟前",
    rel_h: "小时前",
    rel_d: "天前",
    activity_image_generated: "图像已生成",
    activity_image_alt: "图像",
  },
};

// ── Tool config ─────────────────────────────────────────────────────────

type ToolDef = {
  id: string;
  titleKey: string;
  descKey: string;
  ctaKey: string;
  icon: typeof ImageIcon;
  color: string;
  route: string;
  status: "live" | "soon";
};

const MAIN_TOOLS: ToolDef[] = [
  { id: "image",      titleKey: "img_title",        descKey: "img_desc",        ctaKey: "img_cta",        icon: ImageIcon,           color: "#a855f7", route: "/dashboard/hub/image",      status: "live" },
  { id: "board",      titleKey: "board_title",      descKey: "board_desc",      ctaKey: "board_cta",      icon: Clapperboard,        color: "#3b82f6", route: "/dashboard/hub/board",      status: "soon" },
  { id: "transcript", titleKey: "transcript_title", descKey: "transcript_desc", ctaKey: "transcript_cta", icon: Video,               color: "#22c55e", route: "/dashboard/hub/transcript", status: "soon" },
  { id: "ab",         titleKey: "ab_title",         descKey: "ab_desc",         ctaKey: "ab_cta",         icon: SplitSquareVertical, color: "#f97316", route: "/dashboard/hub/ab",         status: "soon" },
  { id: "library",    titleKey: "library_title",    descKey: "library_desc",    ctaKey: "library_cta",    icon: FolderOpen,          color: "#14b8a6", route: "/dashboard/hub/library",    status: "live" },
  { id: "analytics",  titleKey: "analytics_title",  descKey: "analytics_desc",  ctaKey: "analytics_cta",  icon: BarChart3,           color: "#eab308", route: "/dashboard/hub/analytics",  status: "soon" },
];

const SUPPORT_TOOLS: ToolDef[] = [
  { id: "copywriter", titleKey: "copywriter_title", descKey: "copywriter_desc", ctaKey: "open", icon: Type,      color: "#8b5cf6", route: "/dashboard/hub/copywriter", status: "soon" },
  { id: "voice",      titleKey: "voice_title",      descKey: "voice_desc",      ctaKey: "soon", icon: Mic,       color: "#3b82f6", route: "/dashboard/hub/voice",      status: "soon" },
  { id: "resize",     titleKey: "resize_title",     descKey: "resize_desc",     ctaKey: "soon", icon: Maximize,  color: "#10b981", route: "/dashboard/hub/resize",     status: "soon" },
  { id: "enhancer",   titleKey: "enhancer_title",   descKey: "enhancer_desc",   ctaKey: "soon", icon: Sparkles,  color: "#f59e0b", route: "/dashboard/hub/enhancer",   status: "soon" },
  { id: "captions",   titleKey: "captions_title",   descKey: "captions_desc",   ctaKey: "soon", icon: Captions,  color: "#ef4444", route: "/dashboard/hub/captions",   status: "soon" },
];

// ── Component ───────────────────────────────────────────────────────────

interface RecentItem {
  id: string;
  type: "image";
  title: string;
  subtitle: string;
  ts: string;
  icon: typeof ImageIcon;
  color: string;
}

export default function BrilliantHub() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang = (["pt", "en", "es", "zh"] as const).includes(language as Lang) ? (language as Lang) : "en";
  const t = (k: string) => STR[lang][k] || STR.en[k] || k;

  const [recent, setRecent] = useState<RecentItem[]>([]);

  // Load recent activity — query real data from creative_memory
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("creative_memory" as any)
          .select("id, type, content, created_at")
          .eq("user_id", user.id)
          .like("type", "hub_%")
          .order("created_at", { ascending: false })
          .limit(3);
        if (!mounted || !data) return;
        const items: RecentItem[] = (data as any[]).map(r => {
          const c = r.content || {};
          return {
            id: r.id,
            type: "image" as const,
            title: (c.prompt || t("activity_image_alt")).slice(0, 60),
            subtitle: t("activity_image_generated"),
            ts: relativeTime(r.created_at, lang),
            icon: ImageIcon,
            color: "#a855f7",
          };
        });
        setRecent(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const onCardClick = (tool: ToolDef) => {
    if (tool.status === "soon") return;
    navigate(tool.route);
  };

  return (
    <>
      <Helmet>
        <title>Hub</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "32px 24px 80px", maxWidth: 1440, margin: "0 auto", color: "#fff" }}>
        {/* Header — minimal, sem copy florido */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Gem size={18} style={{ color: "#a855f7", opacity: 0.85 }} />
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.24em",
              color: "rgba(255,255,255,0.50)",
              margin: 0,
              textTransform: "uppercase",
            }}>
              {t("kicker")}
            </p>
          </div>
        </div>

        {/* Main tools */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.55)", margin: "0 0 14px",
          textTransform: "uppercase",
        }}>{t("main_section")}</p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}>
          {MAIN_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} t={t} onClick={() => onCardClick(tool)} />
          ))}
        </div>

        {/* Support tools + recent activity */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 16,
        }}>
          <div style={{
            borderRadius: 16,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 20,
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)", margin: "0 0 16px",
              textTransform: "uppercase",
            }}>
              {t("support_section")}
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}>
              {SUPPORT_TOOLS.map(tool => (
                <SupportCard key={tool.id} tool={tool} t={t} onClick={() => onCardClick(tool)} />
              ))}
            </div>
          </div>

          <div style={{
            borderRadius: 16,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 20,
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)", margin: "0 0 16px",
              textTransform: "uppercase",
            }}>
              {t("recent_section")}
            </p>
            {recent.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", margin: 0, lineHeight: 1.5 }}>
                {t("recent_empty")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recent.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${item.color}22`,
                        border: `1px solid ${item.color}44`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Icon size={16} style={{ color: item.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 600, color: "#fff",
                          margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{item.title}</p>
                        <p style={{
                          fontSize: 11, color: "rgba(255,255,255,0.50)",
                          margin: "2px 0 0",
                        }}>{item.subtitle}</p>
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{item.ts}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ToolCard({ tool, t, onClick }: { tool: ToolDef; t: (k: string) => string; onClick: () => void }) {
  const Icon = tool.icon;
  const disabled = tool.status === "soon";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        textAlign: "left",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
        opacity: disabled ? 0.65 : 1,
        color: "inherit",
        font: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = `${tool.color}55`;
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.boxShadow = `0 12px 32px ${tool.color}25`;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: `linear-gradient(135deg, ${tool.color}40 0%, ${tool.color}20 100%)`,
        border: `1px solid ${tool.color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 24px ${tool.color}30`,
      }}>
        <Icon size={26} style={{ color: tool.color }} />
      </div>

      {disabled && (
        <span style={{
          position: "absolute", top: 16, right: 16,
          fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
          padding: "3px 8px", borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}>
          {t("soon_badge")}
        </span>
      )}

      <div>
        <h3 style={{
          fontSize: 16, fontWeight: 700,
          color: tool.color,
          letterSpacing: "0.04em",
          margin: "0 0 8px",
          textTransform: "uppercase",
        }}>
          {t(tool.titleKey)}
        </h3>
        <p style={{
          fontSize: 13, color: "rgba(255,255,255,0.62)",
          margin: 0, lineHeight: 1.5,
        }}>
          {t(tool.descKey)}
        </p>
      </div>

      <div style={{
        marginTop: "auto",
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${tool.color}40`,
        background: `${tool.color}10`,
        textAlign: "center",
        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
        color: tool.color,
        textTransform: "uppercase",
      }}>
        {t(tool.ctaKey)}
      </div>
    </button>
  );
}

function SupportCard({ tool, t, onClick }: { tool: ToolDef; t: (k: string) => string; onClick: () => void }) {
  const Icon = tool.icon;
  const disabled = tool.status === "soon";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "12px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.15s ease, border-color 0.15s ease",
        opacity: disabled ? 0.55 : 1,
        color: "inherit",
        font: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = `${tool.color}55`;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: `${tool.color}22`,
        border: `1px solid ${tool.color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={14} style={{ color: tool.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: 700,
          color: "#fff", margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>{t(tool.titleKey)}</p>
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.50)",
          margin: "2px 0 0", lineHeight: 1.35,
        }}>{t(tool.descKey)}</p>
      </div>
    </button>
  );
}

function relativeTime(iso: string, lang: Lang): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    if (min < 1) return STR[lang].rel_now;
    if (min < 60) return `${min}${lang === "zh" ? "" : " "}${STR[lang].rel_min}`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}${lang === "zh" ? "" : " "}${STR[lang].rel_h}`;
    const d = Math.round(h / 24);
    return `${d}${lang === "zh" ? "" : " "}${STR[lang].rel_d}`;
  } catch { return ""; }
}
