/**
 * CockpitAuditLog — paginated, filterable view over admin_audit_log.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Plus Jakarta Sans', sans-serif";

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

export default function CockpitAuditLog() {
  const navigate = useNavigate();

  const [actionPrefix, setActionPrefix] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

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
        else if (res?.data) setData(res.data as AuditResponse);
        else setErr('empty_response');
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'unknown');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [page, actionPrefix]);

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '32px 28px 60px', fontFamily: F, color: '#E2E8F0',
    }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Audit log</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
          {data ? `${data.total_count.toLocaleString()} entries total` : 'Loading…'}
          {' · '}append-only; every cockpit action is recorded here.
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 14, padding: 12,
        background: 'rgba(15,23,42,0.40)',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={12} color="#64748B" />
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Action prefix
          </span>
          <select
            value={actionPrefix}
            onChange={e => { setActionPrefix(e.target.value); setPage(1); }}
            style={{
              background: 'rgba(15,23,42,0.70)',
              border: '1px solid rgba(148,163,184,0.10)',
              borderRadius: 8, padding: '6px 10px',
              color: '#E2E8F0', fontSize: 12, fontFamily: F,
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All actions</option>
            <option value="users.">users.*</option>
            <option value="user_summary.">user_summary.*</option>
            <option value="metrics.">metrics.*</option>
          </select>
        </div>
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
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No entries.</div>
        ) : (
          <div>
            {data.rows.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(148,163,184,0.04)',
                  fontSize: 12.5,
                }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      fontSize: 11, color: '#64748B',
                      width: 130, flexShrink: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}>
                      {new Date(r.created_at).toLocaleString('pt-BR', {
                        year: '2-digit', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </div>
                    <div style={{
                      padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(37,99,235,0.12)', color: '#93C5FD',
                      fontSize: 10.5, fontWeight: 600, flexShrink: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}>
                      {r.action}
                    </div>
                    <div style={{ color: '#CBD5E1', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      by <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{r.admin.email ?? r.admin.user_id}</span>
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
                    </div>
                    <div style={{ fontSize: 10.5, color: '#475569' }}>
                      {isOpen ? '▾' : '▸'}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{
                      marginTop: 10, padding: 12, borderRadius: 8,
                      background: 'rgba(15,23,42,0.70)',
                      border: '1px solid rgba(148,163,184,0.08)',
                      fontSize: 11.5,
                    }}>
                      <DetailRow label="Admin" value={`${r.admin.email ?? '—'} · ${r.admin.user_id}`} />
                      {r.target.user_id && (
                        <DetailRow label="Target user" value={`${r.target.email ?? '—'} · ${r.target.user_id}`} />
                      )}
                      {r.target.resource && (
                        <DetailRow label="Target resource" value={`${r.target.resource}${r.target.resource_id ? ' · ' + r.target.resource_id : ''}`} />
                      )}
                      <DetailRow label="IP" value={r.ip ?? '—'} />
                      <DetailRow label="Request ID" value={r.request_id ?? '—'} />
                      <DetailRow label="User-Agent" value={r.user_agent ?? '—'} />
                      {Object.keys(r.metadata ?? {}).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
                            Metadata
                          </div>
                          <pre style={{
                            margin: 0, padding: 8,
                            background: 'rgba(0,0,0,0.30)', borderRadius: 6,
                            fontSize: 11, color: '#CBD5E1',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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
          marginTop: 14, fontSize: 12, color: '#94A3B8',
        }}>
          <div>Page {page} of {data.total_pages}</div>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '4px 0',
      borderBottom: '1px solid rgba(148,163,184,0.04)',
    }}>
      <span style={{ color: '#64748B', width: 100, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{
        color: '#CBD5E1', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
      }}>
        {value}
      </span>
    </div>
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
