import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Plus, Clock, CheckCircle, AlertCircle, Loader2, Trash2, XCircle } from "lucide-react";
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

const statusConfig: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending:   { label: "Processing", icon: Clock,         cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  completed: { label: "Completed",  icon: CheckCircle,  cls: "text-green-400  bg-green-500/10  border-green-500/20" },
  failed:    { label: "Failed",     icon: AlertCircle,  cls: "text-red-400    bg-red-500/10    border-red-500/20" },
};

const hookColor = (score: number | null) => {
  if (!score) return "text-white/30";
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-yellow-400";
  return "text-red-400";
};

const AnalysesList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setAnalyses(data as Analysis[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const handleDelete = async (e: React.MouseEvent, analysisId: string, status: string) => {
    e.stopPropagation();
    const action = status === "pending" ? "Cancel" : "Delete";
    if (!confirm(`${action} this analysis?`)) return;
    setDeleting(analysisId);
    const { error } = await supabase.from("analyses").delete().eq("id", analysisId);
    if (error) { toast.error("Failed to delete"); }
    else {
      toast.success(`Analysis ${action.toLowerCase()}ed`);
      setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
    }
    setDeleting(null);
  };

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-32 bg-white/5 animate-pulse rounded-lg" />
      {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analyses</h1>
          <p className="text-white/30 text-sm mt-0.5">{analyses.length} total</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/analyses/new")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Analysis
        </button>
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-16 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white/20" />
          </div>
          <div>
            <p className="text-white/50 font-medium">No analyses yet</p>
            <p className="text-white/25 text-sm mt-1">Upload a video to get AI-powered creative insights</p>
          </div>
          <button
            onClick={() => navigate("/dashboard/analyses/new")}
            className="px-4 py-2 rounded-xl border border-white/[0.1] text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            Create first analysis
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {analyses.map((a) => {
            const cfg = statusConfig[a.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            const hookScore = (a.result?.hook_score as number) ?? null;
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/dashboard/analyses/${a.id}`)}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white/80 group-hover:text-white truncate transition-colors">
                    {a.title || "Untitled Analysis"}
                  </p>
                  <p className="text-xs text-white/25 mt-0.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {hookScore !== null && (
                    <span className={`font-mono text-sm font-bold ${hookColor(hookScore)}`}>
                      {hookScore.toFixed(1)}
                    </span>
                  )}
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${cfg.cls}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, a.id, a.status)}
                    disabled={deleting === a.id}
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    {deleting === a.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : a.status === "pending"
                        ? <XCircle className="h-3.5 w-3.5" />
                        : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnalysesList;
