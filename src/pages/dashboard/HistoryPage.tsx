import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Undo2, Check, X, RotateCcw, Loader2, Pause, Play, TrendingUp, TrendingDown, Copy, Zap } from 'lucide-react';
import { toast } from 'sonner';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface ActionLogEntry {
  id: string;
  action_type: string;
  target_name: string;
  target_type: string;
  target_meta_id: string;
  result: 'pending' | 'success' | 'error' | 'rolled_back';
  estimated_daily_impact: number | null;
  actual_impact_48h: number | null;
  rollback_available: boolean;
  rollback_expires_at: string | null;
  rolled_back_at: string | null;
  executed_at: string;
  validated_at: string | null;
  error_message: string | null;
  decision_id: string | null;
}

// ── Action icon (Lucide, no emoji) ─────────────────────────────────────────────
function ActionIcon({ type }: { type: string }) {
  const size = 15;
  const common = { strokeWidth: 2 };
  if (type.includes('pause')) return <Pause size={size} {...common} />;
  if (type.includes('reactivate')) return <Play size={size} {...common} />;
  if (type.includes('increase')) return <TrendingUp size={size} {...common} />;
  if (type.includes('decrease')) return <TrendingDown size={size} {...common} />;
  if (type.includes('duplicate')) return <Copy size={size} {...common} />;
  return <Zap size={size} {...common} />;
}

function getActionColor(type: string): string {
  if (type.includes('pause')) return '#f87171';
  if (type.includes('reactivate')) return '#34d399';
  if (type.includes('increase')) return '#34d399';
  if (type.includes('decrease')) return '#fbbf24';
  if (type.includes('duplicate')) return '#60a5fa';
  return '#8B949E';
}

const HistoryPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean }>();
  const { activeAccount } = ctx;
  const accountId = activeAccount?.id ?? null;

  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!accountId) { setHistory([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('action_log' as any)
        .select('*')
        .eq('account_id', accountId)
        .order('executed_at', { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      setHistory((data || []) as ActionLogEntry[]);
    } catch (err) {
      console.error('[HistoryPage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleUndo = async (entry: ActionLogEntry) => {
    setUndoingId(entry.id);
    try {
      const { error } = await supabase.functions.invoke('execute-action', {
        body: {
          action_type: 'rollback',
          action_log_id: entry.id,
          target_type: entry.target_type,
          target_meta_id: entry.target_meta_id,
        },
      });
      if (error) throw error;
      setHistory(prev =>
        prev.map(h => h.id === entry.id
          ? { ...h, result: 'rolled_back' as const, rollback_available: false, rolled_back_at: new Date().toISOString() }
          : h
        )
      );
      toast.success('Ação desfeita com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao desfazer');
    } finally {
      setUndoingId(null);
    }
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      pause_ad: 'Anúncio pausado',
      pause_adset: 'Conjunto pausado',
      pause_campaign: 'Campanha pausada',
      reactivate_ad: 'Anúncio reativado',
      reactivate_adset: 'Conjunto reativado',
      reactivate_campaign: 'Campanha reativada',
      increase_budget: 'Budget aumentado',
      decrease_budget: 'Budget reduzido',
      duplicate_ad: 'Anúncio duplicado',
      duplicate_campaign: 'Campanha duplicada',
      generate_hook: 'Hook gerado',
      generate_variation: 'Variação gerada',
    };
    return labels[type] || type;
  };

  const getTargetLabel = (type: string) => {
    if (type === 'campaign') return 'Campanha';
    if (type === 'adset') return 'Conjunto';
    return 'Anúncio';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success': return { icon: <Check size={11} strokeWidth={2.5} />, label: 'Sucesso', color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.20)' };
      case 'error': return { icon: <X size={11} strokeWidth={2.5} />, label: 'Erro', color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.20)' };
      case 'rolled_back': return { icon: <RotateCcw size={11} strokeWidth={2.5} />, label: 'Desfeito', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.20)' };
      default: return { icon: <Loader2 size={11} className="animate-spin" />, label: 'Pendente', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' };
    }
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffMin < 1) return `Agora · ${time}`;
    if (diffMin < 60) return `${diffMin}min atrás · ${time}`;
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (isToday) return `Hoje · ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Ontem · ${time}`;
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${time}`;
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  // Total economizado = sum of estimated_daily_impact for pause actions (saves budget)
  // + actual_impact_48h when validated
  const totalSaved = history
    .filter(h => h.result === 'success')
    .reduce((sum, h) => {
      if (h.actual_impact_48h) return sum + h.actual_impact_48h;
      if (h.estimated_daily_impact && h.action_type.includes('pause')) return sum + h.estimated_daily_impact;
      return sum;
    }, 0);

  const successCount = history.filter(h => h.result === 'success').length;
  const actionsThisMonth = history.filter(h =>
    new Date(h.executed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const formatCurrency = (v: number) => {
    if (v === 0) return 'R$ 0';
    return `R$ ${(v / 100).toFixed(2).replace('.', ',')}`;
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: '32px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.05)', padding: 20, marginBottom: 8,
            }}>
              <div style={{ width: '35%', height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 10 }} />
              <div style={{ width: '55%', height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060709', padding: '32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: F }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px',
          }}>
            Histórico
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: 0, lineHeight: 1.5 }}>
            Ações executadas pelo Copilot e pelo Chat na sua conta
          </p>
        </div>

        {/* Stats row */}
        {history.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Total economizado', value: formatCurrency(totalSaved), color: totalSaved > 0 ? '#34d399' : 'rgba(255,255,255,0.50)' },
              { label: 'Ações este mês', value: String(actionsThisMonth), color: '#F0F6FC' },
              { label: 'Taxa de sucesso', value: history.length > 0 ? `${Math.round((successCount / history.length) * 100)}%` : '—', color: '#F0F6FC' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <p style={{
                  fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
                }}>
                  {stat.label}
                </p>
                <p style={{
                  fontSize: 20, fontWeight: 700, color: stat.color,
                  fontVariant: 'tabular-nums', letterSpacing: '-0.02em', margin: 0,
                }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '48px 32px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', color: 'rgba(255,255,255,0.20)',
            }}>
              <Zap size={18} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.70)', margin: '0 0 4px' }}>
              Nenhuma ação registrada
            </p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
              Ações do Feed e do Chat aparecerão aqui com histórico completo.
            </p>
          </div>
        )}

        {/* Action list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map(entry => {
            const status = getStatusConfig(entry.result);
            const actionColor = getActionColor(entry.action_type);
            const canRollback = entry.decision_id
              && entry.rollback_available
              && entry.result === 'success'
              && (!entry.rollback_expires_at || new Date(entry.rollback_expires_at) > new Date());

            return (
              <div key={entry.id} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '14px 16px',
                transition: 'border-color 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Action icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${actionColor}10`,
                    border: `1px solid ${actionColor}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: actionColor, flexShrink: 0, marginTop: 1,
                  }}>
                    <ActionIcon type={entry.action_type} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 13.5, fontWeight: 600, color: '#F0F6FC',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.target_name || entry.target_meta_id}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1.5px 7px', borderRadius: 999,
                        background: status.bg, color: status.color,
                        border: `1px solid ${status.border}`,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        flexShrink: 0,
                      }}>
                        {status.icon} {status.label}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                      {getActionLabel(entry.action_type)}
                      {/* Show specific budget values when available */}
                      {(entry.action_type === 'increase_budget' || entry.action_type === 'decrease_budget') &&
                        (entry as any).new_state?.budget_change ? (() => {
                          const bc = (entry as any).new_state.budget_change;
                          const fromVal = (bc.from / 100).toFixed(2).replace('.', ',');
                          const toVal = (bc.to / 100).toFixed(2).replace('.', ',');
                          return ` · R$ ${fromVal} → R$ ${toVal} (${bc.change_pct > 0 ? '+' : ''}${bc.change_pct}%)`;
                        })() : (entry.action_type === 'increase_budget' || entry.action_type === 'decrease_budget') &&
                          (entry as any).previous_state?.daily_budget && (entry as any).new_state?.daily_budget ? (() => {
                            const fromVal = (Number((entry as any).previous_state.daily_budget) / 100).toFixed(2).replace('.', ',');
                            const toVal = (Number((entry as any).new_state.daily_budget) / 100).toFixed(2).replace('.', ',');
                            return ` · R$ ${fromVal} → R$ ${toVal}`;
                          })() : null}
                      {entry.target_type && ` · ${getTargetLabel(entry.target_type)}`}
                      {' · '}{formatDate(entry.executed_at)}
                    </p>

                    {/* Impact metrics */}
                    {(entry.estimated_daily_impact || entry.actual_impact_48h) ? (
                      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                        {entry.estimated_daily_impact ? (
                          <div>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Estimado/dia
                            </span>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.50)', fontVariant: 'tabular-nums', margin: '1px 0 0' }}>
                              {formatCurrency(entry.estimated_daily_impact)}
                            </p>
                          </div>
                        ) : null}
                        {entry.actual_impact_48h ? (
                          <div>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Real 48h {entry.validated_at && <Check size={9} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                            </span>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#34d399', fontVariant: 'tabular-nums', margin: '1px 0 0' }}>
                              {formatCurrency(entry.actual_impact_48h)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Error message */}
                    {entry.error_message && (
                      <p style={{ fontSize: 11.5, color: '#f87171', margin: '6px 0 0', lineHeight: 1.4 }}>
                        {entry.error_message}
                      </p>
                    )}
                  </div>

                  {/* Undo button */}
                  {canRollback && (
                    <button
                      onClick={() => handleUndo(entry)}
                      disabled={undoingId === entry.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: F,
                        opacity: undoingId === entry.id ? 0.5 : 1,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {undoingId === entry.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Desfazendo...</>
                      ) : (
                        <><Undo2 size={12} /> Desfazer</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
