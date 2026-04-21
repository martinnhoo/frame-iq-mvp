import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Plus, Clock, CheckCircle, AlertCircle, Loader2, Trash2, XCircle, Search, SortDesc, Zap, FileText, ClipboardList } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

interface Analysis {
  id: string; title: string | null; status: string; created_at: string;
  video_url: string | null; result: Record<string, unknown> | null; hook_strength: string | null;
}

const F = T.font; // 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif

const STATUS_LABELS: Record<string, Record<string, string>> = {
  pending:   { en: "Processing", pt: "Processando",  es: "Procesando"  },
  completed: { en: "Completed",  pt: "Concluído",    es: "Completado"  },
  failed:    { en: "Failed",     pt: "Falhou",       es: "Falló"       },
};
const STATUS_ICONS: Record<string, { icon: typeof Clock; color: string; bg: string; border: string }> = {
  pending:   { icon: Clock,        color: T.amber, bg: `${T.amber}15`,     border: `${T.amber}20` },
  completed: { icon: CheckCircle,  color: T.green, bg: `${T.green}15`,     border: `${T.green}20` },
  failed:    { icon: AlertCircle,  color: T.red,   bg: `${T.red}15`,       border: `${T.red}20` },
};

const scoreColor = (s: number | null) => !s ? "rgba(255,255,255,0.35)" : s >= 8 ? T.green : s >= 6 ? T.amber : T.red;

const UI: Record<string, Record<string, string>> = {
  pt: { title: "Análise de Criativos", new_btn: "Nova análise", search_ph: "Buscar por nome...", recent: "Recentes", top_score: "Maior score", empty_title: "Nenhuma análise ainda", empty_sub: "Faça upload de um vídeo para obter score de hook, insights visuais e recomendações de melhoria", empty_btn: "Criar primeira análise", untitled: "Análise sem título", no_match: "Nenhuma análise encontrada", cancel: "Cancelar análise", delete: "Excluir análise" },
  es: { title: "Análisis de Creativos", new_btn: "Nuevo análisis", search_ph: "Buscar por nombre...", recent: "Recientes", top_score: "Mejor score", empty_title: "Sin análisis aún", empty_sub: "Sube un video para obtener score de hook, insights visuales y recomendaciones de mejora", empty_btn: "Crear primer análisis", untitled: "Análisis sin título", no_match: "Sin resultados", cancel: "Cancelar análisis", delete: "Eliminar análisis" },
  en: { title: "Creative Analysis", new_btn: "New Analysis", search_ph: "Search by name...", recent: "Recent", top_score: "Top Score", empty_title: "No analyses yet", empty_sub: "Upload a video to get hook scores, visual insights and improvement recommendations", empty_btn: "Create first analysis", untitled: "Untitled Analysis", no_match: "No analyses match", cancel: "Cancel analysis", delete: "Delete analysis" },
};

