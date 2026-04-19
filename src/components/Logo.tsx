interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: 16, md: 18, lg: 22 };

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const fs = sizes[size];
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "baseline", gap: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.04em" }}>
      <span style={{ fontSize: fs, fontWeight: 700, color: "#eef0f6" }}>ad</span>
      <span style={{ fontSize: fs, fontWeight: 900, background: "linear-gradient(135deg, #38bdf8, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>brief</span>
    </span>
  );
};

export const LogoLight = Logo;

/**
 * LogoMark — compact icon-only version for sidebar.
 * A stylized "ab" monogram with the brand gradient.
 */
export const LogoMark = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ab-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect width="28" height="28" rx="7" fill="url(#ab-grad)" fillOpacity="0.12" />
    <text
      x="14" y="19.5"
      textAnchor="middle"
      style={{
        fontSize: 15,
        fontWeight: 900,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "-0.5px",
        fill: "url(#ab-grad)",
      }}
    >
      ab
    </text>
  </svg>
);
