// DashboardSidebar v13 — Linear/Notion-inspired: neutral tones, always-visible icons, no color-on-color
import { MessageSquare, Building2, ChevronDown, Plus, ArrowUpRight, Command, Clock, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
import { CapacityPackModal } from "./CapacityPackModal";
import { ReferralPopup } from "./ReferralPopup";
import { CreditBar } from "./CreditBar";

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
  alertCount?: number;
}

// LIFETIME removed — all accounts use normal credit system
const PLANS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "rgba(255,255,255,0.30)" },
  maker:   { label: "Maker",  color: "rgba(255,255,255,0.40)" },
  pro:     { label: "Pro",    color: "rgba(255,255,255,0.45)" },
  studio:  { label: "Studio", color: "rgba(255,255,255,0.45)" },
  creator: { label: "Maker",  color: "rgba(255,255,255,0.40)" },
  starter: { label: "Pro",    color: "rgba(255,255,255,0.45)" },
  scale:   { label: "Studio", color: "rgba(255,255,255,0.45)" },
};

const F = "'Plus Jakarta Sans', sans-serif";
const A = "#0da2e7";

// Gradient palette for persona avatars — subtle, dark-first linear gradients
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
  "linear-gradient(135deg, #191924 0%, #2d1b4e 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #1b3a4b 100%)",
  "linear-gradient(135deg, #1c1c1c 0%, #2c1810 100%)",
  "linear-gradient(135deg, #141e20 0%, #0d2818 100%)",
  "linear-gradient(135deg, #1a1520 0%, #2a1a3a 100%)",
];
function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

// ── Nav item (primary links) — always show icon, like Linear ─────────────────
function NavItem({ url, label, icon: Icon, isActive, onClose, badge, alertCount }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string; alertCount?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 12px", margin: "1px 0", borderRadius: 7,
        marginLeft: 8, marginRight: 8,
        color: isActive ? "#fff" : hov ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.65)",
        background: isActive
          ? "rgba(255,255,255,0.10)"
          : hov ? "rgba(255,255,255,0.04)" : "transparent",
        border: "none",
        fontSize: 13.5, fontWeight: isActive ? 600 : 450,
        textDecoration: "none", transition: "all 0.15s",
        fontFamily: F, letterSpacing: "-0.01em",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={16} strokeWidth={1.5} style={{
        color: isActive ? "#0da2e7" : "rgba(255,255,255,0.45)",
        flexShrink: 0, transition: "color 0.15s",
      }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.50)",
          letterSpacing: "0.04em", fontFamily: F,
        }}>{badge}</span>
      )}
      {(alertCount ?? 0) > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
          background: "#ef4444", color: "#fff",
          fontSize: 10, fontWeight: 700, fontFamily: F,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "alertPulse 2s ease-in-out infinite",
          boxShadow: "0 0 8px rgba(239,68,68,0.4)",
        }}>{alertCount}</span>
      )}
    </NavLink>
  );
}


