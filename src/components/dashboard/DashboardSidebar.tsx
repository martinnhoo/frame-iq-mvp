// DashboardSidebar v7 — ferramentas no espaço vazio, hierarquia clara
import { MessageSquare, BarChart2, LayoutGrid, Building2, ChevronDown, Plus, Zap, ArrowUpRight, Sparkles, Clapperboard, FileText, ScanEye, ScanLine, Cpu } from "lucide-react";
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
  free:    { label: "Free",    color: "#6b7280" },
  maker:   { label: "Maker",  color: "#60a5fa" },
  pro:     { label: "Pro",    color: "#0ea5e9" },
  studio:  { label: "Studio", color: "#a78bfa" },
  creator: { label: "Maker",  color: "#60a5fa" },
  starter: { label: "Pro",    color: "#0ea5e9" },
  scale:   { label: "Studio", color: "#a78bfa" },
};

// ── Primary nav item — larger, more weight ─────────────────────────────────
function NavPrimary({ url, label, icon: Icon, isActive, onClose, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8, margin: "1px 8px",
        color: isActive ? "#f0f2f8" : hov ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.55)",
        background: isActive ? "rgba(14,165,233,0.11)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        fontSize: 13.5, fontWeight: isActive ? 600 : 400,
        textDecoration: "none", transition: "all 0.12s",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.01em", position: "relative",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && (
        <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)", width: 2, height: 18, borderRadius: "0 2px 2px 0", background: "#0ea5e9", boxShadow: "0 0 8px rgba(14,165,233,0.6)" }} />
      )}
      <Icon size={16} strokeWidth={isActive ? 2 : 1.6}
        style={{ color: isActive ? "#0ea5e9" : "inherit", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.12)", borderRadius: 4, padding: "2px 6px", border: "1px solid rgba(14,165,233,0.2)", fontFamily: "'DM Mono', monospace" }}>{badge}</span>
      )}
    </NavLink>
  );
}

