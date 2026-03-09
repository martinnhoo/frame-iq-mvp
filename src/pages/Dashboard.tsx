import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Video, LayoutGrid, BarChart3, Plus, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string;
}

interface Usage {
  analyses_count: number;
  boards_count: number;
  videos_count: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0, videos_count: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          navigate("/login");
          return;
        }
        setUser(session.user);
        
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }

        // Fetch current month usage
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: usageData } = await supabase
          .from("usage")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("period", currentPeriod)
          .single();

        if (usageData) {
          setUsage({
            analyses_count: usageData.analyses_count,
            boards_count: usageData.boards_count,
            videos_count: usageData.videos_count,
          });
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const planLimits = {
    free: { analyses: 5, boards: 3, videos: 2 },
    pro: { analyses: 50, boards: 30, videos: 20 },
    enterprise: { analyses: 500, boards: 300, videos: 200 },
  };

  const limits = planLimits[profile?.plan as keyof typeof planLimits] || planLimits.free;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {profile?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{profile?.name || "User"}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.plan} plan</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Usage Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Monthly Usage</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analyses
                </CardDescription>
                <CardTitle className="text-2xl">
                  {usage.analyses_count} / {limits.analyses}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={(usage.analyses_count / limits.analyses) * 100} className="h-2" />
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Boards
                </CardDescription>
                <CardTitle className="text-2xl">
                  {usage.boards_count} / {limits.boards}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={(usage.boards_count / limits.boards) * 100} className="h-2" />
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Videos Generated
                </CardDescription>
                <CardTitle className="text-2xl">
                  {usage.videos_count} / {limits.videos}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={(usage.videos_count / limits.videos) * 100} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-border hover:bg-muted"
              onClick={() => navigate("/")}
            >
              <BarChart3 className="h-6 w-6" />
              <span>New Analysis</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-border hover:bg-muted"
              onClick={() => toast.info("Coming soon!")}
            >
              <LayoutGrid className="h-6 w-6" />
              <span>Create Board</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-border hover:bg-muted"
              onClick={() => toast.info("Coming soon!")}
            >
              <Video className="h-6 w-6" />
              <span>Generate Video</span>
            </Button>
          </div>
        </section>

        {/* Recent Activity Placeholder */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Plus className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recent activity</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by analyzing a video or creating a board
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
