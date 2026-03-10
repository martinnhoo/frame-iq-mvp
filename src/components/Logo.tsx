// Shared FrameIQ logo — Syne font for brand identity
interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span
      className={`flex items-center ${textSize} ${className}`}
      style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}
    >
      <span className="text-white font-semibold tracking-tight">Frame</span>
      <span
        className="font-extrabold"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        IQ
      </span>
    </span>
  );
};

export const LogoLight = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span
      className={`flex items-center ${textSize} ${className}`}
      style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}
    >
      <span className="text-white font-semibold">Frame</span>
      <span
        className="font-extrabold"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        IQ
      </span>
    </span>
  );
};
