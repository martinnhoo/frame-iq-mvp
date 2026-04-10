// DashboardSidebar v10 — progressive disclosure: core + secondary + advanced
import { MessageSquare, BarChart2, LayoutGrid, Building2, ChevronDown, Plus, Zap, ArrowUpRight, Sparkles, Clapperboard, FileText, ScanEye, ScanLine, Brain, Gift } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlanUpgradeModal } from "./PlanUpgradeModal";

interface Profile {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  plan: string | null; [key: string]: unknown;
}
interface ActivePersona {
  id: string; name: string; logo_url?: string | null; website?: string | null;
  description?: string | null; [key: string]: unknown;
}
interface SidebarProps {
  user: SupaUser | null; profile: Profile | null;
  onProfileUpdate?: (p: Profile) => void; open: boolean; onClose: () => void;
  onOpenProfile?: () => void;
  savedPersonas?: ActivePersona[];
  selectedPersona?: ActivePersona | null;
  onSelectPersona?: (p: ActivePersona) => void;
}

const LIFETIME = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];
const PLANS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "rgba(255,255,255,0.25)" },
  maker:   { label: "Maker",  color: "rgba(96,165,250,0.6)"   },
  pro:     { label: "Pro",    color: "rgba(14,165,233,0.65)"  },
  studio:  { label: "Studio", color: "rgba(167,139,250,0.65)" },
  creator: { label: "Maker",  color: "rgba(96,165,250,0.6)"   },
  starter: { label: "Pro",    color: "rgba(14,165,233,0.65)"  },
  scale:   { label: "Studio", color: "rgba(167,139,250,0.65)" },
};

const F = "'Plus Jakarta Sans', sans-serif";
const BLUE = "#0ea5e9";

const SB_AVATAR_PALETTE = [
  { bg:"rgba(14,165,233,0.15)",  border:"rgba(14,165,233,0.25)",  text:"#38bdf8"  },
  { bg:"rgba(167,139,250,0.15)", border:"rgba(167,139,250,0.25)", text:"#c4b5fd"  },
  { bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.22)",  text:"#6ee7b7"  },
  { bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.22)",  text:"#fcd34d"  },
  { bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.22)", text:"#fca5a5"  },
  { bg:"rgba(6,182,212,0.13)",   border:"rgba(6,182,212,0.23)",   text:"#67e8f9"  },
  { bg:"rgba(244,114,182,0.12)", border:"rgba(244,114,182,0.22)", text:"#f9a8d4"  },
];
function sbAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return SB_AVATAR_PALETTE[Math.abs(h) % SB_AVATAR_PALETTE.length];
}

function NavItem({ url, label, icon: Icon, isActive, onClose, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 14px", margin: "1px 0",
        color: isActive ? "#fff" : hov ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.50)",
        background: isActive ? "rgba(255,255,255,0.07)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        fontSize: 13.5, fontWeight: isActive ? 600 : 400,
        textDecoration: "none", transition: "all 0.12s",
        fontFamily: F, letterSpacing: "-0.01em", position: "relative",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 2, height: 18, background: BLUE, borderRadius: "0 2px 2px 0",
        }} />
      )}
      <Icon size={15} strokeWidth={1.6}
        style={{ color: isActive ? BLUE : "inherit", flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9.5, fontWeight: 600, color: "rgba(14,165,233,0.7)",
          border: "1px solid rgba(14,165,233,0.25)", borderRadius: 4,
          padding: "1px 5px", letterSpacing: "0.06em", fontFamily: F,
        }}>{badge}</span>
      )}
    </NavLink>
  );
}

function NavTool({ url, label, icon: Icon, isActive, onClose }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 14px",
        color: isActive ? "rgba(255,255,255,0.90)" : hov ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.38)",
        background: isActive ? "rgba(255,255,255,0.055)" : hov ? "rgba(255,255,255,0.03)" : "transparent",
        fontSize: 13, fontWeight: isActive ? 500 : 400,
        textDecoration: "none", transition: "all 0.1s",
        fontFamily: F, position: "relative",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 2, height: 14, background: "rgba(14,165,233,0.55)", borderRadius: "0 2px 2px 0",
        }} />
      )}
      <Icon size={14} strokeWidth={1.5}
        style={{ flexShrink: 0, opacity: isActive ? 0.8 : hov ? 0.6 : 0.42 }} />
      <span>{label}</span>
    </NavLink>
  );
}

