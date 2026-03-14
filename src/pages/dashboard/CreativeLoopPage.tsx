import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import {
  RefreshCw, Upload, TrendingUp, Zap, Brain, Target,
  ArrowRight, ChevronRight, FileText, Settings, BarChart3,
  CheckCircle2, AlertTriangle, Sparkles, Loader2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const m = { fontFamily: "'DM Mono', monospace" } as const;

interface Pattern {
  id: string;
  pattern_key: string;
  variables: Record<string, string>;
  avg_ctr: number | null;
  avg_cpc: number | null;
  avg_roas: number | null;
  sample_size: number;
  confidence: number;
  is_winner: boolean;
  insight_text: string | null;
}

interface LoopStats {
  totalEntries: number;
  totalPatterns: number;
  winners: number;
  avgCtr: number | null;
  topMarket: string | null;
  topHook: string | null;
  topPlatform: string | null;
}

const CYCLE_STEPS = [
  { id: "import",  label: "Import Data",   icon: Upload,      color: "#60a5fa", desc: "Connect your ad performance data" },
  { id: "parse",   label: "Parse Creatives", icon: FileText,  color: "#a78bfa", desc: "AI extracts metadata from filenames" },
  { id: "learn",   label: "Find Patterns",  icon: Brain,      color: "#f472b6", desc: "AI discovers winning combinations" },
  { id: "predict", label: "Score & Brief",  icon: Target,     color: "#34d399", desc: "Predict before spending" },
  { id: "ship",    label: "Ship & Track",   icon: TrendingUp, color: "#fbbf24", desc: "Performance feeds back into the loop" },
];

export default function CreativeLoopPage() {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dt = useDashT(language);

  const [stats, setStats] = useState<LoopStats>({
    totalEntries: 0, totalPatterns: 0, winners: 0,
    avgCtr: null, topMarket: null, topHook: null, topPlatform: null,
  });
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ count: entryCount }, { data: patternData }] = await Promise.all([
        supabase.from("creative_entries" as any).select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("learned_patterns" as any).select("*").eq("user_id", user.id).order("confidence", { ascending: false }).limit(20),
      ]);

      const pats = (patternData || []) as unknown as Pattern[];
      setPatterns(pats);

      const winners = pats.filter(p => p.is_winner);
      const ctrs = pats.filter(p => p.avg_ctr).map(p => p.avg_ctr!);
      const avgCtr = ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : null;

      // Find top variables
      const count = (field: string) => {
        const counts: Record<string, number> = {};
        pats.forEach(p => { const v = (p.variables as any)?.[field]; if (v && v !== "unknown") counts[v] = (counts[v] || 0) + p.sample_size; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      };

      setStats({
        totalEntries: entryCount || 0,
        totalPatterns: pats.length,
        winners: winners.length,
        avgCtr,
        topMarket: count("market"),
        topHook: count("hook_type"),
        topPlatform: count("platform"),
      });

      // Determine active step
      if ((entryCount || 0) === 0) setActiveStep(0);
      else if (pats.length === 0) setActiveStep(2);
      else setActiveStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const runLearning = async () => {
    setLearning(true);
    try {
      const { data, error } = await supabase.functions.invoke("creative-loop", {
        body: { action: "learn", user_id: user.id },
      });
      if (error) throw error;
      toast.success(`Found ${data.patterns_found} patterns, ${data.winners} winners`);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Learning failed");
    } finally {
      setLearning(false);
    }
  };

  const StatCard = ({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: any }) => (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{sub}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #a78bfa, #f472b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={18} color="#000" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground" style={j}>Creative Performance Loop</h1>
              <p className="text-xs text-muted-foreground" style={m}>AI learns from your real ad data → calibrates every output</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/loop/settings")} className="gap-1.5">
            <Settings size={14} /> Nomenclature
          </Button>
          <Button size="sm" onClick={runLearning} disabled={learning || stats.totalEntries === 0} className="gap-1.5"
            style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#000" }}>
            {learning ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            {learning ? "Learning..." : "Run Learning"}
          </Button>
        </div>
      </div>

      {/* Cycle visualization */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 20px" }}>
        <p style={{ ...m, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>The Loop</p>
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
          {CYCLE_STEPS.map((step, i) => {
            const isActive = i <= activeStep;
            const isCurrent = i === activeStep;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", flex: i < CYCLE_STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: isCurrent ? `linear-gradient(135deg, ${step.color}, ${step.color}cc)` : isActive ? `${step.color}20` : "rgba(255,255,255,0.03)",
                    border: isCurrent ? `2px solid ${step.color}` : `1px solid ${isActive ? `${step.color}30` : "rgba(255,255,255,0.06)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isCurrent ? `0 0 20px ${step.color}30` : "none",
                    transition: "all 0.3s",
                  }}>
                    {isActive && i < activeStep ? (
                      <CheckCircle2 size={18} style={{ color: step.color }} />
                    ) : (
                      <step.icon size={18} style={{ color: isCurrent ? "#000" : isActive ? step.color : "rgba(255,255,255,0.2)" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.25)", marginBottom: 2 }}>{step.label}</p>
                    <p style={{ ...m, fontSize: 9, color: "rgba(255,255,255,0.2)", maxWidth: 90 }}>{step.desc}</p>
                  </div>
                </div>
                {i < CYCLE_STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, margin: "0 4px", marginBottom: 36,
                    background: i < activeStep ? `linear-gradient(90deg, ${step.color}, ${CYCLE_STEPS[i + 1].color})` : "rgba(255,255,255,0.05)",
                    borderRadius: 999, transition: "all 0.4s",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Creatives" value={String(stats.totalEntries)} color="#60a5fa" icon={FileText} />
        <StatCard label="Patterns" value={String(stats.totalPatterns)} sub={`${stats.winners} winners`} color="#a78bfa" icon={Brain} />
        <StatCard label="Avg CTR" value={stats.avgCtr ? `${(stats.avgCtr * 100).toFixed(2)}%` : "—"} color="#34d399" icon={TrendingUp} />
        <StatCard label="Top Platform" value={stats.topPlatform || "—"} color="#fbbf24" icon={Zap} />
      </div>

      {/* Empty state / Import CTA */}
      {stats.totalEntries === 0 && (
        <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 20, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Upload size={24} style={{ color: "#60a5fa" }} />
          </div>
          <h3 style={{ ...j, fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Start your loop</h3>
          <p style={{ ...m, fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 400, margin: "0 auto 20px", lineHeight: 1.6 }}>
            Import your ad performance data (CSV/XLSX from Meta, TikTok, or any platform). The AI will parse your creative filenames, discover patterns, and start calibrating every future output.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Button onClick={() => navigate("/dashboard/loop/import")} className="gap-2"
              style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)", color: "#000" }}>
              <Upload size={14} /> Import Performance Data
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/loop/settings")} className="gap-2">
              <Settings size={14} /> Configure Naming Convention
            </Button>
          </div>
        </div>
      )}

      {/* Winning patterns */}
      {patterns.filter(p => p.is_winner).length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} style={{ color: "#fbbf24" }} />
              <span style={{ ...j, fontSize: 14, fontWeight: 800, color: "#fff" }}>Winning Patterns</span>
              <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Outperform your avg CTR by 20%+</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {patterns.filter(p => p.is_winner).slice(0, 6).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TrendingUp size={14} style={{ color: "#34d399" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {Object.entries(p.variables).filter(([_, v]) => v !== "unknown").map(([k, v]) => (
                      <span key={k} style={{ ...m, fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {v}
                      </span>
                    ))}
                  </div>
                  {p.insight_text && (
                    <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{p.insight_text}</p>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    {p.avg_ctr && <span style={{ ...m, fontSize: 10, color: "#34d399" }}>CTR {(p.avg_ctr * 100).toFixed(2)}%</span>}
                    {p.avg_roas && <span style={{ ...m, fontSize: 10, color: "#fbbf24" }}>ROAS {p.avg_roas.toFixed(1)}x</span>}
                    <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{p.sample_size} samples</span>
                    <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{(p.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All patterns */}
      {patterns.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Brain size={16} style={{ color: "#a78bfa" }} />
            <span style={{ ...j, fontSize: 14, fontWeight: 800, color: "#fff" }}>All Learned Patterns</span>
            <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{patterns.length} discovered</span>
          </div>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Combination", "CTR", "CPC", "ROAS", "Samples", "Conf.", ""].map(h => (
                    <th key={h} style={{ ...m, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patterns.slice(0, 15).map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px", maxWidth: 200 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {Object.entries(p.variables).filter(([_, v]) => v !== "unknown").map(([k, v]) => (
                          <span key={k} style={{ ...m, fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)" }}>{v}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...m, fontSize: 12, color: p.is_winner ? "#34d399" : "rgba(255,255,255,0.5)", padding: "10px" }}>
                      {p.avg_ctr ? `${(p.avg_ctr * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "10px" }}>
                      {p.avg_cpc ? `$${p.avg_cpc.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "10px" }}>
                      {p.avg_roas ? `${p.avg_roas.toFixed(1)}x` : "—"}
                    </td>
                    <td style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "10px" }}>{p.sample_size}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ width: `${p.confidence * 100}%`, height: "100%", borderRadius: 999, background: p.confidence >= 0.6 ? "#34d399" : p.confidence >= 0.3 ? "#fbbf24" : "#f87171" }} />
                      </div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      {p.is_winner && <span style={{ ...m, fontSize: 9, color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "2px 6px", borderRadius: 999 }}>⚡ Winner</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => navigate("/dashboard/loop/import")}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,165,250,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
          <Upload size={18} style={{ color: "#60a5fa" }} />
          <div>
            <p style={{ ...j, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>Import Data</p>
            <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>CSV / XLSX from ad platforms</p>
          </div>
        </button>
        <button onClick={() => navigate("/dashboard/brief")}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
          <Sparkles size={18} style={{ color: "#a78bfa" }} />
          <div>
            <p style={{ ...j, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>Generate Brief</p>
            <p style={{ ...m, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Pre-calibrated with your data</p>
          </div>
        </button>
      </div>
    </div>
  );
}
