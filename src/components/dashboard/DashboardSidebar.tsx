import {
  BarChart3, LayoutGrid, Video, Home,
  Plus, Globe, Brain, LogOut, Layers, Plane, Radar,
  ChevronRight, Zap, Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const mainItems = [
  { title: "Overview",  url: "/dashboard",          icon: Home,      end: true, accent: "text-white" },
  { title: "Analyses",  url: "/dashboard/analyses", icon: BarChart3,            accent: "text-purple-400" },
  { title: "Boards",    url: "/dashboard/boards",   icon: LayoutGrid,           accent: "text-blue-400" },
  { title: "Videos",    url: "/dashboard/videos",   icon: Video,                accent: "text-green-400" },
];

const toolItems = [
  { title: "Templates",    url: "/dashboard/templates",   icon: Layers,  accent: "text-pink-400" },
  { title: "Translate",    url: "/dashboard/translate",   icon: Globe,   accent: "text-emerald-400" },
  { title: "Pre-flight",   url: "/dashboard/preflight",   icon: Plane,   accent: "text-yellow-400" },
  { title: "Competitor",   url: "/dashboard/competitor",  icon: Radar,   accent: "text-orange-400" },
  { title: "Persona",      url: "/dashboard/persona",     icon: Users,   accent: "text-cyan-400" },
  { title: "Intelligence", url: "/dashboard/intelligence",icon: Brain,   accent: "text-violet-400" },
];

interface SidebarProps {
  profile: { name: string | null; email: string | null; avatar_url: string | null; plan: string } | null;
  usageDetails?: { analyses: { used: number; limit: number }; boards: { used: number; limit: number } } | null;
  open: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ profile, open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/login");
  };

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  const NavItem = ({ item }: { item: typeof mainItems[0] }) => {
    const active = isActive(item.url, (item as { end?: boolean }).end);
    return (
      <NavLink
        to={item.url}
        end={(item as { end?: boolean }).end}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group
          ${active
            ? "bg-white text-black font-semibold"
            : "text-white/50 hover:text-white hover:bg-white/8"
          }`}
      >
        <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-black" : `${(item as { accent?: string }).accent || "text-white/40"} opacity-70 group-hover:opacity-100`}`} />
        <span className="flex-1">{item.title}</span>
        {active && <ChevronRight className="h-3 w-3 text-black/40" />}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[260px] flex flex-col
        bg-[#080808] border-r border-white/[0.06]
        transition-transform duration-300 ease-out
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <button onClick={() => navigate("/dashboard")} className="hover:opacity-80 transition-opacity">
            <Logo size="md" />
          </button>
        </div>

        {/* New analysis CTA */}
        <div className="px-4 pt-4">
          <NavLink
            to="/dashboard/analyses/new"
            onClick={onClose}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </NavLink>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-3 mb-2">Main</p>
            {mainItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-3 mb-2">Tools</p>
            {toolItems.map((item) => <NavItem key={item.url} item={item} />)}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] space-y-3">
          {profile?.plan === "free" && (
            <NavLink
              to="/pricing"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 hover:text-white transition-all"
            >
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <span className="flex-1">Upgrade plan</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            </NavLink>
          )}

          {/* Language switcher */}
          <div className="px-1">
            <LanguageSwitcher />
          </div>

          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-white/10 text-white text-xs font-semibold">
                {profile?.name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.name || "User"}</p>
              <p className="text-[11px] text-white/40 capitalize">{profile?.plan} plan</p>
            </div>
            <button
              onClick={handleLogout}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
