/**
 * CampaignsManager — full Ads Manager-style tree view (campaign → adset → ad).
 *
 * Access rules:
 *  - Only reachable from the Feed page via `navigate('/dashboard/feed/campanhas',
 *    { state: { fromFeed: true } })`. Deep-links or direct URL entry redirect
 *    back to the Feed.
 *
 * Features:
 *  - Tree view: campaign → adset → ad (lazy load per level).
 *  - Pause/activate on all 3 levels.
 *  - Inline daily_budget edit on campaigns + adsets.
 *  - Duplicate on all 3 levels (copy is always paused).
 *  - After every action, the Estrategista (Haiku) drops a real analysis
 *    comment based on 30d + 7d Meta insights for that specific object.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import {
  ChevronRight, ChevronDown, ArrowLeft, Layers, Target, Sparkles,
  Pause, Play, Loader2, Copy, Check, X, Pencil, Search, ExternalLink,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;                 // meta campaign id
  name: string;
  status: string;
  effective_status?: string;
  daily_budget?: number | null;  // centavos
  lifetime_budget?: number | null;
  objective?: string | null;
}
interface AdSet {
  id: string;                 // meta adset id
  name: string;
  campaign_id: string;
  status: string;
  effective_status?: string;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
}
interface Ad {
  id: string;                 // meta ad id
  name: string;
  adset_id: string;
  campaign_id?: string;
  status: string;
  effective_status?: string;
}

type TargetType = 'campaign' | 'adset' | 'ad';
type ActionKind = 'pause' | 'activate';

interface ActionFeedback {
  // Keyed by target_id
  inflight?: boolean;        // action being executed
  analyzing?: boolean;       // AI analysis being generated
  comment?: string;          // AI comment (final)
  error?: string;            // error message
  timestamp?: number;        // for staleness
}

// ── Design tokens (match FeedPage) ────────────────────────────────────────
const T = {
  bg0: '#06080C', bg1: 'rgba(255,255,255,0.02)', bg2: 'rgba(255,255,255,0.04)', bg3: 'rgba(255,255,255,0.06)',
  text1: 'rgba(255,255,255,0.95)', text2: 'rgba(255,255,255,0.65)', text3: 'rgba(255,255,255,0.40)',
  border0: 'rgba(255,255,255,0.05)', border1: 'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.12)',
  green: '#4ADE80', red: '#F87171', yellow: '#FBBF24', blue: '#0EA5E9', purple: '#A78BFA',
  labelColor: 'rgba(255,255,255,0.45)',
};
const F = 'system-ui, -apple-system, "SF Pro Display", sans-serif';

// ── Helpers ───────────────────────────────────────────────────────────────
function statusColor(s: string | undefined): { color: string; dot: string; label: string } {
  const u = (s || '').toUpperCase();
  if (u === 'ACTIVE') return { color: T.green, dot: 'rgba(74,222,128,0.50)', label: 'Ativo' };
  if (u === 'PAUSED' || u === 'CAMPAIGN_PAUSED' || u === 'ADSET_PAUSED')
    return { color: T.text2, dot: 'rgba(255,255,255,0.35)', label: 'Pausado' };
  if (u === 'LEARNING' || u === 'IN_PROCESS' || u === 'PENDING_REVIEW')
    return { color: T.yellow, dot: 'rgba(251,191,36,0.45)', label: 'Aprendizado' };
  if (u === 'DISAPPROVED' || u === 'WITH_ISSUES') return { color: T.red, dot: 'rgba(248,113,113,0.50)', label: 'Problema' };
  if (u === 'ARCHIVED' || u === 'DELETED') return { color: T.text3, dot: 'rgba(255,255,255,0.20)', label: 'Arquivado' };
  return { color: T.text2, dot: 'rgba(255,255,255,0.30)', label: u || '—' };
}

function isPausedStatus(s: string | undefined): boolean {
  const u = (s || '').toUpperCase();
  return u === 'PAUSED' || u === 'CAMPAIGN_PAUSED' || u === 'ADSET_PAUSED';
}

function fmtBudget(cents: number | null | undefined): string {
  if (!cents) return '—';
  const reais = cents / 100;
  return `R$ ${reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia`;
}

// ── Small component: the pause/activate button shown on each row ──────────
function ActionButton({
  kind,
  onClick,
  inflight,
  size = 'md',
}: {
  kind: ActionKind;
  onClick: (e: React.MouseEvent) => void;
  inflight: boolean;
  size?: 'md' | 'sm';
}) {
  const isPause = kind === 'pause';
  const iconSize = size === 'sm' ? 10 : 12;
  const paddingV = size === 'sm' ? 3 : 4;
  const paddingH = size === 'sm' ? 7 : 9;
  const fontSize = size === 'sm' ? 9.5 : 10.5;
  const color = isPause ? T.text2 : T.green;
  const bg = isPause ? 'rgba(255,255,255,0.04)' : 'rgba(74,222,128,0.08)';
  const border = isPause ? 'rgba(255,255,255,0.10)' : 'rgba(74,222,128,0.22)';
  return (
    <button
      onClick={onClick}
      disabled={inflight}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: bg, color,
        border: `1px solid ${border}`,
        borderRadius: 5,
        padding: `${paddingV}px ${paddingH}px`,
        fontSize, fontWeight: 600, fontFamily: F,
        cursor: inflight ? 'default' : 'pointer',
        opacity: inflight ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => {
        if (inflight) return;
        e.currentTarget.style.background = isPause ? 'rgba(255,255,255,0.08)' : 'rgba(74,222,128,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
      }}
      title={isPause ? 'Pausar' : 'Ativar'}
    >
      {inflight
        ? <Loader2 size={iconSize} className="spin" />
        : isPause
          ? <Pause size={iconSize} />
          : <Play size={iconSize} />
      }
      {isPause ? 'Pausar' : 'Ativar'}
    </button>
  );
}

// ── Small component: duplicate button ─────────────────────────────────────
function DuplicateButton({
  onClick,
  inflight,
  size = 'md',
}: {
  onClick: (e: React.MouseEvent) => void;
  inflight: boolean;
  size?: 'md' | 'sm';
}) {
  const iconSize = size === 'sm' ? 10 : 12;
  const paddingV = size === 'sm' ? 3 : 4;
  const paddingH = size === 'sm' ? 7 : 9;
  const fontSize = size === 'sm' ? 9.5 : 10.5;
  return (
    <button
      onClick={onClick}
      disabled={inflight}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'rgba(14,165,233,0.06)', color: T.blue,
        border: `1px solid rgba(14,165,233,0.22)`,
        borderRadius: 5,
        padding: `${paddingV}px ${paddingH}px`,
        fontSize, fontWeight: 600, fontFamily: F,
        cursor: inflight ? 'default' : 'pointer',
        opacity: inflight ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => {
        if (inflight) return;
        e.currentTarget.style.background = 'rgba(14,165,233,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(14,165,233,0.06)';
      }}
      title="Duplicar (pausado)"
    >
      {inflight ? <Loader2 size={iconSize} className="spin" /> : <Copy size={iconSize} />}
      Duplicar
    </button>
  );
}

// ── Small component: inline editable budget ───────────────────────────────
function BudgetInlineEdit({
  cents,
  onSave,
  saving,
  size = 'md',
}: {
  cents: number | null | undefined;
  onSave: (newCents: number) => void;
  saving: boolean;
  size?: 'md' | 'sm';
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fontSize = size === 'sm' ? 10 : 10;

  useEffect(() => {
    if (editing) {
      // Preload current budget in reais
      const reais = cents ? (cents / 100) : 0;
      setValue(reais ? reais.toFixed(2).replace('.', ',') : '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, cents]);

  const commit = () => {
    const raw = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const reais = parseFloat(raw);
    if (isNaN(reais) || reais <= 0) {
      setEditing(false);
      return;
    }
    const newCents = Math.round(reais * 100);
    if (newCents === (cents || 0)) {
      setEditing(false);
      return;
    }
    onSave(newCents);
    setEditing(false);
  };

  if (!editing) {
    const display = cents
      ? `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/dia`
      : '—';
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!cents) return; // can't edit if no daily_budget (CBO)
          setEditing(true);
        }}
        disabled={saving || !cents}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'transparent', border: 'none',
          fontSize, color: T.text3, fontWeight: 600,
          letterSpacing: '0.04em', fontFamily: F,
          cursor: cents ? 'pointer' : 'default', padding: '2px 4px',
          borderRadius: 4,
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!cents) return;
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = T.text2;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = T.text3;
        }}
        title={cents ? 'Clique para editar orçamento diário' : 'Orçamento gerenciado pela campanha (CBO)'}
      >
        {saving ? <Loader2 size={10} className="spin" /> : cents ? <Pencil size={9} style={{ opacity: 0.6 }} /> : null}
        {display}
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
      <span style={{ fontSize: 10, color: T.text3 }}>R$</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={commit}
        style={{
          width: 70, fontSize: 11, fontFamily: F,
          background: T.bg2, border: `1px solid ${T.border2}`, color: T.text1,
          borderRadius: 4, padding: '3px 6px', outline: 'none',
        }}
        inputMode="decimal"
      />
      <span style={{ fontSize: 9.5, color: T.text3 }}>/dia</span>
      <button
        onClick={(e) => { e.stopPropagation(); commit(); }}
        style={{ background: 'rgba(74,222,128,0.12)', border: `1px solid rgba(74,222,128,0.3)`, borderRadius: 4, padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <Check size={10} style={{ color: T.green }} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(false); }}
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border1}`, borderRadius: 4, padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <X size={10} style={{ color: T.text3 }} />
      </button>
    </div>
  );
}

// ── Small component: the inline AI comment box ────────────────────────────
function InlineComment({ feedback, indent }: { feedback: ActionFeedback | undefined; indent: number }) {
  if (!feedback) return null;
  if (feedback.analyzing) {
    return (
      <div style={{
        padding: `8px 16px 10px ${indent}px`,
        fontSize: 11, color: T.text3,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(167,139,250,0.04)', borderTop: `1px solid ${T.border0}`,
      }}>
        <Loader2 size={11} className="spin" style={{ color: T.purple }} />
        Estrategista analisando 30 dias de performance…
      </div>
    );
  }
  if (feedback.error) {
    return (
      <div style={{
        padding: `8px 16px 10px ${indent}px`,
        fontSize: 11, color: T.red,
        background: 'rgba(248,113,113,0.04)',
        borderTop: `1px solid ${T.border0}`,
      }}>
        Ação falhou: {feedback.error}
      </div>
    );
  }
  if (feedback.comment) {
    return (
      <div style={{
        padding: `10px 16px 12px ${indent}px`,
        fontSize: 11.5, lineHeight: 1.5, color: T.text2,
        background: 'rgba(167,139,250,0.05)',
        borderTop: `1px solid ${T.border0}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Sparkles size={11} style={{ color: T.purple }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: T.purple, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Estrategista
          </span>
        </div>
        <div>{feedback.comment}</div>
      </div>
    );
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export default function CampaignsManager() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Access guard ────────────────────────────────────────────────────────
  useEffect(() => {
    const state = location.state as { fromFeed?: boolean } | null;
    if (!state?.fromFeed) {
      navigate('/dashboard/feed', { replace: true });
    }
  }, [location.state, navigate]);

  // ── Session state — sourced from the Dashboard outlet context ──────────
  // Using useOutletContext guarantees we share the same user/persona/account
  // resolution as the rest of the dashboard (FeedPage, PerformancePanel, etc.)
  // and prevents multi-persona maybeSingle() crashes.
  const ctx = useOutletContext<DashboardContext & { activeAccount?: { metaAccountId?: string } | null; metaConnected?: boolean }>();
  const userId = ctx?.user?.id as string | undefined;
  const personaId = ctx?.selectedPersona?.id as string | undefined;
  const accountId = ctx?.activeAccount?.metaAccountId || null;
  const metaConnected = !!ctx?.metaConnected;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsetsByCampaign, setAdsetsByCampaign] = useState<Record<string, AdSet[]>>({});
  const [adsByAdset, setAdsByAdset] = useState<Record<string, Ad[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<Record<string, boolean>>({});
  const [loadingAds, setLoadingAds] = useState<Record<string, boolean>>({});
  // Per-campaign / per-adset error state so we can show an inline
  // "falha ao carregar" message instead of pretending everything loaded
  // fine when Meta returned an error body.
  const [adsetErrors, setAdsetErrors] = useState<Record<string, string>>({});
  const [adErrors, setAdErrors] = useState<Record<string, string>>({});
  // Search query — filters campaigns by name (case-insensitive). Essential
  // once agency users have 20+ campaigns and scrolling becomes painful.
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Preview-before-confirm flow ──────────────────────────────────────────
  // Every manual action (pause/activate/duplicate/budget) first opens a
  // Preview panel. The panel shows the AI's read on whether the action
  // makes sense given current context (days running, spend, conversions,
  // CPA vs goal, etc). User confirms before anything touches Meta.
  //
  // Keyed by target Meta ID. Null means "no preview open for this target".
  type ActionVerdict = 'recommend' | 'reject' | 'wait' | 'depends';
  interface PreviewData {
    loading: boolean;
    error?: string | null;
    // Request metadata
    proposedAction: 'pause' | 'activate' | 'duplicate' | 'increase_budget' | 'decrease_budget';
    proposedActionLabel: string;        // "Pausar", "Duplicar", etc
    proposedBudgetCents?: number;       // only for budget changes
    targetType: 'campaign' | 'adset' | 'ad';
    targetName: string;
    // Response
    verdict?: ActionVerdict;
    verdict_label?: string;
    headline?: string;
    reasoning?: string;
    alternatives?: string[];
    context?: {
      days_running: number;
      days_with_spend: number;
      spend_cents: number;
      clicks: number;
      conversions: number;
      cpa_cents: number | null;
      ctr: number;
      freq: number;
      status: string;
      effective_status: string;
      trend: 'up' | 'down' | 'flat' | null;
    };
    target_cpa_cents?: number | null;
    // Execution state (after user clicks Confirmar)
    executing?: boolean;
    executed?: boolean;
    executionError?: string;
  }
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  // Per-target action feedback (keyed by target_id)
  const [feedback, setFeedback] = useState<Record<string, ActionFeedback>>({});

  // ── Load campaigns ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    if (!metaConnected) {
      setLoading(false);
      return;
    }
    if (!accountId) return; // still resolving — keep the spinner
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('meta-actions', {
          body: { user_id: userId, persona_id: personaId, account_id: accountId, action: 'list_campaigns' },
        });
        if (cancelled) return;
        if (fnErr || !data || (data as any).error) {
          setError((data as any)?.error || fnErr?.message || 'Falha ao carregar campanhas');
          setCampaigns([]);
        } else {
          setCampaigns(((data as any).campaigns || []) as Campaign[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro desconhecido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, personaId, accountId, metaConnected]);

  // ── Toggle campaign expand ──────────────────────────────────────────────
  const toggleCampaign = useCallback(async (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId); else next.add(campaignId);
      return next;
    });
    if (!adsetsByCampaign[campaignId] && userId) {
      setLoadingAdsets(prev => ({ ...prev, [campaignId]: true }));
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('meta-actions', {
          body: { user_id: userId, persona_id: personaId, account_id: accountId, action: 'list_adsets', target_id: campaignId },
        });
        // Meta returns status 200 with { error: {...} } on auth/rate-limit
        // problems — surface that here so "conjuntos não aparecem" gives
        // a real error message instead of a silently empty list.
        if (fnErr || !data || (data as any).error) {
          const msg = (data as any)?.error?.message
            || (data as any)?.error
            || fnErr?.message
            || 'Falha ao carregar conjuntos';
          console.warn('[CampaignsManager] list_adsets failed:', msg);
          setAdsetErrors(prev => ({ ...prev, [campaignId]: String(msg) }));
          setAdsetsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
        } else {
          const list: AdSet[] = (((data as any).adsets) || []).map((a: any) => ({
            ...a, campaign_id: campaignId,
          }));
          setAdsetsByCampaign(prev => ({ ...prev, [campaignId]: list }));
          setAdsetErrors(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
        }
      } catch (e: any) {
        console.warn('[CampaignsManager] list_adsets threw:', e?.message);
        setAdsetErrors(prev => ({ ...prev, [campaignId]: e?.message || 'Erro de conexão' }));
        setAdsetsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
      } finally {
        setLoadingAdsets(prev => ({ ...prev, [campaignId]: false }));
      }
    }
    // Intentionally NOT depending on adsetsByCampaign — it's read-only
    // here and including it rebuilds the callback on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, personaId, accountId]);

  // ── Toggle adset expand ─────────────────────────────────────────────────
  const toggleAdset = useCallback(async (adsetId: string, campaignId: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(adsetId)) next.delete(adsetId); else next.add(adsetId);
      return next;
    });
    if (!adsByAdset[adsetId] && userId) {
      setLoadingAds(prev => ({ ...prev, [adsetId]: true }));
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('meta-actions', {
          body: { user_id: userId, persona_id: personaId, account_id: accountId, action: 'list_ads', target_id: adsetId },
        });
        if (fnErr || !data || (data as any).error) {
          const msg = (data as any)?.error?.message
            || (data as any)?.error
            || fnErr?.message
            || 'Falha ao carregar anúncios';
          console.warn('[CampaignsManager] list_ads failed:', msg);
          setAdErrors(prev => ({ ...prev, [adsetId]: String(msg) }));
          setAdsByAdset(prev => ({ ...prev, [adsetId]: [] }));
        } else {
          const list: Ad[] = (((data as any).ads) || []).map((a: any) => ({
            ...a, adset_id: adsetId, campaign_id: campaignId,
          }));
          setAdsByAdset(prev => ({ ...prev, [adsetId]: list }));
          setAdErrors(prev => { const n = { ...prev }; delete n[adsetId]; return n; });
        }
      } catch (e: any) {
        console.warn('[CampaignsManager] list_ads threw:', e?.message);
        setAdErrors(prev => ({ ...prev, [adsetId]: e?.message || 'Erro de conexão' }));
        setAdsByAdset(prev => ({ ...prev, [adsetId]: [] }));
      } finally {
        setLoadingAds(prev => ({ ...prev, [adsetId]: false }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, personaId, accountId]);

  // ── Preview flow — open AI analysis before confirming action ────────────
  // Every manual button (Pausar/Ativar/Duplicar/Ajustar budget) calls
  // requestPreview first. The Preview panel shows verdict + reasoning,
  // and only then the user confirms or cancels. Executes via the same
  // toggleStatus/updateBudget/duplicate helpers that used to fire
  // immediately — just gated behind the preview gate now.
  const requestPreview = useCallback(async (
    targetId: string,
    targetType: TargetType,
    targetName: string,
    proposedAction: 'pause' | 'activate' | 'duplicate' | 'increase_budget' | 'decrease_budget',
    proposedBudgetCents?: number,
  ) => {
    const actionLabel = proposedAction === 'pause' ? 'Pausar'
      : proposedAction === 'activate' ? 'Ativar'
      : proposedAction === 'duplicate' ? 'Duplicar'
      : 'Ajustar budget';

    setPreviews(prev => ({
      ...prev,
      [targetId]: {
        loading: true,
        error: null,
        proposedAction,
        proposedActionLabel: actionLabel,
        proposedBudgetCents,
        targetType,
        targetName,
      },
    }));

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('preview-action', {
        body: {
          user_id: userId,
          persona_id: personaId,
          target_id: targetId,
          target_type: targetType,
          proposed_action: proposedAction,
          proposed_budget_cents: proposedBudgetCents,
        },
      });
      if (fnErr || !data || (data as any).error) {
        const msg = (data as any)?.error || fnErr?.message || 'Falha ao analisar ação';
        setPreviews(prev => ({
          ...prev,
          [targetId]: { ...(prev[targetId] || {}), loading: false, error: String(msg) } as PreviewData,
        }));
        return;
      }
      const d = data as any;
      setPreviews(prev => ({
        ...prev,
        [targetId]: {
          ...(prev[targetId] || {}),
          loading: false,
          error: null,
          verdict: d.verdict,
          verdict_label: d.verdict_label,
          headline: d.headline,
          reasoning: d.reasoning,
          alternatives: d.alternatives || [],
          context: d.context || undefined,
          target_cpa_cents: d.target_cpa_cents ?? null,
        } as PreviewData,
      }));
    } catch (e: any) {
      setPreviews(prev => ({
        ...prev,
        [targetId]: { ...(prev[targetId] || {}), loading: false, error: e?.message || 'Erro de conexão' } as PreviewData,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, personaId]);

  const cancelPreview = useCallback((targetId: string) => {
    setPreviews(prev => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
  }, []);

  // ── Toggle status (pause/activate) — the core Phase B flow ──────────────
  // 1. Call meta-actions to flip status on Meta API
  // 2. Update local state optimistically
  // 3. Call ai-campaign-comment for REAL analysis
  // 4. Show inline AI comment under the row
  const toggleStatus = useCallback(async (
    targetId: string,
    targetType: TargetType,
    currentStatus: string,
    targetName: string,
  ) => {
    if (!userId) return;
    const isPaused = isPausedStatus(currentStatus);
    const kind: ActionKind = isPaused ? 'activate' : 'pause';
    const metaAction = isPaused ? 'enable' : 'pause';

    // Mark inflight
    setFeedback(prev => ({ ...prev, [targetId]: { inflight: true, timestamp: Date.now() } }));

    try {
      // ── 1. Execute action ────────────────────────────────────────────
      // `source: 'manager_manual'` tags this as a human-driven action in
      // action_log (vs decision-engine-driven via execute-action). Makes
      // History filterable and gives the "manual" vs "autopilot" split
      // on the dashboard honest.
      const { data: actionData, error: actionErr } = await supabase.functions.invoke('meta-actions', {
        body: {
          user_id: userId,
          persona_id: personaId,
          action: metaAction,
          target_id: targetId,
          target_type: targetType,
          target_name: targetName,
          source: 'manager_manual',
        },
      });
      if (actionErr || !actionData || (actionData as any).error) {
        const msg = (actionData as any)?.error || actionErr?.message || 'Falha na ação.';
        setFeedback(prev => ({ ...prev, [targetId]: { error: msg, timestamp: Date.now() } }));
        return;
      }

      // ── 2. Update local state optimistically ──────────────────────────
      const newStatus = isPaused ? 'ACTIVE' : 'PAUSED';
      if (targetType === 'campaign') {
        setCampaigns(prev => prev.map(c => c.id === targetId ? { ...c, status: newStatus, effective_status: newStatus } : c));
      } else if (targetType === 'adset') {
        setAdsetsByCampaign(prev => {
          const out: Record<string, AdSet[]> = {};
          for (const [cid, list] of Object.entries(prev)) {
            out[cid] = list.map(a => a.id === targetId ? { ...a, status: newStatus, effective_status: newStatus } : a);
          }
          return out;
        });
      } else {
        setAdsByAdset(prev => {
          const out: Record<string, Ad[]> = {};
          for (const [aid, list] of Object.entries(prev)) {
            out[aid] = list.map(ad => ad.id === targetId ? { ...ad, status: newStatus, effective_status: newStatus } : ad);
          }
          return out;
        });
      }

      // ── 3. Get AI comment (REAL analysis on 30d data) ────────────────
      setFeedback(prev => ({ ...prev, [targetId]: { analyzing: true, timestamp: Date.now() } }));

      const { data: aiData, error: aiErr } = await supabase.functions.invoke('ai-campaign-comment', {
        body: {
          user_id: userId,
          persona_id: personaId,
          target_id: targetId,
          target_type: targetType,
          action: kind === 'pause' ? 'pause' : 'activate',
        },
      });

      if (aiErr || !aiData || (aiData as any).error) {
        // Action succeeded but analysis failed — show a minimal confirmation
        const label = targetType === 'campaign' ? 'Campanha' : targetType === 'adset' ? 'Conjunto' : 'Anúncio';
        setFeedback(prev => ({
          ...prev,
          [targetId]: {
            comment: `${label} ${kind === 'pause' ? 'pausada' : 'ativada'}. Análise da IA indisponível no momento.`,
            timestamp: Date.now(),
          },
        }));
        return;
      }

      const comment = (aiData as any).comment || 'Ação executada.';
      setFeedback(prev => ({ ...prev, [targetId]: { comment, timestamp: Date.now() } }));
    } catch (e: any) {
      setFeedback(prev => ({ ...prev, [targetId]: { error: e?.message || 'Erro inesperado', timestamp: Date.now() } }));
    }
  }, [userId, personaId]);

  // ── Update daily budget (campaign or adset) ─────────────────────────────
  const updateBudget = useCallback(async (
    targetId: string,
    targetType: 'campaign' | 'adset',
    oldCents: number | null | undefined,
    newCents: number,
    targetName: string,
  ) => {
    if (!userId) return;
    setFeedback(prev => ({ ...prev, [targetId]: { inflight: true, timestamp: Date.now() } }));

    try {
      const newReais = newCents / 100;
      const { data: actionData, error: actionErr } = await supabase.functions.invoke('meta-actions', {
        body: {
          user_id: userId,
          persona_id: personaId,
          action: 'update_budget',
          target_id: targetId,
          target_type: targetType,
          target_name: targetName,
          value: newReais,
          budget_type: 'daily',
          source: 'manager_manual',
        },
      });
      if (actionErr || !actionData || (actionData as any).error) {
        const msg = (actionData as any)?.error || actionErr?.message || 'Falha na ação.';
        setFeedback(prev => ({ ...prev, [targetId]: { error: msg, timestamp: Date.now() } }));
        return;
      }

      // Update local state optimistically
      if (targetType === 'campaign') {
        setCampaigns(prev => prev.map(c => c.id === targetId ? { ...c, daily_budget: newCents } : c));
      } else {
        setAdsetsByCampaign(prev => {
          const out: Record<string, AdSet[]> = {};
          for (const [cid, list] of Object.entries(prev)) {
            out[cid] = list.map(a => a.id === targetId ? { ...a, daily_budget: newCents } : a);
          }
          return out;
        });
      }

      // AI comment
      setFeedback(prev => ({ ...prev, [targetId]: { analyzing: true, timestamp: Date.now() } }));
      const oldReais = oldCents ? oldCents / 100 : 0;
      const { data: aiData, error: aiErr } = await supabase.functions.invoke('ai-campaign-comment', {
        body: {
          user_id: userId,
          persona_id: personaId,
          target_id: targetId,
          target_type: targetType,
          action: 'update_budget',
          context: { old_budget: oldReais, new_budget: newReais },
        },
      });

      if (aiErr || !aiData || (aiData as any).error) {
        setFeedback(prev => ({
          ...prev,
          [targetId]: {
            comment: `Orçamento ajustado para R$${newReais.toFixed(2)}/dia. Análise da IA indisponível.`,
            timestamp: Date.now(),
          },
        }));
        return;
      }
      setFeedback(prev => ({ ...prev, [targetId]: { comment: (aiData as any).comment, timestamp: Date.now() } }));
    } catch (e: any) {
      setFeedback(prev => ({ ...prev, [targetId]: { error: e?.message || 'Erro inesperado', timestamp: Date.now() } }));
    }
  }, [userId, personaId]);

  // ── Duplicate (campaign/adset/ad) ───────────────────────────────────────
  const duplicate = useCallback(async (
    targetId: string,
    targetType: TargetType,
    targetName: string,
  ) => {
    if (!userId) return;
    setFeedback(prev => ({ ...prev, [targetId]: { inflight: true, timestamp: Date.now() } }));

    try {
      const { data: actionData, error: actionErr } = await supabase.functions.invoke('meta-actions', {
        body: {
          user_id: userId,
          persona_id: personaId,
          action: 'duplicate',
          target_id: targetId,
          target_type: targetType,
          target_name: targetName,
          source: 'manager_manual',
        },
      });
      if (actionErr || !actionData || (actionData as any).error) {
        const msg = (actionData as any)?.error || actionErr?.message || 'Falha na ação.';
        setFeedback(prev => ({ ...prev, [targetId]: { error: msg, timestamp: Date.now() } }));
        return;
      }
      const newId = (actionData as any).new_id;

      setFeedback(prev => ({ ...prev, [targetId]: { analyzing: true, timestamp: Date.now() } }));

      const { data: aiData, error: aiErr } = await supabase.functions.invoke('ai-campaign-comment', {
        body: {
          user_id: userId,
          persona_id: personaId,
          target_id: targetId,
          target_type: targetType,
          action: 'duplicate',
          context: { new_id: newId },
        },
      });

      if (aiErr || !aiData || (aiData as any).error) {
        const label = targetType === 'campaign' ? 'Campanha' : targetType === 'adset' ? 'Conjunto' : 'Anúncio';
        setFeedback(prev => ({
          ...prev,
          [targetId]: {
            comment: `${label} duplicado${targetType === 'campaign' ? 'a' : ''} (pausado${targetType === 'campaign' ? 'a' : ''}). Análise da IA indisponível.`,
            timestamp: Date.now(),
          },
        }));
        return;
      }
      setFeedback(prev => ({ ...prev, [targetId]: { comment: (aiData as any).comment, timestamp: Date.now() } }));
    } catch (e: any) {
      setFeedback(prev => ({ ...prev, [targetId]: { error: e?.message || 'Erro inesperado', timestamp: Date.now() } }));
    }
  }, [userId, personaId]);

  /**
   * Dispatch the confirmed action from an open preview panel. Routes
   * to the existing toggleStatus / updateBudget / duplicate helpers,
   * then clears the preview on success.
   */
  const confirmPreview = useCallback(async (targetId: string) => {
    const preview = previews[targetId];
    if (!preview || !preview.context) return;

    setPreviews(prev => ({
      ...prev,
      [targetId]: { ...(prev[targetId] || {}), executing: true, executionError: undefined } as PreviewData,
    }));

    try {
      const { proposedAction, targetType, targetName, proposedBudgetCents } = preview;
      const currentStatus = preview.context.effective_status;

      if (proposedAction === 'pause' || proposedAction === 'activate') {
        await toggleStatus(targetId, targetType, currentStatus, targetName);
      } else if (proposedAction === 'duplicate') {
        await duplicate(targetId, targetType, targetName);
      } else if (proposedAction === 'increase_budget' || proposedAction === 'decrease_budget') {
        if (proposedBudgetCents !== undefined) {
          await updateBudget(targetId, targetType, 0, proposedBudgetCents, targetName);
        }
      }
      setPreviews(prev => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    } catch (e: any) {
      setPreviews(prev => ({
        ...prev,
        [targetId]: {
          ...(prev[targetId] || {}),
          executing: false,
          executionError: e?.message || 'Falha ao executar',
        } as PreviewData,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, toggleStatus, updateBudget, duplicate]);

  const sortedCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? campaigns.filter(c => (c.name || '').toLowerCase().includes(q))
      : campaigns;
    return [...filtered].sort((a, b) => {
      const sa = (a.effective_status || a.status || '').toUpperCase();
      const sb = (b.effective_status || b.status || '').toUpperCase();
      const order = (s: string) => s === 'ACTIVE' ? 0 : s === 'PAUSED' ? 1 : s.includes('LEARNING') ? 0 : 2;
      return order(sa) - order(sb);
    });
  }, [campaigns, searchQuery]);

  // ══════════════════════════════════════════════════════════════════════
  // PREVIEW PANEL — renders inline below a row when the user requests an
  // action. Shows AI verdict, real context (days running / spend / conv /
  // CPA / freq / trend), reasoning and alternatives, then Confirmar /
  // Cancelar buttons. Confirmar triggers the real meta-actions call.
  // ══════════════════════════════════════════════════════════════════════
  const PreviewPanel: React.FC<{ targetId: string; indent?: number }> = ({ targetId, indent = 0 }) => {
    const p = previews[targetId];
    if (!p) return null;

    // Colors per verdict
    const verdictTone = (() => {
      if (p.verdict === 'recommend') return { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.35)', color: '#4ADE80' };
      if (p.verdict === 'reject')    return { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', color: '#F87171' };
      if (p.verdict === 'wait')      return { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', color: '#FBBF24' };
      return { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)', color: T.text2 };
    })();

    const brl = (c: number) => (c / 100).toFixed(2).replace('.', ',');

    const isContrary = p.verdict === 'reject' || p.verdict === 'wait';
    const confirmLabel = isContrary
      ? `Executar mesmo assim`
      : `Confirmar ${p.proposedActionLabel.toLowerCase()}`;

    return (
      <div style={{
        background: T.bg0,
        borderTop: `1px solid ${T.border0}`,
        padding: `16px 20px 16px ${20 + indent}px`,
        fontFamily: F,
        animation: 'mgr-fade-in 0.18s ease',
      }}>
        <style>{`@keyframes mgr-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>

        {/* Loading state */}
        {p.loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text3, fontSize: 12.5 }}>
            <Loader2 size={14} className="spin" />
            Analisando: rodando há {p.proposedActionLabel.toLowerCase()} em <strong style={{ color: T.text2, fontWeight: 600 }}>{p.targetName}</strong>…
          </div>
        )}

        {/* Error state */}
        {!p.loading && p.error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: '#F87171', fontSize: 12.5,
            background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.20)`,
            borderRadius: 8, padding: '10px 12px',
          }}>
            <X size={14} /> Falha na análise: {p.error}
            <button
              onClick={() => cancelPreview(targetId)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: 11 }}
            >
              Fechar
            </button>
          </div>
        )}

        {/* Verdict + content */}
        {!p.loading && !p.error && p.verdict && (
          <>
            {/* Verdict header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: verdictTone.bg,
                border: `1px solid ${verdictTone.border}`,
                color: verdictTone.color,
                fontSize: 10.5, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                <Sparkles size={11} /> {p.verdict_label}
              </div>
              <p style={{
                flex: 1, fontSize: 14, fontWeight: 600, color: T.text1,
                margin: 0, lineHeight: 1.4, letterSpacing: '-0.01em',
              }}>
                {p.headline}
              </p>
            </div>

            {/* Context grid — the numbers the AI based its call on */}
            {p.context && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 8, marginBottom: 14,
              }}>
                {[
                  { label: 'Rodando há', value: `${p.context.days_running}d`, sub: `${p.context.days_with_spend}d c/ entrega` },
                  { label: 'Spend', value: `R$ ${brl(p.context.spend_cents)}` },
                  { label: 'Conversões', value: String(Math.round(p.context.conversions)) },
                  { label: 'CPA', value: p.context.cpa_cents !== null ? `R$ ${brl(p.context.cpa_cents)}` : '—',
                    sub: p.target_cpa_cents ? `meta R$ ${brl(p.target_cpa_cents)}` : undefined,
                    tone: p.context.cpa_cents !== null && p.target_cpa_cents
                      ? (p.context.cpa_cents <= p.target_cpa_cents ? 'good' : 'bad') : undefined },
                  { label: 'CTR', value: `${p.context.ctr.toFixed(2)}%`, sub: p.context.trend ? `trend: ${p.context.trend === 'up' ? '↑' : p.context.trend === 'down' ? '↓' : '→'}` : undefined },
                  { label: 'Frequência', value: `${p.context.freq.toFixed(1)}x`,
                    tone: p.context.freq > 3.5 ? 'bad' : undefined },
                ].map((m, i) => (
                  <div key={i} style={{
                    background: T.bg1, border: `1px solid ${T.border0}`,
                    borderRadius: 8, padding: '8px 10px',
                  }}>
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, color: T.text3,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      marginBottom: 2,
                    }}>
                      {m.label}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: m.tone === 'good' ? '#4ADE80' : m.tone === 'bad' ? '#F87171' : T.text1,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {m.value}
                    </div>
                    {m.sub && (
                      <div style={{ fontSize: 9.5, color: T.text3, marginTop: 1 }}>{m.sub}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reasoning */}
            {p.reasoning && (
              <p style={{
                fontSize: 12.5, color: T.text2, margin: '0 0 12px',
                lineHeight: 1.6,
              }}>
                {p.reasoning}
              </p>
            )}

            {/* Alternatives */}
            {p.alternatives && p.alternatives.length > 0 && (
              <div style={{
                background: T.bg1, border: `1px solid ${T.border0}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, color: T.text3,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  Alternativas
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.alternatives.map((alt, i) => (
                    <li key={i} style={{ fontSize: 12, color: T.text2, lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 2, color: T.blue }}>→</span>
                      {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Execution error */}
            {p.executionError && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 10,
                fontSize: 12, color: '#F87171',
              }}>
                {p.executionError}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => cancelPreview(targetId)}
                disabled={!!p.executing}
                style={{
                  background: T.bg2, border: `1px solid ${T.border1}`,
                  color: T.text2, borderRadius: 8,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  cursor: p.executing ? 'default' : 'pointer',
                  fontFamily: F, opacity: p.executing ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmPreview(targetId)}
                disabled={!!p.executing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: isContrary
                    ? 'rgba(239,68,68,0.12)'
                    : verdictTone.bg,
                  border: `1px solid ${isContrary ? 'rgba(239,68,68,0.40)' : verdictTone.border}`,
                  color: isContrary ? '#F87171' : verdictTone.color,
                  borderRadius: 8,
                  padding: '8px 14px', fontSize: 12, fontWeight: 700,
                  cursor: p.executing ? 'default' : 'pointer',
                  fontFamily: F,
                  letterSpacing: '0.01em',
                }}
              >
                {p.executing ? <Loader2 size={12} className="spin" /> : null}
                {confirmLabel}
              </button>
              {p.verdict === 'wait' && (
                <span style={{ fontSize: 10.5, color: T.text3, marginLeft: 'auto', fontStyle: 'italic' }}>
                  Recomendado: aguardar
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ flex: 1, minHeight: 0, background: T.bg0, padding: '24px 16px', fontFamily: F, color: T.text1, overflow: 'auto' }}>
      {/* Local CSS for spin animation (Loader2 icon) */}
      <style>{`.spin { animation: mgr-spin 0.9s linear infinite; } @keyframes mgr-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/dashboard/feed')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: T.bg2, color: T.text2, border: `1px solid ${T.border1}`,
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: F,
            }}
          >
            <ArrowLeft size={14} /> Voltar ao Feed
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} style={{ color: T.purple }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Gerenciador manual
            </h1>
          </div>
        </div>

        {/* Subtle manual-mode banner — matches the Feed's elevated-card
            aesthetic (T.bg1 + T.border1) with a muted blue left rule so
            it reads as "sidebar tool" instead of "primary surface".
            Mensagem discreta: o Feed é o canal canônico, isso aqui é
            override manual pra casos raros. Toda ação é registrada em
            Histórico com marca 'manual'. */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: T.bg1, border: `1px solid ${T.border1}`,
          borderLeft: `2px solid ${T.blue}`,
          borderRadius: 8, padding: '10px 14px',
          marginBottom: 18,
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: T.blue,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'rgba(37,99,235,0.10)', borderRadius: 4,
            padding: '2px 6px', flexShrink: 0, marginTop: 1,
          }}>
            Manual
          </div>
          <p style={{
            fontSize: 11.5, color: T.text3, lineHeight: 1.55,
            margin: 0, flex: 1,
          }}>
            Ajustes pontuais direto na conta Meta. Antes de confirmar qualquer ação,
            a IA analisa o contexto (idade, performance, tendência) e te diz se
            faz sentido agora. O fluxo principal continua sendo o <a
              href="/dashboard/feed"
              style={{ color: T.text2, textDecoration: 'underline', textDecorationColor: T.border2 }}
            >Feed</a> — aqui cada ação fica marcada como manual no <a
              href="/dashboard/history"
              style={{ color: T.text2, textDecoration: 'underline', textDecorationColor: T.border2 }}
            >Histórico</a>.
          </p>
        </div>

        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>
            Carregando campanhas…
          </div>
        )}

        {error && !loading && (
          <div style={{ background: T.bg1, border: `1px solid ${T.border1}`, borderLeft: `3px solid ${T.red}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: T.text1 }}>Não consegui carregar as campanhas.</p>
            <p style={{ fontSize: 11.5, margin: 0, color: T.text3 }}>{error}</p>
          </div>
        )}

        {!loading && !error && !metaConnected && (
          <div style={{
            background: T.bg1, border: `1px solid ${T.border1}`, borderRadius: 10,
            padding: '32px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 6px', color: T.text1 }}>
              Conecte sua conta do Meta Ads
            </p>
            <p style={{ fontSize: 12, margin: '0 0 14px', color: T.text3, lineHeight: 1.5 }}>
              Para ver, pausar ou ajustar campanhas aqui, conecte uma conta de anúncios em Contas.
            </p>
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                background: T.bg3, color: T.text1, border: `1px solid ${T.border2}`,
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: F,
              }}
            >
              Ir para Contas
            </button>
          </div>
        )}

        {!loading && !error && metaConnected && campaigns.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>
            Nenhuma campanha encontrada nesta conta.
          </div>
        )}

        {/* Search — filters the campaign tree by name. Shown once the user
            has enough campaigns that scrolling is worse than typing (3+). */}
        {!loading && !error && metaConnected && campaigns.length >= 3 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: T.bg1, border: `1px solid ${T.border1}`, borderRadius: 10,
            padding: '10px 14px', marginBottom: 10,
          }}>
            <Search size={14} style={{ color: T.text3, flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar campanha pelo nome…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: T.text1, fontSize: 13, fontFamily: F,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
                style={{
                  background: 'transparent', border: 'none', padding: 2,
                  color: T.text3, cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
            <span style={{ fontSize: 11, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>
              {sortedCampaigns.length} de {campaigns.length}
            </span>
          </div>
        )}

        {/* Empty-filter state — avoid a silent blank list when search
            returns nothing. */}
        {!loading && !error && metaConnected && campaigns.length > 0 && sortedCampaigns.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: T.text3, fontSize: 12.5 }}>
            Nenhuma campanha com "{searchQuery}".
          </div>
        )}

        {/* Campaign tree */}
        {!loading && !error && sortedCampaigns.map((c) => {
          const sc = statusColor(c.effective_status || c.status);
          const isOpen = expandedCampaigns.has(c.id);
          const adsets = adsetsByCampaign[c.id] || [];
          const loadingThisAdsets = loadingAdsets[c.id];
          const cFeedback = feedback[c.id];
          const cInflight = !!cFeedback?.inflight;
          const cPaused = isPausedStatus(c.effective_status || c.status);

          return (
            <div key={c.id} style={{ background: T.bg1, border: `1px solid ${T.border1}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              {/* Campaign row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px 14px 16px', minWidth: 0 }}>
                <button
                  onClick={() => toggleCampaign(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                    background: 'transparent', border: 'none', padding: 0,
                    cursor: 'pointer', textAlign: 'left', color: T.text1, fontFamily: F, minWidth: 0,
                  }}
                >
                  {isOpen ? <ChevronDown size={14} style={{ color: T.text3, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: T.text3, flexShrink: 0 }} />}
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  <span
                    title={c.name}
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {c.name}
                  </span>
                </button>
                <BudgetInlineEdit
                  cents={c.daily_budget}
                  saving={cInflight}
                  onSave={(newCents) => updateBudget(c.id, 'campaign', c.daily_budget, newCents, c.name)}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  {sc.label}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <ActionButton
                    kind={cPaused ? 'activate' : 'pause'}
                    inflight={cInflight || !!previews[c.id]?.loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestPreview(c.id, 'campaign', c.name, cPaused ? 'activate' : 'pause');
                    }}
                  />
                  <DuplicateButton
                    inflight={cInflight || !!previews[c.id]?.loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestPreview(c.id, 'campaign', c.name, 'duplicate');
                    }}
                  />
                </div>
              </div>

              {/* AI analysis preview — shown after the user clicks a button, before execution */}
              <PreviewPanel targetId={c.id} indent={16} />

              <InlineComment feedback={cFeedback} indent={40} />

              {/* Adsets */}
              {isOpen && (
                <div style={{ background: T.bg0, borderTop: `1px solid ${T.border0}` }}>
                  {loadingThisAdsets && (
                    <div style={{ padding: 12, fontSize: 11.5, color: T.text3, textAlign: 'center' }}>
                      Carregando conjuntos…
                    </div>
                  )}
                  {!loadingThisAdsets && adsetErrors[c.id] && (
                    <div style={{
                      padding: '10px 14px', fontSize: 11.5, color: '#F87171',
                      textAlign: 'center', background: 'rgba(248,113,113,0.06)',
                      borderTop: `1px solid rgba(248,113,113,0.15)`,
                    }}>
                      Falha ao carregar conjuntos: {adsetErrors[c.id]}
                    </div>
                  )}
                  {!loadingThisAdsets && !adsetErrors[c.id] && adsets.length === 0 && (
                    <div style={{ padding: 12, fontSize: 11.5, color: T.text3, textAlign: 'center' }}>
                      Nenhum conjunto de anúncios.
                    </div>
                  )}
                  {adsets.map((ads) => {
                    const sa = statusColor(ads.effective_status || ads.status);
                    const isAdsetOpen = expandedAdsets.has(ads.id);
                    const ads_ = adsByAdset[ads.id] || [];
                    const loadingThisAds = loadingAds[ads.id];
                    const aFeedback = feedback[ads.id];
                    const aInflight = !!aFeedback?.inflight;
                    const aPaused = isPausedStatus(ads.effective_status || ads.status);

                    return (
                      <div key={ads.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px 11px 36px', borderTop: `1px solid ${T.border0}`, minWidth: 0 }}>
                          <button
                            onClick={() => toggleAdset(ads.id, c.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                              background: 'transparent', border: 'none', padding: 0,
                              cursor: 'pointer', textAlign: 'left', color: T.text1, fontFamily: F, minWidth: 0,
                            }}
                          >
                            {isAdsetOpen ? <ChevronDown size={12} style={{ color: T.text3, flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: T.text3, flexShrink: 0 }} />}
                            <Target size={11} style={{ color: T.text3, flexShrink: 0 }} />
                            <span
                              title={ads.name}
                              style={{ flex: 1, fontSize: 12, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {ads.name}
                            </span>
                          </button>
                          <BudgetInlineEdit
                            cents={ads.daily_budget}
                            saving={aInflight}
                            onSave={(newCents) => updateBudget(ads.id, 'adset', ads.daily_budget, newCents, ads.name)}
                            size="sm"
                          />
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: sa.color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                            {sa.label}
                          </span>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <ActionButton
                              kind={aPaused ? 'activate' : 'pause'}
                              inflight={aInflight || !!previews[ads.id]?.loading}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestPreview(ads.id, 'adset', ads.name, aPaused ? 'activate' : 'pause');
                              }}
                            />
                            <DuplicateButton
                              inflight={aInflight || !!previews[ads.id]?.loading}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestPreview(ads.id, 'adset', ads.name, 'duplicate');
                              }}
                            />
                            {/* Open in Meta Ads Manager — lets the user inspect
                                targeting/placements/audiences without us
                                having to parse Meta's complex targeting spec
                                inside the app. Deep link opens in new tab. */}
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/adsets?selected_adset_ids=${ads.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir conjunto no Gerenciador da Meta"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 24, height: 24, borderRadius: 6,
                                background: T.bg2, border: `1px solid ${T.border1}`,
                                color: T.text3, textDecoration: 'none',
                                transition: 'color 0.12s, border-color 0.12s',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = T.text1;
                                (e.currentTarget as HTMLElement).style.borderColor = T.border2;
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = T.text3;
                                (e.currentTarget as HTMLElement).style.borderColor = T.border1;
                              }}
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>

                        {/* AI analysis preview for this adset */}
                        <PreviewPanel targetId={ads.id} indent={40} />

                        <InlineComment feedback={aFeedback} indent={60} />

                        {/* Ads inside this adset */}
                        {isAdsetOpen && (
                          <div style={{ background: T.bg1, borderTop: `1px solid ${T.border0}` }}>
                            {loadingThisAds && (
                              <div style={{ padding: 10, paddingLeft: 60, fontSize: 11, color: T.text3 }}>
                                Carregando anúncios…
                              </div>
                            )}
                            {!loadingThisAds && adErrors[ads.id] && (
                              <div style={{
                                padding: '8px 14px 8px 60px', fontSize: 11, color: '#F87171',
                                background: 'rgba(248,113,113,0.06)',
                              }}>
                                Falha ao carregar anúncios: {adErrors[ads.id]}
                              </div>
                            )}
                            {!loadingThisAds && !adErrors[ads.id] && ads_.length === 0 && (
                              <div style={{ padding: 10, paddingLeft: 60, fontSize: 11, color: T.text3 }}>
                                Nenhum anúncio neste conjunto.
                              </div>
                            )}
                            {ads_.map((ad) => {
                              const sAd = statusColor(ad.effective_status || ad.status);
                              const adFeedback = feedback[ad.id];
                              const adInflight = !!adFeedback?.inflight;
                              const adPaused = isPausedStatus(ad.effective_status || ad.status);
                              return (
                                <div key={ad.id}>
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px 9px 60px',
                                    borderTop: `1px solid ${T.border0}`,
                                  }}>
                                    <Sparkles size={10} style={{ color: T.purple, flexShrink: 0 }} />
                                    <span
                                      title={ad.name}
                                      style={{ flex: 1, fontSize: 11.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    >
                                      {ad.name}
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: sAd.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                      {sAd.label}
                                    </span>
                                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                      <ActionButton
                                        kind={adPaused ? 'activate' : 'pause'}
                                        inflight={adInflight || !!previews[ad.id]?.loading}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          requestPreview(ad.id, 'ad', ad.name, adPaused ? 'activate' : 'pause');
                                        }}
                                      />
                                      <DuplicateButton
                                        inflight={adInflight || !!previews[ad.id]?.loading}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          requestPreview(ad.id, 'ad', ad.name, 'duplicate');
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <PreviewPanel targetId={ad.id} indent={80} />
                                  <InlineComment feedback={adFeedback} indent={80} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!loading && !error && campaigns.length > 0 && (
          <p style={{ fontSize: 10.5, color: T.text3, textAlign: 'center', margin: '20px 0 0', fontStyle: 'italic' }}>
            Pausar, ativar, ajustar orçamento ou duplicar — cada ação é analisada pelo Estrategista com dados reais de 30 dias.
          </p>
        )}
      </div>
    </div>
  );
}
