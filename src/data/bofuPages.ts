/**
 * BOFU SEO Pages — central data for the 16 hand-tuned high-intent pages
 * we prerender as static HTML.
 *
 * The same data feeds two consumers:
 *   1. `scripts/prerender.mjs` — generates dist/<slug>/index.html with
 *      this content as crawler-visible body fallback.
 *   2. `src/pages/BofuPage.tsx` — React component rendering when user
 *      navigates client-side, with full app shell (nav, footer, etc.).
 *
 * Keep them in sync — when adding/editing a page here, mirror the change
 * in `scripts/prerender.mjs` ROUTES array.
 */

export interface BofuPage {
  slug: string;
  title: string;          // <title> + h1 prefix
  description: string;     // meta description + lead paragraph
  h1: string;              // visible page heading
  bodyHTML: string;        // raw HTML body (sections, lists, paragraphs)
  related?: Array<{ slug: string; label: string }>;
  breadcrumb?: Array<{ label: string; href: string }>;
}

export const BOFU_PAGES: BofuPage[] = [
  {
    slug: "auditoria-meta-ads-ia",
    title: "Auditoria Meta Ads com IA — Diagnóstico em 2 minutos | AdBrief",
    description:
      "Auditoria completa da sua conta Meta Ads em 2 minutos. AdBrief identifica criativos cansados, audience errada, fadiga e oportunidades de escala — com plano de ação em PT.",
    h1: "Auditoria Meta Ads automática com IA",
    bodyHTML: `
      <p>Auditar uma conta Meta na unha leva 4-8h por mês. AdBrief faz em <strong>2 minutos</strong> e roda continuamente em background, te avisando só quando algo realmente importa.</p>
      <h2>O que a auditoria detecta</h2>
      <ul>
        <li><strong>Criativo cansado</strong> — frequência alta, CTR caindo, CPA subindo. Recomendação de pause + variação.</li>
        <li><strong>Audience errada</strong> — gasto sem retorno em segmentos específicos. Sugere consolidação ou troca.</li>
        <li><strong>Fadiga de público</strong> — mesma audience exposta demais. Sugere refresh ou expansão.</li>
        <li><strong>CPA alto</strong> — adsets gastando acima da meta. Diagnóstico causal: criativo, audience, ou bid?</li>
        <li><strong>Tracking quebrado</strong> — pixel não disparando, evento mal configurado, atribuição errada.</li>
        <li><strong>Oportunidades de escala</strong> — winners detectados antes do gestor ver. Sugestão de budget +X%.</li>
      </ul>
      <h2>Como funciona</h2>
      <p>1. Conecta tua conta Meta via OAuth oficial (30s).<br>2. AdBrief lê os últimos 30 dias de dados.<br>3. IA aplica raciocínio causal sobre cada anúncio, adset e campanha.<br>4. Você recebe relatório priorizado com ação concreta pra cada problema.</p>
      <p>Não é dashboard de gráfico bonito. É auditor de tráfego rodando 24/7.</p>
    `,
    related: [
      { slug: "ferramenta-gestor-trafego-ia", label: "Ferramenta pra Gestor de Tráfego" },
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
      { slug: "review-adbrief", label: "Review AdBrief" },
    ],
  },
  {
    slug: "ferramenta-gestor-trafego-ia",
    title: "Ferramenta de IA pra Gestor de Tráfego — AdBrief",
    description:
      "Software de IA pra gestor de tráfego escalar contas Meta sem ficar refém de planilha. Diagnóstico causal, recomendações priorizadas, ação de 1 clique.",
    h1: "A ferramenta que todo gestor de tráfego deveria ter",
    bodyHTML: `
      <p>Se você é gestor de tráfego rodando 3+ contas Meta, sabe que o gargalo não é executar — é <strong>decidir o que olhar primeiro</strong>. Cada conta tem 50+ adsets ativos. Olhar todos toda semana é impossível.</p>
      <p>AdBrief te dá uma camada de inteligência por cima de cada conta: ela olha o que você não consegue olhar, prioriza o que importa, e te entrega "isso aqui tá vazando R$X/dia, faz Y agora".</p>
      <h2>Por que gestores escolhem AdBrief</h2>
      <ul>
        <li><strong>Linguagem de gestor</strong> — não precisa traduzir dashboard em inglês corporativo. PT direto, jargão do dia-a-dia.</li>
        <li><strong>Plano Pro inclui 3 contas</strong> — pra gestor solo ou pequena agência</li>
        <li><strong>Plano Studio sem limite de contas</strong> — pra agência com 10+ clientes</li>
        <li><strong>Aprende com você</strong> — cada decisão (pause, scale, ignore) treina o modelo pra próxima recomendação</li>
        <li><strong>Histórico completo</strong> — toda decisão fica registrada com causa, ação, e resultado medido em 24h/72h</li>
      </ul>
      <p>Você continua sendo o cérebro. AdBrief é o estagiário sênior que faz o trabalho de leitura de dados que toma teu sábado.</p>
    `,
    related: [
      { slug: "auditoria-meta-ads-ia", label: "Auditoria Meta Ads com IA" },
      { slug: "ferramenta-agencia-meta-ads", label: "AdBrief para Agências" },
    ],
  },
  {
    slug: "ferramenta-agencia-meta-ads",
    title: "Ferramenta IA pra Agência de Meta Ads — Gestão Multi-Conta | AdBrief",
    description:
      "Sua agência roda 5+ contas Meta? AdBrief detecta automaticamente o que tá vazando em cada uma delas, prioriza, e te dá o plano de ação semanal.",
    h1: "AdBrief pra Agências de Meta Ads",
    bodyHTML: `
      <p>Agência de tráfego cresce até bater na parede de gestão. Com 10+ clientes, ninguém consegue olhar todas as contas com profundidade. O resultado é: clientes pequenos ficam abandonados, churn aumenta, gestor sênior vira bombeiro 50% do tempo.</p>
      <p>AdBrief resolve isso vigiando todas as contas em paralelo. Cada manhã você abre o painel e vê <strong>"essas 3 contas têm fogo pra apagar agora, essas 7 estão estáveis"</strong>. Sem perder nada importante.</p>
      <h2>Plano Studio — contas ilimitadas</h2>
      <ul>
        <li>Conecte quantas contas Meta quiser, sem limite</li>
        <li>Painel consolidado com priorização cross-conta</li>
        <li>Histórico de decisões por cliente (rastreabilidade)</li>
        <li>Relatórios prontos pra mandar pro cliente todo mês</li>
        <li>R$ 349/mês — pague menos que 1h de gestor sênior por mês</li>
      </ul>
      <p>Pra agências de 5-50 clientes Meta. Acima disso, fala direto comigo pra plano enterprise.</p>
    `,
    related: [
      { slug: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego Solo" },
      { slug: "gestao-multi-conta-meta-ads", label: "Gestão Multi-Conta" },
    ],
  },
  {
    slug: "alternativa-adspy",
    title: "Alternativa ao AdSpy em Português — AdBrief",
    description:
      "Procurando alternativa ao AdSpy que funcione com a sua conta Meta real (não só biblioteca pública)? AdBrief faz diagnóstico causal e plano de ação em PT.",
    h1: "AdBrief: alternativa ao AdSpy focada na sua conta, não na biblioteca pública",
    bodyHTML: `
      <p>AdSpy é uma biblioteca de anúncios — mostra o que outras pessoas estão rodando. Útil pra inspiração de criativo, mas não te diz o que fazer na <strong>SUA conta</strong>.</p>
      <p>AdBrief é o oposto: foca 100% nos seus dados reais. Lê tudo que tá ativo na sua Meta, identifica o que tá vazando R$, e te dá o plano de ação. É auditor + estrategista, não banco de dados.</p>
      <h2>Quando AdBrief é melhor que AdSpy</h2>
      <ul>
        <li>Você já roda Meta e quer otimizar (não pesquisar inspiração)</li>
        <li>Precisa de explicação em PT, não interface gringa</li>
        <li>Quer ação executável, não só dado</li>
        <li>Quer pagar em real, não dólar (AdSpy é US$ 149/mês mínimo)</li>
      </ul>
      <p>Pricing: AdSpy começa em <strong>US$ 149/mês</strong>. AdBrief em <strong>R$ 49/mês</strong> — 5x mais barato pra mesma faixa de público.</p>
    `,
    related: [
      { slug: "alternativa-bigspy", label: "Alternativa ao BigSpy" },
      { slug: "alternativa-minea", label: "Alternativa ao Minea" },
    ],
  },
  {
    slug: "alternativa-bigspy",
    title: "Alternativa ao BigSpy em Português — AdBrief vs BigSpy",
    description:
      "BigSpy mostra anúncios dos outros. AdBrief otimiza os seus. Veja por que gestores BR estão migrando pra a alternativa em PT que custa metade.",
    h1: "Alternativa ao BigSpy: AdBrief otimiza sua conta, não copia o concorrente",
    bodyHTML: `
      <p>BigSpy é spy tool — banco de anúncios pra você ver o que concorrente roda. Útil pra inspiração, mas não tem nada a ver com performance real na sua conta.</p>
      <p>AdBrief faz a outra ponta: conecta na tua conta Meta, lê os dados reais, e te diz o que fazer. Não te mostra anúncio de ninguém — te mostra o que tá vazando dinheiro NA TUA CONTA agora.</p>
      <h2>Diferenças práticas</h2>
      <ul>
        <li>BigSpy: banco de criativos. AdBrief: motor de decisão.</li>
        <li>BigSpy: US$ 99/mês mínimo. AdBrief: R$ 49/mês.</li>
        <li>BigSpy: interface em inglês. AdBrief: tudo em PT.</li>
        <li>BigSpy: você lê dados. AdBrief: você executa ações.</li>
      </ul>
      <p>Não são produtos competidores diretos — fazem coisas diferentes. Mas se você precisa escolher pelo orçamento limitado, AdBrief tem ROI mais direto pra contas que já gastam R$ 1k+/mês.</p>
    `,
    related: [
      { slug: "alternativa-adspy", label: "Alternativa ao AdSpy" },
      { slug: "alternativa-minea", label: "Alternativa ao Minea" },
    ],
  },
  {
    slug: "alternativa-minea",
    title: "Alternativa ao Minea em Português — AdBrief vs Minea",
    description:
      "Minea é spy tool gringa. AdBrief é IA que conecta na sua conta Meta e te dá diagnóstico em PT. Compare e escolha o que faz sentido pra você.",
    h1: "Alternativa ao Minea: optimizer brasileiro vs spy tool francês",
    bodyHTML: `
      <p>Minea é boa pra dropshipping e descoberta de produto vencedor. Se você quer ver o que tá bombando no TikTok ads pra copiar, é uma boa escolha.</p>
      <p>AdBrief é diferente: é pra quem JÁ roda Meta Ads e quer parar de gastar errado. Conecta na conta, lê os dados, te diz o que pausar e o que escalar — com explicação em PT direto.</p>
      <h2>Quando escolher AdBrief</h2>
      <ul>
        <li>Você gerencia conta Meta com gasto recorrente</li>
        <li>Quer otimizar (não descobrir produto)</li>
        <li>Precisa de plano de ação, não só dado</li>
        <li>Atende mercado BR e prefere PT</li>
      </ul>
      <p>Minea começa em €49/mês. AdBrief começa em R$ 49/mês — pagamento em real, sem cotação ou IOF.</p>
    `,
    related: [
      { slug: "alternativa-adspy", label: "Alternativa ao AdSpy" },
      { slug: "alternativa-bigspy", label: "Alternativa ao BigSpy" },
    ],
  },
  {
    slug: "ia-meta-ads-portugues",
    title: "IA pra Meta Ads em Português — AdBrief",
    description:
      "Primeira IA de Meta Ads pensada pro mercado brasileiro: diagnóstico em PT direto, sem tradução automática, com cases reais de gestores BR.",
    h1: "IA de Meta Ads em português, feita pro Brasil",
    bodyHTML: `
      <p>A maioria das ferramentas de IA pra Meta Ads é gringa, traduzida com Google Translate, e fala "ROAS uplift" em vez de "lucro a mais". AdBrief foi construído em português, pensando em como gestor brasileiro fala e opera.</p>
      <h2>Por que isso importa</h2>
      <ul>
        <li><strong>Mercado BR é diferente</strong> — média de spend menor, perfil de oferta diferente, sazonalidade diferente. AdBrief calibra com base nisso.</li>
        <li><strong>Vocabulário direto</strong> — "esse criativo tá queimando R$87/dia" em vez de "ad creative showing -34% efficiency vs benchmark"</li>
        <li><strong>Suporte em PT</strong> — quando você precisa de ajuda, fala com gente que entende o mercado</li>
        <li><strong>Pagamento em real</strong> — sem dor de cabeça com cartão internacional, IOF, cotação</li>
      </ul>
      <p>AdBrief não é tradução. É produto desenhado de origem pra resolver a dor real do gestor BR.</p>
    `,
    related: [
      { slug: "auditoria-meta-ads-ia", label: "Auditoria Meta Ads" },
      { slug: "ferramenta-gestor-trafego-ia", label: "Ferramenta pra Gestor" },
    ],
  },
  {
    slug: "como-reduzir-cpa-meta-ads",
    title: "Como Reduzir CPA no Meta Ads — Guia Prático com IA | AdBrief",
    description:
      "Passo a passo pra identificar e reduzir CPA alto no Meta Ads: criativo, audience, bid, tracking. Use IA pra diagnosticar a causa raiz em segundos.",
    h1: "Como reduzir CPA no Meta Ads (com diagnóstico de causa raiz)",
    bodyHTML: `
      <p>CPA alto é sintoma. A causa pode ser: criativo cansado, audience errada, bid mal calibrado, tracking quebrado, ou oferta fraca. Sem identificar a causa raiz, qualquer ajuste é tiro no escuro.</p>
      <h2>Checklist diagnóstico</h2>
      <ol>
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
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
      { slug: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar sem perder ROAS" },
      { slug: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
    ],
  },
  {
    slug: "como-escalar-meta-ads-sem-perder-roas",
    title: "Como Escalar Meta Ads sem Perder ROAS — Estratégia Comprovada",
    description:
      "Escalar campanha Meta sem destruir ROAS exige timing certo, audience certa, e estrutura certa. Aprenda o playbook + use IA pra detectar quando escalar.",
    h1: "Como escalar Meta Ads sem perder ROAS",
    bodyHTML: `
      <p>Escalar Meta Ads é o momento mais delicado. Aumenta budget muito rápido = quebra learning phase, ROAS despenca. Aumenta lento demais = oportunidade passa.</p>
      <h2>Regras práticas</h2>
      <ul>
        <li><strong>Aumenta no máximo 20-30% por dia</strong> em adset rodando bem (CBO ou ABO).</li>
        <li><strong>Espera 48-72h pra avaliar resultado</strong> — Meta precisa reotimizar com novo budget.</li>
        <li><strong>Duplica em vez de aumentar</strong> — clone do adset com 2x budget mantém o original "limpo".</li>
        <li><strong>Diversifica audience</strong> — adset funcionando = base. Crie 2-3 lookalikes pra escalar sem saturar.</li>
        <li><strong>Refresh criativo a cada 2 semanas</strong> — mesmo criativo cansa rápido em escala.</li>
      </ul>
      <h2>Quando AdBrief recomenda escalar</h2>
      <p>AdBrief detecta winners cedo (CTR consistente, CPA estável, frequência baixa) e te avisa: "esse adset tá pronto pra escalar +30%". Sem chute.</p>
    `,
    related: [
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
      { slug: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
    ],
  },
  {
    slug: "como-detectar-criativo-cansado",
    title: "Como Detectar Criativo Cansado no Meta Ads — Sinais e Soluções",
    description:
      "Criativo cansado é a causa #1 de CPA subindo. Aprenda a identificar pelos 4 sinais clássicos + descubra como AdBrief detecta antes de você.",
    h1: "Como detectar criativo cansado no Meta Ads",
    bodyHTML: `
      <p>Quase todo gestor já passou: campanha rodava bem, do nada CPA subiu 50%. A causa mais comum é <strong>fadiga criativa</strong> — o público viu seu anúncio tantas vezes que parou de reagir.</p>
      <h2>4 sinais de criativo cansado</h2>
      <ol>
        <li><strong>Frequência > 3</strong> — pessoas viram o ad mais de 3x. Sinal forte de saturação.</li>
        <li><strong>CTR caindo dia a dia</strong> — quanto mais tempo no ar, menos cliques relativos.</li>
        <li><strong>CPM subindo sem motivo</strong> — Meta cobra mais pra mostrar criativo que não engaja.</li>
        <li><strong>Comments/likes secando</strong> — engajamento orgânico é leading indicator.</li>
      </ol>
      <h2>O que fazer</h2>
      <p>Pause o criativo cansado. Crie 2-3 variações novas (mesma oferta, hook diferente). Ative no mesmo adset. Manter o adset com budget acumulado é melhor que começar do zero.</p>
      <p>AdBrief detecta esses 4 sinais automaticamente e te avisa antes de você perder R$ esperando o relatório semanal.</p>
    `,
    related: [
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
      { slug: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar sem perder ROAS" },
    ],
  },
  {
    slug: "review-adbrief",
    title: "AdBrief Review — IA pra Meta Ads que Vale o Investimento? | 2026",
    description:
      "Review completo do AdBrief: o que faz bem, limitações, comparação com agência, ROI esperado e pra quem realmente vale a pena assinar.",
    h1: "AdBrief: review honesto da IA pra Meta Ads",
    bodyHTML: `
      <p>O AdBrief é uma das primeiras IAs de Meta Ads pensadas pro mercado BR. Em vez de dashboard genérico ou copy de alunos do YouTube, ela conecta na sua conta real e gera diagnósticos causais em português direto.</p>
      <h2>Pontos fortes</h2>
      <ul>
        <li><strong>Velocidade</strong> — 2 min do conectar até primeiro insight útil</li>
        <li><strong>Linguagem</strong> — fala como gestor brasileiro (não tradução)</li>
        <li><strong>Razão causal</strong> — não diz só "X tá ruim", diz "X tá ruim porque Y, faz Z"</li>
        <li><strong>Preço</strong> — Maker R$ 49 / Pro R$ 149 / Studio R$ 349 — bem abaixo de gringas</li>
        <li><strong>Aprendizado</strong> — cada decisão tua treina o modelo</li>
      </ul>
      <h2>Limitações honestas</h2>
      <ul>
        <li>Foco em Meta Ads — não cobre Google Ads, TikTok Ads ainda</li>
        <li>Mercado BR — outros países podem ter calibração subótima</li>
        <li>Produto novo — base de dados ainda crescendo</li>
      </ul>
      <h2>Pra quem vale</h2>
      <p>Vale se: você gasta R$ 1k+/mês em Meta, é gestor sozinho ou agência, e cansou de planilha. Não vale se: você tem só 1 conta pequena com R$ 200/mês — nesse caso, manual ainda é OK.</p>
    `,
    related: [
      { slug: "alternativa-adspy", label: "Vs AdSpy" },
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },
  {
    slug: "melhor-software-meta-ads-brasil",
    title: "Melhor Software pra Meta Ads no Brasil em 2026 — AdBrief",
    description:
      "Comparativo dos melhores softwares de gestão de Meta Ads no Brasil em 2026. Por que AdBrief lidera em PT direto, preço justo e diagnóstico causal.",
    h1: "Melhor software pra Meta Ads no Brasil em 2026",
    bodyHTML: `
      <p>Em 2026, gestor BR tem opções: ferramentas gringas (AdSpy, Minea, BigSpy) que custam US$, agências de tráfego que cobram R$ 3-10k/mês, ou planilha. Faltava uma opção brasileira de IA acessível.</p>
      <h2>Critérios pra escolher</h2>
      <ul>
        <li><strong>Idioma</strong> — interface e suporte em PT diminui 80% da fricção</li>
        <li><strong>Pagamento em real</strong> — sem IOF, sem cotação flutuando</li>
        <li><strong>Conexão direta com Meta</strong> — não dá pra otimizar conta sem ler dados reais</li>
        <li><strong>Razão causal</strong> — dashboard genérico não substitui senior media buyer</li>
        <li><strong>Preço relativo</strong> — pagar R$ 49-349/mês faz sentido pra quem gasta R$ 1k+</li>
      </ul>
      <h2>Por que AdBrief</h2>
      <p>AdBrief é o único software brasileiro de IA pra Meta Ads que combina: PT nativo, integração direta via Meta API, diagnóstico causal (não só dado), pagamento em real, e preço acessível pra gestor solo.</p>
    `,
    related: [
      { slug: "review-adbrief", label: "Review AdBrief" },
      { slug: "alternativa-adspy", label: "Vs AdSpy" },
      { slug: "ia-meta-ads-portugues", label: "IA em PT" },
    ],
  },
  {
    slug: "gestao-multi-conta-meta-ads",
    title: "Gestão Multi-Conta Meta Ads — Como Operar 10+ Clientes sem Quebrar",
    description:
      "Gerenciar 10+ contas Meta sozinho ou com pequena equipe é ladeira pra abandonar cliente. Veja como AdBrief consolida a operação multi-conta.",
    h1: "Gestão multi-conta Meta Ads sem perder o controle",
    bodyHTML: `
      <p>Toda agência que cresce passa pelo mesmo gargalo: 5 clientes você dá conta, 10 fica difícil, 15+ você tá apagando incêndio o dia inteiro. A única saída até agora era contratar gestor sênior por R$ 8-15k/mês.</p>
      <p>AdBrief muda essa equação. Você conecta todas as contas, e o sistema te entrega painel consolidado com priorização cross-conta. Cliente que tá vazando R$ 200/dia aparece no topo, cliente estável fica em segundo plano.</p>
      <h2>Capacidades multi-conta</h2>
      <ul>
        <li>Painel único com todas as contas priorizadas por urgência</li>
        <li>Histórico de decisões por cliente (rastreabilidade pra audit)</li>
        <li>Relatórios mensais prontos pra mandar pro cliente</li>
        <li>Alertas em tempo real quando algo crítico aparece</li>
        <li>Aprendizado consolidado entre contas similares</li>
      </ul>
      <p>Plano Studio — R$ 349/mês com contas ilimitadas. Substitui R$ 8k/mês de gestor sênior pra operação repetitiva.</p>
    `,
    related: [
      { slug: "ferramenta-agencia-meta-ads", label: "AdBrief pra Agências" },
      { slug: "ferramenta-gestor-trafego-ia", label: "Pra Gestor Solo" },
    ],
  },
];

/** Lookup helper used by BofuPage component. */
export function getBofuPageBySlug(slug: string): BofuPage | null {
  return BOFU_PAGES.find((p) => p.slug === slug) ?? null;
}
