import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { DashT } from "@/i18n/dashboardTranslations";

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const sans = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

interface MasteryLevel {
  name: keyof DashT;
  min: number;
  icon: string;
  color: string;
  bgColor: string;
  trackColor: string;
  label: string;
}

const LEVELS: MasteryLevel[] = [
  { name: "gm_level_observer",   min: 0,   icon: "👁️",  color: "#94a3b8", bgColor: "rgba(148,163,184,0.10)", trackColor: "rgba(148,163,184,0.15)", label: "Observer"   },
  { name: "gm_level_analyst",    min: 5,   icon: "🔍",  color: "#60a5fa", bgColor: "rgba(96,165,250,0.10)",  trackColor: "rgba(96,165,250,0.15)",  label: "Analyst"    },
  { name: "gm_level_strategist", min: 20,  icon: "🎯",  color: "#a78bfa", bgColor: "rgba(167,139,250,0.10)", trackColor: "rgba(167,139,250,0.15)", label: "Strategist" },
  { name: "gm_level_producer",   min: 50,  icon: "🎬",  color: "#f472b6", bgColor: "rgba(244,114,182,0.10)", trackColor: "rgba(244,114,182,0.15)", label: "Producer"   },
  { name: "gm_level_director",   min: 100, icon: "👑",  color: "#fbbf24", bgColor: "rgba(251,191,36,0.10)",  trackColor: "rgba(251,191,36,0.15)",  label: "Director"   },
];

function getLevel(n: number) {
  let cur = LEVELS[0], next: MasteryLevel | null = null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (n >= LEVELS[i].min) { cur = LEVELS[i]; next = LEVELS[i + 1] || null; break; }
  }
  return { cur, next };
}

interface Props { userId: string; dt: (k: keyof DashT) => string; totalActions: number; }

