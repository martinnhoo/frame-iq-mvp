import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ScanAnimation from '../../components/onboarding/ScanAnimation';

interface MockAccount {
  accountId: string;
  businessName: string;
  isConnected: boolean;
}

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState<MockAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showScanAnimation, setShowScanAnimation] = useState(false);

  // Check if account already connected
  useEffect(() => {
    const storedAccount = localStorage.getItem('adbrief_account');
    if (storedAccount) {
      try {
        const parsed = JSON.parse(storedAccount);
        setAccount(parsed);
        setShowScanAnimation(true);
      } catch {
        setAccount(null);
      }
    }
  }, []);

  const handleConnectMeta = async () => {
    setIsConnecting(true);

    // Simulate OAuth flow and account creation
    setTimeout(() => {
      const mockAccount: MockAccount = {
        accountId: 'act_' + Math.random().toString(36).substring(7),
        businessName: 'Sua Empresa',
        isConnected: true,
      };

      localStorage.setItem('adbrief_account', JSON.stringify(mockAccount));
      setAccount(mockAccount);
      setShowScanAnimation(true);
      setIsConnecting(false);
    }, 1500);
  };

  const handleScanComplete = () => {
    // Mark onboarding as complete
    localStorage.setItem('adbrief_onboarded', 'true');
    navigate('/dashboard');
  };

  // Show scan animation if connected
  if (showScanAnimation && account) {
    return (
      <ScanAnimation
        totalAds={42}
        totalCampaigns={8}
        totalSpend30d={15000000} // R$150,000 in centavos
        leakingDaily={41500} // R$415/dia
        killCount={12}
        scaleCount={8}
        onComplete={handleScanComplete}
      />
    );
  }

  // Initial connection screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-black to-[#1a1f3a] flex items-center justify-center px-6">
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .float-animation {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
          }
        }

        .pulse-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>

      <div className="max-w-lg w-full text-center space-y-12">
        {/* Icon */}
        <div className="float-animation">
          <div className="text-7xl mb-6">💰</div>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Encontre onde você está perdendo dinheiro
          </h1>
          <p className="text-xl text-gray-400">
            Conecte sua conta Meta para analisar seus anúncios e descobrir oportunidades de economia.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid gap-4">
          <div className="flex items-start gap-4">
            <span className="text-2xl">🔍</span>
            <div className="text-left">
              <p className="font-semibold text-white">
                Análise completa de campanhas
              </p>
              <p className="text-sm text-gray-500">
                Identifique anúncios com baixo desempenho
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-2xl">📈</span>
            <div className="text-left">
              <p className="font-semibold text-white">
                Recomendações acionáveis
              </p>
              <p className="text-sm text-gray-500">
                Pause, escale ou corrija seus anúncios
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-2xl">💵</span>
            <div className="text-left">
              <p className="font-semibold text-white">Economias quantificadas</p>
              <p className="text-sm text-gray-500">
                Veja o impacto financeiro de cada ação
              </p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleConnectMeta}
          disabled={isConnecting}
          className="pulse-glow w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold rounded-lg text-lg transition-all duration-200 flex items-center justify-center gap-3"
        >
          {isConnecting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Conectar Meta
            </>
          )}
        </button>

        {/* Subtext */}
        <p className="text-sm text-gray-500">
          Suas credenciais são criptografadas e nunca compartilhadas.
        </p>
      </div>
    </div>
  );
};

export default OnboardingPage;
