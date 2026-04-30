/**
 * /metodologia — public methodology page (PT / EN / ES).
 *
 * Why this exists: every customer-facing money KPI (ROAS, CPA, spend) on
 * AdBrief carries a small DataSourceFooter that links here. The footer
 * tells the user *that* the number comes from Meta with a 7-day click +
 * 1-day view attribution; this page tells them *why*, *what's not
 * included*, and *how they can verify*. Keeping it as a single, public,
 * static page means we can link it from anywhere (dashboard, marketing
 * site, support replies) without auth gating.
 *
 * Content is mirrored across three languages because money trust is a
 * universal concern — non-PT customers shouldn't read fallback text.
 */
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "pt" | "en" | "es";

interface CopyBundle {
  title: string;
  metaDesc: string;
  lastUpdated: string;
  intro: string;
  s1Title: string;
  s1P1: string;
  s1P2: string;
  s2Title: string;
  s2P1: string;
  s2P2: string;
  s3Title: string;
  s3P1: string;
  s3P2: string;
  s4Title: string;
  s4P1: string;
  s4P2: string;
  s4P3: string;
  s5Title: string;
  s5P1: string;
  s5P2: string;
  s6Title: string;
  s6Items: string[];
  s7Title: string;
  s7Items: string[];
  cta: string;
  ctaP: string;
  pricingLink: string;
  privacyLabel: string;
  termsLabel: string;
  methodologyLabel: string;
}

