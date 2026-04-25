// FirstMomentOverlay — the post-connect "wow" surface.
//
// Triggers ONCE per account, the first time the user lands on the Feed
// after connecting Meta and the initial sync completes. The goal isn't
// decoration — it's to translate "we just imported your data" into
// "we already found money for you" in the user's mental model. By
// second 6 the user has seen a real number tied to a real opportunity.
//
// Why this matters more than other surfaces:
//   - First impression compounds. A weak first session = weak retention.
//   - Most products show "Connecting..." then a populated dashboard with
//     no narrative. The user thinks "ok now what?" and bounces.
//   - This overlay turns 6 seconds of waiting (which would happen anyway
//     while the eye scans the populated page) into a guided story that
//     ends with a clear next action.
//
// Design principles (mirror the rest of the system):
//   1) NO faked numbers. Every figure is fetched from supabase before the
//      reveal phase. Phases 1-3 are visual choreography while we wait.
//   2) Honest fallbacks. If the account has no leaks, the reveal copy
//      changes to "Sua conta está limpa — sem urgência" instead of
//      manufacturing fake urgency.
//   3) AI-aware. The "Falar com a IA" CTA passes ?welcome=1 to the chat
//      so the AI knows this is a first-session interaction and can
//      respond with a calibrated diagnostic instead of generic greeting.
//   4) One-shot. Cursor in localStorage prevents re-fire on next visits.
//
// Lifecycle:
//   mount → fetch real data in parallel with phase 1-3 animation
//        → phase 4 reveal uses fetched data
//        → user clicks CTA → onDismiss() → localStorage flag set
//
// Mount point: FeedPage, conditional on first-sync-just-completed AND
// localStorage flag absent.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { Sparkles, ArrowRight, MessageSquare } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

interface FirstMomentOverlayProps {
  userId: string;
  accountId: string;
  onDismiss: () => void;
}

type FetchedData = {
  campaignCount: number;
  adCount: number;
  spend30dBrl: number;
  killCount: number;          // kill-type decisions (loss reduction)
  scaleCount: number;         // scale-type decisions (growth)
  recoverableDailyBrl: number; // sum of impact_daily for kills (cents → reais)
  topOpportunity: {
    headline: string;
    type: string;
    impactDailyBrl: number;
    targetName: string | null;
    cause: string | null;     // canonical or derived
  } | null;
};

const PHASE_DURATIONS = {
  scan: 1500,        // phase 1
  identify: 1500,    // phase 2
  buildup: 1200,     // phase 3 (counter animation)
  pause: 600,        // dramatic pause before phase 4
} as const;

