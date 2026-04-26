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

  return `
    <main style="font-family:'Inter',system-ui,sans-serif;max-width:780px;margin:48px auto;padding:0 24px;color:#0a0c10;line-height:1.65">
      ${bcHTML}
      <h1 style="font-size:36px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px">${safe(meta.h1)}</h1>
      <p style="font-size:18px;color:#444;margin:0 0 24px">${safe(meta.description)}</p>
      <div style="font-size:16px;color:#222">${meta.body}</div>
      <p style="margin:32px 0">
        <a href="/signup" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Começar teste grátis de 3 dias</a>
      </p>
      ${relatedHTML}
      <p style="font-size:13px;color:#888;margin-top:64px">Carregando aplicação interativa…</p>
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
];
const sitemapEntries = [
  ...STATIC_TOP,
  ...ROUTES.map((r) => ({
    loc: `${SITE_URL}/${r.path}`,
    priority: r.path.includes("alternativa") || r.path === "pricing" ? "0.9" : "0.8",
    changefreq: r.path.startsWith("como-") ? "monthly" : "weekly",
  })),
];

const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc><lastmod>${today}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemapXML, "utf-8");
console.log(`[prerender] sitemap.xml regenerated with ${sitemapEntries.length} URLs · lastmod=${today}`);

console.log(`[prerender] DONE.`);