const COPY: Record<Lang, CopyBundle> = {
  pt: {
    title: "Como calculamos os números — AdBrief",
    metaDesc: "Como o AdBrief calcula ROAS, CPA, gasto e outras métricas de Meta Ads. Fonte dos dados, janela de atribuição, lag de conversão e o que não está incluído.",
    lastUpdated: "Última atualização: 29 de abril de 2026",
    intro: "Esta página explica de onde vêm os números que você vê no AdBrief (ROAS, CPA, gasto, conversões), em que medida eles são exatos, e o que NÃO está incluído. Se você precisa cruzar com contabilidade ou auditar uma decisão, comece por aqui.",
    s1Title: "1. Fonte dos dados",
    s1P1: "Todas as métricas de campanha (gasto, impressões, cliques, CTR, CPM, CPC, frequência, conversões e valor de conversão) vêm da Meta Ads API v21.0, através do endpoint /insights. Não inventamos números: se uma métrica aparece aqui, ela foi retornada pela própria Meta.",
    s1P2: "Você pode auditar qualquer número abrindo o Ads Manager da Meta e aplicando o mesmo período + janela de atribuição que está visível no AdBrief — os valores devem bater dentro de centavos.",
    s2Title: "2. Janela de atribuição",
    s2P1: "Por padrão usamos a janela padrão da Meta: 7 dias clique + 1 dia visualização. Isso significa que uma compra é atribuída a um anúncio se ela aconteceu até 7 dias depois de um clique, ou até 1 dia depois de uma visualização (sem clique). É a mesma janela que aparece no Ads Manager por padrão.",
    s2P2: "Se a sua conta foi configurada para outra janela, o AdBrief respeita o que a Meta retorna. O rótulo no rodapé das métricas mostra a janela em uso.",
    s3Title: "3. Lag de conversão",
    s3P1: "Conversões dos últimos 3 dias ainda podem crescer. A Meta continua atribuindo compras que aconteceram dentro da janela de 7d clique até 72h depois. Na prática isso significa que o ROAS de hoje e ontem tende a subir conforme as conversões pingam — costuma ser entre 5% e 20%, mas depende muito do seu funil.",
    s3P2: "Quando o período visível no painel inclui esses últimos 3 dias, mostramos um aviso pequeno embaixo dos KPIs. Não é um bug: é a Meta finalizando a atribuição.",
    s4Title: "4. ROAS e a linha de break-even",
    s4P1: "ROAS = receita atribuída ÷ gasto. Um ROAS de 3x quer dizer que cada R$1 investido retornou R$3 em receita atribuída — não em lucro.",
    s4P2: "Se você configurou a sua margem de lucro nas configurações da conta, o AdBrief calcula a sua linha de break-even automaticamente: break-even = 100 ÷ margem%. Margem de 30% → break-even de 3,33x. ROAS abaixo da linha aparece em vermelho (está destruindo margem); acima, em verde. Sem margem configurada, o número fica neutro.",
    s4P3: "Tolerância de 5% perto da linha — pra evitar que o número fique piscando vermelho/verde por jitter natural.",
    s5Title: "5. CPA",
    s5P1: "CPA = gasto ÷ conversões. Conversões aqui significam o evento que você marcou como objetivo da conta (compra, lead, assinatura, etc.). Se você não configurou um evento, contamos qualquer sinal de conversão que o pixel reportou — é melhor que assumir compra e mostrar zero quando seu funil é de lead.",
    s5P2: "Para cada evento, somamos todos os tipos de ação relacionados (pixel web, server-side via CAPI, onsite). Isso evita o problema comum de CPA infinito ou contagem zerada quando o pixel dispara o mesmo evento por mais de um caminho.",
    s6Title: "6. O que NÃO está incluído",
    s6Items: [
      "Receita real (do checkout): usamos o valor de conversão que a Meta atribuiu, não o que entrou na sua Stripe / Shopify / ERP. Se houver reembolso, chargeback, ou diferença entre carrinho e pagamento confirmado, o ROAS aqui é otimista por natureza.",
      "Impostos, frete e custos operacionais: ROAS é receita bruta atribuída. Margem (e por consequência break-even) é a sua entrada — ajuste em Conta se mudar o custo operacional.",
      "Vendas off-line ou por outros canais: só entra o que a Meta consegue atribuir via pixel/CAPI. Vendas por WhatsApp, indicação, retorno orgânico depois do anúncio — não estão aqui.",
      "Conversões fora da janela: uma compra que aconteceu 14 dias depois do clique não conta (a janela padrão é 7d clique + 1d view).",
      "Métricas de outras plataformas: Google Ads e TikTok Ads ainda não estão integrados na visão unificada — só Meta no momento.",
    ],
    s7Title: "7. Como você pode auditar",
    s7Items: [
      "Abra o Meta Ads Manager e selecione a mesma conta.",
      "Aplique o mesmo período que está no AdBrief (visível no canto superior do painel).",
      "Em Comparar atribuição, confirme que está em 7 dias clique + 1 dia visualização.",
      "Compare gasto, impressões, cliques, conversões e valor de conversão. Diferenças maiores que 1-2 centavos costumam vir de: lag de conversão (se o período inclui as últimas 72h), ou atribuição customizada na sua conta.",
    ],
    cta: "Encontrou um número estranho?",
    ctaP: "Manda pra gente — fala o que esperava ver, o que viu, e o período. Tratamos cada divergência como bug. Email: hello@adbrief.pro.",
    pricingLink: "Pricing",
    privacyLabel: "Privacy",
    termsLabel: "Terms",
    methodologyLabel: "Metodologia",
  },
  en: {
    title: "How we calculate the numbers — AdBrief",
    metaDesc: "How AdBrief calculates ROAS, CPA, spend and other Meta Ads metrics. Data source, attribution window, conversion lag, and what's not included.",
    lastUpdated: "Last updated: April 29, 2026",
    intro: "This page explains where the numbers you see in AdBrief (ROAS, CPA, spend, conversions) come from, how exact they are, and what is NOT included. If you need to reconcile with accounting or audit a decision, start here.",
    s1Title: "1. Data source",
    s1P1: "All campaign metrics (spend, impressions, clicks, CTR, CPM, CPC, frequency, conversions and conversion value) come from the Meta Ads API v21.0, through the /insights endpoint. We don't invent numbers: if a metric appears here, Meta itself returned it.",
    s1P2: "You can audit any number by opening Meta Ads Manager and applying the same period + attribution window that's visible in AdBrief — the values should match within cents.",
    s2Title: "2. Attribution window",
    s2P1: "By default we use Meta's standard window: 7-day click + 1-day view. That means a purchase is attributed to an ad if it happened within 7 days of a click, or within 1 day of a view (no click). It's the same window that appears in Ads Manager by default.",
    s2P2: "If your account was configured to a different window, AdBrief respects what Meta returns. The label in the metric footer shows which window is in use.",
    s3Title: "3. Conversion lag",
    s3P1: "Conversions from the last 3 days can still grow. Meta keeps attributing purchases that happened within the 7-day click window for up to 72h after. In practice this means today's and yesterday's ROAS tends to climb as conversions trickle in — usually between 5% and 20%, but it depends heavily on your funnel.",
    s3P2: "When the visible period in the dashboard includes those last 3 days, we show a small notice below the KPIs. Not a bug: Meta is still finalizing attribution.",
    s4Title: "4. ROAS and the break-even line",
    s4P1: "ROAS = attributed revenue ÷ spend. A ROAS of 3x means every $1 invested returned $3 in attributed revenue — not in profit.",
    s4P2: "If you've configured your profit margin in account settings, AdBrief computes your break-even line automatically: break-even = 100 ÷ margin%. A 30% margin → break-even of 3.33x. ROAS below the line shows in red (destroying margin); above it, green. With no margin configured, the number stays neutral.",
    s4P3: "5% tolerance near the line — so the number doesn't flicker red/green from natural jitter.",
    s5Title: "5. CPA",
    s5P1: "CPA = spend ÷ conversions. Conversions here mean the event you marked as the account's goal (purchase, lead, subscription, etc.). If you haven't configured an event, we count any conversion signal the pixel reported — better than assuming purchase and showing zero when your funnel is lead-based.",
    s5P2: "For each event, we sum all related action types (web pixel, server-side via CAPI, onsite). This avoids the common problem of infinite CPA or zero counts when the pixel fires the same event through more than one path.",
    s6Title: "6. What's NOT included",
    s6Items: [
      "Real revenue (from checkout): we use the conversion value Meta attributed, not what hit your Stripe / Shopify / ERP. If there are refunds, chargebacks, or differences between cart and confirmed payment, ROAS here is optimistic by nature.",
      "Taxes, shipping, and operational costs: ROAS is gross attributed revenue. Margin (and by extension break-even) is your input — adjust it under Account if your operational cost changes.",
      "Offline sales or sales through other channels: only what Meta can attribute via pixel/CAPI counts. Sales via WhatsApp, referrals, organic return after the ad — not here.",
      "Conversions outside the window: a purchase that happened 14 days after the click doesn't count (the default window is 7d click + 1d view).",
      "Metrics from other platforms: Google Ads and TikTok Ads aren't yet integrated in the unified view — Meta only at the moment.",
    ],
    s7Title: "7. How to audit",
    s7Items: [
      "Open Meta Ads Manager and select the same account.",
      "Apply the same period that's in AdBrief (visible in the top of the dashboard).",
      "Under Compare attribution, confirm it's set to 7-day click + 1-day view.",
      "Compare spend, impressions, clicks, conversions, and conversion value. Differences larger than 1-2 cents usually come from: conversion lag (if the period includes the last 72h), or custom attribution on your account.",
    ],
    cta: "Found an odd number?",
    ctaP: "Send it our way — tell us what you expected, what you saw, and the period. We treat every discrepancy as a bug. Email: hello@adbrief.pro.",
    pricingLink: "Pricing",
    privacyLabel: "Privacy",
    termsLabel: "Terms",
    methodologyLabel: "Methodology",
  },
  es: {
    title: "Cómo calculamos los números — AdBrief",
    metaDesc: "Cómo AdBrief calcula ROAS, CPA, gasto y otras métricas de Meta Ads. Fuente de datos, ventana de atribución, lag de conversión y qué no está incluido.",
    lastUpdated: "Última actualización: 29 de abril de 2026",
    intro: "Esta página explica de dónde vienen los números que ves en AdBrief (ROAS, CPA, gasto, conversiones), qué tan exactos son, y qué NO está incluido. Si necesitas cruzar con contabilidad o auditar una decisión, empieza aquí.",
    s1Title: "1. Fuente de los datos",
    s1P1: "Todas las métricas de campaña (gasto, impresiones, clics, CTR, CPM, CPC, frecuencia, conversiones y valor de conversión) vienen de la Meta Ads API v21.0, a través del endpoint /insights. No inventamos números: si una métrica aparece aquí, Meta la devolvió.",
    s1P2: "Puedes auditar cualquier número abriendo Meta Ads Manager y aplicando el mismo período + ventana de atribución que está visible en AdBrief — los valores deben coincidir hasta los centavos.",
    s2Title: "2. Ventana de atribución",
    s2P1: "Por defecto usamos la ventana estándar de Meta: 7 días clic + 1 día visualización. Esto significa que una compra se atribuye a un anuncio si ocurrió hasta 7 días después de un clic, o hasta 1 día después de una visualización (sin clic). Es la misma ventana que aparece en Ads Manager por defecto.",
    s2P2: "Si tu cuenta se configuró para otra ventana, AdBrief respeta lo que Meta devuelve. La etiqueta en el pie de las métricas muestra la ventana en uso.",
    s3Title: "3. Lag de conversión",
    s3P1: "Las conversiones de los últimos 3 días aún pueden crecer. Meta sigue atribuyendo compras que ocurrieron dentro de la ventana de 7d clic hasta 72h después. En la práctica esto significa que el ROAS de hoy y ayer tiende a subir mientras las conversiones llegan — suele ser entre 5% y 20%, pero depende mucho de tu embudo.",
    s3P2: "Cuando el período visible en el panel incluye esos últimos 3 días, mostramos un aviso pequeño debajo de los KPIs. No es un bug: es Meta finalizando la atribución.",
    s4Title: "4. ROAS y la línea de break-even",
    s4P1: "ROAS = ingresos atribuidos ÷ gasto. Un ROAS de 3x significa que cada $1 invertido devolvió $3 en ingresos atribuidos — no en ganancia.",
    s4P2: "Si configuraste tu margen de ganancia en los ajustes de la cuenta, AdBrief calcula tu línea de break-even automáticamente: break-even = 100 ÷ margen%. Margen de 30% → break-even de 3,33x. ROAS por debajo de la línea aparece en rojo (destruyendo margen); por encima, verde. Sin margen configurado, el número queda neutro.",
    s4P3: "Tolerancia del 5% cerca de la línea — para que el número no parpadee rojo/verde por jitter natural.",
    s5Title: "5. CPA",
    s5P1: "CPA = gasto ÷ conversiones. Conversiones aquí significan el evento que marcaste como objetivo de la cuenta (compra, lead, suscripción, etc.). Si no configuraste un evento, contamos cualquier señal de conversión que el pixel reportó — mejor que asumir compra y mostrar cero cuando tu embudo es de lead.",
    s5P2: "Para cada evento, sumamos todos los tipos de acción relacionados (pixel web, server-side vía CAPI, onsite). Esto evita el problema común de CPA infinito o conteo en cero cuando el pixel dispara el mismo evento por más de un camino.",
    s6Title: "6. Qué NO está incluido",
    s6Items: [
      "Ingresos reales (del checkout): usamos el valor de conversión que Meta atribuyó, no lo que entró en tu Stripe / Shopify / ERP. Si hay reembolsos, contracargos, o diferencias entre carrito y pago confirmado, el ROAS aquí es optimista por naturaleza.",
      "Impuestos, envío y costos operacionales: ROAS es ingreso bruto atribuido. Margen (y por consecuencia break-even) es tu input — ajústalo en Cuenta si cambia el costo operacional.",
      "Ventas offline o por otros canales: solo entra lo que Meta puede atribuir vía pixel/CAPI. Ventas por WhatsApp, referidos, retorno orgánico después del anuncio — no están aquí.",
      "Conversiones fuera de la ventana: una compra que ocurrió 14 días después del clic no cuenta (la ventana por defecto es 7d clic + 1d view).",
      "Métricas de otras plataformas: Google Ads y TikTok Ads aún no están integradas en la vista unificada — solo Meta por ahora.",
    ],
    s7Title: "7. Cómo puedes auditar",
    s7Items: [
      "Abre Meta Ads Manager y selecciona la misma cuenta.",
      "Aplica el mismo período que está en AdBrief (visible en la parte superior del panel).",
      "En Comparar atribución, confirma que esté en 7 días clic + 1 día visualización.",
      "Compara gasto, impresiones, clics, conversiones y valor de conversión. Diferencias mayores a 1-2 centavos suelen venir de: lag de conversión (si el período incluye las últimas 72h), o atribución personalizada en tu cuenta.",
    ],
    cta: "¿Encontraste un número raro?",
    ctaP: "Envíalo — dinos qué esperabas ver, qué viste, y el período. Tratamos cada divergencia como un bug. Email: hello@adbrief.pro.",
    pricingLink: "Pricing",
    privacyLabel: "Privacidad",
    termsLabel: "Términos",
    methodologyLabel: "Metodología",
  },
};

