import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "@supabase/supabase-js";

export interface DashboardContext {
  user: User;
  profile: Profile;
  usage: Usage;
  usageDetails: UsageDetails | null;
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

export interface UsageDetails {
  plan: string;
  analyses: { used: number; limit: number; remaining: number };
  boards: { used: number; limit: number; remaining: number };
  videos: { used: number; limit: number; remaining: number };
  translations: { used: number; limit: number; remaining: number };
  reset_date: string;
  is_over_limit: boolean;
  show_warning: boolean;
}

export default function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0, videos_count: 0 });
  const [usageDetails, setUsageDetails] = useState<UsageDetails | null>(null);
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

    // Fetch detailed usage from check-usage function
    try {
      const { data: detailsData, error } = await supabase.functions.invoke('check-usage', {
        body: { user_id: userId }
      });
      if (!error && detailsData) {
        setUsageDetails(detailsData);
      }
    } catch (error) {
      console.error('Error fetching usage details:', error);
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

        if (profileData) {
          setProfile(profileData);

          // Send welcome email on first login (onboarding not completed)
          if (!profileData.onboarding_completed) {
            const browserLang = navigator.language || 'en';
            const firstName = profileData.name?.split(' ')[0] || session.user.user_metadata?.full_name?.split(' ')[0] || '';
            
            supabase.functions.invoke('send-welcome-email', {
              body: {
                user_id: session.user.id,
                language: browserLang,
                first_name: firstName,
              }
            }).then(() => {
              // Mark onboarding as completed
              supabase.from("profiles")
                .update({ onboarding_completed: true })
                .eq("id", session.user.id)
                .then(() => {});
            }).catch(err => console.error('Welcome email error:', err));
          }
        }
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
        <DashboardSidebar profile={profile} usageDetails={usageDetails} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarTrigger className="mr-4" />
          </header>
          
          {usageDetails?.show_warning && !usageDetails?.is_over_limit && (
            <Alert className="mx-4 mt-4 border-amber-500 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-900 dark:text-amber-100">
                You're running low on your monthly quota. Consider upgrading to continue using all features.
              </AlertDescription>
            </Alert>
          )}

          {usageDetails?.is_over_limit && (
            <Alert className="mx-4 mt-4 border-destructive bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">
                You've reached your monthly limit. Upgrade your plan to continue.
              </AlertDescription>
            </Alert>
          )}

          <main className="flex-1 overflow-auto">
            <Outlet context={{ user, profile, usage, usageDetails, refreshUsage: () => fetchUsage(user!.id) } satisfies DashboardContext} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
