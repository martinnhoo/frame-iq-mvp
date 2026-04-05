import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";

const T = {
  pt: {
    title: "Página não encontrada",
    sub: "A página não existe ou foi movida.",
    home: "Voltar para o início",
    support: "Falar com suporte",
  },
  en: {
    title: "Page not found",
    sub: "This page doesn't exist or has been moved.",
    home: "Back to home",
    support: "Contact support",
  },
  es: {
    title: "Página no encontrada",
    sub: "Esta página no existe o fue movida.",
    home: "Volver al inicio",
    support: "Contactar soporte",
  },
};

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const lang = (["pt", "es"].includes(language) ? language : "en") as "pt" | "en" | "es";
  const t = T[lang];

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo size="lg" /></Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, hsla(199, 83%, 58%, 0.1) 0%, transparent 60%)", filter: "blur(60px)" }}
          />
          <div
            className="relative text-center max-w-lg mx-auto"
          >
            <div className="text-[120px] md:text-[160px] font-black leading-none gradient-text mb-4">404</div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{t.title}</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">{t.sub}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0" asChild>
                <Link to="/"><Home className="h-4 w-4 mr-2" />{t.home}</Link>
              </Button>
              <Button variant="outline" className="border-border" asChild>
                <a href="mailto:hello@adbrief.pro">{t.support}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
