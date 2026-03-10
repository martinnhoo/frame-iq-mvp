import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language, languageNames, languageFlags } from "@/i18n/translations";

const languages: { code: Language; flag: string; name: string }[] = [
  { code: "en", flag: "🇺🇸", name: "English" },
  { code: "pt", flag: "🇧🇷", name: "Português" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
  { code: "ar", flag: "🇸🇦", name: "العربية" },
  { code: "zh", flag: "🇨🇳", name: "中文" },
];

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all text-xs font-medium"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl border border-white/[0.1] shadow-2xl p-1.5 min-w-[160px]"
          style={{ background: "#111", zIndex: 9999 }}
        >
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                language === lang.code
                  ? "bg-white/10 text-white font-semibold"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
              {language === lang.code && (
                <span className="ml-auto text-purple-400 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