export function DashboardSidebar({
  user, profile, open, onClose, onOpenProfile,
  savedPersonas = [], selectedPersona, onSelectPersona,
  alertCount = 0,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [kpi, setKpi] = useState<{ spend: number; ctr: number; ads: number; trend: "up" | "down" | "flat" | null } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);

  // Listen for capacity modal open events (from UsageBar click)
  useEffect(() => {
    const handler = () => setCapacityOpen(true);
    window.addEventListener("adbrief:open-capacity-modal", handler);
    return () => window.removeEventListener("adbrief:open-capacity-modal", handler);
  }, []);

  const plan = profile?.plan || "free";
  // lifetime removed
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  // Load KPI for selected persona
  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setKpi(null); return; }
    type ConnRow = { persona_id: string; status: string };
    type SnapRow = { total_spend: number | null; avg_ctr: number | null; active_ads: number | null };
    supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: user.id }
    }).then((res) => {
      const data = res.data as { connections?: ConnRow[] } | null;
      const all = data?.connections || [];
      const connected = all.some((c) => c.persona_id === selectedPersona.id && c.status === "active");
      if (!connected) { setKpi(null); return; }
      setKpi({ spend: 0, ctr: 0, ads: 0, trend: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("daily_snapshots")
        .select("total_spend, avg_ctr, active_ads")
        .eq("user_id", user.id).eq("persona_id", selectedPersona.id)
        .order("date", { ascending: false }).limit(2)
        .then((res2: { data: SnapRow[] | null }) => {
          const rows = res2.data || [];
          const latest = rows[0], prev = rows[1];
          if (!latest || (latest.total_spend === 0 && latest.avg_ctr === 0)) return;
          // Normalize CTR: old data stored as percentage (>1), new data as decimal
          const rawCtr = latest.avg_ctr || 0;
          const ctr = (rawCtr > 1 ? rawCtr : rawCtr * 100);
          const rawPrevCtr = prev ? (prev.avg_ctr || 0) : null;
          const prevCtr = rawPrevCtr !== null ? (rawPrevCtr > 1 ? rawPrevCtr : rawPrevCtr * 100) : null;
          const trend = prevCtr !== null && prevCtr > 0
            ? ctr > prevCtr * 1.05 ? "up" : ctr < prevCtr * 0.95 ? "down" : "flat"
            : null;
          setKpi({ spend: latest.total_spend || 0, ctr, ads: latest.active_ads || 0, trend });
        });
    }).catch(() => setKpi(null));
  }, [user?.id, selectedPersona?.id]);

  // Reload KPI when Meta ad account changes
  useEffect(() => {
    const handler = () => {
      if (!user?.id || !selectedPersona?.id) return;
      type SnapRow2 = { total_spend: number | null; avg_ctr: number | null; active_ads: number | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("daily_snapshots")
        .select("total_spend, avg_ctr, active_ads")
        .eq("user_id", user.id).eq("persona_id", selectedPersona.id)
        .order("date", { ascending: false }).limit(2)
        .then((res: { data: SnapRow2[] | null }) => {
          const rows = res.data || [];
          const latest = rows[0];
          if (!latest || (latest.total_spend === 0 && latest.avg_ctr === 0)) return;
          const rawCtr = latest.avg_ctr || 0;
          const ctr = (rawCtr > 1 ? rawCtr : rawCtr * 100);
          setKpi({ spend: latest.total_spend || 0, ctr, ads: latest.active_ads || 0, trend: null });
        });
    };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, [user?.id, selectedPersona?.id]);

  // perfActive removed — Performance page accessible via Feed/Chat but not in sidebar

  // ── Navigation structure — simplified: result-focused, no fluff ──
  // All creative/analysis tools now live inside the AI Chat as invokable skills.
  const NAV_ITEMS = [
    { url: "/dashboard/feed",     label: "Comando",                                   icon: Command },
    { url: "/dashboard/ai",      label: pt ? "Estrategista" : es ? "Estratega" : "Strategist",    icon: MessageSquare },
    { url: "/dashboard/history",  label: pt ? "Histórico" : es ? "Historial" : "History", icon: Clock },
    { url: "/dashboard/accounts", label: pt ? "Contas" : es ? "Cuentas" : "Accounts", icon: Building2 },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-in { from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)} }
        @keyframes alertPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.08)} }
      `}</style>

      <aside data-sidebar-build="v13-4-items" style={{
        width: 216, height: "100%",
        // Unified with AppLayout + --bg-main so the sidebar matches
        // the main content area — zero visible seam between them.
        background: "var(--bg-main)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", flexShrink: 0,
        fontFamily: F, overflow: "hidden",
      }}>

        {/* Logo + close button on mobile */}
        <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", flexShrink: 0, justifyContent: "space-between" }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Logo size="md" />
          </button>
          {/* Mobile close button */}
          <button onClick={onClose}
            className="sidebar-close-btn"
            style={{
              display: "none", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: 6, cursor: "pointer", flexShrink: 0,
            }}>
            <X size={16} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        {/* Account selector */}
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => savedPersonas.length > 0 ? setAccountsOpen(o => !o) : navigate("/dashboard/accounts")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "8px 14px", background: "transparent", border: "none",
              cursor: "pointer", textAlign: "left", transition: "background 0.12s",
              borderRadius: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: "hidden",
              background: selectedPersona
                ? (selectedPersona.logo_url ? "rgba(255,255,255,0.08)" : avatarGradient(selectedPersona.name || "?"))
                : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selectedPersona?.logo_url
                ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : selectedPersona
                  ? <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: F }}>
                        {(selectedPersona.name || "?").charAt(0).toUpperCase()}
                      </span>
                  : <Building2 size={13} color="rgba(255,255,255,0.25)" />
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13.5, fontWeight: 600,
                color: selectedPersona ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.30)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                lineHeight: 1.3, fontFamily: F, letterSpacing: "-0.01em",
              }}>
                {selectedPersona?.name || (pt ? "Selecionar conta" : "Select account")}
              </p>

              {kpi != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: "#22A3A3",
                    boxShadow: "0 0 4px rgba(16,185,129,0.6)",
                  }} />
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontFamily: F, fontWeight: 500 }}>
                    {pt ? "Conectado" : "Connected"}
                  </span>
                  {kpi.ctr > 0 && (
                    <>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)" }}>·</span>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                        {kpi.ctr.toFixed(1)}%
                        {kpi.trend === "up" && <span style={{ color: "#22A3A3", marginLeft: 2 }}>↑</span>}
                        {kpi.trend === "down" && <span style={{ color: "#ef4444", marginLeft: 2 }}>↓</span>}
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

          {/* Account dropdown */}
          {accountsOpen && savedPersonas.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", animation: "sb-in 0.12s ease", paddingTop: 2 }}>
              {savedPersonas.map(p => {
                const isSel = p.id === selectedPersona?.id;
                return (
                  <button key={p.id}
                    onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 14px",
                      background: isSel ? "rgba(255,255,255,0.04)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? "rgba(255,255,255,0.04)" : "transparent"; }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, overflow: "hidden",
                      background: p.logo_url ? "rgba(255,255,255,0.06)" : avatarGradient(p.name || "?"),
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {p.logo_url
                        ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                            {(p.name || "?").charAt(0).toUpperCase()}
                          </span>
                      }
                    </div>
                    <span style={{
                      flex: 1, fontSize: 12.5, fontWeight: isSel ? 500 : 400,
                      color: isSel ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.50)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F,
                    }}>{p.name}</span>
                    {isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.50)", flexShrink: 0 }} />}
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
                <Plus size={11} color="rgba(255,255,255,0.35)" />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontFamily: F }}>
                  {pt ? "Nova conta" : "New account"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable nav area — clean, focused */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 8, paddingTop: 4 }}>
          <nav>
            {NAV_ITEMS.map(item => (
              <NavItem key={item.url} url={item.url} label={item.label} icon={item.icon}
                isActive={isAt(item.url)}
                onClose={onClose}
                alertCount={item.url === "/dashboard/feed" || item.url === "/dashboard/ai" ? alertCount : undefined} />
            ))}
          </nav>
        </div>

        {/* ── Footer ── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 0 4px" }} />

          {/* Upgrade CTA */}
          {plan === "free" && (
            <button onClick={() => setUpgradeOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                marginLeft: 6, marginRight: 6, borderRadius: 8,
                background: "transparent", border: "none", cursor: "pointer", width: "calc(100% - 12px)",
                transition: "background 0.12s", marginBottom: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.65)", fontFamily: F }}>
                {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}
              </span>
              <ArrowUpRight size={12} color="rgba(255,255,255,0.45)" style={{ marginLeft: "auto" }} />
            </button>
          )}

          {/* Credit usage bar */}
          <CreditBar userId={user?.id} plan={plan} />

          {/* Referral */}
          <ReferralPopup userId={user?.id} />

          {/* User profile */}
          <button onClick={() => onOpenProfile?.()}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "8px 14px 12px",
              background: "transparent", border: "none", cursor: "pointer", width: "100%",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{
                fontSize: 11, fontWeight: 700, borderRadius: 7,
                background: avatarGradient(displayName), color: "rgba(255,255,255,0.5)",
                border: "none",
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
                color: pm.color,
              }}>
                {pm.label}
              </p>
            </div>
          </button>
        </div>
      </aside>

      <PlanUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={plan} language={language} />
      <CapacityPackModal
        open={capacityOpen}
        onClose={() => setCapacityOpen(false)}
        plan={plan}
        onUpgrade={() => { setCapacityOpen(false); setUpgradeOpen(true); }}
        onSuccess={() => {
          setCapacityOpen(false);
          window.dispatchEvent(new CustomEvent("adbrief:credits-updated"));
        }}
      />
    </>
  );
}
