interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "text-base", md: "text-[1.15rem]", lg: "text-[1.4rem]" };

export const Logo = ({ size = "md", className = "" }: LogoProps) => (
  <span
    className={`inline-flex items-baseline ${sizes[size]} ${className}`}
    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, letterSpacing: "-0.04em", color: "#fff" }}
  >
    adbrief
  </span>
);

export const LogoLight = Logo;
