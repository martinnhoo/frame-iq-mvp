/**
 * AutopilotLogPage — Read-only log of every action the AI Autopilot has taken.
 *
 * Built to earn trust: "We acted on your money. Here's exactly what, why, and
 * when — with a full audit trail and the ability to undo within the window."
 *
 * Source: `autopilot_action_log` table (one row per autopilot execution).
 * Linked from: SettingsPage → Autopilot card → "Ver log de ações".
 */
import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Undo2,
  XCircle,
  TrendingUp,
  Info,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const M = "'DM Mono', monospace";

// ── i18n ────────────────────────────────────────────────────────────────────
const TX = {
  pt: {
    title: "Log do Autopilot",
    subtitle: "Auditoria completa de toda ação que a IA executou por você",
    back: "Voltar para configurações",
    empty: "Nenhuma ação autônoma executada ainda",
    emptyDesc:
      "Quando o Autopilot estiver habilitado e encontrar decisões com confiança acima do seu limite, as ações aparecerão aqui em tempo real.",
    totalSaved: "Economizado",
    actionsThisWeek: "Ações esta semana",
    successRate: "Taxa de sucesso",
    undone: "Desfeitas",
    pending: "pendente",
    executed: "executada",
    undoneStatus: "desfeita",
    error: "erro",
    skipped: "pulada",
    undo: "Desfazer",
    undoing: "Desfazendo...",
    undoExpired: "Janela expirou",
    reason: "Razão",
    confidence: "Confiança",
    amount: "Valor em risco",
    loadMore: "Carregar mais",
    loading: "Carregando...",
    today: "Hoje",
    yesterday: "Ontem",
    viewAuditTrail: "Ver rastreabilidade completa",
    protectedBy: "Protegido por Autopilot Guardrails",
    undoSuccess: "Ação desfeita com sucesso",
    undoFailed: "Não foi possível desfazer — tente manualmente no Ads Manager",
  },
  es: {
    title: "Registro del Autopilot",
    subtitle: "Auditoría completa de cada acción que la IA ejecutó por ti",
    back: "Volver a ajustes",
    empty: "Aún no se han ejecutado acciones autónomas",
    emptyDesc:
      "Cuando el Autopilot esté habilitado y encuentre decisiones con confianza sobre tu umbral, las acciones aparecerán aquí en tiempo real.",
    totalSaved: "Ahorrado",
    actionsThisWeek: "Acciones esta semana",
    successRate: "Tasa de éxito",
    undone: "Deshechas",
    pending: "pendiente",
    executed: "ejecutada",
    undoneStatus: "deshecha",
    error: "error",
    skipped: "omitida",
    undo: "Deshacer",
    undoing: "Deshaciendo...",
    undoExpired: "Ventana expiró",
    reason: "Razón",
    confidence: "Confianza",
    amount: "Monto en riesgo",
    loadMore: "Cargar más",
    loading: "Cargando...",
    today: "Hoy",
    yesterday: "Ayer",
    viewAuditTrail: "Ver trazabilidad completa",
    protectedBy: "Protegido por Autopilot Guardrails",
    undoSuccess: "Acción deshecha con éxito",
    undoFailed: "No se pudo deshacer — inténtalo manualmente en Ads Manager",
  },
  en: {
    title: "Autopilot Log",
    subtitle: "Complete audit of every action the AI executed for you",
    back: "Back to settings",
    empty: "No autonomous actions executed yet",
    emptyDesc:
      "When Autopilot is enabled and finds decisions above your confidence threshold, actions will appear here in real time.",
    totalSaved: "Saved",
    actionsThisWeek: "Actions this week",
    successRate: "Success rate",
    undone: "Undone",
    pending: "pending",
    executed: "executed",
    undoneStatus: "undone",
    error: "error",
    skipped: "skipped",
    undo: "Undo",
    undoing: "Undoing...",
    undoExpired: "Window expired",
    reason: "Reason",
    confidence: "Confidence",
    amount: "Amount at risk",
    loadMore: "Load more",
    loading: "Loading...",
    today: "Today",
    yesterday: "Yesterday",
    viewAuditTrail: "View full audit trail",
    protectedBy: "Protected by Autopilot Guardrails",
    undoSuccess: "Action undone successfully",
    undoFailed: "Unable to undo — please try manually in Ads Manager",
  },
} as const;

