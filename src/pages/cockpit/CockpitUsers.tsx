/**
 * CockpitUsers — paginated, searchable user directory.
 *
 * Data comes from the admin-users-list edge function. Each row links to
 * /cockpit/users/:id which loads CockpitUserDetail (admin-user-summary).
 *
 * Filter state is mirrored into the URL query string so palette deep-links
 * (e.g. /cockpit/users?status=past_due) land in the correct filter and the
 * back button restores the previous view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, ChevronLeft, ChevronRight, Circle, RotateCcw,
  ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Avatar, COLORS, CopyButton, F, Flag, GhostButton, MicroPill, PlanPill,
  SectionTitle, SelectFilter, ToggleChip, PagerBtn,
  relativeTime, shortDateCompact, useHotkey,
} from './_shared';

interface Row {
  user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  plan: string;
  subscription_status: string | null;
  trial_end: string | null;
  signup_at: string;
  /** Last time the user chatted with the AI. Narrow — use last_seen_at for "active". */
  last_ai_action_at: string | null;
  /** Last auth sign-in from auth.users. */
  last_sign_in_at: string | null;
  /** MAX(last_ai_action_at, last_sign_in_at) — the canonical "last seen" signal. */
  last_seen_at: string | null;
  meta_accounts_count: number;
  meta_connected: boolean;
  meta_has_synced: boolean;
  chats_7d: number;
  actions_7d: number;
  flags: { inactive_7d: boolean; no_meta: boolean; past_due: boolean; trial_ending_soon: boolean };
}