const Metodologia = () => {
  const { language } = useLanguage();
  const lang: Lang = language === "en" ? "en" : language === "es" ? "es" : "pt";
  const t = COPY[lang];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.metaDesc} />
        <link rel="canonical" href="https://adbrief.pro/metodologia" />
      </Helmet>

      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo size="lg" /></Link>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.pricingLink}</Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{t.title.split(" — ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{t.lastUpdated}</p>
          <p className="text-base text-muted-foreground leading-relaxed">{t.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s1Title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s1P1}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s1P2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s2Title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s2P1}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s2P2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s3Title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s3P1}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s3P2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s4Title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s4P1}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s4P2}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s4P3}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s5Title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s5P1}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.s5P2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s6Title}</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground leading-relaxed">
            {t.s6Items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.s7Title}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground leading-relaxed">
            {t.s7Items.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        </section>

        <section className="space-y-3 border-t border-border/50 pt-8">
          <h2 className="text-xl font-semibold">{t.cta}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t.ctaP.split("hello@adbrief.pro").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <a href="mailto:hello@adbrief.pro" className="text-primary hover:underline">hello@adbrief.pro</a>
                )}
              </span>
            ))}
          </p>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-background/60 py-8 mt-16">
        <div className="container mx-auto max-w-3xl px-6 text-xs text-muted-foreground flex flex-wrap gap-4 justify-between">
          <span>© 2026 AdBrief</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">{t.privacyLabel}</Link>
            <Link to="/terms" className="hover:text-foreground">{t.termsLabel}</Link>
            <Link to="/metodologia" className="hover:text-foreground">{t.methodologyLabel}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Metodologia;
