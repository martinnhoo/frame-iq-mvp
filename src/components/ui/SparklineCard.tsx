import { ResponsiveLine } from '@nivo/line';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';
import { AdMetric } from './AdMetric';

const A = '#0da2e7';

interface SparklineCardProps {
  label: string;
  currentValue: number;
  data: Array<{ x: string; y: number }>;
  format?: 'currency' | 'percent' | 'number' | 'roas';
}

export function SparklineCard({ label, currentValue, data, format = 'number' }: SparklineCardProps) {
  const hasData = data.length > 1;

  return (
    <div
      className="spark-card"
      style={{
        background: 'rgba(13,162,231,0.03)',
        border: '1px solid rgba(13,162,231,0.10)',
        borderRadius: 14,
        padding: '16px 18px 0',
        overflow: 'hidden',
        position: 'relative',
        height: 130,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Subtle top accent */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%',
        height: 1, background: `linear-gradient(90deg, transparent, ${A}20, transparent)`,
      }} />

      <div style={{ flex: 1 }}>
        <AdMetric label={label} value={currentValue} format={format} />
      </div>

      <div style={{ height: 44, marginLeft: -18, marginRight: -18, flexShrink: 0 }}>
        {hasData ? (
          <ResponsiveLine
            data={[{ id: label, data }]}
            theme={T.nivoTheme}
            colors={[A]}
            lineWidth={1.5}
            enablePoints={false}
            enableGridX={false}
            enableGridY={false}
            axisTop={null} axisRight={null} axisBottom={null} axisLeft={null}
            margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
            curve="monotoneX"
            enableArea
            areaBaselineValue={Math.min(...data.map(d => d.y)) * 0.9}
            areaOpacity={0.15}
            isInteractive={false}
            animate
          />
        ) : (
          <div style={{ height: '100%', background: 'rgba(13,162,231,0.02)' }} />
        )}
      </div>
    </div>
  );
}
