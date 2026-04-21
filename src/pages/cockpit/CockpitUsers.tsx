/**
 * CockpitUsers — paginated, searchable user directory.
 *
 * Data comes from the admin-users-list edge function. Each row links to
 * /cockpit/users/:id which loads CockpitUserDetail (admin-user-summary).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Plus Jakarta Sans', sans-serif";

interface Row {
  user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  plan: string;
  subscription_status: string | null;
  trial_end: string | null;
  signup_at: string;
  last_ai_action_at: string | null;
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

export default function CockpitUsers() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [plan, setPlan] = useState<string>('any');
  const [status, setStatus] = useState<string>('any');
  const [hasMeta, setHasMeta] = useState(false);
  const [inactive7d, setInactive7d] = useState(false);
  const [sort, setSort] = useState<'signup_desc' | 'signup_asc' | 'last_action_desc' | 'plan_asc'>('signup_desc');
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

  const planPill = useMemo(() => (p: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      free:   { bg: 'rgba(148,163,184,0.08)', fg: '#94A3B8' },
      maker:  { bg: 'rgba(6,182,212,0.10)',   fg: '#67E8F9' },
      creator:{ bg: 'rgba(6,182,212,0.10)',   fg: '#67E8F9' },
      pro:    { bg: 'rgba(37,99,235,0.14)',   fg: '#93C5FD' },
      starter:{ bg: 'rgba(37,99,235,0.14)',   fg: '#93C5FD' },
      studio: { bg: 'rgba(168,85,247,0.14)',  fg: '#D8B4FE' },
      scale:  { bg: 'rgba(168,85,247,0.14)',  fg: '#D8B4FE' },
    };
    const c = colors[p] ?? colors.free;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 999,
        background: c.bg, color: c.fg,
        fontSize: 10.5, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {p}
      </span>
    );
  }, []);

  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto',
      padding: '32px 28px 60px', fontFamily: F, color: '#E2E8F0',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Users</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
          {data ? `${data.total_count.toLocaleString()} total — showing ${data.rows.length}` : 'Loading…'}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 14, padding: 14,
        background: 'rgba(15,23,42,0.40)',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: 'rgba(15,23,42,0.70)',
          border: '1px solid rgba(148,163,184,0.10)',
          flex: '1 1 260px', minWidth: 220,
        }}>
          <Search size={14} color="#64748B" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#E2E8F0', fontSize: 13, fontFamily: F,
            }}
          />
        </div>

        <SelectFilter label="Plan" value={plan} options={PLAN_FILTERS}
          onChange={v => { setPlan(v); setPage(1); }} />
        <SelectFilter label="Status" value={status} options={STATUS_FILTERS}
          onChange={v => { setStatus(v); setPage(1); }} />

        <ToggleChip label="Has Meta" active={hasMeta} onClick={() => { setHasMeta(v => !v); setPage(1); }} />
        <ToggleChip label="Inactive 7d" active={inactive7d} onClick={() => { setInactive7d(v => !v); setPage(1); }} />

        <SelectFilter label="Sort" value={sort} options={['signup_desc', 'signup_asc', 'last_action_desc', 'plan_asc']}
          onChange={v => setSort(v as any)} />
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(15,23,42,0.40)',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#EF4444', fontSize: 13 }}>Error: {err}</div>
        ) : !data || data.rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No users match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                  <Th>User</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Meta</Th>
                  <Th align="right">Chats 7d</Th>
                  <Th align="right">Actions 7d</Th>
                  <Th>Signup</Th>
                  <Th>Last action</Th>
                  <Th>Flags</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.user_id}
                    onClick={() => navigate(`/cockpit/users/${r.user_id}`)}
                    style={{
                      borderBottom: '1px solid rgba(148,163,184,0.04)',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: 'rgba(148,163,184,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#94A3B8', fontSize: 11, fontWeight: 600,
                          overflow: 'hidden',
                        }}>
                          {r.avatar_url
                            ? <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (r.name ?? r.email ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#F1F5F9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.name || '—'}
                          </div>
                          <div style={{ color: '#64748B', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.email ?? '—'}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>{planPill(r.plan)}</Td>
                    <Td>
                      <span style={{
                        color: r.subscription_status === 'past_due' ? '#EF4444'
                             : r.subscription_status === 'active' ? '#86EFAC'
                             : r.subscription_status === 'trialing' ? '#FCD34D'
                             : '#64748B',
                        fontSize: 12, fontWeight: 500,
                        textTransform: 'capitalize',
                      }}>
                        {r.subscription_status ?? '—'}
                      </span>
                    </Td>
                    <Td>
                      {r.meta_connected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: r.meta_has_synced ? '#86EFAC' : '#FCD34D' }}>
                          <Circle size={8} fill="currentColor" color="currentColor" />
                          <span style={{ fontSize: 12 }}>{r.meta_accounts_count} {r.meta_has_synced ? '' : '(unsynced)'}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td align="right">{r.chats_7d}</Td>
                    <Td align="right">{r.actions_7d}</Td>
                    <Td>{shortDate(r.signup_at)}</Td>
                    <Td>{r.last_ai_action_at ? relativeTime(r.last_ai_action_at) : <span style={{ color: '#475569' }}>never</span>}</Td>
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
          marginTop: 14, fontSize: 12, color: '#94A3B8',
        }}>
          <div>
            Page {page} of {totalPages}
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
      color: '#64748B', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {children}
    </th>
  );
}
function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 14px', textAlign: align, color: '#CBD5E1', fontSize: 13 }}>
      {children}
    </td>
  );
}
function Flag({ text, tone }: { text: string; tone: 'critical' | 'warn' | 'muted' }) {
  const map = {
    critical: { bg: 'rgba(239,68,68,0.12)', fg: '#FCA5A5' },
    warn:     { bg: 'rgba(245,158,11,0.12)', fg: '#FCD34D' },
    muted:    { bg: 'rgba(148,163,184,0.10)', fg: '#94A3B8' },
  }[tone];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 999,
      background: map.bg, color: map.fg,
      fontSize: 10.5, fontWeight: 500,
    }}>
      {text}
    </span>
  );
}
function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Filter size={12} color="#64748B" />
      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(15,23,42,0.70)',
          border: '1px solid rgba(148,163,184,0.10)',
          borderRadius: 8, padding: '6px 10px',
          color: '#E2E8F0', fontSize: 12, fontFamily: F,
          outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999,
        background: active ? 'rgba(37,99,235,0.14)' : 'rgba(15,23,42,0.70)',
        border: `1px solid ${active ? 'rgba(37,99,235,0.40)' : 'rgba(148,163,184,0.10)'}`,
        color: active ? '#93C5FD' : '#94A3B8',
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        fontFamily: F,
      }}
    >
      {label}
    </button>
  );
}
function PagerBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 8,
        background: 'rgba(15,23,42,0.70)',
        border: '1px solid rgba(148,163,184,0.10)',
        color: disabled ? '#475569' : '#CBD5E1',
        fontSize: 12, fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { year: '2-digit', month: 'short', day: 'numeric' });
}
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return shortDate(iso);
}
