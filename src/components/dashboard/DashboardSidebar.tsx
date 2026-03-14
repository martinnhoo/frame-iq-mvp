import {
  BarChart3, LayoutGrid, Brain, Layers, Plane, Cpu,
  Zap, Settings, ChevronRight, Target, FileText, ClipboardList,
  RefreshCw, Upload, Globe, Sparkles, BookOpen,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { UserProfilePanel } from "./UserProfilePanel";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

interface Profile {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  plan: string | null; preferred_market: string | null; preferred_language: string | null;
  onboarding_data?: unknown; [key: string]: unknown;
}

interface SidebarProps {
  user: SupaUser | null; profile: Profile | null;
  onProfileUpdate?: (p: Profile) => void; open: boolean; onClose: () => void;
}

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;
const LIFETIME_EMAILS = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];
const planMeta: Record<string, { color: string; bg: string; label: string }> = {
  free:    { color: "#ffffff40", bg: "rgba(255,255,255,0.05)", label: "Free" },
  maker:   { color: "#60a5fa",   bg: "rgba(96,165,250,0.1)",   label: "Maker" },
  creator: { color: "#60a5fa",   bg: "rgba(96,165,250,0.1)",   label: "Creator" },
  pro:     { color: "#a78bfa",   bg: "rgba(167,139,250,0.1)",  label: "Pro" },
  starter: { color: "#34d399",   bg: "rgba(52,211,153,0.1)",   label: "Starter" },
  studio:  { color: "#a78bfa",   bg: "rgba(167,139,250,0.1)",  label: "Studio" },
  scale:   { color: "#fbbf24",   bg: "rgba(251,191,36,0.1)",   label: "Scale" },
};

export function DashboardSidebar({ user, profile, onProfileUpdate, open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { language } = useLanguage();
  const dt = useDashT(language);

  const intelligenceItems = [
    { title: "Performance Loop", url: "/dashboard/loop",        icon: RefreshCw,     accent: "#f472b6", badge: "CORE" },
    { title: "AdBrief AI",       url: "/dashboard/loop/ai",     icon: Brain,         accent: "#a78bfa", badge: "AI"   },
    { title: "How it works",     url: "/dashboard/loop/guide",  icon: BookOpen,      accent: "#34d399" },
    { title: "Import Data",      url: "/dashboard/loop/import", icon: Upload,        accent: "#60a5fa" },
  ];

  const creativeItems = [
    { title: dt("nav_analyses"),  url: "/dashboard/analyses",  icon: BarChart3,     accent: "#c084fc" },
    { title: dt("nav_boards"),    url: "/dashboard/boards",    icon: LayoutGrid,    accent: "#60a5fa" },
    { title: dt("nav_hooks"),     url: "/dashboard/hooks",     icon: Cpu,           accent: "#fb923c" },
    { title: "Script",            url: "/dashboard/script",    icon: FileText,      accent: "#a78bfa" },
    { title: "Brief",             url: "/dashboard/brief",     icon: ClipboardList, accent: "#60a5fa" },
    { title: dt("nav_preflight"), url: "/dashboard/preflight", icon: Plane,         accent: "#fbbf24" },
  ];

  const audienceItems = [
    { title: dt("nav_persona"),   url: "/dashboard/persona",   icon: Target, accent: "#c084fc" },
    { title: dt("nav_translate"), url: "/dashboard/translate", icon: Globe,  accent: "#10b981" },
    { title: dt("nav_templates"), url: "/dashboard/templates", icon: Layers, accent: "#f472b6" },
  ];

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME_EMAILS.includes(user?.email || "");
  const pm = planMeta[plan] || planMeta.free;
  const initials =
    profile?.name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() || "U";

  const NavItem = ({ item }: { item: { title: string; url: string; icon: any; accent: string; end?: boolean; badge?: string } }) => {
    const active = isActive(item.url, (item as any).end);
    return (
      <NavLink
        to={item.url}
        end={(item as any).end}
        onClick={onClose}
        className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all duration-150 group"
        style={active ? { background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 600 } : { color: "rgba(255,255,255,0.38)" }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.38)"; }}
      >
        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: item.accent }} />}
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={active ? { background: `${item.accent}18` } : { background: "transparent" }}>
          <item.icon className="h-3.5 w-3.5" style={{ color: active ? item.accent : "currentColor", opacity: active ? 1 : 0.6 }} />
        </div>
        <span className="flex-1" style={syne}>{item.title}</span>
        {(item as any).badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
            ...mono,
            color: (item as any).badge === "CORE" ? "#000" : item.accent,
            background: (item as any).badge === "CORE" ? "linear-gradient(135deg,#a78bfa,#f472b6)" : `${item.accent}18`,
            border: (item as any).badge === "CORE" ? "none" : `1px solid ${item.accent}30`,
          }}>{(item as any).badge}</span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[240px] shrink-0 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "#0a0a12", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }} className="hover:opacity-75 transition-opacity">
            <Logo size="md" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-2">
          <NavLink to="/dashboard/loop" onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-black text-sm font-bold hover:opacity-90 active:scale-[.98] transition-all"
            style={{ ...syne, background: "linear-gradient(135deg,#a78bfa,#f472b6)" }}>
            <Sparkles className="h-4 w-4" /> Run Intelligence
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 mb-2" style={{ ...syne, color: "rgba(255,255,255,0.12)" }}>Intelligence</p>
            {intelligenceItems.map(item => <NavItem key={item.url} item={item} />)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 mb-2" style={{ ...syne, color: "rgba(255,255,255,0.12)" }}>Creative Tools</p>
            {creativeItems.map(item => <NavItem key={item.url} item={item} />)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 mb-2" style={{ ...syne, color: "rgba(255,255,255,0.12)" }}>Audience</p>
            {audienceItems.map(item => <NavItem key={item.url} item={item} />)}
          </div>
        </nav>

        <div className="shrink-0 p-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {(plan === "free" || plan === "creator") && (
            <NavLink to="/pricing" onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all group"
              style={{ background: "rgba(167,139,250,0.06)", borderColor: "rgba(167,139,250,0.15)", color: "rgba(255,255,255,0.5)" }}>
              <Zap className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-white" style={syne}>{dt("nav_upgrade")}</p>
                <p className="text-[10px]" style={mono}>{dt("nav_upgrade_desc")}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          )}
          <div className="px-1"><LanguageSwitcher direction="up" /></div>
          <button onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all group text-left"
            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.4),rgba(236,72,153,0.4))", color: "#fff" }}>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/75 group-hover:text-white truncate transition-colors leading-tight" style={syne}>
                {profile?.name || user?.email?.split("@")[0] || "Account"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isLifetime ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ ...mono, background: "linear-gradient(135deg,rgba(250,204,21,0.2),rgba(251,146,60,0.2))", color: "#fbbf24", border: "1px solid rgba(250,204,21,0.25)" }}>∞ Lifetime</span>
                ) : (
                  <>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{ ...mono, color: pm.color, background: pm.bg }}>{pm.label}</span>
                    {(plan === "free" || plan === "creator" || plan === "starter") && (
                      <button onClick={e => { e.stopPropagation(); navigate("/pricing"); }}
                        className="text-[9px] px-1.5 py-0.5 rounded-md font-bold hover:opacity-90"
                        style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000" }}>
                        Upgrade
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <Settings className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 group-hover:rotate-45 transition-all duration-300 shrink-0" />
          </button>
        </div>
      </aside>

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
