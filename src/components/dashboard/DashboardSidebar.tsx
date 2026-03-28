import {
  MessageSquare, BarChart3, Zap, Search, Settings, Target,
  Sparkles, CreditCard, Brain, Building2, FileText,
  Globe, LayoutDashboard, PenTool, Plane, BookOpen,
  ChevronRight, CheckCircle2, Circle, ChevronDown,
  // New precise icons
  ScanEye, Clapperboard, Languages, ShieldCheck,
  LayoutTemplate, Kanban, Cpu, Users2, TrendingUp, Plus, Rocket,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useState } from "react";

interface Profile {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  plan: string | null; [key: string]: unknown;
}
interface ActivePersona {
  id: string; name: string; logo_url?: string | null; website?: string | null; description?: string | null;
  [key: string]: unknown;
}
interface SidebarProps {
  user: SupaUser | null; profile: Profile | null;
  onProfileUpdate?: (p: Profile) => void; open: boolean; onClose: () => void;
  onOpenProfile?: () => void;
  savedPersonas?: ActivePersona[];
  selectedPersona?: ActivePersona | null;
  onSelectPersona?: (p: ActivePersona) => void;
}

const F = "'Inter', system-ui, sans-serif";
const LIFETIME = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];

const PLANS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "#9ca3af" },
  maker:   { label: "Maker",  color: "#60a5fa" },
  pro:     { label: "Pro",    color: "#0ea5e9" },
  studio:  { label: "Studio", color: "#0ea5e9" },
  creator: { label: "Maker",  color: "#60a5fa" },
  starter: { label: "Pro",    color: "#0ea5e9" },
  scale:   { label: "Studio", color: "#0ea5e9" },
};

// Sidebar colors v2 — more contrast, cleaner hierarchy
const SB = {
  bg:           "#0b0f18",
  border:       "rgba(255,255,255,0.08)",
  activeItem:   "rgba(14,165,233,0.10)",
  activeBorder: "rgba(14,165,233,0.35)",
  activeText:   "#cce8ff",
  activeIcon:   "#38bdf8",
  idleText:     "rgba(238,240,246,0.50)",
  idleIcon:     "rgba(238,240,246,0.30)",
  hoverBg:      "rgba(255,255,255,0.05)",
  divider:    "rgba(255,255,255,0.10)",
  sectionLabel: "rgba(255,255,255,0.28)",
  footerBg:   "rgba(0,0,0,0.2)",
};

