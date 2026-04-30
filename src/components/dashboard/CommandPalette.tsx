/**
 * CommandPalette — global Cmd+K (Ctrl+K on Windows) palette.
 *
 * Linear/Vercel-style command bar. Open with Cmd+K from anywhere
 * inside /dashboard/*. Lists three groups:
 *   1. Decisões pendentes — top 5 from the decisions table for the
 *      current account, click → /dashboard/feed (the row scrolls
 *      itself into focus there).
 *   2. Navegar — direct routes to Comando, Estrategista, Histórico,
 *      Contas, Configurações.
 *   3. Conta — Configurações da conta (opens UserProfilePanel via
 *      onOpenProfile prop), Faturamento, Sair.
 *
 * Keyboard:
 *   Cmd/Ctrl+K  → open
 *   Esc         → close
 *   ↑↓          → move focus
 *   Enter       → execute focused item
 *   Type        → filter all groups by case-insensitive substring
 *
 * Mounted in DashboardLayout. Renders inside a portal so it sits
 * above the UserProfilePanel and any modals. Uses design tokens
 * (--bg, --surface-2, --brand) from the design system.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, Compass, Receipt, Settings, LogOut, Activity, Library, MessageSquare, Building2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/App";

const F = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

interface PaletteItem {
  id: string;
  group: "decisions" | "nav" | "account";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  // Lowercase composite searchable string built once at construction
  searchable: string;
}

interface DecisionLite {
  id: string;
  type?: string | null;
  headline?: string | null;
  impact_daily?: number | null;
}

interface Props {
  /** Toggles the palette. Pass open from a parent that listens to Cmd+K. */
  open: boolean;
  onClose: () => void;
  /** Top pending decisions to show under "Decisões pendentes". Optional —
   *  if undefined the palette skips that group. Caller in DashboardLayout
   *  doesn't have decisions in scope, so we lazy-fetch when open=true. */
  decisions?: DecisionLite[];
  /** Account UUID for fallback fetch when decisions not provided. */
  accountId?: string | null;
  /** Trigger that opens the existing UserProfilePanel slide-out. */
  onOpenProfile: () => void;
}

function impactLine(d: DecisionLite): string {
  const cents = d.impact_daily ?? 0;
  if (!cents) return d.type ? d.type.toUpperCase() : "";
  const r = Math.round(Math.abs(cents) / 100);
  const sign = cents < 0 ? "-" : "+";
  return `${(d.type || "").toUpperCase()} · ${sign}R$ ${r}/dia`;
}

