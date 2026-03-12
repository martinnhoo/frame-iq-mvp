import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, TrendingUp, TrendingDown, Star } from "lucide-react";
import type { DashT } from "@/i18n/dashboardTranslations";

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

interface MasteryLevel {
  name: keyof DashT;
  min: number;
  icon: string;
  color: string;
  glow: string;
}

const LEVELS: MasteryLevel[] = [
  { name: "gm_level_observer",   min: 0,   icon: "👁️",  color: "#94a3b8", glow: "rgba(148,163,184,0.3)" },
  { name: "gm_level_analyst",    min: 5,   icon: "🔍",  color: "#60a5fa", glow: "rgba(96,165,250,0.35)" },
  { name: "gm_level_strategist", min: 20,  icon: "🎯",  color: "#a78bfa", glow: "rgba(167,139,250,0.35)" },
  { name: "gm_level_producer",   min: 50,  icon: "🎬",  color: "#f472b6", glow: "rgba(244,114,182,0.35)" },
  { name: "gm_level_director",   min: 100, icon: "👑",  color: "#fbbf24", glow: "rgba(251,191,36,0.4)" },
];

function getLevel(totalActions: number) {
  let current = LEVELS[0];
  let nextLevel: MasteryLevel | null = null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalActions >= LEVELS[i].min) {
      current = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
      break;
    }
  }
  return { current, nextLevel };
}

interface Props {
  userId: string;
  dt: (key: keyof DashT) => string;
  totalActions: number;
}

export default function GamificationWidgets({ userId, dt, totalActions }: Props) {
  const [streak, setStreak] = useState(0);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const prevLevelRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      const [{ data }, { data: boards }] = await Promise.all([
        supabase.from("analyses").select("created_at").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(200),
        supabase.from("boards").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      ]);
      const activeDays = new Set<string>();
      data?.forEach(a => activeDays.add(new Date(a.created_at).toISOString().split("T")[0]));
      boards?.forEach(b => activeDays.add(new Date(b.created_at).toISOString().split("T")[0]));
      if (!activeDays.size) return;
      const sorted = Array.from(activeDays).sort().reverse();
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      let currentStreak = 0;
      const startDay = sorted[0] === today ? today : sorted[0] === yesterday ? yesterday : null;
      if (startDay) {
        let checkDate = new Date(startDay);
        while (activeDays.has(checkDate.toISOString().split("T")[0])) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        }
      }
      setStreak(currentStreak);
    };

    const fetchWeekly = async () => {
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);
      const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400000);
      const { data } = await supabase
        .from("analyses").select("result, created_at")
        .eq("user_id", userId).eq("status", "completed")
        .gte("created_at", startOfLastWeek.toISOString());
      if (!data?.length) return;
      let thisW: number[] = [], lastW: number[] = [];
      data.forEach(a => {
        const score = (a.result as Record<string, unknown>)?.hook_score as number;
        if (!score) return;
        if (new Date(a.created_at) >= startOfThisWeek) thisW.push(score);
        else lastW.push(score);
      });
      if (thisW.length && lastW.length) {
        setWeeklyDelta((thisW.reduce((a, b) => a + b, 0) / thisW.length) - (lastW.reduce((a, b) => a + b, 0) / lastW.length));
      }
    };

    fetchStreak();
    fetchWeekly();
  }, [userId]);

  const { current, nextLevel } = getLevel(totalActions);
  const progressToNext = nextLevel
    ? Math.min(((totalActions - current.min) / (nextLevel.min - current.min)) * 100, 100)
    : 100;

  // Animate progress bar on mount
  useEffect(() => {
    const t = setTimeout(() => setProgressWidth(progressToNext), 300);
    return () => clearTimeout(t);
  }, [progressToNext]);

  // Level-up animation
  useEffect(() => {
    if (prevLevelRef.current && prevLevelRef.current !== current.name) {
      setLevelUp(true);
      const t = setTimeout(() => setLevelUp(false), 2000);
      return () => clearTimeout(t);
    }
    prevLevelRef.current = current.name;
  }, [current.name]);

  const actionsToNext = nextLevel ? nextLevel.min - totalActions : 0;

  return (
    <div className="relative flex items-center gap-3 rounded-xl px-3.5 py-2 w-fit transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${levelUp ? current.color + "60" : "rgba(255,255,255,0.06)"}`,
        boxShadow: levelUp ? `0 0 20px ${current.glow}` : "none",
        transition: "border-color 0.4s, box-shadow 0.4s",
      }}>

      {/* Level-up burst */}
      {levelUp && (
        <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
          <div className="absolute inset-0 animate-ping rounded-xl opacity-20"
            style={{ background: `radial-gradient(circle, ${current.color}, transparent 70%)` }} />
        </div>
      )}

      {/* ── Level icon + name ── */}
      <div className="flex items-center gap-2">
        <span className={`text-base leading-none transition-transform duration-300 ${levelUp ? "scale-125" : "scale-100"}`}>
          {current.icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold leading-none" style={{ ...syne, color: current.color }}>
            {dt(current.name)}
            {levelUp && (
              <span className="ml-1.5 text-[9px] font-bold animate-bounce inline-block"
                style={{ color: current.color }}>↑ LEVEL UP</span>
            )}
          </span>

          {/* Progress bar */}
          {nextLevel && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-[4px] w-16 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressWidth}%`,
                    background: `linear-gradient(90deg, ${current.color}80, ${current.color})`,
                    transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: `0 0 6px ${current.glow}`,
                  }}
                />
              </div>
              <span className="text-[9px] leading-none" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>
                {actionsToNext}→
              </span>
            </div>
          )}
          {!nextLevel && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-2.5 h-2.5" style={{ color: current.color }} />
              <span className="text-[9px]" style={{ ...mono, color: current.color + "80" }}>MAX</span>
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-5 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* ── Streak ── */}
      <div className="flex items-center gap-1.5">
        <Flame
          className="h-3.5 w-3.5 transition-all duration-300"
          style={{
            color: streak >= 7 ? "#fb923c" : streak > 0 ? "rgba(251,146,60,0.65)" : "rgba(255,255,255,0.12)",
            filter: streak >= 7 ? "drop-shadow(0 0 4px rgba(251,146,60,0.6))" : "none",
          }}
        />
        {streak > 0 ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[12px] font-bold leading-none" style={{ ...mono, color: streak >= 7 ? "#fb923c" : "rgba(255,255,255,0.55)" }}>
              {streak}
            </span>
            <span className="text-[9px]" style={{ ...mono, color: "rgba(255,255,255,0.2)" }}>{dt("gm_streak_days")}</span>
          </div>
        ) : (
          <span className="text-[10px]" style={{ ...mono, color: "rgba(255,255,255,0.15)" }}>{dt("gm_streak")}</span>
        )}
      </div>

      {/* ── Weekly delta ── */}
      {weeklyDelta !== null && Math.abs(weeklyDelta) > 0.3 && (
        <>
          <div className="w-px h-5 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex items-center gap-1">
            {weeklyDelta > 0
              ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "rgba(52,211,153,0.7)" }} />
              : <TrendingDown className="h-3.5 w-3.5" style={{ color: "rgba(248,113,113,0.7)" }} />
            }
            <span className="text-[11px] font-bold leading-none" style={{
              ...mono,
              color: weeklyDelta > 0 ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.8)"
            }}>
              {weeklyDelta > 0 ? "+" : ""}{weeklyDelta.toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
