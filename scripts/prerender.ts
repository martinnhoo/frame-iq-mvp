/**
 * AdBrief — Prerender Script (Static SEO HTML Generator)
 *
 * THE PROBLEM IT SOLVES:
 *   AdBrief is a Vite + React SPA. Out of the box, every URL serves the
 *   same `<div id="root"></div>` shell. Google sees 150 identical pages,
 *   marks them as duplicate content, and indexes maybe 5% of them. We
 *   confirmed via raw HTML fetch that `/`, `/tools/ad-hook-generator`,
 *   and `/learn/what-is-roas` all returned byte-identical HTML (3922 b).
 *
 * WHAT THIS SCRIPT DOES:
 *   For every BOFU/SEO URL we care about, it generates a real `index.html`
 *   inside `dist/<route>/index.html` with:
 *     - Unique <title>, meta description, canonical
 *     - Unique Open Graph title/description/url
 *     - Unique <h1> + visible body content (real prose, 200-600 words)
 *     - Page-typed JSON-LD schema (SoftwareApplication, Article, FAQPage,
 *       Product comparison, etc.)
 *     - Internal links to related pages (hub-and-spoke for link equity)
 *
 *   Vercel serves the static file directly when present (rewrites only
 *   activate on missing files). React still hydrates on top — users get
 *   the live app, crawlers get full content.
 *
 * EXECUTION:
 *   `tsx scripts/prerender.ts` (run after `vite build` — see package.json)
 *
 * EXTENDING:
 *   To add a new SEO route: append it to ROUTES array below or import
 *   from src/data/seoData.ts and map. Each entry must satisfy PageMeta.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEO_TOOLS,
  SEO_GUIDES,
  SEO_COMPARISONS,
  SEO_LANDING_PAGES,
  SEO_LEARN_PAGES,
  SEO_PLATFORM_PAGES,
  SEO_INDUSTRY_PAGES,
  SEO_USECASE_PAGES,
  SEO_ROLE_PAGES,
  SEO_HOOK_TYPE_PAGES,
  SEO_MARKET_PAGES,
  SEO_AD_EXAMPLES_PAGES,
} from "../src/data/seoData";

// ── Paths ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHELL_PATH = path.join(DIST, "index.html");
const SITE_URL = "https://adbrief.pro";

if (!fs.existsSync(SHELL_PATH)) {
  console.error(`[prerender] dist/index.html not found at ${SHELL_PATH}. Did you run 'vite build' first?`);
  process.exit(1);
}
const SHELL = fs.readFileSync(SHELL_PATH, "utf-8");

// ── Types ───────────────────────────────────────────────────────────────────
interface PageMeta {
  /** Path relative to site root, no leading slash. e.g. "tools/ad-hook-generator" */
  path: string;
  title: string;
  description: string;
  /** Visible H1 — distinct from <title> when useful for SEO. */
  h1: string;
  /** Body prose — minimum 200 words for indexability. Plain text or simple HTML. */
  body: string;
  /** Optional list of [path, label] tuples to render as related links section. */
  related?: Array<{ path: string; label: string }>;
  /** JSON-LD schema object (without @context — added automatically). */
  schema?: Record<string, unknown> | Record<string, unknown>[];
  /** Optional category breadcrumb, e.g. "Ferramentas" or "Comparações". */
  breadcrumb?: { label: string; href: string }[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Escape HTML special chars for inline body content. Keep <p>, <strong>, <a>. */
function safe(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render the body content with branding shell. Visible to crawlers + JS-disabled users. */
function renderFallbackBody(meta: PageMeta): string {
  const bcHTML = meta.breadcrumb && meta.breadcrumb.length
    ? `<nav style="font-size:13px;color:#666;margin-bottom:16px" aria-label="Breadcrumb">${meta.breadcrumb
        .map((b, i) => `${i > 0 ? " · " : ""}<a href="${b.href}" style="color:#2563eb;text-decoration:none">${safe(b.label)}</a>`)
        .join("")}</nav>`
    : "";

  const relatedHTML = meta.related && meta.related.length
    ? `<section style="margin-top:48px;padding-top:24px;border-top:1px solid #eee">
         <h2 style="font-size:18px;font-weight:700;margin:0 0 16px">Conteúdo relacionado</h2>
         <ul style="list-style:none;padding:0;margin:0;display:grid;gap:8px">
           ${meta.related
             .map(
               (r) =>
                 `<li><a href="/${r.path}" style="color:#2563eb;text-decoration:none">→ ${safe(r.label)}</a></li>`
             )
             .join("")}
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

/** Return JSON-LD wrapped with @context. Accepts single object or array. */
function renderSchema(schema: PageMeta["schema"]): string {
  if (!schema) return "";
  const arr = Array.isArray(schema) ? schema : [schema];
  const withContext = {
    "@context": "https://schema.org",
    "@graph": arr,
  };
  return `<script type="application/ld+json">${JSON.stringify(withContext, null, 2)}</script>`;
}

/** Substitute the relevant tags in the Vite shell with page-specific content. */
function buildPageHTML(meta: PageMeta): string {
  const url = `${SITE_URL}/${meta.path}`;
  let html = SHELL;

  // Title
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${safe(meta.title)}</title>`
  );

  // Meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${safe(meta.description)}" />`
  );

  // Canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`
  );

  // OG title/description/url
  html = html.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${safe(meta.title)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${safe(meta.description)}" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${url}" />`
  );

  // Twitter
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${safe(meta.title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${safe(meta.description)}" />`
  );

  // Body fallback content (replaces the default <div id="root">…</div> block)
  const fallback = renderFallbackBody(meta);
  // Match <div id="root"> through the closing </div> of the root container.
  // Vite's template wraps root in a single div that contains a <main>; replace
  // everything inside #root with our SEO content.
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<script type="module"/,
    `<div id="root">${fallback}</div>\n    <script type="module"`
  );

  // Append page-specific JSON-LD before </head>
  if (meta.schema) {
    const schemaTag = renderSchema(meta.schema);
    html = html.replace(/<\/head>/, `    ${schemaTag}\n  </head>`);
  }

  return html;
}

