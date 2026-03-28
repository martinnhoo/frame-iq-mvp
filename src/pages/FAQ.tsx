import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";

type Lang = "pt" | "en" | "es";

function useLang(): Lang {
  if (typeof navigator === "undefined") return "pt";
  const l = navigator.language.toLowerCase();
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("es")) return "es";
  return "en";
}

const T = {
  pt: {
    title: "FAQ — AdBrief",
    meta: "Perguntas frequentes sobre o AdBrief — a IA que conecta na sua conta de anúncios e responde como um analista.",
    heading: "Perguntas frequentes",
    sub: "Tudo que você precisa saber antes de começar.",
    cta_label: "Ainda tem dúvidas?",
    cta_sub: "Fale com a gente em",
    cta_btn: "Começar grátis",
    items: [
      {
        q: "O que é o AdBrief?",
        a: "AdBrief é uma plataforma de IA para gestores de tráfego e equipes de performance. Você conecta sua conta Meta Ads ou Google Ads e conversa com a IA em linguagem natural — ela lê seus dados reais e responde como um analista que conhece cada campanha, criativo e métrica.",
      },
      {
        q: "Como o AdBrief acessa minha conta de anúncios?",
        a: "Via OAuth 2.0 — o mesmo protocolo seguro que o Google e a Meta usam para autorizar apps. Você nunca compartilha sua senha. O AdBrief recebe um token de acesso com permissão de leitura, e você pode revogar esse acesso a qualquer momento no painel de Contas.",
      },
      {
        q: "Quais plataformas são suportadas?",
        a: "Meta Ads e Google Ads — ambas totalmente integradas e lendo seus dados em tempo real. TikTok Ads está em breve.",
      },
      {
        q: "Que tipo de perguntas posso fazer?",
        a: "Qualquer coisa sobre sua conta: 'Por que meu ROAS caiu essa semana?', 'Quais criativos devo pausar agora?', 'Qual campanha está com frequência alta?', 'Escreve 3 hooks baseados nos meus anúncios vencedores', 'Cria um script UGC para o produto X'. A IA usa seus dados reais para responder, não exemplos genéricos.",
      },
      {
        q: "O AdBrief lê dados históricos ou só dados de hoje?",
        a: "Os últimos 90 dias de dados — campanhas, conjuntos de anúncios, criativos, métricas de desempenho por dia. Isso permite identificar tendências, quedas e padrões ao longo do tempo.",
      },
      {
        q: "Meus dados são seguros?",
        a: "Sim. Todos os dados são criptografados em trânsito (TLS) e em repouso (AES-256). Nunca vendemos ou compartilhamos seus dados de conta com terceiros. Seus dados de anúncios são usados exclusivamente para gerar respostas dentro do seu painel — nunca para treinar modelos de IA.",
      },
      {
        q: "O que é uma 'Conta' no AdBrief?",
        a: "Uma Conta é um perfil de marca conectado às suas contas de anúncios (Meta Ads, Google Ads). Você pode ter múltiplas Contas — por exemplo, uma para cada cliente ou marca. A IA usa o contexto de cada Conta para personalizar todas as respostas.",
      },
      {
        q: "Posso usar para vários clientes?",
        a: "Sim. O plano Pro suporta até 3 Contas simultâneas. O plano Studio é ilimitado — ideal para agências que gerenciam múltiplos clientes.",
      },
      {
        q: "O AdBrief cria ou altera campanhas?",
        a: "Não. O AdBrief é read-only — lê, analisa e sugere. Nunca cria, pausa ou modifica campanhas automaticamente. Você mantém controle total.",
      },
      {
        q: "Como funciona o período de teste?",
        a: "Todo plano inclui 3 dias grátis. Você informa um cartão no início, mas só é cobrado no 4º dia. Cancele antes e não paga nada.",
      },
      {
        q: "Posso cancelar quando quiser?",
        a: "Sim. Cancele a qualquer momento nas configurações da conta. O acesso continua até o fim do período pago. Sem multa, sem burocracia.",
      },
      {
        q: "Os alertas do Telegram funcionam como?",
        a: "O AdBrief monitora sua conta em tempo real e envia alertas no Telegram quando detecta quedas de ROAS, criativos com fadiga, frequência alta ou oportunidades de escalar. Você conecta o Telegram uma vez nas configurações e recebe notificações no celular.",
      },
    ],
  },
  en: {
    title: "FAQ — AdBrief",
    meta: "Frequently asked questions about AdBrief — the AI that connects to your ad account and answers like a senior analyst.",
    heading: "Frequently asked questions",
    sub: "Everything you need to know before getting started.",
    cta_label: "Still have questions?",
    cta_sub: "Email us at",
    cta_btn: "Start free",
    items: [
      {
        q: "What is AdBrief?",
        a: "AdBrief is an AI platform for media buyers and performance teams. Connect your Meta Ads or Google Ads account and chat with the AI in natural language — it reads your real data and responds like an analyst who knows every campaign, creative, and metric.",
      },
      {
        q: "How does AdBrief access my ad account?",
        a: "Via OAuth 2.0 — the same secure protocol used by Google and Meta to authorize apps. You never share your password. AdBrief receives a read-only access token, and you can revoke access at any time from the Accounts panel.",
      },
      {
        q: "Which platforms are supported?",
        a: "Meta Ads and Google Ads — both fully integrated and reading your real data in real time. TikTok Ads is coming soon.",
      },
      {
        q: "What kind of questions can I ask?",
        a: "Anything about your account: 'Why did my ROAS drop this week?', 'Which creatives should I pause now?', 'Which campaign has high frequency?', 'Write 3 hooks based on my winning ads', 'Create a UGC script for product X'. The AI uses your real data — not generic examples.",
      },
      {
        q: "Does AdBrief read historical data or just today's?",
        a: "The last 90 days of data — campaigns, ad sets, creatives, performance metrics by day. This allows identifying trends, drops, and patterns over time.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All data is encrypted in transit (TLS) and at rest (AES-256). We never sell or share your account data with third parties. Your ad data is used exclusively to generate responses inside your dashboard — never to train AI models.",
      },
      {
        q: "What is an 'Account' in AdBrief?",
        a: "An Account is a brand profile connected to your ad accounts (Meta Ads, Google Ads). You can have multiple Accounts — for example, one per client or brand. The AI uses each Account's context to personalize all responses.",
      },
      {
        q: "Can I use it for multiple clients?",
        a: "Yes. The Pro plan supports up to 3 simultaneous Accounts. The Studio plan is unlimited — ideal for agencies managing multiple clients.",
      },
      {
        q: "Does AdBrief create or modify campaigns?",
        a: "No. AdBrief is read-only — it reads, analyzes, and suggests. It never creates, pauses, or modifies campaigns automatically. You keep full control.",
      },
      {
        q: "How does the free trial work?",
        a: "Every plan includes a 3-day free trial. You add a card upfront, but you are only charged on day 4. Cancel before then and pay nothing.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel anytime from account settings. Access continues until the end of the paid period. No penalties, no hassle.",
      },
      {
        q: "How do Telegram alerts work?",
        a: "AdBrief monitors your account in real time and sends Telegram alerts when it detects ROAS drops, creative fatigue, high frequency, or scaling opportunities. Connect Telegram once in settings and get mobile notifications.",
      },
    ],
  },
  es: {
    title: "FAQ — AdBrief",
    meta: "Preguntas frecuentes sobre AdBrief — la IA que se conecta a tu cuenta de anuncios y responde como un analista.",
    heading: "Preguntas frecuentes",
    sub: "Todo lo que necesitas saber antes de empezar.",
    cta_label: "¿Tienes más preguntas?",
    cta_sub: "Escríbenos a",
    cta_btn: "Empezar gratis",
    items: [
      {
        q: "¿Qué es AdBrief?",
        a: "AdBrief es una plataforma de IA para gestores de tráfico y equipos de performance. Conecta tu cuenta de Meta Ads o Google Ads y chatea con la IA en lenguaje natural — lee tus datos reales y responde como un analista que conoce cada campaña, creativo y métrica.",
      },
      {
        q: "¿Cómo accede AdBrief a mi cuenta de anuncios?",
        a: "Mediante OAuth 2.0 — el mismo protocolo seguro que usan Google y Meta para autorizar apps. Nunca compartes tu contraseña. AdBrief recibe un token de acceso de solo lectura, y puedes revocar el acceso en cualquier momento desde el panel de Cuentas.",
      },
      {
        q: "¿Qué plataformas son compatibles?",
        a: "Meta Ads y Google Ads — ambas totalmente integradas y leyendo tus datos en tiempo real. TikTok Ads próximamente.",
      },
      {
        q: "¿Qué tipo de preguntas puedo hacer?",
        a: "Cualquier cosa sobre tu cuenta: '¿Por qué cayó mi ROAS esta semana?', '¿Qué creativos debo pausar ahora?', '¿Qué campaña tiene frecuencia alta?', 'Escribe 3 hooks basados en mis anuncios ganadores', 'Crea un script UGC para el producto X'. La IA usa tus datos reales — no ejemplos genéricos.",
      },
      {
        q: "¿AdBrief lee datos históricos o solo de hoy?",
        a: "Los últimos 90 días de datos — campañas, conjuntos de anuncios, creativos, métricas de rendimiento por día. Esto permite identificar tendencias, caídas y patrones a lo largo del tiempo.",
      },
      {
        q: "¿Mis datos están seguros?",
        a: "Sí. Todos los datos están cifrados en tránsito (TLS) y en reposo (AES-256). Nunca vendemos ni compartimos tus datos de cuenta con terceros. Tus datos de anuncios se usan exclusivamente para generar respuestas dentro de tu panel — nunca para entrenar modelos de IA.",
      },
      {
        q: "¿Qué es una 'Cuenta' en AdBrief?",
        a: "Una Cuenta es un perfil de marca conectado a tus cuentas de anuncios (Meta Ads, Google Ads). Puedes tener múltiples Cuentas — por ejemplo, una por cliente o marca. La IA usa el contexto de cada Cuenta para personalizar todas las respuestas.",
      },
      {
        q: "¿Puedo usarlo para varios clientes?",
        a: "Sí. El plan Pro soporta hasta 3 Cuentas simultáneas. El plan Studio es ilimitado — ideal para agencias que gestionan múltiples clientes.",
      },
      {
        q: "¿AdBrief crea o modifica campañas?",
        a: "No. AdBrief es de solo lectura — lee, analiza y sugiere. Nunca crea, pausa ni modifica campañas automáticamente. Tú mantienes el control total.",
      },
      {
        q: "¿Cómo funciona el período de prueba?",
        a: "Todos los planes incluyen 3 días gratis. Añades una tarjeta al inicio, pero solo te cobran el día 4. Cancela antes y no pagas nada.",
      },
      {
        q: "¿Puedo cancelar cuando quiera?",
        a: "Sí. Cancela en cualquier momento desde la configuración de la cuenta. El aceso continúa hasta el final del período pagado. Sin penalizaciones.",
      },
      {
        q: "¿Cómo funcionan las alertas de Telegram?",
        a: "AdBrief monitorea tu cuenta en tiempo real y envía alertas de Telegram cuando detecta caídas de ROAS, fatiga creativa, frecuencia alta u oportunidades de escalar. Conecta Telegram una vez en la configuración y recibe notificaciones en el móvil.",
      },
    ],
  },
};

const FAQ = () => {
  const lang = useLang();
  const t = T[lang];
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.meta} />
        <link rel="canonical" href="https://adbrief.pro/faq" />
      </Helmet>

      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo size="lg" /></Link>
          <Link
            to="/signup"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t.cta_btn}
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-4xl font-bold mb-3">{t.heading}</h1>
        <p className="text-muted-foreground mb-12">{t.sub}</p>

        <div className="space-y-2">
          {t.items.map((item, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-medium text-sm pr-4">{item.q}</span>
                <ChevronDown
                  size={16}
                  className="text-muted-foreground shrink-0 transition-transform duration-200"
                  style={{ transform: open === i ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16 text-center border border-border/50 rounded-2xl p-10">
          <p className="font-semibold mb-1">{t.cta_label}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {t.cta_sub}{" "}
            <a href="mailto:hello@adbrief.pro" className="text-primary hover:underline">
              hello@adbrief.pro
            </a>
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
          >
            {t.cta_btn} →
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 px-6">
        <div className="container mx-auto max-w-2xl text-center text-xs text-muted-foreground/60">
          © 2026 AdBrief.
          {" · "}
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          {" · "}
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          {" · "}
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>
      </footer>
    </div>
  );
};

export default FAQ;
