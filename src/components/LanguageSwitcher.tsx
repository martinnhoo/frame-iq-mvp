import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language } from "@/i18n/translations";
import { Globe } from "lucide-react";

const languages: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
  { code: "es", label: "ES" },
  { code: "zh", label: "中文" },
];

const LanguageSwitcher = ({ direction = "auto" }: { direction?: "up" | "down" | "auto" }) => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (direction === "auto" && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(rect.bottom > window.innerHeight - 200);
    } else {
      setOpenUp(direction === "up");
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.5)",
          cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 12, fontWeight: 500,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.color = "rgba(255,255,255,0.5)";
        }}
      >
        <Globe size={12} strokeWidth={1.8} />
        <span>{current.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              ...(openUp
                ? { bottom: "calc(100% + 6px)", right: 0 }
                : { top: "calc(100% + 6px)", right: 0 }
              ),
              background: "#111114",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 999,
              minWidth: 100,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              padding: 4,
            }}
          >
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setOpen(false); }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  display: "flex", alignItems: "center", gap: 8,
                  background: language === lang.code ? "rgba(99,102,241,0.1)" : "transparent",
                  border: "none", borderRadius: 7,
                  color: language === lang.code ? "#6366f1" : "rgba(255,255,255,0.5)",
                  fontSize: 12, fontWeight: language === lang.code ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => {
                  if (language !== lang.code) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  }
                }}
                onMouseLeave={e => {
                  if (language !== lang.code) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
