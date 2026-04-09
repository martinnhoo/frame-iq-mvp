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
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

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
  { id: "parse",   label: "Parse Creatives", icon: FileText,  color: "#0ea5e9", desc: "AI extracts metadata from filenames" },
  { id: "learn",   label: "Find Patterns",  icon: Brain,      color: "#06b6d4", desc: "AI discovers winning combinations" },
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
        <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{sub}</p>}
    </div>
  );


  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = stats.totalEntries > 0;
  const hasPatterns = stats.totalPatterns > 0;

  return (
    <div style={{ padding: "24px 24px 60px", maxWidth: 960, margin: "0 auto", ...j }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={16} color="#000" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Performance Loop</h1>
          </div>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>
            AI learns from your ad data — every import makes the next brief smarter
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigate("/dashboard/loop/settings")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Settings size={13} /> Naming rules
          </button>
          <button onClick={runLearning} disabled={learning || !hasData}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: hasData ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.05)", color: hasData ? "#000" : "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, cursor: hasData ? "pointer" : "not-allowed", border: "none" }}>
            {learning ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {learning ? "Learning..." : "Run Learning"}
          </button>
        </div>
      </div>

      {/* ── Coming soon banner — subtle ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", marginBottom: 24, width: "fit-content" }}>
        <span style={{ fontSize: 12 }}>⚡</span>
        <span style={{ ...m, fontSize: 12, fontWeight: 600, color: "rgba(251,191,36,0.65)", letterSpacing: "0.06em" }}>Coming soon: direct Meta Ads connection</span>
      </div>

      {/* ── Loop steps — horizontal timeline ── */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, padding: "20px 24px", marginBottom: 20 }}>
        <p style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.18)", marginBottom: 18 }}>The loop</p>
        <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }}>
          {CYCLE_STEPS.map((step, i) => {
            const done = i < activeStep;
            const current = i === activeStep;
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "flex-start", flex: i < CYCLE_STEPS.length - 1 ? 1 : 0, minWidth: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 72 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: current ? `linear-gradient(135deg,${step.color},${step.color}bb)` : done ? `${step.color}18` : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${current ? step.color : done ? `${step.color}35` : "rgba(255,255,255,0.06)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: current ? `0 0 16px ${step.color}30` : "none",
                    transition: "all 0.3s",
                  }}>
                    {done ? <CheckCircle2 size={16} style={{ color: step.color }} /> : <step.icon size={16} style={{ color: current ? "#000" : done ? step.color : "rgba(255,255,255,0.18)" }} />}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: current || done ? "#fff" : "rgba(255,255,255,0.22)", marginBottom: 2, whiteSpace: "nowrap" }}>{step.label}</p>
                    <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.4, maxWidth: 80 }}>{step.desc}</p>
                  </div>
                </div>
                {i < CYCLE_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1.5, margin: "20px 6px 0", background: done ? `linear-gradient(90deg,${step.color}80,${CYCLE_STEPS[i+1].color}80)` : "rgba(255,255,255,0.05)", borderRadius: 999, transition: "all 0.4s" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Creatives", value: String(stats.totalEntries), color: "#60a5fa", icon: FileText },
          { label: "Patterns", value: String(stats.totalPatterns), sub: `${stats.winners} winning`, color: "#0ea5e9", icon: Brain },
          { label: "Avg CTR", value: stats.avgCtr ? `${(stats.avgCtr*100).toFixed(2)}%` : "—", color: "#34d399", icon: TrendingUp },
          { label: "Top Platform", value: stats.topPlatform || "—", color: "#fbbf24", icon: Zap },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <s.icon size={13} style={{ color: s.color, opacity: 0.7 }} />
              <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{s.label}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
            {s.sub && <p style={{ ...m, fontSize: 12, color: s.color, marginTop: 4, opacity: 0.7 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {!hasData && (
        <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 18, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Upload size={22} style={{ color: "#60a5fa" }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Start your loop</h3>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.4)", maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.7 }}>
            Import a CSV from Meta, TikTok, or any platform. The AI parses your creative filenames, finds winning patterns, and calibrates every future output.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/dashboard/loop/import")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, background: "linear-gradient(135deg,#60a5fa,#0ea5e9)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" }}>
              <Upload size={14} /> Import Data
            </button>
            <button onClick={() => navigate("/dashboard/loop/settings")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
              <Settings size={14} /> Naming Rules
            </button>
          </div>
        </div>
      )}

      {/* ── Winning patterns ── */}
      {patterns.filter(p => p.is_winner).length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, padding: "20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Sparkles size={14} style={{ color: "#fbbf24" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Winning Patterns</span>
            <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>outperform avg CTR by 20%+</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {patterns.filter(p => p.is_winner).slice(0, 6).map(p => (
              <div key={p.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <TrendingUp size={12} style={{ color: "#34d399" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5 }}>
                    {Object.entries(p.variables).filter(([_, v]) => v !== "unknown").map(([k, v]) => (
                      <span key={k} style={{ ...m, fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>{v as string}</span>
                    ))}
                  </div>
                  {p.insight_text && <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 5 }}>{p.insight_text}</p>}
                  <div style={{ display: "flex", gap: 12 }}>
                    {p.avg_ctr && <span style={{ ...m, fontSize: 12, color: "#34d399" }}>CTR {(p.avg_ctr*100).toFixed(2)}%</span>}
                    {p.avg_roas && <span style={{ ...m, fontSize: 12, color: "#fbbf24" }}>ROAS {p.avg_roas.toFixed(1)}x</span>}
                    <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{p.sample_size} samples</span>
                    <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{(p.confidence*100).toFixed(0)}% conf</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All patterns table ── */}
      {hasPatterns && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, padding: "20px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Brain size={14} style={{ color: "#0ea5e9" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>All Patterns</span>
            <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{patterns.length} discovered</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Combination", "CTR", "ROAS", "Samples", "Confidence", ""].map(h => (
                    <th key={h} style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.18)", padding: "6px 10px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patterns.slice(0, 15).map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {Object.entries(p.variables).filter(([_, v]) => v !== "unknown").map(([k, v]) => (
                          <span key={k} style={{ ...m, fontSize: 12, padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>{v as string}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...m, fontSize: 12, color: p.avg_ctr ? "#34d399" : "rgba(255,255,255,0.2)", padding: "10px" }}>
                      {p.avg_ctr ? `${(p.avg_ctr*100).toFixed(2)}%` : "—"}
                    </td>
                    <td style={{ ...m, fontSize: 12, color: p.avg_roas ? "#fbbf24" : "rgba(255,255,255,0.2)", padding: "10px" }}>
                      {p.avg_roas ? `${p.avg_roas.toFixed(1)}x` : "—"}
                    </td>
                    <td style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "10px" }}>{p.sample_size}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ width: 60, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p.confidence*100}%`, background: p.is_winner ? "#34d399" : "#0ea5e9", borderRadius: 999 }} />
                      </div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      {p.is_winner && <span style={{ ...m, fontSize: 12, padding: "2px 7px", borderRadius: 999, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>WIN</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}