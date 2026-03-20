import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Plus, Clock, CheckCircle, AlertCircle, Loader2, Trash2, XCircle, Search, SortDesc } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Analysis {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
  result: Record<string, unknown> | null;
  hook_strength: string | null;
}

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

const STATUS = {
  pending:   { label: "Processing", icon: Clock,        color: "#fbbf24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.2)" },
  completed: { label: "Completed",  icon: CheckCircle,  color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)" },
  failed:    { label: "Failed",     icon: AlertCircle,  color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

const scoreColor = (s: number | null) => !s ? "rgba(255,255,255,0.35)" : s >= 8 ? "#34d399" : s >= 6 ? "#fbbf24" : "#f87171";

export default function AnalysesList() {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "score">("date");

  const load = async () => {
    const { data } = await supabase
      .from("analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setAnalyses(data as Analysis[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const filtered = useMemo(() => {
    let list = analyses.filter(a =>
      !search || (a.title || "Untitled").toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "score") {
      list = [...list].sort((a, b) => {
        const sa = (a.result?.hook_score as number) ?? 0;
        const sb = (b.result?.hook_score as number) ?? 0;
        return sb - sa;
      });
    }
    return list;
  }, [analyses, search, sort]);

  const handleDelete = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    if (!confirm(status === "pending" ? "Cancel this analysis?" : "Delete this analysis?")) return;
    setDeleting(id);
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Deleted"); setAnalyses(prev => prev.filter(a => a.id !== id)); }
    setDeleting(null);
  };

  if (loading) return (
    <div style={{ padding: "clamp(16px,4vw,32px)", maxWidth: 900, margin: "0 auto" }}>
      {[1,2,3].map(i => <div key={i} className="animate-pulse" style={{ height: 72, background: "rgba(255,255,255,0.04)", borderRadius: 14, marginBottom: 8 }} />)}
    </div>
  );

  return (
    <div style={{ padding: "clamp(16px,4vw,32px)", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, color: "#fff", margin: 0 }}>Analyses</h1>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{analyses.length} total</p>
        </div>
        <button onClick={() => navigate("/dashboard/analyses/new")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", fontFamily: F, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          <Plus size={14} /> New Analysis
        </button>
      </div>

      {/* Search + Sort */}
      {analyses.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              style={{ width: "100%", paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, fontFamily: F, fontSize: 13, color: "#fff", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["date", "score"] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 10, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", background: sort === s ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)", color: sort === s ? "#0ea5e9" : "rgba(255,255,255,0.4)", border: sort === s ? "1px solid rgba(14,165,233,0.25)" : "1px solid rgba(255,255,255,0.09)" }}>
                <SortDesc size={12} /> {s === "date" ? "Recent" : "Top Score"}
              </button>
            ))}
          </div>
        </div>
      )}

      {analyses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
          <BarChart3 size={28} color="rgba(255,255,255,0.18)" style={{ margin: "0 auto 14px" }} />
          <p style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>No analyses yet</p>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 20 }}>Upload a video to get AI-powered hook scores and creative insights</p>
          <button onClick={() => navigate("/dashboard/analyses/new")}
            style={{ padding: "9px 20px", borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 600, background: "rgba(14,165,233,0.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.2)", cursor: "pointer" }}>
            Create first analysis
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>No analyses match "{search}"</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(a => {
            const cfg = STATUS[a.status as keyof typeof STATUS] || STATUS.pending;
            const StatusIcon = cfg.icon;
            const score = (a.result?.hook_score as number) ?? null;
            return (
              <div key={a.id} onClick={() => navigate("/dashboard/analyses/" + a.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.04)"; el.style.borderColor = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.025)"; el.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BarChart3 size={16} color="#0ea5e9" />
                </div>
                {/* Title + date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title || "Untitled Analysis"}
                  </p>
                  <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.32)", margin: "3px 0 0" }}>
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                {/* Score */}
                {score !== null && (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: scoreColor(score), flexShrink: 0 }}>
                    {score.toFixed(1)}
                  </span>
                )}
                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: cfg.bg, border: "1px solid " + cfg.border, flexShrink: 0 }}>
                  <StatusIcon size={11} color={cfg.color} />
                  <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
                {/* Delete */}
                <button onClick={e => handleDelete(e, a.id, a.status)} disabled={deleting === a.id}
                  style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", flexShrink: 0, color: "rgba(255,255,255,0.25)", transition: "all 0.12s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#f87171"; el.style.background = "rgba(248,113,113,0.1)"; el.style.borderColor = "rgba(248,113,113,0.2)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.25)"; el.style.background = "transparent"; el.style.borderColor = "transparent"; }}>
                  {deleting === a.id ? <Loader2 size={12} className="animate-spin" /> : a.status === "pending" ? <XCircle size={12} /> : <Trash2 size={12} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
