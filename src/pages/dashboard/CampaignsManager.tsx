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
// Design tokens — matching AccountsPage / HistoryPage so the Gerenciador
// reads as part of the same surface. Solid slate palette (not the old
// cinza-com-cinza whitewash) + slate text + named colors for semantics.
const T = {
  bg0: '#060A14',                             // page bg — same as /accounts
  bg1: '#0A0F1C',                             // card bg solid
  bg2: '#0F172A',                             // elevated
  bg3: '#1E293B',                             // pressed / active
  text1: '#F1F5F9',                           // primary bright
  text2: '#94A3B8',                           // secondary slate
  text3: '#64748B',                           // tertiary muted
  textL: '#475569',                           // very muted label
  border0: 'rgba(148,163,184,0.04)',
  border1: 'rgba(148,163,184,0.08)',
  border2: 'rgba(148,163,184,0.14)',
  green: '#10B981',                           // solid emerald — matches /history
  red:   '#EF4444',
  yellow:'#F59E0B',                           // amber
  blue:  '#2563EB',                           // indigo-blue, same as /history
  cyan:  '#06B6D4',
  purple:'#A78BFA',
  // Legacy aliases used by pre-existing helpers throughout the file.
  // Keep the names so I don't have to rewrite 30 references — just
  // point them at the new palette.
  labelColor: '#64748B',
  CARD:  'rgba(15,23,42,0.80)',
  SHD:   '0 0 0 1px rgba(148,163,184,0.08), 0 8px 32px rgba(0,0,0,0.40)',
  GLASS: 'blur(16px) saturate(180%)',
  EASE:  'cubic-bezier(0.4,0,0.2,1)',
};
const F = 'system-ui, -apple-system, "SF Pro Display", sans-serif';

