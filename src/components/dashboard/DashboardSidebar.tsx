import {
  BarChart3, LayoutGrid, Brain, Layers, Plane, Cpu,
  Zap, Settings, ChevronRight, Target, FileText, ClipboardList,
  RefreshCw, Upload, Globe, Search, Activity, Home,
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

const J = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const M = { fontFamily: "'DM Mono', monospace" } as const;
const LIFETIME_EMAILS = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];
const planMeta: Record<string, { color: string; bg: string; label: string }> = {
  free:    { color: "#ffffff40", bg: "rgba(255,255,255,0.05)", label: "Free" },
  maker:   { color: "#60a5fa",   bg: "rgba(96,165,250,0.1)",   label: "Maker" },
  creator: { color: "#60a5fa",   bg: "rgba(96,165,250,0.1)",   label: "Creator" },
  pro:     { color: "#0ea5e9",   bg: "rgba(14,165,233,0.1)",   label: "Pro" },
  starter: { color: "#34d399",   bg: "rgba(52,211,153,0.1)",   label: "Starter" },
  studio:  { color: "#0ea5e9",   bg: "rgba(14,165,233,0.1)",   label: "Studio" },
  scale:   { color: "#fbbf24",   bg: "rgba(251,191,36,0.1)",   label: "Scale" },
};

export function DashboardSidebar({ user, profile, onProfileUpdate, open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { language } = useLanguage();
  const dt = useDashT(language);

  const isActive = (url: string, exact = false) =>
    exact ? location.pathname === url : location.pathname === url || location.pathname.startsWith(url + "/");

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME_EMAILS.includes(user?.email || "");
  const pm = planMeta[plan] || planMeta.free;
  const initials =
    profile?.name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() || "U";

  const Item = ({ url, label, icon: Icon, accent, badge, exact }: {
    url: string; label: string; icon: any; accent: string; badge?: string; exact?: boolean;
  }) => {
    const active = isActive(url, exact);
    return (
      <NavLink to={url} end={exact} onClick={onClose} style={{
        display: "flex", alignItems: "center", gap: 9, padding: "6px 10px", borderRadius: 8,
        color: active ? "#fff" : "rgba(255,255,255,0.4)", background: active ? "rgba(255,255,255,0.07)" : "transparent",
        fontWeight: active ? 600 : 400, fontSize: 12, position: "relative",
        transition: "all 0.12s", textDecoration: "none", ...J,
      }}
        onMouseEnter={e => {
          if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }
        }}
        onMouseLeave={e => {
          if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }
        }}
      >
        {active && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 14, borderRadius: 999, background: accent }} />}
        <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: active ? `${accent}18` : "transparent" }}>
          <Icon size={12} style={{ color: active ? accent : "currentColor", opacity: active ? 1 : 0.5 }} />
        </div>
        <span style={{ flex: 1, ...J }}>{label}</span>
        {badge && (
          <span style={{ ...M, fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", padding: "2px 5px", borderRadius: 999, color: accent, background: `${accent}15`, border: `1px solid ${accent}25` }}>
            {badge}
          </span>
        )}
      </NavLink>
    );
  };

  const Section = ({ label }: { label: string }) => (
    <p style={{ ...M, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", padding: "0 10px", marginBottom: 2 }}>
      {label}
    </p>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[214px] shrink-0 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "#080810", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div style={{ padding: "14px 14px 11px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }} style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 6px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Item url="/dashboard" label="Loop" icon={Home} accent="#0ea5e9" badge="HOME" exact />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Section label="Intelligence" />
            <Item url="/dashboard/loop/ai"      label="AdBrief AI"  icon={Brain}    accent="#0ea5e9" badge="AI" />
            <Item url="/dashboard/intelligence" label="Insights"    icon={Activity} accent="#34d399" />
            <Item url="/dashboard/loop/import"  label="Import data" icon={Upload}   accent="#60a5fa" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Section label="Create" />
            <Item url="/dashboard/analyses"  label={dt("nav_analyses")}  icon={BarChart3}     accent="#c084fc" />
            <Item url="/dashboard/hooks"     label={dt("nav_hooks")}     icon={Cpu}           accent="#fb923c" />
            <Item url="/dashboard/script"    label="Script"              icon={FileText}      accent="#0ea5e9" />
            <Item url="/dashboard/brief"     label="Brief"               icon={ClipboardList} accent="#60a5fa" />
            <Item url="/dashboard/boards"    label={dt("nav_boards")}    icon={LayoutGrid}    accent="#60a5fa" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Section label="Launch" />
            <Item url="/dashboard/preflight"  label={dt("nav_preflight")} icon={Plane}  accent="#fbbf24" />
            <Item url="/dashboard/competitor" label="Competitor"          icon={Search} accent="#34d399" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Section label="Audience" />
            <Item url="/dashboard/persona"   label={dt("nav_persona")}   icon={Target} accent="#c084fc" />
            <Item url="/dashboard/translate" label={dt("nav_translate")} icon={Globe}  accent="#10b981" />
            <Item url="/dashboard/templates" label={dt("nav_templates")} icon={Layers} accent="#06b6d4" />
          </div>
        </nav>

        {/* Footer */}
        <div style={{ padding: "8px 6px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 5 }}>
          {(plan === "free" || plan === "creator" || plan === "starter") && (
            <NavLink to="/pricing" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.14)", textDecoration: "none" }}>
              <Zap size={12} style={{ color: "#0ea5e9", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ ...J, fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 1 }}>{dt("nav_upgrade")}</p>
                <p style={{ ...M, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{dt("nav_upgrade_desc")}</p>
              </div>
              <ChevronRight size={10} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            </NavLink>
          )}
          <div style={{ padding: "0 4px" }}><LanguageSwitcher direction="up" /></div>
          <button onClick={() => setProfileOpen(true)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,rgba(14,165,233,0.4),rgba(6,182,212,0.4))", color: "#fff" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...J, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                {profile?.name || user?.email?.split("@")[0] || "Account"}
              </p>
              {isLifetime
                ? <span style={{ ...M, fontSize: 9, padding: "2px 6px", borderRadius: 999, background: "rgba(250,204,21,0.1)", color: "#fbbf24", border: "1px solid rgba(250,204,21,0.2)" }}>∞ Lifetime</span>
                : <span style={{ ...M, fontSize: 9, padding: "2px 6px", borderRadius: 999, color: pm.color, background: pm.bg }}>{pm.label}</span>
              }
            </div>
            <Settings size={11} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {user && (
        <UserProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} user={user}
          profile={profile as Parameters<typeof UserProfilePanel>[0]["profile"]}
          onProfileUpdate={(p) => { onProfileUpdate?.(p as Profile); }} />
      )}
    </>
  );
}
