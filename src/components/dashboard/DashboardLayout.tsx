import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Menu, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const fetchUsage = async (userId: string) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from("usage").select("*").eq("user_id", userId).eq("period", currentPeriod).single();
    if (data) setUsage({ analyses_count: data.analyses_count, boards_count: data.boards_count, videos_count: data.videos_count });
    try {
      const { data: d } = await supabase.functions.invoke("check-usage", { body: { user_id: userId } });
      if (d) setUsageDetails(d);
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      if (!mounted) return;
      setUser(session.user);
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData && mounted) {
        setProfile(profileData);

        // New user — redirect to onboarding
        if (!profileData.onboarding_completed) {
          navigate("/onboarding");
          return;
        }
      }
      await fetchUsage(session.user.id);
      if (mounted) setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (!session) navigate("/login"); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          <p className="text-xs text-white/20 font-mono">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar
        user={user}
        profile={profile}
        onProfileUpdate={(p) => setProfile(p as typeof profile)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden h-14 flex items-center px-4 border-b border-white/[0.06] bg-[#080808] sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all mr-3"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
              <Logo size="sm" />
            </div>
        </header>

        {/* Alerts */}
        {usageDetails?.show_warning && !usageDetails?.is_over_limit && (
          <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Running low on quota. Consider upgrading.
          </div>
        )}
        {usageDetails?.is_over_limit && (
          <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Monthly limit reached. Upgrade to continue.
          </div>
        )}

        <main className="flex-1 overflow-auto bg-[#050505]">
          <Outlet context={{ user, profile, usage, usageDetails, refreshUsage: () => fetchUsage(user!.id) } satisfies DashboardContext} />
        </main>
      </div>
    </div>
  );
}
