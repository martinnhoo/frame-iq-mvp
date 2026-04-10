import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Flame, AlertTriangle } from 'lucide-react';
import { ADBRIEF_TOKENS as T } from '@/styles/tokens';

interface Creative {
  name: string;
  ctr: number;
  roas: number;
  spend: number;
  trend: 'up' | 'down' | 'hot' | 'risk';
  contribution: number;
}

interface WinnersListProps {
  items: Creative[];
  type?: 'winners' | 'losers';
}

const TREND_CONFIG = {
  up:   { icon: TrendingUp,    color: T.green,  label: 'Escalando' },
  down: { icon: TrendingDown,  color: T.red,    label: 'Caindo'    },
  hot:  { icon: Flame,         color: T.amber,  label: 'Em alta'   },
  risk: { icon: AlertTriangle, color: T.red,    label: 'Risco'     },
} as const;

export function WinnersList({ items, type = 'winners' }: WinnersListProps) {
  const maxCtr = Math.max(...items.map(i => i.ctr));

  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: type === 'winners' ? T.green : T.red, fontFamily: "'DM Mono', monospace" }}>
        {type === 'winners' ? '✓ Winners' : '✗ Losers'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => {
          const tc = TREND_CONFIG[item.trend];
          const TrendIcon = tc.icon;
          const barWidth = (item.ctr / maxCtr) * 100;

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <TrendIcon size={11} style={{ color: tc.color, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, color: T.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 160,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                    CTR {(item.ctr * 100).toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                    ROAS {item.roas.toFixed(1)}x
                  </span>
                </div>
              </div>

              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 2, background: tc.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