interface ListResponse {
  rows: Row[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  returned_count: number;
}

const PLAN_FILTERS = ['any', 'free', 'maker', 'pro', 'studio', 'creator', 'starter', 'scale'];
const STATUS_FILTERS = ['any', 'active', 'trialing', 'past_due', 'canceled', 'none'];
type SortKey = 'signup_desc' | 'signup_asc' | 'last_action_desc' | 'plan_asc';
const SORT_KEYS: SortKey[] = ['signup_desc', 'signup_asc', 'last_action_desc', 'plan_asc'];

const SORT_LABELS: Record<SortKey, string> = {
  signup_desc: 'Newest signup',
  signup_asc: 'Oldest signup',
  last_action_desc: 'Most recently seen',
  plan_asc: 'Plan (asc)',
};

export default function CockpitUsers() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Derive initial state from URL.
  const initial = useMemo(() => ({
    search: params.get('q') ?? '',
    plan: params.get('plan') ?? 'any',
    status: params.get('status') ?? 'any',
    hasMeta: params.get('has_meta') === '1',
    inactive7d: params.get('inactive_7d') === '1',
    sort: (params.get('sort') ?? 'signup_desc') as SortKey,
    page: Math.max(1, Number(params.get('page') ?? '1')),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState(initial.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);
  const [plan, setPlan] = useState<string>(initial.plan);
  const [status, setStatus] = useState<string>(initial.status);
  const [hasMeta, setHasMeta] = useState(initial.hasMeta);
  const [inactive7d, setInactive7d] = useState(initial.inactive7d);
  const [sort, setSort] = useState<SortKey>(
    SORT_KEYS.includes(initial.sort) ? initial.sort : 'signup_desc',
  );
  const [page, setPage] = useState(initial.page);
  const pageSize = 50;

  const searchRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Sync URL from state (so palette deep-links and back button work).
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('q', debouncedSearch);
    if (plan !== 'any') next.set('plan', plan);
    if (status !== 'any') next.set('status', status);
    if (hasMeta) next.set('has_meta', '1');
    if (inactive7d) next.set('inactive_7d', '1');
    if (sort !== 'signup_desc') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, plan, status, hasMeta, inactive7d, sort, page]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: res, error } = await supabase.functions.invoke('admin-users-list', {
          body: {
            page, page_size: pageSize,
            search: debouncedSearch || undefined,
            plan: plan === 'any' ? undefined : plan,
            status: status === 'any' ? undefined : status,
            has_meta: hasMeta || undefined,
            inactive_7d: inactive7d || undefined,
            sort,
          },
        });
        if (!mounted) return;
        if (error) setErr(error.message);
        else if (res?.data) setData(res.data as ListResponse);
        else setErr('empty_response');
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'unknown');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [page, debouncedSearch, plan, status, hasMeta, inactive7d, sort]);

  const totalPages = data?.total_pages ?? 1;

  // Keyboard shortcut: / focuses search; Esc clears if search is focused.
  useHotkey(
    (e) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || tag === 'select';
      return e.key === '/' && !editing && !e.metaKey && !e.ctrlKey;
    },
    (e) => {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    [],
  );

  const hasActiveFilters =
    !!debouncedSearch || plan !== 'any' || status !== 'any' || hasMeta || inactive7d || sort !== 'signup_desc';

  const resetFilters = () => {
    setSearch('');
    setPlan('any');
    setStatus('any');
    setHasMeta(false);
    setInactive7d(false);
    setSort('signup_desc');
    setPage(1);
  };

  // Flag counts across current page, for a "caution" pill in the header.
  const flagCount = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const r of data.rows) {
      if (r.flags.past_due || r.flags.trial_ending_soon) n++;
    }
    return n;
  }, [data]);

  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto',
      padding: '32px 28px 60px', fontFamily: F, color: COLORS.text,
    }}>
      <SectionTitle
        title="Users"
        subtitle={
          data
            ? <>
                <span>{data.total_count.toLocaleString()} total</span>
                <span style={{ color: COLORS.textFaint, margin: '0 6px' }}>·</span>
                <span>showing {data.rows.length}</span>
                {flagCount > 0 && (
                  <>
                    <span style={{ color: COLORS.textFaint, margin: '0 6px' }}>·</span>
                    <span style={{ color: COLORS.warnSoft, fontWeight: 600 }}>
                      {flagCount} need attention
                    </span>
                  </>
                )}
              </>
            : 'Loading…'
        }
        right={
          hasActiveFilters && (
            <GhostButton icon={RotateCcw} onClick={resetFilters} size="sm">
              Reset filters
            </GhostButton>
          )
        }
      />

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 14, padding: 14,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: COLORS.surfaceStrong,
          border: `1px solid ${COLORS.borderStrong}`,
          flex: '1 1 260px', minWidth: 220,
        }}>
          <Search size={14} color={COLORS.textDim} />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape' && search) { e.preventDefault(); setSearch(''); } }}
            placeholder="Search by email or name…  press /  to focus"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: COLORS.text, fontSize: 13, fontFamily: F,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                color: COLORS.textDim, display: 'flex', alignItems: 'center',
              }}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <SelectFilter label="Plan" value={plan} options={PLAN_FILTERS}
          onChange={v => { setPlan(v); setPage(1); }} />
        <SelectFilter label="Status" value={status} options={STATUS_FILTERS}
          onChange={v => { setStatus(v); setPage(1); }} />

        <ToggleChip label="Has Meta" active={hasMeta} onClick={() => { setHasMeta(v => !v); setPage(1); }} />
        <ToggleChip label="Inactive 7d" active={inactive7d} onClick={() => { setInactive7d(v => !v); setPage(1); }} tone="warn" />

        <SelectFilter
          label="Sort"
          value={sort}
          options={SORT_KEYS}
          onChange={v => setSort(v as SortKey)}
          renderOption={(o) => SORT_LABELS[o as SortKey] ?? o}
        />
      </div>

      {/* Table */}
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted, fontSize: 13 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: 'center', color: COLORS.critical, fontSize: 13 }}>Error: {err}</div>
        ) : !data || data.rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>
            No users match the current filters.
            {hasActiveFilters && (
              <div style={{ marginTop: 12 }}>
                <GhostButton icon={RotateCcw} onClick={resetFilters} size="sm">
                  Reset filters
                </GhostButton>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: 'rgba(15,23,42,0.55)',
                  position: 'sticky', top: 0, zIndex: 2,
                }}>
                  <SortableTh
                    label="User"
                    ascKey="signup_asc"
                    descKey="signup_desc"
                    currentSort={sort}
                    onChange={(k) => { setSort(k); setPage(1); }}
                  />
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <SortableTh
                    label="Plan tier"
                    ascKey="plan_asc"
                    descKey="plan_asc"
                    currentSort={sort}
                    onChange={(k) => { setSort(k); setPage(1); }}
                    hideUnlessCurrent
                  />
                  <Th>Meta</Th>
                  <Th align="right">Chats 7d</Th>
                  <Th align="right">Actions 7d</Th>
                  <Th>Signup</Th>
                  <SortableTh
                    label="Last seen"
                    ascKey="last_action_desc"
                    descKey="last_action_desc"
                    currentSort={sort}
                    onChange={(k) => { setSort(k); setPage(1); }}
                  />
                  <Th>Flags</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.user_id}
                    onClick={() => navigate(`/cockpit/users/${r.user_id}`)}
                    style={{
                      borderBottom: `1px solid ${COLORS.divider}`,
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar src={r.avatar_url} name={r.name} email={r.email} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            color: COLORS.text, fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {r.name || '—'}
                          </div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            color: COLORS.textDim, fontSize: 11.5,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.email ?? '—'}
                            </span>
                            {r.email && <CopyButton text={r.email} />}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td><PlanPill plan={r.plan} /></Td>
                    <Td>
                      <SubscriptionStatus status={r.subscription_status} />
                    </Td>
                    <Td>{null}</Td>
                    <Td>
                      {r.meta_connected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: r.meta_has_synced ? COLORS.successSoft : COLORS.warnSoft }}>
                          <Circle size={8} fill="currentColor" color="currentColor" />
                          <span style={{ fontSize: 12 }}>{r.meta_accounts_count} {r.meta_has_synced ? '' : '(unsynced)'}</span>
                        </div>
                      ) : (
                        <span style={{ color: COLORS.textFaint, fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <MetricCell value={r.chats_7d} />
                    </Td>
                    <Td align="right">
                      <MetricCell value={r.actions_7d} />
                    </Td>
                    <Td>{shortDateCompact(r.signup_at)}</Td>
                    <Td>{r.last_seen_at
                      ? relativeTime(r.last_seen_at)
                      : <span style={{ color: COLORS.textFaint }}>never</span>}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.flags.past_due && <Flag text="past_due" tone="critical" />}
                        {r.flags.trial_ending_soon && <Flag text="trial ≤3d" tone="warn" />}
                        {r.flags.inactive_7d && <Flag text="inactive" tone="muted" />}
                        {r.flags.no_meta && <Flag text="no Meta" tone="muted" />}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pager */}
      {data && data.total_pages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 14, fontSize: 12, color: COLORS.textMuted,
        }}>
          <div>
            Page <span style={{ color: COLORS.text, fontWeight: 600 }}>{page}</span> of {totalPages}
            <span style={{ color: COLORS.textFaint, marginLeft: 10 }}>
              {data.total_count.toLocaleString()} users total
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PagerBtn disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Prev
            </PagerBtn>
            <PagerBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={14} />
            </PagerBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small UI helpers ────────────────────────────────────────────────────────
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '10px 14px', textAlign: align,
      color: COLORS.textDim, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {children}
    </th>
  );
}

