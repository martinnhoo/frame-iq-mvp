import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export interface DashboardContext {
  user: User;
  profile: Profile;
  usage: Usage;
  refreshUsage: () => Promise<void>;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string;
}

export interface Usage {
  analyses_count: number;
  boards_count: number;
  videos_count: number;
}

export default function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0, videos_count: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsage = async (userId: string) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from("usage")
      .select("*")
      .eq("user_id", userId)
      .eq("period", currentPeriod)
      .single();
    if (data) {
      setUsage({
        analyses_count: data.analyses_count,
        boards_count: data.boards_count,
        videos_count: data.videos_count,
      });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          navigate("/login");
          return;
        }
        setUser(session.user);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profileData) setProfile(profileData);
        await fetchUsage(session.user.id);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/login");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar profile={profile} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarTrigger className="mr-4" />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet context={{ user, profile, usage, refreshUsage: () => fetchUsage(user!.id) } satisfies DashboardContext} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
