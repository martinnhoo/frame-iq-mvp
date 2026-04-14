import React from 'react';
import { formatMoney } from '../../lib/format';

const F = "'Plus Jakarta Sans', sans-serif";

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
}

export const EmptyState: React.FC<EmptyStateProps> = ({ totalAds, nextSyncMinutes, todaySummary }) => {
  const hasActivity = todaySummary.paused > 0 || todaySummary.scaled > 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: '40px 32px',
      textAlign: 'center',
      fontFamily: F,
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Tudo otimizado
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', margin: '0 0 20px' }}>
        {totalAds > 0
          ? `Seus ${totalAds} ads estão performando dentro ou acima do baseline.`
          : 'Conecte uma conta Meta para começar a receber decisões.'
        }
      </p>

      {nextSyncMinutes > 0 && (
        <p style={{ fontSize: 13, color: '#0da2e7', fontWeight: 600, margin: '0 0 24px' }}>
          Próxima análise em {nextSyncMinutes} minuto{nextSyncMinutes !== 1 ? 's' : ''}
        </p>
      )}

      {hasActivity && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 10, padding: 20, textAlign: 'left',
          maxWidth: 400, margin: '0 auto',
        }}>
          <h3 style={{
            fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px',
          }}>
            Resumo do dia
          </h3>
          {todaySummary.paused > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.50)' }}>• {todaySummary.paused} ads pausados</span>
              <span style={{ color: '#34d399', fontWeight: 600 }}>economizou {formatMoney(todaySummary.savedToday)}</span>
            </div>
          )}
          {todaySummary.scaled > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.50)' }}>• {todaySummary.scaled} ads escalados</span>
              <span style={{ color: '#0da2e7', fontWeight: 600 }}>+{formatMoney(todaySummary.revenueToday)} estimado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
