// HubLibrary — Biblioteca interna do Hub.
//
// Subproduto isolado. Lista APENAS assets gerados dentro do Hub
// (creative_memory com type='hub_image' e similares 'hub_*' no futuro).
// Sem persona, sem brand_kit, sem cruzamento com produto principal.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, ArrowLeft, Search, Download, X, Sparkles, FolderOpen,
} from "lucide-react";

interface HubAsset {
  id: string;
  type: "image";
  title: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  created_at: string;
}

const PERIOD_OPTIONS = [
  { id: "today", label: "Hoje", days: 1 },
  { id: "7d",    label: "7 dias", days: 7 },
  { id: "30d",   label: "30 dias", days: 30 },
  { id: "all",   label: "Tudo", days: 365 * 5 },
] as const;

export default function HubLibrary() {
  const navigate = useNavigate();

  const [assets, setAssets] = useState<HubAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]["id"]>("30d");
  const [search, setSearch] = useState("");
  const [previewAsset, setPreviewAsset] = useState<HubAsset | null>(null);

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

        // Só assets do Hub — type começa com 'hub_'.
        // Por enquanto só hub_image; futuras: hub_board, hub_script, etc.
        const { data } = await supabase.from("creative_memory" as any)
          .select("id, type, content, created_at")
          .eq("user_id", user.id)
          .like("type", "hub_%")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);

        const list: HubAsset[] = (data || []).map((r: any) => {
          const c = r.content || {};
          return {
            id: r.id,
            type: "image",
            title: (c.prompt || "Imagem gerada").slice(0, 80),
            image_url: c.image_url || "",
            prompt: c.prompt || "",
            aspect_ratio: c.aspect_ratio || "1:1",
            created_at: r.created_at,
          };
        }).filter((a: HubAsset) => a.image_url);

        if (mounted) setAssets(list);
      } catch (e) {
        console.error("[hub-library] load error:", e);
        if (mounted) setAssets([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [period]);

  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.trim().toLowerCase();
    return assets.filter(a =>
      a.title.toLowerCase().includes(q)
      || a.prompt.toLowerCase().includes(q)
    );
  }, [assets, search]);

  return (
    <>
      <Helmet>
        <title>Biblioteca — Hub</title>
      </Helmet>

      <div style={{ minHeight: "calc(100vh - 64px)", padding: "24px 24px 80px", maxWidth: 1440, margin: "0 auto", color: "#fff" }}>
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
              Tudo que foi gerado no Hub · {filtered.length} de {assets.length}
            </p>
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.40)" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por prompt…"
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

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
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
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={assets.length > 0} />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {filtered.map(asset => (
              <AssetCard key={asset.id} asset={asset} onClick={() => setPreviewAsset(asset)} />
            ))}
          </div>
        )}

        {previewAsset && (
          <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
        )}
      </div>
    </>
  );
}

function AssetCard({ asset, onClick }: { asset: HubAsset; onClick: () => void }) {
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
        e.currentTarget.style.borderColor = "#a855f755";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(168,85,247,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <img
        src={asset.image_url}
        alt={asset.title}
        style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
      />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{asset.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          <ImageIcon size={10} style={{ color: "#a855f7" }} />
          <span>Imagem</span>
          <span>·</span>
          <span>{relativeDate(asset.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.10)",
      borderRadius: 16,
    }}>
      <Sparkles size={32} style={{ color: "rgba(255,255,255,0.30)", marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", margin: "0 0 6px" }}>
        {hasAny ? "Nenhum resultado pra essa busca" : "Biblioteca vazia"}
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
        {hasAny
          ? "Tenta limpar a busca ou trocar o período."
          : "Gere imagens no Image Generator — elas aparecem aqui automaticamente."}
      </p>
    </div>
  );
}

function PreviewModal({ asset, onClose }: { asset: HubAsset; onClose: () => void }) {
  const downloadImage = async (url: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `hub-${asset.id}.png`;
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
          border: "1px solid #a855f755",
          borderRadius: 16,
          maxWidth: 900, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          boxShadow: "0 0 60px rgba(168,85,247,0.30)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ImageIcon size={18} style={{ color: "#a855f7" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Imagem</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>·</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{relativeDate(asset.created_at)}</span>
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

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <img
              src={asset.image_url}
              alt={asset.title}
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10 }}
            />
          </div>
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0,
            padding: "10px 12px", background: "rgba(255,255,255,0.03)",
            borderRadius: 8, lineHeight: 1.55, fontStyle: "italic",
          }}>
            "{asset.prompt}"
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={() => downloadImage(asset.image_url)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: "#a855f720", color: "#a855f7",
                border: "1px solid #a855f755", cursor: "pointer", font: "inherit",
              }}
            >
              <Download size={14} /> Baixar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
