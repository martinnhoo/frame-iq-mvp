import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Loader2, Globe, Film, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { HookBenchmarkCard } from "@/components/dashboard/HookBenchmarkCard";
import { HookStrengthBadge } from "@/components/dashboard/HookStrengthBadge";

interface AnalysisData {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
  result: Record<string, unknown> | null;
  hook_strength: string | null;
  video_duration_seconds: number | null;
  file_size_mb: number | null;
  processing_time_seconds: number | null;
  improvement_suggestions: string[] | null;
  recommended_platforms: string[] | null;
}

const AnalysisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", id!)
        .eq("user_id", user.id)
        .single();
      if (data) setAnalysis(data as AnalysisData);
      setLoading(false);
    };
    fetch();
  }, [id, user.id]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Analysis not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/analyses")}>
          Back to Analyses
        </Button>
      </div>
    );
  }

  const result = analysis.result as Record<string, unknown> | null;
  const hookScore = result?.hook_score as number | null ?? (result?.engagement_score as number | null) ?? null;
  const format = result?.format as string | undefined;
  const creativeModel = result?.creative_model as string | undefined;
  const summary = result?.summary as string | undefined;

  const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
    pending: { label: "Processing", icon: Clock, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    completed: { label: "Completed", icon: CheckCircle, className: "bg-green-500/10 text-green-400 border-green-500/20" },
    failed: { label: "Failed", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const config = statusConfig[analysis.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/analyses")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {analysis.title || "Untitled Analysis"}
            </h1>
            <Badge variant="outline" className={config.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {hookScore !== null && <HookStrengthBadge score={hookScore} strength={analysis.hook_strength} />}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Created {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {analysis.status === "completed" && !result && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <AlertCircle className="h-10 w-10 text-amber-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">API key not configured</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              The analysis was queued but no AI result was returned. Add <span className="font-mono text-amber-400">ANTHROPIC_API_KEY</span> and <span className="font-mono text-amber-400">OPENAI_API_KEY</span> to Supabase secrets to enable real analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis.status === "completed" && result && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Hook Benchmark */}
          {hookScore !== null && (
            <HookBenchmarkCard hookScore={hookScore} format={format} />
          )}

          {/* Details */}
          <div className="space-y-6">
            {/* Stats */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Analysis Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.video_duration_seconds && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Film className="h-3.5 w-3.5" /> Duration</span>
                    <span className="text-foreground font-medium">{analysis.video_duration_seconds}s</span>
                  </div>
                )}
                {analysis.file_size_mb && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">File Size</span>
                    <span className="text-foreground font-medium">{analysis.file_size_mb.toFixed(1)} MB</span>
                  </div>
                )}
                {analysis.processing_time_seconds && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Processing</span>
                    <span className="text-foreground font-medium">{analysis.processing_time_seconds}s</span>
                  </div>
                )}
                {creativeModel && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Creative Model</span>
                    <Badge variant="secondary" className="text-xs">{creativeModel}</Badge>
                  </div>
                )}
                {format && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Format</span>
                    <Badge variant="secondary" className="text-xs capitalize">{format}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommended Platforms */}
            {analysis.recommended_platforms && analysis.recommended_platforms.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Recommended Platforms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.recommended_platforms.map((p) => (
                      <Badge key={p} variant="outline" className="border-border text-muted-foreground capitalize">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Improvement Suggestions */}
          {analysis.improvement_suggestions && analysis.improvement_suggestions.length > 0 && (
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  Improvement Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.improvement_suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {analysis.status === "pending" && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Analysis in progress</h3>
            <p className="text-muted-foreground text-sm">Your video is being analyzed. This usually takes 30-60 seconds.</p>
          </CardContent>
        </Card>
      )}

      {analysis.status === "failed" && (
        <Card className="border-border bg-card">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Analysis failed</h3>
            <p className="text-muted-foreground text-sm mb-4">Something went wrong processing your video.</p>
            <Button onClick={() => navigate("/dashboard/analyses/new")} variant="outline" className="border-border">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalysisDetail;
