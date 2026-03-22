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
