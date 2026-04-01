// DashboardSidebar v5 — redesign completo: conta sempre visível, ícones, KPI inline
import { MessageSquare, BarChart2, LayoutGrid, Building2, ChevronDown, Plus, Zap, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useState, useEffect } from "react";
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

function NavItem({ url, label, icon: Icon, isActive, onClose, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 8, margin: "1px 8px",
        color: isActive ? "#f0f2f8" : hov ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.58)",
        background: isActive ? "rgba(14,165,233,0.11)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        textDecoration: "none", transition: "all 0.12s",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.01em", position: "relative",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {isActive && (
        <div style={{
          position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
          width: 2, height: 16, borderRadius: "0 2px 2px 0",
          background: "#0ea5e9", boxShadow: "0 0 6px rgba(14,165,233,0.5)",
        }} />
      )}
      <Icon size={15} strokeWidth={isActive ? 2 : 1.6}
        style={{ color: isActive ? "#0ea5e9" : "inherit", flexShrink: 0, opacity: isActive ? 1 : 0.85 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#0ea5e9",
          background: "rgba(14,165,233,0.1)", borderRadius: 4,
          padding: "1px 6px", border: "1px solid rgba(14,165,233,0.2)",
          fontFamily: "'DM Mono', monospace",
        }}>{badge}</span>
      )}
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
  const [kpi, setKpi] = useState<{ spend: number; ctr: number } | null>(null);

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setKpi(null); return; }
    (supabase as any).from("daily_snapshots")
      .select("total_spend, avg_ctr")
      .eq("user_id", user.id)
      .eq("persona_id", selectedPersona.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && (data.total_spend > 0 || data.avg_ctr > 0)) {
          setKpi({ spend: data.total_spend || 0, ctr: (data.avg_ctr || 0) * 100 });
        } else {
          setKpi(null);
        }
      })
      .catch(() => setKpi(null));
  }, [user?.id, selectedPersona?.id]);

  const NAV = [
    { url: "/dashboard/ai",         label: "IA Chat",      icon: MessageSquare, badge: "AI" },
    { url: "/dashboard/performance", label: "Performance",  icon: BarChart2 },
    { url: "/dashboard/boards",      label: pt ? "Boards" : es ? "Tableros" : "Boards", icon: LayoutGrid },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-slide { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
        .sb-row { transition: background 0.1s !important; }
        .sb-row:hover { background: rgba(255,255,255,0.04) !important; }
        .sidebar-transition { transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
      )}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col sidebar-transition ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          width: 224, background: "#080b14",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex", flexDirection: "column", flexShrink: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>

        {/* Logo */}
        <div style={{ height: 54, minHeight: 54, padding: "0 16px", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", opacity: 0.92, transition: "opacity 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Active account card */}
        <div style={{ padding: "12px 10px 0" }}>
          <div style={{
            borderRadius: 10,
            background: selectedPersona ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.03)",
            border: selectedPersona ? "1px solid rgba(14,165,233,0.12)" : "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>
            <button
              onClick={() => savedPersonas.length > 0 ? setAccountsOpen(o => !o) : navigate("/dashboard/accounts")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              className="sb-row">
              {/* Avatar */}
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: "hidden",
                background: selectedPersona ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selectedPersona?.logo_url
                  ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : selectedPersona
                    ? <span style={{ fontSize: 14, fontWeight: 700, color: "#0ea5e9" }}>{selectedPersona.name.charAt(0).toUpperCase()}</span>
                    : <Building2 size={14} color="rgba(255,255,255,0.25)" />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: selectedPersona ? "#f0f2f8" : "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35 }}>
                  {selectedPersona?.name || (pt ? "Nenhuma conta" : es ? "Sin cuenta" : "No account")}
                </p>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.3, fontFamily: kpi ? "'DM Mono', monospace" : "inherit", color: kpi ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)" }}>
                  {kpi
                    ? `R$${kpi.spend.toFixed(0)} · ${kpi.ctr.toFixed(2)}% CTR`
                    : pt ? "Selecionar conta" : es ? "Seleccionar" : "Select account"
                  }
                </p>
              </div>

              {savedPersonas.length > 0 && (
                <ChevronDown size={13} color="rgba(255,255,255,0.38)" style={{ flexShrink: 0, transform: accountsOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
              )}
            </button>

            {/* Dropdown */}
            {accountsOpen && savedPersonas.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", animation: "sb-slide 0.14s ease" }}>
                {savedPersonas.map(p => {
                  const isSel = p.id === selectedPersona?.id;
                  return (
                    <button key={p.id}
                      onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: isSel ? "rgba(14,165,233,0.08)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                      className="sb-row">
                      <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.logo_url
                          ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 12, fontWeight: 600, color: isSel ? "#0ea5e9" : "rgba(255,255,255,0.35)" }}>{p.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? "#f0f2f8" : "rgba(255,255,255,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </span>
                      {isSel && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 4px rgba(34,197,94,0.5)" }} />}
                    </button>
                  );
                })}
                <button
                  onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                  className="sb-row">
                  <Plus size={12} color="rgba(14,165,233,0.5)" />
                  <span style={{ fontSize: 12, color: "rgba(14,165,233,0.75)", fontWeight: 400 }}>
                    {pt ? "Adicionar conta" : es ? "Agregar cuenta" : "Add account"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 12px 10px" }} />
          {NAV.map(item => (
            <NavItem
              key={item.url}
              url={item.url}
              label={item.label}
              icon={item.icon}
              isActive={isAt(item.url)}
              onClose={onClose}
              badge={(item as any).badge}
            />
          ))}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Upgrade */}
          {plan === "free" && !isLifetime && (
            <button onClick={() => { navigate("/pricing"); onClose(); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", borderRadius: 8,
                background: "linear-gradient(135deg, rgba(14,165,233,0.14), rgba(99,102,241,0.10))",
                border: "1px solid rgba(14,165,233,0.18)",
                cursor: "pointer", width: "100%", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.32)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.18)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Zap size={13} color="#0ea5e9" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f2f8" }}>{pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}</span>
              </div>
              <ArrowUpRight size={13} color="rgba(14,165,233,0.55)" />
            </button>
          )}

          <LanguageSwitcher direction="up" />

          {/* Profile */}
          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", width: "100%", transition: "background 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 13, fontWeight: 700, borderRadius: 8, background: "rgba(14,165,233,0.12)", color: "#0ea5e9" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, lineHeight: 1.3 }}>{displayName}</p>
              <p style={{ fontSize: 12, color: isLifetime ? "#fbbf24" : pm.color, margin: 0, fontWeight: 500, lineHeight: 1.3 }}>{isLifetime ? "∞ Lifetime" : pm.label}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
