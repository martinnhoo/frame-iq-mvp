/**
 * AdBrief — Prerender (Node ESM, no external deps)
 *
 * Generates static SEO HTML for top BOFU routes after `vite build`.
 * Reads dist/index.html as shell, substitutes per-page meta + body,
 * writes dist/<route>/index.html. Vercel serves the static file directly
 * when present; React still hydrates on top.
 *
 * Self-contained — no imports of TypeScript files. The 16 hand-tuned
 * BOFU routes below cover ~80% of search intent for AdBrief's BR audience.
 * Auto-generation from seoData.ts can be added later if/when build infra
 * supports tsx properly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHELL_PATH = path.join(DIST, "index.html");
const SITE_URL = "https://adbrief.pro";

if (!fs.existsSync(SHELL_PATH)) {
  console.error(`[prerender] dist/index.html not found at ${SHELL_PATH}.`);
  process.exit(1);
}
const SHELL = fs.readFileSync(SHELL_PATH, "utf-8");

function safe(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFallbackBody(meta) {
  const bcHTML = meta.breadcrumb && meta.breadcrumb.length
    ? `<nav style="font-size:13px;color:#666;margin-bottom:16px" aria-label="Breadcrumb">${meta.breadcrumb
        .map((b, i) => `${i > 0 ? " · " : ""}<a href="${b.href}" style="color:#2563eb;text-decoration:none">${safe(b.label)}</a>`)
        .join("")}</nav>`
    : "";

  const relatedHTML = meta.related && meta.related.length
    ? `<section style="margin-top:48px;padding-top:24px;border-top:1px solid #eee">
         <h2 style="font-size:18px;font-weight:700;margin:0 0 16px">Conteúdo relacionado</h2>
         <ul style="list-style:none;padding:0;margin:0;display:grid;gap:8px">
           ${meta.related.map((r) => `<li><a href="/${r.path}" style="color:#2563eb;text-decoration:none">→ ${safe(r.label)}</a></li>`).join("")}
         </ul>
       </section>`
    : "";

  // Same flash-prevention as index.html: hidden by default, revealed only
  // if React doesn't hydrate within 2.5s. SEO crawlers parse the static
  // content from the DOM; users with JS never see the fallback flicker
  // because real hydration lands in 200-500ms.
  return `
    <main id="adbrief-ssr-fallback" style="opacity:0;visibility:hidden;font-family:'Inter',system-ui,sans-serif;max-width:780px;margin:48px auto;padding:0 24px;color:#0a0c10;line-height:1.65">
      ${bcHTML}
      <h1 style="font-size:36px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px">${safe(meta.h1)}</h1>
      <p style="font-size:18px;color:#444;margin:0 0 24px">${safe(meta.description)}</p>
      <div style="font-size:16px;color:#222">${meta.body}</div>
      <p style="margin:32px 0">
        <a href="/signup" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Começar teste grátis de 3 dias</a>
      </p>
      ${relatedHTML}
    </main>
  `;
}

function renderSchema(schema) {
  if (!schema) return "";
  const arr = Array.isArray(schema) ? schema : [schema];
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": arr }, null, 2)}</script>`;
}

function buildPageHTML(meta) {
  const url = `${SITE_URL}/${meta.path}`;
  let html = SHELL;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${safe(meta.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${safe(meta.description)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${safe(meta.title)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${safe(meta.description)}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${safe(meta.title)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${safe(meta.description)}" />`);

  const fallback = renderFallbackBody(meta);
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<script type="module"/,
    `<div id="root">${fallback}</div>\n    <script type="module"`
  );

  if (meta.schema) {
    const schemaTag = renderSchema(meta.schema);
    html = html.replace(/<\/head>/, `    ${schemaTag}\n  </head>`);
  }

  return html;
}

function writePage(meta) {
  const html = buildPageHTML(meta);
  const dir = path.join(DIST, meta.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
}

// ── Hand-tuned BOFU routes ────────────────────────────────────────────────
const ROUTES = [
  // ROOT — keep landing index.html as-is, but rewrite for canonical
  // (skipping — root is already at dist/index.html)

  // PRICING
  {
    path: "pricing",
    title: "Preços AdBrief — Planos a partir de R$ 49/mês · Teste 3 dias grátis",
    description:
      "Planos do AdBrief: Free, Maker, Pro e Studio. IA para Meta Ads que diz onde está vazando R$ na sua conta. Cancela quando quiser. Comece grátis.",
    h1: "Preços do AdBrief",
    body: `
      <p>O AdBrief tem 4 planos: <strong>Free</strong> pra explorar, <strong>Maker</strong> (R$ 49/mês) pra autônomos com 1 conta, <strong>Pro</strong> (R$ 149/mês) pra gestores com até 3 contas, e <strong>Studio</strong> (R$ 349/mês) pra agências com contas ilimitadas. Todos os planos pagos incluem teste grátis de 3 dias — sem cartão pra começar.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">O que está incluído</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Diagnóstico causal automático (criativo cansado, audience errada, fadiga, CPA alto)</li>
        <li>Plano de ação em PT direto, sem dashboard genérico</li>
        <li>Pause/scale com 1 clique (com confirmação)</li>
        <li>Aprendizado contínuo: cada decisão melhora as próximas recomendações</li>
        <li>Integração nativa com Meta Marketing API v21</li>
      </ul>
      <p>Cancela quando quiser. Sem fidelidade. Sem cobrança escondida. Plano mensal cobrado mês a mês.</p>
    `,
    related: [
      { path: "compare/adbrief-vs-adspy", label: "AdBrief vs AdSpy" },
      { path: "compare/adbrief-vs-bigspy", label: "AdBrief vs BigSpy" },
      { path: "tools/ad-creative-analyzer", label: "Analisador de Criativos" },
      { path: "faq", label: "Perguntas Frequentes" },
    ],
    schema: {
      "@type": "Product",
      name: "AdBrief",
      description: "IA para Meta Ads — diagnóstico causal de conta com plano de ação em PT",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "BRL" },
        { "@type": "Offer", name: "Maker", price: "49", priceCurrency: "BRL", priceValidUntil: "2027-12-31" },
        { "@type": "Offer", name: "Pro", price: "149", priceCurrency: "BRL", priceValidUntil: "2027-12-31" },
        { "@type": "Offer", name: "Studio", price: "349", priceCurrency: "BRL", priceValidUntil: "2027-12-31" },
      ],
    },
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Preços", href: "/pricing" }],
  },

  // FAQ
  {
    path: "faq",
    title: "FAQ AdBrief — Perguntas Frequentes sobre IA para Meta Ads",
    description:
      "Tudo o que você precisa saber sobre AdBrief: como funciona, quanto custa, é seguro conectar a Meta, posso cancelar, e mais.",
    h1: "Perguntas Frequentes",
    body: `
      <h2 style="font-size:20px;margin:24px 0 8px">O AdBrief é uma agência ou ferramenta?</h2>
      <p>Ferramenta. AdBrief é um software (IA) que se conecta à sua conta do Meta Ads e gera análises automáticas. Você continua sendo o gestor — o AdBrief é o senior media buyer que olha tua conta 24/7 e te avisa quando algo está vazando R$.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">É seguro conectar minha conta da Meta?</h2>
      <p>Sim. AdBrief usa OAuth oficial da Meta — você autoriza apenas o que precisamos (leitura de campanhas, criação de mudanças que VOCÊ aprovar). Pode revogar acesso a qualquer momento direto na Meta. Não armazenamos sua senha.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Funciona pra qualquer nicho?</h2>
      <p>Sim — AdBrief lê dados reais da sua conta independente de nicho (e-commerce, info-produto, lead gen, agência, SaaS, clínica, etc). A IA aprende as particularidades do seu setor com o tempo.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Quanto demora pra ter o primeiro insight?</h2>
      <p>Em média 2 minutos. Você conecta a conta Meta, AdBrief lê os últimos 30 dias, e te entrega o diagnóstico inicial completo. Não precisa configurar nada.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Posso cancelar quando quiser?</h2>
      <p>Sim. Sem multa, sem fidelidade. Cancela direto pelo dashboard. Acesso continua até o fim do ciclo pago.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">O AdBrief executa ações automaticamente?</h2>
      <p>Não sem sua aprovação. Toda mudança (pause, scale, ajuste de budget) requer 1 clique de confirmação seu. Você sempre tem o controle.</p>
    `,
    related: [
      { path: "pricing", label: "Preços e Planos" },
      { path: "tools/ad-creative-analyzer", label: "Analisador de Criativos" },
      { path: "compare/adbrief-vs-adspy", label: "AdBrief vs AdSpy" },
    ],
    schema: {
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "O AdBrief é uma agência ou ferramenta?", acceptedAnswer: { "@type": "Answer", text: "Ferramenta. AdBrief é uma IA que conecta na sua conta do Meta Ads e analisa automaticamente." } },
        { "@type": "Question", name: "É seguro conectar minha conta da Meta?", acceptedAnswer: { "@type": "Answer", text: "Sim. AdBrief usa OAuth oficial da Meta. Pode revogar acesso a qualquer momento." } },
        { "@type": "Question", name: "Funciona pra qualquer nicho?", acceptedAnswer: { "@type": "Answer", text: "Sim — AdBrief lê dados reais da sua conta independente de nicho." } },
        { "@type": "Question", name: "Quanto demora pra ter o primeiro insight?", acceptedAnswer: { "@type": "Answer", text: "Em média 2 minutos após conectar a conta Meta." } },
        { "@type": "Question", name: "Posso cancelar quando quiser?", acceptedAnswer: { "@type": "Answer", text: "Sim. Sem multa, sem fidelidade. Cancela direto pelo dashboard." } },
      ],
    },
  },

  // BOFU LANDING — auditoria
  {
    path: "auditoria-meta-ads-ia",
    title: "Auditoria Meta Ads com IA — Diagnóstico em 2 minutos | AdBrief",
    description:
      "Auditoria completa da sua conta Meta Ads em 2 minutos. AdBrief identifica criativos cansados, audience errada, fadiga e oportunidades de escala — com plano de ação em PT.",
    h1: "Auditoria Meta Ads automática com IA",
    body: `
      <p>Auditar uma conta Meta na unha leva 4-8h por mês. AdBrief faz em <strong>2 minutos</strong> e roda continuamente em background, te avisando só quando algo realmente importa.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">O que a auditoria detecta</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Criativo cansado</strong> — frequência alta, CTR caindo, CPA subindo. Recomendação de pause + variação.</li>
        <li><strong>Audience errada</strong> — gasto sem retorno em segmentos específicos. Sugere consolidação ou troca.</li>
        <li><strong>Fadiga de público</strong> — mesma audience exposta demais. Sugere refresh ou expansão.</li>
        <li><strong>CPA alto</strong> — adsets gastando acima da meta. Diagnóstico causal: criativo, audience, ou bid?</li>
        <li><strong>Tracking quebrado</strong> — pixel não disparando, evento mal configurado, atribuição errada.</li>
        <li><strong>Oportunidades de escala</strong> — winners detectados antes do gestor ver. Sugestão de budget +X%.</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Como funciona</h2>
      <p>1. Conecta tua conta Meta via OAuth oficial (30s).<br>2. AdBrief lê os últimos 30 dias de dados.<br>3. IA aplica raciocínio causal sobre cada anúncio, adset e campanha.<br>4. Você recebe relatório priorizado com ação concreta pra cada problema.</p>
      <p>Não é dashboard de gráfico bonito. É auditor de tráfego rodando 24/7.</p>
    `,
    related: [
      { path: "tools/ad-creative-analyzer", label: "Analisador de Criativos" },
      { path: "tools/ad-hook-generator", label: "Gerador de Hooks" },
      { path: "pricing", label: "Preços" },
    ],
    schema: {
      "@type": "Service",
      name: "Auditoria Meta Ads com IA",
      provider: { "@type": "Organization", name: "AdBrief" },
      areaServed: "BR",
      description: "Auditoria automática e contínua de conta Meta Ads usando IA causal.",
    },
  },

  // BOFU LANDING — gestor de tráfego
  {
    path: "ferramenta-gestor-trafego-ia",
    title: "Ferramenta de IA pra Gestor de Tráfego — AdBrief",
    description:
      "Software de IA pra gestor de tráfego escalar contas Meta sem ficar refém de planilha. Diagnóstico causal, recomendações priorizadas, ação de 1 clique.",
    h1: "A ferramenta que todo gestor de tráfego deveria ter",
    body: `
      <p>Se você é gestor de tráfego rodando 3+ contas Meta, sabe que o gargalo não é executar — é <strong>decidir o que olhar primeiro</strong>. Cada conta tem 50+ adsets ativos. Olhar todos toda semana é impossível.</p>
      <p>AdBrief te dá uma camada de inteligência por cima de cada conta: ela olha o que você não consegue olhar, prioriza o que importa, e te entrega "isso aqui tá vazando R$X/dia, faz Y agora".</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Por que gestores escolhem AdBrief</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Linguagem de gestor</strong> — não precisa traduzir dashboard em inglês corporativo. PT direto, jargão do dia-a-dia.</li>
        <li><strong>Plano Pro inclui 3 contas</strong> — pra gestor solo ou pequena agência</li>
        <li><strong>Plano Studio sem limite de contas</strong> — pra agência com 10+ clientes</li>
        <li><strong>Aprende com você</strong> — cada decisão (pause, scale, ignore) treina o modelo pra próxima recomendação</li>
        <li><strong>Histórico completo</strong> — toda decisão fica registrada com causa, ação, e resultado medido em 24h/72h</li>
      </ul>
      <p>Você continua sendo o cérebro. AdBrief é o estagiário sênior que faz o trabalho de leitura de dados que toma teu sábado.</p>
    `,
    related: [
      { path: "auditoria-meta-ads-ia", label: "Auditoria Meta Ads com IA" },
      { path: "ferramenta-agencia-meta-ads", label: "AdBrief para Agências" },
      { path: "pricing", label: "Preços" },
    ],
    schema: {
      "@type": "SoftwareApplication",
      name: "AdBrief",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      audience: { "@type": "BusinessAudience", audienceType: "Gestor de Tráfego" },
    },
  },

  // BOFU LANDING — agência
  {
    path: "ferramenta-agencia-meta-ads",
    title: "Ferramenta IA pra Agência de Meta Ads — Gestão Multi-Conta | AdBrief",
    description:
      "Sua agência roda 5+ contas Meta? AdBrief detecta automaticamente o que tá vazando em cada uma delas, prioriza, e te dá o plano de ação semanal.",
    h1: "AdBrief pra Agências de Meta Ads",
    body: `
      <p>Agência de tráfego cresce até bater na parede de gestão. Com 10+ clientes, ninguém consegue olhar todas as contas com profundidade. O resultado é: clientes pequenos ficam abandonados, churn aumenta, gestor sênior vira bombeiro 50% do tempo.</p>
      <p>AdBrief resolve isso vigiando todas as contas em paralelo. Cada manhã você abre o painel e vê <strong>"essas 3 contas têm fogo pra apagar agora, essas 7 estão estáveis"</strong>. Sem perder nada importante.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Plano Studio — contas ilimitadas</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Conecte quantas contas Meta quiser, sem limite</li>
        <li>Painel consolidado com priorização cross-conta</li>
        <li>Histórico de decisões por cliente (rastreabilidade)</li>
        <li>Relatórios prontos pra mandar pro cliente todo mês</li>
        <li>R$ 349/mês — pague menos que 1h de gestor sênior por mês</li>
      </ul>
      <p>Pra agências de 5-50 clientes Meta. Acima disso, fala direto comigo pra plano enterprise.</p>
    `,
    related: [
      { path: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego Solo" },
      { path: "auditoria-meta-ads-ia", label: "Auditoria Meta Ads" },
      { path: "pricing", label: "Preços" },
    ],
  },

  // BOFU — comparison
  {
    path: "alternativa-adspy",
    title: "Alternativa ao AdSpy em Português — AdBrief",
    description:
      "Procurando alternativa ao AdSpy que funcione com a sua conta Meta real (não só biblioteca pública)? AdBrief faz diagnóstico causal e plano de ação em PT.",
    h1: "AdBrief: alternativa ao AdSpy focada na sua conta, não na biblioteca pública",
    body: `
      <p>AdSpy é uma biblioteca de anúncios — mostra o que outras pessoas estão rodando. Útil pra inspiração de criativo, mas não te diz o que fazer na <strong>SUA conta</strong>.</p>
      <p>AdBrief é o oposto: foca 100% nos seus dados reais. Lê tudo que tá ativo na sua Meta, identifica o que tá vazando R$, e te dá o plano de ação. É auditor + estrategista, não banco de dados.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Quando AdBrief é melhor que AdSpy</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Você já roda Meta e quer otimizar (não pesquisar inspiração)</li>
        <li>Precisa de explicação em PT, não interface gringa</li>
        <li>Quer ação executável, não só dado</li>
        <li>Quer pagar em real, não dólar (AdSpy é US$ 149/mês mínimo)</li>
      </ul>
      <p>Pricing: AdSpy começa em <strong>US$ 149/mês</strong>. AdBrief em <strong>R$ 49/mês</strong> — 5x mais barato pra mesma faixa de público.</p>
    `,
    related: [
      { path: "alternativa-bigspy", label: "Alternativa ao BigSpy" },
      { path: "alternativa-minea", label: "Alternativa ao Minea" },
      { path: "pricing", label: "Preços do AdBrief" },
    ],
  },

  // BOFU — comparison BigSpy
  {
    path: "alternativa-bigspy",
    title: "Alternativa ao BigSpy em Português — AdBrief vs BigSpy",
    description:
      "BigSpy mostra anúncios dos outros. AdBrief otimiza os seus. Veja por que gestores BR estão migrando pra a alternativa em PT que custa metade.",
    h1: "Alternativa ao BigSpy: AdBrief otimiza sua conta, não copia o concorrente",
    body: `
      <p>BigSpy é spy tool — banco de anúncios pra você ver o que concorrente roda. Útil pra inspiração, mas não tem nada a ver com performance real na sua conta. Você ainda precisa de outra ferramenta pra otimizar.</p>
      <p>AdBrief faz a outra ponta: conecta na tua conta Meta, lê os dados reais, e te diz o que fazer. Não te mostra anúncio de ninguém — te mostra o que tá vazando dinheiro NA TUA CONTA agora.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Diferenças práticas</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>BigSpy: banco de criativos. AdBrief: motor de decisão.</li>
        <li>BigSpy: US$ 99/mês mínimo. AdBrief: R$ 49/mês.</li>
        <li>BigSpy: interface em inglês. AdBrief: tudo em PT.</li>
        <li>BigSpy: você lê dados. AdBrief: você executa ações.</li>
      </ul>
      <p>Não são produtos competidores diretos — fazem coisas diferentes. Mas se você precisa escolher entre os dois pelo orçamento limitado, AdBrief tem ROI mais direto pra contas que já gastam R$ 1k+/mês.</p>
    `,
    related: [
      { path: "alternativa-adspy", label: "Alternativa ao AdSpy" },
      { path: "alternativa-minea", label: "Alternativa ao Minea" },
      { path: "pricing", label: "Preços" },
    ],
  },

  // BOFU — comparison Minea
  {
    path: "alternativa-minea",
    title: "Alternativa ao Minea em Português — AdBrief vs Minea",
    description:
      "Minea é spy tool gringa. AdBrief é IA que conecta na sua conta Meta e te dá diagnóstico em PT. Compare e escolha o que faz sentido pra você.",
    h1: "Alternativa ao Minea: optimizer brasileiro vs spy tool francês",
    body: `
      <p>Minea é boa pra dropshipping e descoberta de produto vencedor. Se você quer ver o que tá bombando no TikTok ads pra copiar, é uma boa escolha.</p>
      <p>AdBrief é diferente: é pra quem JÁ roda Meta Ads e quer parar de gastar errado. Conecta na conta, lê os dados, te diz o que pausar e o que escalar — com explicação em PT direto.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Quando escolher AdBrief</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Você gerencia conta Meta com gasto recorrente</li>
        <li>Quer otimizar (não descobrir produto)</li>
        <li>Precisa de plano de ação, não só dado</li>
        <li>Atende mercado BR e prefere PT</li>
      </ul>
      <p>Minea começa em €49/mês. AdBrief começa em R$ 49/mês — pagamento em real, sem cotação ou IOF.</p>
    `,
    related: [
      { path: "alternativa-adspy", label: "Alternativa ao AdSpy" },
      { path: "alternativa-bigspy", label: "Alternativa ao BigSpy" },
      { path: "pricing", label: "Preços" },
    ],
  },

  // BOFU LANDING — IA português
  {
    path: "ia-meta-ads-portugues",
    title: "IA pra Meta Ads em Português — AdBrief",
    description:
      "Primeira IA de Meta Ads pensada pro mercado brasileiro: diagnóstico em PT direto, sem tradução automática, com cases reais de gestores BR.",
    h1: "IA de Meta Ads em português, feita pro Brasil",
    body: `
      <p>A maioria das ferramentas de IA pra Meta Ads é gringa, traduzida com Google Translate, e fala "ROAS uplift" em vez de "lucro a mais". AdBrief foi construído em português, pensando em como gestor brasileiro fala e opera.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Por que isso importa</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Mercado BR é diferente</strong> — média de spend menor, perfil de oferta diferente, sazonalidade diferente. AdBrief calibra com base nisso.</li>
        <li><strong>Vocabulário direto</strong> — "esse criativo tá queimando R$87/dia" em vez de "ad creative showing -34% efficiency vs benchmark"</li>
        <li><strong>Suporte em PT</strong> — quando você precisa de ajuda, fala com gente que entende o mercado</li>
        <li><strong>Pagamento em real</strong> — sem dor de cabeça com cartão internacional, IOF, cotação</li>
      </ul>
      <p>AdBrief não é tradução. É produto desenhado de origem pra resolver a dor real do gestor BR.</p>
    `,
    related: [
      { path: "auditoria-meta-ads-ia", label: "Auditoria Meta Ads" },
      { path: "ferramenta-gestor-trafego-ia", label: "Ferramenta pra Gestor" },
      { path: "pricing", label: "Preços" },
    ],
  },

  // BOFU LONG-TAIL — como reduzir CPA
  {
    path: "como-reduzir-cpa-meta-ads",
    title: "Como Reduzir CPA no Meta Ads — Guia Prático com IA | AdBrief",
    description:
      "Passo a passo pra identificar e reduzir CPA alto no Meta Ads: criativo, audience, bid, tracking. Use IA pra diagnosticar a causa raiz em segundos.",
    h1: "Como reduzir CPA no Meta Ads (com diagnóstico de causa raiz)",
    body: `
      <p>CPA alto é sintoma. A causa pode ser: criativo cansado, audience errada, bid mal calibrado, tracking quebrado, ou oferta fraca. Sem identificar a causa raiz, qualquer ajuste é tiro no escuro.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Checklist diagnóstico</h2>
      <ol style="margin:0 0 16px;padding-left:24px">
        <li><strong>Frequência alta?</strong> Se freq &gt; 3 e CTR caindo: criativo cansado. Solução: pause + variação.</li>
        <li><strong>Audience saturada?</strong> Se reach plateau e CPC subindo: troca ou expande público.</li>
        <li><strong>CTR baixo desde o início?</strong> Hook ruim ou audience errada. A/B test de hook + targeting.</li>
        <li><strong>CTR ok mas CVR baixo?</strong> Problema é landing/oferta. Tráfego tá vindo, mas não converte.</li>
        <li><strong>Eventos não disparando?</strong> Tracking quebrado. Verificar pixel + Conversions API.</li>
        <li><strong>Bid mal calibrado?</strong> Se learning phase nunca termina: budget baixo demais ou audience pequena.</li>
      </ol>
      <p>AdBrief faz esse diagnóstico automaticamente em 2 minutos: lê tua conta, identifica qual dessas causas tá ativa, e te dá o plano de ação concreto.</p>
    `,
    related: [
      { path: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
      { path: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar sem perder ROAS" },
      { path: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
    ],
  },

  // BOFU LONG-TAIL — escalar
  {
    path: "como-escalar-meta-ads-sem-perder-roas",
    title: "Como Escalar Meta Ads sem Perder ROAS — Estratégia Comprovada",
    description:
      "Escalar campanha Meta sem destruir ROAS exige timing certo, audience certa, e estrutura certa. Aprenda o playbook + use IA pra detectar quando escalar.",
    h1: "Como escalar Meta Ads sem perder ROAS",
    body: `
      <p>Escalar Meta Ads é o momento mais delicado. Aumenta budget muito rápido = quebra learning phase, ROAS despenca. Aumenta lento demais = oportunidade passa.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Regras práticas</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Aumenta no máximo 20-30% por dia</strong> em adset rodando bem (CBO ou ABO).</li>
        <li><strong>Espera 48-72h pra avaliar resultado</strong> — Meta precisa reotimizar com novo budget.</li>
        <li><strong>Duplica em vez de aumentar</strong> — clone do adset com 2x budget mantém o original "limpo".</li>
        <li><strong>Diversifica audience</strong> — adset funcionando = base. Crie 2-3 lookalikes pra escalar sem saturar.</li>
        <li><strong>Refresh criativo a cada 2 semanas</strong> — mesmo criativo cansa rápido em escala.</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Quando AdBrief recomenda escalar</h2>
      <p>AdBrief detecta winners cedo (CTR consistente, CPA estável, frequência baixa) e te avisa: "esse adset tá pronto pra escalar +30%". Sem chute. Sem esperar Meta te dar a notícia 1 semana depois.</p>
    `,
    related: [
      { path: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
      { path: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
      { path: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },

  // BOFU LONG-TAIL — criativo cansado
  {
    path: "como-detectar-criativo-cansado",
    title: "Como Detectar Criativo Cansado no Meta Ads — Sinais e Soluções",
    description:
      "Criativo cansado é a causa #1 de CPA subindo. Aprenda a identificar pelos 4 sinais clássicos + descubra como AdBrief detecta antes de você.",
    h1: "Como detectar criativo cansado no Meta Ads",
    body: `
      <p>Quase todo gestor já passou: campanha rodava bem, do nada CPA subiu 50%. A causa mais comum é <strong>fadiga criativa</strong> — o público viu seu anúncio tantas vezes que parou de reagir.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">4 sinais de criativo cansado</h2>
      <ol style="margin:0 0 16px;padding-left:24px">
        <li><strong>Frequência > 3</strong> — pessoas viram o ad mais de 3x. Sinal forte de saturação.</li>
        <li><strong>CTR caindo dia a dia</strong> — quanto mais tempo no ar, menos cliques relativos.</li>
        <li><strong>CPM subindo sem motivo</strong> — Meta cobra mais pra mostrar criativo que não engaja.</li>
        <li><strong>Comments/likes secando</strong> — engajamento orgânico é leading indicator.</li>
      </ol>
      <h2 style="font-size:22px;margin:32px 0 12px">O que fazer</h2>
      <p>Pause o criativo cansado. Crie 2-3 variações novas (mesma oferta, hook diferente). Ative no mesmo adset. Manter o adset com budget acumulado é melhor que começar do zero.</p>
      <p>AdBrief detecta esses 4 sinais automaticamente e te avisa antes de você perder R$ esperando o relatório semanal. Recomendação vem priorizada por <strong>quanto tá queimando por dia</strong>.</p>
    `,
    related: [
      { path: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
      { path: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar sem perder ROAS" },
      { path: "tools/ad-creative-analyzer", label: "Analisador de Criativos" },
    ],
  },

  // BOFU REVIEW
  {
    path: "review-adbrief",
    title: "AdBrief Review — IA pra Meta Ads que Vale o Investimento? | 2026",
    description:
      "Review completo do AdBrief: o que faz bem, limitações, comparação com agência, ROI esperado e pra quem realmente vale a pena assinar.",
    h1: "AdBrief: review honesto da IA pra Meta Ads",
    body: `
      <p>O AdBrief é uma das primeiras IAs de Meta Ads pensadas pro mercado BR. Em vez de dashboard genérico ou copy de alunos do YouTube, ela conecta na sua conta real e gera diagnósticos causais em português direto.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Pontos fortes</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Velocidade</strong> — 2 min do conectar até primeiro insight útil</li>
        <li><strong>Linguagem</strong> — fala como gestor brasileiro (não tradução)</li>
        <li><strong>Razão causal</strong> — não diz só "X tá ruim", diz "X tá ruim porque Y, faz Z"</li>
        <li><strong>Preço</strong> — Maker R$ 49 / Pro R$ 149 / Studio R$ 349 — bem abaixo de gringas</li>
        <li><strong>Aprendizado</strong> — cada decisão tua treina o modelo</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Limitações honestas</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Foco em Meta Ads — não cobre Google Ads, TikTok Ads ainda</li>
        <li>Mercado BR — outros países podem ter calibração subótima</li>
        <li>Produto novo — base de dados ainda crescendo (cada user que entra fortalece)</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Pra quem vale</h2>
      <p>Vale se: você gasta R$ 1k+/mês em Meta, é gestor sozinho ou agência, e cansou de planilha. Não vale se: você ainda tá começando e tem só 1 conta pequena com R$ 200/mês — nesse caso, manual ainda é OK.</p>
    `,
    related: [
      { path: "pricing", label: "Preços" },
      { path: "alternativa-adspy", label: "Vs AdSpy" },
      { path: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },

  // BOFU SOFTWARE BRASIL
  {
    path: "melhor-software-meta-ads-brasil",
    title: "Melhor Software pra Meta Ads no Brasil em 2026 — AdBrief",
    description:
      "Comparativo dos melhores softwares de gestão de Meta Ads no Brasil em 2026. Por que AdBrief lidera em PT direto, preço justo e diagnóstico causal.",
    h1: "Melhor software pra Meta Ads no Brasil em 2026",
    body: `
      <p>Em 2026, gestor BR tem opções: ferramentas gringas (AdSpy, Minea, BigSpy) que custam US$, agências de tráfego que cobram R$ 3-10k/mês, ou planilha. Faltava uma opção brasileira de IA acessível.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Critérios pra escolher</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>Idioma</strong> — interface e suporte em PT diminui 80% da fricção</li>
        <li><strong>Pagamento em real</strong> — sem IOF, sem cotação flutuando</li>
        <li><strong>Conexão direta com Meta</strong> — não dá pra otimizar conta sem ler dados reais</li>
        <li><strong>Razão causal</strong> — dashboard genérico não substitui senior media buyer</li>
        <li><strong>Preço relativo</strong> — pagar R$ 49-349/mês faz sentido pra quem gasta R$ 1k+</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Por que AdBrief</h2>
      <p>AdBrief é o único software brasileiro de IA pra Meta Ads que combina: PT nativo, integração direta via Meta API, diagnóstico causal (não só dado), pagamento em real, e preço acessível pra gestor solo. Foi construído em 2025-2026 por gestor que vive a dor.</p>
    `,
    related: [
      { path: "review-adbrief", label: "Review AdBrief" },
      { path: "alternativa-adspy", label: "Vs AdSpy" },
      { path: "ia-meta-ads-portugues", label: "IA em PT" },
    ],
  },

  // BOFU DEMO
  {
    path: "demo",
    title: "Demo Interativa do AdBrief — Veja a IA Analisando uma Conta Real",
    description:
      "Demo interativa do AdBrief: clique pra ver como a IA analisa uma conta Meta de e-commerce real, com diagnóstico, recomendações e plano de ação.",
    h1: "Demo Interativa do AdBrief",
    body: `
      <p>Antes de criar conta e conectar tua Meta, você pode ver o AdBrief rodando numa conta de demonstração. Tudo real — só com nomes anonimizados.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">O que você vai ver na demo</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>10 anúncios sendo analisados em tempo real</li>
        <li>Diagnóstico causal de 3 problemas simultâneos</li>
        <li>Plano de ação priorizado por R$ economizado/dia</li>
        <li>Histórico de decisões anteriores com resultado medido</li>
        <li>Como o AdBrief aprende com cada ação executada</li>
      </ul>
      <p>Demo dura ~3 min. Depois disso, se fizer sentido, basta criar conta e conectar tua Meta — em 2 min você tem a versão "real" rodando na tua conta.</p>
    `,
    related: [
      { path: "pricing", label: "Preços" },
      { path: "review-adbrief", label: "Review" },
      { path: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },

  // BOFU PARA AGÊNCIA — multi-conta
  {
    path: "gestao-multi-conta-meta-ads",
    title: "Gestão Multi-Conta Meta Ads — Como Operar 10+ Clientes sem Quebrar",
    description:
      "Gerenciar 10+ contas Meta sozinho ou com pequena equipe é ladeira pra abandonar cliente. Veja como AdBrief consolida a operação multi-conta.",
    h1: "Gestão multi-conta Meta Ads sem perder o controle",
    body: `
      <p>Toda agência que cresce passa pelo mesmo gargalo: 5 clientes você dá conta, 10 fica difícil, 15+ você tá apagando incêndio o dia inteiro. A única saída até agora era contratar gestor sênior por R$ 8-15k/mês.</p>
      <p>AdBrief muda essa equação. Você conecta todas as contas, e o sistema te entrega painel consolidado com priorização cross-conta. Cliente que tá vazando R$ 200/dia aparece no topo, cliente estável fica em segundo plano.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Capacidades multi-conta</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Painel único com todas as contas priorizadas por urgência</li>
        <li>Histórico de decisões por cliente (rastreabilidade pra audit)</li>
        <li>Relatórios mensais prontos pra mandar pro cliente</li>
        <li>Alertas em tempo real quando algo crítico aparece</li>
        <li>Aprendizado consolidado entre contas similares</li>
      </ul>
      <p>Plano Studio — R$ 349/mês com contas ilimitadas. Substitui R$ 8k/mês de gestor sênior pra operação repetitiva.</p>
    `,
    related: [
      { path: "ferramenta-agencia-meta-ads", label: "AdBrief pra Agências" },
      { path: "ferramenta-gestor-trafego-ia", label: "Pra Gestor Solo" },
      { path: "pricing", label: "Preços" },
    ],
  },

  // ── ROUND 2: 12 ADDITIONAL BOFU PAGES ───────────────────────────────────
  {
    path: "ia-gratuita-meta-ads",
    title: "IA Gratuita pra Meta Ads — Teste 3 Dias sem Cartão | AdBrief",
    description: "Teste a IA do AdBrief de graça por 3 dias, sem cartão. Conecte sua conta Meta e veja em 2 minutos o que está vazando R$ na sua operação.",
    h1: "IA gratuita pra Meta Ads — teste antes de pagar",
    body: `<p>O AdBrief tem teste de 3 dias completamente gratuito — não pede cartão, não cobra renovação automática se você não confirmar.</p><h2>O que dá pra fazer no teste grátis</h2><ul><li>Conectar 1 conta Meta Ads via OAuth oficial</li><li>Receber diagnóstico causal completo dos últimos 30 dias</li><li>Ver recomendações priorizadas por R$ economizado/dia</li><li>Executar ações (pause, scale) com 1 clique de confirmação</li></ul><p>3 dias é tempo suficiente pra você ver valor real (primeiro insight em 2 min, validação em 24-72h).</p>`,
    related: [{ path: "auditoria-meta-ads-ia", label: "Auditoria com IA" }, { path: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" }],
  },
  {
    path: "como-criar-criativo-meta-ads-com-ia",
    title: "Como Criar Criativo Meta Ads com IA — Guia 2026 | AdBrief",
    description: "Use IA pra acelerar produção de criativo Meta Ads sem perder qualidade. Hooks, scripts, briefs — fluxo completo pra gestor que produz no volume.",
    h1: "Como criar criativo Meta Ads com IA (guia 2026)",
    body: `<p>Produzir criativo é gargalo em quase toda conta. Você precisa de 3-5 variações novas por semana pra evitar fadiga, mas editar vídeo do zero leva horas.</p><h2>Fluxo recomendado</h2><ol><li><strong>Hook (10 min)</strong> — gera 5-10 hooks com IA baseado em ângulos diferentes.</li><li><strong>Script (15 min)</strong> — pra cada hook escolhido, IA gera script de 30s.</li><li><strong>Brief de produção (5 min)</strong> — IA traduz script em board com cenas, ângulos, fala.</li><li><strong>Análise pós-publicação (2 min)</strong> — depois de 48h no ar, IA olha métricas.</li></ol><p>Tempo total do "ideia" ao "publicado": 1-2h em vez de 1-2 dias.</p>`,
    related: [{ path: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" }],
  },
  {
    path: "automatizar-gestao-meta-ads",
    title: "Como Automatizar Gestão de Meta Ads — Sem Perder Controle | AdBrief",
    description: "Automatize o que é repetitivo, mantenha controle no estratégico. Veja como AdBrief automatiza diagnóstico + ação sem virar piloto automático cego.",
    h1: "Como automatizar gestão de Meta Ads sem perder o controle",
    body: `<p>Automatizar Meta Ads é tentação grande. Mas automação burra (regras hardcoded "se CPA > X, pause") é receita pra quebrar campanha.</p><h2>O que automatizar (e o que NÃO)</h2><p><strong>Pode automatizar:</strong> diagnóstico (quem tá ruim e por quê), priorização, execução repetitiva.</p><p><strong>Não automatize:</strong> decisões estratégicas, decisões irreversíveis, aprovação final em conta de cliente grande.</p><h2>Como AdBrief automatiza com segurança</h2><ul><li>IA detecta problema → sugere ação → você aprova com 1 clique</li><li>Cada ação fica registrada com causa e resultado medido</li><li>Limites configuráveis</li></ul>`,
    related: [{ path: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" }],
  },
  {
    path: "alternativa-supermetrics-portugues",
    title: "Alternativa ao Supermetrics em Português — AdBrief",
    description: "Supermetrics extrai dados de Meta Ads pra planilhas. AdBrief vai além: lê os dados, diagnostica problemas e te diz o que fazer.",
    h1: "Alternativa ao Supermetrics: AdBrief lê os dados E te diz o que fazer",
    body: `<p>Supermetrics é ETL de marketing — pega dados de Meta, Google, TikTok e bota em Sheets/BigQuery. Útil pra reporting custom, mas você ainda precisa olhar a planilha e decidir manualmente.</p><p>AdBrief é a camada acima: ele JÁ lê os dados (não precisa exportar) e gera análise + recomendação direto.</p><h2>Quando AdBrief substitui Supermetrics</h2><ul><li>Você só usa Supermetrics pra reportar Meta Ads</li><li>Você precisa de "o que fazer" mais que "número exportado"</li><li>Quer pagar em real, em PT (Supermetrics é US$ 39/mês mínimo)</li></ul>`,
    related: [{ path: "alternativa-adspy", label: "Vs AdSpy" }],
  },
  {
    path: "alternativa-triple-whale-brasil",
    title: "Alternativa ao Triple Whale no Brasil — AdBrief",
    description: "Triple Whale é gringo, em dólar, focado em Shopify. AdBrief é brasileiro, em real, focado em Meta Ads de gestor BR.",
    h1: "Alternativa ao Triple Whale: AdBrief é Meta-first, BR-first",
    body: `<p>Triple Whale é excelente pra DTC US-based em Shopify. Mas é caro (US$ 100+/mês), gringo, e foca DTC e-commerce.</p><p>AdBrief é diferente: foca exclusivamente em Meta Ads, em PT, pagamento em real, pra qualquer nicho.</p><h2>Comparativo</h2><ul><li>Foco: Triple Whale = DTC e-commerce. AdBrief = Meta Ads pra gestor/agência BR</li><li>Preço: Triple Whale = US$ 100+/mês. AdBrief = R$ 49-349/mês</li><li>Idioma: Triple Whale = inglês. AdBrief = PT nativo</li></ul>`,
    related: [{ path: "alternativa-supermetrics-portugues", label: "Vs Supermetrics" }],
  },
  {
    path: "como-saber-se-anuncio-cansou",
    title: "Como Saber se Anúncio Cansou no Meta Ads — Guia 2026",
    description: "4 sinais práticos pra identificar fadiga criativa no Meta Ads antes do CPA disparar. Frequência, CTR, CPM, engajamento.",
    h1: "Como saber se seu anúncio cansou no Meta Ads",
    body: `<p>"Anúncio cansado" é jargão de gestor pra criativo que parou de funcionar. Tem 4 sinais cristalinos pra detectar antes do estrago.</p><h2>Os 4 sinais clássicos</h2><ol><li><strong>Frequência > 3</strong> — cada exposição extra rende menos</li><li><strong>CTR caindo dia a dia</strong> — em 7-10 dias, se CTR caiu 30%+, é fadiga</li><li><strong>CPM subindo</strong> — Meta cobra mais quando criativo não engaja</li><li><strong>Comments/likes orgânicos secando</strong> — leading indicator forte</li></ol><p>AdBrief monitora os 4 sinais 24/7 e te avisa quando passa do limiar.</p>`,
    related: [{ path: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" }],
  },
  {
    path: "diagnostico-conta-meta-ads-gratis",
    title: "Diagnóstico Grátis da Sua Conta Meta Ads — AdBrief",
    description: "Diagnóstico completo da sua conta Meta Ads em 2 minutos, gratuito por 3 dias. Conecte a conta e descubra o que está vazando R$.",
    h1: "Diagnóstico grátis da sua conta Meta Ads",
    body: `<p>Conhece a sensação de olhar o dashboard do Meta e não saber por onde começar? AdBrief faz o diagnóstico em 2 minutos.</p><h2>O diagnóstico inclui</h2><ul><li>Health score geral da conta</li><li>Anúncios que estão queimando R$/dia, priorizados por impacto</li><li>Adsets com fadiga ou audience errada</li><li>Oportunidades de escala — winners detectados precocemente</li><li>Problemas de tracking</li><li>Plano de ação priorizado por R$</li></ul>`,
    related: [{ path: "auditoria-meta-ads-ia", label: "Auditoria detalhada" }, { path: "ia-gratuita-meta-ads", label: "Teste 3 dias grátis" }],
  },
  {
    path: "agencia-trafego-pago-quanto-cobrar-2026",
    title: "Quanto Cobrar como Agência de Tráfego Pago em 2026 — Guia Real",
    description: "Tabela atualizada de quanto agências brasileiras cobram pra rodar Meta Ads em 2026. Por nicho, por tamanho de conta, por modelo.",
    h1: "Quanto cobrar como agência de tráfego pago em 2026 (tabela real)",
    body: `<p>Pricing de agência de tráfego é zona cinzenta. Aqui vai um benchmark realista pra 2026 baseado no mercado BR.</p><h2>Modelos de cobrança</h2><ul><li><strong>Fee fixo mensal:</strong> R$ 1.500-5.000/mês (contas até R$ 30k/mês de gasto)</li><li><strong>% sobre o gasto:</strong> 10-20% (contas R$ 30k+)</li><li><strong>Performance:</strong> 5-15% sobre revenue gerada</li></ul><h2>Por nicho</h2><ul><li>E-commerce pequeno: R$ 1.500-3.000/mês</li><li>E-commerce médio: R$ 3.000-7.000/mês</li><li>Info-produto: R$ 2.500-6.000/mês + bônus</li><li>Local: R$ 1.200-2.500/mês</li><li>SaaS B2B: R$ 4.000-10.000/mês</li></ul>`,
    related: [{ path: "ferramenta-agencia-meta-ads", label: "Ferramenta pra Agências" }],
  },
  {
    path: "gestor-trafego-salario-quanto-ganha-2026",
    title: "Quanto Ganha um Gestor de Tráfego em 2026 — Salário e Freelance",
    description: "Salário real de gestor de tráfego no Brasil em 2026: CLT, PJ, freelancer. Por experiência, por tamanho de empresa, por nicho.",
    h1: "Quanto ganha um gestor de tráfego em 2026 (BR, dado real)",
    body: `<p>Salário de gestor de tráfego no Brasil em 2026 varia bastante. Aqui vão as faixas reais.</p><h2>Faixas reais</h2><ul><li>Júnior (CLT, &lt;1 ano): R$ 2.500-4.500/mês</li><li>Pleno (CLT, 1-3 anos): R$ 4.500-8.000/mês</li><li>Sênior (CLT, 3+ anos): R$ 8.000-15.000/mês</li><li>PJ em agência: R$ 6.000-12.000/mês</li><li>Freelancer 5-10 clientes: R$ 10.000-25.000/mês</li><li>Owner de agência: R$ 20.000-100.000+/mês</li></ul>`,
    related: [{ path: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" }],
  },
  {
    path: "tracking-meta-ads-conversions-api-portugues",
    title: "Tracking Meta Ads + Conversions API em PT — Guia 2026",
    description: "Configurar tracking Meta Ads em 2026: pixel + Conversions API + iOS 18. Passo-a-passo prático pra gestor BR não perder conversão.",
    h1: "Tracking Meta Ads em 2026: pixel + Conversions API",
    body: `<p>Tracking quebrado é uma das causas mais comuns de "Meta Ads parou de funcionar" em 2026. iOS 18, ad blockers — pixel sozinho perde dados.</p><h2>Stack completo recomendado</h2><ol><li><strong>Meta Pixel</strong> — base, sempre obrigatório</li><li><strong>Conversions API (CAPI)</strong> — envia eventos do servidor pra Meta direto</li><li><strong>Server-Side GTM</strong> — opcional, dobra qualidade do tracking</li><li><strong>UTM consistente</strong> — pra atribuição cross-device e debug</li></ol>`,
    related: [{ path: "auditoria-meta-ads-ia", label: "Auditoria com IA" }],
  },
  {
    path: "como-estruturar-campanha-meta-ads-do-zero",
    title: "Como Estruturar Campanha Meta Ads do Zero — Passo a Passo 2026",
    description: "Estrutura completa de campanha Meta Ads pra 2026: do objetivo ao retargeting. CBO vs ABO, audience, criativo, budget, escala.",
    h1: "Como estruturar campanha Meta Ads do zero (passo a passo 2026)",
    body: `<p>Estrutura de campanha Meta Ads em 2026 é mais simples do que era em 2020. Mas erro estrutural ainda destrói conta.</p><h2>1. Objetivo</h2><p>Pra venda direta: <strong>Vendas</strong> com otimização Compra. Pra lead: <strong>Leads</strong>. Não use Tráfego/Engagement/Awareness.</p><h2>2. CBO vs ABO</h2><p>Em 2026, CBO ganhou. Use ABO só pra teste de criativo.</p><h2>3. Audience</h2><ul><li>Cold: Advantage+ ou interest broad</li><li>Warm: Lookalike 1-3%</li><li>Retargeting: Visitors + Carrinho abandonado</li></ul><h2>4. Criativo</h2><p>Mínimo 3-5 variações por adset. Refresh a cada 2-3 semanas.</p>`,
    related: [{ path: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar" }],
  },
  {
    path: "ferramenta-relatorio-meta-ads-cliente",
    title: "Ferramenta de Relatório Meta Ads pra Cliente — AdBrief",
    description: "Gere relatórios mensais lindos pra cliente em 1 clique. Métricas + insights causais + plano de ação, em PT, pronto pra mandar via WhatsApp ou email.",
    h1: "Ferramenta pra gerar relatório Meta Ads pro cliente em 1 clique",
    body: `<p>Toda agência odeia o ritual mensal de "compilar relatório pro cliente". Pegar dados do Meta Ads Manager, montar PDF, escrever insights — fácil consumir 4-6h por cliente.</p><h2>O que AdBrief gera automaticamente</h2><ul><li>Resumo de spend, conversões, ROAS, CPA</li><li>Comparativo vs mês anterior</li><li>Top 3 anúncios que mais converteram</li><li>Top 3 anúncios que mais queimaram budget</li><li>Insights causais</li><li>Plano de ação proposto</li></ul><p>Antes: 4-6h por cliente. Depois: 10-15 min. Pra 10 clientes = 35-50h/mês economizadas.</p>`,
    related: [{ path: "ferramenta-agencia-meta-ads", label: "Pra Agências" }, { path: "gestao-multi-conta-meta-ads", label: "Multi-Conta" }],
  },

  // ── INSTITUTIONAL — about / contact / careers ─────────────────────────────
  // Pre-rendering these closes the indexing gap in the sitemap. Without
  // unique HTML, Google treats them as duplicates of the SPA shell and
  // skips them. Static body is short on purpose — these aren't keyword
  // pages, they exist to give Google something real to index for the
  // brand-name search "AdBrief".
  {
    path: "about",
    title: "Sobre o AdBrief — IA pra Meta Ads feita por gestores de tráfego",
    description: "AdBrief é uma IA-first decision layer pra Meta Ads. Construída no Brasil pra gestores de tráfego que cansaram de planilha. Time, missão, manifesto.",
    h1: "Sobre o AdBrief",
    body: `
      <p>O AdBrief nasceu de uma frustração simples: gestor de tráfego sério não precisa de mais um dashboard. Precisa de <strong>decisão</strong>.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Missão</h2>
      <p>Transformar dado de Meta Ads em ação. Sem painel pra interpretar. Sem CSV pra importar. Sem planilha pra rodar.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Como funciona</h2>
      <p>O AdBrief lê sua conta Meta a cada 15 minutos via Meta Marketing API v21. Detecta vazamento (criativo cansado, audience saturada, CPA alto, fadiga). Te entrega a próxima ação com causa, valor em risco e botão pra executar. Você aprova. Reversível em 30 minutos.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Time</h2>
      <p>Construído no Brasil. Feito pra mercado brasileiro de tráfego pago. Stack: React, TypeScript, Supabase, Claude Haiku 4.5, Meta Marketing API v21.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Filosofia</h2>
      <p><strong>Show, don't tell.</strong> Cada feature é demonstrada com produto rodando, não descrita em slide. Trate o usuário como gestor experiente, não iniciante. Confiança através de ação reversível, não promessa.</p>
    `,
    related: [
      { path: "pricing", label: "Preços e Planos" },
      { path: "faq", label: "Perguntas Frequentes" },
      { path: "review-adbrief", label: "Review do AdBrief" },
    ],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Sobre", href: "/about" }],
  },

  {
    path: "contact",
    title: "Contato AdBrief — Suporte e parcerias",
    description: "Fale com o time AdBrief. Suporte técnico, dúvidas comerciais, parcerias com agências. Resposta em até 24h em dias úteis.",
    h1: "Contato",
    body: `
      <p>Time pequeno, resposta rápida.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Suporte e dúvidas</h2>
      <p>Email: <a href="mailto:contato@adbrief.pro" style="color:#0DA2E7">contato@adbrief.pro</a></p>
      <p>Resposta em até 24h em dias úteis. Pra dúvidas de uso, sugerimos primeiro ver a <a href="/faq" style="color:#0DA2E7">FAQ</a>.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Parcerias com agências</h2>
      <p>Agência com 5+ contas Meta Ads ativas? Falamos sobre planos enterprise + integração custom. Email com assunto "Parceria Agência" pro contato acima.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Imprensa</h2>
      <p>Pautas sobre AI no marketing digital, automação de tráfego pago, ou Meta Ads em geral — abrimos pra quem quiser entrevistar.</p>
    `,
    related: [
      { path: "about", label: "Sobre o AdBrief" },
      { path: "pricing", label: "Preços" },
    ],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Contato", href: "/contact" }],
  },

  {
    path: "careers",
    title: "Vagas AdBrief — Carreiras",
    description: "Trabalhe no AdBrief. Time pequeno, alto rigor, remoto, foco em produto sério pra mercado brasileiro de tráfego pago.",
    h1: "Carreiras no AdBrief",
    body: `
      <p>Trabalhamos em time pequeno, com rigor alto, em remoto. Cultura de <strong>show, don't tell</strong> — código e decisões pesam, slides não.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">O que valorizamos</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Pragmatismo &gt; teoria</li>
        <li>Profundidade &gt; quantidade de tickets</li>
        <li>Honestidade técnica</li>
        <li>Disposição pra discutir e pra mudar de ideia</li>
      </ul>
      <h2 style="font-size:22px;margin:32px 0 12px">Vagas abertas</h2>
      <p>No momento não temos vagas formalmente abertas, mas estamos sempre conversando com pessoas que queremos no time. Manda email pra <a href="mailto:contato@adbrief.pro" style="color:#0DA2E7">contato@adbrief.pro</a> com seu portfolio + 1 parágrafo dizendo por que AdBrief.</p>
    `,
    related: [
      { path: "about", label: "Sobre o AdBrief" },
      { path: "contact", label: "Contato" },
    ],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Carreiras", href: "/careers" }],
  },

  // ── LEGAL — terms / privacy / refund ──────────────────────────────────────
  // Short institutional text. Index-ready so Google has unique HTML
  // for each. Real legal text lives in detailed app pages (rendered by
  // React); these prerendered versions exist to satisfy crawlers.
  {
    path: "terms",
    title: "Termos de Uso — AdBrief",
    description: "Termos de uso do AdBrief: cadastro, plano, cancelamento, uso da API Meta, propriedade dos dados, limites de responsabilidade.",
    h1: "Termos de Uso",
    body: `
      <p><em>Última atualização: 28 de abril de 2026.</em></p>
      <h2 style="font-size:20px;margin:24px 0 8px">1. Cadastro</h2>
      <p>Você precisa ter pelo menos 18 anos pra criar conta. Forneça informações reais. Uma conta por pessoa.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">2. Conexão com a Meta</h2>
      <p>AdBrief usa OAuth oficial da Meta. Pedimos as permissões mínimas pra ler campanhas e executar ações que você aprovar. Você pode revogar a qualquer momento direto na Meta.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">3. Plano e Cobrança</h2>
      <p>Planos pagos são cobrados mensalmente. Você pode cancelar quando quiser pelo dashboard. Sem multa, sem fidelidade. O acesso continua até o fim do ciclo pago.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">4. Propriedade dos Dados</h2>
      <p>Os dados da sua conta Meta são seus. Usamos exclusivamente pra operar o AdBrief pra você. Não vendemos, não compartilhamos com terceiros, não usamos pra treinar modelos públicos.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">5. Limites de Responsabilidade</h2>
      <p>AdBrief é uma ferramenta de apoio à decisão. Recomendações são baseadas em dados — você decide o que executar. Não nos responsabilizamos por resultados financeiros decorrentes de ações que você aprovar.</p>
      <p style="margin-top:24px"><strong>Versão completa:</strong> a versão jurídica integral fica disponível dentro do app após login. Em caso de dúvida, escreva pra <a href="mailto:contato@adbrief.pro" style="color:#0DA2E7">contato@adbrief.pro</a>.</p>
    `,
    related: [{ path: "privacy", label: "Política de Privacidade" }, { path: "refund", label: "Política de Reembolso" }],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Termos", href: "/terms" }],
  },

  {
    path: "privacy",
    title: "Política de Privacidade — AdBrief",
    description: "Como o AdBrief coleta, usa e protege seus dados. Conformidade com LGPD. Dados da Meta usados apenas pra operar o produto pra você.",
    h1: "Política de Privacidade",
    body: `
      <p><em>Última atualização: 28 de abril de 2026. Em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</em></p>
      <h2 style="font-size:20px;margin:24px 0 8px">Dados que coletamos</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li><strong>De cadastro:</strong> nome, email, idioma preferido</li>
        <li><strong>Da Meta:</strong> dados de campanhas, criativos, métricas (somente leitura, via OAuth)</li>
        <li><strong>De uso:</strong> ações executadas no AdBrief, queries de chat, padrões aprendidos</li>
      </ul>
      <h2 style="font-size:20px;margin:24px 0 8px">Como usamos</h2>
      <p>Pra operar o AdBrief pra você: gerar diagnósticos, recomendações e executar ações que você aprovar.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">O que NÃO fazemos</h2>
      <ul style="margin:0 0 16px;padding-left:24px">
        <li>Não vendemos seus dados</li>
        <li>Não compartilhamos com terceiros não-essenciais</li>
        <li>Não usamos pra treinar modelos públicos de IA</li>
      </ul>
      <h2 style="font-size:20px;margin:24px 0 8px">Seus direitos (LGPD)</h2>
      <p>Acessar, corrigir, exportar, deletar seus dados. Solicitação por email pra <a href="mailto:contato@adbrief.pro" style="color:#0DA2E7">contato@adbrief.pro</a>, atendida em até 15 dias.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Cookies</h2>
      <p>Usamos cookies essenciais pra autenticação + analytics agregada. Sem cookies de publicidade.</p>
    `,
    related: [{ path: "terms", label: "Termos de Uso" }, { path: "refund", label: "Reembolso" }],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Privacidade", href: "/privacy" }],
  },

  {
    path: "refund",
    title: "Política de Reembolso — AdBrief",
    description: "Reembolso integral em 7 dias se não gostar. Cancelamento sem multa, sem fidelidade. Como solicitar.",
    h1: "Política de Reembolso",
    body: `
      <h2 style="font-size:20px;margin:24px 0 8px">Garantia de 7 dias</h2>
      <p>Se você assinou um plano pago e não gostou nos primeiros 7 dias, devolvemos integralmente. Sem perguntas, sem letra miúda.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Como solicitar</h2>
      <p>Email pra <a href="mailto:contato@adbrief.pro" style="color:#0DA2E7">contato@adbrief.pro</a> com assunto "Reembolso" e o email da sua conta. Reembolsamos em até 5 dias úteis pelo mesmo método de pagamento.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Cancelamento</h2>
      <p>Você pode cancelar a qualquer momento direto pelo dashboard, sem multa. Acesso continua até o fim do ciclo pago.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">Após os 7 dias</h2>
      <p>A partir do 8º dia o plano vira mensal padrão (sem reembolso retroativo), mas você ainda pode cancelar a qualquer momento.</p>
    `,
    related: [{ path: "pricing", label: "Preços" }, { path: "terms", label: "Termos de Uso" }],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Reembolso", href: "/refund" }],
  },

  // ── PRODUCT MARKETING — features / levels ─────────────────────────────────
  {
    path: "features",
    title: "Funcionalidades AdBrief — Tudo o que a IA faz pela sua conta Meta Ads",
    description: "Diagnóstico causal, decisões com 1 clique, painel intelligente, integração Meta API v21, aprendizado contínuo. Visão geral das features do AdBrief.",
    h1: "Funcionalidades do AdBrief",
    body: `
      <p>Visão consolidada das capacidades do AdBrief, em um lugar só.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Diagnóstico causal automático</h2>
      <p>A IA não te diz só "CTR caiu". Ela diz <strong>por quê</strong> (criativo cansado, audience saturada, fadiga, mismatch de oferta). Cada decisão tem hipótese explícita, valor em risco em R$, e condição de invalidação.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Decisões com 1 clique</h2>
      <p>Pause, scale, ajuste de budget, troca de criativo — tudo em 1 clique direto da decisão. Confirmação obrigatória, reversível em 30 minutos via histórico.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Estrategista (chat IA)</h2>
      <p>Pergunta livre sobre tua conta. "Por que CPA subiu?", "Vale escalar X?", "Esse criativo tá saturando?". Chat baseado em Claude Haiku 4.5, com contexto completo dos teus 30 dias de spend e padrões aprendidos.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Aprendizado contínuo</h2>
      <p>Cada ação aprovada vira evidência. Em 30-60 dias, AdBrief sabe os padrões da TUA conta — não médias de mercado.</p>
      <h2 style="font-size:22px;margin:32px 0 12px">Integração nativa Meta API v21</h2>
      <p>Conexão direta via OAuth oficial. Leitura a cada 15 min. Execução de ações via Marketing API. Sem CSV, sem planilha, sem terceiros.</p>
    `,
    related: [
      { path: "pricing", label: "Preços" },
      { path: "auditoria-meta-ads-ia", label: "Auditoria Automática" },
      { path: "tools/ad-creative-analyzer", label: "Analisador de Criativos" },
    ],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Funcionalidades", href: "/features" }],
  },

  {
    path: "levels",
    title: "Níveis AdBrief — Sistema de progressão pra gestor de tráfego",
    description: "5 níveis de progressão: Observador, Caçador, Editor, Comandante, Diretor. Como funciona a gamificação do AdBrief.",
    h1: "Níveis de Gestor",
    body: `
      <p>O AdBrief tem 5 níveis de progressão baseados em ações tomadas + resultados validados. É gamificação útil — não badge inútil.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">1. Observador</h2>
      <p>Conta conectada, AdBrief analisa, você lê. Default ao entrar.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">2. Caçador</h2>
      <p>Aprovou primeira decisão. AdBrief começa a aprender suas preferências.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">3. Editor</h2>
      <p>10+ ações com taxa de acerto &gt; 65%. Você começa a ver padrões da sua conta validados.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">4. Comandante</h2>
      <p>30+ ações, taxa &gt; 75%, streak de 7 dias. AdBrief desbloqueia recomendações mais agressivas baseadas no seu histórico.</p>
      <h2 style="font-size:20px;margin:24px 0 8px">5. Diretor</h2>
      <p>100+ ações validadas, taxa &gt; 80%. Acesso a autopilot opcional pra ações de alta confiança.</p>
    `,
    related: [
      { path: "features", label: "Funcionalidades" },
      { path: "pricing", label: "Preços" },
    ],
    breadcrumb: [{ label: "Home", href: "/" }, { label: "Níveis", href: "/levels" }],
  },
];

// ── Emit ──────────────────────────────────────────────────────────────────
console.log(`[prerender] generating ${ROUTES.length} static SEO pages…`);
let written = 0;
const failures = [];

for (const route of ROUTES) {
  try {
    writePage(route);
    written++;
  } catch (e) {
    failures.push(`${route.path}: ${e.message}`);
  }
}

console.log(`[prerender] wrote ${written}/${ROUTES.length} pages.`);
if (failures.length) {
  console.warn(`[prerender] ${failures.length} failures:`);
  for (const f of failures) console.warn(`  - ${f}`);
}

// Sitemap with lastmod=today
const today = new Date().toISOString().slice(0, 10);

const STATIC_TOP = [
  { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" },
  { loc: `${SITE_URL}/blog`, priority: "0.8", changefreq: "weekly" },
  { loc: `${SITE_URL}/about`, priority: "0.7", changefreq: "monthly" },
  { loc: `${SITE_URL}/contact`, priority: "0.6", changefreq: "monthly" },
  { loc: `${SITE_URL}/login`, priority: "0.3", changefreq: "monthly" },
  { loc: `${SITE_URL}/signup`, priority: "0.5", changefreq: "monthly" },
  { loc: `${SITE_URL}/features`, priority: "0.7", changefreq: "monthly" },
  { loc: `${SITE_URL}/levels`, priority: "0.5", changefreq: "monthly" },
  { loc: `${SITE_URL}/terms`, priority: "0.3", changefreq: "yearly" },
  { loc: `${SITE_URL}/privacy`, priority: "0.3", changefreq: "yearly" },
  { loc: `${SITE_URL}/refund`, priority: "0.3", changefreq: "yearly" },
  { loc: `${SITE_URL}/careers`, priority: "0.5", changefreq: "monthly" },
  // Index pages for the EN programmatic SEO tree
  { loc: `${SITE_URL}/tools`, priority: "0.9", changefreq: "weekly" },
  { loc: `${SITE_URL}/guides`, priority: "0.8", changefreq: "weekly" },
  { loc: `${SITE_URL}/compare`, priority: "0.8", changefreq: "monthly" },
  { loc: `${SITE_URL}/ads-library`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/best-ad-hooks`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/tiktok-ad-examples`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/facebook-ad-examples`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/ugc-ad-examples`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/igaming-ad-examples`, priority: "0.7", changefreq: "weekly" },
  { loc: `${SITE_URL}/ecommerce-ad-examples`, priority: "0.7", changefreq: "weekly" },
];

// ── Extract all slugs from src/data/seoData.ts (programmatic EN pages) ──
// Reads seoData.ts as plain text and regex-extracts slug values from each
// SEO_* array. We don't need to fully parse TS — only the top-level slugs
// each array exposes, mapped to the correct route prefix per the App.tsx
// route definitions:
//   SEO_TOOLS               → /tools/<slug>
//   SEO_GUIDES              → /guides/<slug>
//   SEO_COMPARISONS         → /compare/<slug>
//   SEO_LEARN_PAGES         → /learn/<slug>
//   SEO_PLATFORM_PAGES      → /platform/<slug>
//   SEO_INDUSTRY_PAGES      → /solutions/<slug>
//   SEO_USECASE_PAGES       → /use-case/<slug>
//   SEO_ROLE_PAGES          → /for/<slug>
//   SEO_HOOK_TYPE_PAGES     → /hooks/<slug>
//   SEO_MARKET_PAGES        → /markets/<slug>
//   SEO_AD_EXAMPLES_PAGES   → /examples/<slug>
//   SEO_LANDING_PAGES       → /<slug>  (root-level)
const SEODATA_PATH = path.join(ROOT, "src", "data", "seoData.ts");
const seoTextRaw = fs.existsSync(SEODATA_PATH) ? fs.readFileSync(SEODATA_PATH, "utf-8") : "";
function extractSlugsBetween(text, exportName) {
  const startMarker = new RegExp(`export const ${exportName}\\s*=\\s*\\[`);
  const startMatch = text.match(startMarker);
  if (!startMatch) return [];
  const startIdx = startMatch.index + startMatch[0].length;
  // Find matching closing `];` at top level — naive bracket counting.
  let depth = 1, i = startIdx;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    i++;
  }
  const block = text.slice(startIdx, i);
  return [...block.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
}
const PROGRAMMATIC_SECTIONS = [
  { exportName: "SEO_TOOLS", prefix: "tools" },
  { exportName: "SEO_GUIDES", prefix: "guides" },
  { exportName: "SEO_COMPARISONS", prefix: "compare" },
  { exportName: "SEO_LEARN_PAGES", prefix: "learn" },
  { exportName: "SEO_PLATFORM_PAGES", prefix: "platform" },
  { exportName: "SEO_INDUSTRY_PAGES", prefix: "solutions" },
  { exportName: "SEO_USECASE_PAGES", prefix: "use-case" },
  { exportName: "SEO_ROLE_PAGES", prefix: "for" },
  { exportName: "SEO_HOOK_TYPE_PAGES", prefix: "hooks" },
  { exportName: "SEO_MARKET_PAGES", prefix: "markets" },
  { exportName: "SEO_AD_EXAMPLES_PAGES", prefix: "examples" },
];
// PT-BR-ONLY POLICY (decided 2026-04-26):
// AdBrief is positioned 100% for the Brazilian market. The 160 programmatic
// SEO pages from seoData.ts are still in English (legacy from earlier
// build), and including them in the sitemap confused Google about the
// site's primary language — penalized PT-BR ranking.
//
// We KEEP the EN pages in src/data/seoData.ts and the React Router
// (so direct URLs still work for anyone who has them bookmarked, and
// Google won't 404), but DROP them from the sitemap so Google focuses
// crawl budget on the 25 PT-BR BOFU pages + static tops.
//
// When AdBrief one day expands to global (EN/ES), we'll re-translate
// these into proper localized routes (/en/<slug>, /es/<slug>) with
// hreflang tags. Until then, EN stays out of the sitemap.
const programmaticEntries = [];
console.log(`[prerender] EN programmatic pages excluded from sitemap (PT-BR-only policy)`);

const sitemapEntries = [
  ...STATIC_TOP,
  ...ROUTES.map((r) => ({
    loc: `${SITE_URL}/${r.path}`,
    priority: r.path.includes("alternativa") || r.path === "pricing" ? "0.9" : "0.8",
    changefreq: r.path.startsWith("como-") ? "monthly" : "weekly",
  })),
  ...programmaticEntries,
];

// De-dupe by loc — when a programmatic URL collides with a hand-tuned ROUTE
// (e.g. /pricing in both), the hand-tuned one wins because it appears first.
const seenLocs = new Set();
const dedupedSitemap = [];
for (const e of sitemapEntries) {
  if (seenLocs.has(e.loc)) continue;
  seenLocs.add(e.loc);
  dedupedSitemap.push(e);
}

const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${dedupedSitemap
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc><lastmod>${today}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemapXML, "utf-8");
console.log(`[prerender] sitemap.xml regenerated with ${dedupedSitemap.length} URLs · lastmod=${today}`);

console.log(`[prerender] DONE.`);
