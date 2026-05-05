// HubLibrary — Catálogo unificado de tudo que foi gerado.
//
// Agrega de múltiplas tabelas:
//   • creative_memory  — imagens (gpt-image-2), hooks, scripts, briefs,
//                        AB variants, e qualquer coisa salva pelos
//                        edge functions de geração
//   • boards           — production boards (cena-a-cena, com personagem)
//   • video_analysis   — transcripts de vídeo
//
// Filtros:
//   • Tipo (chip group): Imagens, Boards, Hooks, Scripts, Briefs,
//     AB Variants, Transcripts
//   • Persona — auto-selecionada (selectedPersona) com toggle "Todas as marcas"
//   • Período — Hoje · 7d · 30d · Tudo
//   • Busca — em content.prompt + title
//
// Click no card:
//   • Imagem  → modal grande com download + "Gerar variação"
//   • Board   → navega pra /dashboard/boards/:id
//   • Hook/Script/Brief → modal com texto + copiar
//
// Multi-marca: respeita persona via persona_id na query. Trocar persona
// no app re-fetcha a lista.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import {
  Image as ImageIcon, Clapperboard, Lightbulb, FileText, Video,
  SplitSquareVertical, ArrowLeft, Search, Download, Copy, X, Sparkles, FolderOpen,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────

type AssetType = "image" | "board" | "hook" | "script" | "brief" | "ab_variant" | "transcript";

interface Asset {
  id: string;
  type: AssetType;
  title: string;
  preview: string;       // image_url for images, text snippet for text-based
  content: any;          // raw content payload
  persona_id: string | null;
  persona_name?: string;
  created_at: string;
  // For navigation
  route?: string;
}

const TYPE_META: Record<AssetType, { label: string; icon: typeof ImageIcon; color: string }> = {
  image:      { label: "Imagens",      icon: ImageIcon,           color: "#a855f7" },
  board:      { label: "Boards",       icon: Clapperboard,        color: "#3b82f6" },
  hook:       { label: "Hooks",        icon: Lightbulb,           color: "#a855f7" },
  script:     { label: "Roteiros",     icon: FileText,            color: "#34d399" },
  brief:      { label: "Briefs",       icon: FileText,            color: "#f59e0b" },
  ab_variant: { label: "AB Variants",  icon: SplitSquareVertical, color: "#f97316" },
  transcript: { label: "Transcripts",  icon: Video,               color: "#22c55e" },
};

const PERIOD_OPTIONS = [
  { id: "today", label: "Hoje", days: 1 },
  { id: "7d",    label: "7 dias", days: 7 },
  { id: "30d",   label: "30 dias", days: 30 },
  { id: "all",   label: "Tudo", days: 365 * 5 },
] as const;

// ── Component ───────────────────────────────────────────────────────────