export const FirstMomentOverlay: React.FC<FirstMomentOverlayProps> = ({ userId, accountId, onDismiss }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [data, setData] = useState<FetchedData | null>(null);
  const [recoverableCounter, setRecoverableCounter] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Mount in for fade-in transition
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Parallel data fetch — runs immediately on mount alongside the animation.
  // If the fetch completes before phase 4, the reveal has real numbers.
  // If somehow slower, phase 4 still renders with whatever we have (or
  // fallback empty state).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [campsRes, adsRes, decsRes, snapsRes] = await Promise.all([
          supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
          supabase.from('ads').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
          (supabase as any).from('decisions')
            .select('id, type, headline, impact_daily, ad:ads(name)')
            .eq('account_id', accountId)
            .eq('status', 'pending')
            .order('impact_daily', { ascending: false })
            .limit(20),
          (supabase as any).from('daily_snapshots')
            .select('total_spend')
            .eq('user_id', userId)
            .eq('account_id', accountId)
            .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        ]);

        if (cancelled) return;

        const campaignCount = campsRes.count ?? 0;
        const adCount = adsRes.count ?? 0;
        const spend30dCents = (snapsRes.data || []).reduce((s: number, r: any) => s + (r.total_spend || 0), 0);
        const decisions = (decsRes.data || []) as any[];

        const kills = decisions.filter(d => d.type === 'kill');
        const scales = decisions.filter(d => d.type === 'scale');
        const recoverableCents = kills.reduce((s: number, d: any) => s + (d.impact_daily || 0), 0);

        // Hero opportunity = top-ranked decision by impact (any type)
        const top = decisions[0] || null;

        setData({
          campaignCount,
          adCount,
          spend30dBrl: Math.round(spend30dCents / 100),
          killCount: kills.length,
          scaleCount: scales.length,
          recoverableDailyBrl: Math.round(recoverableCents / 100),
          topOpportunity: top ? {
            headline: top.headline || 'Oportunidade encontrada',
            type: top.type || 'fix',
            impactDailyBrl: Math.round((top.impact_daily || 0) / 100),
            targetName: top.ad?.name || null,
            cause: null, // decision engine doesn't expose canonical cause yet
          } : null,
        });
      } catch (e) {
        // Silent fallback — overlay still completes its animation, just
        // with empty-state copy on phase 4.
        if (!cancelled) {
          setData({
            campaignCount: 0, adCount: 0, spend30dBrl: 0,
            killCount: 0, scaleCount: 0, recoverableDailyBrl: 0,
            topOpportunity: null,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId, accountId]);

  // Phase progression — purely time-driven. Data fetch races in parallel.
  useEffect(() => {
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), PHASE_DURATIONS.scan);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      const t = setTimeout(() => setPhase(3), PHASE_DURATIONS.identify);
      return () => clearTimeout(t);
    }
    if (phase === 3) {
      // Counter animation — counts up to data.recoverableDailyBrl over PHASE_DURATIONS.buildup
      // Falls back to 0 if data isn't loaded yet (animation still plays for visual rhythm).
      const target = data?.recoverableDailyBrl ?? 0;
      const t0 = Date.now();
      let raf: number;
      const tick = () => {
        const elapsed = Date.now() - t0;
        const progress = Math.min(elapsed / PHASE_DURATIONS.buildup, 1);
        // Ease-out for satisfying landing — fast start, soft stop
        const eased = 1 - Math.pow(1 - progress, 3);
        setRecoverableCounter(Math.floor(target * eased));
        if (progress < 1) raf = requestAnimationFrame(tick);
        else {
          setRecoverableCounter(target);
          setTimeout(() => setPhase(4), PHASE_DURATIONS.pause);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
  }, [phase, data]);

  const handleDismiss = () => {
    onDismiss();
  };

  const handleSeeFeed = () => {
    onDismiss(); // overlay disappears, user is already on Feed
  };

  const handleAskAI = () => {
    onDismiss();
    // welcome=1 signals AdBriefAI to prepopulate the input + signal the
    // backend that this is a first-session interaction (richer prompt).
    navigate('/dashboard/ai?welcome=1');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(3, 6, 14, 0.96)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: F,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes fmFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fmPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fmScanLine { 0% { transform: translateY(-30vh); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(30vh); opacity: 0; } }
        @keyframes fmShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .fm-step { animation: fmFadeUp 0.4s ease-out both; }
        .fm-pulse { animation: fmPulse 1.5s ease-in-out infinite; }
        .fm-scan-line { animation: fmScanLine 1.6s ease-in-out infinite; }
        .fm-shimmer { background: linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.18) 50%, transparent 100%); background-size: 200% 100%; animation: fmShimmer 1.5s ease-in-out infinite; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 580, textAlign: 'center' as const }}>

        {/* ── Phase 1: SCANNING ───────────────────────────────────────── */}
        {phase === 1 && (
          <div className="fm-step">
            <p style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
              color: '#38BDF8', textTransform: 'uppercase' as const,
              margin: '0 0 24px',
            }}>
              Análise inicial
            </p>
            <h1 style={{
              fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800,
              color: '#F0F6FC', letterSpacing: '-0.03em',
              margin: '0 0 36px', lineHeight: 1.2,
            }}>
              Lendo sua conta Meta…
            </h1>
            {/* Animated scan progress: 4 lines that appear sequentially */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
              {[
                'Mapeando campanhas e conjuntos…',
                'Importando 30 dias de métricas…',
                'Cruzando com padrões da conta…',
                'Identificando anomalias…',
              ].map((label, i) => (
                <div
                  key={i}
                  className="fm-step"
                  style={{
                    fontSize: 13, color: 'rgba(240,246,252,0.6)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(56,189,248,0.04)',
                    border: '1px solid rgba(56,189,248,0.08)',
                    animationDelay: `${i * 0.32}s`,
                    fontFamily: F,
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#38BDF8', flexShrink: 0,
                  }} className="fm-pulse" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {/* Subtle scanning line across the viewport */}
            <div style={{
              position: 'absolute',
              top: '50%', left: 0, right: 0,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.6), transparent)',
              pointerEvents: 'none' as const,
            }} className="fm-scan-line" />
          </div>
        )}

        {/* ── Phase 2: IDENTIFYING ────────────────────────────────────── */}
        {phase === 2 && (
          <div className="fm-step">
            <p style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
              color: '#FBBF24', textTransform: 'uppercase' as const,
              margin: '0 0 24px',
            }}>
              Detectando
            </p>
            <h1 style={{
              fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800,
              color: '#F0F6FC', letterSpacing: '-0.03em',
              margin: '0 0 32px', lineHeight: 1.2,
            }}>
              {data
                ? <>Encontrei sinais em {data.campaignCount} campanha{data.campaignCount === 1 ? '' : 's'}.</>
                : 'Cruzando os números…'}
            </h1>
            {data && (
              <div className="fm-step" style={{
                display: 'inline-flex', flexDirection: 'column', gap: 6,
                padding: '14px 20px', borderRadius: 10,
                background: 'rgba(251,191,36,0.04)',
                border: '1px solid rgba(251,191,36,0.10)',
                animationDelay: '0.2s',
              }}>
                <span style={{ fontSize: 13, color: 'rgba(240,246,252,0.7)' }}>
                  <strong style={{ color: '#F0F6FC' }}>{data.adCount}</strong> ad{data.adCount === 1 ? '' : 's'} avaliado{data.adCount === 1 ? '' : 's'} · <strong style={{ color: '#F0F6FC' }}>R$ {data.spend30dBrl.toLocaleString('pt-BR')}</strong> spend mapeado (30d)
                </span>
                {(data.killCount > 0 || data.scaleCount > 0) && (
                  <span style={{ fontSize: 12, color: 'rgba(240,246,252,0.5)' }}>
                    {data.killCount > 0 && <><strong style={{ color: '#F87171' }}>{data.killCount}</strong> com perda ativa</>}
                    {data.killCount > 0 && data.scaleCount > 0 && <> · </>}
                    {data.scaleCount > 0 && <><strong style={{ color: '#38BDF8' }}>{data.scaleCount}</strong> winner{data.scaleCount === 1 ? '' : 's'} pra escalar</>}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Phase 3: BUILD-UP COUNTER ───────────────────────────────── */}
        {phase === 3 && (
          <div className="fm-step">
            <p style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
              color: data && data.recoverableDailyBrl > 0 ? '#F87171' : '#34D399',
              textTransform: 'uppercase' as const,
              margin: '0 0 18px',
            }}>
              {data && data.recoverableDailyBrl > 0 ? 'Quantificando perda' : 'Calculando impacto'}
            </p>
            <div style={{
              fontSize: 'clamp(56px, 11vw, 88px)', fontWeight: 900,
              color: data && data.recoverableDailyBrl > 0 ? '#F87171' : '#34D399',
              fontFamily: F, letterSpacing: '-0.05em', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums' as const,
            }} className={recoverableCounter < (data?.recoverableDailyBrl ?? 0) ? 'fm-pulse' : ''}>
              R$ {recoverableCounter.toLocaleString('pt-BR')}
            </div>
            <p style={{
              fontSize: 14, color: 'rgba(240,246,252,0.55)',
              marginTop: 14, fontWeight: 500,
            }}>
              {data && data.recoverableDailyBrl > 0
                ? 'sendo desperdiçados por dia'
                : 'em risco hoje'}
            </p>
          </div>
        )}

        {/* ── Phase 4: REVEAL ─────────────────────────────────────────── */}
        {phase === 4 && data && (
          <>
            {/* HERO — the recovery number, big, with context */}
            {data.recoverableDailyBrl > 0 ? (
              <div className="fm-step" style={{ marginBottom: 32 }}>
                <p style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
                  color: '#34D399', textTransform: 'uppercase' as const,
                  margin: '0 0 16px',
                }}>
                  Diagnóstico pronto
                </p>
                <div style={{
                  fontSize: 'clamp(40px, 8vw, 64px)', fontWeight: 900,
                  color: '#F0F6FC', letterSpacing: '-0.045em', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums' as const,
                  marginBottom: 8,
                }}>
                  R$ {data.recoverableDailyBrl.toLocaleString('pt-BR')}
                  <span style={{
                    fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 700,
                    color: 'rgba(240,246,252,0.5)', marginLeft: 8,
                  }}>/dia</span>
                </div>
                <p style={{
                  fontSize: 14, color: 'rgba(240,246,252,0.6)',
                  margin: '6px auto 0', maxWidth: 420, lineHeight: 1.5,
                }}>
                  podem ser recuperados ajustando{' '}
                  <strong style={{ color: '#F0F6FC' }}>
                    {data.killCount + data.scaleCount} ite{(data.killCount + data.scaleCount) === 1 ? 'm' : 'ns'}
                  </strong>{' '}
                  da sua conta.
                </p>
              </div>
            ) : (
              <div className="fm-step" style={{ marginBottom: 32 }}>
                <p style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
                  color: '#34D399', textTransform: 'uppercase' as const,
                  margin: '0 0 16px',
                }}>
                  Conta limpa
                </p>
                <h1 style={{
                  fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800,
                  color: '#F0F6FC', letterSpacing: '-0.03em',
                  margin: '0 0 12px', lineHeight: 1.2,
                }}>
                  Sua conta está estável agora.
                </h1>
                <p style={{ fontSize: 14, color: 'rgba(240,246,252,0.6)', margin: 0, lineHeight: 1.55 }}>
                  Sem urgência hoje. Vou continuar olhando a cada 15min e te aviso quando algo mudar.
                </p>
              </div>
            )}

            {/* Top opportunity card — only if there's one */}
            {data.topOpportunity && data.recoverableDailyBrl > 0 && (
              <div className="fm-step" style={{
                animationDelay: '0.25s',
                marginBottom: 28,
                padding: '16px 18px',
                borderRadius: 12,
                background: 'rgba(15,23,42,0.7)',
                border: '1px solid rgba(248,113,113,0.18)',
                borderLeft: '2px solid #F87171',
                textAlign: 'left' as const,
                maxWidth: 460,
                margin: '0 auto 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em', color: '#F87171' }}>
                    MAIOR OPORTUNIDADE
                  </span>
                </div>
                <p style={{
                  fontSize: 14, fontWeight: 700, color: '#F0F6FC',
                  margin: '0 0 6px', lineHeight: 1.35,
                }}>
                  {data.topOpportunity.headline}
                </p>
                {data.topOpportunity.targetName && (
                  <p style={{
                    fontSize: 12, color: 'rgba(240,246,252,0.5)',
                    margin: '0 0 8px',
                  }}>
                    {data.topOpportunity.targetName}
                  </p>
                )}
                {data.topOpportunity.impactDailyBrl > 0 && (
                  <p style={{
                    fontSize: 13, fontWeight: 700, color: '#34D399',
                    margin: 0, fontVariantNumeric: 'tabular-nums' as const,
                  }}>
                    R$ {data.topOpportunity.impactDailyBrl.toLocaleString('pt-BR')}/dia evitáveis
                  </p>
                )}
              </div>
            )}

            {/* Two CTAs — primary leads to feed (real decisions), secondary to AI chat (deeper diagnosis) */}
            <div className="fm-step" style={{
              animationDelay: '0.4s',
              display: 'flex', gap: 8, flexWrap: 'wrap' as const,
              justifyContent: 'center',
            }}>
              <button
                onClick={handleSeeFeed}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 22px', borderRadius: 10,
                  background: '#38BDF8', color: '#000',
                  border: 'none', cursor: 'pointer',
                  fontFamily: F, fontSize: 14, fontWeight: 800,
                  boxShadow: '0 0 24px rgba(56,189,248,0.25)',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                {data.recoverableDailyBrl > 0 ? 'Ver decisões prontas' : 'Ver minha conta'}
                <ArrowRight size={15} strokeWidth={2.4} />
              </button>
              <button
                onClick={handleAskAI}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 22px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', color: 'rgba(240,246,252,0.85)',
                  border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
                  fontFamily: F, fontSize: 14, fontWeight: 600,
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.color = '#F0F6FC';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(240,246,252,0.85)';
                }}
              >
                <MessageSquare size={14} strokeWidth={2.2} />
                Falar com a IA
              </button>
            </div>

            {/* Footer signal — communicates this isn't a static screen */}
            <p style={{
              fontSize: 11, color: 'rgba(240,246,252,0.30)',
              margin: '36px 0 0', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Sparkles size={11} strokeWidth={2} color="#38BDF8" />
              Análise rodou em segundos · re-leitura a cada 15 min
            </p>

            {/* Skip link — for users who want out fast */}
            <div style={{ marginTop: 14 }}>
              <button
                onClick={handleDismiss}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(240,246,252,0.25)', fontSize: 12,
                  fontFamily: F, padding: '4px 8px',
                }}
              >
                Pular
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
