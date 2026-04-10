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

export function SparklineCard({ label, currentValue, prevValue, data, format = 'number', color: _color, index = 0 }: SparklineCardProps) {
  const isPositive = prevValue ? currentValue >= prevValue : true;
  const lineColor = isPositive ? T.green : T.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.34, 1.1, 0.64, 1] }}
      style={{
        background: T.bgSurface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '16px 18px 0',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.2s',
        cursor: 'default',
      }}
    >
      <AdMetric label={label} value={currentValue} prev={prevValue} format={format} index={0} />

      <div style={{ height: 56, marginTop: 4, marginLeft: -18, marginRight: -18 }}>
        {data.length > 0 ? <ResponsiveLine
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
          areaBaselineValue={data.length > 0 ? Math.min(...data.map(d => d.y)) * 0.95 : 0}
          areaOpacity={0.12}
          isInteractive={false}
          animate
        /> : <div style={{ height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }} />}
      </div>
    </motion.div>
  );
}
