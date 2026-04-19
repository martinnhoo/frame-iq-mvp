import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Undo2, Check, X, RotateCcw, Loader2, Pause, Play, TrendingUp, TrendingDown, Copy, Zap, Calendar, Filter, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { DESIGN_TOKENS as DT } from '@/hooks/useDesignTokens';

// ── Design tokens — matching AccountsPage ────────────────────────────────────
const F = DT.font;
const EASE = 'cubic-bezier(0.4,0,0.2,1)';

const BLUE   = '#2563EB';
const CYAN   = '#06B6D4';
const GREEN  = '#22C55E';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

const BG0 = '#060A14';
const BG1 = '#0A0F1C';
const BG2 = '#0F172A';
const BG3 = '#1E293B';

const B0 = 'rgba(148,163,184,0.04)';
const B1 = 'rgba(148,163,184,0.08)';
const B2 = 'rgba(148,163,184,0.14)';

const T1 = '#F1F5F9';
const T2 = '#94A3B8';
const T3 = '#64748B';
const TL = '#475569';

const CARD  = 'rgba(15,23,42,0.80)';
const SHD   = `0 0 0 1px ${B1}, 0 8px 32px rgba(0,0,0,0.40)`;
const GLASS = 'blur(16px) saturate(180%)';

const BTN_SECONDARY = {
  background: 'rgba(30,41,59,0.80)', border: `1px solid ${B2}`,
  color: T2, cursor: 'pointer',
  fontFamily: F, fontWeight: 600 as const,
  backdropFilter: 'blur(8px)',
  transition: `all 0.2s ${EASE}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Date filter presets ───────────────────────────────────────────────────────
type DatePreset = 'all' | 'today' | '7d' | '30d';
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

// ── Action type filter options ────────────────────────────────────────────────
type ActionFilter = 'all' | 'pause' | 'reactivate' | 'budget' | 'duplicate' | 'creative';
const ACTION_FILTERS: { key: ActionFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Todas', color: T2 },
  { key: 'pause', label: 'Pausas', color: '#f87171' },
  { key: 'reactivate', label: 'Reativações', color: '#34d399' },
  { key: 'budget', label: 'Budget', color: '#fbbf24' },
  { key: 'duplicate', label: 'Duplicações', color: '#60a5fa' },
  { key: 'creative', label: 'Criativos', color: CYAN },
];

// ── Action icon ───────────────────────────────────────────────────────────────
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
  return T3;
}

function matchesActionFilter(type: string, filter: ActionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pause') return type.includes('pause');
  if (filter === 'reactivate') return type.includes('reactivate');
  if (filter === 'budget') return type.includes('budget');
  if (filter === 'duplicate') return type.includes('duplicate');
  if (filter === 'creative') return type.includes('hook') || type.includes('variation');
  return false;
}

function matchesDateFilter(dateStr: string, preset: DatePreset): boolean {
  if (preset === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (preset === 'today') return d.toDateString() === now.toDateString();
  if (preset === '7d') return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  if (preset === '30d') return now.getTime() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const HistoryPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean }>();
  const { activeAccount } = ctx;
  const accountId = activeAccount?.id ?? null;

  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DatePreset>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');

  const loadHistory = useCallback(async () => {
    if (!accountId) { setHistory([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('action_log' as any)
        .select('*')
        .eq('account_id', accountId)
        .order('executed_at', { ascending: false })
        .limit(100) as any);
      if (error) throw error;
      setHistory((data || []) as ActionLogEntry[]);
    } catch (err) {
      console.error('[HistoryPage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const handler = () => { loadHistory(); };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, [loadHistory]);

  // ── Filtered list ──
  const filtered = useMemo(() =>
    history.filter(h =>
      matchesDateFilter(h.executed_at, dateFilter) &&
      matchesActionFilter(h.action_type, actionFilter)
    ),
  [history, dateFilter, actionFilter]);

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
      toast.success('Ação revertida pela IA');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao reverter');
    } finally {
      setUndoingId(null);
    }
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      pause_ad: 'Anúncio pausado pela IA',
      pause_adset: 'Conjunto pausado pela IA',
      pause_campaign: 'Campanha pausada pela IA',
      reactivate_ad: 'Anúncio reativado pela IA',
      reactivate_adset: 'Conjunto reativado pela IA',
      reactivate_campaign: 'Campanha reativada pela IA',
      increase_budget: 'Budget aumentado pela IA',
      decrease_budget: 'Budget reduzido pela IA',
      duplicate_ad: 'Anúncio duplicado',
      duplicate_campaign: 'Campanha duplicada',
      generate_hook: 'Hook gerado pela IA',
      generate_variation: 'Variação criativa gerada',
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
      case 'success': return { icon: <Check size={11} strokeWidth={2.5} />, label: 'Executado', color: GREEN, bg: `${GREEN}12`, border: `${GREEN}25` };
      case 'error': return { icon: <X size={11} strokeWidth={2.5} />, label: 'Erro', color: RED, bg: `${RED}12`, border: `${RED}25` };
      case 'rolled_back': return { icon: <RotateCcw size={11} strokeWidth={2.5} />, label: 'Revertido', color: AMBER, bg: `${AMBER}12`, border: `${AMBER}25` };
      default: return { icon: <Loader2 size={11} className="animate-spin" />, label: 'Pendente', color: T3, bg: B0, border: B1 };
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

  // ── Stats ──
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

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ maxWidth: 740, margin: '0 auto', padding: 'clamp(16px,4vw,40px)', fontFamily: F }}>
        <div style={{ height: 28, width: '40%', background: B0, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 16, width: '60%', background: B0, borderRadius: 4, marginBottom: 28 }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: CARD, borderRadius: 14, border: `1px solid ${B1}`,
            padding: 18, marginBottom: 10,
          }}>
            <div style={{ width: '35%', height: 14, background: B0, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ width: '55%', height: 12, background: B0, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: 'clamp(16px,4vw,40px)', fontFamily: F }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .hist-card{transition:all 0.2s ${EASE}}
        .hist-card:hover{border-color:rgba(148,163,184,0.16) !important;transform:translateY(-1px)}
        .hist-btn{transition:all 0.15s ${EASE}}
        .hist-btn:hover{transform:translateY(-1px)}
        .hist-btn:active{transform:scale(0.97)}
        .filter-chip{transition:all 0.15s ${EASE}}
        .filter-chip:hover{background:rgba(148,163,184,0.08) !important}
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T1, letterSpacing: '-0.04em', lineHeight: 1.2 }}>
          Decisões da IA
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: T3, lineHeight: 1.5 }}>
          Tudo que a IA fez com seu dinheiro — cada ação, cada resultado.
        </p>
      </div>

      {/* ── Stats row ── */}
      {history.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Economizado pela IA', value: formatCurrency(totalSaved), color: totalSaved > 0 ? GREEN : T2 },
            { label: 'Ações este mês', value: String(actionsThisMonth), color: T1 },
            { label: 'Taxa de sucesso', value: history.length > 0 ? `${Math.round((successCount / history.length) * 100)}%` : '—', color: T1 },
          ].map((stat, i) => (
            <div key={i} style={{
              background: CARD, border: `1px solid ${B1}`,
              borderRadius: 12, padding: '14px 16px',
              backdropFilter: GLASS,
            }}>
              <p style={{
                fontSize: 10, fontWeight: 600, color: TL,
                textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
              }}>
                {stat.label}
              </p>
              <p style={{
                fontSize: 22, fontWeight: 800, color: stat.color,
                fontVariant: 'tabular-nums', letterSpacing: '-0.03em', margin: 0,
              }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
        flexWrap: 'wrap',
      }}>
        {/* Date filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={13} color={T3} style={{ marginRight: 2 }} />
          {DATE_PRESETS.map(p => {
            const sel = dateFilter === p.key;
            return (
              <button key={p.key} className="filter-chip"
                onClick={() => setDateFilter(p.key)}
                style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  fontFamily: F, cursor: 'pointer', border: 'none',
                  background: sel ? `${BLUE}18` : 'transparent',
                  color: sel ? '#60A5FA' : T3,
                  transition: `all 0.15s ${EASE}`,
                }}>
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 20, background: B2, flexShrink: 0 }} />

        {/* Action type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flexShrink: 1, minWidth: 0 }}>
          <Filter size={13} color={T3} style={{ marginRight: 2, flexShrink: 0 }} />
          {ACTION_FILTERS.map(af => {
            const sel = actionFilter === af.key;
            return (
              <button key={af.key} className="filter-chip"
                onClick={() => setActionFilter(af.key)}
                style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                  fontFamily: F, cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                  background: sel ? `${af.color}18` : 'transparent',
                  color: sel ? af.color : T3,
                  transition: `all 0.15s ${EASE}`,
                }}>
                {af.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 32px', borderRadius: 16,
          background: CARD, border: `1px solid ${B1}`,
          boxShadow: SHD, backdropFilter: GLASS,
          animation: 'fadeUp 0.3s ease',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.08))`,
            border: `1px solid ${B1}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', color: T3,
          }}>
            <Zap size={22} />
          </div>
          {history.length === 0 ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                A IA ainda não tomou nenhuma decisão
              </p>
              <p style={{ fontSize: 13, color: T3, margin: 0, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Quando a IA pausar anúncios ruins, ajustar budgets ou otimizar campanhas, cada decisão aparece aqui com o resultado.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 700, color: T1, margin: '0 0 6px' }}>
                Nenhuma decisão neste filtro
              </p>
              <p style={{ fontSize: 13, color: T3, margin: 0 }}>
                Tente outro período ou tipo de ação.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Action list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(entry => {
          const status = getStatusConfig(entry.result);
          const actionColor = getActionColor(entry.action_type);
          const canRollback = entry.decision_id
            && entry.rollback_available
            && entry.result === 'success'
            && (!entry.rollback_expires_at || new Date(entry.rollback_expires_at) > new Date());

          return (
            <div key={entry.id} className="hist-card" style={{
              background: CARD, border: `1px solid ${B1}`,
              borderRadius: 14, padding: '16px 18px',
              backdropFilter: GLASS,
              transition: `all 0.2s ${EASE}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Action icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
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
                      fontSize: 14, fontWeight: 600, color: T1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      letterSpacing: '-0.01em',
                    }}>
                      {entry.target_name || entry.target_meta_id}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      background: status.bg, color: status.color,
                      border: `1px solid ${status.border}`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      flexShrink: 0, letterSpacing: '0.02em',
                    }}>
                      {status.icon} {status.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 12, color: T3, margin: 0 }}>
                    {getActionLabel(entry.action_type)}
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
                    <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                      {entry.estimated_daily_impact ? (
                        <div>
                          <span style={{ fontSize: 10, color: TL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Estimado/dia
                          </span>
                          <p style={{ fontSize: 13, fontWeight: 700, color: T2, fontVariant: 'tabular-nums', margin: '2px 0 0' }}>
                            {formatCurrency(entry.estimated_daily_impact)}
                          </p>
                        </div>
                      ) : null}
                      {entry.actual_impact_48h ? (
                        <div>
                          <span style={{ fontSize: 10, color: TL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Real 48h {entry.validated_at && <Check size={9} style={{ display: 'inline', verticalAlign: 'middle', color: GREEN }} />}
                          </span>
                          <p style={{ fontSize: 13, fontWeight: 700, color: GREEN, fontVariant: 'tabular-nums', margin: '2px 0 0' }}>
                            {formatCurrency(entry.actual_impact_48h)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Error message */}
                  {entry.error_message && (
                    <p style={{ fontSize: 11, color: RED, margin: '6px 0 0', lineHeight: 1.4 }}>
                      {entry.error_message}
                    </p>
                  )}
                </div>

                {/* Undo button */}
                {canRollback && (
                  <button className="hist-btn"
                    onClick={() => handleUndo(entry)}
                    disabled={undoingId === entry.id}
                    style={{
                      ...BTN_SECONDARY,
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 12px', borderRadius: 8, fontSize: 11,
                      opacity: undoingId === entry.id ? 0.5 : 1,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(30,41,59,1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(30,41,59,0.80)'; }}
                  >
                    {undoingId === entry.id ? (
                      <><Loader2 size={12} className="animate-spin" /> Revertendo...</>
                    ) : (
                      <><Undo2 size={12} /> Reverter</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter result count */}
      {history.length > 0 && (dateFilter !== 'all' || actionFilter !== 'all') && (
        <p style={{ fontFamily: F, fontSize: 11, color: TL, margin: '14px 0 0', textAlign: 'center' }}>
          {filtered.length} de {history.length} decisões
        </p>
      )}
    </div>
  );
};

export default HistoryPage;