export function CommandPalette({ open, onClose, decisions: passedDecisions, accountId, onOpenProfile }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const [fetchedDecisions, setFetchedDecisions] = useState<DecisionLite[] | null>(null);

  // Lazy-fetch the top 5 pending decisions when the palette opens and
  // none were passed in. Keeps DashboardLayout uninvolved with the
  // decisions store. Cached for the lifetime of this open session;
  // re-fetched the next time the user opens the palette.
  useEffect(() => {
    if (!open || passedDecisions || !accountId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("decisions")
          .select("id, type, headline, impact_daily")
          .eq("account_id", accountId)
          .eq("status", "pending")
          .order("priority_rank", { ascending: true })
          .order("score", { ascending: false })
          .limit(5);
        if (!cancelled) setFetchedDecisions((data as DecisionLite[]) || []);
      } catch {
        if (!cancelled) setFetchedDecisions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, passedDecisions, accountId]);

  const decisions = passedDecisions ?? fetchedDecisions ?? [];

  // Reset query + focus on every open
  useEffect(() => {
    if (open) {
      setQuery("");
      setFocusIdx(0);
      // Focus the input after the portal renders
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build the master item list (decisions are dynamic)
  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];

    // Group 1 — pending decisions
    decisions.slice(0, 5).forEach(d => {
      const label = d.headline || "Decisão sem título";
      const hint = impactLine(d);
      out.push({
        id: `d-${d.id}`,
        group: "decisions",
        label,
        hint,
        icon: <Activity size={14} />,
        onSelect: () => { onClose(); navigate("/dashboard/feed"); },
        searchable: `${label} ${hint}`.toLowerCase(),
      });
    });

    // Group 2 — nav
    const navItems: Array<[string, string, string, React.ReactNode]> = [
      ["nav-comando",      "Comando",       "/dashboard/feed",     <Compass size={14} />],
      ["nav-estrategista", "Estrategista (Chat IA)",  "/dashboard/ai",       <MessageSquare size={14} />],
      ["nav-historico",    "Histórico",     "/dashboard/history",  <Library size={14} />],
      ["nav-contas",       "Contas",        "/dashboard/accounts", <Building2 size={14} />],
      ["nav-settings",     "Configurações", "/dashboard/settings", <Settings size={14} />],
    ];
    navItems.forEach(([id, label, path, icon]) => {
      out.push({
        id, group: "nav", label, icon,
        onSelect: () => { onClose(); navigate(path); },
        searchable: label.toLowerCase(),
      });
    });

    // Group 3 — account
    out.push({
      id: "acc-profile", group: "account",
      label: "Configurações da conta",
      hint: "Perfil · Inteligência · Telegram · Plano",
      icon: <Settings size={14} />,
      onSelect: () => { onClose(); onOpenProfile(); },
      searchable: "configurações da conta perfil inteligência telegram plano",
    });
    out.push({
      id: "acc-billing", group: "account",
      label: "Faturamento",
      hint: "Plano + cobranças",
      icon: <Receipt size={14} />,
      onSelect: () => { onClose(); navigate("/dashboard/settings?tab=billing"); },
      searchable: "faturamento plano cobranças billing",
    });
    out.push({
      id: "acc-energy", group: "account",
      label: "Créditos da sessão",
      hint: "Uso atual + limite",
      icon: <Zap size={14} />,
      onSelect: () => { onClose(); navigate("/dashboard/settings?tab=billing"); },
      searchable: "créditos energy uso limite chats",
    });
    out.push({
      id: "acc-logout", group: "account",
      label: "Sair",
      icon: <LogOut size={14} />,
      onSelect: async () => {
        onClose();
        try {
          await supabase.auth.signOut();
          queryClient.clear();
          navigate("/login");
        } catch {
          navigate("/login");
        }
      },
      searchable: "sair logout",
    });

    return out;
  }, [decisions, navigate, onOpenProfile, onClose]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.searchable.includes(q));
  }, [items, query]);

  // Group filtered for rendering
  const grouped = useMemo(() => {
    return {
      decisions: filtered.filter(i => i.group === "decisions"),
      nav: filtered.filter(i => i.group === "nav"),
      account: filtered.filter(i => i.group === "account"),
    };
  }, [filtered]);

  // Keep focusIdx in range
  useEffect(() => { if (focusIdx >= filtered.length) setFocusIdx(0); }, [filtered.length, focusIdx]);

  // Keyboard handlers (only active when open)
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx(i => (i + 1) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx(i => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[focusIdx];
      if (target) target.onSelect();
    }
  }, [open, filtered, focusIdx, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Auto-scroll focused item into view as user arrows through the list
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-pidx="${focusIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusIdx, open]);

  if (!open) return null;

  const portal = (
    <div
      role="dialog"
      aria-label="Comando rápido"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        zIndex: 1000,
        background: "rgba(2,6,16,0.62)",
        backdropFilter: "blur(8px) saturate(150%)",
        WebkitBackdropFilter: "blur(8px) saturate(150%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "cmdk-fade 140ms ease-out",
      }}>
      <style>{`
        @keyframes cmdk-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmdk-pop {
          from { opacity: 0; transform: translateY(-6px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)    scale(1);     }
        }
      `}</style>

      <div
        style={{
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "70vh",
          background: "#0E1424",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)",
          overflow: "hidden",
          fontFamily: F,
          display: "flex",
          flexDirection: "column",
          animation: "cmdk-pop 180ms cubic-bezier(0.22,1,0.36,1)",
        }}>
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Search size={16} color="rgba(255,255,255,0.45)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocusIdx(0); }}
            placeholder="Pesquisar decisões, páginas, configurações…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#F0F6FC",
              fontSize: 15,
              fontWeight: 500,
              fontFamily: F,
            }}
          />
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            padding: "2px 6px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 5,
            letterSpacing: "0.04em",
          }}>ESC</span>
        </div>

        {/* List */}
        <div ref={listRef} style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0 12px",
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
            }}>
              Nada por aqui pra "{query}".
            </div>
          ) : (
            <>
              {grouped.decisions.length > 0 && (
                <Section title="Decisões pendentes">
                  {grouped.decisions.map((it) => {
                    const idx = filtered.indexOf(it);
                    return <Item key={it.id} item={it} idx={idx} active={idx === focusIdx} onHover={() => setFocusIdx(idx)} />;
                  })}
                </Section>
              )}
              {grouped.nav.length > 0 && (
                <Section title="Navegar">
                  {grouped.nav.map((it) => {
                    const idx = filtered.indexOf(it);
                    return <Item key={it.id} item={it} idx={idx} active={idx === focusIdx} onHover={() => setFocusIdx(idx)} />;
                  })}
                </Section>
              )}
              {grouped.account.length > 0 && (
                <Section title="Conta">
                  {grouped.account.map((it) => {
                    const idx = filtered.indexOf(it);
                    return <Item key={it.id} item={it} idx={idx} active={idx === focusIdx} onHover={() => setFocusIdx(idx)} />;
                  })}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12,
          padding: "8px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10.5, color: "rgba(255,255,255,0.45)",
          fontWeight: 500, letterSpacing: "0.02em",
        }}>
          <Hint k="↑↓" label="navegar" />
          <Hint k="↵" label="abrir" />
          <Hint k="esc" label="fechar" />
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
        color: "rgba(255,255,255,0.40)",
        padding: "8px 16px 4px",
        textTransform: "uppercase",
      }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Item({ item, idx, active, onHover }: { item: PaletteItem; idx: number; active: boolean; onHover: () => void }) {
  return (
    <button
      data-pidx={idx}
      onClick={() => item.onSelect()}
      onMouseEnter={onHover}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%",
        padding: "9px 16px",
        background: active ? "rgba(13,162,231,0.10)" : "transparent",
        border: "none",
        borderLeft: `2px solid ${active ? "#0DA2E7" : "transparent"}`,
        cursor: "pointer",
        textAlign: "left",
        color: active ? "#F0F6FC" : "rgba(255,255,255,0.78)",
        fontFamily: F,
        transition: "background 0.06s, color 0.06s",
      }}
    >
      <span style={{
        display: "inline-flex", width: 20, justifyContent: "center",
        color: active ? "#0DA2E7" : "rgba(255,255,255,0.5)",
      }}>
        {item.icon}
      </span>
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, fontWeight: 500,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{item.label}</span>
      {item.hint && (
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: active ? "rgba(13,162,231,0.85)" : "rgba(255,255,255,0.4)",
          flexShrink: 0,
        }}>{item.hint}</span>
      )}
    </button>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{
        padding: "1px 5px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 4,
        fontSize: 10,
        color: "rgba(255,255,255,0.65)",
        fontFamily: F,
        fontWeight: 600,
      }}>{k}</span>
      <span>{label}</span>
    </span>
  );
}
