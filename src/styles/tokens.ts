export const ADBRIEF_TOKENS = {
  // Cores
  accent:       '#0da2e7',
  accentMuted:  'rgba(13,162,231,0.08)',
  accentBorder: 'rgba(13,162,231,0.18)',

  // Semântico
  green:  '#22A3A3',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#a855f7',

  // Fundos — deeper blacks for premium feel
  bg:        '#050508',
  bgSurface: 'rgba(255,255,255,0.025)',
  bgHover:   'rgba(255,255,255,0.05)',

  // Bordas — neutral, not blue
  border:       'rgba(255,255,255,0.06)',
  borderHover:  'rgba(255,255,255,0.12)',

  // Texto
  textPrimary:   '#f0f2f8',
  textSecondary: 'rgba(255,255,255,0.50)',
  textMuted:     'rgba(255,255,255,0.25)',

  // Nivo theme (para todos os gráficos)
  nivoTheme: {
    background: 'transparent',
    text: { fill: 'rgba(255,255,255,0.45)', fontSize: 11 },
    axis: {
      domain: { line: { stroke: 'rgba(255,255,255,0.08)' } },
      ticks: {
        line: { stroke: 'rgba(255,255,255,0.08)' },
        text: { fill: 'rgba(255,255,255,0.35)', fontSize: 10 },
      },
    },
    grid: { line: { stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 } },
    tooltip: {
      container: {
        background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        color: '#f0f2f8',
        fontSize: 12,
      },
    },
  },
} as const;
