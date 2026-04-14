import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface Decision {
  id: string;
  adName: string;
  campaignName: string;
  estimatedImpact: number; // in centavos
}

export interface DecisionAction {
  type: 'kill' | 'scale' | 'fix';
  actionId: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
  decision: Decision;
  action: DecisionAction;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isExecuting,
  decision,
  action,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onCancel();
    }, 200);
  };

  const getActionConfig = () => {
    switch (action.type) {
      case 'kill':
        return {
          title: 'Parar este anúncio?',
          buttonLabel: 'Confirmar parada',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          icon: '🛑',
          textColor: 'text-red-400',
        };
      case 'scale':
        return {
          title: 'Escalar este anúncio?',
          buttonLabel: 'Confirmar escalada',
          buttonColor: 'bg-green-600 hover:bg-green-700',
          icon: '🚀',
          textColor: 'text-green-400',
        };
      case 'fix':
        return {
          title: 'Corrigir este anúncio?',
          buttonLabel: 'Confirmar correção',
          buttonColor: 'bg-amber-600 hover:bg-amber-700',
          icon: '🔧',
          textColor: 'text-amber-400',
        };
    }
  };

  const config = getActionConfig();
  const impactBRL = (decision.estimatedImpact / 100).toFixed(2);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        <div className="bg-[#111827] rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-800">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{config.icon}</span>
            <h2 className={`text-xl font-bold ${config.textColor}`}>
              {config.title}
            </h2>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-8">
            {/* Ad Name */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Anúncio
              </p>
              <p className="text-sm font-semibold text-white">
                {decision.adName}
              </p>
            </div>

            {/* Campaign Name */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Campanha
              </p>
              <p className="text-sm font-semibold text-white">
                {decision.campaignName}
              </p>
            </div>

            {/* Financial Impact */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Impacto estimado
              </p>
              <p className={`text-lg font-bold ${config.textColor}`}>
                R${impactBRL}/dia
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onConfirm}
              disabled={isExecuting}
              className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                config.buttonColor
              } ${
                isExecuting
                  ? 'opacity-75 cursor-not-allowed'
                  : 'cursor-pointer active:scale-95'
              } text-white`}
            >
              {isExecuting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isExecuting ? 'Processando...' : config.buttonLabel}
            </button>

            <button
              onClick={handleClose}
              disabled={isExecuting}
              className="w-full py-3 rounded-lg font-semibold border border-gray-700 text-gray-300 hover:bg-gray-900/50 hover:border-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;
