// Shared FrameIQ logo — matches landing page exactly
interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span className={`flex items-center font-bold ${textSize} ${className}`}>
      <span className="text-white font-medium">Frame</span>
      <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-black">IQ</span>
    </span>
  );
};

// Light version for landing/light backgrounds
export const LogoLight = ({ size = "md", className = "" }: LogoProps) => {
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span className={`flex items-center font-bold ${textSize} ${className}`}>
      <span className="text-foreground font-medium">Frame</span>
      <span className="gradient-text font-black">IQ</span>
    </span>
  );
};
