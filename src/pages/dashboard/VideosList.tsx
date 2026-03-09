import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Video, Play, Download, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GeneratedVideo {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  video_url: string | null;
}

const VideosList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("videos_generated")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setVideos(data);
      setLoading(false);
    };
    fetch();
  }, [user.id]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <div className="h-8 w-44 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg animate-pulse overflow-hidden">
              <div className="aspect-video bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generated Videos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Videos generated from your boards.
        </p>
      </div>

      {videos.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No videos yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Create a board first, then generate a video from it. AI handles the rest.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card key={video.id} className="border-border bg-card overflow-hidden">
              {/* Thumbnail placeholder */}
              <div className="aspect-video bg-muted flex items-center justify-center relative group">
                <Video className="h-10 w-10 text-muted-foreground" />
                {video.status === "completed" && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <div className="h-12 w-12 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center">
                      <Play className="h-5 w-5 text-foreground ml-0.5" />
                    </div>
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground text-sm truncate">
                    {video.title || "Untitled Video"}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${
                      video.status === "completed"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : video.status === "rendering"
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {video.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                </p>
                {video.status === "completed" && (
                  <Button variant="ghost" size="sm" className="w-full mt-1 text-muted-foreground">
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideosList;
