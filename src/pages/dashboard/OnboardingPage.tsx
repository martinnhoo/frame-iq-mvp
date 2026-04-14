import React from 'react';
import { useNavigate } from 'react-router-dom';

const F = "'Plus Jakarta Sans', sans-serif";

/**
 * OnboardingPage — redirect to real account connection flow.
 * No mock data — sends user to /dashboard/accounts for real Meta OAuth.
 */
const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a0e27 0%, #000 40%, #1a1f3a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: F,
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ fontSize: 64, marginBottom: 24, animation: 'ob-float 3s ease-in-out infinite' }}>
          💰
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12 }}>
          Encontre onde você está perdendo dinheiro
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 40 }}>
          Conecte sua conta Meta Ads para analisar seus anúncios e descobrir oportunidades de economia.
        </p>

        {/* Benefits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40, textAlign: 'left' }}>
          {[
            { icon: '🔍', title: 'Análise completa de campanhas', desc: 'Identifique anúncios com baixo desempenho' },
            { icon: '📈', title: 'Recomendações acionáveis', desc: 'Pause, escale ou corrija seus anúncios' },
            { icon: '💵', title: 'Economias quantificadas', desc: 'Veja o impacto financeiro de cada ação' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 24 }}>{b.icon}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>{b.title}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — goes to real accounts page */}
        <button
          onClick={() => navigate('/dashboard/accounts')}
          style={{
            width: '100%', padding: '16px 24px',
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: F,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Conectar Meta Ads
        </button>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>
          Suas credenciais são criptografadas e nunca compartilhadas.
        </p>

        <style>{`
          @keyframes ob-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-16px); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default OnboardingPage;
