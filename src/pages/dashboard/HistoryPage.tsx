import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Undo2, Check, X, RotateCcw, Loader2, CircleSlash, CirclePlay, ArrowUpRight, ArrowDownRight, CopyPlus, Sparkles, Calendar, Filter, ChevronDown, Zap, Hand, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { DESIGN_TOKENS as DT } from '@/hooks/useDesignTokens';
import { storage } from '@/lib/storage';

// ── Design tokens — matching AccountsPage ────────────────────────────────────
const F = DT.font;
const EASE = 'cubic-bezier(0.4,0,0.2,1)';

const BLUE   = '#2563EB';
const CYAN   = '#06B6D4';
const GREEN  = '#10B981';
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

// ── Source filter (IA vs Manual) ─────────────────────────────────────────────
// Distinguishes decisions taken by the Feed's AI engine (through
// execute-action) from actions the user ran directly in the Manager
// (tagged with source='manager_manual' in action_log.new_state._source).
type SourceFilter = 'all' | 'ai' | 'manual';

/** Extract the origin of an action log entry. Defaults to 'ai' since
 *  the engine is the primary source — manual has to be opted into via
 *  source='manager_manual'. */
function getEntrySource(entry: ActionLogEntry): 'ai' | 'manual' {
  const src = (entry as any)?.new_state?._source;
  if (src === 'manager_manual' || src === 'manual') return 'manual';
  return 'ai';
}

