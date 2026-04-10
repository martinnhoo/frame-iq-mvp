import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    title: "Thanks for trying AdBrief",
    subtitle: "Create a free account to save your analyses, generate boards, and unlock the full platform.",
    signup: "Sign up free",
    login: "Log in",
    logout: "Stay logged out",
  },
  pt: {
    title: "Obrigado por experimentar o AdBrief",
    subtitle: "Crie uma conta gratuita para salvar suas análises, gerar boards e desbloquear a plataforma completa.",
    signup: "Cadastre-se grátis",
    login: "Entrar",
    logout: "Manter-se desconectado",
  },
  es: {
    title: "Gracias por probar AdBrief",
    subtitle: "Crea una cuenta gratuita para guardar tus análisis, generar boards y desbloquear la plataforma completa.",
    signup: "Regístrate gratis",
    login: "Iniciar sesión",
    logout: "Mantenerse desconectado",
  },
};

const AUTH_PROMPT_KEY = "adbrief_auth_prompt_dismissed";
const TIMER_MS = 5 * 60 * 1000; // 5 minutes

interface AuthPromptModalProps {
  forceShow?: boolean;
  onClose?: () => void;
}

const AuthPromptModal = ({ forceShow = false, onClose }: AuthPromptModalProps) => {
  const [show, setShow] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Never show for authenticated users
    if (isAuthenticated) return;
    if (isAuthenticated === null) return; // still loading

    if (forceShow) {
      setShow(true);
      return;
    }

    // Don't show if already dismissed this session
    if (sessionStorage.getItem(AUTH_PROMPT_KEY)) return;

    const timer = setTimeout(() => {
      setShow(true);
    }, TIMER_MS);

    return () => clearTimeout(timer);
  }, [forceShow, isAuthenticated]);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem(AUTH_PROMPT_KEY, "1");
    onClose?.();
  };

  if (!show) return null;

  return (
    <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm"
            style={{ animation: "fadeIn 0.2s ease" }}
            onClick={dismiss}
          />

          {/* Modal */}
          <div
            className="fixed inset-0 z-[501] flex items-center justify-center p-4"
            style={{ animation: "modalIn 0.25s ease" }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl p-8 text-center"
              style={{
                background: "linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 3%) 100%)",
                border: "1px solid hsl(0 0% 13%)",
                boxShadow: "0 25px 80px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.1)",
              }}
            >
              {/* Close */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <div
                className="mx-auto mb-6 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(199 83% 58% / 0.2), hsl(320 80% 60% / 0.2))",
                  border: "1px solid hsl(199 83% 58% / 0.3)",
                }}
              >
                <Sparkles className="w-7 h-7 text-accent" />
              </div>

              <h2 className="text-xl font-bold text-foreground mb-2">
                {t.title}
              </h2>
              <p className="text-secondary text-sm leading-relaxed mb-8">
                {t.subtitle}
              </p>

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0 h-12 text-base font-semibold rounded-xl"
                  onClick={() => navigate("/signup")}
                >
                  {t.signup}
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-transparent text-foreground hover:bg-muted border-border h-11 rounded-xl"
                  onClick={() => navigate("/login")}
                >
                  {t.login}
                </Button>
              </div>

              {/* Stay logged out - subtle */}
              <button
                onClick={dismiss}
                className="mt-6 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </>
  );
};

export default AuthPromptModal;
