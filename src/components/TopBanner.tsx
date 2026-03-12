import { useState } from "react";
import { X } from "lucide-react";

type BannerVariant = "high-demand" | "live-activity";

// Change this to switch variants easily
const VARIANT: BannerVariant = "high-demand";

const LIVE_COUNTS = {
  analyses: 2847,
  teams: 147,
};

export default function TopBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="relative w-full z-[60] flex items-center justify-center px-4 py-2 text-center"
      style={{
        background: "linear-gradient(90deg, rgba(139,92,246,0.15), rgba(167,139,250,0.1), rgba(236,72,153,0.12))",
        borderBottom: "1px solid rgba(167,139,250,0.15)",
        backdropFilter: "blur(8px)",
      }}
    >
      {VARIANT === "high-demand" ? (
        <p className="text-[12px] text-white/55 leading-snug" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <span className="text-white/75 font-semibold">⚡ We're experiencing high demand.</span>{" "}
          Features may take a few more seconds than usual.
        </p>
      ) : (
        <p className="text-[12px] text-white/60 leading-snug" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <span className="inline-flex items-center gap-1.5 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            <span className="text-green-300/80 font-semibold">Live</span>
          </span>
          {LIVE_COUNTS.analyses.toLocaleString()} ads analyzed today · {LIVE_COUNTS.teams} teams active right now
        </p>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3 text-white/30" />
      </button>
    </div>
  );
}
