import NumberFlow from '@number-flow/react';

const A = '#0da2e7';

interface AdMetricProps {
  label: string;
  value: number;
  format?: 'currency' | 'percent' | 'number' | 'roas';
  suffix?: string;
  prefix?: string;
  size?: 'sm' | 'md' | 'lg';
}

const FORMAT_MAP: Record<string, Intl.NumberFormatOptions> = {
  currency: { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  percent:  { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  number:   { useGrouping: true },
  roas:     { minimumFractionDigits: 1, maximumFractionDigits: 2 },
};

export function AdMetric({ label, value, format = 'number', suffix, prefix, size = 'md' }: AdMetricProps) {
  const valueForFlow = format === 'percent' ? value / 100 : value;
  const fontSizes = { sm: 20, md: 26, lg: 36 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Label — prominent */}
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: A, opacity: 0.7,
        fontFamily: "'DM Mono', 'SF Mono', monospace",
      }}>
        {label}
      </p>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        {prefix && <span style={{ fontSize: fontSizes[size] * 0.55, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{prefix}</span>}
        <NumberFlow
          value={valueForFlow}
          format={FORMAT_MAP[format] as any}
          style={{
            fontSize: fontSizes[size],
            fontWeight: 800,
            color: '#f0f2f8',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
          willChange
        />
        {suffix && <span style={{ fontSize: fontSizes[size] * 0.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{suffix}</span>}
      </div>
    </div>
  );
}
