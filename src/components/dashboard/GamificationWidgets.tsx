import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DashT } from "@/i18n/dashboardTranslations";

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

interface MasteryLevel {
  name: keyof DashT;
  min: number;
  icon: string;
  color: string;
}

const LEVELS: MasteryLevel[] = [
  { name: "gm_level_observer", min: 0, icon: "👁️", color: "#94a3b8" },
  { name: "gm_level_analyst", min: 5, icon: "🔍", color: "#60a5fa" },
  { name: "gm_level_strategist", min: 20, icon: "🎯", color: "#a78bfa" },
  { name: "gm_level_producer", min: 50, icon: "🎬", color: "#f472b6" },
  { name: "gm_level_director", min: 100, icon: "👑", color: "#fbbf24" },
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
  totalActions: number; // analyses + boards + hooks used
}

export default function GamificationWidgets({ userId, dt, totalActions }: Props) {
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [weeklyThis, setWeeklyThis] = useState<number | null>(null);
  const [weeklyLast, setWeeklyLast] = useState<number | null>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      // Get recent daily usage to compute streak
      const { data } = await supabase
        .from("analyses")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!data?.length) return;

      // Build set of active dates
      const activeDays = new Set<string>();
      data.forEach(a => {
        activeDays.add(new Date(a.created_at).toISOString().split("T")[0]);
      });

      // Also fetch boards
      const { data: boards } = await supabase
        .from("boards")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      boards?.forEach(b => {
        activeDays.add(new Date(b.created_at).toISOString().split("T")[0]);
      });

      // Compute current streak from today backwards
      const sorted = Array.from(activeDays).sort().reverse();
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      let currentStreak = 0;
      // Check if today or yesterday is in the set (allow grace for "today not yet used")
      const startDay = sorted[0] === today ? today : sorted[0] === yesterday ? yesterday : null;
      if (startDay) {
        let checkDate = new Date(startDay);
        while (activeDays.has(checkDate.toISOString().split("T")[0])) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        }
      }

      // Compute best streak
      let best = 0, run = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { run = 1; }
        else {
          const prev = new Date(sorted[i - 1]).getTime();
          const curr = new Date(sorted[i]).getTime();
          if (prev - curr <= 86400000 + 1000) { run++; }
          else { run = 1; }
        }
        best = Math.max(best, run);
      }

      setStreak(currentStreak);
      setBestStreak(best);
    };

    const fetchWeekly = async () => {
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);

      const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400000);

      const { data } = await supabase
        .from("analyses")
        .select("result, created_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("created_at", startOfLastWeek.toISOString())
        .order("created_at", { ascending: false });

      if (!data?.length) return;

      let thisWeekScores: number[] = [];
      let lastWeekScores: number[] = [];

      data.forEach(a => {
        const score = (a.result as Record<string, unknown>)?.hook_score as number;
        if (!score) return;
        const d = new Date(a.created_at);
        if (d >= startOfThisWeek) thisWeekScores.push(score);
        else lastWeekScores.push(score);
      });

      if (thisWeekScores.length) setWeeklyThis(thisWeekScores.reduce((a, b) => a + b, 0) / thisWeekScores.length);
      if (lastWeekScores.length) setWeeklyLast(lastWeekScores.reduce((a, b) => a + b, 0) / lastWeekScores.length);
    };

    fetchStreak();
    fetchWeekly();
  }, [userId]);

  const { current, nextLevel } = getLevel(totalActions);
  const progressToNext = nextLevel
    ? Math.min(((totalActions - current.min) / (nextLevel.min - current.min)) * 100, 100)
    : 100;

  const weeklyDelta = weeklyThis !== null && weeklyLast !== null ? weeklyThis - weeklyLast : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* ── STREAK ─────────────────────────── */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "#0f0f0f", border: `1px solid ${streak > 0 ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.07)"}` }}>
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 relative"
          style={{ background: streak > 0 ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${streak > 0 ? "rgba(251,146,60,0.25)" : "rgba(255,255,255,0.1)"}` }}>
          <Flame className="h-6 w-6" style={{ color: streak > 0 ? "#fb923c" : "rgba(255,255,255,0.2)" }} />
          {streak >= 3 && (
            <span className="absolute -top-1 -right-1 text-[10px] font-black px-1 rounded-full"
              style={{ background: "#fb923c", color: "#000" }}>{streak}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white" style={syne}>
            {streak > 0 ? `${streak} ${dt("gm_streak_days")}` : dt("gm_streak")}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5" style={mono}>
            {streak > 0
              ? `${dt("gm_streak_best")}: ${bestStreak} ${dt("gm_streak_days")} · ${dt("gm_streak_keep")}`
              : dt("gm_streak_start")}
          </p>
        </div>
      </div>

      {/* ── MASTERY LEVEL ─────────────────── */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "#0f0f0f", border: `1px solid ${current.color}20` }}>
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-xl"
          style={{ background: `${current.color}12`, border: `1px solid ${current.color}25` }}>
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white" style={syne}>{dt(current.name)}</p>
            {nextLevel && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ ...mono, color: current.color, background: `${current.color}18`, border: `1px solid ${current.color}30` }}>
                {dt("gm_level")}
              </span>
            )}
          </div>
          {nextLevel ? (
            <>
              <div className="h-1.5 rounded-full overflow-hidden w-full mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressToNext}%`, background: `linear-gradient(90deg, ${current.color}80, ${current.color})` }} />
              </div>
              <p className="text-[10px] text-white/25" style={mono}>
                {nextLevel.min - totalActions} {dt("gm_level_actions")} {dt("gm_level_next")} ({dt(nextLevel.name)})
              </p>
            </>
          ) : (
            <p className="text-[10px] font-bold" style={{ ...mono, color: current.color }}>
              MAX LEVEL ✨
            </p>
          )}
        </div>
      </div>

      {/* ── WEEKLY INSIGHT ────────────────── */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "#0f0f0f", border: `1px solid ${weeklyDelta !== null && weeklyDelta > 0 ? "rgba(52,211,153,0.2)" : weeklyDelta !== null && weeklyDelta < 0 ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)"}` }}>
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: weeklyDelta !== null && weeklyDelta > 0 ? "rgba(52,211,153,0.12)" : weeklyDelta !== null && weeklyDelta < 0 ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${weeklyDelta !== null && weeklyDelta > 0 ? "rgba(52,211,153,0.25)" : weeklyDelta !== null && weeklyDelta < 0 ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.1)"}`
          }}>
          {weeklyDelta !== null && weeklyDelta > 0
            ? <TrendingUp className="h-6 w-6" style={{ color: "#34d399" }} />
            : weeklyDelta !== null && weeklyDelta < 0
            ? <TrendingDown className="h-6 w-6" style={{ color: "#f87171" }} />
            : <Minus className="h-6 w-6 text-white/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white" style={syne}>{dt("gm_weekly")}</p>
          {weeklyThis !== null ? (
            <div className="space-y-0.5">
              <p className="text-[10px] text-white/40" style={mono}>
                {dt("gm_weekly_this")}: <span className="font-bold text-white/70">{weeklyThis.toFixed(1)}/10</span>
                {weeklyLast !== null && (
                  <> · {dt("gm_weekly_last")}: {weeklyLast.toFixed(1)}</>
                )}
              </p>
              {weeklyDelta !== null && (
                <p className="text-[10px] font-bold" style={{
                  ...mono,
                  color: weeklyDelta > 0.3 ? "#34d399" : weeklyDelta < -0.3 ? "#f87171" : "#fbbf24"
                }}>
                  {weeklyDelta > 0.3
                    ? `+${weeklyDelta.toFixed(1)} ${dt("gm_weekly_up")}`
                    : weeklyDelta < -0.3
                    ? `${weeklyDelta.toFixed(1)} ${dt("gm_weekly_down")}`
                    : dt("gm_weekly_stable")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-white/25" style={mono}>{dt("gm_weekly_no_data")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
