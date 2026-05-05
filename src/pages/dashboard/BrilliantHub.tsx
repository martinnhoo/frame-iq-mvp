// BrilliantHub — Central criativa interna da Brilliant Gaming.
//
// Estratégia: pivô do AdBrief de SaaS público pra hub interno multi-marca.
// Outras rotas (/feed, /ai, /history, /accounts) ficam acessíveis via URL
// direta mas escondidas do menu — preserva opcionalidade de re-ativar
// SaaS no futuro sem deletar nada.
//
// Layout: 8 ferramentas principais (4×2) + 5 ferramentas de apoio (5×1)
// + painel de atividades recentes lateral. Cada card abre o tool
// correspondente. Todos respeitam o selectedPersona pra brand consistency
// (logo, paleta, tom).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import {
  Image as ImageIcon, Clapperboard, Video, SplitSquareVertical,
  FolderOpen, Tag, BarChart3, Lightbulb,
  Type, Mic, Maximize, Sparkles, Captions,
  Gem,
} from "lucide-react";

// ── Tools config ────────────────────────────────────────────────────────
// Cada tool: id (route param), title, desc, icon, color hex (gradient base),
// route (onde leva), status ('live' | 'soon'). Cards "soon" ficam mais
// apagados e mostram badge "Em breve".

type Tool = {
  id: string;
  title: string;
  desc: string;
  icon: typeof ImageIcon;
  color: string; // hex base
  route: string;
  status: "live" | "soon";
  cta: string;
};

const MAIN_TOOLS: Tool[] = [
  {
    id: "image",
    title: "Image Generator",
    desc: "Gere imagens com IA em segundos com base no seu prompt ou referências.",
    icon: ImageIcon,
    color: "#a855f7",
    route: "/dashboard/hub/image",
    status: "soon",
    cta: "Gerar imagem",
  },
  {
    id: "board",
    title: "Production Board",
    desc: "Organize suas produções, acompanhe status, etapas e prazos dos criativos.",
    icon: Clapperboard,
    color: "#3b82f6",
    route: "/dashboard/boards",
    status: "live",
    cta: "Acessar board",
  },
  {
    id: "transcript",
    title: "Transcript de Vídeo",
    desc: "Transcreva o áudio dos seus vídeos automaticamente para texto em segundos.",
    icon: Video,
    color: "#22c55e",
    route: "/dashboard/translate",
    status: "live",
    cta: "Transcrever",
  },
  {
    id: "ab",
    title: "AB Variants",
    desc: "Crie variações de anúncios automaticamente para testar e encontrar o melhor resultado.",
    icon: SplitSquareVertical,
    color: "#f97316",
    route: "/dashboard/hub/ab",
    status: "soon",
    cta: "Criar variações",
  },
  {
    id: "library",
    title: "Biblioteca",
    desc: "Sua central de criativos. Organize, filtre e encontre qualquer peça rapidamente.",
    icon: FolderOpen,
    color: "#14b8a6",
    route: "/dashboard/intelligence",
    status: "live",
    cta: "Acessar biblioteca",
  },
  {
    id: "templates",
    title: "Templates",
    desc: "Use templates prontos e validados para acelerar suas produções.",
    icon: Tag,
    color: "#ec4899",
    route: "/dashboard/templates",
    status: "live",
    cta: "Ver templates",
  },
  {
    id: "analytics",
    title: "Analytics",
    desc: "Acompanhe o desempenho dos seus criativos e descubra insights poderosos.",
    icon: BarChart3,
    color: "#eab308",
    route: "/dashboard/performance",
    status: "live",
    cta: "Ver analytics",
  },
  {
    id: "ideas",
    title: "Idea Generator",
    desc: "Gere ideias de ângulos, headlines e conceitos baseados em dados e tendências.",
    icon: Lightbulb,
    color: "#a855f7",
    route: "/dashboard/hooks",
    status: "live",
    cta: "Gerar ideias",
  },
];

const SUPPORT_TOOLS: Tool[] = [
  {
    id: "copywriter",
    title: "Copywriter",
    desc: "Gere copies que vendem.",
    icon: Type,
    color: "#8b5cf6",
    route: "/dashboard/hooks",
    status: "live",
    cta: "Abrir",
  },
  {
    id: "voice",
    title: "Narração IA",
    desc: "Gere vozes realistas para seus vídeos.",
    icon: Mic,
    color: "#3b82f6",
    route: "/dashboard/hub/voice",
    status: "soon",
    cta: "Em breve",
  },
  {
    id: "resize",
    title: "Resize",
    desc: "Redimensione seus criativos para qualquer formato.",
    icon: Maximize,
    color: "#10b981",
    route: "/dashboard/hub/resize",
    status: "soon",
    cta: "Em breve",
  },
  {
    id: "enhancer",
    title: "Enhancer",
    desc: "Melhore a qualidade das suas imagens e vídeos.",
    icon: Sparkles,
    color: "#f59e0b",
    route: "/dashboard/hub/enhancer",
    status: "soon",
    cta: "Em breve",
  },
  {
    id: "captions",
    title: "Legendas",
    desc: "Gere legendas automáticas para seus vídeos.",
    icon: Captions,
    color: "#ef4444",
    route: "/dashboard/hub/captions",
    status: "soon",
    cta: "Em breve",
  },
];

// ── Component ───────────────────────────────────────────────────────────

