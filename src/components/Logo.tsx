// Shared FrameIQ logo — use this everywhere for consistency
interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ size = "md", className = "" }: LogoProps) => {
  const sizes = {
    sm: { mark: "w-5 h-5", inner: "w-2 h-2", text: "text-sm" },
    md: { mark: "w-7 h-7", inner: "w-3 h-3", text: "text-base" },
    lg: { mark: "w-9 h-9", inner: "w-4 h-4", text: "text-xl" },
  };
  const s = sizes[size];
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className={`${s.mark} rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0`}>
        <span className={`${s.inner} rounded-sm bg-white`} />
      </span>
      <span className={`${s.text} font-bold text-white tracking-tight`}>
        Frame<span className="text-white/40">IQ</span>
      </span>
    </span>
  );
};

// Light version for use on white/light backgrounds
export const LogoLight = ({ size = "md", className = "" }: LogoProps) => {
  const sizes = {
    sm: { text: "text-sm" },
    md: { text: "text-base" },
    lg: { text: "text-xl" },
  };
  const s = sizes[size];
  return (
    <span className={`flex items-center gap-0.5 ${className}`}>
      <span className={`${s.text} font-bold font-medium text-foreground`}>Frame</span>
      <span className={`${s.text} font-black gradient-text`}>IQ</span>
    </span>
  );
};
