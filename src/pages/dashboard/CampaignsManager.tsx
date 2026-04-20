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
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronRight, ChevronDown, ArrowLeft, Layers, Target, Sparkles,
  Pause, Play, Loader2, Copy, Check, X, Pencil,
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

  // ── Session state ───────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) setUserId(data.user.id);
    })();
  }, []);

  // Get selected account + persona from platform_connections
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('platform_connections')
        .select('selected_account_id, ad_accounts, persona_id')
        .eq('user_id', userId)
        .eq('platform', 'meta')
        .eq('status', 'active')
        .maybeSingle();
      const sel = data?.selected_account_id || (Array.isArray(data?.ad_accounts) ? data.ad_accounts[0]?.account_id : null);
      if (sel) setAccountId(sel);
      if (data?.persona_id) setPersonaId(data.persona_id);
    })();
  }, [userId]);

  // ── Data ────────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsetsByCampaign, setAdsetsByCampaign] = useState<Record<string, AdSet[]>>({});
  const [adsByAdset, setAdsByAdset] = useState<Record<string, Ad[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<Record<string, boolean>>({});
  const [loadingAds, setLoadingAds] = useState<Record<string, boolean>>({});
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  // Per-target action feedback (keyed by target_id)
  const [feedback, setFeedback] = useState<Record<string, ActionFeedback>>({});

  // ── Load campaigns ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !accountId) return;
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
  }, [userId, personaId, accountId]);

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
        const { data } = await supabase.functions.invoke('meta-actions', {
          body: { user_id: userId, persona_id: personaId, account_id: accountId, action: 'list_adsets', target_id: campaignId },
        });
        const list: AdSet[] = (((data as any)?.adsets) || []).map((a: any) => ({
          ...a, campaign_id: campaignId,
        }));
        setAdsetsByCampaign(prev => ({ ...prev, [campaignId]: list }));
      } catch {
        setAdsetsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
      } finally {
        setLoadingAdsets(prev => ({ ...prev, [campaignId]: false }));
      }
    }
  }, [adsetsByCampaign, userId, personaId, accountId]);

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
        const { data } = await supabase.functions.invoke('meta-actions', {
          body: { user_id: userId, persona_id: personaId, account_id: accountId, action: 'list_ads', target_id: adsetId },
        });
        const list: Ad[] = (((data as any)?.ads) || []).map((a: any) => ({
          ...a, adset_id: adsetId, campaign_id: campaignId,
        }));
        setAdsByAdset(prev => ({ ...prev, [adsetId]: list }));
      } catch {
        setAdsByAdset(prev => ({ ...prev, [adsetId]: [] }));
      } finally {
        setLoadingAds(prev => ({ ...prev, [adsetId]: false }));
      }
    }
  }, [adsByAdset, userId, personaId, accountId]);

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
      const { data: actionData, error: actionErr } = await supabase.functions.invoke('meta-actions', {
        body: {
          user_id: userId,
          persona_id: personaId,
          action: metaAction,
          target_id: targetId,
          target_type: targetType,
          target_name: targetName,
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

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const sa = (a.effective_status || a.status || '').toUpperCase();
      const sb = (b.effective_status || b.status || '').toUpperCase();
      const order = (s: string) => s === 'ACTIVE' ? 0 : s === 'PAUSED' ? 1 : s.includes('LEARNING') ? 0 : 2;
      return order(sa) - order(sb);
    });
  }, [campaigns]);

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
              Campanhas
            </h1>
          </div>
        </div>

        <p style={{ fontSize: 12, color: T.text3, margin: '0 0 18px' }}>
          Pause, ative ou ajuste qualquer campanha, conjunto ou anúncio. A cada ação, o Estrategista analisa os últimos 30 dias e explica o impacto.
        </p>

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

        {!loading && !error && campaigns.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3, fontSize: 13 }}>
            Nenhuma campanha encontrada nesta conta.
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
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    inflight={cInflight}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(c.id, 'campaign', c.effective_status || c.status, c.name);
                    }}
                  />
                  <DuplicateButton
                    inflight={cInflight}
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicate(c.id, 'campaign', c.name);
                    }}
                  />
                </div>
              </div>

              <InlineComment feedback={cFeedback} indent={40} />

              {/* Adsets */}
              {isOpen && (
                <div style={{ background: T.bg0, borderTop: `1px solid ${T.border0}` }}>
                  {loadingThisAdsets && (
                    <div style={{ padding: 12, fontSize: 11.5, color: T.text3, textAlign: 'center' }}>
                      Carregando conjuntos…
                    </div>
                  )}
                  {!loadingThisAdsets && adsets.length === 0 && (
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
                            <span style={{ flex: 1, fontSize: 12, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                              inflight={aInflight}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatus(ads.id, 'adset', ads.effective_status || ads.status, ads.name);
                              }}
                            />
                            <DuplicateButton
                              inflight={aInflight}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicate(ads.id, 'adset', ads.name);
                              }}
                            />
                          </div>
                        </div>

                        <InlineComment feedback={aFeedback} indent={60} />

                        {/* Ads inside this adset */}
                        {isAdsetOpen && (
                          <div style={{ background: T.bg1, borderTop: `1px solid ${T.border0}` }}>
                            {loadingThisAds && (
                              <div style={{ padding: 10, paddingLeft: 60, fontSize: 11, color: T.text3 }}>
                                Carregando anúncios…
                              </div>
                            )}
                            {!loadingThisAds && ads_.length === 0 && (
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
                                    <span style={{ flex: 1, fontSize: 11.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {ad.name}
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: sAd.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                      {sAd.label}
                                    </span>
                                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                      <ActionButton
                                        kind={adPaused ? 'activate' : 'pause'}
                                        inflight={adInflight}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleStatus(ad.id, 'ad', ad.effective_status || ad.status, ad.name);
                                        }}
                                      />
                                      <DuplicateButton
                                        inflight={adInflight}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          duplicate(ad.id, 'ad', ad.name);
                                        }}
                                      />
                                    </div>
                                  </div>
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
