import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";
import type { DashT } from "@/i18n/dashboardTranslations";

const mono = { fontFamily: "'DM Mono', monospace" } as const;

interface MasteryLevel {
  name: keyof DashT;
  min: number;
  icon: string;
}

const LEVELS: MasteryLevel[] = [
  { name: "gm_level_observer", min: 0, icon: "👁️" },
  { name: "gm_level_analyst", min: 5, icon: "🔍" },
  { name: "gm_level_strategist", min: 20, icon: "🎯" },
  { name: "gm_level_producer", min: 50, icon: "🎬" },
  { name: "gm_level_director", min: 100, icon: "👑" },
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
    fetchStreak();
  }, [userId]);

  const { current, nextLevel } = getLevel(totalActions);
  const progressToNext = nextLevel
    ? Math.min(((totalActions - current.min) / (nextLevel.min - current.min)) * 100, 100)
    : 100;

  // Render as a subtle inline strip
  return (
    <div className="flex items-center gap-3 flex-wrap" style={mono}>
      {/* Level badge */}
      <span className="inline-flex items-center gap-1 text-[10px] text-white/30 select-none">
        <span className="text-xs">{current.icon}</span>
        <span className="text-white/45 font-medium">{dt(current.name)}</span>
        {nextLevel && (
          <>
            <span className="mx-0.5 text-white/10">·</span>
            <span className="text-white/20">{nextLevel.min - totalActions} {dt("gm_level_actions")} → {dt(nextLevel.name)}</span>
          </>
        )}
        {!nextLevel && <span className="text-[9px] text-yellow-500/50">✨</span>}
      </span>

      {/* Mini progress bar */}
      {nextLevel && (
        <div className="h-[3px] w-16 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-full rounded-full" style={{ width: `${progressToNext}%`, background: "rgba(167,139,250,0.4)" }} />
        </div>
      )}

      {/* Divider */}
      <span className="text-white/08 text-[10px] select-none">|</span>

      {/* Streak */}
      {streak > 0 ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
          <Flame className="h-3 w-3" style={{ color: "rgba(251,146,60,0.5)" }} />
          <span className="text-white/40 font-medium">{streak}</span>
          <span className="text-white/20">{dt("gm_streak_days")}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] text-white/15">
          <Flame className="h-3 w-3" style={{ color: "rgba(255,255,255,0.1)" }} />
          <span>{dt("gm_streak_start")}</span>
        </span>
      )}
    </div>
  );
}
