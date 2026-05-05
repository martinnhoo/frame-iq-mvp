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
  Image as ImageIcon, Layers, Film, Mic, GitBranch, BarChart3,
  FolderOpen, ArrowRight,
} from "lucide-react";

type Lang = "pt" | "en" | "es" | "zh";

const STR: Record<string, Record<Lang, string>> = {
  hello:        { pt: "Bem-vindo de volta",          en: "Welcome back",                es: "Bienvenido de vuelta",         zh: "欢迎回来" },
  subtitle:     { pt: "Centralize, crie e organize seus ativos com IA.",
                  en: "Centralize, create and organize your assets with AI.",
                  es: "Centraliza, crea y organiza tus activos con IA.",
                  zh: "使用 AI 集中、创建和组织您的资产。" },
  designer:     { pt: "Designer",                     en: "Designer",                    es: "Designer",                     zh: "设计" },
  tools:        { pt: "Ferramentas",                  en: "Tools",                       es: "Herramientas",                 zh: "工具" },
  library:      { pt: "Biblioteca",                   en: "Library",                     es: "Biblioteca",                   zh: "资源库" },
  comingSoon:   { pt: "Em breve",                     en: "Coming soon",                 es: "Próximamente",                 zh: "即将推出" },
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
  vidEdit:      { pt: "Editor de Vídeo",              en: "Video Editor",                es: "Editor de Video",              zh: "视频编辑器" },
  vidEditDesc:  { pt: "Edite seus vídeos com ferramentas profissionais e IA integrada.",
                  en: "Edit your videos with professional tools and integrated AI.",
                  es: "Edita tus videos con herramientas profesionales e IA integrada.",
                  zh: "使用专业工具和集成 AI 编辑您的视频。" },
  transcribe:   { pt: "Transcrição",                  en: "Transcription",               es: "Transcripción",                zh: "转录" },
  transcribeDesc: { pt: "Transcreva áudios dos seus vídeos para texto.",
                  en: "Transcribe audio from your videos to text.",
                  es: "Transcribe audio de tus videos a texto.",
                  zh: "将视频音频转录为文本。" },
  transcribeBtn: { pt: "Transcrever",                 en: "Transcribe",                  es: "Transcribir",                  zh: "转录" },
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
};

export default function BrilliantHub() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted || !user) return;
        const meta = (user.user_metadata || {}) as { full_name?: string; name?: string };
        const name = meta.full_name || meta.name || (user.email?.split("@")[0]) || "";
        setUserName(capitalize(name.split(" ")[0]));
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  const designerTools = [
    { id: "img", title: t("imgGen"), desc: t("imgGenDesc"), btn: t("imgGenBtn"),
      icon: ImageIcon, route: "/dashboard/hub/image" },
    { id: "png", title: t("pngGen"), desc: t("pngGenDesc"), btn: t("pngGenBtn"),
      icon: Layers, soon: true },
    { id: "video", title: t("vidEdit"), desc: t("vidEditDesc"), btn: t("comingSoon"),
      icon: Film, soon: true },
  ];

  const supportTools = [
    { id: "transcribe", title: t("transcribe"), desc: t("transcribeDesc"), btn: t("transcribeBtn"),
      icon: Mic, soon: true },
    { id: "ab", title: t("abVar"), desc: t("abVarDesc"), btn: t("abVarBtn"),
      icon: GitBranch, soon: true },
    { id: "analytics", title: t("analytics"), desc: t("analyticsDesc"), btn: t("analyticsBtn"),
      icon: BarChart3, soon: true },
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
            fontSize: 26, fontWeight: 700, color: "#fff", margin: 0,
            letterSpacing: "-0.02em", lineHeight: 1.2,
          }}>
            {t("hello")}{userName ? `, ${userName}` : ""} <span>👋</span>
          </h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", margin: "6px 0 0", lineHeight: 1.5 }}>
            {t("subtitle")}
          </p>
        </div>

        {/* ── Designer ─────────────────────────────────────────── */}
        <p style={SECTION_LABEL}>{t("designer")}</p>
        <div style={GRID_3}>
          {designerTools.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              desc={tool.desc}
              btn={tool.btn}
              soon={tool.soon}
              comingSoonLabel={t("comingSoon")}
              onClick={tool.route ? () => navigate(tool.route) : undefined}
            />
          ))}
        </div>

        {/* ── Ferramentas ──────────────────────────────────────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 28 }}>{t("tools")}</p>
        <div style={GRID_3}>
          {supportTools.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              desc={tool.desc}
              btn={tool.btn}
              soon={tool.soon}
              comingSoonLabel={t("comingSoon")}
            />
          ))}
        </div>

        {/* ── Biblioteca (full width) ──────────────────────────── */}
        <p style={{ ...SECTION_LABEL, marginTop: 28 }}>{t("library")}</p>
        <ToolCard
          icon={FolderOpen}
          title={t("library")}
          desc={t("libraryDesc")}
          btn={t("libraryBtn")}
          fullWidth
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
  comingSoonLabel: string;
  onClick?: () => void;
}

function ToolCard({ icon: Icon, title, desc, btn, soon, fullWidth, comingSoonLabel, onClick }: ToolCardProps) {
  const [hover, setHover] = useState(false);
  const interactive = !!onClick && !soon;

  return (
    <div
      onClick={interactive ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        gridColumn: fullWidth ? "1 / -1" : "auto",
        background: "rgba(17, 24, 39, 0.70)",
        border: `1px solid ${hover && interactive ? "rgba(59,130,246,0.40)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 16,
        padding: "22px 22px 20px",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        transition: "border-color 0.18s, transform 0.18s, box-shadow 0.18s",
        transform: hover && interactive ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover && interactive ? "0 8px 28px rgba(59,130,246,0.18)" : "0 1px 0 rgba(255,255,255,0.02)",
        cursor: interactive ? "pointer" : "default",
        opacity: soon ? 0.72 : 1,
        overflow: "hidden",
      }}
    >
      {soon && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#9CA3AF",
        }}>
          {comingSoonLabel}
        </div>
      )}

      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: soon ? "rgba(59,130,246,0.10)" : "rgba(59,130,246,0.14)",
        border: `1px solid rgba(59,130,246,${soon ? 0.20 : 0.30})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        <Icon size={20} style={{ color: "#3B82F6" }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "#9CA3AF", margin: "6px 0 16px", lineHeight: 1.55, maxWidth: fullWidth ? 580 : "100%" }}>
        {desc}
      </p>

      <button
        onClick={interactive ? (e) => { e.stopPropagation(); onClick?.(); } : (e) => e.preventDefault()}
        disabled={soon}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 16px",
          borderRadius: 10,
          background: soon
            ? "rgba(75,85,99,0.45)"
            : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
          color: soon ? "#9CA3AF" : "#fff",
          border: "none",
          fontSize: 13, fontWeight: 600,
          cursor: soon ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          boxShadow: soon ? "none" : "0 4px 14px rgba(59,130,246,0.30)",
          transition: "all 0.15s",
        }}
      >
        {btn} <ArrowRight size={13} />
      </button>
    </div>
  );
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "#FFFFFF",
  margin: "0 0 14px", letterSpacing: "-0.01em",
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
