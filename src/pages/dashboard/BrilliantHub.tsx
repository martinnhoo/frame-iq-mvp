/**
 * BrilliantHub — Painel principal do Hub interno (AdBrief).
 *
 * Layout segue o spec UX:
 *   - Header: "Bem-vindo de volta, {Nome} 👋"
 *   - Grid 3-col: 3 cards Designer + 3 cards Ferramentas
 *   - Biblioteca full-width abaixo
 *   - Paleta azul #3B82F6 (sem roxo)
 *   - Background radial gradient escuro
 *   - i18n total: pt/en/es/zh
 *
 * Tools "Em breve": Gerador de PNG, Editor de Vídeo, Transcrição,
 * Variações AB, Analytics. Apenas Gerador de Imagem e Biblioteca
 * estão funcionais hoje.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Image as ImageIcon, Layers, Clapperboard, Mic, Captions, GitBranch, BarChart3,
  FolderOpen, ArrowRight, Sparkles, GalleryHorizontal, Video as VideoIcon,
} from "lucide-react";

type Lang = "pt" | "en" | "es" | "zh";

const STR: Record<string, Record<Lang, string>> = {
  hello:        { pt: "Bem-vindo de volta",          en: "Welcome back",                es: "Bienvenido de vuelta",         zh: "欢迎回来" },
  subtitle:     { pt: "Centralize, crie e organize seus ativos com IA.",
                  en: "Centralize, create and organize your assets with AI.",
                  es: "Centraliza, crea y organiza tus activos con IA.",
                  zh: "使用 AI 集中、创建和组织您的资产。" },
  // Section labels (nova organização)
  automation:   { pt: "Automação",                    en: "Automation",                  es: "Automatización",                zh: "自动化" },
  create:       { pt: "Criar",                        en: "Create",                      es: "Crear",                         zh: "创建" },
  sequences:    { pt: "Sequências",                   en: "Sequences",                   es: "Secuencias",                    zh: "序列" },
  intelligence: { pt: "Inteligência",                 en: "Intelligence",                es: "Inteligencia",                  zh: "智能" },
  library:      { pt: "Biblioteca",                   en: "Library",                     es: "Biblioteca",                    zh: "资源库" },
  comingSoon:   { pt: "Em breve",                     en: "Coming soon",                 es: "Próximamente",                  zh: "即将推出" },
  // Workflow card hero
  wfTitle:      { pt: "Workflows",                    en: "Workflows",                   es: "Workflows",                     zh: "工作流" },
  wfDesc:       { pt: "Pipelines reutilizáveis: marca + prompt → criativo pronto em 1 clique. Estilo Higgsfield Canvas.",
                  en: "Reusable pipelines: brand + prompt → ready creative in 1 click. Higgsfield Canvas style.",
                  es: "Pipelines reutilizables: marca + prompt → creativo listo en 1 clic. Estilo Higgsfield Canvas.",
                  zh: "可重复使用的管道：品牌 + 提示词 → 一键生成创意。" },
  wfBtn:        { pt: "Abrir Workflows",              en: "Open Workflows",              es: "Abrir Workflows",               zh: "打开工作流" },
  imgGen:       { pt: "Gerador de Imagem",            en: "Image Generator",             es: "Generador de Imágenes",        zh: "图像生成器" },
  imgGenDesc:   { pt: "Crie imagens com IA em segundos com base no seu prompt.",
                  en: "Create AI images in seconds based on your prompt.",
                  es: "Crea imágenes con IA en segundos basadas en tu prompt.",
                  zh: "根据您的提示词在几秒内生成 AI 图像。" },
  imgGenBtn:    { pt: "Gerar Imagem",                 en: "Generate Image",              es: "Generar Imagen",               zh: "生成图像" },
  pngGen:       { pt: "Gerador de PNG",               en: "PNG Generator",               es: "Generador de PNG",             zh: "PNG 生成器" },
  pngGenDesc:   { pt: "Remova fundos, gere imagens em PNG e exporte com transparência.",
                  en: "Remove backgrounds, generate PNG images and export with transparency.",
                  es: "Elimina fondos, genera imágenes PNG y exporta con transparencia.",
                  zh: "去除背景、生成 PNG 图像并导出透明。" },
  pngGenBtn:    { pt: "Gerar PNG",                    en: "Generate PNG",                es: "Generar PNG",                  zh: "生成 PNG" },
  storyboard:   { pt: "Storyboard",                   en: "Storyboard",                   es: "Storyboard",                   zh: "故事板" },
  storyboardDesc: { pt: "Roteiro vira sequência de imagens contínuas — pra usar no editor de vídeo.",
                  en: "Script becomes a continuous image sequence — to use in your video editor.",
                  es: "El guión se convierte en una secuencia continua de imágenes para tu editor de video.",
                  zh: "剧本转化为连续图像序列 — 可在视频编辑器中使用。" },
  storyboardBtn: { pt: "Criar storyboard",            en: "Create storyboard",            es: "Crear storyboard",             zh: "创建故事板" },
  transcribe:   { pt: "Transcrição",                  en: "Transcription",               es: "Transcripción",                zh: "转录" },
  transcribeDesc: { pt: "Transcreva áudios dos seus vídeos para texto.",
                  en: "Transcribe audio from your videos to text.",
                  es: "Transcribe audio de tus videos a texto.",
                  zh: "将视频音频转录为文本。" },
  transcribeBtn: { pt: "Transcrever",                 en: "Transcribe",                  es: "Transcribir",                  zh: "转录" },
  voice:        { pt: "Gerador de Voz",               en: "Voice Generator",             es: "Generador de Voz",             zh: "语音生成器" },
  voiceDesc:    { pt: "Texto vira áudio profissional via ElevenLabs.",
                  en: "Turn text into professional audio with ElevenLabs.",
                  es: "Convierte texto en audio profesional con ElevenLabs.",
                  zh: "通过 ElevenLabs 将文本转换为专业音频。" },
  voiceBtn:     { pt: "Gerar voz",                    en: "Generate voice",              es: "Generar voz",                  zh: "生成语音" },
  abVar:        { pt: "Variações AB",                 en: "A/B Variants",                es: "Variantes A/B",                zh: "A/B 变体" },
  abVarDesc:    { pt: "Gere variações para testar e encontrar a melhor.",
                  en: "Generate variants to test and find the best.",
                  es: "Genera variantes para probar y encontrar la mejor.",
                  zh: "生成变体以测试并找到最佳版本。" },
  abVarBtn:     { pt: "Criar variações",              en: "Create variants",             es: "Crear variantes",              zh: "创建变体" },
  analytics:    { pt: "Analytics",                    en: "Analytics",                   es: "Analítica",                    zh: "数据分析" },
  analyticsDesc:{ pt: "Acompanhe o desempenho dos criativos gerados.",
                  en: "Track the performance of generated creatives.",
                  es: "Sigue el rendimiento de los creativos generados.",
                  zh: "跟踪生成创意的表现。" },
  analyticsBtn: { pt: "Ver analytics",                en: "View analytics",              es: "Ver analítica",                zh: "查看分析" },
  libraryDesc:  { pt: "Sua central de criativos. Organize, filtre e encontre seus arquivos.",
                  en: "Your creative hub. Organize, filter and find your files.",
                  es: "Tu central de creativos. Organiza, filtra y encuentra tus archivos.",
                  zh: "您的创意中心。组织、筛选和查找您的文件。" },
  libraryBtn:   { pt: "Acessar biblioteca",           en: "Open library",                es: "Abrir biblioteca",             zh: "打开资源库" },
  emptyTitle:   { pt: "Comece criando seu primeiro ativo",
                  en: "Start by creating your first asset",
                  es: "Comienza creando tu primer activo",
                  zh: "开始创建您的第一个资产" },
  emptyDesc:    { pt: "Use o Gerador de Imagem pra criar criativos com IA em segundos.",
                  en: "Use the Image Generator to create AI creatives in seconds.",
                  es: "Usa el Generador de Imágenes para crear creativos con IA en segundos.",
                  zh: "使用图像生成器在几秒内创建 AI 创意。" },
  emptyBtn:     { pt: "Gerar imagem",                 en: "Generate image",              es: "Generar imagen",               zh: "生成图像" },
  // Counter na Biblioteca — sensação de valor acumulado
  libCount0:    { pt: "Sem criativos ainda",          en: "No creatives yet",            es: "Sin creativos aún",            zh: "尚无创意" },
  libCount1:    { pt: "1 criativo armazenado",        en: "1 asset stored",              es: "1 creativo almacenado",        zh: "已存储 1 个资产" },
  libCountN:    { pt: "{n} criativos armazenados",    en: "{n} assets stored",           es: "{n} creativos almacenados",    zh: "已存储 {n} 个资产" },
};

export default function BrilliantHub() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [userName, setUserName] = useState<string>("");
  const [assetCount, setAssetCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted || !user) return;
        const meta = (user.user_metadata || {}) as { full_name?: string; name?: string };
        const name = meta.full_name || meta.name || (user.email?.split("@")[0]) || "";
        setUserName(capitalize(name.split(" ")[0]));

        // Conta assets do Hub — usado pro empty state + counter na Biblioteca.
        const { count } = await supabase
          .from("hub_assets" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (mounted) setAssetCount(count || 0);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Mensagem de contador da Biblioteca (com pluralização e i18n)
  const libraryMeta: string | null = (() => {
    if (assetCount === null) return null;
    if (assetCount === 0) return t("libCount0");
    if (assetCount === 1) return t("libCount1");
    return t("libCountN").replace("{n}", String(assetCount));
  })();

  // ── Criar: geradores de UM asset único ─────────────────────────
  const createTools = [
    { id: "img", title: t("imgGen"), desc: t("imgGenDesc"), btn: t("imgGenBtn"),
      icon: ImageIcon, route: "/dashboard/hub/image", featured: true },
    { id: "png", title: t("pngGen"), desc: t("pngGenDesc"), btn: t("pngGenBtn"),
      icon: Layers, route: "/dashboard/hub/png" },
    { id: "video",
      title: lang === "pt" ? "Gerador de Vídeo" : lang === "es" ? "Generador de Video" : lang === "zh" ? "视频生成器" : "Video Generator",
      desc: lang === "pt" ? "Texto ou imagem viram vídeo via Kling 3.0. 5-15s, 720p ou 1080p."
        : lang === "es" ? "Texto o imagen se convierten en video vía Kling 3.0. 5-15s, 720p o 1080p."
        : lang === "zh" ? "文本或图像通过 Kling 3.0 转化为视频。"
        : "Text or image becomes video via Kling 3.0. 5-15s, 720p or 1080p.",
      btn: lang === "pt" ? "Gerar vídeo" : lang === "es" ? "Generar video" : lang === "zh" ? "生成视频" : "Generate video",
      icon: VideoIcon, route: "/dashboard/hub/video", featured: true },
    { id: "voice", title: t("voice"), desc: t("voiceDesc"), btn: t("voiceBtn"),
      icon: Mic, route: "/dashboard/hub/voice" },
  ];

  // ── Sequências: outputs múltiplos (storyboard, carrossel, AB) ─────
  const sequenceTools = [
    { id: "storyboard", title: t("storyboard"), desc: t("storyboardDesc"), btn: t("storyboardBtn"),
      icon: Clapperboard, route: "/dashboard/hub/storyboard" },
    { id: "carousel",
      title: lang === "pt" ? "Carrossel" : lang === "es" ? "Carrusel" : lang === "zh" ? "轮播" : "Carousel",
      desc: lang === "pt" ? "Roteiro vira carrossel — slides quadrados pra Insta, LinkedIn." : lang === "es" ? "El guión se convierte en un carrusel — slides cuadrados para Instagram, LinkedIn." : lang === "zh" ? "剧本转化为轮播 — 适用于 Instagram 的方形幻灯片。" : "Script becomes a carousel — square slides for Instagram, LinkedIn.",
      btn: lang === "pt" ? "Criar carrossel" : lang === "es" ? "Crear carrusel" : lang === "zh" ? "创建轮播" : "Create carousel",
      icon: GalleryHorizontal, route: "/dashboard/hub/carousel" },
    { id: "ab", title: t("abVar"), desc: t("abVarDesc"), btn: t("abVarBtn"),
      icon: GitBranch, route: "/dashboard/hub/ab" },
  ];

  // ── Inteligência: análise + transcrição ────────────────────────
  const intelligenceTools = [
    { id: "transcribe", title: t("transcribe"), desc: t("transcribeDesc"), btn: t("transcribeBtn"),
      icon: Captions, route: "/dashboard/hub/transcribe" },
    { id: "analytics", title: t("analytics"), desc: t("analyticsDesc"), btn: t("analyticsBtn"),
      icon: BarChart3, route: "/dashboard/hub/analytics" },
  ];

  return (
    <>
      <Helmet>
        <title>Painel — Hub</title>
      </Helmet>

      <div style={{
        minHeight: "calc(100vh - 0px)",
        background: "radial-gradient(circle at top, #0B1220 0%, #05070D 60%, #03050A 100%)",
        padding: "28px 32px 64px",
        color: "#fff",
      }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: "#FFFFFF", margin: 0,
            letterSpacing: "-0.02em", lineHeight: 1.2,
          }}>
            {t("hello")}{userName ? `, ${userName}` : ""} <span>👋</span>
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", margin: "8px 0 0", lineHeight: 1.5 }}>
            {t("subtitle")}
          </p>
        </div>

        {/* ── AUTOMAÇÃO: Workflows como hero (full width, destaque máximo) ── */}
        <p style={SECTION_LABEL}><span style={SECTION_BAR} />{t("automation")}</p>
        <ToolCard
          icon={Sparkles}
          title={t("wfTitle")}
          desc={t("wfDesc")}
          btn={t("wfBtn")}
          fullWidth
          featured
          comingSoonLabel={t("comingSoon")}
          onClick={() => navigate("/dashboard/hub/workflows")}
        />

        {/* ── CRIAR: geradores de asset único ──────────────────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 32 }}><span style={SECTION_BAR} />{t("create")}</p>
        <div style={GRID_3}>
          {createTools.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              desc={tool.desc}
              btn={tool.btn}
              soon={(tool as { soon?: boolean }).soon}
              featured={(tool as { featured?: boolean }).featured}
              comingSoonLabel={t("comingSoon")}
              onClick={tool.route ? () => navigate(tool.route) : undefined}
            />
          ))}
        </div>

        {/* ── SEQUÊNCIAS: outputs múltiplos ────────────────────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 32 }}><span style={SECTION_BAR} />{t("sequences")}</p>
        <div style={GRID_3}>
          {sequenceTools.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              desc={tool.desc}
              btn={tool.btn}
              soon={(tool as { soon?: boolean }).soon}
              comingSoonLabel={t("comingSoon")}
              onClick={tool.route ? () => navigate(tool.route) : undefined}
            />
          ))}
        </div>

        {/* ── INTELIGÊNCIA: análise + utilitários de dados ─────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 32 }}><span style={SECTION_BAR} />{t("intelligence")}</p>
        <div style={GRID_3}>
          {intelligenceTools.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              desc={tool.desc}
              btn={tool.btn}
              soon={(tool as { soon?: boolean }).soon}
              comingSoonLabel={t("comingSoon")}
              onClick={tool.route ? () => navigate(tool.route) : undefined}
            />
          ))}
        </div>

        {/* ── BIBLIOTECA (full width, no rodapé) ─────────────────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 32 }}><span style={SECTION_BAR} />{t("library")}</p>
        <ToolCard
          icon={FolderOpen}
          title={t("library")}
          desc={t("libraryDesc")}
          btn={t("libraryBtn")}
          fullWidth
          meta={libraryMeta}
          comingSoonLabel={t("comingSoon")}
          onClick={() => navigate("/dashboard/hub/library")}
        />
      </div>
    </>
  );
}

// ── ToolCard ──────────────────────────────────────────────────────────────
interface ToolCardProps {
  icon: typeof ImageIcon;
  title: string;
  desc: string;
  btn: string;
  soon?: boolean;
  fullWidth?: boolean;
  featured?: boolean;
  meta?: string | null;
  comingSoonLabel: string;
  onClick?: () => void;
}

function ToolCard({ icon: Icon, title, desc, btn, soon, fullWidth, featured, meta, comingSoonLabel, onClick }: ToolCardProps) {
  const [hover, setHover] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [btnActive, setBtnActive] = useState(false);
  const interactive = !!onClick && !soon;

  // Featured: tint azul sutil pra direcionar atenção (Image Generator é
  // a ação dominante). Não exagera — só um empurrão visual.
  const baseBg = featured && !soon ? "rgba(59,130,246,0.08)" : "rgba(17,24,39,0.70)";
  const baseBorder = featured && !soon ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)";

  return (
    <div
      onClick={interactive ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        gridColumn: fullWidth ? "1 / -1" : "auto",
        background: baseBg,
        border: `1px solid ${hover && interactive ? "rgba(59,130,246,0.40)" : baseBorder}`,
        borderRadius: 16,
        padding: "22px 22px 20px",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        transition: "border-color 0.18s, transform 0.18s, background 0.18s",
        transform: hover && interactive ? "translateY(-2px)" : "translateY(0)",
        cursor: interactive ? "pointer" : "default",
        opacity: soon ? 0.55 : 1,
        overflow: "hidden",
      }}
    >
      {soon && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#9CA3AF",
        }}>
          {comingSoonLabel}
        </div>
      )}

      {/* Ícone — peso forte, presença visual */}
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: soon ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.12)",
        border: `1px solid rgba(59,130,246,${soon ? 0.15 : 0.25})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        <Icon size={24} strokeWidth={2} style={{ color: "#3B82F6" }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", margin: "6px 0 18px", lineHeight: 1.55, maxWidth: fullWidth ? 580 : "100%" }}>
        {desc}
      </p>

      {/* Meta — counter da Biblioteca etc */}
      {meta && (
        <p style={{
          fontSize: 11, fontWeight: 600, color: "#3B82F6",
          margin: "-12px 0 16px", letterSpacing: "0.02em",
        }}>
          {meta}
        </p>
      )}

      <button
        onClick={interactive ? (e) => { e.stopPropagation(); onClick?.(); } : (e) => e.preventDefault()}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => { setBtnHover(false); setBtnActive(false); }}
        onMouseDown={() => setBtnActive(true)}
        onMouseUp={() => setBtnActive(false)}
        disabled={soon}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 18px",
          borderRadius: 10,
          background: soon
            ? "rgba(75,85,99,0.40)"
            : btnActive ? "#1D4ED8"
            : btnHover ? "#2563EB"
            : "#3B82F6",
          color: soon ? "#9CA3AF" : "#fff",
          border: "none",
          fontSize: 13, fontWeight: 600,
          cursor: soon ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transform: btnActive && !soon ? "scale(0.97)" : "scale(1)",
          transition: "background 0.12s, transform 0.10s",
        }}
      >
        {btn} <ArrowRight size={13} />
      </button>
    </div>
  );
}

const SECTION_LABEL: React.CSSProperties = {
  // Header forte — uppercase + letter-spacing + barrinha azul antes
  // pra ficar claramente "section divider" mesmo no fundo escuro.
  fontSize: 12, fontWeight: 800, color: "#FFFFFF",
  textTransform: "uppercase",
  letterSpacing: "0.10em",
  margin: "0 0 14px",
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const SECTION_BAR: React.CSSProperties = {
  display: "inline-block",
  width: 3, height: 14,
  background: "#3B82F6",
  borderRadius: 2,
};

const GRID_3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ title, desc, btnLabel, onClick }: {
  title: string; desc: string; btnLabel: string; onClick: () => void;
}) {
  const [btnHover, setBtnHover] = useState(false);
  const [btnActive, setBtnActive] = useState(false);

  return (
    <div style={{
      background: "rgba(17, 24, 39, 0.55)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      padding: "64px 28px",
      marginBottom: 32,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", gap: 18,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(59,130,246,0.12)",
        border: "1px solid rgba(59,130,246,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Sparkles size={30} strokeWidth={2} style={{ color: "#3B82F6" }} />
      </div>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: "#D1D5DB", margin: "8px 0 0", maxWidth: 420, lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
      <button
        onClick={onClick}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => { setBtnHover(false); setBtnActive(false); }}
        onMouseDown={() => setBtnActive(true)}
        onMouseUp={() => setBtnActive(false)}
        style={{
          marginTop: 6,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "12px 24px",
          borderRadius: 11,
          background: btnActive ? "#1D4ED8" : btnHover ? "#2563EB" : "#3B82F6",
          color: "#fff",
          border: "none",
          fontSize: 14, fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          transform: btnActive ? "scale(0.97)" : "scale(1)",
          transition: "background 0.12s, transform 0.10s",
        }}
      >
        {btnLabel} <ArrowRight size={14} />
      </button>
    </div>
  );
}
