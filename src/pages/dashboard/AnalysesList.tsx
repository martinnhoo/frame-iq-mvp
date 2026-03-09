import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Plus, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Analysis {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
  result: Record<string, unknown> | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Processing", icon: Clock, className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  completed: { label: "Completed", icon: CheckCircle, className: "bg-green-500/10 text-green-400 border-green-500/20" },
  failed: { label: "Failed", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const AnalysesList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyses = async () => {
      const { data } = await supabase
        .from("analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setAnalyses(data as Analysis[]);
      setLoading(false);
    };
    fetchAnalyses();
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analyses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All your video analyses in one place.
          </p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/analyses/new")}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {analyses.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No analyses yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Upload a video to get AI-powered insights on hooks, creative models, and predicted performance.
            </p>
            <Button
              onClick={() => navigate("/dashboard/analyses/new")}
              variant="outline"
              className="border-border"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {analyses.map((analysis) => {
            const config = statusConfig[analysis.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card
                key={analysis.id}
                className="border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {analysis.title || "Untitled Analysis"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className={config.className}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnalysesList;
