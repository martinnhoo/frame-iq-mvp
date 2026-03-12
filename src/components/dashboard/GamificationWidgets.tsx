import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";
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
  totalActions: number;
}

export default function GamificationWidgets({ userId, dt, totalActions }: Props) {
  const [streak, setStreak] = useState(0);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);

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

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 w-fit"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>

      {/* ── Level ── */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm leading-none">{current.icon}</span>
        <span className="text-[10px] font-bold text-white/50" style={syne}>{dt(current.name)}</span>
        {nextLevel && (
          <div className="flex items-center gap-1.5 ml-0.5">
            <div className="h-[3px] w-10 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressToNext}%`, background: `${current.color}70` }} />
            </div>
            <span className="text-[9px] text-white/20" style={mono}>{nextLevel.min - totalActions}→</span>
          </div>
        )}
        {!nextLevel && <span className="text-[9px] text-yellow-500/40">MAX</span>}
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-white/06" />

      {/* ── Streak ── */}
      <div className="flex items-center gap-1">
        <Flame className="h-3 w-3" style={{ color: streak > 0 ? "rgba(251,146,60,0.55)" : "rgba(255,255,255,0.1)" }} />
        {streak > 0 ? (
          <span className="text-[10px] font-bold text-white/45" style={mono}>
            {streak}<span className="text-white/25 font-normal ml-0.5">{dt("gm_streak_days")}</span>
          </span>
        ) : (
          <span className="text-[10px] text-white/15" style={mono}>{dt("gm_streak")}</span>
        )}
      </div>

      {/* ── Weekly delta ── */}
      {weeklyDelta !== null && Math.abs(weeklyDelta) > 0.3 && (
        <>
          <div className="w-px h-3 bg-white/06" />
          <div className="flex items-center gap-0.5">
            {weeklyDelta > 0
              ? <TrendingUp className="h-3 w-3" style={{ color: "rgba(52,211,153,0.5)" }} />
              : <TrendingDown className="h-3 w-3" style={{ color: "rgba(248,113,113,0.5)" }} />}
            <span className="text-[10px] font-bold" style={{
              ...mono,
              color: weeklyDelta > 0 ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)"
            }}>
              {weeklyDelta > 0 ? "+" : ""}{weeklyDelta.toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
