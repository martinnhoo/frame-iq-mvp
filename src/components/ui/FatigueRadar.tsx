import { ResponsiveWaffle } from '@nivo/waffle';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';

interface FatigueRadarProps {
  escalando: number;
  estavel: number;
  fadigando: number;
  pausado: number;
}

export function FatigueRadar({ escalando, estavel, fadigando, pausado }: FatigueRadarProps) {
  const total = escalando + estavel + fadigando + pausado;

  const data = [
    { id: 'Escalando', label: 'Escalando', value: escalando, color: T.green },
    { id: 'Estável',   label: 'Estável',   value: estavel,   color: T.accent },
    { id: 'Fadigando', label: 'Fadigando', value: fadigando, color: T.amber  },
    { id: 'Pausado',   label: 'Pausado',   value: pausado,   color: 'rgba(255,255,255,0.2)' },
  ];

  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
        Status dos criativos ({total} ativos)
      </p>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ height: 80, width: 140, flexShrink: 0 }}>
          <ResponsiveWaffle
            data={data}
            total={total}
            rows={5}
            columns={Math.ceil(total / 5)}
            theme={T.nivoTheme}
            colors={(d: { data: { color: string } }) => d.data.color}
            borderRadius={2}
            gap={2}
            padding={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            motionStagger={2}
            legends={[]}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T.textSecondary }}>{d.label}</span>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace", marginLeft: 'auto' }}>
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
