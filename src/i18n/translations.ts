export type Language = "en" | "es" | "fr" | "de" | "ar" | "zh" | "pt";

export const languageNames: Record<Language, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ar: "العربية",
  zh: "中文",
  pt: "Português",
};

export const languageFlags: Record<Language, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  ar: "🇸🇦",
  zh: "🇨🇳",
  pt: "🇧🇷",
};

type TranslationKeys = {
  // Nav
  nav_features: string;
  nav_pricing: string;
  nav_blog: string;
  nav_faq: string;
  nav_contact: string;
  nav_signin: string;
  nav_get_started: string;

  // Hero
  hero_badge: string;
  hero_title_1: string;
  hero_title_2: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  hero_check_1: string;
  hero_check_2: string;
  hero_check_3: string;
  hero_screenshot_label: string;

  // Stats
  stats_videos: string;
  stats_teams: string;
  stats_countries: string;
  stats_time: string;

  // How it works
  how_label: string;
  how_title: string;
  how_step1_title: string;
  how_step1_desc: string;
  how_step2_title: string;
  how_step2_desc: string;
  how_step3_title: string;
  how_step3_desc: string;

  // Features
  features_label: string;
  features_title: string;
  features_subtitle: string;
  feature_video_title: string;
  feature_video_desc: string;
  feature_board_title: string;
  feature_board_desc: string;
  feature_translation_title: string;
  feature_translation_desc: string;
  feature_intelligence_title: string;
  feature_intelligence_desc: string;
  feature_ai_video_title: string;
  feature_ai_video_desc: string;
  feature_api_title: string;
  feature_api_desc: string;

  // Pricing
  pricing_label: string;
  pricing_title: string;
  pricing_subtitle: string;
  pricing_free: string;
  pricing_studio: string;
  pricing_scale: string;
  pricing_most_popular: string;
  pricing_mo: string;
  pricing_cta_free: string;
  pricing_cta_trial: string;
  pricing_cta_demo: string;

  // CTA
  cta_title: string;
  cta_subtitle: string;
  cta_primary: string;
  cta_secondary: string;

  // Footer
  footer_desc: string;
  footer_product: string;
  footer_company: string;
  footer_legal: string;
  footer_privacy: string;
  footer_terms: string;
  footer_rights: string;
  footer_soc2: string;
  footer_uptime: string;
  footer_book_demo: string;

  // Auth
  auth_login_title: string;
  auth_login_subtitle: string;
  auth_signup_title: string;
  auth_signup_subtitle: string;
  auth_email: string;
  auth_password: string;
  auth_name: string;
  auth_forgot: string;
  auth_no_account: string;
  auth_has_account: string;
  auth_signin: string;
  auth_create: string;
  auth_google: string;
  auth_or_email: string;

  // Confirm email
  confirm_title: string;
  confirm_text: string;
  confirm_didnt_receive: string;
  confirm_resend: string;
  confirm_back: string;
  confirm_confirmed_title: string;
  confirm_confirmed_text: string;

  // Powered by
  powered_by: string;
};

