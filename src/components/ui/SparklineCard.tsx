import { ResponsiveLine } from '@nivo/line';
import { motion } from 'motion/react';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';
import { AdMetric } from './AdMetric';

interface SparklineCardProps {
  label: string;
  currentValue: number;
  prevValue?: number;
  data: Array<{ x: string; y: number }>;
  format?: 'currency' | 'percent' | 'number' | 'roas';
  color?: string;
  index?: number;
}

export function SparklineCard({ label, currentValue, prevValue, data, format = 'number', color, index = 0 }: SparklineCardProps) {
  const lineColor = color || T.accent;
  const hasData = data.length > 0 && data.some(d => d.y > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.34, 1.1, 0.64, 1] }}
      className="spark-card"
      style={{
        background: `linear-gradient(145deg, ${lineColor}0A, transparent 70%)`,
        border: `1px solid ${lineColor}18`,
        borderRadius: 14,
        padding: '16px 18px 0',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'default',
        ['--card-color' as string]: lineColor,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: `linear-gradient(90deg, transparent, ${lineColor}40, transparent)`,
      }} />

      <AdMetric label={label} value={currentValue} prev={prevValue} format={format} index={0} />

      <div style={{ height: 56, marginTop: 4, marginLeft: -18, marginRight: -18 }}>
        {hasData ? (
          <ResponsiveLine
            data={[{ id: label, data }]}
            theme={T.nivoTheme}
            colors={[lineColor]}
            lineWidth={1.5}
            enablePoints={false}
            enableGridX={false}
            enableGridY={false}
            axisTop={null} axisRight={null} axisBottom={null} axisLeft={null}
            margin={{ top: 4, bottom: 4, left: 0, right: 0 }}
            curve="monotoneX"
            enableArea
            areaBaselineValue={Math.min(...data.map(d => d.y)) * 0.95}
            areaOpacity={0.12}
            isInteractive={false}
            animate
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: T.textMuted, fontFamily: "'DM Mono', monospace",
            letterSpacing: '0.05em',
          }}>
            sem dados no período
          </div>
        )}
      </div>
    </motion.div>
  );
}
