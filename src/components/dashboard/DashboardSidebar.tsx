// DashboardSidebar v3 — Apple/Posttar aesthetic: text-first, no icons in nav, typographic hierarchy
import { ChevronDown, Plus } from "lucide-react";
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
  free:    { label: "Free",    color: "#6b7280" },
  maker:   { label: "Maker",  color: "#60a5fa" },
  pro:     { label: "Pro",    color: "#0ea5e9" },
  studio:  { label: "Studio", color: "#0ea5e9" },
  creator: { label: "Maker",  color: "#60a5fa" },
  starter: { label: "Pro",    color: "#0ea5e9" },
  scale:   { label: "Studio", color: "#0ea5e9" },
};

export function DashboardSidebar({
  user, profile, open, onClose, onOpenProfile,
  savedPersonas = [], selectedPersona, onSelectPersona,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || user?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");
  const isAccountsActive = isActive("/dashboard/accounts");

  const pt = language === "pt", es = language === "es";

  const ANALYSIS_NAV = [
    { url: "/dashboard/performance",  label: pt ? "Performance"   : es ? "Performance"   : "Performance"  },
    { url: "/dashboard/intelligence", label: pt ? "Inteligência"  : es ? "Inteligencia"  : "Intelligence" },
    { url: "/dashboard/competitor",   label: dt("nav_competitor") || "Concorrentes"                       },
    { url: "/dashboard/analyses",     label: dt("nav_analyses")   || "Análises"                           },
  ];

  const TOOLS_NAV = [
    { url: "/dashboard/hooks",      label: pt ? "Gerador de Hooks"  : es ? "Generador de Hooks"  : "Hook Generator" },
    { url: "/dashboard/script",     label: pt ? "Roteiro"           : es ? "Guión"                : "Script"         },
    { url: "/dashboard/translate",  label: pt ? "Traduzir"          : es ? "Traducir"             : "Translate"      },
    { url: "/dashboard/preflight",  label: pt ? "Check Criativo"    : es ? "Check Creativo"       : "Creative Check" },
    { url: "/dashboard/templates",  label: pt ? "Templates"         : es ? "Plantillas"           : "Templates"      },
    { url: "/dashboard/boards",     label: pt ? "Boards"            : es ? "Tableros"             : "Boards"         },
  ];

  const isAnalysisActive = ANALYSIS_NAV.some(i => isActive(i.url));
  const isToolsActive    = TOOLS_NAV.some(i => isActive(i.url));

  // ── Nav item — text only, no icon ──────────────────────────────────────────
  const navItem = (url: string, label: string, opts?: { badge?: string; soon?: boolean }) => {
    const active = isActive(url);
    return (
      <NavLink key={url} to={url} onClick={onClose}
        style={{
          display: "flex", alignItems: "center", padding: "7px 16px",
          borderRadius: 7, margin: "1px 8px",
          color: active ? "#fff" : opts?.soon ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          fontSize: 13.5, fontWeight: active ? 600 : 400,
          textDecoration: "none", transition: "all 0.1s", fontFamily: F,
          cursor: opts?.soon ? "default" : "pointer",
          pointerEvents: opts?.soon ? "none" : "auto",
        }}
        onMouseEnter={e => { if (!active && !opts?.soon) { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.05)"; el.style.color = "rgba(255,255,255,0.85)"; }}}
        onMouseLeave={e => { if (!active && !opts?.soon) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "rgba(255,255,255,0.55)"; }}}
      >
        <span style={{ flex: 1 }}>{label}</span>
        {opts?.badge && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>
            {opts.badge}
          </span>
        )}
        {opts?.soon && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", fontFamily: F }}>{pt ? "Em breve" : es ? "Próximo" : "Soon"}</span>
        )}
        {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, marginLeft: 6 }} />}
      </NavLink>
    );
  };

  // ── Section label ───────────────────────────────────────────────────────────
  const sectionLabel = (label: string) => (
    <p style={{ fontFamily: F, fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.22)", letterSpacing: "0.09em", textTransform: "uppercase", padding: "14px 16px 4px", margin: 0 }}>
      {label}
    </p>
  );

  // ── Collapsible section ─────────────────────────────────────────────────────
  const collapsibleSection = (
    label: string,
    items: { url: string; label: string }[],
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    hasActiveChild: boolean
  ) => (
    <div>
      <button onClick={() => setOpen(!isOpen)}
        style={{
          width: "100%", display: "flex", alignItems: "center", padding: "7px 16px",
          borderRadius: 7, margin: "1px 8px", boxSizing: "border-box",
          background: hasActiveChild && !isOpen ? "rgba(255,255,255,0.06)" : "transparent",
          border: "none", cursor: "pointer", fontFamily: F, transition: "all 0.1s",
          width: "calc(100% - 16px)",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = hasActiveChild && !isOpen ? "rgba(255,255,255,0.06)" : "transparent"; }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: hasActiveChild ? 600 : 400, color: hasActiveChild ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)", textAlign: "left" }}>{label}</span>
        <ChevronDown size={12} color="rgba(255,255,255,0.25)" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div style={{ paddingLeft: 8 }}>
          {items.map(({ url, label }) => navItem(url, label))}
        </div>
      )}
    </div>
  );

  // ── Accounts item ───────────────────────────────────────────────────────────
  const accountsItem = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", margin: "1px 8px" }}>
        <NavLink to="/dashboard/accounts" onClick={onClose}
          style={{
            flex: 1, display: "flex", alignItems: "center", padding: "7px 16px 7px 16px",
            borderRadius: savedPersonas.length > 0 ? "7px 0 0 7px" : 7,
            color: isAccountsActive ? "#fff" : "rgba(255,255,255,0.55)",
            background: isAccountsActive ? "rgba(255,255,255,0.08)" : "transparent",
            fontSize: 13.5, fontWeight: isAccountsActive ? 600 : 400,
            textDecoration: "none", transition: "all 0.1s", fontFamily: F,
          }}
          onMouseEnter={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.05)"; el.style.color = "rgba(255,255,255,0.85)"; }}}
          onMouseLeave={e => { if (!isAccountsActive) { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "rgba(255,255,255,0.55)"; }}}>
          <span style={{ flex: 1 }}>{pt ? "Contas" : es ? "Cuentas" : "Accounts"}</span>
          {selectedPersona && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(14,165,233,0.8)", background: "rgba(14,165,233,0.1)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.03em" }}>
              {(selectedPersona.name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          )}
        </NavLink>
        {savedPersonas.length > 0 && (
          <button onClick={() => setAccountsExpanded(e => !e)}
            style={{ width: 26, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRadius: "0 7px 7px 0", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <ChevronDown size={11} color="rgba(255,255,255,0.25)" style={{ transform: accountsExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        )}
      </div>

      {accountsExpanded && savedPersonas.length > 0 && (
        <div style={{ marginLeft: 16, marginRight: 8, background: "rgba(255,255,255,0.02)", borderRadius: "0 0 8px 8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)", borderTop: "none" }}>
          {savedPersonas.map(p => {
            const isSel = p.id === selectedPersona?.id;
            return (
              <button key={p.id}
                onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsExpanded(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: isSel ? "rgba(14,165,233,0.06)" : "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", fontFamily: F }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {p.logo_url
                    ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? "#38bdf8" : "rgba(255,255,255,0.4)" }}>{(p.name || "?").charAt(0).toUpperCase()}</span>
                  }
                </div>
                <span style={{ flex: 1, fontSize: 12, fontWeight: isSel ? 500 : 400, color: isSel ? "#fff" : "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{p.name || "Conta"}</span>
                {isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />}
              </button>
            );
          })}
          <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsExpanded(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "transparent", border: "none", cursor: "pointer", fontFamily: F }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Plus size={10} color="rgba(255,255,255,0.2)" />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{pt ? "Nova conta" : es ? "Nueva cuenta" : "New account"}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 216, background: "#0a0e19", borderRight: "1px solid rgba(255,255,255,0.06)", fontFamily: F, display: "flex", flexDirection: "column", flexShrink: 0 }}
      >
        {/* Logo */}
        <div style={{ height: 52, minHeight: 52, padding: "0 18px", flexShrink: 0, display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 10, paddingBottom: 8, overflowY: "auto", overflowX: "hidden" }}>

          {/* Create campaign — subtle highlight */}
          <div style={{ margin: "0 8px 2px" }}>
            <NavLink to="/dashboard/campaigns/new" onClick={onClose}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 16px", borderRadius: 7,
                background: isActive("/dashboard/campaigns/new") ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.07)",
                border: "1px solid rgba(14,165,233,0.18)",
                fontSize: 13.5, fontWeight: 600, color: "#7dd3fc",
                textDecoration: "none", transition: "all 0.1s", fontFamily: F,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive("/dashboard/campaigns/new") ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.07)"; }}>
              {pt ? "Criar Campanha" : es ? "Crear Campaña" : "Create Campaign"}
              <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", background: "rgba(14,165,233,0.15)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.05em" }}>NOVO</span>
            </NavLink>
          </div>

          {/* Primary */}
          {navItem("/dashboard/ai", "IA Chat", { badge: "AI" })}

          {/* Accounts */}
          {accountsItem()}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "10px 16px 6px" }} />

          {/* Collapsible sections */}
          {collapsibleSection(
            pt ? "Análise" : es ? "Análisis" : "Analytics",
            ANALYSIS_NAV, analysisOpen, setAnalysisOpen, isAnalysisActive
          )}
          {collapsibleSection(
            pt ? "Ferramentas" : es ? "Herramientas" : "Tools",
            TOOLS_NAV, toolsOpen, setToolsOpen, isToolsActive
          )}

        </nav>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 10px 12px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>

          {/* Upgrade */}
          {plan === "free" && (
            <button onClick={() => { navigate("/pricing"); onClose(); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.12)", cursor: "pointer", fontFamily: F, width: "100%", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade plan"}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9" }}>→</span>
            </button>
          )}

          <LanguageSwitcher direction="up" />

          {/* Profile */}
          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: F, width: "100%", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{displayName}</p>
              <p style={{ fontSize: 11, color: isLifetime ? "#fbbf24" : pm.color, margin: 0, fontWeight: 500 }}>{isLifetime ? "∞ Lifetime" : pm.label}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
