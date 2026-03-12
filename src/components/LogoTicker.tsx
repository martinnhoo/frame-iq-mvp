// LogoTicker — text-only wordmarks, sem SVG icon (evita ícones errados)
// Cada marca tem fonte e peso customizado para parecer o wordmark real

const BRANDS = [
  { name: "Shopify",    style: { fontWeight: 700, letterSpacing: "-0.02em" } },
  { name: "Meta",       style: { fontWeight: 700, letterSpacing: "-0.01em" } },
  { name: "TikTok",     style: { fontWeight: 800, letterSpacing: "-0.03em" } },
  { name: "Google Ads", style: { fontWeight: 500, letterSpacing: "0em" } },
  { name: "Hotmart",    style: { fontWeight: 900, letterSpacing: "-0.02em" } },
  { name: "Amazon",     style: { fontWeight: 700, letterSpacing: "-0.01em" } },
  { name: "HubSpot",    style: { fontWeight: 700, letterSpacing: "-0.01em" } },
  { name: "Kiwify",     style: { fontWeight: 800, letterSpacing: "-0.02em" } },
  { name: "Klaviyo",    style: { fontWeight: 700, letterSpacing: "-0.01em" } },
  { name: "YouTube",    style: { fontWeight: 800, letterSpacing: "-0.02em" } },
];

const ALL = [...BRANDS, ...BRANDS];

export default function LogoTicker() {
  return (
    <section
      className="py-6 border-y overflow-hidden"
      style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}
    >
      <div className="container mx-auto max-w-5xl mb-5">
        <p
          className="text-center text-[10px] uppercase tracking-[0.2em] font-medium"
          style={{ color: "rgba(255,255,255,0.15)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Trusted by teams running ads on
        </p>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div
          className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, var(--background), transparent)" }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ background: "linear-gradient(-90deg, var(--background), transparent)" }}
        />

        <div className="flex overflow-hidden">
          <div
            className="flex items-center shrink-0"
            style={{
              gap: "48px",
              animation: "ticker-scroll 30s linear infinite",
              willChange: "transform",
            }}
          >
            {ALL.map((brand, i) => (
              <span
                key={i}
                className="shrink-0 transition-opacity duration-300"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "15px",
                  color: "rgba(255,255,255,0.3)",
                  whiteSpace: "nowrap",
                  ...brand.style,
                }}
              >
                {brand.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
