// DashboardSidebar v11 — Organized sections: Principal, Criar, Análise, Workspace
import { MessageSquare, BarChart2, LayoutGrid, Building2, ChevronDown, Plus, Zap, ArrowUpRight, Sparkles, FileText, ScanLine, Brain, ScanEye, Languages } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
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
const A = "#0da2e7";

const SB_AVATAR_PALETTE = [
  { bg:"rgba(13,162,231,0.12)",  border:"rgba(13,162,231,0.22)",  text:"#5cc8f0"  },
  { bg:"rgba(167,139,250,0.12)", border:"rgba(167,139,250,0.22)", text:"#c4b5fd"  },
  { bg:"rgba(16,185,129,0.10)",  border:"rgba(16,185,129,0.20)",  text:"#6ee7b7"  },
  { bg:"rgba(251,146,60,0.10)",  border:"rgba(251,146,60,0.20)",  text:"#fcd34d"  },
  { bg:"rgba(248,113,113,0.10)", border:"rgba(248,113,113,0.20)", text:"#fca5a5"  },
  { bg:"rgba(6,182,212,0.10)",   border:"rgba(6,182,212,0.20)",   text:"#67e8f9"  },
  { bg:"rgba(244,114,182,0.10)", border:"rgba(244,114,182,0.20)", text:"#f9a8d4"  },
];
function sbAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return SB_AVATAR_PALETTE[Math.abs(h) % SB_AVATAR_PALETTE.length];
}

// ── Nav item (primary links) — icon only when active ─────────────────────────
function NavItem({ url, label, icon: Icon, isActive, onClose, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", margin: "1px 0", borderRadius: 8,
        marginLeft: 6, marginRight: 6,
        color: isActive ? "#fff" : hov ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.50)",
        background: isActive
          ? `linear-gradient(135deg, ${A}20, ${A}10)`
          : hov ? "rgba(255,255,255,0.04)" : "transparent",
        border: isActive ? `1px solid ${A}25` : "1px solid transparent",
        fontSize: 13.5, fontWeight: isActive ? 600 : 400,
        textDecoration: "none", transition: "all 0.15s",
        fontFamily: F, letterSpacing: "-0.01em",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && <Icon size={15} strokeWidth={1.6} style={{ color: A, flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: `${A}90`,
          background: `${A}12`, border: `1px solid ${A}20`, borderRadius: 4,
          padding: "1px 5px", letterSpacing: "0.06em", fontFamily: F,
        }}>{badge}</span>
      )}
    </NavLink>
  );
}

