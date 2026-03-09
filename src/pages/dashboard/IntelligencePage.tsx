import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Eye, Zap } from "lucide-react";

const creativeModels = [
  { name: "Problem → Solution", pct: 34, trend: "+5%" },
  { name: "UGC Testimonial", pct: 28, trend: "+12%" },
  { name: "Before / After", pct: 18, trend: "-3%" },
  { name: "Listicle", pct: 12, trend: "+1%" },
  { name: "Demo / Tutorial", pct: 8, trend: "+2%" },
];

const hookPatterns = [
  { name: "Question-based", score: 8.4, example: '"Are you still paying $X for…?"' },
  { name: "Bold statement", score: 7.9, example: '"I stopped using banks 2 years ago."' },
  { name: "Social proof", score: 7.6, example: '"1M+ users already switched."' },
  { name: "Curiosity gap", score: 7.2, example: '"What nobody tells you about…"' },
];

const IntelligencePage = () => {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Creative Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Patterns and trends from all your analyzed creatives.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Analyzed", value: "0", icon: Eye },
          { label: "Avg Hook Score", value: "—", icon: Zap },
          { label: "Top Model", value: "—", icon: Brain },
          { label: "Avg CTR", value: "—", icon: TrendingUp },
        ].map((item) => (
          <Card key={item.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Creative Models Distribution */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Creative Models Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {creativeModels.map((model) => (
            <div key={model.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{model.name}</span>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      model.trend.startsWith("+")
                        ? "text-green-400 border-green-500/20"
                        : "text-red-400 border-red-500/20"
                    }`}
                  >
                    {model.trend}
                  </Badge>
                  <span className="text-muted-foreground text-sm w-10 text-right">{model.pct}%</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all"
                  style={{ width: `${model.pct}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Based on sample benchmark data. Analyze videos to see your own distribution.
          </p>
        </CardContent>
      </Card>

      {/* Hook Patterns */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Top Hook Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hookPatterns.map((hook, i) => (
              <div
                key={hook.name}
                className="flex items-start gap-4 p-3 rounded-lg bg-muted/30"
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-foreground text-sm">{hook.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {hook.score}/10
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground italic">{hook.example}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntelligencePage;