// ── Helpers ───────────────────────────────────────────────────────────────
function statusColor(s: string | undefined): { color: string; dot: string; glow: string; label: string } {
  const u = (s || '').toUpperCase();
  // dot = solid body of the status indicator
  // glow = same color at high transparency, used for box-shadow halo
  if (u === 'ACTIVE')
    return { color: T.green, dot: '#10B981', glow: 'rgba(16,185,129,0.50)', label: 'Ativo' };
  if (u === 'PAUSED' || u === 'CAMPAIGN_PAUSED' || u === 'ADSET_PAUSED')
    return { color: T.text2, dot: '#64748B', glow: 'rgba(100,116,139,0.35)', label: 'Pausado' };
  if (u === 'LEARNING' || u === 'IN_PROCESS' || u === 'PENDING_REVIEW')
    return { color: T.yellow, dot: '#F59E0B', glow: 'rgba(245,158,11,0.50)', label: 'Aprendizado' };
  if (u === 'DISAPPROVED' || u === 'WITH_ISSUES')
    return { color: T.red, dot: '#EF4444', glow: 'rgba(239,68,68,0.50)', label: 'Problema' };
  if (u === 'ARCHIVED' || u === 'DELETED')
    return { color: T.text3, dot: '#475569', glow: 'rgba(71,85,105,0.30)', label: 'Arquivado' };
  return { color: T.text2, dot: '#64748B', glow: 'rgba(100,116,139,0.30)', label: u || '—' };
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

// ── Primary component: Analyze button — "convida a IA a julgar" ──────────
// Carrega a filosofia do produto: cada linha tem um atalho pro copiloto
// avaliar a situação e sugerir o próximo passo, sem o usuário precisar
// pré-escolher (Pausar/Duplicar/etc). Diferente dos outros botões, esse
// é SEMPRE azul — é o botão-IA.
function AnalyzeButton({
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
  const paddingH = size === 'sm' ? 8 : 10;
  const fontSize = size === 'sm' ? 9.5 : 10.5;
  const bg = 'rgba(37,99,235,0.14)';
  const bgHover = 'rgba(37,99,235,0.22)';
  const border = 'rgba(37,99,235,0.36)';
  const color = '#93C5FD';
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
        fontSize, fontWeight: 700, fontFamily: F,
        cursor: inflight ? 'default' : 'pointer',
        opacity: inflight ? 0.6 : 1,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.005em',
        boxShadow: '0 0 12px rgba(37,99,235,0.15)',
        transition: 'background 0.14s, box-shadow 0.14s, transform 0.08s',
      }}
      onMouseEnter={(e) => {
        if (inflight) return;
        e.currentTarget.style.background = bgHover;
        e.currentTarget.style.boxShadow = '0 0 16px rgba(37,99,235,0.28)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
        e.currentTarget.style.boxShadow = '0 0 12px rgba(37,99,235,0.15)';
      }}
      title="Pedir análise à IA — sugere a ação certa pra essa linha agora"
    >
      {inflight
        ? <Loader2 size={iconSize} className="spin" />
        : <Sparkles size={iconSize} strokeWidth={2.3} />
      }
      Analisar
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
    // If the user is COLLAPSING and there's an open preview on this
    // campaign or any of its child rows, auto-cancel them — otherwise
    // they linger in state and the UI feels stuck ("impossível recolher").
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      const wasOpen = next.has(campaignId);
      if (wasOpen) {
        next.delete(campaignId);
        // Collapse path: clear any preview on this campaign AND on its
        // adsets/ads (they're about to be hidden anyway).
        setPreviews(pp => {
          const clean = { ...pp };
          delete clean[campaignId];
          const childAdsets = adsetsByCampaign[campaignId] || [];
          for (const ads of childAdsets) {
            delete clean[ads.id];
            const childAds = adsByAdset[ads.id] || [];
            for (const ad of childAds) delete clean[ad.id];
          }
          return clean;
        });
      } else {
        next.add(campaignId);
      }
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
      const wasOpen = next.has(adsetId);
      if (wasOpen) {
        next.delete(adsetId);
        // Same cleanup as campaign: when collapsing an adset, kill any
        // open preview on it and on its ad children.
        setPreviews(pp => {
          const clean = { ...pp };
          delete clean[adsetId];
          const childAds = adsByAdset[adsetId] || [];
          for (const ad of childAds) delete clean[ad.id];
          return clean;
        });
      } else {
        next.add(adsetId);
      }
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

  /** Cancel every preview key. Used when collapsing a parent that
   *  contains rows with open previews — otherwise they linger in state
   *  and make the UI feel stuck. */
  const cancelAllPreviews = useCallback(() => {
    setPreviews({});
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

  // ── Account-level KPIs for the top strip ────────────────────────────────
  // Computed locally from the loaded campaigns list (no extra API call).
  // Shows what the operator needs to glance at before diving into detail:
  // total / active / paused / daily budget committed. Uses Meta's
  // effective_status so "LEARNING" counts as active (it is delivering).
  const kpis = useMemo(() => {
    const isActiveEffective = (s: string) => {
      const u = (s || '').toUpperCase();
      return u === 'ACTIVE' || u === 'LEARNING' || u === 'IN_PROCESS' || u === 'LEARNING_LIMITED';
    };
    const isPausedEffective = (s: string) => {
      const u = (s || '').toUpperCase();
      return u === 'PAUSED' || u === 'CAMPAIGN_PAUSED' || u === 'ADSET_PAUSED';
    };
    let active = 0, paused = 0, dailyBudgetActive = 0;
    for (const c of campaigns) {
      const s = (c.effective_status || c.status || '').toString();
      if (isActiveEffective(s)) {
        active += 1;
        dailyBudgetActive += (c.daily_budget || 0);
      } else if (isPausedEffective(s)) {
        paused += 1;
      }
    }
    return {
      total: campaigns.length,
      active,
      paused,
      dailyBudgetActiveCents: dailyBudgetActive,
    };
  }, [campaigns]);

  // ══════════════════════════════════════════════════════════════════════
  // PREVIEW PANEL — AI copiloto inline abaixo da row.
  // Design: Linear-style, sem boxes cinza uniformes. Métricas em linha
  // com dividers verticais, hierarquia por tamanho de fonte e peso.
  // Cor semântica só onde carrega informação (CPA verde/vermelho, freq
  // alta vermelho, verdict color accent no label). IA visível como
  // copiloto através de uma "assinatura" no topo.
  // ══════════════════════════════════════════════════════════════════════
  const PreviewPanel: React.FC<{ targetId: string; indent?: number }> = ({ targetId, indent = 0 }) => {
    const p = previews[targetId];
    if (!p) return null;

    // Cor do verdict — usada SÓ no label pequeno e no glow da assinatura IA,
    // não em backgrounds de boxes.
    const verdictColor = (() => {
      if (p.verdict === 'recommend') return T.green;     // #22C55E
      if (p.verdict === 'reject')    return T.red;       // #EF4444
      if (p.verdict === 'wait')      return T.yellow;    // #F59E0B
      return T.text3;
    })();

    const brl = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    const isContrary = p.verdict === 'reject' || p.verdict === 'wait';
    // In 'analyze' mode there's no action to confirm — the preview is
    // pure judgment. The primary button becomes "Fechar análise" which
    // just dismisses the panel. For any other mode keep the existing
    // confirm/override button.
    const isAnalyzeMode = p.proposedAction === 'analyze';
    const confirmLabel = isAnalyzeMode
      ? 'Fechar análise'
      : isContrary
        ? `Executar mesmo assim`
        : `Confirmar ${p.proposedActionLabel.toLowerCase()}`;

    // Pad top/bottom for breathing room, left indent matches the row's
    // nesting level so the panel visually belongs to its parent.
    const pad = `20px 24px 18px ${24 + indent}px`;

    return (
      <div style={{
        background: T.bg0,
        borderTop: `1px solid ${T.border1}`,
        padding: pad,
        fontFamily: F,
        animation: 'mgr-fade-in 0.2s ease',
      }}>
        <style>{`
          @keyframes mgr-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          @keyframes mgr-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        `}</style>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {p.loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: `radial-gradient(circle, ${T.blue}33, transparent 70%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'mgr-pulse 1.2s ease-in-out infinite',
            }}>
              <Sparkles size={12} color={T.blue} />
            </div>
            <span style={{ fontSize: 12.5, color: T.text2, fontWeight: 500 }}>
              AdBrief AI lendo contexto…
            </span>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────── */}
        {!p.loading && p.error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 12.5, color: T.red,
          }}>
            <X size={14} strokeWidth={2.5} />
            <span style={{ flex: 1 }}>Falha na análise: {p.error}</span>
            <button
              onClick={() => cancelPreview(targetId)}
              style={{
                background: 'transparent', border: 'none', padding: '4px 8px',
                color: T.text3, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
              }}
            >
              Fechar
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────── */}
        {!p.loading && !p.error && p.verdict && (
          <>
            {/* Copiloto signature + verdict label
                Linha de assinatura em um único fluxo horizontal. IA marca
                presença com glow no avatar; verdict fica como label de
                severidade ao lado, pequeno mas com peso. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 10,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: `radial-gradient(circle, ${verdictColor}40, transparent 70%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={10.5} color={verdictColor} strokeWidth={2.3} />
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 600, color: T.text2,
                letterSpacing: '-0.005em',
              }}>
                AdBrief AI
              </span>
              <span style={{ fontSize: 10.5, color: T.text3, fontWeight: 500 }}>·</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: verdictColor,
                letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              }}>
                {p.verdict_label}
              </span>
            </div>

            {/* Headline — o mais alto contraste da tela, linear */}
            <p style={{
              fontSize: 17, fontWeight: 700, color: T.text1,
              margin: '0 0 14px', lineHeight: 1.35,
              letterSpacing: '-0.02em',
              maxWidth: '68ch',
            }}>
              {p.headline}
            </p>

            {/* Reasoning — texto corrido, tom explicativo */}
            {p.reasoning && (
              <p style={{
                fontSize: 13, color: T.text2, lineHeight: 1.65,
                margin: '0 0 18px', maxWidth: '72ch',
                letterSpacing: '-0.005em',
              }}>
                {p.reasoning}
              </p>
            )}

            {/* Métricas em linha — SEM boxes. Cada uma é label + valor,
                separadas por dividers verticais sutis. Valor grande e
                bold pra carregar peso; label minúsculo uppercase.
                Cor semântica SÓ no valor quando informa (CPA vs meta,
                freq alta, trend). */}
            {p.context && (
              <div style={{
                display: 'flex', alignItems: 'stretch',
                gap: 0, marginBottom: 18,
                flexWrap: 'wrap' as const,
              }}>
                {(() => {
                  const cells = [
                    { label: 'Rodando há', value: `${p.context!.days_running}d`, sub: `${p.context!.days_with_spend}d c/ entrega`, tone: undefined as 'good' | 'bad' | undefined },
                    { label: 'Spend', value: `R$ ${brl(p.context!.spend_cents)}` },
                    { label: 'Conversões', value: String(Math.round(p.context!.conversions)),
                      tone: (p.context!.conversions >= 3 ? 'good' : p.context!.conversions === 0 && p.context!.days_with_spend >= 5 ? 'bad' : undefined) as 'good' | 'bad' | undefined },
                    { label: 'CPA', value: p.context!.cpa_cents !== null ? `R$ ${brl(p.context!.cpa_cents)}` : '—',
                      sub: p.target_cpa_cents ? `meta R$ ${brl(p.target_cpa_cents)}` : undefined,
                      tone: (p.context!.cpa_cents !== null && p.target_cpa_cents
                        ? (p.context!.cpa_cents <= p.target_cpa_cents ? 'good' : 'bad') : undefined) as 'good' | 'bad' | undefined },
                    { label: 'CTR', value: `${p.context!.ctr.toFixed(2)}%`,
                      sub: p.context!.trend ? (p.context!.trend === 'up' ? '↑ subindo' : p.context!.trend === 'down' ? '↓ caindo' : '→ estável') : undefined,
                      tone: (p.context!.trend === 'down' ? 'bad' : p.context!.trend === 'up' ? 'good' : undefined) as 'good' | 'bad' | undefined },
                    { label: 'Frequência', value: `${p.context!.freq.toFixed(1)}x`,
                      tone: (p.context!.freq > 3.5 ? 'bad' : p.context!.freq > 2.5 ? undefined : undefined) as 'good' | 'bad' | undefined },
                  ];
                  // NOTE: using an array of elements with explicit keys
                  // instead of React.Fragment — this file doesn't import
                  // React as default, so React.Fragment would crash in
                  // runtime with "React is not defined". Fragment
                  // shorthand <></> can't carry a key, and we need keys
                  // on the row since it's inside a map, so we just emit
                  // sibling elements with composite keys.
                  return cells.flatMap((m, i) => [
                    ...(i > 0
                      ? [<div key={`d-${i}`} style={{ width: 1, background: T.border1, alignSelf: 'stretch', margin: '4px 0' }} />]
                      : []),
                      <div key={`m-${i}`} style={{ padding: '2px 18px', minWidth: 0 }}>
                        <div style={{
                          fontSize: 9.5, fontWeight: 700, color: T.text3,
                          letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                          marginBottom: 4,
                        }}>
                          {m.label}
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700,
                          color: m.tone === 'good' ? T.green : m.tone === 'bad' ? T.red : T.text1,
                          fontVariantNumeric: 'tabular-nums' as const,
                          letterSpacing: '-0.015em',
                          lineHeight: 1.1,
                        }}>
                          {m.value}
                        </div>
                        {m.sub && (
                          <div style={{
                            fontSize: 10, color: T.text3, marginTop: 3,
                            letterSpacing: '-0.005em',
                          }}>
                            {m.sub}
                          </div>
                        )}
                      </div>,
                  ]);
                })()}
              </div>
            )}

            {/* Alternativas — lista linear com seta azul, sem box */}
            {p.alternatives && p.alternatives.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, color: T.text3,
                  letterSpacing: '0.10em', textTransform: 'uppercase' as const,
                  marginBottom: 8,
                }}>
                  Sugestões da IA
                </div>
                <ul style={{
                  margin: 0, padding: 0, listStyle: 'none',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {p.alternatives.map((alt, i) => (
                    <li key={i} style={{
                      fontSize: 12.5, color: T.text2, lineHeight: 1.55,
                      paddingLeft: 18, position: 'relative' as const,
                      letterSpacing: '-0.005em',
                    }}>
                      <span style={{
                        position: 'absolute', left: 2, top: 0,
                        color: T.blue, fontWeight: 700,
                      }}>
                        →
                      </span>
                      {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Execution error */}
            {p.executionError && (
              <p style={{
                fontSize: 12, color: T.red, margin: '0 0 10px',
                letterSpacing: '-0.005em',
              }}>
                ⚠ {p.executionError}
              </p>
            )}

            {/* Divider antes dos CTAs — separa a ação do contexto */}
            <div style={{
              height: 1, background: T.border1,
              margin: '0 -12px 16px', opacity: 0.6,
            }} />

            {/* Action buttons — Linear-style: minimalistas, contraste alto
                no primary (vermelho se IA não recomenda, azul se OK). */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <button
                onClick={() => cancelPreview(targetId)}
                disabled={!!p.executing}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: T.text3,
                  padding: '8px 12px', fontSize: 12.5, fontWeight: 600,
                  cursor: p.executing ? 'default' : 'pointer',
                  fontFamily: F,
                  letterSpacing: '-0.005em',
                  transition: 'color 0.12s ease',
                }}
                onMouseEnter={e => { if (!p.executing) (e.currentTarget as HTMLElement).style.color = T.text2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.text3; }}
              >
                Cancelar
              </button>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {p.verdict === 'wait' && (
                <span style={{
                  fontSize: 11, color: T.yellow, fontWeight: 600,
                  letterSpacing: '-0.005em',
                }}>
                  IA sugere aguardar
                </span>
              )}
              {p.verdict === 'reject' && (
                <span style={{
                  fontSize: 11, color: T.red, fontWeight: 600,
                  letterSpacing: '-0.005em',
                }}>
                  IA não recomenda
                </span>
              )}

              {isAnalyzeMode ? (
                // Analyze-only: primary button just closes the panel.
                <button
                  onClick={() => cancelPreview(targetId)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: T.bg2, border: `1px solid ${T.border2}`,
                    color: T.text1, borderRadius: 7,
                    padding: '9px 16px', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer', fontFamily: F, letterSpacing: '-0.005em',
                    transition: 'transform 0.08s ease, border-color 0.12s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLElement).style.borderColor = T.blue;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                    (e.currentTarget as HTMLElement).style.borderColor = T.border2;
                  }}
                >
                  <Check size={12} strokeWidth={2.3} />
                  Fechar análise
                </button>
              ) : (
                <button
                  onClick={() => confirmPreview(targetId)}
                  disabled={!!p.executing}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: isContrary ? T.red : T.blue,
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: 7,
                    padding: '9px 16px', fontSize: 12.5, fontWeight: 700,
                    cursor: p.executing ? 'default' : 'pointer',
                    fontFamily: F,
                    letterSpacing: '-0.005em',
                    boxShadow: isContrary
                      ? `0 0 0 1px ${T.red}66, 0 1px 2px rgba(0,0,0,0.4)`
                      : `0 0 0 1px ${T.blue}66, 0 1px 2px rgba(0,0,0,0.4)`,
                    opacity: p.executing ? 0.7 : 1,
                    transition: 'transform 0.08s ease, opacity 0.12s ease',
                  }}
                  onMouseEnter={e => { if (!p.executing) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                >
                  {p.executing ? <Loader2 size={12} className="spin" /> : null}
                  {confirmLabel}
                </button>
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
    <div style={{ flex: 1, minHeight: 0, background: T.bg0, padding: '28px 28px 64px', fontFamily: F, color: T.text1, overflow: 'auto' }}>
      {/* Global keyframes + micro-interactions. */}
      <style>{`
        .spin { animation: mgr-spin 0.9s linear infinite; }
        @keyframes mgr-spin { to { transform: rotate(360deg); } }
        @keyframes mgr-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes mgr-slide-down {
          from { opacity: 0; transform: translateY(-4px); max-height: 0; }
          to { opacity: 1; transform: none; max-height: 1200px; }
        }
        /* Campaign card lifts on hover — subtle border + shadow */
        .mgr-camp-card {
          transition: border-color 0.18s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.18s cubic-bezier(0.4,0,0.2,1);
        }
        .mgr-camp-card:hover {
          border-color: rgba(148,163,184,0.16);
          box-shadow: 0 0 0 1px rgba(148,163,184,0.12),
                      0 12px 40px rgba(0,0,0,0.55);
        }
        /* Hover on any row inside card — sutil background tint */
        .mgr-row {
          transition: background 0.12s cubic-bezier(0.4,0,0.2,1);
        }
        .mgr-row:hover {
          background: rgba(148,163,184,0.05);
        }
        .mgr-row-name {
          transition: color 0.12s cubic-bezier(0.4,0,0.2,1);
        }
        .mgr-row:hover .mgr-row-name {
          color: #F1F5F9;
        }
        /* Sticky header — applied to the breadcrumb row so it stays
           visible as the user scrolls through a long campaign tree. */
        .mgr-sticky-header {
          position: sticky;
          top: 0;
          z-index: 8;
          backdrop-filter: blur(16px) saturate(180%);
          background: rgba(6,10,20,0.72);
          margin-left: -28px; margin-right: -28px;
          padding: 12px 28px;
          border-bottom: 1px solid rgba(148,163,184,0.06);
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Sticky header — glass backdrop so the breadcrumb stays
            readable over scrolling content. Negative margins cancel the
            page padding so the blur extends edge-to-edge. */}
        <div className="mgr-sticky-header" style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <button
            onClick={() => navigate('/dashboard/feed')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: T.bg2, color: T.text2,
              border: `1px solid ${T.border1}`,
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: F,
              transition: `color 0.15s ${T.EASE}, border-color 0.15s ${T.EASE}, background 0.15s ${T.EASE}`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = T.text1;
              (e.currentTarget as HTMLElement).style.borderColor = T.border2;
              (e.currentTarget as HTMLElement).style.background = T.bg3;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = T.text2;
              (e.currentTarget as HTMLElement).style.borderColor = T.border1;
              (e.currentTarget as HTMLElement).style.background = T.bg2;
            }}
          >
            <ArrowLeft size={14} strokeWidth={2.3} /> Voltar ao Feed
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} style={{ color: T.purple }} strokeWidth={2.2} />
            <h1 style={{
              fontSize: 18, fontWeight: 700, margin: 0,
              letterSpacing: '-0.015em', color: T.text1,
            }}>
              Gerenciador manual
            </h1>
          </div>
        </div>

        {/* Manual-mode banner — glass card matching Histórico/Contas
            aesthetic: solid slate background, subtle border, blue rail on
            the left, glass backdrop. The "IA analisa" sub-line carries
            the key product promise inline. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: T.CARD, border: `1px solid ${T.border1}`,
          borderLeft: `2px solid ${T.blue}`,
          borderRadius: 12, padding: '14px 18px',
          marginBottom: 20, boxShadow: T.SHD,
          backdropFilter: T.GLASS,
          animation: 'mgr-fade-up 0.28s ease both',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 700, color: T.blue,
            letterSpacing: '0.10em', textTransform: 'uppercase' as const,
            background: 'rgba(37,99,235,0.12)',
            border: '1px solid rgba(37,99,235,0.28)',
            borderRadius: 6,
            padding: '4px 8px', flexShrink: 0,
          }}>
            <Sparkles size={10} strokeWidth={2.3} />
            Manual + IA
          </div>
          <p style={{
            fontSize: 12.5, color: T.text2, lineHeight: 1.6,
            margin: 0, flex: 1, letterSpacing: '-0.005em',
          }}>
            Ajustes pontuais direto na conta Meta. <strong style={{ color: T.text1, fontWeight: 600 }}>Antes de confirmar qualquer ação, a IA analisa o contexto</strong> (idade, performance, tendência) e te diz se faz sentido agora. O fluxo principal continua sendo o <a
              href="/dashboard/feed"
              style={{ color: T.text2, textDecoration: 'underline', textDecorationColor: T.border2, textUnderlineOffset: 2 }}
            >Feed</a> — aqui cada ação fica marcada como manual no <a
              href="/dashboard/history"
              style={{ color: T.text2, textDecoration: 'underline', textDecorationColor: T.border2, textUnderlineOffset: 2 }}
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

        {/* ── KPI strip — 4 glass cards with live account-level numbers.
            Uses the horizontal space that used to sit empty to the right.
            Each card carries: small uppercase label, big tabular number,
            optional color accent. Matches Histórico's stat pattern. */}
        {!loading && !error && metaConnected && campaigns.length > 0 && (() => {
          const brl = (c: number) => {
            if (c >= 100000) return `R$ ${(c / 100000).toFixed(1).replace('.', ',')}k`;
            return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
          };
          const tiles = [
            { label: 'Total', value: String(kpis.total), sub: 'campanhas', tone: T.text1 },
            { label: 'Ativas', value: String(kpis.active), sub: kpis.active === 1 ? 'entregando' : 'entregando', tone: T.green, glow: 'rgba(16,185,129,0.18)' },
            { label: 'Pausadas', value: String(kpis.paused), sub: kpis.paused === 1 ? 'sem entrega' : 'sem entrega', tone: T.text2 },
            { label: 'Budget/dia', value: kpis.dailyBudgetActiveCents > 0 ? brl(kpis.dailyBudgetActiveCents) : '—', sub: 'só ativas', tone: T.blue, glow: 'rgba(37,99,235,0.18)' },
          ];
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10, marginBottom: 14,
              animation: 'mgr-fade-up 0.32s ease 0.06s both',
            }}>
              {tiles.map((t, i) => (
                <div key={i} style={{
                  background: T.CARD, border: `1px solid ${T.border1}`,
                  borderRadius: 12, padding: '14px 16px',
                  boxShadow: t.glow ? `0 0 0 1px ${T.border1}, 0 8px 24px ${t.glow}` : T.SHD,
                  backdropFilter: T.GLASS,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: T.textL,
                    letterSpacing: '0.10em', textTransform: 'uppercase' as const,
                    marginBottom: 6,
                  }}>
                    {t.label}
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 700, color: t.tone,
                    fontVariantNumeric: 'tabular-nums' as const,
                    letterSpacing: '-0.02em', lineHeight: 1.1,
                  }}>
                    {t.value}
                  </div>
                  <div style={{
                    fontSize: 11, color: T.text3, marginTop: 4,
                    letterSpacing: '-0.005em',
                  }}>
                    {t.sub}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Search — glass pill matching the Histórico filter bar. */}
        {!loading && !error && metaConnected && campaigns.length >= 3 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: T.CARD, border: `1px solid ${T.border1}`, borderRadius: 12,
            padding: '11px 16px', marginBottom: 14, boxShadow: T.SHD,
            backdropFilter: T.GLASS,
            animation: 'mgr-fade-up 0.3s ease 0.04s both',
          }}>
            <Search size={15} style={{ color: T.text3, flexShrink: 0 }} strokeWidth={2.2} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar campanha pelo nome…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: T.text1, fontSize: 13.5, fontFamily: F,
                letterSpacing: '-0.005em',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
                style={{
                  background: 'transparent', border: 'none', padding: 4,
                  color: T.text3, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  borderRadius: 6,
                  transition: `color 0.15s ${T.EASE}, background 0.15s ${T.EASE}`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = T.text1;
                  (e.currentTarget as HTMLElement).style.background = T.bg2;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = T.text3;
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <X size={13} strokeWidth={2.3} />
              </button>
            )}
            <span style={{
              fontSize: 11, color: T.textL, fontVariantNumeric: 'tabular-nums' as const,
              fontWeight: 600, letterSpacing: '0.02em',
            }}>
              {sortedCampaigns.length} de {campaigns.length}
            </span>
          </div>
        )}

        {/* Empty-filter state — glass card with search icon so the page
            doesn't feel broken when the user mistypes. */}
        {!loading && !error && metaConnected && campaigns.length > 0 && sortedCampaigns.length === 0 && (
          <div style={{
            background: T.CARD, border: `1px solid ${T.border1}`,
            borderRadius: 14, padding: '32px 20px',
            textAlign: 'center', boxShadow: T.SHD, backdropFilter: T.GLASS,
            animation: 'mgr-fade-up 0.25s ease both',
          }}>
            <div style={{
              width: 44, height: 44, margin: '0 auto 12px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(6,182,212,0.06))',
              border: `1px solid ${T.border1}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.text3,
            }}>
              <Search size={18} strokeWidth={2.2} />
            </div>
            <p style={{
              fontSize: 13.5, fontWeight: 600, color: T.text1, margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}>
              Nenhuma campanha com <span style={{ color: T.blue }}>&quot;{searchQuery}&quot;</span>
            </p>
            <p style={{ fontSize: 12, color: T.text3, margin: '0 0 14px' }}>
              Verifica o nome ou limpa a busca pra ver todas.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: T.bg2, color: T.text2,
                border: `1px solid ${T.border2}`,
                borderRadius: 8, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                transition: `color 0.15s ${T.EASE}, border-color 0.15s ${T.EASE}`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = T.text1;
                (e.currentTarget as HTMLElement).style.borderColor = T.blue;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = T.text2;
                (e.currentTarget as HTMLElement).style.borderColor = T.border2;
              }}
            >
              Limpar busca
            </button>
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
            <div key={c.id} className="mgr-camp-card" style={{
              background: T.CARD, border: `1px solid ${T.border1}`,
              borderRadius: 14, marginBottom: 10, overflow: 'hidden',
              boxShadow: T.SHD, backdropFilter: T.GLASS,
              animation: 'mgr-fade-up 0.3s ease both',
            }}>
              {/* Campaign row */}
              <div className="mgr-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px 14px 16px', minWidth: 0 }}>
                <button
                  onClick={() => toggleCampaign(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                    background: 'transparent', border: 'none', padding: 0,
                    cursor: 'pointer', textAlign: 'left', color: T.text1, fontFamily: F, minWidth: 0,
                  }}
                >
                  {isOpen ? <ChevronDown size={14} style={{ color: T.text3, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: T.text3, flexShrink: 0 }} />}
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: sc.dot, flexShrink: 0,
                    boxShadow: `0 0 0 3px ${sc.glow.replace(/[\d.]+\)$/, '0.15)')}, 0 0 8px ${sc.glow}`,
                  }} />
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
                  <AnalyzeButton
                    inflight={cInflight || !!previews[c.id]?.loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      requestPreview(c.id, 'campaign', c.name, 'analyze');
                    }}
                  />
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

              {/* InlineComment removed — legacy post-action commentary from
                  the old "execute-then-analyze" flow. Now redundant since
                  the Preview panel already carries the full AI analysis
                  BEFORE the user confirms. Keeping `cFeedback.inflight`
                  in place (feeds the action button loading state). */}

              {/* Adsets */}
              {isOpen && (
                <div style={{
                  background: 'rgba(6,10,20,0.55)',
                  borderTop: `1px solid ${T.border1}`,
                }}>
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
                        <div className="mgr-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px 11px 36px', borderTop: `1px solid ${T.border1}`, minWidth: 0 }}>
                          <button
                            onClick={() => toggleAdset(ads.id, c.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                              background: 'transparent', border: 'none', padding: 0,
                              cursor: 'pointer', textAlign: 'left', color: T.text1, fontFamily: F, minWidth: 0,
                            }}
                          >
                            {isAdsetOpen ? <ChevronDown size={12} style={{ color: T.text3, flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: T.text3, flexShrink: 0 }} />}
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: sa.dot, flexShrink: 0,
                              boxShadow: `0 0 6px ${sa.glow}`,
                            }} />
                            <Target size={10} style={{ color: T.text3, flexShrink: 0 }} strokeWidth={2.2} />
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
                            <AnalyzeButton
                              inflight={aInflight || !!previews[ads.id]?.loading}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestPreview(ads.id, 'adset', ads.name, 'analyze');
                              }}
                            />
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

                        {/* Legacy InlineComment removed — see campaign row. */}

                        {/* Ads inside this adset */}
                        {isAdsetOpen && (
                          <div style={{
                            background: 'rgba(15,23,42,0.45)',
                            borderTop: `1px solid ${T.border1}`,
                          }}>
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
                                  <div className="mgr-row" style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px 9px 60px',
                                    borderTop: `1px solid ${T.border1}`,
                                  }}>
                                    <span style={{
                                      width: 4, height: 4, borderRadius: '50%',
                                      background: sAd.dot, flexShrink: 0,
                                      boxShadow: `0 0 5px ${sAd.glow}`,
                                    }} />
                                    <Sparkles size={9} style={{ color: T.purple, flexShrink: 0 }} strokeWidth={2.3} />
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
                                      <AnalyzeButton
                                        inflight={adInflight || !!previews[ad.id]?.loading}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          requestPreview(ad.id, 'ad', ad.name, 'analyze');
                                        }}
                                      />
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
                                  {/* Legacy InlineComment removed — see campaign row. */}
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
