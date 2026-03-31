// DashboardSidebar v4 — premium: accent color per account, animated active line,
// hover tooltips with data, system status, logo avatar in accounts
import { ChevronDown, Plus, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const F = "'Inter', system-ui, sans-serif";
const LIFETIME = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];
const PLANS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "#6b7280" },
  maker:   { label: "Maker",  color: "#60a5fa" },
  pro:     { label: "Pro",    color: "#0ea5e9" },
  studio:  { label: "Studio", color: "#a78bfa" },
  creator: { label: "Maker",  color: "#60a5fa" },
  starter: { label: "Pro",    color: "#0ea5e9" },
  scale:   { label: "Studio", color: "#a78bfa" },
};

// ── Generate accent color from persona name — restricted palette ──────────────
function personaAccent(name: string | null): string {
  if (!name) return "#0ea5e9";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  // Only colors that work on dark backgrounds — blues, cyans, teals, greens, sky
  const palette = [
    "#0ea5e9", // sky blue
    "#06b6d4", // cyan
    "#14b8a6", // teal
    "#22c55e", // green
    "#38bdf8", // light blue
    "#34d399", // emerald
    "#60a5fa", // blue
    "#4ade80", // light green
  ];
  return palette[Math.abs(hash) % palette.length];
}

// ── Tiny sparkline SVG ────────────────────────────────────────────────────────
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 52, h = 16;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`);
  const path = `M ${pts.join(" L ")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

export function DashboardSidebar({
  user, profile, open, onClose, onOpenProfile,
  savedPersonas = [], selectedPersona, onSelectPersona,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(() => {
    const p = window.location.pathname;
    return p.includes("/performance") || p.includes("/intelligence") || p.includes("/competitor") || p.includes("/analyses");
  });
  const [toolsOpen, setToolsOpen] = useState(() => {
    const p = window.location.pathname;
    return p.includes("/hooks") || p.includes("/script") || p.includes("/translate") || p.includes("/preflight") || p.includes("/templates") || p.includes("/boards");
  });
  const [perfData, setPerfData] = useState<number[] | null>(null);
  const [systemStatus, setSystemStatus] = useState<"ok" | "warn" | "loading">("loading");

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || user?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");
  const isAccountsActive = isActive("/dashboard/accounts");

  // Accent color driven by selected persona
  const accent = personaAccent(selectedPersona?.name || null);

  const pt = language === "pt", es = language === "es";

  // ── Fetch performance sparkline data for hover tooltip ────────────────────
  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) return;
    const load = async () => {
      try {
        const { data } = await (supabase as any)
          .from("daily_snapshots")
          .select("date, total_spend")
          .eq("user_id", user.id)
          .eq("persona_id", selectedPersona.id)
          .order("date", { ascending: false })
          .limit(7);
        if (data?.length) {
          setPerfData(data.reverse().map((d: any) => d.total_spend || 0));
        }
      } catch {}
    };
    load();
  }, [user?.id, selectedPersona?.id]);

  // ── System status check ────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const start = Date.now();
        await supabase.from("profiles").select("id").limit(1);
        setSystemStatus(Date.now() - start > 1500 ? "warn" : "ok");
      } catch {
        setSystemStatus("warn");
      }
    };
    check();
  }, []);

  const ANALYSIS_NAV = [
    { url: "/dashboard/performance",  label: pt ? "Performance"  : es ? "Performance"  : "Performance"  },
    { url: "/dashboard/intelligence", label: pt ? "Inteligência" : es ? "Inteligencia" : "Intelligence" },
    { url: "/dashboard/competitor",   label: dt("nav_competitor") || "Concorrentes"                      },
    { url: "/dashboard/analyses",     label: dt("nav_analyses")   || "Análises"                          },
  ];
  const TOOLS_NAV = [
    { url: "/dashboard/hooks",     label: pt ? "Gerador de Hooks" : es ? "Generador de Hooks" : "Hook Generator" },
    { url: "/dashboard/script",    label: pt ? "Roteiro"          : es ? "Guión"               : "Script"         },
    { url: "/dashboard/translate", label: pt ? "Traduzir"         : es ? "Traducir"            : "Translate"      },
    { url: "/dashboard/preflight", label: pt ? "Check Criativo"   : es ? "Check Creativo"      : "Creative Check" },
    { url: "/dashboard/templates", label: pt ? "Templates"        : es ? "Plantillas"          : "Templates"      },
    { url: "/dashboard/boards",    label: pt ? "Boards"           : es ? "Tableros"            : "Boards"         },
  ];
  const isAnalysisActive = ANALYSIS_NAV.some(i => isActive(i.url));
  const isToolsActive    = TOOLS_NAV.some(i => isActive(i.url));

  // ── Nav item with animated left bar ──────────────────────────────────────
  const navItem = (url: string, label: string, opts?: {
    badge?: string; soon?: boolean; tooltip?: React.ReactNode;
  }) => {
    const active = isActive(url);
    const [hovered, setHovered] = useState(false);
    return (
      <div key={url} style={{ position: "relative" }}>
        <NavLink to={url} onClick={onClose}
          style={{
            display: "flex", alignItems: "center", padding: "7px 14px 7px 18px",
            borderRadius: 7, margin: "1px 8px",
            color: active ? "#fff" : opts?.soon ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.52)",
            background: active ? "rgba(255,255,255,0.07)" : "transparent",
            fontSize: 13.5, fontWeight: active ? 600 : 400,
            textDecoration: "none", transition: "background 0.15s, color 0.15s", fontFamily: F,
            cursor: opts?.soon ? "default" : "pointer",
            pointerEvents: opts?.soon ? "none" : "auto",
            position: "relative", overflow: "visible",
          }}
          onMouseEnter={e => {
            setHovered(true);
            if (!active && !opts?.soon) {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.045)";
              el.style.color = "rgba(255,255,255,0.82)";
            }
          }}
          onMouseLeave={e => {
            setHovered(false);
            if (!active && !opts?.soon) {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = "rgba(255,255,255,0.52)";
            }
          }}>
          {/* Animated left bar — thin, subtle */}
          <div style={{
            position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
            width: 2, borderRadius: "0 2px 2px 0",
            height: active ? 14 : 0,
            background: "#0ea5e9",
            transition: "height 0.2s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: active ? "0 0 6px rgba(14,165,233,0.5)" : "none",
          }} />
          <span style={{ flex: 1 }}>{label}</span>
          {opts?.badge && !opts?.soon && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>
              {opts.badge}
            </span>
          )}
          {opts?.soon && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{pt ? "Em breve" : "Soon"}</span>
          )}
        </NavLink>

        {/* Hover tooltip */}
        {hovered && opts?.tooltip && (
          <div style={{
            position: "absolute", left: "calc(100% + 12px)", top: "50%", transform: "translateY(-50%)",
            background: "#0f1825", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "10px 14px", zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)", pointerEvents: "none",
            minWidth: 140, animation: "fadeTooltip 0.15s ease",
          }}>
            {opts.tooltip}
          </div>
        )}
      </div>
    );
  };

  // ── Collapsible section ───────────────────────────────────────────────────
  const collapsibleSection = (
    label: string,
    items: { url: string; label: string; tooltip?: React.ReactNode }[],
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    hasActiveChild: boolean
  ) => (
    <div>
      <button onClick={() => { setOpen(!isOpen); if (!isOpen && items.length > 0) navigate(items[0].url); }}
        style={{
          width: "calc(100% - 16px)", display: "flex", alignItems: "center",
          padding: "7px 14px 7px 22px", borderRadius: 7, margin: "1px 8px",
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: F, transition: "background 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <span style={{
          flex: 1, fontSize: 13.5, textAlign: "left",
          fontWeight: hasActiveChild ? 600 : 400,
          color: hasActiveChild ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.45)",
          transition: "color 0.15s",
        }}>{label}</span>
        <ChevronDown size={11} color="rgba(255,255,255,0.2)"
          style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div style={{ paddingLeft: 8 }}>
          {items.map(({ url, label, tooltip }) => navItem(url, label, { tooltip }))}
        </div>
      )}
    </div>
  );

  // ── Accounts item ─────────────────────────────────────────────────────────
  const accountsItem = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", margin: "1px 8px" }}>
        <NavLink to="/dashboard/accounts" onClick={onClose}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 9,
            padding: "7px 10px 7px 18px",
            borderRadius: savedPersonas.length > 0 ? "7px 0 0 7px" : 7,
            color: isAccountsActive ? "#fff" : "rgba(255,255,255,0.52)",
            background: isAccountsActive ? "rgba(255,255,255,0.07)" : "transparent",
            fontSize: 13.5, fontWeight: isAccountsActive ? 600 : 400,
            textDecoration: "none", transition: "all 0.15s", fontFamily: F,
            position: "relative",
          }}
          onMouseEnter={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.045)"; el.style.color = "rgba(255,255,255,0.82)"; }}}
          onMouseLeave={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "rgba(255,255,255,0.52)"; }}}>
          {/* Left bar */}
          <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)", width: 2, borderRadius: "0 2px 2px 0", height: isAccountsActive ? 14 : 0, background: "#0ea5e9", transition: "height 0.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: isAccountsActive ? "0 0 6px rgba(14,165,233,0.5)" : "none" }} />
          {/* Avatar só se tiver logo real */}
          {selectedPersona?.logo_url ? (
            <div style={{ width: 16, height: 16, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : null}
          <span style={{ flex: 1 }}>{pt ? "Contas" : es ? "Cuentas" : "Accounts"}</span>
          {selectedPersona && (
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          )}
        </NavLink>
        {savedPersonas.length > 0 && (
          <button onClick={() => setAccountsExpanded(e => !e)}
            style={{ width: 26, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRadius: "0 7px 7px 0", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <ChevronDown size={11} color="rgba(255,255,255,0.2)" style={{ transform: accountsExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        )}
      </div>

      {accountsExpanded && savedPersonas.length > 0 && (
        <div style={{ marginLeft: 8, marginRight: 8, marginTop: 2, background: "rgba(255,255,255,0.02)", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
          {savedPersonas.map(p => {
            const isSel = p.id === selectedPersona?.id;
            return (
              <button key={p.id}
                onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsExpanded(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: isSel ? "rgba(255,255,255,0.05)" : "transparent", border: "none", cursor: "pointer", fontFamily: F, transition: "background 0.1s" }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                {/* Neutral avatar — no random colors */}
                <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {p.logo_url
                    ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: 0 }}>{(p.name || "?").charAt(0).toUpperCase()}</span>
                  }
                </div>
                {/* Name — never bold, active is just slightly brighter */}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: isSel ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                  {p.name || "Conta"}
                </span>
                {/* Active indicator — small, no glow */}
                {isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.4)", flexShrink: 0 }} />}
              </button>
            );
          })}
          <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsExpanded(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: F, transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Plus size={11} color="rgba(14,165,233,0.6)" />
            <span style={{ fontSize: 12.5, color: "rgba(14,165,233,0.7)", fontWeight: 400 }}>{pt ? "Nova conta" : es ? "Nueva cuenta" : "New account"}</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── Performance tooltip content ───────────────────────────────────────────
  const perfTooltip = perfData ? (
    <div>
      <p style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>Spend 7 dias</p>
      <MiniSparkline data={perfData} color={accent} />
      <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff", margin: "6px 0 0" }}>
        R${perfData.reduce((a, b) => a + b, 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
      </p>
    </div>
  ) : null;

  const ANALYSIS_WITH_TOOLTIPS = ANALYSIS_NAV.map(item => ({
    ...item,
    tooltip: item.url === "/dashboard/performance" && perfTooltip ? perfTooltip : undefined,
  }));

  return (
    <>
      <style>{`
        @keyframes fadeTooltip { from { opacity:0; transform:translateY(-50%) translateX(-4px); } to { opacity:1; transform:translateY(-50%) translateX(0); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 216, background: "#090d18", borderRight: "1px solid rgba(255,255,255,0.055)", fontFamily: F, display: "flex", flexDirection: "column", flexShrink: 0 }}
      >
        {/* Logo */}
        <div style={{ height: 52, minHeight: 52, padding: "0 18px", flexShrink: 0, display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 12, paddingBottom: 8, overflowY: "auto", overflowX: "hidden" }}>

          {/* Create campaign — fixed brand blue, not accent */}
          <div style={{ margin: "0 8px 4px" }}>
            <NavLink to="/dashboard/campaigns/new" onClick={onClose}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 14px", borderRadius: 7,
                background: isActive("/dashboard/campaigns/new") ? "rgba(14,165,233,0.18)" : "rgba(14,165,233,0.08)",
                border: "1px solid rgba(14,165,233,0.2)",
                fontSize: 13.5, fontWeight: 600, color: "#7dd3fc",
                textDecoration: "none", transition: "all 0.15s", fontFamily: F,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.13)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive("/dashboard/campaigns/new") ? "rgba(14,165,233,0.18)" : "rgba(14,165,233,0.08)"; }}>
              {pt ? "Criar Campanha" : es ? "Crear Campaña" : "Create Campaign"}
            </NavLink>
          </div>

          {navItem("/dashboard/ai", "IA Chat", { badge: "AI" })}
          {accountsItem()}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "14px 18px 10px" }} />

          {collapsibleSection(
            pt ? "Análise" : es ? "Análisis" : "Analytics",
            ANALYSIS_WITH_TOOLTIPS, analysisOpen, setAnalysisOpen, isAnalysisActive
          )}
          {collapsibleSection(
            pt ? "Ferramentas" : es ? "Herramientas" : "Tools",
            TOOLS_NAV, toolsOpen, setToolsOpen, isToolsActive
          )}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 10px 12px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>

          {/* System status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", marginBottom: 2 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: systemStatus === "ok" ? "#22c55e" : systemStatus === "warn" ? "#f59e0b" : "#6b7280",
              boxShadow: systemStatus === "ok" ? "0 0 6px #22c55e60" : "none",
              animation: systemStatus === "loading" ? "pulseDot 1.2s ease infinite" : "none",
            }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: F }}>
              {systemStatus === "ok" ? (pt ? "Todos os sistemas OK" : es ? "Todos los sistemas OK" : "All systems OK") :
               systemStatus === "warn" ? (pt ? "Lentidão detectada" : es ? "Lentitud detectada" : "Slowness detected") :
               (pt ? "Verificando..." : es ? "Verificando..." : "Checking...")}
            </span>
          </div>

          {/* Upgrade */}
          {plan === "free" && (
            <button onClick={() => { navigate("/pricing"); onClose(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", fontFamily: F, width: "100%", marginBottom: 2, transition: "background 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>{pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}</span>
              <Zap size={12} color="rgba(255,255,255,0.3)" />
            </button>
          )}

          <LanguageSwitcher direction="up" />

          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "2px 0" }} />

          {/* Profile */}
          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: F, width: "100%", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 11, fontWeight: 700, background: `linear-gradient(135deg, ${accent}, ${accent}88)`, color: "#fff", borderRadius: 8 }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{displayName}</p>
              <p style={{ fontSize: 11, color: isLifetime ? "#fbbf24" : pm.color, margin: 0, fontWeight: 500 }}>{isLifetime ? "∞ Lifetime" : pm.label}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
