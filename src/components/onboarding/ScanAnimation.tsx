import React, { useEffect, useState } from 'react';

interface ScanAnimationProps {
  totalAds: number;
  totalCampaigns: number;
  totalSpend30d: number; // in centavos
  leakingDaily: number; // in centavos
  killCount: number;
  scaleCount: number;
  onComplete: () => void;
}

const ScanAnimation: React.FC<ScanAnimationProps> = ({
  totalAds,
  totalCampaigns,
  totalSpend30d,
  leakingDaily,
  killCount,
  scaleCount,
  onComplete,
}) => {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [adCount, setAdCount] = useState(0);
  const [leakingCounter, setLeakingCounter] = useState(0);
  const [showReveal, setShowReveal] = useState(false);
  const [flashScreen, setFlashScreen] = useState(false);

  // Phase 1: Scanning
  useEffect(() => {
    if (phase === 1) {
      const duration = 2000; // 2 seconds
      const startTime = Date.now();

      const updateCounter = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setAdCount(Math.floor(progress * totalAds));

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          setAdCount(totalAds);
          setPhase(2);
        }
      };

      requestAnimationFrame(updateCounter);
    }
  }, [phase, totalAds]);

  // Phase 2: Finding issues (2-4s)
  useEffect(() => {
    if (phase === 2) {
      const timer = setTimeout(() => {
        setPhase(3);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Phase 3: Build-up (4-5s)
  useEffect(() => {
    if (phase === 3) {
      // Flash effect at start of phase 3
      setFlashScreen(true);
      const flashTimer = setTimeout(() => setFlashScreen(false), 300);

      const duration = 1000; // 1 second for counter
      const startTime = Date.now();

      const updateCounter = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setLeakingCounter(Math.floor(progress * leakingDaily));

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          setLeakingCounter(leakingDaily);
          // Wait for dramatic pause, then move to phase 4
          const pauseTimer = setTimeout(() => {
            setPhase(4);
          }, 1000);
          return () => clearTimeout(pauseTimer);
        }
      };

      requestAnimationFrame(updateCounter);
      return () => clearTimeout(flashTimer);
    }
  }, [phase, leakingDaily]);

  // Phase 4: Reveal
  useEffect(() => {
    if (phase === 4) {
      setShowReveal(true);
    }
  }, [phase]);

  const totalSpendBRL = (totalSpend30d / 100).toFixed(2);
  const leakingDailyBRL = (leakingDaily / 100).toFixed(2);

  // CSS animations
  const styles = `
    @keyframes scanLine {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @keyframes gridFade {
      from { opacity: 0; }
      to { opacity: 0.3; }
    }

    .scan-line {
      animation: scanLine 2s ease-in-out infinite;
    }

    .fade-in-up {
      animation: fadeInUp 0.6s ease-out forwards;
    }

    .pulse-button {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .grid-bg {
      background-image:
        linear-gradient(0deg, transparent 24%, rgba(100, 200, 255, 0.05) 25%, rgba(100, 200, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(100, 200, 255, 0.05) 75%, rgba(100, 200, 255, 0.05) 76%, transparent 77%, transparent),
        linear-gradient(90deg, transparent 24%, rgba(100, 200, 255, 0.05) 25%, rgba(100, 200, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(100, 200, 255, 0.05) 75%, rgba(100, 200, 255, 0.05) 76%, transparent 77%, transparent);
      background-size: 50px 50px;
      animation: gridFade 0.5s ease-out forwards;
    }
  `;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <style>{styles}</style>

      {/* Flash effect for phase 3 */}
      {flashScreen && (
        <div className="absolute inset-0 bg-white/20 z-50 pointer-events-none" />
      )}

      {/* Grid background - visible in phases 1-3 */}
      {phase < 4 && (
        <div className="absolute inset-0 grid-bg" />
      )}

      {/* PHASE 1: SCANNING */}
      {phase === 1 && (
        <div className="h-full flex flex-col items-center justify-center relative">
          {/* Scan line */}
          <div className="absolute inset-0 w-full">
            <div className="relative h-1 bg-gradient-to-b from-transparent via-cyan-400 to-transparent scan-line" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center">
            <p className="text-gray-400 text-sm mb-8 font-mono">
              Analisando sua conta...
            </p>
            <p className="text-gray-300 text-xl font-light mb-2">
              Analisando ad {adCount} de {totalAds}...
            </p>
          </div>
        </div>
      )}

      {/* PHASE 2: FINDING ISSUES */}
      {phase === 2 && (
        <div className="h-full flex items-center justify-center relative">
          <div className="text-center space-y-6">
            <p
              className="text-gray-400 text-sm font-mono"
              style={{
                animation: 'fadeInUp 0.6s ease-out',
                animationDelay: '0s',
              }}
            >
              Encontrando problemas...
            </p>

            <div
              className="space-y-4"
              style={{
                animation: 'fadeInUp 0.6s ease-out',
                animationDelay: '0.3s',
              }}
            >
              <p className="text-lg text-gray-300">
                {totalCampaigns} campanhas encontradas
              </p>
              <p className="text-lg text-gray-300">
                R${totalSpendBRL} gastos nos últimos 30 dias
              </p>
            </div>

            <p
              className="text-gray-400 text-sm font-mono"
              style={{
                animation: 'fadeInUp 0.6s ease-out',
                animationDelay: '0.6s',
              }}
            >
              Detectando vazamentos...
            </p>
          </div>
        </div>
      )}

      {/* PHASE 3: BUILD-UP */}
      {phase === 3 && (
        <div className="h-full flex flex-col items-center justify-center relative">
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-12 font-mono">
              Analisando impacto...
            </p>
            <div className="text-6xl font-bold text-red-500 animate-pulse">
              R${(leakingCounter / 100).toFixed(2)}
            </div>
            <p className="text-gray-500 text-sm mt-4 font-mono">
              por dia sendo desperdiçados
            </p>
          </div>
        </div>
      )}

      {/* PHASE 4: REVEAL */}
      {phase === 4 && showReveal && (
        <div className="h-full flex flex-col items-center justify-center relative bg-gradient-to-br from-[#0a0e27] via-black to-[#1a1f3a]">
          <div className="text-center space-y-8 px-6">
            {/* Main headline */}
            <div
              className="fade-in-up"
              style={{ animationDelay: '0s' }}
            >
              <p className="text-5xl font-bold mb-4">
                <span>💰</span>
              </p>
              <p className="text-3xl font-bold text-white leading-tight">
                Encontramos R${leakingDailyBRL}/dia sendo desperdiçados
              </p>
            </div>

            {/* Stats */}
            <div
              className="fade-in-up"
              style={{ animationDelay: '0.2s' }}
            >
              <p className="text-lg text-gray-400">
                <span className="font-semibold text-white">
                  {killCount} anúncios
                </span>{' '}
                para parar agora ·{' '}
                <span className="font-semibold text-white">
                  {scaleCount} para escalar
                </span>
              </p>
            </div>

            {/* CTA Button */}
            <div
              className="fade-in-up pt-8"
              style={{ animationDelay: '0.4s' }}
            >
              <button
                onClick={onComplete}
                className="pulse-button inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-200 active:scale-95"
              >
                VER ONDE ESTÁ O PROBLEMA →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanAnimation;