export default function GamificationWidgets({ userId, dt, totalActions }: Props) {
  const [streak, setStreak]             = useState(0);
  const [weeklyDelta, setWeeklyDelta]   = useState<number | null>(null);
  const [levelUp, setLevelUp]           = useState(false);
  const [barWidth, setBarWidth]         = useState(0);
  const [particles, setParticles]       = useState(false);
  const prevLevel                        = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: an }, { data: bo }] = await Promise.all([
        supabase.from("analyses").select("created_at").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(200),
        supabase.from("boards").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      ]);
      const days = new Set<string>();
      an?.forEach(a => days.add(new Date(a.created_at).toISOString().slice(0,10)));
      bo?.forEach(b => days.add(new Date(b.created_at).toISOString().slice(0,10)));
      if (!days.size) return;
      const sorted = Array.from(days).sort().reverse();
      const today = new Date().toISOString().slice(0,10);
      const yest  = new Date(Date.now()-86400000).toISOString().slice(0,10);
      let s = 0, start = sorted[0]===today ? today : sorted[0]===yest ? yest : null;
      if (start) { let d = new Date(start); while (days.has(d.toISOString().slice(0,10))) { s++; d = new Date(d.getTime()-86400000); } }
      setStreak(s);
    })();

    (async () => {
      const now = new Date();
      const thisW = new Date(now); thisW.setDate(now.getDate()-now.getDay()); thisW.setHours(0,0,0,0);
      const lastW = new Date(thisW.getTime()-7*86400000);
      const { data } = await supabase.from("analyses").select("result,created_at").eq("user_id", userId).eq("status","completed").gte("created_at", lastW.toISOString());
      if (!data?.length) return;
      let tw: number[]=[], lw: number[]=[];
      data.forEach(a => { const sc=(a.result as Record<string,unknown>)?.hook_score as number; if(!sc) return; new Date(a.created_at)>=thisW ? tw.push(sc) : lw.push(sc); });
      if (tw.length && lw.length) setWeeklyDelta(tw.reduce((a,b)=>a+b,0)/tw.length - lw.reduce((a,b)=>a+b,0)/lw.length);
    })();
  }, [userId]);

  const { cur, next } = getLevel(totalActions);
  const pct = next ? Math.min(((totalActions - cur.min) / (next.min - cur.min)) * 100, 100) : 100;

  useEffect(() => { const t = setTimeout(()=>setBarWidth(pct), 400); return ()=>clearTimeout(t); }, [pct]);

  useEffect(() => {
    if (prevLevel.current && prevLevel.current !== cur.name) {
      setLevelUp(true); setParticles(true);
      setTimeout(()=>setLevelUp(false), 2500);
      setTimeout(()=>setParticles(false), 1200);
    }
    prevLevel.current = cur.name;
  }, [cur.name]);

  const toNext = next ? next.min - totalActions : 0;
  const hotStreak = streak >= 7;

  return (
    <div
      className="relative flex items-center gap-0 rounded-2xl overflow-hidden select-none"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${levelUp ? cur.color+"55" : "rgba(255,255,255,0.07)"}`,
        boxShadow: levelUp ? `0 0 24px ${cur.color}30, inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "border-color .5s, box-shadow .5s",
      }}
    >
      {/* Shimmer on level-up */}
      {levelUp && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, transparent 40%, ${cur.color}18 50%, transparent 60%)`,
              animation: "shimmer 0.8s ease-in-out",
            }}
          />
        </div>
      )}

      {/* Particle burst */}
      {particles && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full"
              style={{
                background: cur.color,
                left: `${20 + i*10}%`, top: "50%",
                animation: `particle-${i%3} 0.9s ease-out forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* ── LEVEL SECTION ── */}
      <a href="/levels" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer" }}>
        {/* Icon badge */}
        <div
          className="relative flex items-center justify-center w-8 h-8 rounded-xl shrink-0 transition-transform duration-300"
          style={{
            background: cur.bgColor,
            border: `1px solid ${cur.color}25`,
            transform: levelUp ? "scale(1.2) rotate(-5deg)" : "scale(1)",
          }}
        >
          <span className="text-sm leading-none">{cur.icon}</span>
          {levelUp && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
              style={{ background: cur.color }}>
              <Zap className="w-2 h-2 text-black" />
            </div>
          )}
        </div>

        {/* Level info */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold leading-none tracking-wide" style={{ ...sans, color: cur.color }}>
              {dt(cur.name)}
            </span>
            {levelUp && (
              <span
                className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md leading-none"
                style={{ background: cur.color, color: "#000", animation: "pop 0.3s ease-out" }}
              >
                LEVEL UP!
              </span>
            )}
          </div>

          {/* Progress bar */}
          {next ? (
            <div className="flex items-center gap-2">
              {/* Track */}
              <div className="relative h-[5px] w-20 rounded-full overflow-hidden" style={{ background: cur.trackColor }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${cur.color}90, ${cur.color})`,
                    boxShadow: `0 0 8px ${cur.color}60`,
                    transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
                {/* Glow dot at tip */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full -translate-x-1/2"
                  style={{
                    left: `${barWidth}%`,
                    background: cur.color,
                    boxShadow: `0 0 6px ${cur.color}`,
                    transition: "left 1.2s cubic-bezier(0.34,1.56,0.64,1)",
                    opacity: barWidth > 2 ? 1 : 0,
                  }}
                />
              </div>
              <span className="text-[10px] leading-none shrink-0" style={{ ...mono, color: "rgba(255,255,255,0.25)" }}>
                {toNext} to {next.icon}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="h-[5px] w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${cur.color}60, ${cur.color})` }} />
              <span className="text-[9px] font-bold" style={{ ...mono, color: cur.color + "80" }}>MAX</span>
            </div>
          )}
        </div>
      </a>

      {/* ── DIVIDER ── */}
      <div className="w-px self-stretch my-2" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* ── STREAK SECTION ── */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{
            background: streak > 0 ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${streak > 0 ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.05)"}`,
          }}
        >
          <Flame
            className="w-4 h-4"
            style={{
              color: hotStreak ? "#fb923c" : streak > 0 ? "rgba(251,146,60,0.7)" : "rgba(255,255,255,0.15)",
              filter: hotStreak ? "drop-shadow(0 0 5px rgba(251,146,60,0.7))" : "none",
              transition: "color .3s, filter .3s",
            }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          {streak > 0 ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-[14px] font-black leading-none" style={{ ...mono, color: hotStreak ? "#fb923c" : "rgba(255,255,255,0.7)" }}>
                  {streak}
                </span>
                <span className="text-[10px] leading-none" style={{ ...sans, color: "rgba(255,255,255,0.3)" }}>
                  {dt("gm_streak_days")}
                </span>
              </div>
              <span className="text-[9px] leading-none" style={{ ...sans, color: hotStreak ? "rgba(251,146,60,0.6)" : "rgba(255,255,255,0.18)" }}>
                {hotStreak ? "on fire 🔥" : "keep going"}
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] leading-none" style={{ ...sans, color: "rgba(255,255,255,0.2)" }}>{dt("gm_streak")}</span>
              <span className="text-[9px] leading-none" style={{ ...sans, color: "rgba(255,255,255,0.1)" }}>start today</span>
            </>
          )}
        </div>
      </div>

      {/* ── WEEKLY DELTA ── (only if meaningful) */}
      {weeklyDelta !== null && Math.abs(weeklyDelta) > 0.3 && (
        <>
          <div className="w-px self-stretch my-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
              style={{
                background: weeklyDelta > 0 ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
                border: `1px solid ${weeklyDelta > 0 ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)"}`,
              }}
            >
              {weeklyDelta > 0
                ? <TrendingUp className="w-4 h-4" style={{ color: "#34d399" }} />
                : <TrendingDown className="w-4 h-4" style={{ color: "#f87171" }} />
              }
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-black leading-none" style={{ ...mono, color: weeklyDelta > 0 ? "#34d399" : "#f87171" }}>
                {weeklyDelta > 0 ? "+" : ""}{weeklyDelta.toFixed(1)}
              </span>
              <span className="text-[9px] leading-none" style={{ ...sans, color: "rgba(255,255,255,0.2)" }}>vs last week</span>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
        @keyframes pop { 0% { transform: scale(0.5); opacity:0; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity:1; } }
      `}</style>
    </div>
  );
}
