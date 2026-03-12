import { useRef } from "react";

// SVG logos — só paths limpos, sem <text> interno
// O nome da marca é renderizado separadamente pelo componente
const LOGOS = [
  {
    name: "Shopify",
    width: 24,
    svg: `<svg viewBox="0 0 50 57" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43.5 11.2c0-.3-.3-.5-.6-.5-.3 0-4.5-.3-4.5-.3s-3-3-3.3-3.3c-.3-.3-1-.2-1.2-.1l-1.6.5c-.2-.5-.4-1.1-.8-1.7C30.4 3.6 28.6 2.4 26.5 2.4h-.2c-.1-.2-.3-.3-.5-.4C24.9.9 23.9.4 22.7.5 18.9.7 15.1 4.3 13.5 10l-5.3 1.6c-.7.2-1 .3-1.1 1.2-.1.7-2.7 20.9-2.7 20.9l20.9 3.9L36.5 35S31.6 14.1 31.5 13.8c0-.3-.3-.5-.6-.5h.1zm-12.9-4c-.7.2-1.6.5-2.5.7.2-1.7.7-3.3 1.5-4.4.3 0 .5.3.8.8.3 1 .2 2 .2 2.9zm-3.9 1.2c1.5-.5 2.9-.9 4.1-1.2 0 .8 0 1.9-.1 3.1-1.6.5-3.3 1-5 1.4.2-1 .5-2.1 1-3.3zm-1.6 4.6c1.7-.5 3.5-1 5.3-1.5-.4 2.2-.8 4.7-1.1 7.6l-6.1 1.8c.5-3.3 1.2-6 1.9-7.9zm10-6.3c.7.9 1.1 2.1 1.4 3.3-.7.2-1.5.5-2.3.7 0-.8 0-1.8-.2-2.9-.1-.6-.3-1.2-.6-1.6.7.2 1.4.5 1.7.5z" fill="rgba(255,255,255,0.7)"/><path d="M42.9 10.7c-.3 0-4.5-.3-4.5-.3s-3-3-3.3-3.3c-.1-.1-.3-.2-.4-.2L33 57l14.1-3S43.5 11.3 43.5 10.9c0-.3-.3-.5-.6-.5v.3z" fill="rgba(255,255,255,0.4)"/></svg>`,
  },
  {
    name: "Meta",
    width: 40,
    svg: `<svg viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.8 9.4C2.4 9.4 0 13.2 0 17.2c0 2.6 1 4.3 2.6 4.3 1.5 0 2.8-1.4 4.3-4.8l.6-1.5C7 11.9 5.8 9.4 5.8 9.4zm18.4 0c-1.5 0-2.6 2.1-2.6 4.3 0 2.6 1 4.3 2.6 4.3 1.4 0 2.6-1.3 4-4.4l.6-1.5c-.6-1.7-2.8-2.7-4.6-2.7zM.3 17.2C.3 12.8 4 5 10.4 5c2.7 0 5 1.6 6.8 5.2 2-3.6 4.8-5.2 7.6-5.2 3.6 0 6.7 3 6.7 7.6 0 1.2-.2 2.5-.6 3.7l-2.8 7.3c-1.4 3.6-3.7 5.3-6 5.3-2.4 0-4.4-1.7-5.4-5.5-1.6 3.4-3.6 5.5-5.9 5.5C4.9 29 .3 24.3.3 17.2zM49 5c4 0 7.2 2.4 8.6 6.3l-13.9 6.5c.6 1.3 1.6 2.3 3.2 2.3 2 0 3.6-1.1 5.1-3.5l4.7 3.3C53.9 23.4 51 26 47.3 26c-6.6 0-11.4-5-11.4-10.2C35.9 10.6 40.6 5 49 5zm-.2 5c-1.5 0-3 1.1-3.9 3.2l7.8-3.7c-.9-.6-2.4-2.4-3.9-2.4v2.9z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "TikTok",
    width: 22,
    svg: `<svg viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.5 6.1A6.6 6.6 0 0118 5a6.6 6.6 0 01-2.5-4.1H11v18.6a3.2 3.2 0 01-3.2 3.1 3.2 3.2 0 01-3.2-3.2 3.2 3.2 0 013.2-3.2c.3 0 .6 0 .9.1v-4.5a8 8 0 00-.9-.1 7.6 7.6 0 00-7.5 7.7A7.6 7.6 0 007.8 27a7.6 7.6 0 007.5-7.7V9.8c2 1.3 4.4 2 6.9 2V7.4c-.3 0-.5-.9-.7-1.3z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "Google Ads",
    width: 28,
    svg: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 45.5L19.5 18l10.5 18.5L21 45.5H3.5z" fill="rgba(255,255,255,0.3)"/><path d="M36.5 18L21 45.5h31.5L36.5 18z" fill="rgba(255,255,255,0.5)"/><path d="M19.5 18L3.5 45.5h15.5l3.5-6L19.5 18z" fill="rgba(255,255,255,0.6)"/><circle cx="9" cy="46" r="5.5" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "Hotmart",
    width: 26,
    // Hotmart flame icon
    svg: `<svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0C20 0 32 10 32 22c0 6.6-5.4 12-12 12S8 28.6 8 22c0-4 1.7-7.7 4.4-10.3C12.4 17 14 21 14 21s2-6 6-21zM20 30a8 8 0 100 16 8 8 0 000-16z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "Amazon",
    width: 36,
    svg: `<svg viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M56 21.3C50.8 25 43.3 27 36.7 27c-9.2 0-17.4-3.4-23.7-9.1-.5-.4 0-1 .5-.7 6.7 3.9 15.1 6.3 23.7 6.3 5.8 0 12.2-1.2 18-3.7.9-.3 1.6.6.8 1.5zM58.1 18.8c-.7-.9-4.4-.4-6.1-.2-.5.1-.6-.4-.1-.7 3-2.1 7.9-1.5 8.5-.8.6.7-.2 5.7-3 8.1-.4.4-.8.2-.6-.3.6-1.6 2-5.2 1.3-6.1zM52.3 2.9V.9c0-.3.2-.5.5-.5h8.5c.3 0 .5.2.5.5v1.7c0 .3-.2.6-.6 1.2l-4.4 6.3c1.6 0 3.4.2 4.8 1c.3.2.4.5.5.8V14c0 .3-.3.6-.6.4-2.7-1.4-6.2-1.5-9.2 0-.3.2-.6-.1-.6-.4v-2.1c0-.3 0-.9.3-1.3L56.6 4H52.8c-.3 0-.5-.2-.5-.5v.4zm-36.9 14H13c-.2 0-.4-.2-.4-.4V1c0-.3.2-.5.5-.5h2.2c.3 0 .5.2.5.5v1.7h.1c.5-1.6 1.6-2.4 3-2.4 1.4 0 2.3.8 3 2.4.5-1.6 1.8-2.4 3.2-2.4 1 0 2 .4 2.7 1.3.7 1 .6 2.4.6 3.7v7.5c0 .3-.2.5-.5.5H26c-.3 0-.5-.2-.5-.5V6.5c0-1.5.3-3.7-1.4-3.7-1.6 0-1.6 2.2-1.6 3.7v7.2c0 .3-.2.5-.5.5h-2.3c-.3 0-.5-.2-.5-.5V6.5c0-1.8.3-4.4-1.4-4.4-1.6 0-1.5 2.6-1.5 4.4v7.2c0 .3-.2.5-.5.5zM1.9 9.5c0-3.2 2-4.8 6-4.8h.9c.8 0 1.5 0 2.2-.1 0-1.6 0-3.3-2-3.3-1.9 0-2 1.4-2 2.2 0 .3-.2.5-.5.5H4.1c-.3 0-.5-.2-.5-.5C3.7 0 6.5 0 8.8 0c3.4 0 6.2 1.4 6.2 5v6.7c0 1.1.3 2 .7 2.6.2.2.2.5 0 .7l-1.8 1.4c-.2.2-.5.2-.7 0C12.7 15.7 12.5 15 12.3 14.4c-.8 1.1-2.2 1.5-4 1.5-3.7 0-6.4-2.3-6.4-6.4zm4.5-.4c0 1.5.9 2 2.3 2 1.1 0 1.9-.5 2.5-1.4.5-.9.5-1.9.5-3h-.9c-1.6 0-3.2.4-3.2 2.4H6.4z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "HubSpot",
    width: 22,
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.2 7.6V5.3a1.3 1.3 0 00.8-1.2v0C15 3.5 14.5 3 13.9 3h0c-.5 0-1 .5-1 1v0c0 .5.4 1 .8 1.2v2.4a4.7 4.7 0 00-2 .6L6.3 4.1A1.8 1.8 0 106 5.4l5.5 4c-.4.6-.6 1.4-.6 2.2 0 .8.2 1.6.6 2.2l-5.4 4a1.8 1.8 0 10.7 1.3l5.7-3.9c.6.4 1.4.6 2.2.5a4.8 4.8 0 004.8-4.8 4.8 4.8 0 00-4.8-4.8l-.5.1.5-.6zm-.1 7.2c-1.4 0-2.5-1.1-2.5-2.5 0-1.4 1.1-2.5 2.5-2.5 1.4 0 2.5 1.1 2.5 2.5 0 1.4-1.1 2.5-2.5 2.5z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "Kiwify",
    width: 24,
    // K letter mark
    svg: `<svg viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2h6v13l10-13h7.5L16 16.5 28 34h-7.5L13 22l-3 3.5V34H4V2z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "Klaviyo",
    width: 22,
    // K lettermark
    svg: `<svg viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 1h6v12.5L19.5 1H27L14.5 15.5 27.5 32H20L10 18.5l-1 1.5V32H3V1z" fill="rgba(255,255,255,0.7)"/></svg>`,
  },
  {
    name: "YouTube",
    width: 32,
    svg: `<svg viewBox="0 0 48 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M47 5.3A6 6 0 0043.1 1.4C39.4.4 24 .4 24 .4S8.6.4 4.9 1.4A6 6 0 001 5.3C0 9 0 17 0 17s0 8 1 11.7A6 6 0 004.9 32.6C8.6 33.6 24 33.6 24 33.6s15.4 0 19.1-1C45.2 32 47 30.7 47 28.7c1-3.7 1-11.7 1-11.7s0-8-1-11.7z" fill="rgba(255,255,255,0.4)"/><path d="M19 24l12.5-7L19 10v14z" fill="rgba(255,255,255,0.9)"/></svg>`,
  },
];

// Duplicate for seamless loop
const ALL_LOGOS = [...LOGOS, ...LOGOS];

export default function LogoTicker() {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-6 border-y overflow-hidden"
      style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
      <div className="container mx-auto max-w-5xl mb-4">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] font-medium"
          style={{ color: "rgba(255,255,255,0.15)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Trusted by teams running ads on
        </p>
      </div>

      {/* Ticker wrapper */}
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, var(--background), transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(-90deg, var(--background), transparent)" }} />

        <div className="flex overflow-hidden">
          <div
            ref={trackRef}
            className="flex gap-10 items-center shrink-0"
            style={{
              animation: "ticker-scroll 35s linear infinite",
              willChange: "transform",
            }}
          >
            {ALL_LOGOS.map((logo, i) => (
              <div key={i}
                className="flex items-center gap-2 shrink-0 opacity-35 hover:opacity-60 transition-opacity duration-300"
                title={logo.name}>
                {/* Icon */}
                <div
                  style={{ height: 22, width: logo.width, filter: "grayscale(1) brightness(2)", flexShrink: 0 }}
                  dangerouslySetInnerHTML={{
                    __html: logo.svg
                  }}
                />
                {/* Name — rendered once, never in SVG */}
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}>
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