// ── Secondary nav item — smaller, lighter ─────────────────────────────────
function NavSecondary({ url, label, icon: Icon, isActive, onClose }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 12px", borderRadius: 6, margin: "0 8px",
        color: isActive ? "#e0e4f0" : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.38)",
        background: isActive ? "rgba(255,255,255,0.06)" : hov ? "rgba(255,255,255,0.03)" : "transparent",
        fontSize: 12.5, fontWeight: isActive ? 500 : 400,
        textDecoration: "none", transition: "all 0.1s",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.005em",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: isActive ? 0.9 : 0.6 }} />
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
  const [spend, setSpend] = useState<number | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setSpend(null); return; }
    (supabase as any).from("daily_snapshots")
      .select("total_spend").eq("user_id", user.id).eq("persona_id", selectedPersona.id)
      .order("date", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => setSpend(data?.total_spend > 0 ? data.total_spend : null))
      .catch(() => setSpend(null));
  }, [user?.id, selectedPersona?.id]);

  const PRIMARY = [
    { url: "/dashboard/ai",          label: "IA Chat",        icon: MessageSquare, badge: "AI" },
    { url: "/dashboard/performance",  label: "Performance",    icon: BarChart2 },
    { url: "/dashboard/boards",       label: "Boards",         icon: LayoutGrid },
  ];

  const TOOLS = [
    { url: "/dashboard/hooks",       label: pt ? "Hooks" : "Hooks",            icon: Sparkles },
    { url: "/dashboard/script",      label: pt ? "Roteiro" : es ? "Guión" : "Script",     icon: Clapperboard },
    { url: "/dashboard/brief",       label: "Brief",                            icon: FileText },
    { url: "/dashboard/competitor",  label: pt ? "Concorrentes" : "Competitor", icon: ScanEye },
    { url: "/dashboard/preflight",   label: "Preflight",                        icon: ScanLine },
    { url: "/dashboard/intelligence",label: pt ? "Inteligência" : "Intelligence",icon: Cpu },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-in { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
        .sb-hover:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      <aside
        style={{
          width: 224, height: "100%", background: "#080b14",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex", flexDirection: "column", flexShrink: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          position: "relative",
        }}>

        {/* Logo */}
        <div style={{ height: 54, minHeight: 54, padding: "0 16px", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", opacity: 0.92, transition: "opacity 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Account card */}
        <div style={{ padding: "10px 8px 0", flexShrink: 0 }}>
          <div style={{
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            <button
              onClick={() => savedPersonas.length > 0 ? setAccountsOpen(o => !o) : navigate("/dashboard/accounts")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              className="sb-hover">
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0, overflow: "hidden",
                background: selectedPersona ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selectedPersona?.logo_url
                  ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : selectedPersona
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{(selectedPersona.name || "?").charAt(0).toUpperCase()}</span>
                    : <Building2 size={13} color="rgba(255,255,255,0.3)" />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Account name — clean, not caps */}
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: selectedPersona ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.01em" }}>
                  {selectedPersona?.name || (pt ? "Sem conta" : "No account")}
                </p>
                {/* Spend — subtle, not monospace */}
                {spend != null && (
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    R${spend.toFixed(0)} esta semana
                  </p>
                )}
              </div>
              {savedPersonas.length > 0 && (
                <ChevronDown size={12} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0, transform: accountsOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
              )}
            </button>

            {accountsOpen && savedPersonas.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", animation: "sb-in 0.14s ease" }}>
                {savedPersonas.map(p => {
                  const isSel = p.id === selectedPersona?.id;
                  return (
                    <button key={p.id}
                      onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: isSel ? "rgba(14,165,233,0.08)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                      className="sb-hover">
                      <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.logo_url ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 11, fontWeight: 700, color: isSel ? "#0ea5e9" : "rgba(255,255,255,0.35)" }}>{(p.name || "?").charAt(0).toUpperCase()}</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? "#f0f2f8" : "rgba(255,255,255,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      {isSel && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />}
                    </button>
                  );
                })}
                <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                  className="sb-hover">
                  <Plus size={12} color="rgba(14,165,233,0.55)" />
                  <span style={{ fontSize: 12, color: "rgba(14,165,233,0.7)" }}>{pt ? "Adicionar conta" : "Add account"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Primary nav */}
        <nav style={{ padding: "10px 0 0", flexShrink: 0 }}>
          {PRIMARY.map(item => (
            <NavPrimary key={item.url} url={item.url} label={item.label} icon={item.icon}
              isActive={isAt(item.url)} onClose={onClose} badge={(item as any).badge} />
          ))}
        </nav>

        {/* Divider + Tools section */}
        <div style={{ padding: "12px 8px 0", flexShrink: 0 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 10 }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 4px", marginBottom: 4 }}>
            {pt ? "Ferramentas" : es ? "Herramientas" : "Tools"}
          </p>
          {TOOLS.map(item => (
            <NavSecondary key={item.url} url={item.url} label={item.label} icon={item.icon}
              isActive={isAt(item.url)} onClose={onClose} />
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{ padding: "0 8px 14px", flexShrink: 0 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 8px" }} />

          {plan === "free" && !isLifetime && (
            <button onClick={() => setUpgradeOpen(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, marginBottom: 6, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.17)", cursor: "pointer", width: "100%", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.14)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.08)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={13} color="#0ea5e9" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f2f8" }}>
                  {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}
                </span>
              </div>
              <ArrowUpRight size={13} color="rgba(14,165,233,0.55)" />
            </button>
          )}

          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", width: "100%", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 12, fontWeight: 700, borderRadius: 7, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, lineHeight: 1.3 }}>{displayName}</p>
              <p style={{ fontSize: 11.5, color: isLifetime ? "#fbbf24" : pm.color, margin: 0, fontWeight: 500, lineHeight: 1.3 }}>{isLifetime ? "∞ Lifetime" : pm.label}</p>
            </div>
          </button>
        </div>
      </aside>

      <PlanUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan={plan}
        language={language}
      />
    </>
  );
}
