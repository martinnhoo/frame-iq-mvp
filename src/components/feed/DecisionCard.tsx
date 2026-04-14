'use client';

import React, { useState } from 'react';
import type { Decision, DecisionAction } from '../../types/database';

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
}

/**
 * DecisionCard - Core actionable decision card
 * Type-specific styling (KILL, FIX, SCALE, INSIGHT)
 */
export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  onAction,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Determine colors and badge based on type
  const getTypeConfig = (type: Decision['type']) => {
    switch (type) {
      case 'kill':
        return {
          borderColor: 'border-red-500',
          badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
          badgeLabel: '🛑 PARAR',
          buttonColor: 'bg-red-500 hover:bg-red-600 text-white',
          secondaryColor: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
          accentColor: 'text-red-400',
        };
      case 'fix':
        return {
          borderColor: 'border-amber-500',
          badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
          badgeLabel: '⚙️ CORRIGIR',
          buttonColor: 'bg-amber-500 hover:bg-amber-600 text-white',
          secondaryColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20',
          accentColor: 'text-amber-400',
        };
      case 'scale':
        return {
          borderColor: 'border-emerald-500',
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          badgeLabel: '📈 ESCALAR',
          buttonColor: 'bg-emerald-500 hover:bg-emerald-600 text-white',
          secondaryColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20',
          accentColor: 'text-emerald-400',
        };
      case 'insight':
      case 'alert':
        return {
          borderColor: 'border-sky-500',
          badgeColor: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
          badgeLabel: '💡 INSIGHT',
          buttonColor: 'bg-sky-500 hover:bg-sky-600 text-white',
          secondaryColor: 'bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20',
          accentColor: 'text-sky-400',
        };
      default:
        return {
          borderColor: 'border-gray-500',
          badgeColor: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
          badgeLabel: 'INFO',
          buttonColor: 'bg-gray-500 hover:bg-gray-600 text-white',
          secondaryColor: 'bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20',
          accentColor: 'text-gray-400',
        };
    }
  };

  const config = getTypeConfig(decision.type);

  const handleAction = async (action: DecisionAction) => {
    try {
      setExecutingActionId(action.id);
      setIsExecuting(true);
      await onAction(decision.id, action);
    } finally {
      setIsExecuting(false);
      setExecutingActionId(null);
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .decision-card {
          animation: slideUpFadeIn 0.4s ease-out;
        }
        .decision-card:hover {
          transform: scale(1.01);
        }
        .decision-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .decision-card:hover {
          box-shadow: 0 0 24px rgba(14, 165, 233, 0.1);
        }
      `}</style>

      <div
        className={`decision-card relative bg-[#111827] rounded-2xl p-6 border-l-4 ${config.borderColor} border border-l-4 border-sky-500/10 hover:border-sky-500/30`}
        data-decision-type={decision.type}
      >
        {/* Score Badge - Top Right */}
        <div className="absolute top-4 right-4">
          <div className={`${config.badgeColor} px-3 py-1 rounded-lg text-xs font-bold`}>
            Score: {Math.round(decision.score * 100)}
          </div>
        </div>

        {/* Type Badge - Top Right Below Score */}
        <div className="absolute top-16 right-4">
          <div className={`${config.badgeColor} px-3 py-1 rounded-lg text-xs font-bold`}>
            {config.badgeLabel}
          </div>
        </div>

        {/* Content */}
        <div className="pr-32">
          {/* Headline */}
          <h3 className="text-xl font-bold text-white mb-2 leading-tight">
            {decision.headline}
          </h3>

          {/* Ad Name */}
          <p className="text-sm text-gray-500 mb-4">{decision.ad?.name || 'Ad'}</p>

          {/* Metrics Row */}
          {decision.metrics && decision.metrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {decision.metrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800/50 rounded-lg px-3 py-1 text-xs border border-gray-700/50"
                >
                  <span className="text-gray-400">{metric.key}:</span>
                  <span className="text-gray-200 font-semibold ml-1">{metric.value}</span>
                  {metric.context && (
                    <span className="text-gray-500 ml-1 text-[10px]">({metric.context})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Impact Line */}
          <p className={`text-sm font-semibold mb-6 ${config.accentColor}`}>
            {decision.impact}
          </p>
        </div>

        {/* Actions Row - Bottom */}
        <div className="flex gap-3 mt-6 flex-wrap">
          {decision.actions && decision.actions.length > 0 ? (
            decision.actions.map((action, idx) => (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={isExecuting}
                className={`${
                  idx === 0 ? config.buttonColor : config.secondaryColor
                } rounded-xl px-6 py-3 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  executingActionId === action.id
                    ? 'opacity-75 scale-95'
                    : 'hover:scale-105'
                }`}
              >
                {executingActionId === action.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    Executando...
                  </span>
                ) : (
                  action.label
                )}
              </button>
            ))
          ) : (
            <p className="text-xs text-gray-500">Sem ações disponíveis</p>
          )}
        </div>
      </div>
    </>
  );
};
