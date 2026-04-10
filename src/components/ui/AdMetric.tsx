import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';

interface AdMetricProps {
  label: string;
  value: number;
  prev?: number;
  format?: 'currency' | 'percent' | 'number' | 'roas';
  suffix?: string;
  prefix?: string;
  size?: 'sm' | 'md' | 'lg';
  index?: number;
}

const FORMAT_MAP: Record<string, Intl.NumberFormatOptions> = {
  currency: { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  percent:  { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  number:   { useGrouping: true },
  roas:     { minimumFractionDigits: 1, maximumFractionDigits: 2 },
};

export function AdMetric({ label, value, prev, format = 'number', suffix, prefix, size = 'md', index = 0 }: AdMetricProps) {
  const delta = prev !== undefined ? ((value - prev) / Math.abs(prev || 1)) * 100 : null;
  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;
  const isFlat = delta !== null && delta === 0;

  const deltaColor = isUp ? T.green : isDown ? T.red : T.textMuted;
  const valueForFlow = format === 'percent' ? value / 100 : value;

  const fontSizes = { sm: 20, md: 28, lg: 40 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.34, 1.1, 0.64, 1] }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '14px 0',
      }}
    >
      <p style={{
        margin: 0, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: T.textMuted, fontFamily: "'DM Mono', monospace",
      }}>
        {label}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {prefix && <span style={{ fontSize: fontSizes[size] * 0.55, color: T.textSecondary, fontWeight: 700 }}>{prefix}</span>}
        <NumberFlow
          value={valueForFlow}
          format={FORMAT_MAP[format]}
          style={{
            fontSize: fontSizes[size],
            fontWeight: 800,
            color: T.textPrimary,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
          willChange
        />
        {suffix && <span style={{ fontSize: fontSizes[size] * 0.5, color: T.textSecondary, fontWeight: 700, marginBottom: 2 }}>{suffix}</span>}
      </div>

      {delta !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isUp && <TrendingUp size={11} style={{ color: deltaColor }} />}
          {isDown && <TrendingDown size={11} style={{ color: deltaColor }} />}
          {isFlat && <Minus size={11} style={{ color: deltaColor }} />}
          <span style={{ fontSize: 11, color: deltaColor, fontFamily: "'DM Mono', monospace" }}>
            {isUp ? '+' : ''}{delta.toFixed(1)}% vs anterior
          </span>
        </div>
      )}
    </motion.div>
  );
}
