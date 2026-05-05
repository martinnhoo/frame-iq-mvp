/**
 * AppTopbarUserMenu — avatar + dropdown for the global topbar.
 *
 * Lives at the right edge of the topbar (next to Telegram + credit
 * meter). Click → mini menu with Conta / Faturamento / Idioma / Sair.
 * Click on Conta → opens the existing UserProfilePanel slide-out
 * (no new settings UI needed; the panel already covers profile,
 * billing, telegram, language, intelligence). This component is
 * just a more discoverable trigger.
 *
 * Why a topbar trigger when the sidebar footer already had one:
 * big-tech apps (Linear, Vercel, Notion) all put user menu top-right.
 * Sidebar bottom is invisible most of the time — first-time users
 * don't find it. Topbar is the canonical place.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Globe, LogOut, ChevronDown, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/App";
import { useLanguage } from "@/i18n/LanguageContext";
import type { User } from "@supabase/supabase-js";

const F = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

// Same gradient-from-name pattern the sidebar uses, kept inline so this
// component is self-contained and doesn't have to import from sidebar.
function avatarGradient(name: string) {
  const palettes = [
    "linear-gradient(135deg,#0DA2E7,#06B6D4)", // brand sky → cyan
    "linear-gradient(135deg,#38BDF8,#0EA5E9)",
    "linear-gradient(135deg,#A78BFA,#7C3AED)",
    "linear-gradient(135deg,#34D399,#10B981)",
    "linear-gradient(135deg,#F59E0B,#D97706)",
  ];
  const sum = (name || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[sum % palettes.length];
}

function getInitials(name: string, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[ @]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

interface Props {
  user: User | null;
  profile: { name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  plan?: string | null;
  onOpenProfile: () => void;
}

export function AppTopbarUserMenu({ user, profile, plan, onOpenProfile }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Hub mode: rotas /dashboard/hub* escondem itens AdBrief do menu.
  const isHubMode = location.pathname.startsWith("/dashboard/hub");
  const { setLanguage, language } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside or Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName = profile?.name || user?.email?.split("@")[0] || "Você";
  const email = user?.email || profile?.email || "";
  const initials = getInitials(displayName, email);
  // planLabel removido — operação interna não exibe plano no header.

  const cycleLanguage = () => {
    // 4 idiomas no cycler: PT → EN → ES → ZH → PT…
    const order = ["pt", "en", "es", "zh"] as const;
    const i = order.indexOf(language as (typeof order)[number]);
    const next = order[(i + 1) % order.length];
    setLanguage(next);
  };

  const langLabel = (l: string): string => {
    switch (l) {
      case "pt": return "Português";
      case "en": return "English";
      case "es": return "Español";
      case "zh": return "中文";
      default:   return "English";
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      navigate("/login");
    } catch {
      // signOut error already shown by Supabase listener; just route home
      navigate("/login");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger — avatar + chevron, fits the 48px topbar height */}
      <button
        onClick={() => setOpen(s => !s)}
        title="Conta"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 8px 4px 4px",
          borderRadius: 8, background: open ? "rgba(255,255,255,0.06)" : "transparent",
          border: `1px solid ${open ? "rgba(255,255,255,0.10)" : "transparent"}`,
          cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
          height: 34,
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}>
        <Avatar style={{ width: 26, height: 26, borderRadius: 7 }}>
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback style={{
            fontSize: 10, fontWeight: 700, borderRadius: 7,
            background: avatarGradient(displayName), color: "rgba(255,255,255,0.92)",
            border: "none",
          }}>{initials}</AvatarFallback>
        </Avatar>
        <ChevronDown size={13} color="rgba(255,255,255,0.55)" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            minWidth: 264, maxWidth: 300,
            background: "#0E1424",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
            zIndex: 200,
            overflow: "hidden",
            fontFamily: F,
            animation: "topbarMenuIn 140ms cubic-bezier(0.22,1,0.36,1)",
          }}>
          <style>{`
            @keyframes topbarMenuIn {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0);    }
            }
          `}</style>

          {/* Header — name + email */}
          <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}>
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback style={{
                fontSize: 13, fontWeight: 700, borderRadius: 9,
                background: avatarGradient(displayName), color: "rgba(255,255,255,0.95)",
                border: "none",
              }}>{initials}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)",
                margin: 0, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{displayName}</p>
              <p style={{
                fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)",
                margin: "2px 0 0", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{email}</p>
            </div>
          </div>

          {/* Idioma — destacado no topo (era item discreto no meio).
              É a opção mais usada no contexto interno multi-marca (time
              alterna entre PT/EN/ES dependendo do mercado da campanha). */}
          <button
            onClick={cycleLanguage}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%",
              padding: "10px 14px",
              margin: "0 0 4px",
              background: "rgba(168,85,247,0.10)",
              border: "none",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              cursor: "pointer",
              fontFamily: F,
              transition: "background 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.18)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.10)"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.06 }}>
              <Globe size={13} /> Idioma
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#a855f7" }}>
              {langLabel(language)}
            </span>
          </button>

          {/* Divider gap */}
          <div style={{ height: 4 }} />

          {/* Menu items — operação interna, sem Plano/Faturamento/Convidar.
              Settings ainda dá acesso a integrações, autopilot, etc. */}
          {/* Configurações = página /dashboard/settings (autopilot, integrações, plano).
              Esconde em Hub mode — Hub interno não usa essa página. */}
          {!isHubMode && (
            <MenuItem icon={<Settings size={14} />} label="Configurações" onClick={() => { setOpen(false); navigate("/dashboard/settings"); }} />
          )}
          <MenuItem icon={<UserCircle size={14} />} label="Perfil rápido" onClick={() => { setOpen(false); onOpenProfile(); }} />

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />

          <MenuItem icon={<LogOut size={14} />} label="Sair" onClick={handleSignOut} danger />

          <div style={{ height: 6 }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger = false, keepOpen = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  keepOpen?: boolean;
}) {
  void keepOpen; // kept for caller readability; click handlers control open state
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%",
        padding: "9px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: F,
        fontSize: 13,
        fontWeight: 500,
        color: danger ? "rgba(248,113,113,0.85)" : "rgba(255,255,255,0.78)",
        transition: "background 0.1s, color 0.1s",
        textAlign: "left",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = danger ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)";
        el.style.color = danger ? "#FCA5A5" : "rgba(255,255,255,0.95)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "transparent";
        el.style.color = danger ? "rgba(248,113,113,0.85)" : "rgba(255,255,255,0.78)";
      }}
    >
      <span style={{ display: "inline-flex", width: 16, justifyContent: "center", color: "currentColor", opacity: 0.85 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}