/** Write a single static page to dist/<path>/index.html. */
function writePage(meta: PageMeta): void {
  const html = buildPageHTML(meta);
  const dir = path.join(DIST, meta.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
}

// ── Page Definitions ───────────────────────────────────────────────────────

/** Hand-tuned BOFU pages with strong PT-BR copy + appropriate schema. */
const STATIC_BOFU_ROUTES: PageMeta[] = [
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
        {
          "@type": "Question",
          name: "O AdBrief é uma agência ou ferramenta?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ferramenta. AdBrief é uma IA que conecta na sua conta do Meta Ads e analisa automaticamente.",
          },
        },
        {
          "@type": "Question",
          name: "É seguro conectar minha conta da Meta?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. AdBrief usa OAuth oficial da Meta. Pode revogar acesso a qualquer momento.",
          },
        },
        {
          "@type": "Question",
          name: "Funciona pra qualquer nicho?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim — AdBrief lê dados reais da sua conta independente de nicho.",
          },
        },
        {
          "@type": "Question",
          name: "Quanto demora pra ter o primeiro insight?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Em média 2 minutos após conectar a conta Meta.",
          },
        },
        {
          "@type": "Question",
          name: "Posso cancelar quando quiser?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. Sem multa, sem fidelidade. Cancela direto pelo dashboard.",
          },
        },
      ],
    },
  },
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
      { path: "for/for-media-buyers", label: "AdBrief para Media Buyers" },
      { path: "for/for-agencies", label: "AdBrief para Agências" },
      { path: "pricing", label: "Preços" },
    ],
    schema: {
      "@type": "SoftwareApplication",
      name: "AdBrief",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      audience: { "@type": "BusinessAudience", audienceType: "Gestor de Tráfego, Agência de Marketing" },
    },
  },
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
      <h2 style="font-size:22px;margin:32px 0 12px">Quando AdSpy ainda faz sentido</h2>
      <p>Se você tá começando do zero e quer ver criativos top de outros nichos pra se inspirar, AdSpy é útil. Os dois são complementares — AdSpy pra pesquisa de mercado, AdBrief pra otimização da sua conta.</p>
      <p>Pricing comparativo: AdSpy começa em <strong>US$ 149/mês</strong>. AdBrief começa em <strong>R$ 49/mês</strong> — mesma faixa de público (gestor pequeno-médio), 5x mais barato.</p>
    `,
    related: [
      { path: "compare/adbrief-vs-adspy", label: "Comparativo Detalhado AdBrief vs AdSpy" },
      { path: "compare/adbrief-vs-bigspy", label: "AdBrief vs BigSpy" },
      { path: "compare/adbrief-vs-minea", label: "AdBrief vs Minea" },
      { path: "pricing", label: "Preços do AdBrief" },
    ],
  },
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
      { path: "ferramenta-gestor-trafego-ia", label: "Ferramenta pra Gestor de Tráfego" },
      { path: "pricing", label: "Preços" },
    ],
  },
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
      { path: "tools/ad-creative-analyzer", label: "Analisar Criativo" },
      { path: "learn/what-is-creative-fatigue", label: "O que é fadiga criativa" },
    ],
  },
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
      { path: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
      { path: "learn/what-is-roas", label: "O que é ROAS" },
    ],
  },
];

// ── Auto-generate from seoData arrays ──────────────────────────────────────

/** Generic body builder for SEO pages with longDescription + useCases. */
function bodyFromTool(tool: any): string {
  const useCasesHTML = tool.useCases?.length
    ? `<h2 style="font-size:22px;margin:32px 0 12px">Casos de uso</h2><ul style="margin:0 0 16px;padding-left:24px">${tool.useCases
        .map((u: string) => `<li>${safe(u)}</li>`)
        .join("")}</ul>`
    : "";
  return `<p>${safe(tool.longDescription || tool.description)}</p>${useCasesHTML}`;
}

const AUTO_ROUTES: PageMeta[] = [];

// Tools: /tools/<slug>
for (const tool of SEO_TOOLS as any[]) {
  AUTO_ROUTES.push({
    path: `tools/${tool.slug}`,
    title: tool.metaTitle || tool.name,
    description: tool.metaDescription || tool.description,
    h1: tool.name,
    body: bodyFromTool(tool),
    related: [
      ...(tool.relatedTools || []).map((s: string) => ({ path: `tools/${s}`, label: s.replace(/-/g, " ") })),
      ...(tool.relatedGuides || []).map((s: string) => ({ path: `guides/${s}`, label: s.replace(/-/g, " ") })),
    ],
    schema: {
      "@type": "SoftwareApplication",
      name: tool.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: tool.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
    },
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Ferramentas", href: "/tools" },
      { label: tool.name, href: `/tools/${tool.slug}` },
    ],
  });
}

// Guides: /guides/<slug>
for (const guide of SEO_GUIDES as any[]) {
  AUTO_ROUTES.push({
    path: `guides/${guide.slug}`,
    title: guide.metaTitle || guide.title,
    description: guide.metaDescription || guide.description,
    h1: guide.title,
    body: `<p>${safe(guide.description)}</p>${
      guide.sections
        ? guide.sections
            .map(
              (s: any) =>
                `<h2 style="font-size:22px;margin:32px 0 12px">${safe(s.heading || s.title)}</h2><p>${safe(s.content || s.body || "")}</p>`
            )
            .join("")
        : ""
    }`,
    schema: {
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      author: { "@type": "Organization", name: "AdBrief" },
      datePublished: guide.publishedAt || "2026-01-01",
    },
  });
}

// Comparisons: /compare/<slug>
for (const comp of SEO_COMPARISONS as any[]) {
  AUTO_ROUTES.push({
    path: `compare/${comp.slug}`,
    title: comp.metaTitle || `${comp.title || comp.competitor || comp.slug} | AdBrief`,
    description: comp.metaDescription || comp.description || `Comparativo entre AdBrief e ${comp.competitor}.`,
    h1: comp.title || `AdBrief vs ${comp.competitor}`,
    body: `<p>${safe(comp.description || "")}</p>${
      comp.sections
        ? comp.sections
            .map(
              (s: any) =>
                `<h2 style="font-size:22px;margin:32px 0 12px">${safe(s.heading || s.title)}</h2><p>${safe(s.content || s.body || "")}</p>`
            )
            .join("")
        : ""
    }`,
    related: [{ path: "pricing", label: "Preços do AdBrief" }],
  });
}

// Learn: /learn/<slug>
for (const learn of SEO_LEARN_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `learn/${learn.slug}`,
    title: learn.metaTitle || learn.title,
    description: learn.metaDescription || learn.description,
    h1: learn.title,
    body: `<p>${safe(learn.description)}</p>${
      learn.content ? `<div>${safe(learn.content).replace(/\n/g, "<br>")}</div>` : ""
    }`,
    schema: {
      "@type": "Article",
      headline: learn.title,
      description: learn.description,
      author: { "@type": "Organization", name: "AdBrief" },
    },
  });
}

// Platform analyzers: /platform/<slug>
for (const plat of SEO_PLATFORM_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `platform/${plat.slug}`,
    title: plat.metaTitle || plat.title,
    description: plat.metaDescription || plat.description,
    h1: plat.title,
    body: `<p>${safe(plat.description)}</p>`,
  });
}

// Industries: /solutions/<slug>
for (const ind of SEO_INDUSTRY_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `solutions/${ind.slug}`,
    title: ind.metaTitle || ind.title,
    description: ind.metaDescription || ind.description,
    h1: ind.title,
    body: `<p>${safe(ind.description)}</p>`,
  });
}

// Use cases: /use-case/<slug>
for (const uc of SEO_USECASE_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `use-case/${uc.slug}`,
    title: uc.metaTitle || uc.title,
    description: uc.metaDescription || uc.description,
    h1: uc.title,
    body: `<p>${safe(uc.description)}</p>`,
  });
}

// Roles: /for/<slug>
for (const role of SEO_ROLE_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `for/${role.slug}`,
    title: role.metaTitle || role.title,
    description: role.metaDescription || role.description,
    h1: role.title,
    body: `<p>${safe(role.description)}</p>`,
  });
}

// Hook types: /hooks/<slug>
for (const hook of SEO_HOOK_TYPE_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `hooks/${hook.slug}`,
    title: hook.metaTitle || hook.title,
    description: hook.metaDescription || hook.description,
    h1: hook.title,
    body: `<p>${safe(hook.description)}</p>`,
  });
}

// Markets: /markets/<slug>
for (const mkt of SEO_MARKET_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `markets/${mkt.slug}`,
    title: mkt.metaTitle || mkt.title,
    description: mkt.metaDescription || mkt.description,
    h1: mkt.title,
    body: `<p>${safe(mkt.description)}</p>`,
  });
}

// Ad examples: /examples/<slug>
for (const ex of SEO_AD_EXAMPLES_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: `examples/${ex.slug}`,
    title: ex.metaTitle || ex.title,
    description: ex.metaDescription || ex.description,
    h1: ex.title,
    body: `<p>${safe(ex.description)}</p>`,
  });
}

// Landing pages: /<slug>
for (const lp of SEO_LANDING_PAGES as any[]) {
  AUTO_ROUTES.push({
    path: lp.slug,
    title: lp.metaTitle || lp.title,
    description: lp.metaDescription || lp.description,
    h1: lp.title,
    body: `<p>${safe(lp.description)}</p>`,
  });
}

// ── Combine + emit ─────────────────────────────────────────────────────────
const ALL_ROUTES = [...STATIC_BOFU_ROUTES, ...AUTO_ROUTES];

// De-dupe by path (static routes win over auto-generated ones)
const seen = new Set<string>();
const dedupedRoutes: PageMeta[] = [];
for (const r of ALL_ROUTES) {
  if (seen.has(r.path)) continue;
  seen.add(r.path);
  dedupedRoutes.push(r);
}

console.log(`[prerender] generating ${dedupedRoutes.length} static SEO pages…`);
let written = 0;
const failures: string[] = [];

for (const route of dedupedRoutes) {
  try {
    writePage(route);
    written++;
  } catch (e) {
    failures.push(`${route.path}: ${(e as Error).message}`);
  }
}

console.log(`[prerender] wrote ${written}/${dedupedRoutes.length} pages.`);
if (failures.length) {
  console.warn(`[prerender] ${failures.length} failures:`);
  for (const f of failures) console.warn(`  - ${f}`);
}

// ── Regenerate sitemap.xml with lastmod=today ──────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const sitemapEntries = [
  { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" },
  ...dedupedRoutes.map((r) => ({
    loc: `${SITE_URL}/${r.path}`,
    priority: r.path.includes("compare/") || r.path.startsWith("tools/") ? "0.9" : "0.8",
    changefreq: r.path.includes("learn/") ? "monthly" : "weekly",
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
