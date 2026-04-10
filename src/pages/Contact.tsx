import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Menu, ArrowRight, Send, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "en" | "pt" | "es";

const T: Record<Lang, Record<string, string>> = {
  en: {
    nav_features: "Features",
    nav_pricing: "Pricing",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contact",
    nav_signin: "Sign in",
    nav_cta: "Try free for 3 days",
    mobile_home: "Home",

    heading: "Get in touch",
    sub: "Questions, partnerships, or support — we're here to help your team ship better creative.",

    form_name_label: "Name",
    form_name_placeholder: "Your name",
    form_email_label: "Email",
    form_email_placeholder: "you@company.com",
    form_message_label: "Message",
    form_message_placeholder: "How can we help?",
    form_submit: "Send message",
    form_error: "Please fill in all fields",
    form_success: "Message sent! We'll get back to you within 72h.",

    email_label: "Email",
    email_support: "support@adbrief.pro",

    enterprise_title: "Enterprise & Custom Plans",
    enterprise_desc: "Need API access, custom integrations, or a dedicated CSM? Book a call with our team to discuss how AdBrief can fit your workflow.",
    enterprise_cta: "Book a demo call",
  },
  pt: {
    nav_features: "Recursos",
    nav_pricing: "Preços",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contato",
    nav_signin: "Entrar",
    nav_cta: "Experimente grátis por 3 dias",
    mobile_home: "Home",

    heading: "Entre em contato",
    sub: "Dúvidas, parcerias ou suporte — estamos aqui para ajudar seu time a entregar criativo melhor.",

    form_name_label: "Nome",
    form_name_placeholder: "Seu nome",
    form_email_label: "Email",
    form_email_placeholder: "voce@empresa.com",
    form_message_label: "Mensagem",
    form_message_placeholder: "Como podemos ajudar?",
    form_submit: "Enviar mensagem",
    form_error: "Por favor, preencha todos os campos",
    form_success: "Mensagem enviada! Responderemos em até 72h.",

    email_label: "Email",
    email_support: "support@adbrief.pro",

    enterprise_title: "Planos Enterprise & Customizados",
    enterprise_desc: "Precisa de acesso à API, integrações customizadas, ou um CSM dedicado? Agende uma call com nosso time para discutir como o AdBrief se encaixa no seu workflow.",
    enterprise_cta: "Agendar chamada de demo",
  },
  es: {
    nav_features: "Características",
    nav_pricing: "Precios",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contacto",
    nav_signin: "Iniciar sesión",
    nav_cta: "Prueba gratis durante 3 días",
    mobile_home: "Inicio",

    heading: "Ponte en contacto",
    sub: "Preguntas, asociaciones o soporte — estamos aquí para ayudar a tu equipo a crear mejores creativos.",

    form_name_label: "Nombre",
    form_name_placeholder: "Tu nombre",
    form_email_label: "Correo electrónico",
    form_email_placeholder: "tu@empresa.com",
    form_message_label: "Mensaje",
    form_message_placeholder: "¿Cómo podemos ayudarte?",
    form_submit: "Enviar mensaje",
    form_error: "Por favor, completa todos los campos",
    form_success: "¡Mensaje enviado! Te responderemos en 72h.",

    email_label: "Correo electrónico",
    email_support: "support@adbrief.pro",

    enterprise_title: "Planes Enterprise & Personalizados",
    enterprise_desc: "¿Necesitas acceso a API, integraciones personalizadas, o un CSM dedicado? Reserva una llamada con nuestro equipo para discutir cómo AdBrief se ajusta a tu workflow.",
    enterprise_cta: "Reservar llamada de demostración",
  },
};

const Contact = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = ["pt", "es"].includes(language) ? language as Lang : "en";
  const t = T[lang];

  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error(t.form_error);
      return;
    }
    setSending(true);
    // Simulate sending
    await new Promise(r => setTimeout(r, 1200));
    toast.success(t.form_success);
    setForm({ name: "", email: "", message: "" });
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">{t.nav_features}</Link>
            <Link to="/pricing" className="text-sm text-secondary hover:text-foreground transition-colors">{t.nav_pricing}</Link>
            <Link to="/blog" className="text-sm text-secondary hover:text-foreground transition-colors">{t.nav_blog}</Link>
            <Link to="/faq" className="text-sm text-secondary hover:text-foreground transition-colors">{t.nav_faq}</Link>
            <Link to="/contact" className="text-sm text-foreground transition-colors">{t.nav_contact}</Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>
              {t.nav_signin}
            </Button>
            <Button
              className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0"
              onClick={() => navigate("/signup")}
            >
              {t.nav_cta}
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 mt-8">
                  <Link to="/" className="text-lg text-secondary hover:text-foreground">{t.mobile_home}</Link>
                  <Link to="/blog" className="text-lg text-secondary hover:text-foreground">{t.nav_blog}</Link>
                  <Link to="/contact" className="text-lg text-foreground">{t.nav_contact}</Link>
                  <Button className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white" onClick={() => navigate("/signup")}>
                    {t.nav_cta}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div>
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">{t.nav_contact}</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              {t.heading}
            </h1>
            <p className="text-secondary text-lg mb-12 max-w-xl mx-auto">
              {t.sub}
            </p>
            
            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto text-left space-y-5 mb-16">
              <div
                className="p-6 sm:p-8 rounded-2xl space-y-5"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t.form_name_label}</label>
                  <Input
                    placeholder={t.form_name_placeholder}
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-background/50 border-border/50 h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t.form_email_label}</label>
                  <Input
                    type="email"
                    placeholder={t.form_email_placeholder}
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-background/50 border-border/50 h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t.form_message_label}</label>
                  <Textarea
                    placeholder={t.form_message_placeholder}
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                    className="bg-background/50 border-border/50 min-h-[120px] resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0 h-11"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {t.form_submit}
                </Button>
              </div>
            </form>

            {/* Email card */}
            <div className="max-w-lg mx-auto">
              <a 
                href="mailto:support@adbrief.pro"
                className="flex items-center justify-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:border-sky-500/30"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                >
                  <span className="text-xl"></span>
                </div>
                <div className="text-left">
                  <div className="text-sm text-secondary">{t.email_label}</div>
                  <div className="font-semibold">{t.email_support}</div>
                </div>
              </a>
            </div>

            <div className="mt-16 p-8 rounded-2xl text-left max-w-2xl mx-auto"
              style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.04))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
            >
              <h2 className="text-xl font-semibold mb-3">{t.enterprise_title}</h2>
              <p className="text-secondary text-sm leading-relaxed mb-6">
                {t.enterprise_desc}
              </p>
              <Button
                className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-700 hover:to-cyan-700 border-0"
                onClick={() => navigate("/book-demo")}
              >
                {t.enterprise_cta}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