export default function AnalysesList() {
  const { user } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = UI[language] || UI.en;
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "score">("date");

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from("analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (!mounted) return;
      if (data) setAnalyses(data as Analysis[]);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const filtered = useMemo(() => {
    let list = analyses.filter(a => !search || (a.title || "").toLowerCase().includes(search.toLowerCase()));
    if (sort === "score") list = [...list].sort((a, b) => ((b.result?.hook_score as number) ?? 0) - ((a.result?.hook_score as number) ?? 0));
    return list;
  }, [analyses, search, sort]);

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  const handleDelete = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    if (!confirm(status === "pending" ? t.cancel + "?" : t.delete + "?")) return;
    setDeleting(id);
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error(language === "pt" ? "Falha ao excluir" : language === "es" ? "Error al eliminar" : "Failed to delete");
    else { toast.success(language === "pt" ? "Excluído" : language === "es" ? "Eliminado" : "Deleted"); setAnalyses(prev => prev.filter(a => a.id !== id)); }
    setDeleting(null);
  };

  if (loading) return (
    <div style={{ padding: "clamp(16px,4vw,32px)", maxWidth: 900, margin: "0 auto" }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ width: 180, height: 22, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 6 }} />
          <div style={{ width: 60, height: 12, background: "rgba(255,255,255,0.03)", borderRadius: 6 }} />
        </div>
        <div style={{ width: 120, height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
      </div>
      {[1,2,3].map(i => <div key={i} className="animate-pulse" style={{ height: 72, background: "rgba(255,255,255,0.04)", borderRadius: 14, marginBottom: 8 }} />)}
    </div>
  );

  return (
    <div style={{ padding: "clamp(16px,4vw,32px)", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, color: "#fff", margin: 0 }}>{t.title}</h1>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{analyses.length} total</p>
        </div>
        <button onClick={() => navigate("/dashboard/analyses/new")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "#0ea5e9", color: "#000", fontFamily: F, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          <Plus size={14} /> {t.new_btn}
        </button>
      </div>

      {analyses.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search_ph}
              style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, fontFamily: F, fontSize: 13, color: "#fff", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, outline: "none", boxSizing: "border-box" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["date", "score"] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 10, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", background: sort === s ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)", color: sort === s ? "#0ea5e9" : "rgba(255,255,255,0.4)", border: sort === s ? "1px solid rgba(14,165,233,0.25)" : "1px solid rgba(255,255,255,0.09)" }}>
                <SortDesc size={12} /> {s === "date" ? t.recent : t.top_score}
              </button>
            ))}
          </div>
        </div>
      )}

      {analyses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
          <BarChart3 size={28} color="rgba(255,255,255,0.18)" style={{ margin: "0 auto 14px" }} />
          <p style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{t.empty_title}</p>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 20 }}>{t.empty_sub}</p>
          <button onClick={() => navigate("/dashboard/analyses/new")}
            style={{ padding: "9px 20px", borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 600, background: "rgba(14,165,233,0.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.2)", cursor: "pointer" }}>
            {t.empty_btn}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{t.no_match} "{search}"</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(a => {
            const cfg = STATUS_ICONS[a.status as keyof typeof STATUS_ICONS] || STATUS_ICONS.pending;
            const StatusIcon = cfg.icon;
            const score = (a.result?.hook_score as number) ?? null;
            const statusLabel = STATUS_LABELS[a.status]?.[language] || STATUS_LABELS[a.status]?.en || a.status;
            return (
              <div key={a.id} className="group"
                style={{ borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", transition: "all 0.12s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.04)"; el.style.borderColor = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.025)"; el.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                {/* Main row */}
                <div onClick={() => navigate("/dashboard/analyses/" + a.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BarChart3 size={16} color="#0ea5e9" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title || t.untitled}
                    </p>
                    <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.32)", margin: "3px 0 0" }}>
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {score !== null && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: scoreColor(score), flexShrink: 0 }}>
                      {score.toFixed(1)}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: cfg.bg, border: "1px solid " + cfg.border, flexShrink: 0 }}>
                    <StatusIcon size={11} color={cfg.color} />
                    <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: cfg.color }}>{statusLabel}</span>
                  </div>
                  <button onClick={e => handleDelete(e, a.id, a.status)} disabled={deleting === a.id}
                    style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", flexShrink: 0, color: "rgba(255,255,255,0.25)", transition: "all 0.12s" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#f87171"; el.style.background = "rgba(248,113,113,0.1)"; el.style.borderColor = "rgba(248,113,113,0.2)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.25)"; el.style.background = "transparent"; el.style.borderColor = "transparent"; }}>
                    {deleting === a.id ? <Loader2 size={12} className="animate-spin" /> : a.status === "pending" ? <XCircle size={12} /> : <Trash2 size={12} />}
                  </button>
                </div>
                {/* Quick actions — only for completed analyses */}
                {a.status === "completed" && (() => {
                  const r = a.result as Record<string, unknown> | null;
                  const hook = (r?.audio_hook as string) ?? null;
                  const brief = (r?.brief as string) ?? null;
                  const summary = (r?.summary as string) ?? null;
                  const market = (r?.market_guess as string) ?? null;
                  const fmt = (r?.format as string) ?? null;
                  const mkHookUrl = () => { const p = new URLSearchParams(); if (hook) p.set("hook", hook); if (brief) p.set("product", brief.slice(0,120)); if (market) p.set("market", market); return "/dashboard/hooks?" + p; };
                  const mkScriptUrl = () => { const p = new URLSearchParams(); if (brief) p.set("product", brief.slice(0,120)); if (summary) p.set("context", summary.slice(0,200)); if (market) p.set("market", market); if (fmt) p.set("format", fmt); return "/dashboard/script?" + p; };
                  const mkBriefUrl = () => { const p = new URLSearchParams(); if (brief) p.set("product", brief.slice(0,120)); if (summary) p.set("context", summary.slice(0,200)); if (market) p.set("market", market); return "/dashboard/brief?" + p; };
                  return (
                    <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", flexWrap: "wrap" }}>
                      {[
                        { label: language === "pt" ? "Reescrever hook" : language === "es" ? "Reescribir hook" : "Rewrite hook", url: mkHookUrl(), color: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)", icon: <Zap size={10} /> },
                        { label: language === "pt" ? "Variação de script" : language === "es" ? "Variación de guión" : "Script variation", url: mkScriptUrl(), color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", icon: <FileText size={10} /> },
                        { label: language === "pt" ? "Criar brief" : language === "es" ? "Crear brief" : "Create brief", url: mkBriefUrl(), color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", icon: <ClipboardList size={10} /> },
                      ].map(action => (
                        <button key={action.label}
                          onClick={e => { e.stopPropagation(); navigate(action.url); }}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", color: action.color, background: action.bg, border: "1px solid " + action.border, transition: "all 0.12s" }}>
                          {action.icon} {action.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
