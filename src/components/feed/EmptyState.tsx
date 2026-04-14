import React, { useEffect, useState } from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'DM Mono', 'JetBrains Mono', monospace";

interface TodaySummary {
  paused: number;
  scaled: number;
  savedToday: number;
  revenueToday: number;
}

interface EmptyStateProps {
  totalAds: number;
  nextSyncMinutes: number;
  todaySummary: TodaySummary;
  /** When true, Meta is connected — show "monitoring" state instead of "connect" nudge */
  connected?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ totalAds, nextSyncMinutes, todaySummary, connected }) => {
  const hasActivity = todaySummary.paused > 0 || todaySummary.scaled > 0;
  const hasSaved = todaySummary.savedToday > 0;
  const [dots, setDots] = useState('');

  // Animated dots for "monitoring" feel
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // If no account connected yet (and not explicitly told we're connected)
  if (totalAds === 0 && !hasActivity && !connected) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '48px 32px',
        textAlign: 'center', fontFamily: F,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(13,162,231,0.08)',
          border: '1px solid rgba(13,162,231,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 22,
        }}>
          📡
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Conecte uma conta Meta Ads
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', lineHeight: 1.5 }}>
          O Copilot vai analisar seus anúncios e gerar decisões automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '40px 32px',
      textAlign: 'center', fontFamily: F,
    }}>
      {/* Monitoring pulse indicator */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(16,185,129,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#34d399',
          boxShadow: '0 0 8px rgba(52,211,153,0.4)',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Monitorando em tempo real
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
        Nenhuma ação necessária neste momento{dots}
      </p>

      {nextSyncMinutes > 0 && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '8px 0 0' }}>
          Próxima análise em {nextSyncMinutes} minuto{nextSyncMinutes !== 1 ? 's' : ''}
        </p>
      )}

      {/* Today's outcome summary */}
      {(hasActivity || hasSaved) && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 10, padding: '16px 20px', textAlign: 'left',
          maxWidth: 420, margin: '24px auto 0',
        }}>
          <h3 style={{
            fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px',
          }}>
            Resultado do dia
          </h3>

          {hasSaved && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: hasActivity ? 12 : 0 }}>
              <span style={{
                fontSize: 20, fontWeight: 800, color: '#34d399',
                fontFamily: M, letterSpacing: '-0.02em',
              }}>
                {formatMoney(todaySummary.savedToday)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                economizado hoje
              </span>
            </div>
          )}

          {hasActivity && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {todaySummary.paused > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.paused} anúncio{todaySummary.paused !== 1 ? 's' : ''} pausado{todaySummary.paused !== 1 ? 's' : ''}
                </span>
              )}
              {todaySummary.scaled > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {todaySummary.scaled} anúncio{todaySummary.scaled !== 1 ? 's' : ''} escalado{todaySummary.scaled !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};