function SortableTh({
  label, ascKey, descKey, currentSort, onChange, hideUnlessCurrent,
}: {
  label: string;
  ascKey: SortKey;
  descKey: SortKey;
  currentSort: SortKey;
  onChange: (k: SortKey) => void;
  hideUnlessCurrent?: boolean;
}) {
  const isAsc = currentSort === ascKey;
  const isDesc = currentSort === descKey;
  const active = isAsc || isDesc;
  if (hideUnlessCurrent && !active) {
    return <th style={{ padding: 0, width: 0 }} />;
  }
  // One click = toggle asc/desc; if equal, force desc first.
  const next: SortKey = isDesc ? ascKey : descKey;
  return (
    <th style={{
      padding: '10px 14px', textAlign: 'left',
      color: active ? COLORS.textMid : COLORS.textDim,
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      cursor: 'pointer', userSelect: 'none',
    }}
    onClick={() => onChange(next)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {isAsc && <ArrowUp size={11} color={COLORS.accent} />}
        {isDesc && <ArrowDown size={11} color={COLORS.accent} />}
        {!active && <ArrowDown size={10} color={COLORS.textFaint} style={{ opacity: 0.5 }} />}
      </span>
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 14px', textAlign: align, color: COLORS.textMid, fontSize: 13 }}>
      {children}
    </td>
  );
}

function SubscriptionStatus({ status }: { status: string | null }) {
  if (!status) {
    return <span style={{ color: COLORS.textFaint, fontSize: 12 }}>—</span>;
  }
  const color =
    status === 'past_due' ? COLORS.critical :
    status === 'active' ? COLORS.successSoft :
    status === 'trialing' ? COLORS.warnSoft :
    status === 'canceled' ? COLORS.textMuted :
    COLORS.textMuted;
  return (
    <MicroPill tone="raw" color={color}>{status}</MicroPill>
  );
}

function MetricCell({ value }: { value: number }) {
  // Fade zeros to visually quiet them so non-zero rows pop.
  const dim = value === 0;
  return (
    <span style={{
      color: dim ? COLORS.textFaint : COLORS.textMid,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value.toLocaleString()}
    </span>
  );
}
