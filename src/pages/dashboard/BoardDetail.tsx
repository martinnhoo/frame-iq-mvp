import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronDown, Users, Target, Film, Settings, Loader2, Copy, Check, Download, Trash2, Shuffle, ChevronUp, Zap, Image, Sparkles, X } from "lucide-react";
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
  const [abLoading, setAbLoading] = useState(false);
  const [abVariants, setAbVariants] = useState<Array<{angle:string;hook:string;script_rewrite:string;predicted_score:number;hook_type:string;key_change:string}>>([]);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [abExpanded, setAbExpanded] = useState<number|null>(null);
  const [abCopied, setAbCopied] = useState<number|null>(null);

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

  const generateSceneImage = async (sceneIndex: number, visualDescription: string, sceneTitle?: string) => {
    setGeneratingImages(prev => ({ ...prev, [sceneIndex]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-scene-image", {
        body: { visual_description: visualDescription, scene_title: sceneTitle, scene_index: sceneIndex },
      });
      if (error) throw error;
      if (data?.url) {
        setSceneImages(prev => ({ ...prev, [sceneIndex]: data.url }));
      } else {
        throw new Error(data?.error || "No image returned");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast.error(msg.includes("Rate") ? msg : "Failed to generate image");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [sceneIndex]: false }));
    }
  };

  const generateAllImages = async (scenes: Record<string, unknown>[]) => {
    toast.info(`Generating ${scenes.length} reference images...`);
    for (let i = 0; i < scenes.length; i++) {
      await generateSceneImage(
        i,
        String(scenes[i].visual_description || ""),
        String(scenes[i].title || scenes[i].scene_title || `Scene ${i + 1}`)
      );
      // Small delay between requests
      if (i < scenes.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    toast.success("All reference images generated");
  };

  const generateAB = async () => {
    const voScript = (content?.vo_script as string) || (content?.script as string) || board?.prompt || "";
    if (!voScript.trim()) { toast.error("No VO script found to generate variants from"); return; }
    setAbLoading(true);
    setAbVariants([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ab-variants", {
        body: { script: voScript, product: board?.prompt?.slice(0,100), platform: (content?.platform as string) || "TikTok", market: (content?.market_flag as string) || "GLOBAL" },
      });
      if (error) throw error;
      setAbVariants(data.variants || []);
      if (data.mock_mode) toast.info("Add ANTHROPIC_API_KEY for real AI variants");
    } catch { toast.error("Variant generation failed"); } finally { setAbLoading(false); }
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
  // Support both Claude response structure (overview/hook) and mock structure (meta/strategy)
  const overview = (content?.overview as Record<string, unknown>) || (content?.meta as Record<string, unknown>) || {};
  const audience = (content?.audience as Record<string, unknown>) || {};
  const hook = (content?.hook as Record<string, unknown>) || {};
  const strategy = (content?.strategy as Record<string, unknown>) || {};
  const character = (content?.character as Record<string, unknown>) || {};
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

          </div>

          {/* Overview */}
           <Section id="overview" icon={Target} title="Campaign Overview" open={open.overview} onToggle={() => toggle("overview")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                ["Market", `${String(overview.market_flag ?? overview.market_code ?? "")} ${String(overview.market ?? "—")}`],
                ["Platform", String(overview.platform ?? "—")],
                ["Duration", `${String(overview.duration_seconds ?? overview.duration ?? "—")}s`],
                ["Aspect Ratio", String(overview.aspect_ratio ?? "—")],
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
                ["Hook Type", String(hook.type || strategy.hook_type || "—")],
                ["Hook Line", String(hook.hook_line || strategy.narrative_arc || "—")],
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
          <Section id="scenes" icon={Film} title={`Scenes (${scenes.length})`} open={open.scenes} onToggle={() => toggle("scenes")}
            badge={
              <button
                onClick={e => { e.stopPropagation(); generateAllImages(scenes); }}
                disabled={Object.values(generatingImages).some(Boolean)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all mr-2"
                style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
                title="Generate AI reference images for all scenes"
              >
                {Object.values(generatingImages).some(Boolean)
                  ? <><Loader2 className="h-3 w-3 animate-spin" />Generating...</>
                  : <><Sparkles className="h-3 w-3" />Generate Images</>}
              </button>
            }
          >
            <div className="space-y-3">
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
                >
                  {/* Scene image */}
                  {sceneImages[i] ? (
                    <div className="relative aspect-square">
                      <img src={sceneImages[i]} alt={`Scene ${i + 1}`}
                        className="w-full h-full object-cover" />
                      <button onClick={() => setSceneImages(prev => { const n = {...prev}; delete n[i]; return n; })}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.7)" }}>
                        <X className="h-3 w-3 text-white" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[9px] px-2 py-0.5 rounded"
                          style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.6)" }}>
                          AI Reference · Scene {i + 1}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-xs font-bold font-mono">
                          {String(scene.scene_number ?? i + 1).padStart(2, "0")}
                        </span>
                        {scene.timestamp && (
                          <span className="text-xs text-white/30 font-mono">{String(scene.timestamp)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!sceneImages[i] && (
                          <button
                            onClick={() => generateSceneImage(i, String(scene.visual_description || ""), String(scene.title || scene.scene_title || ""))}
                            disabled={generatingImages[i]}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all"
                            style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.15)" }}
                            title="Generate AI reference image for this scene"
                          >
                            {generatingImages[i]
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><Image className="h-3 w-3" /><span>Image</span></>}
                          </button>
                        )}
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
          {/* A/B Script Variants */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
                <Shuffle className="h-4 w-4 text-white/40" />
                A/B Script Variants
              </span>
              <button onClick={generateAB} disabled={abLoading}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 disabled:opacity-40 transition-all"
                style={{fontFamily:"'Syne',sans-serif"}}>
                {abLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</> : <><Zap className="h-3.5 w-3.5" /> Generate 3 Variants</>}
              </button>
            </div>
            {abVariants.length > 0 && (
              <div className="px-5 pb-5 space-y-3">
                {abVariants.map((v, i) => {
                  const exp = abExpanded === i;
                  const scoreColor = v.predicted_score >= 8 ? "text-green-400" : v.predicted_score >= 6.5 ? "text-yellow-400" : "text-white/50";
                  return (
                    <div key={i} className="rounded-xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                      <div className="flex items-start gap-3 p-4">
                        <div className="shrink-0 text-center w-10">
                          <div className={`text-sm font-bold font-mono ${scoreColor}`}>{v.predicted_score?.toFixed(1)}</div>
                          <div className="text-[9px] text-white/20 uppercase">/10</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-white" style={{fontFamily:"'Syne',sans-serif"}}>{v.angle}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/[0.08] text-white/25">{v.hook_type}</span>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed italic">"{v.hook}"</p>
                          <p className="text-[11px] text-white/25 mt-1">{v.key_change}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={async () => { await navigator.clipboard.writeText(v.script_rewrite); setAbCopied(i); toast.success("Script copied!"); setTimeout(() => setAbCopied(null), 2000); }}
                            className="h-7 w-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-white/30 hover:text-white transition-all">
                            {abCopied === i ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                          <button onClick={() => setAbExpanded(exp ? null : i)}
                            className="h-7 w-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-white/30 hover:text-white transition-all">
                            {exp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      {exp && (
                        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2" style={{fontFamily:"'DM Mono',monospace"}}>Full script</p>
                          <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">{v.script_rewrite}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {abVariants.length === 0 && !abLoading && (
              <div className="px-5 pb-5 text-center">
                <p className="text-xs text-white/20">Click "Generate 3 Variants" to create A/B test versions of this board's VO script</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BoardDetail;
