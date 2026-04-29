/**
 * /metodologia — public methodology page.
 *
 * Why this exists: every customer-facing money KPI (ROAS, CPA, spend) on
 * AdBrief carries a small DataSourceFooter that links here. The footer
 * tells the user *that* the number comes from Meta with a 7-day click +
 * 1-day view attribution; this page tells them *why*, *what's not
 * included*, and *how they can verify*. Keeping it as a single, public,
 * static page means we can link it from anywhere (dashboard, marketing
 * site, support replies) without auth gating.
 *
 * The content is deliberately blunt: numbers can be off, here's by how
 * much and why. Trust earned by being upfront beats trust claimed by
 * marketing copy.
 */
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const Metodologia = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Como calculamos os números — AdBrief</title>
      <meta name="description" content="Como o AdBrief calcula ROAS, CPA, gasto e outras métricas de Meta Ads. Fonte dos dados, janela de atribuição, lag de conversão e o que não está incluído." />
      <link rel="canonical" href="https://adbrief.pro/metodologia" />
    </Helmet>

    <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/"><Logo size="lg" /></Link>
        <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </nav>

    <main className="container mx-auto max-w-3xl px-6 py-16 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Como calculamos os números</h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: 29 de abril de 2026
        </p>
        <p className="text-base text-muted-foreground leading-relaxed">
          Esta página explica de onde vêm os números que você vê no AdBrief
          (ROAS, CPA, gasto, conversões), em que medida eles são exatos, e
          o que <em>não</em> está incluído. Se você precisa cruzar com
          contabilidade ou auditar uma decisão, comece por aqui.
        </p>
      </header>

      {/* ── 1. Source ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Fonte dos dados</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Todas as métricas de campanha (gasto, impressões, cliques, CTR, CPM,
          CPC, frequência, conversões e valor de conversão) vêm da{" "}
          <strong className="text-foreground">Meta Ads API v21.0</strong>,
          através do endpoint <code className="px-1 py-0.5 rounded bg-muted/50 text-xs">/insights</code>.
          Não inventamos números: se uma métrica aparece aqui, ela foi
          retornada pela própria Meta.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Você pode auditar qualquer número abrindo o Ads Manager da Meta e
          aplicando o mesmo período + janela de atribuição que está visível
          no AdBrief — os valores devem bater dentro de centavos.
        </p>
      </section>

      {/* ── 2. Attribution window ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Janela de atribuição</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Por padrão usamos a janela padrão da Meta:{" "}
          <strong className="text-foreground">7 dias clique + 1 dia visualização</strong>.
          Isso significa que uma compra é atribuída a um anúncio se ela
          aconteceu até 7 dias depois de um clique, ou até 1 dia depois de
          uma visualização (sem clique). É a mesma janela que aparece no
          Ads Manager por padrão — escolhemos essa para que os números
          batam direto.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Se a sua conta foi configurada para outra janela, o AdBrief
          respeita o que a Meta retorna. O rótulo no rodapé das métricas
          mostra a janela em uso.
        </p>
      </section>

      {/* ── 3. Conversion lag ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Lag de conversão</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conversões dos últimos 3 dias <strong className="text-foreground">ainda
          podem crescer</strong>. A Meta continua atribuindo compras que
          aconteceram dentro da janela de 7d clique até 72h depois. Na
          prática isso significa que o ROAS de "hoje" e "ontem" tende a
          subir conforme as conversões pingam — costuma ser entre 5% e 20%,
          mas depende muito do seu funil.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Quando o período visível no painel inclui esses últimos 3 dias,
          mostramos um aviso pequeno embaixo dos KPIs. Não é um bug: é a
          Meta finalizando a atribuição.
        </p>
      </section>

      {/* ── 4. ROAS & break-even ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. ROAS e a linha de break-even</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ROAS = receita atribuída ÷ gasto. Um ROAS de 3x quer dizer que
          cada R$1 investido retornou R$3 em receita atribuída — não em
          lucro.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Se você configurou a sua margem de lucro nas configurações da
          conta, o AdBrief calcula a sua{" "}
          <strong className="text-foreground">linha de break-even</strong>{" "}
          automaticamente: <code className="px-1 py-0.5 rounded bg-muted/50 text-xs">break-even = 100 ÷ margem%</code>.
          Margem de 30% → break-even de 3,33x. ROAS abaixo da linha aparece
          em vermelho (está destruindo margem); acima, em verde. Sem
          margem configurada, o número fica neutro.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tolerância de 5% perto da linha — pra evitar que o número fique
          piscando vermelho/verde por jitter natural.
        </p>
      </section>

      {/* ── 5. CPA ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. CPA</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          CPA = gasto ÷ conversões. Conversões aqui significam o evento
          que você marcou como objetivo da conta (compra, lead,
          assinatura, etc.). Se você não configurou um evento, contamos
          qualquer sinal de conversão que o pixel reportou — é melhor que
          assumir "compra" e mostrar zero quando seu funil é de lead.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para cada evento, somamos todos os tipos de ação relacionados
          (pixel web, server-side via CAPI, onsite). Isso evita o problema
          comum de CPA "infinito" ou contagem zerada quando o pixel
          dispara o mesmo evento por mais de um caminho.
        </p>
      </section>

      {/* ── 6. What's NOT included ─────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. O que NÃO está incluído</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Receita real (do checkout):</strong>{" "}
            usamos o valor de conversão que a Meta atribuiu, não o que
            entrou na sua Stripe / Shopify / ERP. Se houver reembolso,
            chargeback, ou diferença entre carrinho e pagamento confirmado,
            o ROAS aqui é otimista por natureza.
          </li>
          <li>
            <strong className="text-foreground">Iimpostos, frete e custos operacionais:</strong>{" "}
            ROAS é receita bruta atribuída. Margem (e por consequência
            break-even) é a sua entrada — ajuste em "Conta" se mudar o
            custo operacional.
          </li>
          <li>
            <strong className="text-foreground">Vendas off-line ou por outros canais:</strong>{" "}
            só entra o que a Meta consegue atribuir via pixel/CAPI. Vendas
            por WhatsApp, indicação, retorno orgânico depois do anúncio —
            não estão aqui.
          </li>
          <li>
            <strong className="text-foreground">Conversões fora da janela:</strong>{" "}
            uma compra que aconteceu 14 dias depois do clique não conta
            (a janela padrão é 7d clique + 1d view).
          </li>
          <li>
            <strong className="text-foreground">Métricas de outras plataformas:</strong>{" "}
            Google Ads e TikTok Ads ainda não estão integrados na visão
            unificada — só Meta no momento.
          </li>
        </ul>
      </section>

      {/* ── 7. How to verify ───────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Como você pode auditar</h2>
        <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            Abra o <strong className="text-foreground">Meta Ads Manager</strong> e
            selecione a mesma conta.
          </li>
          <li>
            Aplique o <strong className="text-foreground">mesmo período</strong> que
            está no AdBrief (visível no canto superior do painel).
          </li>
          <li>
            Em "Comparar atribuição", confirme que está em{" "}
            <strong className="text-foreground">7 dias clique + 1 dia visualização</strong>.
          </li>
          <li>
            Compare gasto, impressões, cliques, conversões e valor de
            conversão. Diferenças maiores que 1-2 centavos costumam vir
            de: lag de conversão (se o período inclui as últimas 72h), ou
            atribuição customizada na sua conta.
          </li>
        </ol>
      </section>

      {/* ── 8. Found a discrepancy? ────────────────────────────────── */}
      <section className="space-y-3 border-t border-border/50 pt-8">
        <h2 className="text-xl font-semibold">Encontrou um número estranho?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manda pra gente — fala o que esperava ver, o que viu, e o
          período. Tratamos cada divergência como bug. Email:{" "}
          <a href="mailto:hello@adbrief.pro" className="text-primary hover:underline">
            hello@adbrief.pro
          </a>
          .
        </p>
      </section>
    </main>

    <footer className="border-t border-border/50 bg-background/60 py-8 mt-16">
      <div className="container mx-auto max-w-3xl px-6 text-xs text-muted-foreground flex flex-wrap gap-4 justify-between">
        <span>© 2026 AdBrief</span>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/metodologia" className="hover:text-foreground">Metodologia</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default Metodologia;