export default function HubLibrary() {
  const navigate = useNavigate();
  const ctx = useOutletContext<DashboardContext>();
  const persona = ctx?.selectedPersona || null;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]["id"]>("30d");
  const [allBrands, setAllBrands] = useState(false);
  const [search, setSearch] = useState("");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  // ── Load assets ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) { setAssets([]); setLoading(false); }
          return;
        }

        const since = new Date(Date.now() - PERIOD_OPTIONS.find(p => p.id === period)!.days * 86_400_000).toISOString();
        const personaFilter = !allBrands && persona?.id ? persona.id : null;

        // ── creative_memory ─────────────────────────────────────────────
        let cmQuery = supabase.from("creative_memory" as any)
          .select("id, type, hook_type, content, persona_id, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);
        if (personaFilter) cmQuery = cmQuery.eq("persona_id", personaFilter);
        const { data: cmRows } = await cmQuery;

        // ── boards ──────────────────────────────────────────────────────
        let boardQuery = supabase.from("boards")
          .select("id, name, content, persona_id, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);
        if (personaFilter) boardQuery = boardQuery.eq("persona_id", personaFilter);
        const { data: boardRows } = await boardQuery;

        // ── video_analysis (transcripts) ────────────────────────────────
        const { data: vaRows } = await supabase.from("video_analysis" as any)
          .select("id, file_name, transcript, content, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        // ── Personas map for labels ─────────────────────────────────────
        const personaIds = new Set<string>();
        (cmRows || []).forEach((r: any) => r.persona_id && personaIds.add(r.persona_id));
        (boardRows || []).forEach((r: any) => r.persona_id && personaIds.add(r.persona_id));
        let personaMap: Record<string, string> = {};
        if (personaIds.size) {
          const { data: pData } = await supabase.from("personas")
            .select("id, name")
            .in("id", Array.from(personaIds));
          (pData || []).forEach((p: any) => { personaMap[p.id] = p.name; });
        }

        // ── Normalize creative_memory rows into Asset[] ─────────────────
        const fromCm: Asset[] = (cmRows || []).map((r: any) => {
          const c = r.content || {};
          let type: AssetType = "hook"; // default
          let title = "Sem título";
          let preview = "";
          if (r.type === "generated_image" || c.image_url) {
            type = "image";
            title = (c.prompt || "Imagem gerada").slice(0, 60);
            preview = c.image_url || "";
          } else if (r.type === "ab_variant" || c.variants) {
            type = "ab_variant";
            title = c.angle || c.headline || "AB Variant";
            preview = (c.variants || []).map((v: any) => v.hook).filter(Boolean).slice(0, 2).join(" / ").slice(0, 120);
          } else if (r.type === "script" || c.script_rewrite || c.full_script) {
            type = "script";
            title = c.headline || c.angle || "Roteiro";
            preview = (c.script_rewrite || c.full_script || c.text || "").slice(0, 140);
          } else if (r.type === "brief" || c.brief) {
            type = "brief";
            title = c.brief?.title || c.title || "Brief";
            preview = (c.brief?.summary || c.summary || c.text || "").slice(0, 140);
          } else if (r.type === "transcript") {
            type = "transcript";
            title = c.file_name || "Transcript";
            preview = (c.transcript || c.text || "").slice(0, 140);
          } else {
            // Default: hook
            type = "hook";
            title = c.hook || c.headline || c.angle || (typeof c.text === "string" ? c.text.slice(0, 60) : "Hook");
            preview = c.hook || c.headline || (typeof c.text === "string" ? c.text : "");
            preview = preview.slice(0, 140);
          }
          return {
            id: r.id,
            type,
            title,
            preview,
            content: c,
            persona_id: r.persona_id,
            persona_name: r.persona_id ? personaMap[r.persona_id] : undefined,
            created_at: r.created_at,
          };
        });

        // ── Normalize boards ────────────────────────────────────────────
        const fromBoards: Asset[] = (boardRows || []).map((r: any) => {
          const c = r.content || {};
          const sceneCount = Array.isArray(c.scenes) ? c.scenes.length : 0;
          return {
            id: `board-${r.id}`,
            type: "board",
            title: r.name || "Board sem título",
            preview: sceneCount ? `${sceneCount} cenas · ${(c.scenes?.[0]?.visual_description || "").slice(0, 100)}` : "Board",
            content: c,
            persona_id: r.persona_id,
            persona_name: r.persona_id ? personaMap[r.persona_id] : undefined,
            created_at: r.created_at,
            route: `/dashboard/boards/${r.id}`,
          };
        });

        // ── Normalize transcripts ───────────────────────────────────────
        const fromTranscripts: Asset[] = (vaRows || []).map((r: any) => {
          const transcript = r.transcript || r.content?.transcript || "";
          return {
            id: `transcript-${r.id}`,
            type: "transcript" as AssetType,
            title: r.file_name || "Vídeo sem nome",
            preview: transcript.slice(0, 140),
            content: { transcript, ...r.content },
            persona_id: null,
            created_at: r.created_at,
          };
        });

        const merged = [...fromCm, ...fromBoards, ...fromTranscripts]
          .sort((a, b) => b.created_at.localeCompare(a.created_at));

        if (mounted) setAssets(merged);
      } catch (e) {
        console.error("[library] load error:", e);
        if (mounted) setAssets([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [persona?.id, allBrands, period]);

  // ── Apply filters client-side (cheap, in-memory) ──────────────────────
  const filtered = useMemo(() => {
    let list = assets;
    if (typeFilter !== "all") list = list.filter(a => a.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q)
        || a.preview.toLowerCase().includes(q)
      );
    }
    return list;
  }, [assets, typeFilter, search]);

  // ── Counts per type pra mostrar nos filter chips ──────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    assets.forEach(a => { c[a.type] = (c[a.type] || 0) + 1; });
    return c;
  }, [assets]);

  const onAssetClick = (asset: Asset) => {
    if (asset.route) {
      navigate(asset.route);
      return;
    }
    setPreviewAsset(asset);
  };

  return (
    <>
      <Helmet>
        <title>Biblioteca — Hub</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1440, margin: "0 auto", color: "#fff" }}>
        {/* Back */}
        <button
          onClick={() => navigate("/dashboard/hub")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: "rgba(255,255,255,0.55)",
            cursor: "pointer", fontSize: 13, padding: "6px 8px", marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} /> Voltar ao Hub
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #14b8a640 0%, #14b8a620 100%)",
            border: "1px solid #14b8a655",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px #14b8a630",
          }}>
            <FolderOpen size={24} style={{ color: "#14b8a6" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>Biblioteca</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>
              Tudo que foi gerado{persona?.name && !allBrands ? ` · ${persona.name}` : " · todas as marcas"} · {filtered.length} de {assets.length}
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.40)" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, prompt ou conteúdo…"
            style={{
              width: "100%", padding: "10px 14px 10px 36px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, color: "#fff", fontSize: 13, outline: "none",
              boxSizing: "border-box", fontFamily: "inherit",
              transition: "border-color 0.18s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "#14b8a655"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
        </div>

        {/* Filters: type chips + period + brand toggle */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 24 }}>
          {/* Type chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <FilterChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label="Tudo"
              count={counts.all || 0}
              color="#fff"
            />
            {(Object.keys(TYPE_META) as AssetType[]).map(t => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                label={TYPE_META[t].label}
                count={counts[t] || 0}
                color={TYPE_META[t].color}
                icon={TYPE_META[t].icon}
              />
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }} />

          {/* Period */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                  background: period === p.id ? "rgba(255,255,255,0.10)" : "transparent",
                  color: period === p.id ? "#fff" : "rgba(255,255,255,0.50)",
                  border: "none", cursor: "pointer", font: "inherit",
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* All brands toggle */}
          {persona?.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              <input
                type="checkbox"
                checked={allBrands}
                onChange={e => setAllBrands(e.target.checked)}
                style={{ accentColor: "#14b8a6" }}
              />
              Todas as marcas
            </label>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState typeFilter={typeFilter} hasAny={assets.length > 0} />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {filtered.map(asset => (
              <AssetCard key={asset.id} asset={asset} onClick={() => onAssetClick(asset)} />
            ))}
          </div>
        )}

        {/* Modal preview */}
        {previewAsset && (
          <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
        )}
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count, color, icon: Icon }: {
  active: boolean; onClick: () => void; label: string; count: number; color: string; icon?: typeof ImageIcon;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: 7,
        background: active ? `${color}20` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? `${color}66` : "rgba(255,255,255,0.08)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.65)",
        fontSize: 12, fontWeight: 600, cursor: "pointer", font: "inherit",
        transition: "all 0.15s",
      }}
    >
      {Icon && <Icon size={12} style={{ color: active ? color : "currentColor" }} />}
      {label}
      <span style={{
        fontSize: 10, padding: "1px 5px", borderRadius: 4,
        background: active ? `${color}40` : "rgba(255,255,255,0.06)",
        color: active ? color : "rgba(255,255,255,0.50)",
      }}>{count}</span>
    </button>
  );
}

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const meta = TYPE_META[asset.type];
  const Icon = meta.icon;
  const isImage = asset.type === "image" && asset.preview;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, overflow: "hidden",
        cursor: "pointer", color: "inherit", font: "inherit",
        display: "flex", flexDirection: "column",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = `${meta.color}55`;
        e.currentTarget.style.boxShadow = `0 8px 20px ${meta.color}25`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Visual */}
      {isImage ? (
        <img
          src={asset.preview}
          alt={asset.title}
          style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          aspectRatio: "16/10",
          background: `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}05 100%)`,
          borderBottom: `1px solid ${meta.color}22`,
          padding: 14,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          minHeight: 120,
        }}>
          <Icon size={18} style={{ color: meta.color }} />
          <p style={{
            fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0,
            lineHeight: 1.45,
            display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{asset.preview}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{asset.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          <Icon size={10} style={{ color: meta.color }} />
          <span>{meta.label}</span>
          <span>·</span>
          <span>{relativeDate(asset.created_at)}</span>
          {asset.persona_name && <><span>·</span><span style={{ color: "rgba(255,255,255,0.55)" }}>{asset.persona_name}</span></>}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ typeFilter, hasAny }: { typeFilter: string; hasAny: boolean }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.10)",
      borderRadius: 16,
    }}>
      <Sparkles size={32} style={{ color: "rgba(255,255,255,0.30)", marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", margin: "0 0 6px" }}>
        {hasAny ? "Nenhum resultado pra esse filtro" : "Biblioteca vazia"}
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
        {hasAny
          ? typeFilter === "all" ? "Tenta limpar a busca ou trocar o período." : "Tenta outro tipo ou período."
          : "Gere imagens, hooks, scripts ou boards no Hub — eles aparecem aqui automaticamente."}
      </p>
    </div>
  );
}

function PreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const meta = TYPE_META[asset.type];
  const Icon = meta.icon;
  const isImage = asset.type === "image" && asset.content?.image_url;

  const copyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
    } catch { /* silent */ }
  };

  const downloadImage = async (url: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `library-${asset.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch { /* silent */ }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20, backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0a0a0f",
          border: `1px solid ${meta.color}55`,
          borderRadius: 16,
          maxWidth: 900, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          boxShadow: `0 0 60px ${meta.color}30`,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={18} style={{ color: meta.color }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{meta.label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>·</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{relativeDate(asset.created_at)}</span>
            {asset.persona_name && (
              <>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>·</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{asset.persona_name}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "none",
              borderRadius: 7, padding: 6, cursor: "pointer",
              color: "rgba(255,255,255,0.65)", display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {isImage ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <img
                  src={asset.content.image_url}
                  alt={asset.title}
                  style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }}
                />
              </div>
              <p style={{
                fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0,
                padding: "10px 12px", background: "rgba(255,255,255,0.03)",
                borderRadius: 8, lineHeight: 1.55, fontStyle: "italic",
              }}>
                "{asset.content.prompt || asset.title}"
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadImage(asset.content.image_url)}
                  style={btnStyle(meta.color, true)}
                >
                  <Download size={14} /> Baixar
                </button>
                <button
                  onClick={() => copyText(asset.content.prompt || "")}
                  style={btnStyle("#fff", false)}
                >
                  <Copy size={14} /> Copiar prompt
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>
                {asset.title}
              </h2>
              <pre style={{
                fontSize: 13, color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: 16,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                margin: 0, fontFamily: "inherit", lineHeight: 1.6,
                maxHeight: "60vh", overflow: "auto",
              }}>
                {asset.preview || JSON.stringify(asset.content, null, 2)}
              </pre>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => copyText(asset.preview || JSON.stringify(asset.content, null, 2))}
                  style={btnStyle(meta.color, true)}
                >
                  <Copy size={14} /> Copiar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function btnStyle(color: string, primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: primary ? `${color}20` : "rgba(255,255,255,0.06)",
    color: primary ? color : "#fff",
    border: `1px solid ${primary ? `${color}55` : "rgba(255,255,255,0.12)"}`,
    cursor: "pointer", font: "inherit",
  };
}

function relativeDate(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min atrás`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h atrás`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d atrás`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return ""; }
}
