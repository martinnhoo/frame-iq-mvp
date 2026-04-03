// DashboardSidebar v8 — design Login, contraste elevado, Diário dentro de Performance
import { MessageSquare, BarChart2, LayoutGrid, Building2, ChevronDown, Plus, Zap, ArrowUpRight, Sparkles, Clapperboard, FileText, ScanEye, ScanLine, Brain } from "lucide-react";
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

const F = "'Plus Jakarta Sans', sans-serif";
const BLUE = "#0ea5e9";


const SB_AVATAR_PALETTE = [
  { bg:"rgba(14,165,233,0.18)",  border:"rgba(14,165,233,0.32)",  text:"#38bdf8"  },
  { bg:"rgba(167,139,250,0.18)", border:"rgba(167,139,250,0.32)", text:"#c4b5fd"  },
  { bg:"rgba(52,211,153,0.15)",  border:"rgba(52,211,153,0.28)",  text:"#6ee7b7"  },
  { bg:"rgba(251,146,60,0.15)",  border:"rgba(251,146,60,0.28)",  text:"#fcd34d"  },
  { bg:"rgba(248,113,113,0.15)", border:"rgba(248,113,113,0.28)", text:"#fca5a5"  },
  { bg:"rgba(6,182,212,0.15)",   border:"rgba(6,182,212,0.28)",   text:"#67e8f9"  },
  { bg:"rgba(244,114,182,0.15)", border:"rgba(244,114,182,0.28)", text:"#f9a8d4"  },
];
function sbAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return SB_AVATAR_PALETTE[Math.abs(h) % SB_AVATAR_PALETTE.length];
}
// ── Primary nav item ───────────────────────────────────────────────────────────
function NavPrimary({ url, label, icon: Icon, isActive, onClose, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 9, margin: "1px 8px",
        color: isActive ? "#ffffff" : hov ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.65)",
        background: isActive
          ? "linear-gradient(135deg,rgba(14,165,233,0.20) 0%,rgba(6,182,212,0.12) 100%)"
          : hov ? "rgba(255,255,255,0.06)" : "transparent",
        border: isActive ? "1px solid rgba(14,165,233,0.28)" : "1px solid transparent",
        fontSize: 13.5, fontWeight: isActive ? 700 : 500,
        textDecoration: "none", transition: "all 0.15s",
        fontFamily: F, letterSpacing: "-0.01em", position: "relative",
        boxShadow: isActive ? "0 2px 12px rgba(14,165,233,0.15)" : "none",
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {isActive && (
        <div style={{ position: "absolute", left: -1, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 20, borderRadius: "0 3px 3px 0",
          background: "linear-gradient(180deg,#0ea5e9,#06b6d4)",
          boxShadow: "0 0 10px rgba(14,165,233,0.9)" }} />
      )}
      <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8}
        style={{ color: isActive ? BLUE : "inherit", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 800, color: "#fff",
          background: "#0ea5e9",
          borderRadius: 5, padding: "2px 6px", letterSpacing: "0.04em",
          fontFamily: "'DM Mono', monospace", boxShadow: "0 2px 8px rgba(14,165,233,0.4)" }}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ── Tool nav item — elevated contrast vs before ────────────────────────────────
