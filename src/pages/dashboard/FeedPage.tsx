import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { MoneyBar } from '../../components/feed/MoneyBar';
import { SummaryBar } from '../../components/feed/SummaryBar';
import { DecisionCard } from '../../components/feed/DecisionCard';
import { EmptyState } from '../../components/feed/EmptyState';
import { useDecisions } from '../../hooks/useDecisions';
import { useMoneyTracker } from '../../hooks/useMoneyTracker';
import { useActions } from '../../hooks/useActions';
import { useActiveAccount } from '../../hooks/useActiveAccount';
import type { DecisionAction } from '../../types/v2-database';
import { ChevronDown, Link2 } from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'JetBrains Mono', monospace";

/**
 * FeedPage — Copilot Feed: Decision Cards (KILL / FIX / SCALE)
 * Now properly resolves persona → platform_connections → ad_accounts (v2)
 */
const FeedPage: React.FC = () => {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  // Resolve the active Meta ad account (v2 UUID) from persona
  const {
    account: activeAccount,
    isLoading: accountLoading,
    isConnected,
    switchAccount,
  } = useActiveAccount(user?.id, selectedPersona?.id ?? null);

  // Use the v2 ad_accounts UUID for queries — NOT persona ID
  const accountId = activeAccount?.id ?? null;

  const { decisions, isLoading: decisionsLoading } = useDecisions(accountId);
  const { tracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  const [switcherOpen, setSwitcherOpen] = useState(false);

  const isLoading = accountLoading || (accountId ? (decisionsLoading || trackerLoading) : false);

  const handleAction = async (decisionId: string, action: DecisionAction) => {
    try {
      await executeAction(decisionId, action.meta_api_action || action.type, 'ad', '');
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  // Stop all losses: execute all pending kill decisions
  const handleStopLosses = async () => {
    const killDecisions = decisions.filter(d => d.type === 'kill' && d.status === 'pending');
    for (const decision of killDecisions) {
      const primaryAction = decision.actions?.[0];
      if (primaryAction) {
        try {
          await handleAction(decision.id, primaryAction);
        } catch (err) {
          console.error('Stop loss failed for', decision.id, err);
        }
      }
    }
  };

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 24,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: 120, height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ width: 80, height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 16,
            }}>
              <div style={{ width: '40%', height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 12 }} />
              <div style={{ width: '75%', height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ width: '50%', height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── No Meta connection — prompt to connect ──
  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
              Copilot Feed
            </h1>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '48px 32px',
            textAlign: 'center', fontFamily: F,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(24,119,242,0.08)',
              border: '1px solid rgba(24,119,242,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 24,
            }}>
              <Link2 size={24} color="#1877F2" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Conecte sua conta Meta Ads
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 24px', lineHeight: 1.5 }}>
              O Copilot precisa de acesso à sua conta para analisar anúncios e gerar decisões automaticamente.
            </p>
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                background: '#1877F2', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 28px',
                fontSize: 14, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1565D8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1877F2'; }}
            >
              Conectar conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingDecisions = decisions.filter(d => d.status === 'pending');
  const hasKills = pendingDecisions.some(d => d.type === 'kill');
  const hasMultipleAccounts = (activeAccount?.allAccounts?.length || 0) > 1;

  return (
    <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
                Copilot Feed
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0', fontFamily: F }}>
                Decisões baseadas no desempenho real da sua conta
              </p>
            </div>
            {pendingDecisions.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.30)',
                fontFamily: F,
              }}>
                {pendingDecisions.length} pendente{pendingDecisions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Account switcher */}
          {activeAccount && (
            <div style={{ marginTop: 12, position: 'relative' }}>
              <button
                onClick={() => hasMultipleAccounts && setSwitcherOpen(!switcherOpen)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '6px 12px',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  cursor: hasMultipleAccounts ? 'pointer' : 'default',
                  fontFamily: F, transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (hasMultipleAccounts) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#34d399',
                  boxShadow: '0 0 4px rgba(52,211,153,0.4)',
                }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', fontWeight: 500 }}>
                  {activeAccount.name}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: M }}>
                  {activeAccount.metaAccountId}
                </span>
                {hasMultipleAccounts && (
                  <ChevronDown size={12} color="rgba(255,255,255,0.30)"
                    style={{ transform: switcherOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
                )}
              </button>

              {/* Dropdown */}
              {switcherOpen && hasMultipleAccounts && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: '#0d0f14', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 10, padding: 4, minWidth: 280, zIndex: 20,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  {activeAccount.allAccounts.map(acc => {
                    const isActive = acc.id === activeAccount.metaAccountId;
                    return (
                      <button
                        key={acc.id}
                        onClick={async () => {
                          if (!isActive) await switchAccount(acc.id);
                          setSwitcherOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '8px 12px', borderRadius: 6,
                          background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          fontFamily: F, transition: 'background 0.1s',
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: isActive ? '#34d399' : 'rgba(255,255,255,0.15)',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#fff' : 'rgba(255,255,255,0.60)' }}>
                            {acc.name || acc.id}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: M }}>
                            {acc.id}
                          </div>
                        </div>
                        {isActive && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>
                            ATIVO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Money tracker */}
        {tracker && (
          <div style={{ marginBottom: 24 }}>
            <MoneyBar
              leaking={tracker.leaking_now}
              capturable={tracker.capturable_now}
              totalSaved={tracker.total_saved}
              onStopLosses={hasKills ? handleStopLosses : undefined}
            />
          </div>
        )}

        {/* Summary pills */}
        {pendingDecisions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Decision cards or empty state */}
        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pendingDecisions.map(decision => (
              <DecisionCard key={decision.id} decision={decision} onAction={handleAction} />
            ))}
          </div>
        ) : (
          <EmptyState totalAds={0} nextSyncMinutes={0} todaySummary={{ paused: 0, scaled: 0, savedToday: 0, revenueToday: 0 }} />
        )}
      </div>
    </div>
  );
};

export default FeedPage;
