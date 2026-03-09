import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

const MARKET_AVERAGES: Record<string, number> = {
  ugc: 6.2,
  testimonial: 5.8,
  tutorial: 5.4,
  promo: 6.8,
  react: 7.1,
  general: 5.5,
};

function getInsight(score: number): { text: string; color: string } {
  if (score < 5) return { text: "Weak hook. Consider leading with a bolder claim.", color: "text-destructive" };
  if (score < 7) return { text: "Average hook. Test a pattern interrupt opening.", color: "text-yellow-400" };
  if (score < 9) return { text: "Strong hook. Above market average.", color: "text-green-400" };
  return { text: "Viral potential. Top 10% of analyzed creatives.", color: "text-purple-400" };
}

function getScoreColor(score: number, avg: number, top25: number, top10: number): string {
  if (score >= top10) return "text-purple-400";
  if (score >= top25) return "text-green-400";
  if (score >= avg) return "text-yellow-400";
  return "text-destructive";
}

interface HookBenchmarkCardProps {
  hookScore: number;
  format?: string;
}

export function HookBenchmarkCard({ hookScore, format }: HookBenchmarkCardProps) {
  const avg = MARKET_AVERAGES[format?.toLowerCase() || "general"] || MARKET_AVERAGES.general;
  const top25 = avg + 1.5;
  const top10 = avg + 2.5;
  const insight = getInsight(hookScore);
  const scoreColor = getScoreColor(hookScore, avg, top25, top10);

  const maxVal = Math.max(10, top10 + 1);

  const benchmarks = [
    { label: "Market Average", value: avg, color: "bg-yellow-500" },
    { label: "Top 25%", value: top25, color: "bg-green-500" },
    { label: "Top 10%", value: top10, color: "bg-purple-500" },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          How your hook compares
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score display */}
        <div className="text-center">
          <span className={`text-5xl font-bold ${scoreColor}`}>{hookScore.toFixed(1)}</span>
          <span className="text-xl text-muted-foreground"> / 10</span>
          <p className={`text-sm mt-2 ${insight.color}`}>{insight.text}</p>
        </div>

        {/* Benchmark bars */}
        <div className="space-y-4">
          {benchmarks.map((bench) => (
            <div key={bench.label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{bench.label}</span>
                <span className="text-foreground font-medium">{bench.value.toFixed(1)}</span>
              </div>
              <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                {/* Benchmark fill */}
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${bench.color} opacity-30`}
                  style={{ width: `${(bench.value / maxVal) * 100}%` }}
                />
                {/* Your score indicator */}
                <div
                  className={`absolute top-0 h-full w-1 rounded-full ${scoreColor.replace('text-', 'bg-')}`}
                  style={{ left: `${Math.min((hookScore / maxVal) * 100, 100)}%`, transform: 'translateX(-50%)' }}
                />
                {/* Reference line */}
                <div
                  className={`absolute top-0 h-full w-0.5 ${bench.color}`}
                  style={{ left: `${(bench.value / maxVal) * 100}%`, transform: 'translateX(-50%)' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-yellow-500" /> Average
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" /> Top 25%
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-purple-500" /> Top 10%
          </span>
          <span className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${scoreColor.replace('text-', 'bg-')}`} /> Your score
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
