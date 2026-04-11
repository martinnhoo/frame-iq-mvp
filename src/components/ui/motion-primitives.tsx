/**
 * Motion Primitives — Reusable animated components for AdBrief
 * Built with framer-motion (motion/react) + glassmorphism + glow effects
 */
import { motion, AnimatePresence, type Variants } from "motion/react";
import { type ReactNode, type CSSProperties, useState } from "react";

// ── Page Transition Wrapper ─────────────────────────────────────────────────
const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.15 } },
};

export function PageTransition({ children, id }: { children: ReactNode; id: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Fade In (staggered children) ────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function StaggerContainer({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className={className} style={style}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div variants={itemVariants} className={className} style={style}>
      {children}
    </motion.div>
  );
}

// ── Glass Card — Glassmorphism card with hover glow ─────────────────────────
export function GlassCard({
  children, className, style, glow = "blue", hover = true, onClick,
}: {
  children: ReactNode; className?: string; style?: CSSProperties;
  glow?: "blue" | "purple" | "emerald" | "none"; hover?: boolean; onClick?: () => void;
}) {
  const glowColors = {
    blue: { border: "rgba(14,165,233,0.12)", shadow: "rgba(14,165,233,0.06)", hoverBorder: "rgba(14,165,233,0.25)", hoverShadow: "0 8px 40px rgba(14,165,233,0.12)" },
    purple: { border: "rgba(139,92,246,0.12)", shadow: "rgba(139,92,246,0.06)", hoverBorder: "rgba(139,92,246,0.25)", hoverShadow: "0 8px 40px rgba(139,92,246,0.12)" },
    emerald: { border: "rgba(52,211,153,0.12)", shadow: "rgba(52,211,153,0.06)", hoverBorder: "rgba(52,211,153,0.25)", hoverShadow: "0 8px 40px rgba(52,211,153,0.12)" },
    none: { border: "var(--border-subtle)", shadow: "transparent", hoverBorder: "var(--border-default)", hoverShadow: "none" },
  };
  const g = glowColors[glow];

  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={false}
      whileHover={hover ? { y: -2, scale: 1.005, transition: { duration: 0.2 } } : undefined}
      style={{
        background: "rgba(17,22,32,0.65)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        border: `1px solid ${g.border}`,
        borderRadius: "var(--r-lg)",
        padding: "20px",
        boxShadow: `0 4px 24px ${g.shadow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
        transition: "border-color 0.25s, box-shadow 0.25s",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Glow Button — Premium button with gradient + shine effect ───────────────
export function GlowButton({
  children, onClick, variant = "primary", size = "md", disabled, style, className, type = "button",
}: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg";
  disabled?: boolean; style?: CSSProperties; className?: string; type?: "button" | "submit";
}) {
  const sizes = {
    sm: { padding: "6px 14px", fontSize: 12, borderRadius: 8, minHeight: 32 },
    md: { padding: "10px 20px", fontSize: 13.5, borderRadius: 10, minHeight: 40 },
    lg: { padding: "14px 28px", fontSize: 15, borderRadius: 14, minHeight: 48 },
  };
  const s = sizes[size];

  const variants = {
    primary: {
      background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
      color: "#fff",
      border: "none",
      boxShadow: "0 4px 20px rgba(14,165,233,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
    },
    secondary: {
      background: "rgba(255,255,255,0.04)",
      color: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "none",
    },
    ghost: {
      background: "transparent",
      color: "rgba(255,255,255,0.5)",
      border: "1px solid transparent",
      boxShadow: "none",
    },
  };
  const v = variants[variant];

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      style={{
        ...v, ...s,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 650,
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "box-shadow 0.2s, background 0.2s",
        ...style,
      }}
    >
      {variant === "primary" && !disabled && (
        <motion.div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
          }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 8 }}>
        {children}
      </span>
    </motion.button>
  );
}

// ── Animated Counter — Smooth number transitions ────────────────────────────
export function AnimatedNumber({ value, prefix = "", suffix = "", style }: {
  value: number; prefix?: string; suffix?: string; style?: CSSProperties;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ display: "inline-block", fontVariantNumeric: "tabular-nums", ...style }}
    >
      {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
    </motion.span>
  );
}

// ── Glow Divider — Horizontal line with center glow ─────────────────────────
export function GlowDivider({ color = "#0ea5e9", style }: { color?: string; style?: CSSProperties }) {
  return (
    <div style={{
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${color}40 50%, transparent 100%)`,
      margin: "16px 0",
      ...style,
    }} />
  );
}

// ── Floating Glow Orb — Ambient background effect ───────────────────────────
export function GlowOrb({ color = "#0ea5e9", size = 300, top, left, right, bottom, opacity = 0.08 }: {
  color?: string; size?: number; top?: string; left?: string; right?: string; bottom?: string; opacity?: number;
}) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.15, 1],
        opacity: [opacity, opacity * 1.5, opacity],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute", top, left, right, bottom,
        width: size, height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ── Metric Card — KPI display with glass effect ─────────────────────────────
export function MetricCard({
  label, value, prefix, suffix, trend, icon, glow = "blue",
}: {
  label: string; value: number | string; prefix?: string; suffix?: string;
  trend?: { value: number; label?: string }; icon?: ReactNode; glow?: "blue" | "purple" | "emerald";
}) {
  const trendColor = typeof trend?.value === "number"
    ? trend.value > 0 ? "#34d399" : trend.value < 0 ? "#f87171" : "rgba(255,255,255,0.4)"
    : "rgba(255,255,255,0.4)";

  return (
    <GlassCard glow={glow} style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
          {label}
        </span>
        {icon && <span style={{ opacity: 0.5 }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </span>
        {trend && (
          <span style={{ fontSize: 12, fontWeight: 600, color: trendColor, display: "inline-flex", alignItems: "center", gap: 2 }}>
            {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"}{Math.abs(trend.value)}%
            {trend.label && <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 2 }}>{trend.label}</span>}
          </span>
        )}
      </div>
    </GlassCard>
  );
}

// ── Section Header — Tool page headers with subtle animation ────────────────
export function SectionHeader({ title, subtitle, icon, action }: {
  title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#0ea5e9",
          }}>
            {icon}
          </div>
        )}
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: "var(--text-primary)",
            letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </motion.div>
  );
}

// Re-export motion for convenience
export { motion, AnimatePresence };
