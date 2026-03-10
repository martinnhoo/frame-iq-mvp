import { useEffect, useState, useRef } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Video, Play, Download, Loader2, Film, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface GeneratedVideo {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
  board_id?: string | null;
}

type GenStatus = "idle" | "generating" | "done" | "error" | "retry";

const PROGRESS_STEPS = [
  { label: "Preparing scenes...", pct: 12 },
  { label: "Generating visuals...", pct: 30 },
  { label: "Adding voice over...", pct: 55 },
  { label: "Assembling video...", pct: 75 },
  { label: "Finalizing...", pct: 90 },
  { label: "Almost done...", pct: 97 },
];

const VideosList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const location = useLocation();
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [genStatus, setGenStatus] = useState<GenStatus>("idle");
  const [genProgress, setGenProgress] = useState(0);
  const [genLabel, setGenLabel] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If navigated from board, auto-start generation
  const boardState = location.state as { boardId?: string; scenes?: unknown[]; production?: unknown } | null;

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("videos_generated").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setVideos(data as GeneratedVideo[]);
      setLoading(false);
    };
    run();
  }, [user.id]);

  const simulateProgress = () => {
    let stepIdx = 0;
    progressRef.current = setInterval(() => {
      if (stepIdx < PROGRESS_STEPS.length) {
        setGenProgress(PROGRESS_STEPS[stepIdx].pct);
        setGenLabel(PROGRESS_STEPS[stepIdx].label);
        stepIdx++;
      }
    }, 2800);
  };

  // 3-chances system
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [generatedVideoId, setGeneratedVideoId] = useState<string | null>(null);

  const handleGenerate = async (note?: string) => {
    if (!boardState?.boardId) return;
    if (attemptsLeft <= 0) {
      toast.error("No attempts remaining for this video");
      return;
    }
    setGenStatus("generating");
    setGenProgress(5);
    setGenLabel("Initializing...");
    setShowFeedback(false);
    simulateProgress();

    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          board_id: boardState.boardId,
          user_id: user.id,
          correction_note: note || undefined,
          attempt: 4 - attemptsLeft,
        },
      });

      if (progressRef.current) clearInterval(progressRef.current);

      if (error || data?.mock_mode) {
        setGenStatus("error");
        toast.error("Add ELEVENLABS_API_KEY to enable video generation");
        return;
      }

      setGenProgress(100);
      setGenLabel("Done!");
      setGenStatus("done");
      setAttemptsLeft(a => a - 1);
      if (data?.video_id) setGeneratedVideoId(data.video_id);

      if (data?.video_url) {
        const a = document.createElement("a");
        a.href = data.video_url;
        a.download = "frameiq-video.mp4";
        a.click();
        toast.success("Video ready — downloading...");
      }

      // Show feedback option if attempts remain
      if (attemptsLeft - 1 > 0) {
        setTimeout(() => setShowFeedback(true), 1500);
      }

      const { data: newVideos } = await supabase
        .from("videos_generated").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (newVideos) setVideos(newVideos as GeneratedVideo[]);

    } catch {
      if (progressRef.current) clearInterval(progressRef.current);
      setGenStatus("error");
      toast.error("Video generation failed");
    }
  };

  const handleRegenerate = () => {
    if (!feedbackNote.trim()) {
      toast.error("Please describe what to improve");
      return;
    }
    handleGenerate(feedbackNote);
    setFeedbackNote("");
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this video record?")) return;
    setDeleting(id);
    await supabase.from("videos_generated").delete().eq("id", id);
    setVideos(p => p.filter(v => v.id !== id));
    toast.success("Deleted");
    setDeleting(null);
  };

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
      <div className="h-8 w-40 bg-white/5 animate-pulse rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="aspect-video bg-white/5 animate-pulse rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Videos</h1>
          <p className="text-white/30 text-sm mt-0.5">{videos.length} generated</p>
        </div>
      </div>

      {/* Generation panel */}
      {boardState?.boardId && (
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Film className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {genStatus === "done" ? "Video generated!" : "Ready to generate"}
                </p>
                <p className="text-xs text-white/30">
                  {genStatus === "done" ? "Want changes? Describe them below." : "Video will be ready for download"}
                </p>
              </div>
            </div>
            {/* Attempts indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full transition-all ${
                    i < attemptsLeft ? "bg-green-400" : "bg-white/10"
                  }`}
                  title={`${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} left`}
                />
              ))}
              <span className="text-[10px] text-white/20 ml-1">{attemptsLeft} left</span>
            </div>
          </div>

          {genStatus === "generating" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{genLabel}</span>
                <span className="font-mono">{genProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
            </div>
          )}

          {genStatus === "error" && (
            <div className="flex items-start gap-2 text-xs text-red-400/80 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Add ELEVENLABS_API_KEY to Supabase Secrets to enable video generation.
            </div>
          )}

          {(genStatus === "idle" || genStatus === "error") && attemptsLeft > 0 && (
            <button
              onClick={() => handleGenerate()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              <Play className="h-4 w-4" />
              Generate video from board
            </button>
          )}

          {/* 3-chances feedback panel */}
          {genStatus === "done" && showFeedback && attemptsLeft > 0 && (
            <div className="space-y-3 border-t border-white/[0.06] pt-4">
              <p className="text-xs text-white/40">
                Not quite right? Describe what to improve and we'll regenerate. ({attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} left)
              </p>
              <textarea
                value={feedbackNote}
                onChange={e => setFeedbackNote(e.target.value)}
                placeholder="e.g. Make the hook stronger, change the background music, speed up the pacing..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 text-xs resize-none outline-none focus:border-white/20 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={!feedbackNote.trim() || genStatus === "generating"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/30 disabled:opacity-30 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate with corrections
                </button>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="px-4 py-2 rounded-xl text-white/30 text-xs hover:text-white/60 transition-colors"
                >
                  Keep this one
                </button>
              </div>
            </div>
          )}

          {attemptsLeft === 0 && genStatus === "done" && (
            <p className="text-xs text-white/20 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              All 3 attempts used — download your best version above
            </p>
          )}
        </div>
      )}

      {/* Video grid */}
      {videos.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-16 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <Video className="h-6 w-6 text-white/20" />
          </div>
          <div>
            <p className="text-white/50 font-medium">No videos yet</p>
            <p className="text-white/25 text-sm mt-1">Open a board and click "Generate video from this board"</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:border-white/20 transition-all"
            >
              <div className="aspect-video bg-white/[0.04] flex items-center justify-center relative">
                <Video className="h-8 w-8 text-white/10" />
                {video.status === "completed" && video.video_url && (
                  <a
                    href={video.video_url}
                    download
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                      <Play className="h-5 w-5 text-white ml-0.5" />
                    </div>
                  </a>
                )}
                {/* Status badge */}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  video.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  video.status === "rendering" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse" :
                  "bg-white/5 text-white/30 border-white/10"
                }`}>
                  {video.status}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white/70 truncate">{video.title || "Untitled Video"}</p>
                  <button
                    onClick={(e) => handleDelete(e, video.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"
                  >
                    {deleting === video.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-white/25 mt-1">{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</p>
                {video.status === "completed" && video.video_url && (
                  <a
                    href={video.video_url}
                    download
                    className="mt-3 flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download video
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideosList;
