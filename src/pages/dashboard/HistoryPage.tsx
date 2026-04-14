import React, { useState, useEffect } from 'react';
import { Undo2, Check, X, RotateCcw } from 'lucide-react';

interface ActionLogEntry {
  id: string;
  actionType: 'kill' | 'scale' | 'fix';
  targetName: string;
  campaignName: string;
  executedAt: Date;
  status: 'success' | 'error' | 'rolled_back';
  estimatedImpact: number; // in centavos
  actualImpact?: number; // in centavos
  isValidated?: boolean;
  rollbackAvailable: boolean;
  rollbackExpiredAt?: Date;
}

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  // Fetch action history on mount
  useEffect(() => {
    // Simulated data fetch - in real app, would query action_log table
    const mockHistory: ActionLogEntry[] = [
      {
        id: 'action_001',
        actionType: 'kill',
        targetName: 'Summer Clearance - Broad',
        campaignName: 'Summer 2026 Campaign',
        executedAt: new Date(Date.now() - 86400000), // 1 day ago
        status: 'success',
        estimatedImpact: 25000,
        actualImpact: 26500,
        isValidated: true,
        rollbackAvailable: true,
      },
      {
        id: 'action_002',
        actionType: 'scale',
        targetName: 'High Performers - Lookalike',
        campaignName: 'Retention Campaign',
        executedAt: new Date(Date.now() - 172800000), // 2 days ago
        status: 'success',
        estimatedImpact: 15000,
        actualImpact: 18200,
        isValidated: true,
        rollbackAvailable: true,
      },
      {
        id: 'action_003',
        actionType: 'fix',
        targetName: 'Product Launch - V2',
        campaignName: 'Q2 Product Launch',
        executedAt: new Date(Date.now() - 259200000), // 3 days ago
        status: 'success',
        estimatedImpact: 8500,
        isValidated: false,
        rollbackAvailable: false,
      },
      {
        id: 'action_004',
        actionType: 'kill',
        targetName: 'Seasonal Promo - Old',
        campaignName: 'Spring Campaign',
        executedAt: new Date(Date.now() - 432000000), // 5 days ago
        status: 'rolled_back',
        estimatedImpact: 12000,
        rollbackAvailable: false,
      },
      {
        id: 'action_005',
        actionType: 'scale',
        targetName: 'Best Converter - Segment A',
        campaignName: 'Acquisition Drive',
        executedAt: new Date(Date.now() - 604800000), // 7 days ago
        status: 'success',
        estimatedImpact: 32000,
        actualImpact: 31500,
        isValidated: true,
        rollbackAvailable: false,
      },
    ];

    // Simulate network delay
    setTimeout(() => {
      setHistory(mockHistory);
      setLoading(false);
    }, 600);
  }, []);

  const handleUndo = (id: string) => {
    setUndoingId(id);
    // Simulate undo operation
    setTimeout(() => {
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, status: 'rolled_back', rollbackAvailable: false }
            : entry
        )
      );
      setUndoingId(null);
    }, 1200);
  };

  const getActionIcon = (type: ActionLogEntry['actionType']) => {
    switch (type) {
      case 'kill':
        return '🛑';
      case 'scale':
        return '🚀';
      case 'fix':
        return '🔧';
    }
  };

  const getActionLabel = (type: ActionLogEntry['actionType']) => {
    switch (type) {
      case 'kill':
        return 'Parado';
      case 'scale':
        return 'Escalado';
      case 'fix':
        return 'Corrigido';
    }
  };

  const getStatusIcon = (status: ActionLogEntry['status']) => {
    switch (status) {
      case 'success':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'error':
        return <X className="w-4 h-4 text-red-400" />;
      case 'rolled_back':
        return <RotateCcw className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusText = (status: ActionLogEntry['status']) => {
    switch (status) {
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      case 'rolled_back':
        return 'Desfeito';
    }
  };

  const timeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals: { [key: string]: number } = {
      ano: 31536000,
      mês: 2592000,
      semana: 604800,
      dia: 86400,
      hora: 3600,
      minuto: 60,
    };

    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval);
      if (interval >= 1) {
        return `${interval} ${name}${interval > 1 ? 's' : ''} atrás`;
      }
    }
    return 'Agora';
  };

  // Calculate summary stats
  const totalSaved = history
    .filter((h) => h.status === 'success' && h.actualImpact)
    .reduce((sum, h) => sum + (h.actualImpact || 0), 0);

  const totalGenerated = history
    .filter((h) => h.status === 'success' && h.actionType === 'scale' && h.actualImpact)
    .reduce((sum, h) => sum + (h.actualImpact || 0), 0);

  const actionsThisMonth = history.filter((h) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return h.executedAt > thirtyDaysAgo;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-800 rounded-lg" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Histórico de Ações</h1>
          <p className="text-gray-400">
            Acompanhe todas as ações tomadas e seu impacto no seu negócio.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Saved */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm uppercase tracking-wide mb-2">
              Total economizado
            </p>
            <p className="text-3xl font-bold text-green-400">
              R${(totalSaved / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              em {history.filter((h) => h.status === 'success').length} ações bem-sucedidas
            </p>
          </div>

          {/* Total Generated */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm uppercase tracking-wide mb-2">
              Total gerado
            </p>
            <p className="text-3xl font-bold text-blue-400">
              R${(totalGenerated / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              em escaladas bem-sucedidas
            </p>
          </div>

          {/* Actions This Month */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm uppercase tracking-wide mb-2">
              Ações este mês
            </p>
            <p className="text-3xl font-bold text-white">{actionsThisMonth}</p>
            <p className="text-xs text-gray-500 mt-2">
              últimos 30 dias
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-400 mb-2">Nenhuma ação registrada ainda</p>
              <p className="text-gray-500 text-sm">
                Comece tomando ações nas decisões para ver seu histórico aqui.
              </p>
            </div>
          ) : (
            history.map((entry) => {
              const isRollbackExpired =
                entry.rollbackExpiredAt &&
                new Date() > entry.rollbackExpiredAt;
              const canRollback =
                entry.rollbackAvailable && !isRollbackExpired;

              return (
                <div
                  key={entry.id}
                  className="bg-[#111827] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Icon and details */}
                    <div className="flex items-start gap-4 flex-1">
                      <span className="text-3xl mt-1">{getActionIcon(entry.actionType)}</span>

                      <div className="flex-1">
                        {/* Target and campaign */}
                        <div className="mb-3">
                          <p className="font-semibold text-white">
                            {entry.targetName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {entry.campaignName}
                          </p>
                        </div>

                        {/* Status and time */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(entry.status)}
                            <span className="text-sm text-gray-400">
                              {getStatusText(entry.status)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {timeAgo(entry.executedAt)}
                          </span>
                        </div>

                        {/* Impact section */}
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                Impacto estimado
                              </p>
                              <p className="font-semibold text-white">
                                R${(entry.estimatedImpact / 100).toFixed(2)}/dia
                              </p>
                            </div>
                            {entry.actualImpact && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                  Impacto real {entry.isValidated && '✓'}
                                </p>
                                <p className="font-semibold text-green-400">
                                  R${(entry.actualImpact / 100).toFixed(2)}/dia
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Undo button */}
                    {canRollback && (
                      <button
                        onClick={() => handleUndo(entry.id)}
                        disabled={undoingId === entry.id}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                      >
                        {undoingId === entry.id ? (
                          <>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            Desfazendo...
                          </>
                        ) : (
                          <>
                            <Undo2 className="w-4 h-4" />
                            Desfazer
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
