/**
 * useDesignTokens — Single source of truth for design system
 *
 * Use this in any component to get consistent design tokens:
 *
 * ```tsx
 * const T = useDesignTokens();
 *
 * <div style={{ color: T.textPrimary, fontFamily: T.font }}>
 *   Text
 * </div>
 * ```
 *
 * Or import the tokens object directly:
 *
 * ```tsx
 * import { DESIGN_TOKENS as T } from '@/hooks/useDesignTokens';
 * ```
 */

export const DESIGN_TOKENS = {
  // ───────────────────────────────────────────────────────────────────────
  // COLORS
  // ───────────────────────────────────────────────────────────────────────

  // Surface (backgrounds)
  surface0: '#070d1a',
  surface1: '#0d1117',
  surface2: '#111620',
  surface3: '#161c2a',

  // Accent & actions
  accent: '#0ea5e9',
  accentGlow: 'rgba(14,165,233,.1)',

  // Status
  red: '#ef4444',
  green: '#22c55e',
  amber: '#eab308',

  // Text
  textPrimary: '#f0f2f8',
  textSecondary: 'rgba(255,255,255,.65)',
  textMuted: 'rgba(255,255,255,.45)',

  // Borders
  borderSubtle: 'rgba(255,255,255,.04)',
  borderLight: 'rgba(255,255,255,.08)',
  borderTopLight: 'rgba(255,255,255,.12)',

  // ───────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ───────────────────────────────────────────────────────────────────────

  font: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  display: "'Syne', 'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'Space Grotesk', 'DM Mono', monospace",

  // ───────────────────────────────────────────────────────────────────────
  // SPACING (in pixels)
  // ───────────────────────────────────────────────────────────────────────

  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
  },

  // ───────────────────────────────────────────────────────────────────────
  // RADIUS
  // ───────────────────────────────────────────────────────────────────────

  r: 12, // Default border radius in pixels

  // ───────────────────────────────────────────────────────────────────────
  // SHADOWS & CARD STYLING
  // ───────────────────────────────────────────────────────────────────────

  shadowInset: 'inset 0 1px 0 0 rgba(255,255,255,.12)',
  shadowSm: '0 2px 8px rgba(0,0,0,.25)',
  shadowMd: '0 4px 12px rgba(0,0,0,.3)',
  shadowLg: '0 8px 24px rgba(0,0,0,.35)',

  // ───────────────────────────────────────────────────────────────────────
  // TRANSITIONS
  // ───────────────────────────────────────────────────────────────────────

  transitionFast: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
  transitionBase: 'all 0.3s cubic-bezier(.16,1,.3,1)',
  transitionSlow: 'all 0.55s cubic-bezier(.16,1,.3,1)',

} as const;

/**
 * Hook version (for components)
 * Usage: const T = useDesignTokens();
 */
export const useDesignTokens = () => DESIGN_TOKENS;

/**
 * Helper: Card elevation function
 * Returns appropriate card styling for elevation level
 *
 * Usage:
 * ```tsx
 * <div style={{ ...card(1), padding: '16px' }}>
 *   Content
 * </div>
 * ```
 */
export const getCardStyle = (level: 1 | 2 | 3 = 1): React.CSSProperties => {
  const T = DESIGN_TOKENS;
  const bgMap = { 1: T.surface1, 2: T.surface2, 3: T.surface3 };
  return {
    background: bgMap[level],
    border: `1px solid ${T.borderSubtle}`,
    borderRadius: T.r,
    boxShadow: `${T.shadowInset}, ${T.shadowSm}`,
  };
};

/**
 * Helper: Mono/number styling
 * Auto-applies tabular-nums for alignment
 *
 * Usage:
 * ```tsx
 * <span style={getMonoStyle()}>12,345.67</span>
 * ```
 */
export const getMonoStyle = (): React.CSSProperties => ({
  fontFamily: DESIGN_TOKENS.mono,
  letterSpacing: '-0.03em',
  fontVariantNumeric: 'tabular-nums',
});

/**
 * Helper: Fade-up animation
 *
 * Usage:
 * ```tsx
 * <div style={getFadeUpStyle(60)}>
 *   Animated content
 * </div>
 * ```
 */
export const getFadeUpStyle = (delay: number): React.CSSProperties => ({
  animation: `fadeUp 0.55s cubic-bezier(.16,1,.3,1) ${delay}ms both`,
});

/**
 * Helper: Button base style
 * Foundation for all buttons
 */
export const getButtonBaseStyle = (): React.CSSProperties => ({
  fontFamily: DESIGN_TOKENS.font,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  border: 'none',
  borderRadius: DESIGN_TOKENS.r,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: DESIGN_TOKENS.transitionBase,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  minHeight: '44px',
});

/**
 * Helper: Button primary style (destructive/urgent action)
 *
 * Usage:
 * ```tsx
 * <button style={{ ...getButtonBaseStyle(), ...getButtonPrimaryStyle() }}>
 *   Delete
 * </button>
 * ```
 */
export const getButtonPrimaryStyle = (color: string = '#ef4444'): React.CSSProperties => {
  const T = DESIGN_TOKENS;
  return {
    background: `linear-gradient(135deg, ${color}, ${adjustColor(color, -20)})`,
    color: '#fff',
    border: `1px solid ${adjustColor(color, 40)}`,
    boxShadow: `0 0 30px ${adjustColor(color, 40)}, 0 8px 24px ${adjustColor(color, 20)}, inset 0 1px 0 rgba(255,255,255,.25)`,
  };
};

/**
 * Helper: Button secondary style
 */
export const getButtonSecondaryStyle = (): React.CSSProperties => {
  const T = DESIGN_TOKENS;
  return {
    background: `linear-gradient(135deg, ${T.surface2}88, ${T.surface3}88)`,
    color: T.textSecondary,
    border: `1.5px solid ${T.borderLight}`,
    boxShadow: `0 4px 12px rgba(0,0,0,.2)`,
  };
};

/**
 * Color adjustment utility (lighten/darken hex colors)
 * @param color Hex color code
 * @param percent Positive = lighten, negative = darken
 */
function adjustColor(color: string, percent: number): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${((0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1))}`;
}
