/**
 * Cockpit shared primitives — one source of truth for the small UI vocabulary
 * used across every cockpit page.
 *
 * Keep this file tiny and purely presentational. No data fetching, no routing
 * logic beyond the command palette.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Filter,
  LayoutDashboard,
  ScrollText,
  Search,
  Users as UsersIcon,
  X,
} from 'lucide-react';

// ── Design tokens ────────────────────────────────────────────────────────────
export const F = "'Plus Jakarta Sans', sans-serif";
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const COLORS = {
  bg: '#060A14',
  surface: 'rgba(15,23,42,0.40)',
  surfaceStrong: 'rgba(15,23,42,0.70)',
  surfaceHi: 'rgba(15,23,42,0.88)',
  border: 'rgba(148,163,184,0.08)',
  borderStrong: 'rgba(148,163,184,0.14)',
  divider: 'rgba(148,163,184,0.04)',

  text: '#F1F5F9',
  textMid: '#CBD5E1',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  textFaint: '#475569',

  accent: '#60A5FA',
  accentStrong: '#2563EB',
  success: '#22C55E',
  successSoft: '#86EFAC',
  warn: '#F59E0B',
  warnSoft: '#FCD34D',
  critical: '#EF4444',
  criticalSoft: '#FCA5A5',
  purple: '#A78BFA',
  purpleSoft: '#D8B4FE',
  cyan: '#67E8F9',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function shortDateCompact(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

export function longDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return shortDateCompact(iso);
}

export function fmtBrl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR')}`;
}

export function fmtMoney(v: number | null, currency: string | null): string {
  if (v == null) return '—';
  const cur = (currency ?? 'BRL').toUpperCase();
  if (cur === 'BRL') {
    return `R$ ${Number(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${cur} ${Number(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getInitials(name: string | null | undefined, fallback?: string | null): string {
  const seed = (name ?? fallback ?? '').trim();
  if (!seed) return '?';
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return seed.charAt(0).toUpperCase() || '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function percent(n: number, total: number, digits = 0): string {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(digits)}%`;
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useCopyToClipboard(resetMs = 1200) {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(
    async (text: string, token?: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(token ?? text);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(null), resetMs);
      } catch {
        // Clipboard API denied — silently ignore. The UI will not flip to
        // "copied" so the user knows nothing happened.
      }
    },
    [resetMs],
  );

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return { copied, copy };
}

export function useHotkey(
  match: (e: KeyboardEvent) => boolean,
  handler: (e: KeyboardEvent) => void,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (match(e)) handler(e);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ── Primitives ───────────────────────────────────────────────────────────────
export function Card({
  children,
  padding = 18,
  style,
}: {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding,
        fontFamily: F,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type ToneKey = 'default' | 'success' | 'warn' | 'critical' | 'info';

const TONE_COLOR: Record<ToneKey, string> = {
  default: COLORS.accent,
  info: COLORS.accent,
  success: COLORS.success,
  warn: COLORS.warn,
  critical: COLORS.critical,
};

export function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  trend,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: React.ElementType;
  tone?: ToneKey;
  trend?: { delta: number; label?: string };
}) {
  const toneColor = TONE_COLOR[tone];
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: `${toneColor}14`,
            border: `1px solid ${toneColor}26`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={14} color={toneColor} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: COLORS.textDim,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        {trend && <TrendBadge delta={trend.delta} label={trend.label} />}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>
      )}
    </Card>
  );
}

export function TrendBadge({
  delta,
  label,
}: {
  delta: number;
  label?: string;
}) {
  const up = delta > 0;
  const flat = delta === 0;
  const color = flat ? COLORS.textDim : up ? COLORS.successSoft : COLORS.criticalSoft;
  const arrow = flat ? '·' : up ? '▲' : '▼';
  const text = `${arrow} ${Math.abs(delta).toFixed(0)}%${label ? ` ${label}` : ''}`;
  return (
    <span
      style={{
        marginLeft: 'auto',
        padding: '2px 7px',
        borderRadius: 999,
        background: flat ? 'rgba(148,163,184,0.08)' : up ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
        color,
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: F,
      }}
      title={label ? `vs ${label}` : undefined}
    >
      {text}
    </span>
  );
}

export function SectionHead({
  icon: Icon,
  title,
  tone = 'default',
  right,
}: {
  icon: React.ElementType;
  title: string;
  tone?: 'default' | 'critical';
  right?: ReactNode;
}) {
  const color = tone === 'critical' ? COLORS.criticalSoft : COLORS.accent;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={14} color={color} />
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{title}</div>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  );
}

// ── Pills ────────────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  free: { bg: 'rgba(148,163,184,0.08)', fg: '#94A3B8' },
  maker: { bg: 'rgba(6,182,212,0.10)', fg: '#67E8F9' },
  creator: { bg: 'rgba(6,182,212,0.10)', fg: '#67E8F9' },
  pro: { bg: 'rgba(37,99,235,0.14)', fg: '#93C5FD' },
  starter: { bg: 'rgba(37,99,235,0.14)', fg: '#93C5FD' },
  studio: { bg: 'rgba(168,85,247,0.14)', fg: '#D8B4FE' },
  scale: { bg: 'rgba(168,85,247,0.14)', fg: '#D8B4FE' },
};

export function PlanPill({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? PLAN_COLORS.free;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 10.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontFamily: F,
      }}
    >
      {plan}
    </span>
  );
}

export function SubPill({ status }: { status: string }) {
  const color =
    status === 'past_due' ? COLORS.criticalSoft :
    status === 'active' ? COLORS.successSoft :
    status === 'trialing' ? COLORS.warnSoft :
    COLORS.textMuted;
  return <MicroPill tone="raw" color={color}>{status}</MicroPill>;
}

export function StatusPill({ status }: { status: string }) {
  const color =
    status === 'connected' ? COLORS.successSoft :
    status === 'disconnected' ? COLORS.criticalSoft :
    COLORS.textMuted;
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: 999,
        background: `${color}15`,
        color,
        fontSize: 10.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontFamily: F,
      }}
    >
      {status}
    </span>
  );
}

export function MicroPill({
  children,
  tone,
  color,
}: {
  children: ReactNode;
  tone: 'success' | 'warn' | 'muted' | 'raw' | 'info';
  color?: string;
}) {
  const map = {
    success: { bg: 'rgba(34,197,94,0.10)', fg: COLORS.successSoft },
    warn: { bg: 'rgba(245,158,11,0.10)', fg: COLORS.warnSoft },
    muted: { bg: 'rgba(148,163,184,0.08)', fg: COLORS.textMuted },
    info: { bg: 'rgba(37,99,235,0.10)', fg: '#93C5FD' },
    raw: { bg: `${color ?? COLORS.textMuted}15`, fg: color ?? COLORS.textMuted },
  }[tone];
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: map.bg,
        color: map.fg,
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: F,
      }}
    >
      {children}
    </span>
  );
}

export function Flag({
  text,
  tone,
}: {
  text: string;
  tone: 'critical' | 'warn' | 'muted' | 'success';
}) {
  const map = {
    critical: { bg: 'rgba(239,68,68,0.12)', fg: COLORS.criticalSoft },
    warn: { bg: 'rgba(245,158,11,0.12)', fg: COLORS.warnSoft },
    muted: { bg: 'rgba(148,163,184,0.10)', fg: COLORS.textMuted },
    success: { bg: 'rgba(34,197,94,0.12)', fg: COLORS.successSoft },
  }[tone];
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: 999,
        background: map.bg,
        color: map.fg,
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: F,
      }}
    >
      {text}
    </span>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        borderRadius: 8,
        background: COLORS.surfaceStrong,
        border: `1px solid ${COLORS.borderStrong}`,
        color: disabled ? COLORS.textFaint : COLORS.textMid,
        fontSize: 12,
        fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  icon: Icon,
  tone = 'default',
  size = 'md',
  title,
  disabled,
  type,
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: React.ElementType;
  tone?: 'default' | 'accent' | 'critical' | 'success';
  size?: 'sm' | 'md';
  title?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const tones: Record<string, { fg: string; bg: string; bd: string; hover: string }> = {
    default: {
      fg: COLORS.textMid,
      bg: COLORS.surfaceStrong,
      bd: COLORS.borderStrong,
      hover: 'rgba(37,99,235,0.10)',
    },
    accent: {
      fg: '#93C5FD',
      bg: 'rgba(37,99,235,0.12)',
      bd: 'rgba(37,99,235,0.30)',
      hover: 'rgba(37,99,235,0.20)',
    },
    critical: {
      fg: COLORS.criticalSoft,
      bg: 'rgba(239,68,68,0.08)',
      bd: 'rgba(239,68,68,0.25)',
      hover: 'rgba(239,68,68,0.16)',
    },
    success: {
      fg: COLORS.successSoft,
      bg: 'rgba(34,197,94,0.08)',
      bd: 'rgba(34,197,94,0.25)',
      hover: 'rgba(34,197,94,0.16)',
    },
  };
  const t = tones[tone];
  const pad = size === 'sm' ? '5px 9px' : '7px 12px';
  const fs = size === 'sm' ? 11.5 : 12.5;
  const ig = size === 'sm' ? 5 : 6;
  const ic = size === 'sm' ? 12 : 13;
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: ig,
        padding: pad,
        borderRadius: 8,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: disabled ? COLORS.textFaint : t.fg,
        fontSize: fs,
        fontFamily: F,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = t.hover;
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = t.bg;
      }}
    >
      {Icon && <Icon size={ic} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

// ── Copy button (inline) ─────────────────────────────────────────────────────
export function CopyButton({
  text,
  label,
  size = 12,
  title,
}: {
  text: string;
  label?: string;
  size?: number;
  title?: string;
}) {
  const { copy, copied } = useCopyToClipboard();
  const isCopied = copied === text;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        copy(text);
      }}
      title={title ?? (isCopied ? 'Copied' : 'Copy')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: label ? '3px 7px' : 3,
        borderRadius: 6,
        background: isCopied ? 'rgba(34,197,94,0.10)' : 'transparent',
        border: `1px solid ${isCopied ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.10)'}`,
        color: isCopied ? COLORS.successSoft : COLORS.textDim,
        cursor: 'pointer',
        fontFamily: F,
        fontSize: 10.5,
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isCopied) (e.currentTarget as HTMLElement).style.color = COLORS.textMid;
      }}
      onMouseLeave={(e) => {
        if (!isCopied) (e.currentTarget as HTMLElement).style.color = COLORS.textDim;
      }}
    >
      {isCopied ? <Check size={size} /> : <Copy size={size} />}
      {label && <span>{isCopied ? 'copied' : label}</span>}
    </button>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({
  src,
  name,
  email,
  size = 32,
  radius,
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.26);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'rgba(148,163,184,0.08)',
        border: `1px solid rgba(148,163,184,0.10)`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.textMuted,
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
        fontFamily: F,
        flexShrink: 0,
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        getInitials(name, email)
      )}
    </div>
  );
}

// ── Filter bar atoms ─────────────────────────────────────────────────────────
export function SelectFilter({
  label,
  value,
  options,
  onChange,
  renderOption,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderOption?: (o: string) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Filter size={12} color={COLORS.textDim} />
      <span
        style={{
          fontSize: 11,
          color: COLORS.textDim,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontFamily: F,
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: COLORS.surfaceStrong,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 8,
          padding: '6px 10px',
          color: COLORS.text,
          fontSize: 12,
          fontFamily: F,
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleChip({
  label,
  active,
  onClick,
  tone = 'accent',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: 'accent' | 'critical' | 'warn';
}) {
  const tones = {
    accent: {
      bgA: 'rgba(37,99,235,0.14)',
      bdA: 'rgba(37,99,235,0.40)',
      fgA: '#93C5FD',
    },
    critical: {
      bgA: 'rgba(239,68,68,0.14)',
      bdA: 'rgba(239,68,68,0.40)',
      fgA: COLORS.criticalSoft,
    },
    warn: {
      bgA: 'rgba(245,158,11,0.14)',
      bdA: 'rgba(245,158,11,0.40)',
      fgA: COLORS.warnSoft,
    },
  }[tone];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        background: active ? tones.bgA : COLORS.surfaceStrong,
        border: `1px solid ${active ? tones.bdA : COLORS.borderStrong}`,
        color: active ? tones.fgA : COLORS.textMuted,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: F,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Command palette ─────────────────────────────────────────────────────────
interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Focus after the modal has painted.
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      { id: 'overview', label: 'Go to Overview', hint: '/cockpit', icon: LayoutDashboard,
        run: () => navigate('/cockpit') },
      { id: 'users', label: 'Search users', hint: '/cockpit/users', icon: UsersIcon,
        run: () => navigate('/cockpit/users') },
      { id: 'audit', label: 'Open audit log', hint: '/cockpit/audit', icon: ScrollText,
        run: () => navigate('/cockpit/audit') },
      { id: 'past_due', label: 'Users · past_due', hint: 'filter', icon: UsersIcon,
        run: () => navigate('/cockpit/users?status=past_due') },
      { id: 'trial', label: 'Users · trialing', hint: 'filter', icon: UsersIcon,
        run: () => navigate('/cockpit/users?status=trialing') },
      { id: 'inactive', label: 'Users · inactive 7d', hint: 'filter', icon: UsersIcon,
        run: () => navigate('/cockpit/users?inactive_7d=1') },
      { id: 'pro', label: 'Users · plan pro', hint: 'filter', icon: UsersIcon,
        run: () => navigate('/cockpit/users?plan=pro') },
      { id: 'studio', label: 'Users · plan studio', hint: 'filter', icon: UsersIcon,
        run: () => navigate('/cockpit/users?plan=studio') },
      { id: 'dashboard', label: 'Back to adbrief dashboard', hint: '/dashboard',
        icon: LayoutDashboard, run: () => navigate('/dashboard') },
    ],
    [navigate],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) || (c.hint ?? '').toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered.length, activeIdx]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) {
        cmd.run();
        onClose();
      }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '14vh',
        fontFamily: F,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        style={{
          width: 'min(560px, 92vw)',
          background: '#0B1220',
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <Search size={14} color={COLORS.textDim} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: COLORS.text,
              fontSize: 14,
              fontFamily: F,
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              color: COLORS.textDim,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(148,163,184,0.08)',
              border: `1px solid ${COLORS.borderStrong}`,
              fontFamily: MONO,
            }}
          >
            esc
          </kbd>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>
              No matches.
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  cmd.run();
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: activeIdx === i ? 'rgba(37,99,235,0.14)' : 'transparent',
                  border: 'none',
                  color: COLORS.textMid,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: F,
                  fontSize: 13,
                }}
              >
                <cmd.icon size={14} color={activeIdx === i ? COLORS.accent : COLORS.textMuted} />
                <span style={{ flex: 1, color: COLORS.text }}>{cmd.label}</span>
                {cmd.hint && (
                  <span style={{ fontSize: 10.5, color: COLORS.textDim, fontFamily: MONO }}>
                    {cmd.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div
          style={{
            padding: '9px 14px',
            borderTop: `1px solid ${COLORS.border}`,
            display: 'flex',
            gap: 14,
            fontSize: 11,
            color: COLORS.textDim,
            fontFamily: F,
          }}
        >
          <HintKey k="↑↓" l="navigate" />
          <HintKey k="↵" l="select" />
          <HintKey k="esc" l="close" />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={11} />
            <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HintKey({ k, l }: { k: string; l: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <kbd
        style={{
          padding: '1px 5px',
          borderRadius: 4,
          background: 'rgba(148,163,184,0.08)',
          border: `1px solid ${COLORS.borderStrong}`,
          fontFamily: MONO,
          fontSize: 10,
        }}
      >
        {k}
      </kbd>
      <span>{l}</span>
    </span>
  );
}

// ── Misc helpers ─────────────────────────────────────────────────────────────
export function Divider({ vertical, color }: { vertical?: boolean; color?: string }) {
  return (
    <div
      style={{
        width: vertical ? 1 : '100%',
        height: vertical ? '100%' : 1,
        background: color ?? COLORS.border,
      }}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: COLORS.text,
            fontFamily: F,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 3, fontFamily: F }}>
            {subtitle}
          </div>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
