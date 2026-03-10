import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Language, translations } from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("frameiq-lang");
    const valid: Language[] = ["en", "pt", "es", "fr", "de", "ar", "zh"];
    if (saved && valid.includes(saved as Language)) return saved as Language;
    localStorage.removeItem("frameiq-lang");
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("frameiq-lang", lang);
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
