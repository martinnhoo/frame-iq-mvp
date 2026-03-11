// Shared AdBrief logo — Syne font for brand identity
interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const logoStyle = {
  fontFamily: "'Syne', sans-serif",
  letterSpacing: "-0.04em",
  fontWeight: 700,
};

const gradientStyle = {
  background: "linear-gradient(120deg, #a78bfa 0%, #ec4899 100%)",
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
  backgroundClip: "text" as const,
  letterSpacing: "-0.05em",
};

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-base", md: "text-[1.15rem]", lg: "text-[1.4rem]" }[size];
  return (
    <span className={`inline-flex items-baseline ${textSize} ${className}`} style={logoStyle}>
      <span className="text-white" style={{ fontWeight: 600, letterSpacing: "-0.03em" }}>ad</span>
      <span style={gradientStyle}>brief</span>
    </span>
  );
};

export const LogoLight = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-base", md: "text-[1.15rem]", lg: "text-[1.4rem]" }[size];
  return (
    <span className={`inline-flex items-baseline ${textSize} ${className}`} style={logoStyle}>
      <span className="text-white" style={{ fontWeight: 600, letterSpacing: "-0.03em" }}>ad</span>
      <span style={gradientStyle}>brief</span>
    </span>
  );
};