export function DashboardSidebar({
  user, profile, open, onClose, onOpenProfile,
  savedPersonas = [], selectedPersona, onSelectPersona,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [kpi, setKpi] = useState<{ spend: number; ctr: number; ads: number; trend: "up" | "down" | "flat" | null } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Progressive disclosure: load collapse state from localStorage
  const [secondaryOpen, setSecondaryOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sb-secondary-open");
      return saved !== null ? JSON.parse(saved) : true; // Show by default
    } catch {
      return true;
    }
  });
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sb-advanced-open");
      return saved !== null ? JSON.parse(saved) : false; // Collapsed by default
    } catch {
      return false;
    }
  });

  // Persist collapse state
  useEffect(() => {
    try {
      localStorage.setItem("sb-secondary-open", JSON.stringify(secondaryOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [secondaryOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("sb-advanced-open", JSON.stringify(advancedOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [advancedOpen]);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setKpi(null); return; }
    // Use meta-oauth get_connections (service_role) to check if connected
    supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: user.id }
    }).then(({ data }: any) => {
      const all = (data?.connections || []) as any[];
      const connected = all.some((c: any) => c.persona_id === selectedPersona.id && c.status === "active");
      if (!connected) { setKpi(null); return; }
      setKpi({ spend: 0, ctr: 0, ads: 0, trend: null });
      // Load KPI from daily_snapshots
      (supabase as any).from("daily_snapshots")
        .select("total_spend, avg_ctr, active_ads")
        .eq("user_id", user.id).eq("persona_id", selectedPersona.id)
        .order("date", { ascending: false }).limit(2)
        .then(({ data }: any) => {
          const rows = data || [];
          const latest = rows[0], prev = rows[1];
          if (!latest || (latest.total_spend === 0 && latest.avg_ctr === 0)) return;
          const ctr = (latest.avg_ctr || 0) * 100;
          const prevCtr = prev ? (prev.avg_ctr || 0) * 100 : null;
          const trend = prevCtr !== null && prevCtr > 0
            ? ctr > prevCtr * 1.05 ? "up" : ctr < prevCtr * 0.95 ? "down" : "flat"
            : null;
          setKpi({ spend: latest.total_spend || 0, ctr, ads: latest.active_ads || 0, trend });
        });
    }).catch(() => setKpi(null));
  }, [user?.id, selectedPersona?.id]);

  const perfActive = isAt("/dashboard/performance") || isAt("/dashboard/diary");

  // Core: always visible (no collapse)
  const PRIMARY = [
    { url: "/dashboard/ai",          label: "IA Chat",     icon: MessageSquare, badge: "AI" },
    { url: "/dashboard/performance",  label: "Performance", icon: BarChart2, forceActive: perfActive },
    { url: "/dashboard/accounts",     label: pt ? "Contas" : es ? "Cuentas" : "Accounts", icon: Building2 },
  ];

  // Secondary: shown by default (collapsible under "Ferramentas")
  const SECONDARY_TOOLS = [
    { url: "/dashboard/intelligence", label: pt ? "Inteligência" : es ? "Inteligencia" : "Intelligence", icon: Brain },
    { url: "/dashboard/hooks",        label: "Hooks",                                                      icon: Sparkles },
    { url: "/dashboard/preflight",    label: pt ? "Check Criativo" : es ? "Check Creativo" : "Creative Check", icon: ScanLine },
    { url: "/dashboard/brief",        label: "Brief",                                                      icon: FileText },
  ];

  // Advanced: collapsed by default (under "Mais ferramentas")
  const ADVANCED_TOOLS = [
    { url: "/dashboard/boards",       label: "Boards",                                                     icon: LayoutGrid },
    { url: "/dashboard/script",       label: pt ? "Roteiro" : es ? "Guión" : "Script",                    icon: Clapperboard },
    { url: "/dashboard/competitor",   label: pt ? "Concorrentes" : es ? "Competidores" : "Competitors",   icon: ScanEye },
    { url: "/dashboard/translate",    label: pt ? "Traduzir" : es ? "Traducir" : "Translate",            icon: MessageSquare },
    { url: "/dashboard/templates",    label: pt ? "Templates" : es ? "Plantillas" : "Templates",         icon: FileText },
    { url: "/dashboard/preflight-pro", label: pt ? "Preflight Pro" : es ? "Preflight Pro" : "Preflight Pro", icon: ScanLine },
    { url: "/dashboard/campaign",     label: pt ? "Campaign Builder" : es ? "Constructor Campañas" : "Campaign Builder", icon: BarChart2 },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-in { from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      <aside style={{
        width: 216, height: "100%",
        background: "var(--bg-main)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", flexShrink: 0,
        fontFamily: F, overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Account selector — flat, sem card */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => savedPersonas.length > 0 ? setAccountsOpen(o => !o) : navigate("/dashboard/accounts")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "8px 14px", background: "transparent", border: "none",
              cursor: "pointer", textAlign: "left", transition: "background 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0, overflow: "hidden",
              background: selectedPersona ? sbAvatarColor(selectedPersona.name || "?").bg : "rgba(255,255,255,0.06)",
              border: `1px solid ${selectedPersona ? sbAvatarColor(selectedPersona.name || "?").border : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selectedPersona?.logo_url
                ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : selectedPersona
                  ? (() => { const av = sbAvatarColor(selectedPersona.name || "?"); return (
                      <span style={{ fontSize: 12, fontWeight: 700, color: av.text, fontFamily: F }}>
                        {(selectedPersona.name || "?").charAt(0).toUpperCase()}
                      </span>
                    ); })()
                  : <Building2 size={12} color="rgba(255,255,255,0.28)" />
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 500,
                color: selectedPersona ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                lineHeight: 1.3, fontFamily: F, letterSpacing: "-0.01em",
              }}>
                {selectedPersona?.name || (pt ? "Selecionar conta" : "Select account")}
              </p>

              {kpi != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  {/* Meta dot — clean, sem SVG complexo */}
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: "#1877F2",
                    boxShadow: "0 0 4px rgba(24,119,242,0.7)",
                  }} />
                  {kpi.ads > 0 ? (
                    <span style={{ fontSize: 10.5, color: "rgba(14,165,233,0.72)", fontFamily: F, fontWeight: 500 }}>
                      {kpi.ads} {pt ? "ativos" : "active"}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", fontFamily: F }}>
                      {pt ? "conectado" : "connected"}
                    </span>
                  )}
                  {kpi.ctr > 0 && (
                    <>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.10)" }}>·</span>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: F }}>
                        {kpi.ctr.toFixed(1)}%
                        {kpi.trend === "up" && <span style={{ color: "#22c55e", marginLeft: 2 }}>↑</span>}
                        {kpi.trend === "down" && <span style={{ color: "#f87171", marginLeft: 2 }}>↓</span>}
                      </span>
                    </>
                  )}
                </div>
              ) : selectedPersona ? (
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.18)", fontFamily: F }}>
                  {pt ? "sem conexão" : es ? "sin conexión" : "not connected"}
                </p>
              ) : null}
            </div>

            {savedPersonas.length > 0 && (
              <ChevronDown size={12} color="rgba(255,255,255,0.20)"
                style={{ flexShrink: 0, transform: accountsOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
            )}
          </button>

          {/* Dropdown */}
          {accountsOpen && savedPersonas.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", animation: "sb-in 0.12s ease", paddingTop: 2 }}>
              {savedPersonas.map(p => {
                const isSel = p.id === selectedPersona?.id;
                return (
                  <button key={p.id}
                    onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 14px",
                      background: isSel ? "rgba(14,165,233,0.06)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, overflow: "hidden",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {p.logo_url
                        ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (() => { const av = sbAvatarColor(p.name || "?"); return (
                            <span style={{ fontSize: 10, fontWeight: 700, color: av.text }}>
                              {(p.name || "?").charAt(0).toUpperCase()}
                            </span>
                          ); })()}
                    </div>
                    <span style={{
                      flex: 1, fontSize: 12.5, fontWeight: isSel ? 500 : 400,
                      color: isSel ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.52)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F,
                    }}>{p.name}</span>
                    {isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />}
                  </button>
                );
              })}
              <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", background: "transparent", border: "none",
                  borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <Plus size={11} color="rgba(14,165,233,0.45)" />
                <span style={{ fontSize: 12, color: "rgba(14,165,233,0.55)", fontFamily: F }}>
                  {pt ? "Nova conta" : "New account"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0 6px", flexShrink: 0 }} />

        {/* Primary nav */}
        <nav style={{ flexShrink: 0 }}>
          {PRIMARY.map(item => (
            <NavItem key={item.url} url={item.url} label={item.label} icon={item.icon}
              isActive={(item as any).forceActive ?? isAt(item.url)}
              onClose={onClose} badge={(item as any).badge} />
          ))}
        </nav>

        {/* Secondary Tools section (shown by default) */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => setSecondaryOpen(!secondaryOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              margin: "10px 14px 5px", padding: 0, background: "none", border: "none",
              cursor: "pointer", transition: "all 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.18)",
              letterSpacing: "0.10em", textTransform: "uppercase", margin: 0, fontFamily: F, flex: 1,
            }}>
              {pt ? "Ferramentas" : es ? "Herramientas" : "Tools"}
            </p>
            <ChevronDown size={12} color="rgba(255,255,255,0.15)"
              style={{ flexShrink: 0, transform: secondaryOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.18s" }} />
          </button>

          {secondaryOpen && (
            <div style={{ flexShrink: 0, animation: "sb-in 0.12s ease" }}>
              {SECONDARY_TOOLS.map(item => (
                <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
                  isActive={isAt(item.url)} onClose={onClose} />
              ))}
            </div>
          )}
        </div>

        {/* Advanced Tools section (collapsed by default) */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              margin: "8px 14px 5px", padding: 0, background: "none", border: "none",
              cursor: "pointer", transition: "all 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.12)",
              letterSpacing: "0.10em", textTransform: "uppercase", margin: 0, fontFamily: F, flex: 1,
            }}>
              {pt ? "Mais ferramentas" : es ? "Más herramientas" : "Advanced"}
            </p>
            <ChevronDown size={12} color="rgba(255,255,255,0.10)"
              style={{ flexShrink: 0, transform: advancedOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.18s" }} />
          </button>

          {advancedOpen && (
            <div style={{ flexShrink: 0, animation: "sb-in 0.12s ease" }}>
              {ADVANCED_TOOLS.map(item => (
                <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
                  isActive={isAt(item.url)} onClose={onClose} />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 4px" }} />

          {/* Referral link */}
          <NavTool url="/dashboard/referral"
            label={pt ? "Indicações" : es ? "Referidos" : "Referrals"}
            icon={Gift} isActive={isAt("/dashboard/referral")} onClose={onClose} />

          {plan === "free" && !isLifetime && (
            <button onClick={() => setUpgradeOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                background: "transparent", border: "none", cursor: "pointer", width: "100%",
                transition: "background 0.1s", marginBottom: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <Zap size={14} strokeWidth={1.6} color="rgba(14,165,233,0.55)" />
              <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(14,165,233,0.60)", fontFamily: F }}>
                {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}
              </span>
              <ArrowUpRight size={12} color="rgba(14,165,233,0.35)" style={{ marginLeft: "auto" }} />
            </button>
          )}

          <button onClick={() => onOpenProfile?.()}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "8px 14px 12px",
              background: "transparent", border: "none", cursor: "pointer", width: "100%",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{
                fontSize: 11, fontWeight: 700, borderRadius: 7,
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{
                fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.72)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                margin: 0, lineHeight: 1.3, fontFamily: F,
              }}>{displayName}</p>
              <p style={{
                fontSize: 11, margin: 0, fontWeight: 500, lineHeight: 1.3, fontFamily: F,
                color: isLifetime ? "rgba(251,191,36,0.55)" : pm.color,
              }}>
                {isLifetime ? "∞ Lifetime" : pm.label}
              </p>
            </div>
          </button>
        </div>
      </aside>

      <PlanUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={plan} language={language} />
    </>
  );
}
