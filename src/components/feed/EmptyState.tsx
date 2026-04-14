'use client';

import React from 'react';
import { formatMoney } from '../../lib/format';

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

/**
 * EmptyState - Shows when no pending decisions
 * Displays summary of today's actions and next sync time
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  totalAds,
  nextSyncMinutes,
  todaySummary,
}) => {
  return (
    <div className="w-full bg-[#111827] rounded-2xl border border-sky-500/10 p-8 text-center">
      {/* Main heading */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">✅ Tudo otimizado</h2>
        <p className="text-gray-400">
          Seus {totalAds} ads estão performando dentro ou acima do baseline.
        </p>
      </div>

      {/* Next sync */}
      <p className="text-sm text-sky-400 font-semibold mb-8">
        Próxima análise em {nextSyncMinutes} minuto{nextSyncMinutes !== 1 ? 's' : ''}
      </p>

      {/* Today's summary */}
      <div className="bg-[#0f1419] rounded-xl p-6 border border-sky-500/10 text-left">
        <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wide">
          Resumo do dia
        </h3>

        <div className="space-y-3">
          {todaySummary.paused > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">• {todaySummary.paused} ads pausados</span>
              <span className="text-emerald-400 font-semibold">
                economizou {formatMoney(todaySummary.savedToday)}
              </span>
            </div>
          )}

          {todaySummary.scaled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                • {todaySummary.scaled} ad{todaySummary.scaled !== 1 ? 's' : ''} escalado
                {todaySummary.scaled !== 1 ? 's' : ''}
              </span>
              <span className="text-sky-400 font-semibold">
                +{formatMoney(todaySummary.revenueToday)} estimado
              </span>
            </div>
          )}

          {todaySummary.paused === 0 && todaySummary.scaled === 0 && (
            <p className="text-gray-500 text-sm">
              Nenhuma ação executada hoje. Continue monitorando!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
