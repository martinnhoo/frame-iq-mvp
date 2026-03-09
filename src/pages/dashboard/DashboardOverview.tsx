import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  LayoutGrid,
  Video,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";

const DashboardOverview = () => {
  const { profile, usage } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const planLimits = {
    free: { analyses: 3, boards: 3, videos: 0 },
    studio: { analyses: 30, boards: 30, videos: 5 },
    scale: { analyses: 500, boards: 300, videos: 50 },
  };

  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;

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
      title: "Generate Video",
      description: "Turn a board into a ready-to-publish video",
      icon: Video,
      action: () => navigate("/dashboard/videos"),
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
                value={(stat.value / stat.limit) * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stat.limit - stat.value} remaining this month
              </p>
            </CardContent>
            {/* Subtle gradient accent */}
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

      {/* Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg. Hook Score</span>
              <span className="text-sm font-semibold text-foreground">7.8 / 10</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Top Creative Model</span>
              <Badge variant="secondary" className="text-xs">Problem → Solution</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Best Performing Hook</span>
              <span className="text-sm font-semibold text-foreground">Question-based</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg. Predicted CTR</span>
              <span className="text-sm font-semibold text-foreground">3.2%</span>
            </div>
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
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
              <div>
                <p className="text-sm text-foreground">Video analysis completed</p>
                <p className="text-xs text-muted-foreground">Nike Running — Q1 Campaign • 2h ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-muted-foreground mt-2 shrink-0" />
              <div>
                <p className="text-sm text-foreground">Board generated</p>
                <p className="text-xs text-muted-foreground">Fintech Onboarding Flow • 5h ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-muted-foreground mt-2 shrink-0" />
              <div>
                <p className="text-sm text-foreground">Video exported</p>
                <p className="text-xs text-muted-foreground">Betano Summer Promo • 1d ago</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
              View all activity
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