export default function BrilliantHub() {
  const navigate = useNavigate();
  const ctx = useOutletContext<DashboardContext>();
  const personaName = ctx?.selectedPersona?.name || null;

  const [recent, setRecent] = useState<Array<{ icon: typeof ImageIcon; color: string; title: string; subtitle: string; ts: string }>>([]);

  // ── Load recent activity ──────────────────────────────────────────────
  // Pulls from creative_memory + video_analysis + ab_variants tables.
  // For v1 stub: hard-coded mock — wire to Supabase queries later.
  useEffect(() => {
    setRecent([
      { icon: ImageIcon, color: "#a855f7", title: "Banner Cashback 10% — V3", subtitle: "Imagem gerada", ts: "2 min atrás" },
      { icon: Video, color: "#3b82f6", title: "Vídeo Aposta Esportiva", subtitle: "Transcrição concluída", ts: "15 min atrás" },
      { icon: SplitSquareVertical, color: "#ec4899", title: "AB Variant — Promo Verão", subtitle: "3 variações criadas", ts: "1 hora atrás" },
    ]);
  }, []);

  const onCardClick = (tool: Tool) => {
    if (tool.status === "soon") return;
    navigate(tool.route);
  };

  return (
    <>
      <Helmet>
        <title>Brilliant Hub — Central Criativa</title>
        <meta name="description" content="Central criativa da Brilliant Gaming. Tudo que você precisa para criar, organizar e otimizar criativos de alta performance." />
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "32px 24px 80px", maxWidth: 1440, margin: "0 auto", color: "#fff" }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <Gem size={36} style={{ color: "#a855f7", filter: "drop-shadow(0 0 12px rgba(168,85,247,0.5))" }} />
            <h1 style={{
              fontSize: "clamp(28px, 4.5vw, 44px)",
              fontWeight: 900,
              letterSpacing: "0.06em",
              margin: 0,
              background: "linear-gradient(90deg, #ffffff 0%, #a855f7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              BRILLIANT <span style={{ color: "#a855f7" }}>HUB</span>
            </h1>
          </div>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.32em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 12px",
            textTransform: "uppercase",
          }}>
            Central Criativa{personaName ? ` · ${personaName}` : ""}
          </p>
          <p style={{
            fontSize: "clamp(14px, 1.5vw, 16px)",
            color: "rgba(255,255,255,0.65)",
            margin: 0,
            maxWidth: 680,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.55,
          }}>
            Tudo que você precisa para criar, organizar e otimizar criativos de alta performance.
          </p>
        </div>

        {/* ── Main 8 tools grid (4×2) ─────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}>
          {MAIN_TOOLS.map(tool => (
            <ToolCard key={tool.id} tool={tool} onClick={() => onCardClick(tool)} />
          ))}
        </div>

        {/* ── Bottom row: support tools + recent activity ─────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 16,
          marginBottom: 32,
        }}>
          {/* Support tools */}
          <div style={{
            borderRadius: 16,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 20,
          }}>
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)",
              margin: "0 0 16px",
              textTransform: "uppercase",
            }}>
              Ferramentas de apoio
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}>
              {SUPPORT_TOOLS.map(tool => (
                <SupportCard key={tool.id} tool={tool} onClick={() => onCardClick(tool)} />
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div style={{
            borderRadius: 16,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: 20,
          }}>
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.55)",
              margin: "0 0 16px",
              textTransform: "uppercase",
            }}>
              Atividades recentes
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recent.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          </div>
        </div>

        {/* ── Footer tagline ─────────────────────────────────────────── */}
        <div style={{
          textAlign: "center",
          padding: "20px 24px",
          borderRadius: 12,
          background: "rgba(168,85,247,0.06)",
          border: "1px solid rgba(168,85,247,0.18)",
        }}>
          <p style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.20em",
            color: "rgba(255,255,255,0.55)",
            margin: 0,
            textTransform: "uppercase",
          }}>
            <Gem size={14} style={{ color: "#a855f7" }} />
            Criatividade · Dados · Resultados · Tudo em um só lugar
          </p>
        </div>
      </div>
    </>
  );
}

// ── Card components ────────────────────────────────────────────────────

function ToolCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
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
      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: `linear-gradient(135deg, ${tool.color}40 0%, ${tool.color}20 100%)`,
        border: `1px solid ${tool.color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 24px ${tool.color}30`,
      }}>
        <Icon size={26} style={{ color: tool.color }} />
      </div>

      {/* Soon badge */}
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
          Em breve
        </span>
      )}

      <div>
        <h3 style={{
          fontSize: 16, fontWeight: 700,
          color: tool.color,
          letterSpacing: "0.06em",
          margin: "0 0 8px",
          textTransform: "uppercase",
        }}>
          {tool.title}
        </h3>
        <p style={{
          fontSize: 13, color: "rgba(255,255,255,0.62)",
          margin: 0, lineHeight: 1.5,
        }}>
          {tool.desc}
        </p>
      </div>

      <div style={{
        marginTop: "auto",
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${tool.color}40`,
        background: `${tool.color}10`,
        textAlign: "center",
        fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
        color: tool.color,
        textTransform: "uppercase",
      }}>
        {tool.cta}
      </div>
    </button>
  );
}

function SupportCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
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
        }}>{tool.title}</p>
        <p style={{
          fontSize: 11, color: "rgba(255,255,255,0.50)",
          margin: "2px 0 0", lineHeight: 1.35,
        }}>{tool.desc}</p>
      </div>
    </button>
  );
}
