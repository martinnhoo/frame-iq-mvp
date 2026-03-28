import {
  BarChart3, LayoutGrid, Video, Home,
  Plus, Globe, Brain, Layers, Plane, Cpu, Search,
  Zap, Settings, ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { UserProfilePanel } from "./UserProfilePanel";
import type { User as SupaUser } from "@supabase/supabase-js";

// ── Nav items ─────────────────────────────────────────────────────────────────

const mainItems = [
  { title: "Overview",  url: "/dashboard",          icon: Home,       end: true,  dot: "#e2e8f0" },
  { title: "Analyses",  url: "/dashboard/analyses", icon: BarChart3,              dot: "#c084fc" },
  { title: "Boards",    url: "/dashboard/boards",   icon: LayoutGrid,             dot: "#60a5fa" },
  { title: "Videos",    url: "/dashboard/videos",   icon: Video,                  dot: "#34d399" },
];

const toolItems = [
  { title: "Templates",    url: "/dashboard/templates",    icon: Layers,  dot: "#06b6d4" },
  { title: "Translate",    url: "/dashboard/translate",    icon: Globe,   dot: "#10b981" },
  { title: "Pre-flight",   url: "/dashboard/preflight",    icon: Plane,   dot: "#fbbf24" },
  { title: "Hook Generator", url: "/dashboard/hooks",      icon: Cpu,     dot: "#fb923c" },
  { title: "Competitor",   url: "/dashboard/competitor",   icon: Search,  dot: "#22d3ee" },
  { title: "Intelligence", url: "/dashboard/intelligence", icon: Brain,   dot: "#0ea5e9" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string | null;
  preferred_market: string | null;
  preferred_language: string | null;
  onboarding_data?: unknown;
  [key: string]: unknown;
}

interface SidebarProps {
  user: SupaUser | null;
  profile: Profile | null;
  onProfileUpdate?: (p: Profile) => void;
  open: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardSidebar({ user, profile, onProfileUpdate, open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  const NavItem = ({ item }: { item: typeof mainItems[0] }) => {
    const active = isActive(item.url, (item as { end?: boolean }).end);
    return (
      <NavLink
        to={item.url}
        end={(item as { end?: boolean }).end}
        onClick={onClose}
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group
          ${active
            ? "bg-white text-black font-semibold nav-active-bar"
            : "text-white/40 hover:text-white/90 hover:bg-white/[0.05]"
          }
        `}
      >
        {/* Accent dot */}
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-200 ${active ? "bg-black/30" : "opacity-50 group-hover:opacity-100"}`}
          style={{ background: active ? undefined : item.dot }}
        />
        <item.icon className={`h-4 w-4 shrink-0 transition-all ${active ? "text-black" : "text-white/50 group-hover:text-white/70"}`} />
        <span className="flex-1 font-medium tracking-[-0.01em]">{item.title}</span>
        {active && <ChevronRight className="h-3 w-3 text-black/25" />}
      </NavLink>
    );
  };

  const initials =
    profile?.name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";

  const planColors: Record<string, string> = {
    free:    "text-white/45",
    creator: "text-blue-400",
    starter: "text-emerald-400",
    studio:  "text-sky-400",
    scale:   "text-amber-400",
  };
  const planColor = planColors[profile?.plan || "free"] || "text-white/45";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[252px] shrink-0 flex flex-col
          bg-[#080808] border-r border-white/[0.05]
          sidebar-transition
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
          <button
            onClick={() => { navigate("/dashboard"); onClose(); }}
            className="hover:opacity-70 transition-opacity"
          >
            <Logo size="md" />
          </button>
        </div>

        {/* New Analysis CTA */}
        <div className="px-4 pt-4">
          <NavLink
            to="/dashboard/analyses/new"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/92 active:scale-[.98] transition-all glow-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.01em' }}
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/12 px-3 mb-2.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Workspace
            </p>
            {mainItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/12 px-3 mb-2.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Tools
            </p>
            {toolItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.05] space-y-2">
          {/* Upgrade nudge (free / creator / starter) */}
          {(profile?.plan === "free" || profile?.plan === "creator") && (
            <NavLink
              to="/pricing"
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.13] bg-gradient-to-r from-purple-950/40 to-pink-950/20 text-white/50 text-xs hover:text-white transition-all group"
            >
              <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
              <span className="flex-1">Upgrade plan</span>
              <ChevronRight className="h-3 w-3 opacity-25 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          )}

          {/* Language */}
          <div className="px-1">
            <LanguageSwitcher />
          </div>

          {/* User card */}
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/[0.05] transition-all group text-left border border-transparent hover:border-white/[0.12]"
            aria-label="Open profile settings"
          >
            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg, #7c3aed40, #ec489940)", color: "#fff" }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/75 truncate group-hover:text-white transition-colors leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {profile?.name || user?.email?.split("@")[0] || "Account"}
              </p>
              <p className={`text-[10px] capitalize font-medium ${planColor}`}>
                {profile?.plan || "free"} plan
              </p>
            </div>
            <Settings className="h-3.5 w-3.5 text-white/12 group-hover:text-white/55 group-hover:rotate-45 transition-all duration-300 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Profile panel */}
      {user && (
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          profile={profile as Parameters<typeof UserProfilePanel>[0]["profile"]}
          onProfileUpdate={(p) => { onProfileUpdate?.(p as Profile); }}
        />
      )}
    </>
  );
}
