import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronDown, Users, Target, Film, Settings, Loader2, Copy, Check, Download, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface BoardData {
  id: string;
  title: string;
  prompt: string;
  status: string;
  content: Record<string, unknown> | null;
  created_at: string;
}

const Section = ({
  id, icon: Icon, title, open, onToggle, children, badge,
}: {
  id: string; icon: React.ElementType; title: string; open: boolean;
  onToggle: () => void; children: React.ReactNode; badge?: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
    >
      <span className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
        <Icon className="h-4 w-4 text-white/40" />
        {title}
      </span>
      <span className="flex items-center gap-2">
        {badge}
        <ChevronDown className={`h-4 w-4 text-white/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </span>
    </button>
    {open && <div className="px-5 pb-5 pt-1">{children}</div>}
  </div>
);

const BoardDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true, audience: false, strategy: false, scenes: true, production: false,
  });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.from("boards").select("*").eq("id", id).single();
      if (data) setBoard(data as BoardData);
      setLoading(false);
    };
    run();
  }, [id]);

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this board? This cannot be undone.")) return;
    await supabase.from("boards").delete().eq("id", id);
    toast.success("Board deleted");
    navigate("/dashboard/boards");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-5 w-5 animate-spin text-white/30" />
    </div>
  );
  if (!board) return (
    <div className="p-8 text-center text-white/30">Board not found</div>
  );

  const content = board.content as Record<string, unknown> | null;
  const meta = (content?.meta as Record<string, unknown>) || {};
  const audience = (content?.audience as Record<string, unknown>) || {};
  const strategy = (content?.strategy as Record<string, unknown>) || {};
  const scenes = ((content?.scenes || []) as Record<string, unknown>[]);
  const production = (content?.production as Record<string, unknown>) || {};

  // Format production notes as readable key-value, not raw JSON
  const prodLines = Object.entries(production).filter(([, v]) => v !== null && v !== undefined);

  const fullScript = scenes
    .map((s, i) =>
      `SCENE ${i + 1} (${String(s.timestamp || "")})\n` +
      `VISUAL: ${String(s.visual_description || "")}\n` +
      (s.vo_script ? `VO: "${String(s.vo_script)}"\n` : "") +
      (s.onscreen_text ? `TEXT: ${String(s.onscreen_text)}\n` : "")
    )
    .join("\n");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate("/dashboard/boards")}
          className="mt-1 h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
            {board.title || "Untitled Board"}
          </h1>
          <p className="text-white/30 text-sm mt-0.5 line-clamp-1">{board.prompt}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize border ${
            board.status === "completed"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-white/10 bg-white/5 text-white/40"
          }`}>
            {board.status}
          </span>
          <button
            onClick={handleDelete}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!content ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center text-white/30 text-sm">
          This board has no content yet.
        </div>
      ) : (
        <>
          {/* Quick export strip */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => copyText(fullScript, "script")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white text-xs transition-all"
            >
              {copied === "script" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              Copy full script
            </button>
            <button
              onClick={() => {
                const blob = new Blob([fullScript], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${board.title || "board"}.txt`;
                a.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white text-xs transition-all"
            >
              <Download className="h-3 w-3" />
              Download .txt
            </button>
            <button
              onClick={() => navigate("/dashboard/videos", { state: { boardId: board.id, scenes, production } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-all"
            >
              <Play className="h-3 w-3" />
              Generate video from this board
            </button>
          </div>

          {/* Overview */}
          <Section id="overview" icon={Target} title="Campaign Overview" open={open.overview} onToggle={() => toggle("overview")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                ["Market", `${String(meta.market_flag ?? "")} ${String(meta.market ?? "—")}`],
                ["Platform", String(meta.platform ?? "—")],
                ["Duration", `${String(meta.duration ?? "—")}s`],
                ["Aspect Ratio", String(meta.aspect_ratio ?? "—")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/30 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white capitalize">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Audience */}
          <Section id="audience" icon={Users} title="Target Audience" open={open.audience} onToggle={() => toggle("audience")}>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-xs text-white/30 mb-1">Age Range</p>
                <p className="text-white font-medium">{String(audience.age_range || "—")}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-xs text-white/30 mb-1">Gender</p>
                <p className="text-white font-medium capitalize">{String(audience.gender_skew || "—")}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3 sm:col-span-2">
                <p className="text-xs text-white/30 mb-1.5">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {(audience.interests as string[] || []).map((int, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-white/[0.08] text-white/60 text-xs">{int}</span>
                  ))}
                </div>
              </div>
              {audience.cultural_notes && (
                <div className="rounded-xl bg-white/[0.04] p-3 sm:col-span-2">
                  <p className="text-xs text-white/30 mb-1">Cultural Notes</p>
                  <p className="text-white/60 text-sm">{String(audience.cultural_notes)}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Strategy */}
          <Section id="strategy" icon={Target} title="Creative Strategy" open={open.strategy} onToggle={() => toggle("strategy")}>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Hook Type", String(strategy.hook_type || "—")],
                ["Narrative Arc", String(strategy.narrative_arc || "—")],
                ["Pacing", String(strategy.pacing || "—")],
                ["CTA", String(strategy.cta_type || "—")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/30 mb-1">{label}</p>
                  <p className="text-white font-medium capitalize">{value}</p>
                </div>
              ))}
              {strategy.key_message && (
                <div className="rounded-xl bg-white/[0.04] p-3 sm:col-span-2">
                  <p className="text-xs text-white/30 mb-1">Key Message</p>
                  <p className="text-white/70 italic">"{String(strategy.key_message)}"</p>
                </div>
              )}
            </div>
          </Section>

          {/* Scenes — main event */}
          <Section id="scenes" icon={Film} title={`Scenes (${scenes.length})`} open={open.scenes} onToggle={() => toggle("scenes")}>
            <div className="space-y-3">
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-xs font-bold font-mono">
                        {String(scene.scene_number ?? i + 1).padStart(2, "0")}
                      </span>
                      {scene.timestamp && (
                        <span className="text-xs text-white/30 font-mono">{String(scene.timestamp)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => copyText(
                        `Scene ${i + 1}: ${String(scene.visual_description || "")}\n${scene.vo_script ? `VO: "${String(scene.vo_script)}"` : ""}`,
                        `scene-${i}`
                      )}
                      className="text-white/20 hover:text-white/60 transition-colors"
                    >
                      {copied === `scene-${i}` ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-sm text-white/80 mb-2">{String(scene.visual_description || "")}</p>
                  {scene.vo_script && (
                    <div className="rounded-lg bg-white/[0.06] border border-white/[0.06] px-3 py-2 mt-2">
                      <p className="text-xs text-white/30 mb-1">Voice Over</p>
                      <p className="text-sm text-white/70 italic">"{String(scene.vo_script)}"</p>
                    </div>
                  )}
                  {scene.onscreen_text && (
                    <div className="mt-2 rounded-lg bg-white/[0.06] px-3 py-2">
                      <p className="text-xs text-white/30 mb-1">On-screen Text</p>
                      <p className="text-sm text-white font-mono">{String(scene.onscreen_text)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Production — now rendered clean, not raw JSON */}
          {prodLines.length > 0 && (
            <Section id="production" icon={Settings} title="Production Notes" open={open.production} onToggle={() => toggle("production")}>
              <div className="grid sm:grid-cols-2 gap-3">
                {prodLines.map(([key, value]) => {
                  const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                  const displayVal = Array.isArray(value) ? (value as string[]).join(", ") : String(value);
                  return (
                    <div key={key} className="rounded-xl bg-white/[0.04] p-3">
                      <p className="text-xs text-white/30 mb-1">{label}</p>
                      <p className="text-sm text-white/80 font-medium">{displayVal}</p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

export default BoardDetail;