function NavTool({ url, label, icon: Icon, isActive, onClose }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; onClose: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClose}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 12px", borderRadius: 8, margin: "0 8px",
        color: isActive ? "#f0f2f8" : hov ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.55)",
        background: isActive
          ? "linear-gradient(135deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0.05) 100%)"
          : hov ? "rgba(255,255,255,0.05)" : "transparent",
        border: isActive ? "1px solid rgba(255,255,255,0.13)" : "1px solid transparent",
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        textDecoration: "none", transition: "all 0.12s", fontFamily: F,
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={14} strokeWidth={isActive ? 2 : 1.6}
        style={{ flexShrink: 0, opacity: isActive ? 1 : hov ? 0.85 : 0.7 }} />
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

  const plan = profile?.plan || "free";
  const isLifetime = LIFETIME.includes(user?.email || "");
  const pm = PLANS[plan] || PLANS.free;
  const initials = (profile?.name || profile?.email || "U").charAt(0).toUpperCase();
  const displayName = profile?.name || user?.email?.split("@")[0] || "Account";
  const pt = language === "pt", es = language === "es";
  const isAt = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/");

  useEffect(() => {
    if (!user?.id || !selectedPersona?.id) { setKpi(null); return; }
    // First check if any platform is actually connected for this account
    (supabase as any).from("platform_connections")
      .select("platform", { count: "exact", head: true })
      .eq("user_id", user.id).eq("persona_id", selectedPersona.id).eq("status", "active")
      .then(({ count }: any) => {
        if (!count || count === 0) { setKpi(null); return; }
        // Platform is connected — show connected state even without snapshots yet
        setKpi({ spend: 0, ctr: 0, ads: 0, trend: null });
        // Only fetch KPI if at least one platform is connected
        return (supabase as any).from("daily_snapshots")
          .select("total_spend, avg_ctr, active_ads, yesterday_ctr")
          .eq("user_id", user.id).eq("persona_id", selectedPersona.id)
          .order("date", { ascending: false }).limit(2)
          .then(({ data }: any) => {
            const rows = data || [];
            const latest = rows[0], prev = rows[1];
            if (!latest || (latest.total_spend === 0 && latest.avg_ctr === 0)) { setKpi(null); return; }
            const ctr = (latest.avg_ctr || 0) * 100;
            const prevCtr = prev ? (prev.avg_ctr || 0) * 100 : null;
            const trend = prevCtr !== null && prevCtr > 0
              ? ctr > prevCtr * 1.05 ? "up" : ctr < prevCtr * 0.95 ? "down" : "flat"
              : null;
            setKpi({ spend: latest.total_spend || 0, ctr, ads: latest.active_ads || 0, trend });
          });
      })
      .catch(() => setKpi(null));
  }, [user?.id, selectedPersona?.id]);

  // Performance is active for both /performance and /diary (since diary is now a tab inside)
  const perfActive = isAt("/dashboard/performance") || isAt("/dashboard/diary");

  const PRIMARY = [
    { url: "/dashboard/ai",          label: "IA Chat",     icon: MessageSquare, badge: "AI" },
    { url: "/dashboard/performance",  label: "Performance", icon: BarChart2, forceActive: perfActive },
  ];

  const TOOLS = [
    { url: "/dashboard/intelligence", label: pt ? "Inteligência" : es ? "Inteligencia" : "Intelligence", icon: Brain },
    { url: "/dashboard/boards",       label: "Boards",                                                    icon: LayoutGrid },
    { url: "/dashboard/hooks",        label: "Hooks",                                                     icon: Sparkles },
    { url: "/dashboard/script",       label: pt ? "Roteiro" : es ? "Guión" : "Script",                   icon: Clapperboard },
    { url: "/dashboard/brief",        label: "Brief",                                                     icon: FileText },
    { url: "/dashboard/competitor",   label: pt ? "Concorrentes" : es ? "Competidores" : "Competitors",  icon: ScanEye },
    { url: "/dashboard/preflight",    label: pt ? "Check Criativo" : es ? "Check Creativo" : "Creative Check", icon: ScanLine },
  ];

  return (
    <>
      <style>{`
        @keyframes sb-in { from { opacity:0;transform:translateY(-4px) } to { opacity:1;transform:translateY(0) } }
        .sb-item:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      <aside style={{
        width: 224, height: "100%",
        background: "linear-gradient(180deg,#0d1117 0%,#080b14 100%)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", flexShrink: 0,
        fontFamily: F, position: "relative",
      }}>

        {/* Subtle top glow */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120,
          background: "radial-gradient(ellipse 80% 60% at 50% -10%,rgba(14,165,233,0.08) 0%,transparent 70%)",
          pointerEvents: "none" }}/>

        {/* Logo */}
        <div style={{ height: 56, minHeight: 56, padding: "0 16px",
          display: "flex", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => { navigate("/dashboard"); onClose(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
              opacity: 0.95, transition: "opacity 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.95"; }}>
            <Logo size="md" />
          </button>
        </div>

        {/* Account card */}
        <div style={{ padding: "10px 8px 0", flexShrink: 0 }}>
          <div style={{
            borderRadius: 11,
            background: "linear-gradient(160deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.2)",
            overflow: "hidden",
          }}>
            <button
              onClick={() => savedPersonas.length > 0 ? setAccountsOpen(o => !o) : navigate("/dashboard/accounts")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "9px 11px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left" }}
              className="sb-item">

              {/* Avatar */}
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: "hidden",
                background: selectedPersona ? sbAvatarColor(selectedPersona.name||"?").bg : "rgba(255,255,255,0.07)",
                border: `1px solid ${selectedPersona ? sbAvatarColor(selectedPersona.name||"?").border : "rgba(255,255,255,0.10)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
              }}>
                {selectedPersona?.logo_url
                  ? <img src={selectedPersona.logo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  : selectedPersona
                    ? (() => { const av = sbAvatarColor(selectedPersona.name||"?"); return (
                        <span style={{ fontSize:13, fontWeight:800, color:av.text, fontFamily:F, letterSpacing:"-0.02em" }}>
                          {(selectedPersona.name||"?").charAt(0).toUpperCase()}
                        </span>
                      ); })()
                    : <Building2 size={13} color="rgba(255,255,255,0.35)" />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600,
                  color: selectedPersona ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.40)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  lineHeight: 1.3, fontFamily: F, letterSpacing: "-0.01em" }}>
                  {selectedPersona?.name || (pt ? "Sem conta" : "No account")}
                </p>
                {kpi != null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                    {kpi.ads === 0 && kpi.ctr === 0 ? (
                      <span style={{ fontSize: 11, color: "#22c55e", fontFamily: F }}>● {pt ? "Meta Ads conectado" : es ? "Meta Ads conectado" : "Meta Ads connected"}</span>
                    ) : (
                      <>
                        {kpi.ads > 0 && (
                          <span style={{ fontSize: 11, color: "#22c55e", fontFamily: F }}>
                            ● {kpi.ads} {pt ? "ativos" : "active"}
                          </span>
                        )}
                        {kpi.ads > 0 && kpi.ctr > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>·</span>
                        )}
                        {kpi.ctr > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: F }}>
                            {kpi.ctr.toFixed(2)}%
                            {kpi.trend === "up" && <span style={{ color: "#22c55e", marginLeft: 2 }}>↑</span>}
                            {kpi.trend === "down" && <span style={{ color: "#f87171", marginLeft: 2 }}>↓</span>}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ) : selectedPersona ? (
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: F }}>
                    {pt ? "conectar Meta Ads" : es ? "conectar Meta Ads" : "connect Meta Ads"}
                  </p>
                ) : null}
              </div>

              {savedPersonas.length > 0 && (
                <ChevronDown size={13} color="rgba(255,255,255,0.30)"
                  style={{ flexShrink: 0, transform: accountsOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
              )}
            </button>

            {/* Account dropdown */}
            {accountsOpen && savedPersonas.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", animation: "sb-in 0.14s ease" }}>
                {savedPersonas.map(p => {
                  const isSel = p.id === selectedPersona?.id;
                  return (
                    <button key={p.id}
                      onClick={() => { onSelectPersona?.(p); navigate("/dashboard/ai"); onClose(); setAccountsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 11px", background: isSel ? "rgba(14,165,233,0.08)" : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left" }}
                      className="sb-item">
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, overflow: "hidden",
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.logo_url
                          ? <img src={p.logo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          : (() => { const av = sbAvatarColor(p.name||"?"); return (
                              <span style={{ fontSize:11, fontWeight:700, color:av.text }}>
                                {(p.name||"?").charAt(0).toUpperCase()}
                              </span>
                            ); })()}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: isSel ? 600 : 400,
                        color: isSel ? "#f0f2f8" : "rgba(255,255,255,0.65)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      {isSel && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />}
                    </button>
                  );
                })}
                <button onClick={() => { navigate("/dashboard/accounts"); onClose(); setAccountsOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 11px", background: "transparent", border: "none",
                    borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                  className="sb-item">
                  <Plus size={12} color="rgba(14,165,233,0.60)" />
                  <span style={{ fontSize: 12, color: "rgba(14,165,233,0.75)", fontFamily: F }}>
                    {pt ? "Adicionar conta" : "Add account"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Primary nav */}
        <nav style={{ padding: "10px 0 4px", flexShrink: 0 }}>
          {PRIMARY.map(item => (
            <NavPrimary key={item.url} url={item.url} label={item.label} icon={item.icon}
              isActive={(item as any).forceActive ?? isAt(item.url)}
              onClose={onClose} badge={(item as any).badge} />
          ))}
        </nav>

        {/* Divider + Tools */}
        <div style={{ padding: "6px 16px 6px", flexShrink: 0 }}>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)" }} />
        </div>

        <div style={{ padding: "2px 0 0", flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.10em", textTransform: "uppercase",
            padding: "0 20px", margin: "0 0 4px", fontFamily: F }}>
            {pt ? "Ferramentas" : es ? "Herramientas" : "Tools"}
          </p>
          {TOOLS.map(item => (
            <NavTool key={item.url} url={item.url} label={item.label} icon={item.icon}
              isActive={isAt(item.url)} onClose={onClose} />
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{ padding: "0 8px 14px", flexShrink: 0 }}>
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", margin: "0 8px 8px" }} />

          {plan === "free" && !isLifetime && (
            <button onClick={() => setUpgradeOpen(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", borderRadius: 9, marginBottom: 6,
                background: "linear-gradient(135deg,rgba(14,165,233,0.12) 0%,rgba(6,182,212,0.06) 100%)",
                border: "1px solid rgba(14,165,233,0.22)", cursor: "pointer", width: "100%",
                transition: "all 0.15s", boxShadow: "0 2px 12px rgba(14,165,233,0.10)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg,rgba(14,165,233,0.18) 0%,rgba(6,182,212,0.10) 100%)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg,rgba(14,165,233,0.12) 0%,rgba(6,182,212,0.06) 100%)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={13} color={BLUE} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f0f2f8", fontFamily: F }}>
                  {pt ? "Fazer upgrade" : es ? "Mejorar plan" : "Upgrade"}
                </span>
              </div>
              <ArrowUpRight size={13} color="rgba(14,165,233,0.60)" />
            </button>
          )}

          <button onClick={() => onOpenProfile?.()}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px",
              borderRadius: 9, background: "transparent", border: "none",
              cursor: "pointer", width: "100%", transition: "background 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Avatar style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{ fontSize: 12, fontWeight: 700, borderRadius: 8,
                background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.10)" }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                margin: 0, lineHeight: 1.3, fontFamily: F }}>{displayName}</p>
              <p style={{ fontSize: 11.5, color: isLifetime ? "#fbbf24" : pm.color,
                margin: 0, fontWeight: 600, lineHeight: 1.3, fontFamily: F }}>
                {isLifetime ? "∞ Lifetime" : pm.label}
              </p>
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
