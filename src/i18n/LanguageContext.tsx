// Language context — single source of truth for UI language
// Priority: 1. localStorage 2. user profile (loaded after login) 3. browser/geo
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Language, translations } from "./translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language, persist?: boolean) => void;
  t: (key: string) => string;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Detect language from browser/timezone
function detectLanguage(): Language {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const nav = navigator.language?.toLowerCase() || "";

    // Timezone-based detection (most reliable)
    if (tz.startsWith("America/Sao_Paulo") || tz.startsWith("America/Fortaleza") || 
        tz.startsWith("America/Manaus") || tz.startsWith("America/Belem") ||
        nav.startsWith("pt-br") || nav.startsWith("pt_br")) return "pt";
    
    if (tz.startsWith("America/Mexico") || tz.startsWith("America/Bogota") || 
        tz.startsWith("America/Lima") || tz.startsWith("America/Buenos_Aires") ||
        tz.startsWith("America/Santiago") || tz.startsWith("America/Caracas") ||
        nav.startsWith("es")) return "es";
    
    if (tz.startsWith("Asia/Shanghai") || tz.startsWith("Asia/Hong_Kong") ||
        nav.startsWith("zh")) return "zh";
    
    if (tz.startsWith("Europe/Paris") || nav.startsWith("fr")) return "fr";
    if (tz.startsWith("Europe/Berlin") || nav.startsWith("de")) return "de";
    if (tz.startsWith("Asia/Riyadh") || tz.startsWith("Asia/Dubai") || 
        nav.startsWith("ar")) return "ar";
  } catch {}
  return "en";
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = storage.get("adbrief_language");
      if (saved && ["en","pt","es","zh","fr","de","ar"].includes(saved)) return saved as Language;
    } catch {}
    return detectLanguage();
  });

  // Called with persist=true when user explicitly picks (saves to localStorage)
  // Called with persist=false when loading from user profile
  const setLanguage = useCallback((lang: Language, persist = true) => {
    setLanguageState(lang);
    if (persist) {
      try { storage.set("adbrief_language", lang); } catch {}
    }
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
