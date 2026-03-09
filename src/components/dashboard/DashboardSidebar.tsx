import {
  BarChart3, LayoutGrid, Video, Home,
  Plus, Globe, Brain, LogOut, Layers, Plane,
  ChevronRight, Zap, Settings,
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
  { title: "Overview",  url: "/dashboard",          icon: Home,      end: true, accent: "text-white" },
  { title: "Analyses",  url: "/dashboard/analyses", icon: BarChart3,            accent: "text-purple-400" },
  { title: "Boards",    url: "/dashboard/boards",   icon: LayoutGrid,           accent: "text-blue-400" },
  { title: "Videos",    url: "/dashboard/videos",   icon: Video,                accent: "text-green-400" },
];

const toolItems = [
  { title: "Templates",    url: "/dashboard/templates",    icon: Layers,  accent: "text-pink-400" },
  { title: "Translate",    url: "/dashboard/translate",    icon: Globe,   accent: "text-emerald-400" },
  { title: "Pre-flight",   url: "/dashboard/preflight",    icon: Plane,   accent: "text-yellow-400" },
  { title: "Intelligence", url: "/dashboard/intelligence", icon: Brain,   accent: "text-violet-400" },
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
  onboarding_data?: Record<string, unknown> | null;
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

  const NavItem = ({ item }: { item: (typeof mainItems)[0] }) => {
    const active = isActive(item.url, (item as { end?: boolean }).end);
    return (
      <NavLink
        to={item.url}
        end={(item as { end?: boolean }).end}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group ${
          active
            ? "bg-white text-black font-semibold"
            : "text-white/45 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <item.icon
          className={`h-4 w-4 shrink-0 transition-opacity ${
            active
              ? "text-black"
              : `${(item as { accent?: string }).accent || "text-white/30"} opacity-60 group-hover:opacity-100`
          }`}
        />
        <span className="flex-1">{item.title}</span>
        {active && <ChevronRight className="h-3 w-3 text-black/30" />}
      </NavLink>
    );
  };

  const initials =
    profile?.name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[252px] shrink-0 flex flex-col
          bg-[#080808] border-r border-white/[0.06]
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <button onClick={() => navigate("/dashboard")} className="hover:opacity-70 transition-opacity">
            <Logo size="md" />
          </button>
        </div>

        {/* New Analysis CTA */}
        <div className="px-4 pt-4">
          <NavLink
            to="/dashboard/analyses/new"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-[.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/15 px-3 mb-2">Workspace</p>
            {mainItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/15 px-3 mb-2">Tools</p>
            {toolItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] space-y-2">
          {/* Upgrade nudge (free only) */}
          {profile?.plan === "free" && (
            <NavLink
              to="/pricing"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 text-xs hover:bg-white/[0.07] hover:text-white transition-all group"
            >
              <Zap className="h-3 w-3 text-yellow-400" />
              <span className="flex-1">Upgrade plan</span>
              <ChevronRight className="h-3 w-3 opacity-30 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          )}

          {/* Language */}
          <div className="px-1">
            <LanguageSwitcher />
          </div>

          {/* User card — clicks to open profile panel */}
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.06] transition-all group text-left"
            aria-label="Open profile settings"
          >
            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600/40 to-pink-600/20 text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white/80 truncate group-hover:text-white transition-colors">
                {profile?.name || user?.email?.split("@")[0] || "Account"}
              </p>
              <p className="text-[10px] text-white/25 capitalize">{profile?.plan || "free"} plan</p>
            </div>
            <Settings className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 group-hover:rotate-45 transition-all duration-300 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Profile panel (portal-level z-index) */}
      {user && (
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          profile={profile as Parameters<typeof UserProfilePanel>[0]["profile"]}
          onProfileUpdate={(p) => {
            onProfileUpdate?.(p as Profile);
          }}
        />
      )}
    </>
  );
}