export const translations: Record<Language, TranslationKeys> = {
  en: {
    nav_features: "Features",
    nav_pricing: "Pricing",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contact",
    nav_signin: "Sign in",
    nav_get_started: "Get started free",

    hero_badge: "Trusted by 147+ performance marketing teams",
    hero_title_1: "Creative intelligence",
    hero_title_2: "for performance teams.",
    hero_subtitle: "Every day without it, your competitors are shipping better hooks, higher-scoring ads, and production boards your team can execute — while you're still guessing. Stop guessing.",
    hero_cta_primary: "Start free — no card needed",
    hero_cta_secondary: "Watch 2-min demo",
    hero_check_1: "No credit card",
    hero_check_2: "Setup in 2 min",
    hero_check_3: "Cancel anytime",
    hero_screenshot_label: "REAL ANALYSIS OUTPUT",

    stats_videos: "Videos Analyzed",
    stats_teams: "Enterprise Teams",
    stats_countries: "Countries",
    stats_time: "Avg. Analysis Time",

    how_label: "How it works",
    how_title: "From upload to execution\nin under 3 minutes",
    how_step1_title: "Upload or paste link",
    how_step1_desc: "Drop any ad, competitor video, or reference file",
    how_step2_title: "AI extracts insights",
    how_step2_desc: "Hook, creative model, transcript, key frames — all in 60s",
    how_step3_title: "Generate your board",
    how_step3_desc: "Get a production-ready brief your team can execute today",

    features_label: "Features",
    features_title: "Everything your creative team needs",
    features_subtitle: "Stop wasting hours reverse-engineering competitor ads. Let AI do it in seconds.",
    feature_video_title: "Video Analysis",
    feature_video_desc: "Upload any video. Frames, transcript, creative model and hook extracted in under 60 seconds.",
    feature_board_title: "Board Generation",
    feature_board_desc: "Type a prompt. Get a full production board with scenes, VO script, and editor notes.",
    feature_translation_title: "Auto Translation",
    feature_translation_desc: "Any language, any market — always delivered in English for your global team.",
    feature_intelligence_title: "Creative Intelligence",
    feature_intelligence_desc: "Every video classified by format. Hook extracted from the first 3 seconds.",
    feature_ai_video_title: "AI Video Generation",
    feature_ai_video_desc: "From concept board to MP4 with AI voiceover. No editors needed.",
    feature_api_title: "API Access",
    feature_api_desc: "Integrate FrameIQ into your existing workflow with our REST API.",

    pricing_label: "Pricing",
    pricing_title: "Simple, transparent pricing",
    pricing_subtitle: "Start free. Scale when you're ready.",
    pricing_free: "Free",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "Most Popular",
    pricing_mo: "/mo",
    pricing_cta_free: "Get started free",
    pricing_cta_trial: "Start 14-day trial",
    pricing_cta_demo: "Book a demo",

    cta_title: "Ready to 10x your creative output?",
    cta_subtitle: "Join 147+ performance teams shipping more creative, faster.",
    cta_primary: "Get started free",
    cta_secondary: "Book a demo",

    footer_desc: "AI-powered creative intelligence for performance marketing teams.",
    footer_product: "Product",
    footer_company: "Company",
    footer_legal: "Legal",
    footer_privacy: "Privacy Policy",
    footer_terms: "Terms of Service",
    footer_rights: "© 2026 FrameIQ. All rights reserved.",
    footer_soc2: "SOC 2 Compliant",
    footer_uptime: "99.9% Uptime",
    footer_book_demo: "Book a Demo",

    auth_login_title: "Welcome back",
    auth_login_subtitle: "Sign in to your FrameIQ account",
    auth_signup_title: "Create your account",
    auth_signup_subtitle: "Start analyzing videos and scaling your creatives",
    auth_email: "Work email",
    auth_password: "Password",
    auth_name: "Full Name",
    auth_forgot: "Forgot password?",
    auth_no_account: "Don't have an account?",
    auth_has_account: "Already have an account?",
    auth_signin: "Sign in",
    auth_create: "Create account",
    auth_google: "Continue with Google",
    auth_or_email: "Or continue with email",

    confirm_title: "Check your inbox",
    confirm_text: "We sent a verification link to",
    confirm_didnt_receive: "Didn't receive it? Check your spam folder or",
    confirm_resend: "resend email",
    confirm_back: "Back to login",
    confirm_confirmed_title: "Email confirmed!",
    confirm_confirmed_text: "Your account is verified. Redirecting to dashboard...",

    powered_by: "Powered by",
  },

  es: {
    nav_features: "Funciones",
    nav_pricing: "Precios",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contacto",
    nav_signin: "Iniciar sesión",
    nav_get_started: "Comienza gratis",

    hero_badge: "Usado por más de 147 equipos de performance marketing",
    hero_title_1: "Inteligencia creativa",
    hero_title_2: "para equipos de performance.",
    hero_subtitle: "Cada día sin esto, tus competidores están lanzando mejores hooks, anuncios con mayor puntuación y boards que tu equipo puede ejecutar — mientras tú sigues adivinando. Deja de adivinar.",
    hero_cta_primary: "Comienza gratis — sin tarjeta",
    hero_cta_secondary: "Ver demo de 2 min",
    hero_check_1: "Sin tarjeta de crédito",
    hero_check_2: "Configuración en 2 min",
    hero_check_3: "Cancela cuando quieras",
    hero_screenshot_label: "RESULTADO REAL DEL ANÁLISIS",

    stats_videos: "Videos Analizados",
    stats_teams: "Equipos Enterprise",
    stats_countries: "Países",
    stats_time: "Tiempo Promedio",

    how_label: "Cómo funciona",
    how_title: "De la subida a la ejecución\nen menos de 3 minutos",
    how_step1_title: "Sube o pega el enlace",
    how_step1_desc: "Arrastra cualquier anuncio, video de la competencia o archivo de referencia",
    how_step2_title: "La IA extrae insights",
    how_step2_desc: "Hook, modelo creativo, transcripción, frames clave — todo en 60s",
    how_step3_title: "Genera tu board",
    how_step3_desc: "Obtén un brief listo para producción que tu equipo puede ejecutar hoy",

    features_label: "Funciones",
    features_title: "Todo lo que tu equipo creativo necesita",
    features_subtitle: "Deja de perder horas descifrando anuncios de la competencia. Deja que la IA lo haga en segundos.",
    feature_video_title: "Análisis de Video",
    feature_video_desc: "Sube cualquier video. Frames, transcripción, modelo creativo y hook extraídos en menos de 60 segundos.",
    feature_board_title: "Generación de Boards",
    feature_board_desc: "Escribe un prompt. Obtén un board de producción completo con escenas, guión de VO y notas para el editor.",
    feature_translation_title: "Traducción Automática",
    feature_translation_desc: "Cualquier idioma, cualquier mercado — siempre entregado en inglés para tu equipo global.",
    feature_intelligence_title: "Inteligencia Creativa",
    feature_intelligence_desc: "Cada video clasificado por formato. Hook extraído de los primeros 3 segundos.",
    feature_ai_video_title: "Generación de Video con IA",
    feature_ai_video_desc: "Del concepto al MP4 con voz en off de IA. Sin necesidad de editores.",
    feature_api_title: "Acceso API",
    feature_api_desc: "Integra FrameIQ en tu flujo de trabajo existente con nuestra API REST.",

    pricing_label: "Precios",
    pricing_title: "Precios simples y transparentes",
    pricing_subtitle: "Comienza gratis. Escala cuando estés listo.",
    pricing_free: "Gratis",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "Más Popular",
    pricing_mo: "/mes",
    pricing_cta_free: "Comienza gratis",
    pricing_cta_trial: "Prueba de 14 días",
    pricing_cta_demo: "Reserva una demo",

    cta_title: "¿Listo para multiplicar tu producción creativa por 10?",
    cta_subtitle: "Únete a más de 147 equipos de performance que producen más creativo, más rápido.",
    cta_primary: "Comienza gratis",
    cta_secondary: "Reserva una demo",

    footer_desc: "Inteligencia creativa impulsada por IA para equipos de performance marketing.",
    footer_product: "Producto",
    footer_company: "Empresa",
    footer_legal: "Legal",
    footer_privacy: "Política de Privacidad",
    footer_terms: "Términos de Servicio",
    footer_rights: "© 2026 FrameIQ. Todos los derechos reservados.",
    footer_soc2: "Cumple SOC 2",
    footer_uptime: "99.9% Uptime",
    footer_book_demo: "Reservar Demo",

    auth_login_title: "Bienvenido de vuelta",
    auth_login_subtitle: "Inicia sesión en tu cuenta de FrameIQ",
    auth_signup_title: "Crea tu cuenta",
    auth_signup_subtitle: "Empieza a analizar videos y escalar tus creativos",
    auth_email: "Email corporativo",
    auth_password: "Contraseña",
    auth_name: "Nombre completo",
    auth_forgot: "¿Olvidaste tu contraseña?",
    auth_no_account: "¿No tienes cuenta?",
    auth_has_account: "¿Ya tienes cuenta?",
    auth_signin: "Iniciar sesión",
    auth_create: "Crear cuenta",
    auth_google: "Continuar con Google",
    auth_or_email: "O continúa con email",

    confirm_title: "Revisa tu bandeja de entrada",
    confirm_text: "Enviamos un enlace de verificación a",
    confirm_didnt_receive: "¿No lo recibiste? Revisa spam o",
    confirm_resend: "reenviar email",
    confirm_back: "Volver al login",
    confirm_confirmed_title: "¡Email confirmado!",
    confirm_confirmed_text: "Tu cuenta está verificada. Redirigiendo al dashboard...",

    powered_by: "Potenciado por",
  },

  fr: {
    nav_features: "Fonctionnalités",
    nav_pricing: "Tarifs",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contact",
    nav_signin: "Se connecter",
    nav_get_started: "Commencer gratuitement",

    hero_badge: "Approuvé par plus de 147 équipes de marketing performance",
    hero_title_1: "Intelligence créative",
    hero_title_2: "pour les équipes de performance.",
    hero_subtitle: "Chaque jour sans ça, vos concurrents lancent de meilleurs hooks, des publicités mieux scorées et des boards que votre équipe peut exécuter — pendant que vous devinez encore. Arrêtez de deviner.",
    hero_cta_primary: "Commencer gratuitement",
    hero_cta_secondary: "Voir la démo de 2 min",
    hero_check_1: "Sans carte bancaire",
    hero_check_2: "Configuration en 2 min",
    hero_check_3: "Annulez à tout moment",
    hero_screenshot_label: "RÉSULTAT D'ANALYSE RÉEL",

    stats_videos: "Vidéos Analysées",
    stats_teams: "Équipes Enterprise",
    stats_countries: "Pays",
    stats_time: "Temps Moyen d'Analyse",

    how_label: "Comment ça marche",
    how_title: "De l'upload à l'exécution\nen moins de 3 minutes",
    how_step1_title: "Uploadez ou collez un lien",
    how_step1_desc: "Déposez n'importe quelle pub, vidéo concurrente ou fichier de référence",
    how_step2_title: "L'IA extrait les insights",
    how_step2_desc: "Hook, modèle créatif, transcription, frames clés — le tout en 60s",
    how_step3_title: "Générez votre board",
    how_step3_desc: "Obtenez un brief prêt à produire que votre équipe peut exécuter aujourd'hui",

    features_label: "Fonctionnalités",
    features_title: "Tout ce dont votre équipe créative a besoin",
    features_subtitle: "Arrêtez de perdre des heures à analyser les pubs concurrentes. Laissez l'IA le faire en secondes.",
    feature_video_title: "Analyse Vidéo",
    feature_video_desc: "Uploadez n'importe quelle vidéo. Frames, transcription, modèle créatif et hook extraits en moins de 60 secondes.",
    feature_board_title: "Génération de Boards",
    feature_board_desc: "Tapez un prompt. Obtenez un board de production complet avec scènes, script VO et notes d'éditeur.",
    feature_translation_title: "Traduction Automatique",
    feature_translation_desc: "N'importe quelle langue, n'importe quel marché — toujours livré en anglais pour votre équipe mondiale.",
    feature_intelligence_title: "Intelligence Créative",
    feature_intelligence_desc: "Chaque vidéo classée par format. Hook extrait des 3 premières secondes.",
    feature_ai_video_title: "Génération Vidéo IA",
    feature_ai_video_desc: "Du concept au MP4 avec voix off IA. Pas besoin d'éditeurs.",
    feature_api_title: "Accès API",
    feature_api_desc: "Intégrez FrameIQ à votre workflow existant avec notre API REST.",

    pricing_label: "Tarifs",
    pricing_title: "Des tarifs simples et transparents",
    pricing_subtitle: "Commencez gratuitement. Évoluez quand vous êtes prêt.",
    pricing_free: "Gratuit",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "Le Plus Populaire",
    pricing_mo: "/mois",
    pricing_cta_free: "Commencer gratuitement",
    pricing_cta_trial: "Essai de 14 jours",
    pricing_cta_demo: "Réserver une démo",

    cta_title: "Prêt à multiplier par 10 votre production créative ?",
    cta_subtitle: "Rejoignez plus de 147 équipes de performance qui produisent plus de créatifs, plus vite.",
    cta_primary: "Commencer gratuitement",
    cta_secondary: "Réserver une démo",

    footer_desc: "Intelligence créative alimentée par l'IA pour les équipes de performance marketing.",
    footer_product: "Produit",
    footer_company: "Entreprise",
    footer_legal: "Mentions légales",
    footer_privacy: "Politique de Confidentialité",
    footer_terms: "Conditions d'Utilisation",
    footer_rights: "© 2026 FrameIQ. Tous droits réservés.",
    footer_soc2: "Conforme SOC 2",
    footer_uptime: "99.9% Uptime",
    footer_book_demo: "Réserver une Démo",

    auth_login_title: "Content de vous revoir",
    auth_login_subtitle: "Connectez-vous à votre compte FrameIQ",
    auth_signup_title: "Créez votre compte",
    auth_signup_subtitle: "Commencez à analyser des vidéos et à scaler vos créatifs",
    auth_email: "Email professionnel",
    auth_password: "Mot de passe",
    auth_name: "Nom complet",
    auth_forgot: "Mot de passe oublié ?",
    auth_no_account: "Pas encore de compte ?",
    auth_has_account: "Déjà un compte ?",
    auth_signin: "Se connecter",
    auth_create: "Créer un compte",
    auth_google: "Continuer avec Google",
    auth_or_email: "Ou continuer par email",

    confirm_title: "Vérifiez votre boîte de réception",
    confirm_text: "Nous avons envoyé un lien de vérification à",
    confirm_didnt_receive: "Pas reçu ? Vérifiez vos spams ou",
    confirm_resend: "renvoyer l'email",
    confirm_back: "Retour à la connexion",
    confirm_confirmed_title: "Email confirmé !",
    confirm_confirmed_text: "Votre compte est vérifié. Redirection vers le tableau de bord...",

    powered_by: "Propulsé par",
  },

  de: {
    nav_features: "Funktionen",
    nav_pricing: "Preise",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Kontakt",
    nav_signin: "Anmelden",
    nav_get_started: "Kostenlos starten",

    hero_badge: "Vertraut von über 147 Performance-Marketing-Teams",
    hero_title_1: "Kreative Intelligenz",
    hero_title_2: "für Performance-Teams.",
    hero_subtitle: "Jeden Tag ohne es liefern Ihre Konkurrenten bessere Hooks, höher bewertete Anzeigen und Boards, die Ihr Team ausführen kann — während Sie noch raten. Hören Sie auf zu raten.",
    hero_cta_primary: "Kostenlos starten — ohne Karte",
    hero_cta_secondary: "2-Min-Demo ansehen",
    hero_check_1: "Keine Kreditkarte",
    hero_check_2: "Setup in 2 Min",
    hero_check_3: "Jederzeit kündbar",
    hero_screenshot_label: "ECHTES ANALYSEERGEBNIS",

    stats_videos: "Videos Analysiert",
    stats_teams: "Enterprise Teams",
    stats_countries: "Länder",
    stats_time: "Durchschn. Analysezeit",

    how_label: "So funktioniert's",
    how_title: "Vom Upload zur Umsetzung\nin unter 3 Minuten",
    how_step1_title: "Hochladen oder Link einfügen",
    how_step1_desc: "Laden Sie jede Anzeige, jedes Wettbewerber-Video oder jede Referenzdatei hoch",
    how_step2_title: "KI extrahiert Insights",
    how_step2_desc: "Hook, Kreativmodell, Transkript, Schlüsselframes — alles in 60s",
    how_step3_title: "Board generieren",
    how_step3_desc: "Erhalten Sie ein produktionsreifes Brief, das Ihr Team heute umsetzen kann",

    features_label: "Funktionen",
    features_title: "Alles was Ihr Kreativteam braucht",
    features_subtitle: "Hören Sie auf, stundenlang Wettbewerber-Anzeigen zu analysieren. Lassen Sie KI es in Sekunden erledigen.",
    feature_video_title: "Video-Analyse",
    feature_video_desc: "Laden Sie jedes Video hoch. Frames, Transkript, Kreativmodell und Hook in unter 60 Sekunden extrahiert.",
    feature_board_title: "Board-Generierung",
    feature_board_desc: "Geben Sie einen Prompt ein. Erhalten Sie ein komplettes Produktions-Board mit Szenen, VO-Skript und Editor-Notizen.",
    feature_translation_title: "Automatische Übersetzung",
    feature_translation_desc: "Jede Sprache, jeder Markt — immer auf Englisch für Ihr globales Team.",
    feature_intelligence_title: "Kreative Intelligenz",
    feature_intelligence_desc: "Jedes Video nach Format klassifiziert. Hook aus den ersten 3 Sekunden extrahiert.",
    feature_ai_video_title: "KI-Videogenerierung",
    feature_ai_video_desc: "Vom Konzept-Board zum MP4 mit KI-Voiceover. Keine Editoren nötig.",
    feature_api_title: "API-Zugang",
    feature_api_desc: "Integrieren Sie FrameIQ in Ihren bestehenden Workflow mit unserer REST-API.",

    pricing_label: "Preise",
    pricing_title: "Einfache, transparente Preise",
    pricing_subtitle: "Kostenlos starten. Skalieren wenn Sie bereit sind.",
    pricing_free: "Kostenlos",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "Am Beliebtesten",
    pricing_mo: "/Monat",
    pricing_cta_free: "Kostenlos starten",
    pricing_cta_trial: "14-Tage-Testversion",
    pricing_cta_demo: "Demo buchen",

    cta_title: "Bereit, Ihre kreative Leistung zu verzehnfachen?",
    cta_subtitle: "Schließen Sie sich über 147 Performance-Teams an, die mehr Creatives schneller liefern.",
    cta_primary: "Kostenlos starten",
    cta_secondary: "Demo buchen",

    footer_desc: "KI-gestützte kreative Intelligenz für Performance-Marketing-Teams.",
    footer_product: "Produkt",
    footer_company: "Unternehmen",
    footer_legal: "Rechtliches",
    footer_privacy: "Datenschutz",
    footer_terms: "Nutzungsbedingungen",
    footer_rights: "© 2026 FrameIQ. Alle Rechte vorbehalten.",
    footer_soc2: "SOC 2 Konform",
    footer_uptime: "99.9% Uptime",
    footer_book_demo: "Demo Buchen",

    auth_login_title: "Willkommen zurück",
    auth_login_subtitle: "Melden Sie sich bei Ihrem FrameIQ-Konto an",
    auth_signup_title: "Konto erstellen",
    auth_signup_subtitle: "Beginnen Sie mit der Analyse von Videos und skalieren Sie Ihre Creatives",
    auth_email: "Geschäftliche E-Mail",
    auth_password: "Passwort",
    auth_name: "Vollständiger Name",
    auth_forgot: "Passwort vergessen?",
    auth_no_account: "Noch kein Konto?",
    auth_has_account: "Bereits ein Konto?",
    auth_signin: "Anmelden",
    auth_create: "Konto erstellen",
    auth_google: "Weiter mit Google",
    auth_or_email: "Oder per E-Mail fortfahren",

    confirm_title: "Prüfen Sie Ihren Posteingang",
    confirm_text: "Wir haben einen Bestätigungslink gesendet an",
    confirm_didnt_receive: "Nicht erhalten? Prüfen Sie Ihren Spam-Ordner oder",
    confirm_resend: "E-Mail erneut senden",
    confirm_back: "Zurück zur Anmeldung",
    confirm_confirmed_title: "E-Mail bestätigt!",
    confirm_confirmed_text: "Ihr Konto ist verifiziert. Weiterleitung zum Dashboard...",

    powered_by: "Unterstützt von",
  },

  ar: {
    nav_features: "الميزات",
    nav_pricing: "الأسعار",
    nav_blog: "المدونة",
    nav_faq: "الأسئلة الشائعة",
    nav_contact: "اتصل بنا",
    nav_signin: "تسجيل الدخول",
    nav_get_started: "ابدأ مجاناً",

    hero_badge: "موثوق من قبل أكثر من 147 فريق تسويق أداء",
    hero_title_1: "الذكاء الإبداعي",
    hero_title_2: "لفرق الأداء.",
    hero_subtitle: "كل يوم بدونه، منافسوك يطلقون خطافات أفضل، إعلانات بدرجات أعلى، ولوحات يمكن لفريقك تنفيذها — بينما أنت لا تزال تخمن. توقف عن التخمين.",
    hero_cta_primary: "ابدأ مجاناً — بدون بطاقة",
    hero_cta_secondary: "شاهد العرض التوضيحي",
    hero_check_1: "بدون بطاقة ائتمان",
    hero_check_2: "إعداد في دقيقتين",
    hero_check_3: "إلغاء في أي وقت",
    hero_screenshot_label: "نتيجة تحليل حقيقية",

    stats_videos: "فيديوهات تم تحليلها",
    stats_teams: "فرق مؤسسية",
    stats_countries: "دول",
    stats_time: "متوسط وقت التحليل",

    how_label: "كيف يعمل",
    how_title: "من الرفع إلى التنفيذ\nفي أقل من 3 دقائق",
    how_step1_title: "ارفع أو الصق الرابط",
    how_step1_desc: "اسحب أي إعلان أو فيديو منافس أو ملف مرجعي",
    how_step2_title: "الذكاء الاصطناعي يستخرج الرؤى",
    how_step2_desc: "الخطاف، النموذج الإبداعي، النص، الإطارات الرئيسية — كل شيء في 60 ثانية",
    how_step3_title: "أنشئ لوحتك",
    how_step3_desc: "احصل على ملخص جاهز للإنتاج يمكن لفريقك تنفيذه اليوم",

    features_label: "الميزات",
    features_title: "كل ما يحتاجه فريقك الإبداعي",
    features_subtitle: "توقف عن إضاعة الساعات في تحليل إعلانات المنافسين. دع الذكاء الاصطناعي يفعل ذلك في ثوانٍ.",
    feature_video_title: "تحليل الفيديو",
    feature_video_desc: "ارفع أي فيديو. يتم استخراج الإطارات والنص والنموذج الإبداعي والخطاف في أقل من 60 ثانية.",
    feature_board_title: "إنشاء اللوحات",
    feature_board_desc: "اكتب أمراً. احصل على لوحة إنتاج كاملة مع المشاهد ونص التعليق الصوتي وملاحظات المحرر.",
    feature_translation_title: "الترجمة التلقائية",
    feature_translation_desc: "أي لغة، أي سوق — يتم تسليمها دائماً بالإنجليزية لفريقك العالمي.",
    feature_intelligence_title: "الذكاء الإبداعي",
    feature_intelligence_desc: "كل فيديو مصنف حسب التنسيق. يتم استخراج الخطاف من أول 3 ثوانٍ.",
    feature_ai_video_title: "إنشاء فيديو بالذكاء الاصطناعي",
    feature_ai_video_desc: "من لوحة المفهوم إلى MP4 مع تعليق صوتي بالذكاء الاصطناعي. لا حاجة لمحررين.",
    feature_api_title: "الوصول إلى API",
    feature_api_desc: "ادمج FrameIQ في سير عملك الحالي مع API REST.",

    pricing_label: "الأسعار",
    pricing_title: "أسعار بسيطة وشفافة",
    pricing_subtitle: "ابدأ مجاناً. توسع عندما تكون جاهزاً.",
    pricing_free: "مجاني",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "الأكثر شعبية",
    pricing_mo: "/شهر",
    pricing_cta_free: "ابدأ مجاناً",
    pricing_cta_trial: "تجربة 14 يوم",
    pricing_cta_demo: "احجز عرض تجريبي",

    cta_title: "مستعد لمضاعفة إنتاجك الإبداعي 10 مرات؟",
    cta_subtitle: "انضم إلى أكثر من 147 فريق أداء ينتج محتوى إبداعي أكثر وأسرع.",
    cta_primary: "ابدأ مجاناً",
    cta_secondary: "احجز عرض تجريبي",

    footer_desc: "ذكاء إبداعي مدعوم بالذكاء الاصطناعي لفرق تسويق الأداء.",
    footer_product: "المنتج",
    footer_company: "الشركة",
    footer_legal: "قانوني",
    footer_privacy: "سياسة الخصوصية",
    footer_terms: "شروط الخدمة",
    footer_rights: "© 2026 FrameIQ. جميع الحقوق محفوظة.",
    footer_soc2: "متوافق مع SOC 2",
    footer_uptime: "99.9% وقت التشغيل",
    footer_book_demo: "احجز عرض تجريبي",

    auth_login_title: "مرحباً بعودتك",
    auth_login_subtitle: "سجل الدخول إلى حساب FrameIQ",
    auth_signup_title: "أنشئ حسابك",
    auth_signup_subtitle: "ابدأ بتحليل الفيديوهات وتوسيع إبداعاتك",
    auth_email: "البريد الإلكتروني للعمل",
    auth_password: "كلمة المرور",
    auth_name: "الاسم الكامل",
    auth_forgot: "نسيت كلمة المرور؟",
    auth_no_account: "ليس لديك حساب؟",
    auth_has_account: "لديك حساب بالفعل؟",
    auth_signin: "تسجيل الدخول",
    auth_create: "إنشاء حساب",
    auth_google: "المتابعة مع Google",
    auth_or_email: "أو المتابعة بالبريد الإلكتروني",

    confirm_title: "تحقق من بريدك الوارد",
    confirm_text: "أرسلنا رابط التحقق إلى",
    confirm_didnt_receive: "لم تستلمه؟ تحقق من مجلد البريد العشوائي أو",
    confirm_resend: "إعادة إرسال البريد",
    confirm_back: "العودة لتسجيل الدخول",
    confirm_confirmed_title: "تم تأكيد البريد الإلكتروني!",
    confirm_confirmed_text: "حسابك تم التحقق منه. جاري التوجيه إلى لوحة التحكم...",

    powered_by: "مدعوم من",
  },

  zh: {
    nav_features: "功能",
    nav_pricing: "价格",
    nav_blog: "博客",
    nav_faq: "常见问题",
    nav_contact: "联系我们",
    nav_signin: "登录",
    nav_get_started: "免费开始",

    hero_badge: "受到147+效果营销团队的信赖",
    hero_title_1: "创意智能",
    hero_title_2: "为效果营销团队。",
    hero_subtitle: "每过一天，竞争对手就在推出更好的开场白、得分更高的广告和你的团队可以执行的制作方案——而你还在猜测。停止猜测。",
    hero_cta_primary: "免费开始 — 无需信用卡",
    hero_cta_secondary: "观看2分钟演示",
    hero_check_1: "无需信用卡",
    hero_check_2: "2分钟设置",
    hero_check_3: "随时取消",
    hero_screenshot_label: "真实分析结果",

    stats_videos: "已分析视频",
    stats_teams: "企业团队",
    stats_countries: "国家",
    stats_time: "平均分析时间",

    how_label: "工作原理",
    how_title: "从上传到执行\n不到3分钟",
    how_step1_title: "上传或粘贴链接",
    how_step1_desc: "拖放任何广告、竞品视频或参考文件",
    how_step2_title: "AI提取洞察",
    how_step2_desc: "钩子、创意模型、转录、关键帧——全部60秒完成",
    how_step3_title: "生成你的看板",
    how_step3_desc: "获取一份你的团队今天就能执行的制作简报",

    features_label: "功能",
    features_title: "您的创意团队所需的一切",
    features_subtitle: "不再浪费数小时逆向工程竞争对手广告。让AI在几秒钟内完成。",
    feature_video_title: "视频分析",
    feature_video_desc: "上传任何视频。60秒内提取帧、转录、创意模型和钩子。",
    feature_board_title: "看板生成",
    feature_board_desc: "输入提示。获取包含场景、配音脚本和编辑注释的完整制作看板。",
    feature_translation_title: "自动翻译",
    feature_translation_desc: "任何语言，任何市场——始终为您的全球团队提供英语版本。",
    feature_intelligence_title: "创意智能",
    feature_intelligence_desc: "每个视频按格式分类。从前3秒提取钩子。",
    feature_ai_video_title: "AI视频生成",
    feature_ai_video_desc: "从概念看板到带AI配音的MP4。无需编辑人员。",
    feature_api_title: "API访问",
    feature_api_desc: "通过REST API将FrameIQ集成到您现有的工作流程中。",

    pricing_label: "价格",
    pricing_title: "简单透明的定价",
    pricing_subtitle: "免费开始。准备好时再升级。",
    pricing_free: "免费",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "最受欢迎",
    pricing_mo: "/月",
    pricing_cta_free: "免费开始",
    pricing_cta_trial: "14天免费试用",
    pricing_cta_demo: "预约演示",

    cta_title: "准备好将创意产出提高10倍了吗？",
    cta_subtitle: "加入147+效果团队，更快地制作更多创意。",
    cta_primary: "免费开始",
    cta_secondary: "预约演示",

    footer_desc: "为效果营销团队提供AI驱动的创意智能。",
    footer_product: "产品",
    footer_company: "公司",
    footer_legal: "法律",
    footer_privacy: "隐私政策",
    footer_terms: "服务条款",
    footer_rights: "© 2026 FrameIQ. 保留所有权利。",
    footer_soc2: "SOC 2合规",
    footer_uptime: "99.9%正常运行时间",
    footer_book_demo: "预约演示",

    auth_login_title: "欢迎回来",
    auth_login_subtitle: "登录您的FrameIQ账户",
    auth_signup_title: "创建账户",
    auth_signup_subtitle: "开始分析视频并扩展您的创意",
    auth_email: "工作邮箱",
    auth_password: "密码",
    auth_name: "全名",
    auth_forgot: "忘记密码？",
    auth_no_account: "没有账户？",
    auth_has_account: "已有账户？",
    auth_signin: "登录",
    auth_create: "创建账户",
    auth_google: "使用Google继续",
    auth_or_email: "或使用邮箱继续",

    confirm_title: "查看您的收件箱",
    confirm_text: "我们已发送验证链接至",
    confirm_didnt_receive: "没有收到？检查垃圾邮件或",
    confirm_resend: "重新发送邮件",
    confirm_back: "返回登录",
    confirm_confirmed_title: "邮箱已确认！",
    confirm_confirmed_text: "您的账户已验证。正在跳转到控制面板...",

    powered_by: "技术支持",
  },

  pt: {
    nav_features: "Funcionalidades",
    nav_pricing: "Preços",
    nav_blog: "Blog",
    nav_faq: "FAQ",
    nav_contact: "Contato",
    nav_signin: "Entrar",
    nav_get_started: "Comece grátis",

    hero_badge: "Usado por mais de 147 equipes de performance marketing",
    hero_title_1: "Inteligência criativa",
    hero_title_2: "para times de performance.",
    hero_subtitle: "Cada dia sem isso, seus concorrentes estão entregando hooks melhores, anúncios com score mais alto e boards que o seu time consegue executar — enquanto você ainda está tentando adivinhar. Pare de adivinhar.",
    hero_cta_primary: "Comece grátis — sem cartão",
    hero_cta_secondary: "Assista a demo de 2 min",
    hero_check_1: "Sem cartão de crédito",
    hero_check_2: "Configuração em 2 min",
    hero_check_3: "Cancele quando quiser",
    hero_screenshot_label: "RESULTADO REAL DA ANÁLISE",

    stats_videos: "Vídeos Analisados",
    stats_teams: "Equipes Enterprise",
    stats_countries: "Países",
    stats_time: "Tempo Médio de Análise",

    how_label: "Como funciona",
    how_title: "Do upload à execução\nem menos de 3 minutos",
    how_step1_title: "Envie ou cole o link",
    how_step1_desc: "Arraste qualquer anúncio, vídeo de concorrente ou arquivo de referência",
    how_step2_title: "A IA extrai insights",
    how_step2_desc: "Hook, modelo criativo, transcrição, frames-chave — tudo em 60s",
    how_step3_title: "Gere seu board",
    how_step3_desc: "Receba um briefing pronto para produção que sua equipe pode executar hoje",

    features_label: "Funcionalidades",
    features_title: "Tudo que sua equipe criativa precisa",
    features_subtitle: "Pare de perder horas decifrando anúncios da concorrência. Deixe a IA fazer em segundos.",
    feature_video_title: "Análise de Vídeo",
    feature_video_desc: "Envie qualquer vídeo. Frames, transcrição, modelo criativo e hook extraídos em menos de 60 segundos.",
    feature_board_title: "Geração de Boards",
    feature_board_desc: "Digite um prompt. Receba um board de produção completo com cenas, roteiro de VO e notas para o editor.",
    feature_translation_title: "Tradução Automática",
    feature_translation_desc: "Qualquer idioma, qualquer mercado — sempre entregue em inglês para sua equipe global.",
    feature_intelligence_title: "Inteligência Criativa",
    feature_intelligence_desc: "Cada vídeo classificado por formato. Hook extraído dos primeiros 3 segundos.",
    feature_ai_video_title: "Geração de Vídeo com IA",
    feature_ai_video_desc: "Do conceito ao MP4 com narração de IA. Sem necessidade de editores.",
    feature_api_title: "Acesso à API",
    feature_api_desc: "Integre o FrameIQ ao seu fluxo de trabalho existente com nossa API REST.",

    pricing_label: "Preços",
    pricing_title: "Preços simples e transparentes",
    pricing_subtitle: "Comece grátis. Escale quando estiver pronto.",
    pricing_free: "Grátis",
    pricing_studio: "Studio",
    pricing_scale: "Scale",
    pricing_most_popular: "Mais Popular",
    pricing_mo: "/mês",
    pricing_cta_free: "Comece grátis",
    pricing_cta_trial: "Teste de 14 dias",
    pricing_cta_demo: "Agende uma demo",

    cta_title: "Pronto para multiplicar sua produção criativa por 10?",
    cta_subtitle: "Junte-se a mais de 147 equipes de performance que produzem mais criativos, mais rápido.",
    cta_primary: "Comece grátis",
    cta_secondary: "Agende uma demo",

    footer_desc: "Inteligência criativa alimentada por IA para equipes de performance marketing.",
    footer_product: "Produto",
    footer_company: "Empresa",
    footer_legal: "Legal",
    footer_privacy: "Política de Privacidade",
    footer_terms: "Termos de Serviço",
    footer_rights: "© 2026 FrameIQ. Todos os direitos reservados.",
    footer_soc2: "Conforme SOC 2",
    footer_uptime: "99.9% Uptime",
    footer_book_demo: "Agendar Demo",

    auth_login_title: "Bem-vindo de volta",
    auth_login_subtitle: "Entre na sua conta FrameIQ",
    auth_signup_title: "Crie sua conta",
    auth_signup_subtitle: "Comece a analisar vídeos e escalar seus criativos",
    auth_email: "Email corporativo",
    auth_password: "Senha",
    auth_name: "Nome completo",
    auth_forgot: "Esqueceu a senha?",
    auth_no_account: "Não tem uma conta?",
    auth_has_account: "Já tem uma conta?",
    auth_signin: "Entrar",
    auth_create: "Criar conta",
    auth_google: "Continuar com Google",
    auth_or_email: "Ou continue com email",

    confirm_title: "Verifique sua caixa de entrada",
    confirm_text: "Enviamos um link de verificação para",
    confirm_didnt_receive: "Não recebeu? Verifique o spam ou",
    confirm_resend: "reenviar email",
    confirm_back: "Voltar ao login",
    confirm_confirmed_title: "Email confirmado!",
    confirm_confirmed_text: "Sua conta foi verificada. Redirecionando para o dashboard...",

    powered_by: "Desenvolvido por",
  },
};