// ── Action icon ───────────────────────────────────────────────────────────────
function ActionIcon({ type }: { type: string }) {
  const size = 16;
  const common = { strokeWidth: 2.2 };
  if (type.includes('pause')) return <CircleSlash size={size} {...common} />;
  if (type.includes('reactivate')) return <CirclePlay size={size} {...common} />;
  if (type.includes('increase')) return <ArrowUpRight size={size} {...common} />;
  if (type.includes('decrease')) return <ArrowDownRight size={size} {...common} />;
  if (type.includes('duplicate')) return <CopyPlus size={size} {...common} />;
  return <Sparkles size={size} {...common} />;
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
  const ctx = useOutletContext<DashboardContext>();
  const { selectedPersona } = ctx;

  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DatePreset>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  // Force re-read of localStorage when Meta account changes
  const [accTick, setAccTick] = useState(0);
  const metaSelId = React.useMemo(() => {
    void accTick;
    return selectedPersona?.id
      ? (storage.get(`meta_sel_${selectedPersona.id}`, "") || null)
      : null;
  }, [selectedPersona?.id, accTick]);

  // Resolve meta ID (act_...) → Supabase UUID for DB queries
  const [liveAccountId, setLiveAccountId] = useState<string | null>(null);
  React.useEffect(() => {
    if (!metaSelId) { setLiveAccountId(null); return; }
    if (!metaSelId.startsWith('act_')) { setLiveAccountId(metaSelId); return; }
    supabase.from("ad_accounts").select("id").eq("meta_account_id", metaSelId).maybeSingle()
      .then(({ data }) => setLiveAccountId(data?.id ?? null));
  }, [metaSelId]);

  // Cursor pagination — accounts with 5k+ history rows need "carregar
  // mais" instead of seeing only the top 100. `cursor` is the oldest
  // executed_at we've already loaded; next page fetches rows strictly
  // older than that timestamp.
  const PAGE_SIZE = 100;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = React.useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    const aid = liveAccountId;
    if (!aid) { setHistory([]); setLoading(false); return; }
    try {
      setLoading(true);
      cursorRef.current = null;
      const { data, error } = await (supabase
        .from('action_log' as any)
        .select('*')
        .eq('account_id', aid)
        .order('executed_at', { ascending: false })
        .limit(PAGE_SIZE + 1) as any); // +1 to know if there's more
      if (error) throw error;
      const rows = (data || []) as ActionLogEntry[];
      const more = rows.length > PAGE_SIZE;
      const page = rows.slice(0, PAGE_SIZE);
      setHistory(page);
      setHasMore(more);
      if (page.length > 0) cursorRef.current = page[page.length - 1].executed_at as any;
    } catch (err) {
      console.error('[HistoryPage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [liveAccountId]);

  const loadMore = useCallback(async () => {
    const aid = liveAccountId;
    if (!aid || !cursorRef.current || loadingMore) return;
    try {
      setLoadingMore(true);
      const { data, error } = await (supabase
        .from('action_log' as any)
        .select('*')
        .eq('account_id', aid)
        .lt('executed_at', cursorRef.current)
        .order('executed_at', { ascending: false })
        .limit(PAGE_SIZE + 1) as any);
      if (error) throw error;
      const rows = (data || []) as ActionLogEntry[];
      const more = rows.length > PAGE_SIZE;
      const page = rows.slice(0, PAGE_SIZE);
      setHistory(prev => [...prev, ...page]);
      setHasMore(more);
      if (page.length > 0) cursorRef.current = page[page.length - 1].executed_at as any;
      else setHasMore(false);
    } catch (err) {
      console.error('[HistoryPage] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [liveAccountId, loadingMore]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const handler = () => { setAccTick(t => t + 1); };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, []);

  // ── Filtered list ──
  const filtered = useMemo(() =>
    history.filter(h => {
      if (!matchesDateFilter(h.executed_at, dateFilter)) return false;
      if (!matchesActionFilter(h.action_type, actionFilter)) return false;
      if (sourceFilter !== 'all' && getEntrySource(h) !== sourceFilter) return false;
      return true;
    }),
  [history, dateFilter, actionFilter, sourceFilter]);

  // Counts for the source toggle — shown inline so the user knows before
  // clicking how the split looks. Computed against the date+action-filtered
  // set so the numbers make sense with other filters already applied.
  const sourceCounts = useMemo(() => {
    const aiOrManual = history.filter(h =>
      matchesDateFilter(h.executed_at, dateFilter) &&
      matchesActionFilter(h.action_type, actionFilter),
    );
    const ai = aiOrManual.filter(h => getEntrySource(h) === 'ai').length;
    const manual = aiOrManual.filter(h => getEntrySource(h) === 'manual').length;
    return { all: aiOrManual.length, ai, manual };
  }, [history, dateFilter, actionFilter]);

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

  const getActionLabel = (type: string, source: 'ai' | 'manual' = 'ai') => {
    const suffix = source === 'ai' ? ' pela IA' : '';
    const labels: Record<string, string> = {
      pause_ad: `Anúncio pausado${suffix}`,
      pause_adset: `Conjunto pausado${suffix}`,
      pause_campaign: `Campanha pausada${suffix}`,
      reactivate_ad: `Anúncio reativado${suffix}`,
      reactivate_adset: `Conjunto reativado${suffix}`,
      reactivate_campaign: `Campanha reativada${suffix}`,
      enable_ad: `Anúncio ativado${suffix}`,
      enable_adset: `Conjunto ativado${suffix}`,
      enable_campaign: `Campanha ativada${suffix}`,
      increase_budget: `Budget aumentado${suffix}`,
      decrease_budget: `Budget reduzido${suffix}`,
      change_budget: `Budget alterado${suffix}`,
      update_budget_campaign: `Budget ajustado${suffix}`,
      update_budget_adset: `Budget ajustado${suffix}`,
      duplicate_ad: 'Anúncio duplicado',
      duplicate_campaign: 'Campanha duplicada',
      duplicate_adset: 'Conjunto duplicado',
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
          Histórico de ações
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: T3, lineHeight: 1.5 }}>
          Cada movimento na sua conta — IA e manual — com valor, resultado e contexto.
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
                fontSize: 11, fontWeight: 600, color: T2,
                textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px',
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

      {/* ── Source filter — "IA vs Manual" segmented toggle ──
          Sits below the main filter bar with breathing room so it reads
          as a distinct dimension (origem da ação) rather than a chip in
          the same family. Elevated card shell + gradient-lit selection
          matches the glassmorphism of the rest of the page. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 20, flexWrap: 'wrap' as const,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: TL,
          letterSpacing: '0.10em', textTransform: 'uppercase' as const,
          flexShrink: 0,
        }}>
          Origem
        </span>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: CARD, border: `1px solid ${B1}`,
          borderRadius: 10, padding: 3, boxShadow: SHD,
          backdropFilter: GLASS,
          gap: 2,
        }}>
          {([
            { key: 'all' as const, label: 'Todas', icon: null, color: T1, count: sourceCounts.all },
            { key: 'ai' as const, label: 'IA', icon: <Bot size={11.5} strokeWidth={2.3} />, color: BLUE, count: sourceCounts.ai },
            { key: 'manual' as const, label: 'Manual', icon: <Hand size={11} strokeWidth={2.3} />, color: AMBER, count: sourceCounts.manual },
          ]).map(opt => {
            const sel = sourceFilter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSourceFilter(opt.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7,
                  fontSize: 11.5, fontWeight: 600, fontFamily: F,
                  cursor: 'pointer', border: 'none',
                  background: sel
                    ? opt.key === 'ai'
                      ? 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(6,182,212,0.14))'
                      : opt.key === 'manual'
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(239,68,68,0.08))'
                        : 'rgba(148,163,184,0.12)'
                    : 'transparent',
                  color: sel ? opt.color : T3,
                  boxShadow: sel ? `inset 0 0 0 1px ${opt.color}30` : 'none',
                  transition: `all 0.18s ${EASE}`,
                  letterSpacing: '0.01em',
                }}
              >
                {opt.icon}
                <span>{opt.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: sel ? opt.color : TL,
                  fontVariantNumeric: 'tabular-nums' as const,
                  opacity: sel ? 0.9 : 0.7,
                  marginLeft: 2,
                }}>
                  {opt.count}
                </span>
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
          animation: 'fadeUp 0.25s ease both',
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
          const source = getEntrySource(entry);
          const sourceTint = source === 'ai' ? BLUE : AMBER;
          const canRollback = entry.decision_id
            && entry.rollback_available
            && entry.result === 'success'
            && (!entry.rollback_expires_at || new Date(entry.rollback_expires_at) > new Date());

          return (
            <div key={entry.id} className="hist-card" style={{
              // Subtle left-edge accent in the source color — readable at a
              // glance without adding chrome. IA = blue, Manual = amber.
              background: CARD, border: `1px solid ${B1}`,
              borderLeft: `2px solid ${sourceTint}55`,
              borderRadius: 14, padding: '16px 18px',
              backdropFilter: GLASS,
              transition: `all 0.2s ${EASE}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Action icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${actionColor}14`,
                  border: `1px solid ${actionColor}28`,
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
                    {/* Source badge — IA (gradient blue+cyan) or Manual
                        (gradient amber). Tiny, premium, immediately parseable. */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      color: source === 'ai' ? '#93C5FD' : '#FCD34D',
                      background: source === 'ai'
                        ? 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(6,182,212,0.10))'
                        : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.08))',
                      border: `1px solid ${sourceTint}33`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      flexShrink: 0, letterSpacing: '0.03em',
                      textTransform: 'uppercase' as const,
                    }}>
                      {source === 'ai' ? <Bot size={9} strokeWidth={2.5} /> : <Hand size={9} strokeWidth={2.5} />}
                      {source === 'ai' ? 'IA' : 'Manual'}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 12, color: T3, margin: 0 }}>
                    {getActionLabel(entry.action_type, source)}
                    {/* Budget diff — covers both the new schema
                        (budget_change) AND the enriched daily_budget
                        diff emitted by Gerenciador manual since the
                        preview-first flow. */}
                    {(entry.action_type === 'increase_budget'
                      || entry.action_type === 'decrease_budget'
                      || entry.action_type === 'change_budget') &&
                      (entry as any).new_state?.budget_change ? (() => {
                        const bc = (entry as any).new_state.budget_change;
                        const fromVal = (bc.from / 100).toFixed(2).replace('.', ',');
                        const toVal = (bc.to / 100).toFixed(2).replace('.', ',');
                        return ` · R$ ${fromVal} → R$ ${toVal} (${bc.change_pct > 0 ? '+' : ''}${bc.change_pct}%)`;
                      })() : (entry.action_type === 'increase_budget'
                        || entry.action_type === 'decrease_budget'
                        || entry.action_type === 'change_budget') &&
                        (entry as any).previous_state?.daily_budget && (entry as any).new_state?.daily_budget ? (() => {
                          const oldC = Number((entry as any).previous_state.daily_budget);
                          const newC = Number((entry as any).new_state.daily_budget);
                          const fromVal = (oldC / 100).toFixed(2).replace('.', ',');
                          const toVal = (newC / 100).toFixed(2).replace('.', ',');
                          const pct = oldC > 0 ? Math.round(((newC - oldC) / oldC) * 100) : 0;
                          return ` · R$ ${fromVal} → R$ ${toVal}${pct ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}`;
                        })() : null}
                    {entry.target_type && ` · ${getTargetLabel(entry.target_type)}`}
                    {' · '}{formatDate(entry.executed_at)}
                  </p>

                  {/* AI reasoning — the Preview-panel analysis shown to
                      the user BEFORE they confirmed. This is what turns
                      History from an event log into a story. Only shown
                      if present so older rows stay clean. */}
                  {(entry as any).new_state?._ai_reasoning && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(37,99,235,0.18)',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(6,182,212,0.03))',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <Bot size={11} strokeWidth={2.5} style={{ color: '#93C5FD', marginTop: 2, flexShrink: 0 }} />
                      <p style={{
                        fontSize: 11.5, color: T2, margin: 0,
                        lineHeight: 1.5, letterSpacing: '-0.005em',
                        fontFamily: F,
                      }}>
                        {String((entry as any).new_state._ai_reasoning)}
                      </p>
                    </div>
                  )}

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

      {/* Carregar mais — only shows when there are more rows on the
          server than what's currently loaded. Uses cursor pagination
          (executed_at < last loaded) so it works even if the account
          has 10k+ history entries without any offset performance hit. */}
      {hasMore && history.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(148,163,184,0.18)',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 12, fontWeight: 700,
              color: loadingMore ? TL : T2,
              cursor: loadingMore ? 'default' : 'pointer',
              fontFamily: F, letterSpacing: '-0.005em',
              transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              if (loadingMore) return;
              (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)';
              (e.currentTarget as HTMLElement).style.color = T1;
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.28)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = T2;
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.18)';
            }}
          >
            {loadingMore ? 'Carregando…' : `Carregar mais 100 ações →`}
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
