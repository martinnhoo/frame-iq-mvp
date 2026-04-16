/**
 * GoalSetup — Conversion Intelligence onboarding.
 *
 * Shows when ad_accounts.goal_objective IS NULL.
 * 3-step flow:
 *   1. Select objective (leads / sales / traffic)
 *   2. Select conversion event (from Meta pixel events)
 *   3. Set target value (CPA / ROAS / CPC)
 *
 * Saves to ad_accounts directly.
 * Design: matches Feed dark theme (#06080C / #0C1017)
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Objective definitions ──
const OBJECTIVES = [
  {
    key: 'leads' as const,
    label: 'Leads / Cadastros',
    desc: 'Gerar leads, cadastros, agendamentos',
    metric: 'cpa' as const,
    metricLabel: 'CPA (Custo por Lead)',
    icon: '🎯',
    events: [
      { value: 'lead', label: 'Lead (formulário)' },
      { value: 'complete_registration', label: 'Cadastro completo' },
      { value: 'contact', label: 'Contato (WhatsApp/chat)' },
      { value: 'schedule', label: 'Agendamento' },
      { value: 'submit_application', label: 'Envio de aplicação' },
    ],
    placeholder: 'Ex: 2000 (R$20,00)',
    unit: 'R$',
    help: 'Quanto você quer pagar por lead no máximo?',
  },
  {
    key: 'sales' as const,
    label: 'Vendas / E-commerce',
    desc: 'Vender produto/serviço direto',
    metric: 'roas' as const,
    metricLabel: 'ROAS (Retorno sobre investimento)',
    icon: '💰',
    events: [
      { value: 'purchase', label: 'Compra' },
      { value: 'initiate_checkout', label: 'Início de checkout' },
      { value: 'add_to_cart', label: 'Adicionou ao carrinho' },
    ],
    placeholder: 'Ex: 30000 (3.0x)',
    unit: 'x',
    help: 'Qual ROAS mínimo aceitável? (Ex: 3x = cada R$1 retorna R$3)',
  },
  {
    key: 'traffic' as const,
    label: 'Tráfego / Visitas',
    desc: 'Levar pessoas para site/página',
    metric: 'cpc' as const,
    metricLabel: 'CPC (Custo por Clique)',
    icon: '🔗',
    events: [
      { value: 'link_click', label: 'Clique no link' },
      { value: 'landing_page_view', label: 'Visualização da página' },
    ],
    placeholder: 'Ex: 150 (R$1,50)',
    unit: 'R$',
    help: 'Quanto quer pagar por clique no máximo?',
  },
] as const;

type ObjectiveKey = typeof OBJECTIVES[number]['key'];

interface GoalSetupProps {
  accountId: string;   // ad_accounts.id (UUID)
  onComplete: () => void; // callback after save
}

export const GoalSetup: React.FC<GoalSetupProps> = ({ accountId, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [objective, setObjective] = useState<ObjectiveKey | null>(null);
  const [conversionEvent, setConversionEvent] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedObj = OBJECTIVES.find(o => o.key === objective);

  const handleSave = async () => {
    if (!objective || !conversionEvent || !selectedObj) return;
    setSaving(true);
    setError(null);

    // Parse target value — user enters in human units
    let targetCentavos = 0;
    const raw = parseFloat(targetValue);
    if (!isNaN(raw) && raw > 0) {
      if (selectedObj.metric === 'roas') {
        // ROAS: user enters 3.0, store as 30000 (basis points)
        targetCentavos = Math.round(raw * 10000);
      } else {
        // CPA/CPC: user enters R$20, store as 2000 (centavos)
        targetCentavos = Math.round(raw * 100);
      }
    }

    try {
      const { error: dbErr } = await (supabase
        .from('ad_accounts' as any)
        .update({
          goal_objective: objective,
          goal_primary_metric: selectedObj.metric,
          goal_conversion_event: conversionEvent,
          goal_target_value: targetCentavos > 0 ? targetCentavos : null,
          goal_configured_at: new Date().toISOString(),
        })
        .eq('id', accountId) as any);

      if (dbErr) throw dbErr;
      onComplete();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 1: Objective ──
  if (step === 1) {
    return (
      <div style={{
        fontFamily: F,
        background: '#0C1017',
        border: '1px solid rgba(56,189,248,0.15)',
        borderLeft: '3px solid #38BDF8',
        borderRadius: 8,
        padding: '20px 22px',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <img src="/ab-avatar.png" alt="AdBrief" width={20} height={20}
            style={{ borderRadius: 5, objectFit: 'cover' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Configurar Inteligência
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F6FC', marginBottom: 4 }}>
          Qual é o objetivo das suas campanhas?
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          Sem isso, a IA não consegue avaliar performance de verdade.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OBJECTIVES.map(obj => (
            <button
              key={obj.key}
              onClick={() => { setObjective(obj.key); setStep(2); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '12px 14px',
                cursor: 'pointer', fontFamily: F, textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(56,189,248,0.06)';
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.20)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <span style={{ fontSize: 20 }}>{obj.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F6FC' }}>{obj.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{obj.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: Conversion Event ──
  if (step === 2 && selectedObj) {
    return (
      <div style={{
        fontFamily: F,
        background: '#0C1017',
        border: '1px solid rgba(56,189,248,0.15)',
        borderLeft: '3px solid #38BDF8',
        borderRadius: 8,
        padding: '20px 22px',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <img src="/ab-avatar.png" alt="AdBrief" width={20} height={20}
            style={{ borderRadius: 5, objectFit: 'cover' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {selectedObj.icon} {selectedObj.label}
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F6FC', marginBottom: 4 }}>
          O que conta como conversão?
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          Escolha o evento do Pixel que representa sucesso pra você.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selectedObj.events.map(ev => (
            <button
              key={ev.value}
              onClick={() => { setConversionEvent(ev.value); setStep(3); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '10px 14px',
                cursor: 'pointer', fontFamily: F, textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(56,189,248,0.06)';
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.20)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#38BDF8', flexShrink: 0,
                boxShadow: '0 0 6px rgba(56,189,248,0.40)',
              }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#F0F6FC' }}>{ev.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep(1)}
          style={{
            marginTop: 12, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer',
            fontFamily: F, padding: '4px 0',
          }}
        >
          ← Voltar
        </button>
      </div>
    );
  }

  // ── Step 3: Target Value ──
  if (step === 3 && selectedObj) {
    return (
      <div style={{
        fontFamily: F,
        background: '#0C1017',
        border: '1px solid rgba(56,189,248,0.15)',
        borderLeft: '3px solid #38BDF8',
        borderRadius: 8,
        padding: '20px 22px',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <img src="/ab-avatar.png" alt="AdBrief" width={20} height={20}
            style={{ borderRadius: 5, objectFit: 'cover' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {selectedObj.metricLabel}
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F6FC', marginBottom: 4 }}>
          Defina sua meta de {selectedObj.metricLabel.split(' ')[0]}
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
          {selectedObj.help}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.40)' }}>
            {selectedObj.unit}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={selectedObj.metric === 'roas' ? 'Ex: 3.0' : 'Ex: 20.00'}
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '10px 12px',
              color: '#F0F6FC', fontSize: 14, fontWeight: 600,
              fontFamily: F, outline: 'none',
              fontVariant: 'tabular-nums',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.40)'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
            autoFocus
          />
        </div>

        {error && (
          <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 10 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setStep(2)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: F,
            }}
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '10px 14px', borderRadius: 6,
              background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
              border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: F,
              opacity: saving ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(56,189,248,0.25)',
            }}
          >
            {saving ? 'Salvando...' : targetValue ? 'Ativar Inteligência' : 'Pular meta (definir depois)'}
          </button>
        </div>

        <div style={{
          marginTop: 14, fontSize: 10.5, color: 'rgba(255,255,255,0.30)', lineHeight: 1.5,
        }}>
          Você pode alterar isso depois em Contas. A IA vai usar essa meta como referência para todas as análises.
        </div>
      </div>
    );
  }

  return null;
};
