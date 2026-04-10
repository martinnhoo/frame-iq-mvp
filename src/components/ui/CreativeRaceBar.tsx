import { ResponsiveBump } from '@nivo/bump';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';

interface CreativeRaceBarProps {
  data: Array<{
    id: string;
    data: Array<{ x: string; y: number }>;
  }>;
}

export function CreativeRaceBar({ data }: CreativeRaceBarProps) {
  const colors = [T.accent, T.green, T.amber, T.red, T.purple];

  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
        Ranking de criativos por período
      </p>
      <div style={{ height: 200 }}>
        <ResponsiveBump
          data={data}
          theme={T.nivoTheme}
          colors={colors}
          lineWidth={2}
          activeLineWidth={4}
          inactiveLineWidth={1}
          inactiveOpacity={0.2}
          pointSize={8}
          activePointSize={12}
          inactivePointSize={4}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          activePointBorderWidth={2}
          pointBorderColor={{ from: 'serie.color' }}
          axisTop={null}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: 0,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
          }}
          axisRight={null}
          margin={{ top: 20, right: 100, bottom: 32, left: 40 }}
          animate
          motionConfig="gentle"
        />
      </div>
    </div>
  );
}
