import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ScanEye,
  Zap,
  FileText,
  BarChart3,
  Target,
  Clapperboard,
  Languages,
  LayoutDashboard,
  Stethoscope,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";

interface ToolCard {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  route: string;
  tag?: string;
}

const TOOLS: ToolCard[] = [
  {
    id: 'ad-score',
    label: 'Ad Score',
    desc: 'Análise de criativo com nota e recomendações',
    icon: ScanEye,
    color: '#0ea5e9',
    route: '/dashboard/ad-score',
  },
  {
    id: 'hooks',
    label: 'Gerador de Hooks',
    desc: 'Hooks de alta conversão para seus anúncios',
    icon: Zap,
    color: '#f59e0b',
    route: '/dashboard/hooks',
  },
  {
    id: 'script',
    label: 'Roteiros',
    desc: 'Scripts de vídeo otimizados para ads',
    icon: Clapperboard,
    color: '#8b5cf6',
    route: '/dashboard/script',
  },
  {
    id: 'brief',
    label: 'Briefing Criativo',
    desc: 'Brief completo para seu time ou designer',
    icon: FileText,
    color: '#10b981',
    route: '/dashboard/brief',
  },
  {
    id: 'competitor',
    label: 'Decodificar Concorrente',
    desc: 'Análise reversa de anúncios concorrentes',
    icon: Target,
    color: '#ef4444',
    route: '/dashboard/competitor',
  },
  {
    id: 'analyses',
    label: 'Análises',
    desc: 'Relatórios detalhados de performance',
    icon: BarChart3,
    color: '#06b6d4',
    route: '/dashboard/analyses',
  },
  {
    id: 'translate',
    label: 'Tradutor de Ads',
    desc: 'Adapte anúncios para outros mercados',
    icon: Languages,
    color: '#ec4899',
    route: '/dashboard/translate',
  },
  {
    id: 'diagnostic',
    label: 'Diagnóstico',
    desc: 'Auditoria completa da conta de anúncios',
    icon: Stethoscope,
    color: '#f97316',
    route: '/dashboard/diagnostic',
  },
  {
    id: 'loop',
    label: 'Creative Loop',
    desc: 'Ciclo contínuo de criação e teste',
    icon: RefreshCw,
    color: '#14b8a6',
    route: '/dashboard/loop',
  },
  {
    id: 'boards',
    label: 'Boards',
    desc: 'Organize referências e inspirações',
    icon: LayoutDashboard,
    color: '#a78bfa',
    route: '/dashboard/boards',
  },
  {
    id: 'ai-chat',
    label: 'Chat IA',
    desc: 'Converse com a IA sobre seus anúncios',
    icon: MessageSquare,
    color: '#0da2e7',
    route: '/dashboard/ai',
    tag: 'IA',
  },
];

function ToolCardComponent({ tool, onClick }: { tool: ToolCard; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 12,
        padding: '20px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: F,
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
      }}
    >
      {tool.tag && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.06em',
        }}>
          {tool.tag}
        </span>
      )}

      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${tool.color}12`,
        border: `1px solid ${tool.color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={tool.color} strokeWidth={1.5} />
      </div>

      <div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#fff',
          marginBottom: 3, letterSpacing: '-0.01em',
        }}>
          {tool.label}
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.4,
        }}>
          {tool.desc}
        </div>
      </div>
    </button>
  );
}

const CriarHub: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 20, fontWeight: 700, color: '#fff',
            fontFamily: F, letterSpacing: '-0.02em', margin: 0,
          }}>
            Ferramentas
          </h1>
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.30)',
            margin: '4px 0 0', fontFamily: F,
          }}>
            Crie, analise e otimize seus anúncios
          </p>
        </div>

        {/* Tool cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {TOOLS.map(tool => (
            <ToolCardComponent
              key={tool.id}
              tool={tool}
              onClick={() => navigate(tool.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CriarHub;