// ── Types ───────────────────────────────────────────────────────────────────
interface AutopilotLogRow {
  id: string;
  decision_id: string | null;
  action_type: string;
  target_kind: "ad" | "adset" | "campaign" | string;
  target_id: string;
  target_name: string | null;
  reason: string | null;
  confidence: number | null;
  amount_at_risk_brl: number | null;
  payload: Record<string, unknown> | null;
  status: "pending" | "executed" | "undone" | "error" | "skipped" | string;
  executed_at: string | null;
  expires_undo_at: string | null;
  undone_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

// ── Component ───────────────────────────────────────────────────────────────
const AutopilotLogPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = TX[language as keyof typeof TX] || TX.pt;
  const userId = ctx.user?.id;

  const [rows, setRows] = useState<AutopilotLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [stats, setStats] = useState<{ saved: number; actions7d: number; total: number; undone: number }>({
    saved: 0,
    actions7d: 0,
    total: 0,
    undone: 0,
  });

  const fetchLogs = useCallback(
    async (offset = 0) => {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("autopilot_action_log")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        const list: AutopilotLogRow[] = (data as AutopilotLogRow[]) || [];
        if (offset === 0) setRows(list);
        else setRows((prev) => [...prev, ...list]);
        setHasMore(list.length === PAGE_SIZE);
      } catch (e) {
        console.error("[AutopilotLogPage] fetch error", e);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await (supabase as any)
        .from("autopilot_action_log")
        .select("status, amount_at_risk_brl, executed_at, undone_at")
        .eq("user_id", userId);

      const allRows: AutopilotLogRow[] = data || [];
      const executed = allRows.filter((r) => r.status === "executed" || r.status === "undone");
      const undone = allRows.filter((r) => r.status === "undone");
      const last7 = executed.filter((r) => r.executed_at && new Date(r.executed_at) >= sevenDaysAgo);
      const saved = executed.reduce((sum, r) => sum + (Number(r.amount_at_risk_brl) || 0), 0);

      setStats({
        saved,
        actions7d: last7.length,
        total: executed.length,
        undone: undone.length,
      });
    } catch (e) {
      console.error("[AutopilotLogPage] stats error", e);
    }
  }, [userId]);

  useEffect(() => {
    fetchLogs(0);
    fetchStats();
  }, [fetchLogs, fetchStats]);

  // ── Undo an action ────────────────────────────────────────────────────────
  const undoAction = async (row: AutopilotLogRow) => {
    if (!row.decision_id || undoing) return;
    setUndoing(row.id);
    try {
      // Find the corresponding action_log entry by decision_id
      const { data: actionLog } = await supabase
        .from("action_log")
        .select("id, rollback_expires_at")
        .eq("decision_id", row.decision_id)
        .eq("result", "success")
        .maybeSingle();

      if (!actionLog?.id) {
        alert(t.undoFailed);
        setUndoing(null);
        return;
      }

      const { error } = await supabase.functions.invoke("execute-action", {
        body: {
          action_type: "rollback",
          action_log_id: actionLog.id,
          target_type: row.target_kind,
          target_meta_id: row.target_id,
        },
      });

      if (error) throw error;

      await (supabase as any)
        .from("autopilot_action_log")
        .update({ status: "undone", undone_at: new Date().toISOString(), undone_by: userId })
        .eq("id", row.id);

      // Also reset the decision status so the user sees it back in the feed
      if (row.decision_id) {
        await supabase.from("decisions").update({ status: "pending" }).eq("id", row.decision_id);
      }

      alert(t.undoSuccess);
      await fetchLogs(0);
      await fetchStats();
    } catch (e) {
      console.error("[AutopilotLogPage] undo error", e);
      alert(t.undoFailed);
    } finally {
      setUndoing(null);
    }
  };

  // ── Group by date ─────────────────────────────────────────────────────────
  const grouped: Record<string, AutopilotLogRow[]> = {};
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400_000).toISOString().split("T")[0];
  for (const r of rows) {
    const d = (r.executed_at || r.created_at).split("T")[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(r);
  }
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDateHeader = (d: string) => {
    if (d === today) return t.today;
    if (d === yesterday) return t.yesterday;
    const date = new Date(d);
    return date.toLocaleDateString(language === "pt" ? "pt-BR" : language, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString(language === "pt" ? "pt-BR" : language, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currency = language === "pt" ? "R$" : "$";

  // ── Status pill ──────────────────────────────────────────────────────────
  const statusPill = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
      executed: {
        bg: "rgba(52,211,153,0.12)",
        color: "#34D399",
        label: t.executed,
        icon: <CheckCircle2 size={12} strokeWidth={2.2} />,
      },
      pending: {
        bg: "rgba(251,191,36,0.12)",
        color: "#FBBF24",
        label: t.pending,
        icon: <Loader2 size={12} className="animate-spin" strokeWidth={2.2} />,
      },
      undone: {
        bg: "rgba(156,163,175,0.15)",
        color: "#9CA3AF",
        label: t.undoneStatus,
        icon: <Undo2 size={12} strokeWidth={2.2} />,
      },
      error: {
        bg: "rgba(239,68,68,0.12)",
        color: "#F87171",
        label: t.error,
        icon: <XCircle size={12} strokeWidth={2.2} />,
      },
      skipped: {
        bg: "rgba(156,163,175,0.12)",
        color: "#9CA3AF",
        label: t.skipped,
        icon: <Info size={12} strokeWidth={2.2} />,
      },
    };
    const s = map[status] || map.pending;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 999,
          background: s.bg,
          color: s.color,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: F,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {s.icon}
        {s.label}
      </span>
    );
  };

  const canUndo = (row: AutopilotLogRow): boolean => {
    if (row.status !== "executed") return false;
    if (!row.expires_undo_at) return false;
    return new Date(row.expires_undo_at) > new Date();
  };

  return (
    <div style={{ fontFamily: F, color: "#E4E4E7", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate("/dashboard/settings")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "#9CA3AF",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 14,
            padding: 0,
            fontFamily: F,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          {t.back}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(139,92,246,0.08))",
              border: "1px solid rgba(167,139,250,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bot size={22} color="#A78BFA" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4F4F5", margin: 0, letterSpacing: -0.3 }}>{t.title}</h1>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: "2px 0 0 0" }}>{t.subtitle}</p>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.22)",
            color: "#A78BFA",
            fontSize: 11,
            fontWeight: 600,
            marginTop: 10,
          }}
        >
          <ShieldCheck size={12} strokeWidth={2.2} />
          {t.protectedBy}
        </div>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatCard label={t.totalSaved} value={`${currency}${stats.saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#34D399" icon={<TrendingUp size={14} />} />
        <StatCard label={t.actionsThisWeek} value={String(stats.actions7d)} color="#A78BFA" icon={<Bot size={14} />} />
        <StatCard
          label={t.successRate}
          value={stats.total > 0 ? `${Math.round(((stats.total - stats.undone) / stats.total) * 100)}%` : "—"}
          color="#60A5FA"
          icon={<CheckCircle2 size={14} />}
        />
        <StatCard label={t.undone} value={String(stats.undone)} color="#9CA3AF" icon={<Undo2 size={14} />} />
      </div>

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            border: "1px dashed rgba(255,255,255,0.08)",
            borderRadius: 14,
            textAlign: "center",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <Bot size={36} color="#A78BFA" strokeWidth={1.5} style={{ margin: "0 auto 14px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5", marginBottom: 6 }}>{t.empty}</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>{t.emptyDesc}</div>
          <button
            onClick={() => navigate("/dashboard/settings")}
            style={{
              marginTop: 18,
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(139,92,246,0.16)",
              border: "1px solid rgba(167,139,250,0.3)",
              color: "#C4B5FD",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: F,
            }}
          >
            {t.back}
          </button>
        </div>
      )}

      {/* Loading first paint */}
      {loading && rows.length === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
          <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: 13 }}>{t.loading}</div>
        </div>
      )}

      {/* Grouped log */}
      {dateKeys.map((dateKey) => (
        <div key={dateKey} style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: 0.8,
              color: "#71717A",
              marginBottom: 10,
              fontFamily: M,
            }}
          >
            {formatDateHeader(dateKey)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {grouped[dateKey].map((row) => {
              const conf = Math.round((Number(row.confidence) || 0) * 100);
              const impact = Number(row.amount_at_risk_brl) || 0;
              return (
                <div
                  key={row.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#71717A", fontFamily: M }}>{formatTime(row.executed_at || row.created_at)}</span>
                        {statusPill(row.status)}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(167,139,250,0.1)",
                            color: "#C4B5FD",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            fontFamily: M,
                            letterSpacing: 0.5,
                          }}
                        >
                          {row.action_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5", marginBottom: 2 }}>
                        {row.target_name || row.target_id}
                      </div>
                      <div style={{ fontSize: 11, color: "#71717A", fontFamily: M }}>
                        {row.target_kind} · {row.target_id}
                      </div>
                    </div>

                    {/* Undo button */}
                    {canUndo(row) && (
                      <button
                        onClick={() => undoAction(row)}
                        disabled={undoing === row.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "rgba(248,113,113,0.08)",
                          border: "1px solid rgba(248,113,113,0.24)",
                          color: "#F87171",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: undoing === row.id ? "wait" : "pointer",
                          opacity: undoing === row.id ? 0.6 : 1,
                          fontFamily: F,
                        }}
                      >
                        {undoing === row.id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} strokeWidth={2.2} />}
                        {undoing === row.id ? t.undoing : t.undo}
                      </button>
                    )}
                    {row.status === "executed" && !canUndo(row) && (
                      <span style={{ fontSize: 11, color: "#71717A", fontFamily: M, alignSelf: "center" }}>{t.undoExpired}</span>
                    )}
                  </div>

                  {/* Reason */}
                  {row.reason && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        fontSize: 13,
                        color: "#D4D4D8",
                        lineHeight: 1.5,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          fontWeight: 700,
                          letterSpacing: 0.6,
                          color: "#71717A",
                          marginBottom: 4,
                          fontFamily: M,
                        }}
                      >
                        {t.reason}
                      </div>
                      {row.reason}
                    </div>
                  )}

                  {/* Metrics strip */}
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap",
                      paddingTop: 4,
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <Metric label={t.confidence} value={`${conf}%`} color={conf >= 95 ? "#34D399" : conf >= 85 ? "#A78BFA" : "#9CA3AF"} />
                    <Metric label={t.amount} value={`${currency}${impact.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/d`} color="#FBBF24" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Load more */}
      {!loading && hasMore && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => fetchLogs(rows.length)}
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#D4D4D8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: F,
            }}
          >
            {t.loadMore}
          </button>
        </div>
      )}

      {loading && rows.length > 0 && (
        <div style={{ textAlign: "center", padding: "14px 0", color: "#9CA3AF", fontSize: 12 }}>
          <Loader2 size={14} className="animate-spin" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
          {t.loading}
        </div>
      )}
    </div>
  );
};

// ── Subcomponents ───────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <div
    style={{
      padding: "12px 14px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>
      {icon}
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5", letterSpacing: -0.3 }}>{value}</div>
  </div>
);

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
    <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, color: "#71717A", fontFamily: M }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: M }}>{value}</span>
  </div>
);

export default AutopilotLogPage;