export function DashboardSidebar({ user, profile, onProfileUpdate, open, onClose, onOpenProfile, savedPersonas = [], selectedPersona, onSelectPersona }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [accountsExpanded, setAccountsExpanded] = useState(false);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || user?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const isActive = (url: string, exact = false) =>
    exact ? location.pathname === url : location.pathname === url || location.pathname.startsWith(url + "/");
  const isAccountsActive = isActive("/dashboard/accounts");

  const PRIMARY_NAV = [
    { url: "/dashboard/campaigns/new", label: language==="pt" ? "Criar Campanha" : language==="es" ? "Crear Campaña" : "Create Campaign", icon: Rocket,    exact: false, hot: false, highlight: true  },
    { url: "/dashboard/performance",   label: language==="pt" ? "Performance"    : language==="es" ? "Performance"    : "Performance",    icon: BarChart3, exact: false, hot: false, highlight: false },
    { url: "/dashboard/ai",            label: "IA Chat",                                                                                    icon: Cpu,       exact: false, hot: true,  highlight: false },
    { url: "/dashboard/intelligence",  label: language==="pt" ? "Inteligência"   : language==="es" ? "Inteligencia"   : "Intelligence",   icon: Brain,     exact: false, hot: false, highlight: false },
    { url: "/dashboard/competitor",    label: dt("nav_competitor")||"Concorrentes",                                                         icon: ScanEye,   exact: false, hot: false, highlight: false },
    { url: "/dashboard/analyses",      label: dt("nav_analyses")||"Análises",                                                               icon: TrendingUp, exact: false, hot: false, highlight: false },
  ];

  const TOOLS_NAV = [
    { url: "/dashboard/hooks",        label: dt("nav_hooks")||"Gerador de Hooks",   icon: Zap },
    { url: "/dashboard/script",       label: dt("nav_script")||"Roteiro",           icon: Clapperboard },
    { url: "/dashboard/translate",    label: dt("nav_translate")||"Traduzir",       icon: Languages },
    { url: "/dashboard/preflight",    label: dt("nav_preflight")||"Check Criativo", icon: ShieldCheck },
    { url: "/dashboard/templates",    label: dt("nav_templates")||"Templates",      icon: LayoutTemplate },
    { url: "/dashboard/boards",       label: dt("nav_boards")||"Boards",            icon: Kanban },
  ];

  const primaryItem = (url: string, label: string, Icon: any, exact = false, hot = false, highlight = false) => {
    const active = isActive(url, exact);
    if (highlight) {
      return (
        <NavLink key={url} to={url} end={exact} onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            borderRadius: 10, margin: "6px 6px 4px",
            background: active
              ? "linear-gradient(135deg,#0891b2,#0ea5e9)"
              : "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(6,182,212,0.12))",
            border: `1px solid ${active ? "transparent" : "rgba(14,165,233,0.35)"}`,
            fontSize: 13, fontWeight: 700,
            color: "#fff",
            textDecoration: "none", transition: "all 0.15s", fontFamily: F,
            boxShadow: active ? "0 2px 12px rgba(14,165,233,0.3)" : "none",
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "linear-gradient(135deg,rgba(14,165,233,0.28),rgba(6,182,212,0.2))"; el.style.boxShadow = "0 2px 12px rgba(14,165,233,0.25)"; }}
          onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(6,182,212,0.12))"; el.style.boxShadow = "none"; }}}
        >
          <Icon size={15} style={{ color: "#7dd3fc", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#7dd3fc", background: "rgba(14,165,233,0.2)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.06em" }}>NOVO</span>
        </NavLink>
      );
    }
    return (
      <NavLink key={url} to={url} end={exact} onClick={onClose}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
          borderRadius: 8, margin: "2px 6px",
          color: active ? SB.activeText : SB.idleText,
          background: active ? SB.activeItem : "transparent",
          border: active ? `1px solid ${SB.activeBorder}` : "1px solid transparent",
          fontSize: 13, fontWeight: active ? 600 : 400,
          textDecoration: "none", transition: "all 0.12s", fontFamily: F,
          position: "relative",
        }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = SB.hoverBg; el.style.color = "rgba(255,255,255,0.82)"; }}}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = SB.idleText; }}}
      >
        <Icon size={15} style={{ color: active ? SB.activeIcon : SB.idleIcon, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{label}</span>
        {hot && !active && <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.06em" }}>AI</span>}
        {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: SB.activeIcon, boxShadow: `0 0 6px ${SB.activeIcon}` }} />}
      </NavLink>
    );
  };

  const toolItem = (url: string, label: string, IconOrEmoji: any) => {
    const active = isActive(url);
    const isComponent = typeof IconOrEmoji !== "string";
    return (
      <NavLink key={url} to={url} onClick={onClose}
        style={{
          display: "flex", alignItems: "center", gap: 9, padding: "8px 14px",
          borderRadius: 8, margin: "2px 6px",
          color: active ? SB.activeText : SB.idleText,
          background: active ? SB.activeItem : "transparent",
          border: active ? `1px solid ${SB.activeBorder}` : "1px solid transparent",
          fontSize: 13, fontWeight: active ? 600 : 400,
          textDecoration: "none", transition: "all 0.12s", fontFamily: F,
        }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = SB.hoverBg; el.style.color = "rgba(255,255,255,0.75)"; }}}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = SB.idleText; }}}
      >
        <span style={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isComponent
            ? <IconOrEmoji size={14} color={active ? SB.activeText : "rgba(255,255,255,0.35)"}/>
            : <span style={{ fontSize: 13 }}>{IconOrEmoji}</span>
          }
        </span>
        <span style={{ flex: 1 }}>{label}</span>
      </NavLink>
    );
  };

  // Accounts item with inline persona switcher
  const accountsItem = () => {
    const active = isAccountsActive || accountsExpanded;
    return (
      <div style={{ margin: "2px 6px" }}>
        {/* Main row */}
        <div style={{ display: "flex", alignItems: "center", borderRadius: 8 }}>
          <NavLink to="/dashboard/accounts" onClick={onClose}
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "9px 10px 9px 14px",
              borderRadius: accountsExpanded ? "8px 0 0 0" : 8,
              color: isAccountsActive ? SB.activeText : SB.idleText,
              background: isAccountsActive ? SB.activeItem : "transparent",
              border: isAccountsActive ? `1px solid ${SB.activeBorder}` : "1px solid transparent",
              borderRight: "none",
              fontSize: 13, fontWeight: isAccountsActive ? 600 : 400,
              textDecoration: "none", transition: "all 0.12s", fontFamily: F,
            }}
            onMouseEnter={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = SB.hoverBg; el.style.color = "rgba(255,255,255,0.82)"; }}}
            onMouseLeave={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = SB.idleText; }}}
          >
            <Users2 size={15} style={{ color: isAccountsActive ? SB.activeIcon : SB.idleIcon, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{language==="pt"?"Contas":language==="es"?"Cuentas":"Accounts"}</span>
            {selectedPersona && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(14,165,233,0.9)", background: "rgba(14,165,233,0.1)", borderRadius: 4, padding: "2px 6px", flexShrink: 0, letterSpacing: "0.03em", border: "1px solid rgba(14,165,233,0.2)" }}>
                {selectedPersona.name.split(" ").map((w: string) => w[0]).slice(0, 3).join("").toUpperCase()}
              </span>
            )}
          </NavLink>
          {/* Chevron toggle for persona list */}
          {savedPersonas.length > 0 && (
            <button
              onClick={() => setAccountsExpanded(e => !e)}
              style={{
                width: 28, height: 37, display: "flex", alignItems: "center", justifyContent: "center",
                background: isAccountsActive ? SB.activeItem : accountsExpanded ? "rgba(255,255,255,0.06)" : "transparent",
                border: isAccountsActive ? `1px solid ${SB.activeBorder}` : "1px solid transparent",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0 8px 8px 0",
                cursor: "pointer", transition: "all 0.12s", flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isAccountsActive ? SB.activeItem : accountsExpanded ? "rgba(255,255,255,0.06)" : "transparent"; }}
            >
              <ChevronDown size={12} color="rgba(255,255,255,0.4)" style={{ transform: accountsExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
          )}
        </div>

        {/* Expanded persona list */}
        {accountsExpanded && savedPersonas.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            {savedPersonas.map(p => {
              const isSel = p.id === selectedPersona?.id;
              return (
                <button key={p.id}
                  onClick={() => {
                    onSelectPersona?.(p);
                    navigate("/dashboard/ai");
                    onClose();
                    setAccountsExpanded(false);
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", background: isSel ? "rgba(14,165,233,0.08)" : "transparent",
                    border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer", fontFamily: F, transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Avatar */}
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: isSel ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    {p.logo_url
                      ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 10, fontWeight: 700, color: isSel ? "#38bdf8" : "rgba(255,255,255,0.5)" }}>{p.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: isSel ? 600 : 400, color: isSel ? "#e2f4ff" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{p.name}</span>
                  {isSel && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />}
                </button>
              );
            })}
            {/* Add new account shortcut */}
            <button
              onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsExpanded(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: F }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Plus size={11} color="rgba(255,255,255,0.25)" />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{language==="pt"?"Nova conta":language==="es"?"Nueva cuenta":"New account"}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const sectionLabel = (txt: string) => (
    <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: SB.sectionLabel, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 12px 5px" }}>{txt}</p>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm" onClick={onClose} />}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 220, background: SB.bg, borderRight: `1px solid rgba(255,255,255,0.07)`, fontFamily: F, display: "flex", flexDirection: "column", flexShrink: 0 }}
      >
        {/* ── Logo ── */}
        <div style={{ height: 52, minHeight: 52, padding: "0 20px", flexShrink: 0, display: "flex", alignItems: "center", background: "#0b0f18" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Thin divider below logo, same as topbar bottom border */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

        {/* ── Nav ── */}
        <nav style={{ flex: 1, paddingTop: 8, overflowY: "auto", overflowX: "hidden" }}>

          {/* Primary */}
          {PRIMARY_NAV.map(({ url, label, icon, exact, hot, highlight }) => primaryItem(url, label, icon, exact, hot, highlight))}

          {/* Accounts with inline persona switcher */}
          {accountsItem()}

          {/* Divider */}
          <div style={{ height: 1, background: SB.divider, margin: "10px 12px 2px" }} />

          {/* Tools section — lower visual weight than primary nav */}
          <p style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.20)", letterSpacing: "0.10em", textTransform: "uppercase", padding: "6px 16px 2px", margin: 0 }}>{language==="pt" ? "Ferramentas" : language==="es" ? "Herramientas" : "Tools"}</p>
          {TOOLS_NAV.map(({ url, label, icon }) => toolItem(url, label, icon))}

        </nav>

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${SB.divider}`, padding: "8px 6px 10px", background: SB.footerBg, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3 }}>

          {/* Upgrade */}
          {plan === "free" && (
            <button onClick={() => { navigate("/pricing"); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)", cursor: "pointer", fontFamily: F, width: "100%", textAlign: "left", marginBottom: 4 }}>
              <Sparkles size={13} style={{ color: "#0ea5e9", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#e2f4ff", marginBottom: 1 }}>{dt("nav_upgrade")}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.42)" }}>{dt("nav_upgrade_desc")}</p>
              </div>
            </button>
          )}

          <div style={{ padding: "0 4px 2px" }}>
            <LanguageSwitcher direction="up" />
          </div>

          {/* Profile row — inspired by Meta's account switcher */}
          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: F, width: "100%", textAlign: "left", transition: "all 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}>
            <Avatar style={{ width: 30, height: 30, flexShrink: 0 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </p>
              <p style={{ fontSize: 11, color: isLifetime ? "#fbbf24" : pm.color, marginTop: 1, fontWeight: 500 }}>
                {isLifetime ? "∞ Lifetime" : pm.label}
              </p>
            </div>
            <Settings size={12} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
          </button>
        </div>
      </aside>

    </>
  );
}

// force-sync 2026-03-24T23:23:48Z