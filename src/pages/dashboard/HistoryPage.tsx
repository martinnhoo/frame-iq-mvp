import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Undo2, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'JetBrains Mono', monospace";

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

const HistoryPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean }>();
  const { activeAccount, metaConnected } = ctx;
  const accountId = activeAccount?.id ?? null;

  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!accountId) {
      setHistory([]);
      setLoading(false);
      return;
    }

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
      // Call the undo edge function
      const { error } = await supabase.functions.invoke('execute-action', {
        body: {
          action: 'rollback',
          action_log_id: entry.id,
          target_type: entry.target_type,
          target_meta_id: entry.target_meta_id,
        },
      });
      if (error) throw error;

      // Update local state
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

  const getActionIcon = (type: string) => {
    if (type.includes('pause')) return '🛑';
    if (type.includes('increase') || type.includes('duplicate')) return '🚀';
    if (type.includes('reactivate')) return '♻️';
    if (type.includes('decrease')) return '📉';
    return '🔧';
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      pause_ad: 'Anúncio pausado',
      pause_adset: 'Conjunto pausado',
      pause_campaign: 'Campanha pausada',
      reactivate_ad: 'Anúncio reativado',
      reactivate_adset: 'Conjunto reativado',
      increase_budget: 'Budget aumentado',
      decrease_budget: 'Budget reduzido',
      duplicate_ad: 'Anúncio duplicado',
      generate_hook: 'Hook gerado',
      generate_variation: 'Variação gerada',
    };
    return labels[type] || type;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'success': return { icon: <Check size={13} />, label: 'Sucesso', color: '#34d399', bg: 'rgba(52,211,153,0.08)' };
      case 'error': return { icon: <X size={13} />, label: 'Erro', color: '#f87171', bg: 'rgba(248,113,113,0.08)' };
      case 'rolled_back': return { icon: <RotateCcw size={13} />, label: 'Desfeito', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' };
      default: return { icon: <Loader2 size={13} className="animate-spin" />, label: 'Pendente', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
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
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return `Hoje · ${time}`;
    if (isYesterday) return `Ontem · ${time}`;

    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${date} · ${time}`;
  };

  const formatCentavos = (v: number) => `R$ ${(v / 100).toFixed(2)}`;

  // Summary stats
  const totalSaved = history
    .filter(h => h.result === 'success' && h.actual_impact_48h)
    .reduce((sum, h) => sum + (h.actual_impact_48h || 0), 0);

  const actionsThisMonth = history.filter(h => {
    return new Date(h.executed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 16,
            }}>
              <div style={{ width: '40%', height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 12 }} />
              <div style={{ width: '60%', height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
            Histórico de Ações
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0', fontFamily: F }}>
            Todas as ações executadas pelo Copilot na sua conta
          </p>
        </div>

        {/* Summary row */}
        {history.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: F }}>
                Total economizado
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#34d399', fontFamily: M, letterSpacing: '-0.02em', margin: 0 }}>
                {formatCentavos(totalSaved)}
              </p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: F }}>
                Ações este mês
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: M, letterSpacing: '-0.02em', margin: 0 }}>
                {actionsThisMonth}
              </p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', fontFamily: F }}>
                Total de ações
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: M, letterSpacing: '-0.02em', margin: 0 }}>
                {history.length}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '48px 32px',
            textAlign: 'center', fontFamily: F,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 22,
            }}>
              📋
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
              Nenhuma ação registrada ainda
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              Quando você executar ações pelo Feed ou pelo Chat, elas aparecerão aqui.
            </p>
          </div>
        )}

        {/* Action list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map(entry => {
            const status = getStatusConfig(entry.result);
            const canRollback = entry.decision_id
              && entry.rollback_available
              && entry.result === 'success'
              && (!entry.rollback_expires_at || new Date(entry.rollback_expires_at) > new Date());

            return (
              <div key={entry.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '18px 20px',
                fontFamily: F, transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Icon */}
                  <span style={{ fontSize: 24, lineHeight: 1, marginTop: 2 }}>
                    {getActionIcon(entry.action_type)}
                  </span>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                        {entry.target_name || entry.target_meta_id}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: status.bg, color: status.color,
                        border: `1px solid ${status.color}25`,
                      }}>
                        {status.label}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                      {getActionLabel(entry.action_type)}
                      {entry.target_type && ` · ${entry.target_type === 'campaign' ? 'Campanha' : entry.target_type === 'adset' ? 'Conjunto' : 'Anúncio'}`}
                      {' · '}{formatDate(entry.executed_at)}
                    </p>

                    {/* Impact row */}
                    {(entry.estimated_daily_impact || entry.actual_impact_48h) && (
                      <div style={{ display: 'flex', gap: 20 }}>
                        {entry.estimated_daily_impact && (
                          <div>
                            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Estimado
                            </span>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: M, margin: '2px 0 0' }}>
                              {formatCentavos(entry.estimated_daily_impact)}/dia
                            </p>
                          </div>
                        )}
                        {entry.actual_impact_48h && (
                          <div>
                            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Real (48h) {entry.validated_at ? '✓' : ''}
                            </span>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#34d399', fontFamily: M, margin: '2px 0 0' }}>
                              {formatCentavos(entry.actual_impact_48h)}/dia
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.error_message && (
                      <p style={{ fontSize: 11, color: '#f87171', margin: '8px 0 0', fontFamily: M }}>
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
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: F,
                        opacity: undoingId === entry.id ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {undoingId === entry.id ? (
                        <><Loader2 size={13} className="animate-spin" /> Desfazendo...</>
                      ) : (
                        <><Undo2 size={13} /> Desfazer</>
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
