import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Language, translations } from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID: Language[] = ["en", "pt", "es", "fr", "de", "ar", "zh"];
const BROWSER_MAP: Record<string, Language> = { pt: "pt", es: "es", fr: "fr", de: "de", ar: "ar" };
// zh intentionally excluded from auto-detect — must be explicitly chosen

function detectLanguage(): Language {
  // Only trust localStorage if user explicitly chose it (marked by -chosen key)
  const saved = localStorage.getItem("frameiq-lang");
  const chosen = localStorage.getItem("frameiq-lang-chosen") === "1";
  if (saved && chosen && VALID.includes(saved as Language)) return saved as Language;

  // Clear any stale auto-saved value
  localStorage.removeItem("frameiq-lang");
  localStorage.removeItem("frameiq-lang-chosen");

  // Browser language detection (zh excluded from auto)
  const browser = navigator.language?.slice(0, 2).toLowerCase();
  return BROWSER_MAP[browser] ?? "en";
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem("frameiq-lang", lang);
    localStorage.setItem("frameiq-lang-chosen", "1");
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string) => {
      const trans = translations[language];
      return (trans as Record<string, string>)[key] || key;
    },
    [language]
  );

  const isRTL = language === "ar";

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
