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
    const valid: Language[] = ["en", "pt", "es", "fr", "de", "ar", "zh"];
    
    // 1. Check localStorage — but only if it's a valid supported language
    const saved = localStorage.getItem("frameiq-lang");
    if (saved && valid.includes(saved as Language)) return saved as Language;
    
    // 2. Detect from browser language
    const browserLang = navigator.language?.slice(0, 2).toLowerCase();
    const langMap: Record<string, Language> = {
      pt: "pt", es: "es", fr: "fr", de: "de", ar: "ar", zh: "zh",
    };
    if (browserLang && langMap[browserLang]) return langMap[browserLang];
    
    // 3. Default to English
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem("frameiq-lang", lang);
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