// ── Nav tool (secondary links) — icon only when active ───────────────────────
function NavTool({ url, label, icon: Icon, isActive, onClose }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 14px", marginLeft: 6, marginRight: 6,
        borderRadius: 6,
        color: isActive ? "rgba(255,255,255,0.90)" : hov ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.40)",
        background: isActive ? `${A}08` : hov ? "rgba(255,255,255,0.03)" : "transparent",
        fontSize: 13, fontWeight: isActive ? 500 : 400,
        textDecoration: "none", transition: "all 0.12s",
        fontFamily: F,
        paddingLeft: isActive ? 14 : 20,
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && <Icon size={14} strokeWidth={1.5} style={{ flexShrink: 0, color: `${A}80` }} />}
      <span>{label}</span>
    </NavLink>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: "14px 20px 5px",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: `${A}35`,
        letterSpacing: "0.12em", textTransform: "uppercase", margin: 0,
        fontFamily: "'DM Mono', monospace",
      }}>
        {label}
      </p>
      <div style={{ flex: 1, height: 1, background: `${A}08` }} />
    </div>
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

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  // Load KPI for selected persona
  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setKpi(null); return; }
    supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: user.id }
    }).then(({ data }: any) => {
      const all = (data?.connections || []) as any[];
      const connected = all.some((c: any) => c.persona_id === selectedPersona.id && c.status === "active");
      if (!connected) { setKpi(null); return; }
      setKpi({ spend: 0, ctr: 0, ads: 0, trend: null });
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

  // ── Navigation structure (matching screenshot layout) ──
  const PRINCIPAL = [
    { url: "/dashboard/ai",          label: "Chat",        icon: MessageSquare, badge: "AI" },
    { url: "/dashboard/performance",  label: "Performance", icon: BarChart2, forceActive: perfActive },
    { url: "/dashboard/ad-score",      label: "Ad Score", icon: LayoutGrid },
  ];

  const CRIAR = [
    { url: "/dashboard/hooks",     label: pt ? "Gerar Hooks" : "Generate Hooks", icon: Sparkles },
    { url: "/dashboard/brief",     label: pt ? "Criar Brief" : "Create Brief",   icon: FileText },
    { url: "/dashboard/preflight", label: pt ? "Revisar Criativo" : "Review Creative", icon: ScanLine },
  ];

  const ANALISE = [
    { url: "/dashboard/intelligence", label: "Insights",                                     icon: Brain },
    { url: "/dashboard/competitor",   label: pt ? "Concorrentes" : es ? "Competidores" : "Competitors", icon: ScanEye },
  ];

  const WORKSPACE = [
    { url: "/dashboard/boards",    label: "Boards",                                          icon: LayoutGrid },
    { url: "/dashboard/templates", label: "Templates",                                       icon: FileText },
    { url: "/dashboard/translate", label: pt ? "Traduzir" : es ? "Traducir" : "Translate",  icon: Languages },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-in { from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      <aside style={{
        width: 216, height: "100%",
        background: "var(--bg-main)",
        borderRight: `1px solid ${A}10`,
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${A}06`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: "hidden",
              background: selectedPersona ? sbAvatarColor(selectedPersona.name || "?").bg : `${A}08`,
              border: `1px solid ${selectedPersona ? sbAvatarColor(selectedPersona.name || "?").border : `${A}15`}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selectedPersona?.logo_url
                ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : selectedPersona
                  ? (() => { const av = sbAvatarColor(selectedPersona.name || "?"); return (
                      <span style={{ fontSize: 13, fontWeight: 700, color: av.text, fontFamily: F }}>
                        {(selectedPersona.name || "?").charAt(0).toUpperCase()}
                      </span>
                    ); })()
                  : <Building2 size={13} color={`${A}40`} />
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
                    background: "#10b981",
                    boxShadow: "0 0 4px rgba(16,185,129,0.6)",
                  }} />
                  <span style={{ fontSize: 10.5, color: `${A}70`, fontFamily: F, fontWeight: 500 }}>
                    {pt ? "Conectado" : "Connected"}
                  </span>
                  {kpi.ctr > 0 && (
                    <>
                      <span style={{ fontSize: 9, color: `${A}20` }}>·</span>
                      <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                        {kpi.ctr.toFixed(1)}%
                        {kpi.trend === "up" && <span style={{ color: "#10b981", marginLeft: 2 }}>↑</span>}
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
              <ChevronDown size={12} color={`${A}30`}
                style={{ flexShrink: 0, transform: accountsOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
            )}
          </button>

          {/* Account dropdown */}
          {accountsOpen && savedPersonas.length > 0 && (
            <div style={{ borderTop: `1px solid ${A}08`, animation: "sb-in 0.12s ease", paddingTop: 2 }}>
              {savedPersonas.map(p => {
                const isSel = p.id === selectedPersona?.id;
                return (
                  <button key={p.id}
                    onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 14px",
                      background: isSel ? `${A}08` : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? `${A}08` : "transparent"; }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, overflow: "hidden",
                      background: `${A}06`, border: `1px solid ${A}12`,
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
                      color: isSel ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.50)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F,
                    }}>{p.name}</span>
                    {isSel && <div style={{ width: 4, height: 4, borderRadius: "50%", background: A, flexShrink: 0 }} />}
                  </button>
                );
              })}
              <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", background: "transparent", border: "none",
                  borderTop: `1px solid ${A}06`, cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <Plus size={11} color={`${A}50`} />
                <span style={{ fontSize: 12, color: `${A}60`, fontFamily: F }}>
                  {pt ? "Nova conta" : "New account"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable nav area */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 8 }}>

          {/* ── PRINCIPAL ── */}
          <SectionHeader label="Principal" />
          <nav>
            {PRINCIPAL.map(item => (
              <NavItem key={item.url} url={item.url} label={item.label} icon={item.icon}
                isActive={(item as any).forceActive ?? isAt(item.url)}
                onClose={onClose} badge={(item as any).badge} />
            ))}
          </nav>

          {/* ── CRIAR ── */}
          <SectionHeader label={pt ? "Criar" : es ? "Crear" : "Create"} />
          <nav>
            {CRIAR.map(item => (
              <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
                isActive={isAt(item.url)} onClose={onClose} />
            ))}
          </nav>

          {/* ── ANÁLISE ── */}
          <SectionHeader label={pt ? "Análise" : es ? "Análisis" : "Analysis"} />
          <nav>
            {ANALISE.map(item => (
              <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
                isActive={isAt(item.url)} onClose={onClose} />
            ))}
          </nav>

          {/* ── WORKSPACE ── */}
          <SectionHeader label="Workspace" />
          <nav>
            {WORKSPACE.map(item => (
              <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
                isActive={isAt(item.url)} onClose={onClose} />
            ))}
          </nav>
        </div>

        {/* ── Footer ── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: `${A}08`, margin: "0 0 4px" }} />

          {/* Upgrade CTA */}
          {plan === "free" && !isLifetime && (
            <button onClick={() => setUpgradeOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                marginLeft: 6, marginRight: 6, borderRadius: 8,
                background: `${A}06`, border: `1px solid ${A}12`, cursor: "pointer", width: "calc(100% - 12px)",
                transition: "all 0.15s", marginBottom: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${A}12`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${A}06`; }}>
              <Zap size={14} strokeWidth={1.6} color={`${A}70`} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: `${A}80`, fontFamily: F }}>
                {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}
              </span>
              <ArrowUpRight size={12} color={`${A}40`} style={{ marginLeft: "auto" }} />
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${A}06`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{
                fontSize: 11, fontWeight: 700, borderRadius: 7,
                background: `${A}10`, color: `${A}60`,
                border: `1px solid ${A}15`,
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
