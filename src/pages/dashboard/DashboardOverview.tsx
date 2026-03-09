import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  LayoutGrid,
  Video,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Zap,
  Target,
} from "lucide-react";
import { HookStrengthBadge } from "@/components/dashboard/HookStrengthBadge";

interface InsightsData {
  avgHookScore: number | null;
  bestModel: string | null;
  mostUsedMarket: string | null;
  totalAnalyzed: number;
}

const DashboardOverview = () => {
  const { user, profile, usage } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<InsightsData>({
    avgHookScore: null,
    bestModel: null,
    mostUsedMarket: null,
    totalAnalyzed: 0,
  });

  const planLimits = {
    free: { analyses: 3, boards: 3, videos: 0 },
    studio: { analyses: 30, boards: 30, videos: 5 },
    scale: { analyses: 500, boards: 300, videos: 50 },
  };

  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;

  // Fetch real insights from analyses
  useEffect(() => {
    const fetchInsights = async () => {
      const { data } = await supabase
        .from("analyses")
        .select("result, hook_strength")
        .eq("user_id", user.id)
        .eq("status", "completed");

      if (!data || data.length === 0) return;

      let totalScore = 0;
      let scoreCount = 0;
      const modelCounts: Record<string, number> = {};
      const marketCounts: Record<string, number> = {};

      data.forEach((a) => {
        const result = a.result as Record<string, unknown> | null;
        if (!result) return;

        const hookScore = (result.hook_score as number) ?? (result.engagement_score as number) ?? null;
        if (hookScore !== null) {
          totalScore += hookScore;
          scoreCount++;
        }

        const model = result.creative_model as string;
        if (model) modelCounts[model] = (modelCounts[model] || 0) + 1;

        const market = result.market as string;
        if (market) marketCounts[market] = (marketCounts[market] || 0) + 1;
      });

      const bestModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const mostUsedMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      setInsights({
        avgHookScore: scoreCount > 0 ? totalScore / scoreCount : null,
        bestModel,
        mostUsedMarket,
        totalAnalyzed: data.length,
      });
    };
    fetchInsights();
  }, [user.id]);

  interface ActivityItem {
    id: string;
    type: "analysis" | "board";
    title: string;
    created_at: string;
  }
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      const [{ data: analyses }, { data: boards }] = await Promise.all([
        supabase.from("analyses").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("boards").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      ]);
      const items: ActivityItem[] = [
        ...(analyses || []).map((a) => ({ id: a.id, type: "analysis" as const, title: a.title || "Untitled analysis", created_at: a.created_at })),
        ...(boards || []).map((b) => ({ id: b.id, type: "board" as const, title: b.title || "Untitled board", created_at: b.created_at })),
      ];
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentActivity(items.slice(0, 4));
    };
    fetchActivity();
  }, [user.id]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const stats = [
    {
      label: "Analyses",
      value: usage.analyses_count,
      limit: limits.analyses,
      icon: BarChart3,
      color: "from-purple-500 to-pink-500",
    },
    {
      label: "Boards",
      value: usage.boards_count,
      limit: limits.boards,
      icon: LayoutGrid,
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "Videos",
      value: usage.videos_count,
      limit: limits.videos,
      icon: Video,
      color: "from-green-500 to-emerald-500",
    },
  ];

  const quickActions = [
    {
      title: "New Analysis",
      description: "Upload a video and get AI insights",
      icon: BarChart3,
      action: () => navigate("/dashboard/analyses/new"),
    },
    {
      title: "Create Board",
      description: "Generate a production board from a prompt",
      icon: LayoutGrid,
      action: () => navigate("/dashboard/boards/new"),
    },
    {
      title: "Pre-flight Check",
      description: "Review your video before posting",
      icon: Zap,
      action: () => navigate("/dashboard/preflight"),
    },
    {
      title: "Translate Script",
      description: "Translate ad scripts to any market",
      icon: Target,
      action: () => navigate("/dashboard/translate"),
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Welcome back, {profile?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your creative pipeline.
          </p>
        </div>
        <Badge variant="outline" className="capitalize border-border text-muted-foreground">
          {profile?.plan} plan
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border bg-card relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-muted-foreground">
                <stat.icon className="h-4 w-4" />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {stat.value}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}/ {stat.limit}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={stat.limit > 0 ? (stat.value / stat.limit) * 100 : 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stat.limit - stat.value} remaining this month
              </p>
            </CardContent>
            <div
              className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-full -translate-y-8 translate-x-8`}
            />
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={action.action}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Performance Insights + Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.totalAnalyzed === 0 ? (
              <div className="flex flex-col items-center text-center py-6">
                <Target className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Analyze your first video to see insights</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-border"
                  onClick={() => navigate("/dashboard/analyses/new")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Analysis
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg. Hook Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {insights.avgHookScore?.toFixed(1) ?? "—"} / 10
                    </span>
                    {insights.avgHookScore !== null && (
                      <HookStrengthBadge score={insights.avgHookScore} />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Top Creative Model</span>
                  {insights.bestModel ? (
                    <Badge variant="secondary" className="text-xs">{insights.bestModel}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Most Used Market</span>
                  <span className="text-sm font-semibold text-foreground">
                    {insights.mostUsedMarket || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Hooks Analyzed</span>
                  <span className="text-sm font-semibold text-foreground">{insights.totalAnalyzed}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet. Start by creating an analysis.</p>
            ) : (
              recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(item.type === "analysis" ? `/dashboard/analyses/${item.id}` : `/dashboard/boards/${item.id}`)}
                >
                  <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${item.type === "analysis" ? "bg-accent" : "bg-blue-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {item.type === "analysis" ? "Analysis completed" : "Board generated"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.title} • {timeAgo(item.created_at)}</p>
                  </div>
                </div>
              ))
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50"
              onClick={() => navigate("/dashboard/analyses")}
            >
              View all activity →
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA for free plan */}
      {profile?.plan === "free" && (
        <Card className="border-border bg-gradient-to-r from-accent/10 to-pink-500/10 overflow-hidden relative">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Unlock more with Studio</p>
                <p className="text-sm text-muted-foreground">
                  10x your limits, video generation, and priority support.
                </p>
              </div>
            </div>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shrink-0"
              onClick={() => navigate("/pricing")}
            >
              Upgrade to Studio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardOverview;
