// Powered by banner — builds trust with AI provider logos

export default function TopBanner() {
  const F = "'Inter', 'Plus Jakarta Sans', sans-serif";

  return (
    <div
      style={{
        width: "100%",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "7px 24px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>
        Powered by
      </span>

      {/* Claude / Anthropic */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.7 }}>
        {/* Anthropic Claude logo */}
        <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
          <path d="M27.8 8L40 40H32.4L30 33.6H18L15.6 40H8L20.2 8H27.8ZM24 16.8L20.4 27.2H27.6L24 16.8Z" fill="rgba(204,168,103,1)"/>
        </svg>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(204,168,103,0.85)" }}>
          Claude
        </span>
      </div>

      <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 12 }}>·</span>

      {/* OpenAI */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.7 }}>
        {/* OpenAI logo — official SVG */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.75)">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.386 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.664zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
        </svg>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
          OpenAI
        </span>
      </div>

      <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 12 }}>·</span>

      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.65 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#60a5fa">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(96,165,250,0.85)" }}>
          Meta API
        </span>
      </div>
    </div>
  );
}
