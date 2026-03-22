import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Plus, Trash2, Loader2, Clock, CheckCircle, Film, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

interface Board {
  id: string;
  title: string | null;
  prompt: string | null;
  status: string;
  created_at: string;
  content: Record<string, unknown> | null;
}

const BoardsList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("boards").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setBoards(data as Board[]);
      setLoading(false);
    };
    run();
  }, [user.id]);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    await supabase.from("boards").delete().eq("id", id);
    setBoards(p => p.filter(b => b.id !== id));
    toast.success("Board deleted");
    setDeleting(null);
  };

  if (loading) return (
    <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 overflow-x-hidden">
      <div className="h-8 w-24 bg-white/5 animate-pulse rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="h-40 bg-white/5 animate-pulse rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{dt("bo_title")}</h1>
          <p className="text-white/50 text-sm mt-0.5">{boards.length} {dt("bo_production_boards")}</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/boards/new")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> {dt("bo_new")}
        </button>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.15] bg-white/[0.06] py-16 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <LayoutGrid className="h-6 w-6 text-white/40" />
          </div>
          <div>
            <p className="text-white/50 font-medium">{dt("bo_empty")}</p>
            <p className="text-white/45 text-sm mt-1 max-w-xs">{dt("bo_describe_concept")}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard/boards/new")}
            className="px-4 py-2 rounded-xl border border-white/[0.1] text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            {dt("bo_create_first")}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => {
            const scenes = (board.content?.scenes as unknown[]) || [];
            const meta = board.content?.meta as Record<string, unknown> || {};
            const ready = board.status === "completed";
            return (
              <div
                key={board.id}
                onClick={() => navigate(`/dashboard/boards/${board.id}`)}
                className="group relative rounded-2xl border border-white/[0.15] bg-white/[0.06] hover:border-white/20 hover:bg-white/[0.08] transition-all cursor-pointer p-5 flex flex-col gap-3"
              >
                {/* Status dot */}
                <div className="flex items-start justify-between">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <LayoutGrid className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      ready
                        ? "text-green-400 border-green-500/20 bg-green-500/10"
                        : "text-white/50 border-white/10 bg-white/5"
                    }`}>
                      {ready ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                      {board.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, board.id, board.title || "Untitled")}
                      disabled={deleting === board.id}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      {deleting === board.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="flex-1">
                  <p className="font-semibold text-white/80 group-hover:text-white transition-colors truncate">
                    {board.title || "Untitled Board"}
                  </p>
                  {board.prompt && (
                    <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">{board.prompt}</p>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-[10px] text-white/45 font-mono">
                  {scenes.length > 0 && (
                    <span className="flex items-center gap-1"><Film className="h-3 w-3" />{scenes.length} scenes</span>
                  )}
                  {meta.platform && <span className="capitalize">{String(meta.platform)}</span>}
                  {meta.duration && <span>{String(meta.duration)}s</span>}
                  <span className="ml-auto flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(board.created_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Open arrow */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-white/40" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BoardsList;
