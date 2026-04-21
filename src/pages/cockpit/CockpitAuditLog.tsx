/**
 * CockpitAuditLog — paginated, filterable view over admin_audit_log.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  COLORS, CopyButton, F, GhostButton, MONO, PagerBtn, SectionTitle, SelectFilter,
  longDateTime, relativeTime,
} from './_shared';

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  admin: { user_id: string; email: string | null };
  target: {
    user_id: string | null; email: string | null;
    resource: string | null; resource_id: string | null;
  };
}

interface AuditResponse {
  rows: AuditRow[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

const PREFIX_OPTIONS: Array<{ v: string; l: string }> = [
  { v: '', l: 'All actions' },
  { v: 'users.', l: 'users.*' },
  { v: 'user_summary.', l: 'user_summary.*' },
  { v: 'metrics.', l: 'metrics.*' },
  { v: 'audit_log.', l: 'audit_log.*' },
];

export default function CockpitAuditLog() {
  const navigate = useNavigate();

  const [actionPrefix, setActionPrefix] = useState<string>('');
  const [textFilter, setTextFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: res, error } = await supabase.functions.invoke('admin-audit-log', {
          body: {
            page, page_size: pageSize,
            action_prefix: actionPrefix || undefined,
          },
        });
        if (!mounted) return;
        if (error) setErr(error.message);
        else if (res?.data) {
          setData(res.data as AuditResponse);
          // Reset expand state when we navigate pages.
          setExpanded(new Set());
          setExpandAll(false);
        }
        else setErr('empty_response');
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'unknown');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [page, actionPrefix]);

  // Client-side text filter (on loaded page). Cheap and useful for scanning.
  const visibleRows = useMemo(() => {
    if (!data) return [];
    const q = textFilter.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter(r => {
      return (
        r.action.toLowerCase().includes(q)
        || (r.admin.email ?? '').toLowerCase().includes(q)
        || (r.target.email ?? '').toLowerCase().includes(q)
        || (r.target.resource ?? '').toLowerCase().includes(q)
        || (r.target.resource_id ?? '').toLowerCase().includes(q)
        || (r.request_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, textFilter]);

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (!data) return;
    if (expandAll) {
      setExpanded(new Set());
      setExpandAll(false);
    } else {
      setExpanded(new Set(visibleRows.map(r => r.id)));
      setExpandAll(true);
    }
  };

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '32px 28px 60px', fontFamily: F, color: COLORS.text,
    }}>
      <SectionTitle
        title="Audit log"
        subtitle={
          <>
            {data ? `${data.total_count.toLocaleString()} entries total` : 'Loading…'}
            <span style={{ color: COLORS.textFaint, margin: '0 6px' }}>·</span>
            append-only; every cockpit action is recorded here.
          </>
        }
        right={
          visibleRows.length > 0 && (
            <GhostButton
              icon={expandAll ? Minimize2 : Maximize2}
              onClick={toggleExpandAll}
              size="sm"
            >
              {expandAll ? 'Collapse all' : 'Expand all'}
            </GhostButton>
          )
        }
      />

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 14, padding: 12,
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
            value={textFilter}
            onChange={e => setTextFilter(e.target.value)}
            placeholder="Filter on this page (action, email, request id…)"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: COLORS.text, fontSize: 12.5, fontFamily: F,
            }}
          />
          {textFilter && (
            <button
              onClick={() => setTextFilter('')}
              style={{
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                color: COLORS.textDim, display: 'flex', alignItems: 'center',
              }}
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <SelectFilter
          label="Action prefix"
          value={actionPrefix}
          options={PREFIX_OPTIONS.map(o => o.v)}
          onChange={v => { setActionPrefix(v); setPage(1); }}
          renderOption={(o) => PREFIX_OPTIONS.find(p => p.v === o)?.l ?? 'All actions'}
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
          <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>No entries.</div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>
            No entries match "{textFilter}" on this page.
          </div>
        ) : (
          <div>
            {visibleRows.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <div key={r.id} style={{
                  padding: '10px 14px',
                  borderBottom: `1px solid ${COLORS.divider}`,
                  fontSize: 12.5,
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div
                    onClick={() => toggleRow(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      title={longDateTime(r.created_at)}
                      style={{
                        fontSize: 11, color: COLORS.textDim,
                        width: 110, flexShrink: 0,
                        fontFamily: MONO,
                      }}
                    >
                      {relativeTime(r.created_at)}
                    </div>
                    <div style={{
                      padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(37,99,235,0.12)', color: '#93C5FD',
                      fontSize: 10.5, fontWeight: 600, flexShrink: 0,
                      fontFamily: MONO,
                    }}>
                      {r.action}
                    </div>
                    <div style={{
                      color: COLORS.textMid, flex: 1, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      by <span style={{ color: COLORS.text, fontWeight: 600 }}>{r.admin.email ?? r.admin.user_id}</span>
                      {r.target.user_id && (
                        <>
                          {' · on '}
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/cockpit/users/${r.target.user_id}`); }}
                            style={{
                              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              color: '#93C5FD', textDecoration: 'underline', fontFamily: F, fontSize: 12.5,
                            }}
                          >
                            {r.target.email ?? r.target.user_id}
                          </button>
                        </>
                      )}
                      {r.target.resource && !r.target.user_id && (
                        <span style={{ color: COLORS.textDim }}>
                          {' · '}{r.target.resource}{r.target.resource_id ? ' · ' + r.target.resource_id : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: COLORS.textFaint }}>
                      {isOpen ? '▾' : '▸'}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{
                      marginTop: 10, padding: 12, borderRadius: 8,
                      background: COLORS.surfaceStrong,
                      border: `1px solid ${COLORS.border}`,
                      fontSize: 11.5,
                    }}>
                      <DetailRow label="Admin" value={`${r.admin.email ?? '—'} · ${r.admin.user_id}`} copyableValue={r.admin.user_id} />
                      {r.target.user_id && (
                        <DetailRow label="Target user" value={`${r.target.email ?? '—'} · ${r.target.user_id}`} copyableValue={r.target.user_id} />
                      )}
                      {r.target.resource && (
                        <DetailRow label="Target resource" value={`${r.target.resource}${r.target.resource_id ? ' · ' + r.target.resource_id : ''}`} />
                      )}
                      <DetailRow label="When" value={longDateTime(r.created_at)} />
                      <DetailRow label="IP" value={r.ip ?? '—'} />
                      <DetailRow label="Request ID" value={r.request_id ?? '—'} copyableValue={r.request_id ?? undefined} />
                      <DetailRow label="User-Agent" value={r.user_agent ?? '—'} />
                      {Object.keys(r.metadata ?? {}).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: 3,
                          }}>
                            <span style={{
                              fontSize: 10, color: COLORS.textDim, fontWeight: 600,
                              letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>
                              Metadata
                            </span>
                            <CopyButton
                              text={JSON.stringify(r.metadata, null, 2)}
                              label="JSON"
                            />
                          </div>
                          <pre style={{
                            margin: 0, padding: 8,
                            background: 'rgba(0,0,0,0.30)', borderRadius: 6,
                            fontSize: 11, color: COLORS.textMid,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            fontFamily: MONO,
                          }}>
                            {JSON.stringify(r.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
            Page <span style={{ color: COLORS.text, fontWeight: 600 }}>{page}</span> of {data.total_pages}
            {textFilter && data && (
              <span style={{ color: COLORS.textFaint, marginLeft: 10 }}>
                {visibleRows.length} of {data.rows.length} on this page match
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PagerBtn disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Prev
            </PagerBtn>
            <PagerBtn disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={14} />
            </PagerBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label, value, copyableValue,
}: {
  label: string; value: string; copyableValue?: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center',
      padding: '4px 0',
      borderBottom: `1px solid ${COLORS.divider}`,
    }}>
      <span style={{ color: COLORS.textDim, width: 100, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{
        color: COLORS.textMid, flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: MONO, fontSize: 11,
      }}>
        {value}
      </span>
      {copyableValue && copyableValue !== '—' && (
        <CopyButton text={copyableValue} size={10} />
      )}
    </div>
  );
}
