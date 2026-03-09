import { Badge } from "@/components/ui/badge";

type HookLevel = "low" | "medium" | "high" | "viral";

function getHookLevel(score: number | null): HookLevel {
  if (!score || score < 5) return "low";
  if (score < 7) return "medium";
  if (score < 9) return "high";
  return "viral";
}

const HOOK_CONFIG: Record<HookLevel, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-destructive/10 text-destructive border-destructive/30" },
  medium: { label: "Medium", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  high: { label: "High", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  viral: { label: "Viral", className: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
};

interface HookStrengthBadgeProps {
  score?: number | null;
  strength?: string | null;
}

export function HookStrengthBadge({ score, strength }: HookStrengthBadgeProps) {
  const level = strength
    ? (["low", "medium", "high", "viral"].includes(strength) ? strength as HookLevel : getHookLevel(score ?? null))
    : getHookLevel(score ?? null);

  const config = HOOK_CONFIG[level];

  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export { getHookLevel, HOOK_CONFIG };
export type { HookLevel };
