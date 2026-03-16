import {
  MessageSquare, BarChart3, Zap, Search, Settings,
  ChevronUp, Sparkles, CreditCard, Brain,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { UserProfilePanel } from "./UserProfilePanel";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Profile {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  plan: string | null; [key: string]: unknown;
}
interface SidebarProps {
  user: SupaUser | null; profile: Profile | null;
  onProfileUpdate?: (p: Profile) => void; open: boolean; onClose: () => void;
}

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const LIFETIME = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];

const PLANS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "rgba(255,255,255,0.3)" },
  maker:   { label: "Maker",   color: "#60a5fa" },
  creator: { label: "Creator", color: "#60a5fa" },
  pro:     { label: "Pro",     color: "#0ea5e9" },
  starter: { label: "Starter", color: "#34d399" },
  studio:  { label: "Studio",  color: "#0ea5e9" },
  scale:   { label: "Scale",   color: "#fbbf24" },
};

export function DashboardSidebar({ user, profile, onProfileUpdate, open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { language } = useLanguage();
  const dt = useDashT(language);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || user?.email || "U").charAt(0).toUpperCase();
  const isActive = (url: string, exact = false) =>
    exact ? location.pathname === url : location.pathname === url || location.pathname.startsWith(url + "/");

  const NAV = [
    { url: "/dashboard/loop/ai",     label: "AI",        icon: Brain,         exact: false },
    { url: "/dashboard/analyses",    label: "Analyze",   icon: BarChart3 },
    { url: "/dashboard/hooks",       label: "Hooks",     icon: Zap },
    { url: "/dashboard/competitor",  label: "Competitor",icon: Search },
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 220, background: "#0c0c0c", borderRight: "1px solid rgba(255,255,255,0.06)", fontFamily: F }}
      >
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <Logo size="md" />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(({ url, label, icon: Icon, exact }) => {
            const active = isActive(url, exact);
            return (
              <NavLink
                key={url}
                to={url}
                end={exact}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8,
                  color: active ? "#fff" : "rgba(255,255,255,0.4)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  textDecoration: "none", transition: "all 0.1s",
                  fontFamily: F,
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}}
              >
                <Icon size={15} style={{ opacity: active ? 1 : 0.55, color: active ? "#0ea5e9" : "currentColor" }} />
                {label}
              </NavLink>
            );
          })}

          {/* Divider before extras */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "8px 2px" }} />

          {/* More tools */}
          {[
            { url: "/dashboard/script",    label: "Script",     icon: "✍️" },
            { url: "/dashboard/brief",     label: "Brief",      icon: "📋" },
            { url: "/dashboard/boards",    label: "Boards",     icon: "🗂️" },
            { url: "/dashboard/preflight", label: "Pre-flight", icon: "🛫" },
            { url: "/dashboard/translate", label: "Translate",  icon: "🌍" },
            { url: "/dashboard/persona",   label: "Persona",    icon: "🎯" },
            { url: "/dashboard/templates", label: "Templates",  icon: "📐" },
            { url: "/dashboard/intelligence", label: "Insights",icon: "📊" },
          ].map(({ url, label, icon }) => {
            const active = isActive(url);
            const locked = (plan === "free") && url !== "/dashboard/persona";
            return (
              <NavLink
                key={url}
                to={url}
                onClick={onClose}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 10px", borderRadius: 7,
                  color: active ? "#fff" : "rgba(255,255,255,0.32)",
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  fontSize: 12, fontWeight: active ? 500 : 400,
                  textDecoration: "none", transition: "all 0.1s",
                  fontFamily: F,
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.32)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: "center", opacity: active ? 1 : 0.6 }}>{icon}</span>
                {label}
                {locked && <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.18)" }}>🔒</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "8px 8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Upgrade — free users only */}
          {(plan === "free" || plan === "creator" || plan === "starter") && (
            <button
              onClick={() => { navigate("/pricing"); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.14)", cursor: "pointer", fontFamily: F, width: "100%", textAlign: "left" }}
            >
              <Sparkles size={13} style={{ color: "#0ea5e9", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 1 }}>Upgrade plan</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Unlock more analyses</p>
              </div>
            </button>
          )}

          <div style={{ padding: "0 2px" }}>
            <LanguageSwitcher direction="up" />
          </div>

          {/* Profile */}
          <button
            onClick={() => setProfileOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontFamily: F, width: "100%", textAlign: "left", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Avatar style={{ width: 28, height: 28, flexShrink: 0 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile?.name || user?.email?.split("@")[0] || "Account"}
              </p>
              <p style={{ fontSize: 10, color: isLifetime ? "#fbbf24" : pm.color, marginTop: 1 }}>
                {isLifetime ? "∞ Lifetime" : pm.label}
              </p>
            </div>
            <Settings size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {user && (
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          profile={profile as any}
          onProfileUpdate={(p) => onProfileUpdate?.(p as unknown as Profile)}
        />
      )}
    </>
  );
}
