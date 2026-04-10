import { ResponsiveHeatMap } from '@nivo/heatmap';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';

interface HeatmapPerformanceProps {
  data: Array<{
    id: string;
    data: Array<{ x: string; y: number | null }>;
  }>;
  metric?: 'ctr' | 'spend' | 'impressions';
}

export function HeatmapPerformance({ data, metric = 'ctr' }: HeatmapPerformanceProps) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
        Performance por horário — {metric.toUpperCase()}
      </p>
      <div style={{ height: 160 }}>
        <ResponsiveHeatMap
          data={data}
          theme={T.nivoTheme}
          colors={{
            type: 'sequential',
            scheme: 'blues',
            minValue: 0,
          }}
          margin={{ top: 20, right: 10, bottom: 30, left: 36 }}
          axisTop={{
            tickSize: 0,
            tickPadding: 6,
            tickRotation: 0,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: 0,
          }}
          borderRadius={3}
          borderWidth={2}
          borderColor={T.bg}
          enableLabels={false}
          animate
          motionConfig="gentle"
          tooltip={({ cell }) => (
            <div style={{
              background: '#0d1117', border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '6px 10px',
              fontSize: 12, color: T.textPrimary,
            }}>
              <strong>{cell.serieId}</strong> às {cell.data.x}: {typeof cell.data.y === 'number' ? cell.data.y.toFixed(2) : cell.data.y}%
            </div>
          )}
        />
      </div>
    </div>
  );
}
