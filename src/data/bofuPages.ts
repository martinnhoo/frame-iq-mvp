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

  // ── ADDITIONAL BOFU LANDING PAGES (round 2) ─────────────────────────────
  {
    slug: "ia-gratuita-meta-ads",
    title: "IA Gratuita pra Meta Ads — Teste 3 Dias sem Cartão | AdBrief",
    description:
      "Teste a IA do AdBrief de graça por 3 dias, sem cartão. Conecte sua conta Meta e veja em 2 minutos o que está vazando R$ na sua operação.",
    h1: "IA gratuita pra Meta Ads — teste antes de pagar",
    bodyHTML: `
      <p>O AdBrief tem teste de 3 dias completamente gratuito — não pede cartão, não cobra renovação automática se você não confirmar. É a forma mais honesta de provar o produto antes de qualquer compromisso.</p>
      <h2>O que dá pra fazer no teste grátis</h2>
      <ul>
        <li>Conectar 1 conta Meta Ads via OAuth oficial</li>
        <li>Receber diagnóstico causal completo dos últimos 30 dias</li>
        <li>Ver recomendações priorizadas por R$ economizado/dia</li>
        <li>Executar ações (pause, scale) com 1 clique de confirmação</li>
        <li>Acessar histórico de decisões e padrões aprendidos</li>
      </ul>
      <h2>Por que 3 dias e não 14</h2>
      <p>3 dias é tempo suficiente pra você ver valor real (primeiro insight em 2 min, validação em 24-72h). Trial mais longo = você esquece. Mantemos curto pra forçar decisão honesta: ou faz sentido (assina) ou não (cancela). Sem zona cinzenta.</p>
      <p>Se quiser plano gratuito permanente, temos o Free — limite de 3 análises por dia, sem ações automatizadas. Pra explorar sem compromisso.</p>
    `,
    related: [
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
      { slug: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" },
    ],
  },
  {
    slug: "como-criar-criativo-meta-ads-com-ia",
    title: "Como Criar Criativo Meta Ads com IA — Guia 2026 | AdBrief",
    description:
      "Use IA pra acelerar produção de criativo Meta Ads sem perder qualidade. Hooks, scripts, briefs — fluxo completo pra gestor que produz no volume.",
    h1: "Como criar criativo Meta Ads com IA (guia 2026)",
    bodyHTML: `
      <p>Produzir criativo é gargalo em quase toda conta. Você precisa de 3-5 variações novas por semana pra evitar fadiga, mas editar vídeo do zero leva horas. IA bem usada acelera o ciclo sem sacrificar conversão.</p>
      <h2>Fluxo recomendado</h2>
      <ol>
        <li><strong>Hook (10 min)</strong> — gera 5-10 hooks com IA baseado em ângulos diferentes (problema, prova social, curiosidade, etc). Escolhe os 2-3 mais fortes.</li>
        <li><strong>Script (15 min)</strong> — pra cada hook escolhido, IA gera script de 30s estruturado em 4 atos.</li>
        <li><strong>Brief de produção (5 min)</strong> — IA traduz script em board com cenas, ângulos, objetos, fala. Manda direto pro editor ou UGC creator.</li>
        <li><strong>Análise pós-publicação (2 min)</strong> — depois de 48h no ar, IA olha métricas e te diz qual variação está funcionando e qual pausar.</li>
      </ol>
      <p>Tempo total do "ideia" ao "publicado": 1-2h em vez de 1-2 dias. AdBrief automatiza o passo 1 e 4. Pros 2 e 3 você pode usar AdBrief também ou outras ferramentas como Runway, ElevenLabs, etc.</p>
    `,
    related: [
      { slug: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },
  {
    slug: "automatizar-gestao-meta-ads",
    title: "Como Automatizar Gestão de Meta Ads — Sem Perder Controle | AdBrief",
    description:
      "Automatize o que é repetitivo, mantenha controle no estratégico. Veja como AdBrief automatiza diagnóstico + ação sem virar piloto automático cego.",
    h1: "Como automatizar gestão de Meta Ads sem perder o controle",
    bodyHTML: `
      <p>Automatizar Meta Ads é tentação grande — promete liberar tempo, eliminar erro humano, escalar operação. Mas automação burra (regras hardcoded tipo "se CPA > X, pause") é receita pra quebrar campanha. Boa automação requer inteligência por cima.</p>
      <h2>O que automatizar (e o que NÃO)</h2>
      <p><strong>Pode automatizar:</strong> diagnóstico (quem tá ruim e por quê), priorização (qual atacar primeiro), execução repetitiva (pause/scale com regra clara), reporting (gerar PDF mensal pro cliente).</p>
      <p><strong>Não automatize:</strong> decisões estratégicas (qual nicho explorar), decisões irreversíveis (deletar campanha sem revisar), aprovação final de mudança crítica em conta de cliente grande.</p>
      <h2>Como AdBrief automatiza com segurança</h2>
      <ul>
        <li>IA detecta problema → sugere ação → você aprova com 1 clique (humano sempre no meio)</li>
        <li>Cada ação fica registrada com causa e resultado medido em 24-72h</li>
        <li>Se ação não melhora, IA aprende e propõe diferente da próxima vez</li>
        <li>Limites configuráveis (ex: nunca pausar adset com gasto > R$ X sem confirmação extra)</li>
      </ul>
    `,
    related: [
      { slug: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" },
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
    ],
  },
  {
    slug: "alternativa-supermetrics-portugues",
    title: "Alternativa ao Supermetrics em Português — AdBrief",
    description:
      "Supermetrics extrai dados de Meta Ads pra planilhas. AdBrief vai além: lê os dados, diagnostica problemas e te diz o que fazer. Veja a diferença.",
    h1: "Alternativa ao Supermetrics: AdBrief lê os dados E te diz o que fazer",
    bodyHTML: `
      <p>Supermetrics é ETL de marketing — pega dados de Meta, Google, TikTok e bota em Sheets/BigQuery. Útil pra reporting custom, mas você ainda precisa olhar a planilha e decidir tudo manualmente.</p>
      <p>AdBrief é a camada acima: ele JÁ lê os dados (não precisa exportar pra lugar nenhum) e gera a análise + recomendação direto. Você pula a etapa de "abrir planilha, identificar padrão, escrever próxima ação". A IA faz isso.</p>
      <h2>Quando AdBrief substitui Supermetrics</h2>
      <ul>
        <li>Você só usa Supermetrics pra reportar Meta Ads (não Google/TikTok consolidado)</li>
        <li>Você precisa mais de "o que fazer" do que "número exportado"</li>
        <li>Quer pagar em real, em PT (Supermetrics é US$ 39/mês mínimo)</li>
      </ul>
      <h2>Quando combinar os dois</h2>
      <p>Se sua agência precisa consolidar 5 plataformas (Meta + Google + TikTok + LinkedIn + email) em dashboard custom, Supermetrics ainda faz sentido pra ETL. AdBrief complementa fazendo a análise causal só do Meta.</p>
    `,
    related: [
      { slug: "alternativa-adspy", label: "Vs AdSpy" },
      { slug: "ferramenta-agencia-meta-ads", label: "Pra Agências" },
    ],
  },
  {
    slug: "alternativa-triple-whale-brasil",
    title: "Alternativa ao Triple Whale no Brasil — AdBrief",
    description:
      "Triple Whale é gringo, em dólar, focado em Shopify. AdBrief é brasileiro, em real, focado em Meta Ads de gestor BR. Veja qual faz sentido pra você.",
    h1: "Alternativa ao Triple Whale: AdBrief é Meta-first, BR-first",
    bodyHTML: `
      <p>Triple Whale é excelente pra DTC US-based em Shopify — atribuição multi-touch, dashboard consolidado, integração nativa. Mas é caro (US$ 100+/mês), gringo, e foca DTC e-commerce.</p>
      <p>AdBrief é diferente: foca exclusivamente em Meta Ads (não tem Shopify, não tem multi-touch attribution), em PT, pagamento em real, pra qualquer nicho (não só e-com).</p>
      <h2>Comparativo direto</h2>
      <ul>
        <li><strong>Foco:</strong> Triple Whale = DTC e-commerce. AdBrief = Meta Ads pra gestor/agência BR.</li>
        <li><strong>Preço:</strong> Triple Whale = US$ 100+/mês. AdBrief = R$ 49-349/mês.</li>
        <li><strong>Idioma:</strong> Triple Whale = inglês. AdBrief = PT nativo.</li>
        <li><strong>Atribuição:</strong> Triple Whale tem multi-touch. AdBrief usa atribuição da própria Meta (mais simples).</li>
        <li><strong>Diagnóstico causal:</strong> Triple Whale mostra dados. AdBrief explica o porquê + plano de ação.</li>
      </ul>
    `,
    related: [
      { slug: "alternativa-supermetrics-portugues", label: "Vs Supermetrics" },
      { slug: "alternativa-adspy", label: "Vs AdSpy" },
    ],
  },
  {
    slug: "como-saber-se-anuncio-cansou",
    title: "Como Saber se Anúncio Cansou no Meta Ads — Guia 2026",
    description:
      "4 sinais práticos pra identificar fadiga criativa no Meta Ads antes do CPA disparar. Frequência, CTR, CPM, engajamento.",
    h1: "Como saber se seu anúncio cansou no Meta Ads",
    bodyHTML: `
      <p>"Anúncio cansado" é jargão de gestor pra criativo que parou de funcionar — público viu demais, virou ruído, parou de clicar. CPA dispara e você se pergunta o que aconteceu. Tem 4 sinais cristalinos pra detectar antes do estrago.</p>
      <h2>Os 4 sinais clássicos</h2>
      <ol>
        <li><strong>Frequência > 3</strong> — pessoa viu o ad 3x ou mais. A partir daí, cada exposição extra rende menos.</li>
        <li><strong>CTR caindo dia a dia</strong> — em 7-10 dias, se CTR caiu 30%+, é fadiga.</li>
        <li><strong>CPM subindo</strong> — Meta cobra mais quando criativo não engaja. Sinal correlato de fadiga.</li>
        <li><strong>Comments/likes orgânicos secando</strong> — engajamento social cai antes do CTR. Leading indicator forte.</li>
      </ol>
      <h2>O que fazer quando confirmado</h2>
      <p>Pause o criativo cansado, não o adset inteiro. Crie 2-3 variações novas (mesma oferta, hook diferente, ângulo diferente, formato diferente). Ative no mesmo adset — Meta usa o budget acumulado e a segmentação que já funcionava. Quase sempre o adset volta a performar.</p>
      <p>Pra automatizar essa detecção: AdBrief monitora os 4 sinais 24/7 em todos os teus criativos e te avisa quando passa do limiar — antes do CPA explodir.</p>
    `,
    related: [
      { slug: "como-detectar-criativo-cansado", label: "Detectar criativo cansado" },
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
    ],
  },
  {
    slug: "diagnostico-conta-meta-ads-gratis",
    title: "Diagnóstico Grátis da Sua Conta Meta Ads — AdBrief",
    description:
      "Diagnóstico completo da sua conta Meta Ads em 2 minutos, gratuito por 3 dias. Conecte a conta e descubra o que está vazando R$ na operação.",
    h1: "Diagnóstico grátis da sua conta Meta Ads",
    bodyHTML: `
      <p>Conhece a sensação de olhar o dashboard do Meta e não saber por onde começar? AdBrief faz o diagnóstico em 2 minutos: conecta na sua conta, lê tudo, e te entrega lista priorizada do que tá vazando R$ AGORA.</p>
      <h2>O diagnóstico inclui</h2>
      <ul>
        <li><strong>Health score geral da conta</strong> — saúde financeira, tracking, criativo, audience</li>
        <li><strong>Anúncios que estão queimando R$/dia</strong> — priorizados por impacto</li>
        <li><strong>Adsets com fadiga ou audience errada</strong></li>
        <li><strong>Oportunidades de escala</strong> — winners detectados precocemente</li>
        <li><strong>Problemas de tracking</strong> — pixel quebrado, eventos não disparando</li>
        <li><strong>Plano de ação priorizado por R$</strong></li>
      </ul>
      <h2>Como funciona</h2>
      <p>1. Cria conta gratuita (1 min). 2. Conecta sua Meta via OAuth oficial (30s). 3. Aguarda o AdBrief ler 30 dias de dados (1 min). 4. Recebe relatório completo. Sem cartão de crédito pro teste de 3 dias.</p>
    `,
    related: [
      { slug: "auditoria-meta-ads-ia", label: "Auditoria detalhada" },
      { slug: "ia-gratuita-meta-ads", label: "Teste 3 dias grátis" },
    ],
  },
  {
    slug: "agencia-trafego-pago-quanto-cobrar-2026",
    title: "Quanto Cobrar como Agência de Tráfego Pago em 2026 — Guia Real",
    description:
      "Tabela atualizada de quanto agências brasileiras cobram pra rodar Meta Ads em 2026. Por nicho, por tamanho de conta, por modelo (fee/fixo/%).",
    h1: "Quanto cobrar como agência de tráfego pago em 2026 (tabela real)",
    bodyHTML: `
      <p>Pricing de agência de tráfego é zona cinzenta — varia muito por nicho, tamanho de conta, modelo de cobrança, e estado emocional do gestor que tá cobrando. Aqui vai um benchmark realista pra 2026 baseado no mercado BR.</p>
      <h2>Modelos de cobrança</h2>
      <ul>
        <li><strong>Fee fixo mensal</strong> — mais comum pra contas até R$ 30k/mês de gasto. R$ 1.500-5.000/mês.</li>
        <li><strong>% sobre o gasto</strong> — pra contas R$ 30k+/mês. 10-20% do que o cliente gasta.</li>
        <li><strong>Performance (% sobre venda/lead)</strong> — alto risco, alto prêmio. 5-15% sobre revenue gerada.</li>
        <li><strong>Híbrido</strong> — fee fixo + % de bônus se bater meta. Mais comum em contas grandes.</li>
      </ul>
      <h2>Tabela por nicho (BR, 2026)</h2>
      <ul>
        <li><strong>E-commerce pequeno (gasto até R$ 10k):</strong> R$ 1.500-3.000/mês</li>
        <li><strong>E-commerce médio (R$ 10-50k):</strong> R$ 3.000-7.000/mês ou 12-15%</li>
        <li><strong>Info-produto:</strong> R$ 2.500-6.000/mês + bônus por venda</li>
        <li><strong>Local (clínica, escritório):</strong> R$ 1.200-2.500/mês</li>
        <li><strong>SaaS B2B:</strong> R$ 4.000-10.000/mês</li>
      </ul>
      <p>Pra escalar agência sem pirar: usa AdBrief pra automatizar diagnóstico e reduzir tempo por conta. Substitui R$ 8k/mês de gestor sênior em contas repetitivas.</p>
    `,
    related: [
      { slug: "ferramenta-agencia-meta-ads", label: "Ferramenta pra Agências" },
      { slug: "gestao-multi-conta-meta-ads", label: "Gestão Multi-Conta" },
    ],
  },
  {
    slug: "gestor-trafego-salario-quanto-ganha-2026",
    title: "Quanto Ganha um Gestor de Tráfego em 2026 — Salário e Freelance",
    description:
      "Salário real de gestor de tráfego no Brasil em 2026: CLT, PJ, freelancer. Por experiência, por tamanho de empresa, por nicho.",
    h1: "Quanto ganha um gestor de tráfego em 2026 (BR, dado real)",
    bodyHTML: `
      <p>Salário de gestor de tráfego no Brasil em 2026 varia bastante — depende muito de experiência, tamanho da operação, e modalidade (CLT, PJ, freelancer multi-cliente).</p>
      <h2>Faixas reais</h2>
      <ul>
        <li><strong>Júnior (CLT, &lt;1 ano exp):</strong> R$ 2.500-4.500/mês</li>
        <li><strong>Pleno (CLT, 1-3 anos):</strong> R$ 4.500-8.000/mês</li>
        <li><strong>Sênior (CLT, 3+ anos):</strong> R$ 8.000-15.000/mês</li>
        <li><strong>PJ em agência (1-3 contas):</strong> R$ 6.000-12.000/mês</li>
        <li><strong>Freelancer com 5-10 clientes:</strong> R$ 10.000-25.000/mês (varia muito)</li>
        <li><strong>Owner de agência:</strong> R$ 20.000-100.000+/mês (margem sobre fee)</li>
      </ul>
      <h2>O que faz subir salário</h2>
      <ul>
        <li>Especialização por nicho (e-commerce > info > local)</li>
        <li>Capacidade de lead generation (vender pra mais clientes)</li>
        <li>Capacidade de produzir criativo (não só comprar mídia)</li>
        <li>Domínio de ferramentas avançadas (analytics, CAPI, AdBrief)</li>
        <li>Resultado mensurável (case studies que mostram ROI)</li>
      </ul>
      <p>Quem usa AdBrief pra gerenciar mais contas com mesma qualidade tipicamente sai do "cobro R$ 2.5k por cliente, atendo 5" pra "cobro R$ 4k por cliente, atendo 12". É leverage real, não promessa.</p>
    `,
    related: [
      { slug: "ferramenta-gestor-trafego-ia", label: "Pra Gestor de Tráfego" },
      { slug: "agencia-trafego-pago-quanto-cobrar-2026", label: "Quanto cobrar como agência" },
    ],
  },
  {
    slug: "tracking-meta-ads-conversions-api-portugues",
    title: "Tracking Meta Ads + Conversions API em PT — Guia 2026",
    description:
      "Configurar tracking Meta Ads em 2026: pixel + Conversions API + iOS 18. Passo-a-passo prático pra gestor BR não perder conversão por tracking quebrado.",
    h1: "Tracking Meta Ads em 2026: pixel + Conversions API",
    bodyHTML: `
      <p>Tracking quebrado é uma das causas mais comuns de "Meta Ads parou de funcionar" em 2026. iOS 18, GDPR/LGPD, ad blockers, browser tracking prevention — tudo conspira pra que pixel sozinho perca dados.</p>
      <h2>Stack completo recomendado</h2>
      <ol>
        <li><strong>Meta Pixel</strong> — base, sempre obrigatório. Captura eventos no browser.</li>
        <li><strong>Conversions API (CAPI)</strong> — envia eventos do servidor pra Meta direto, contornando ad blocker.</li>
        <li><strong>Server-Side GTM</strong> — opcional, mas dobra qualidade do tracking pra contas com gasto alto.</li>
        <li><strong>UTM consistente</strong> — pra atribuição cross-device e debug.</li>
      </ol>
      <h2>Como saber se tracking tá quebrado</h2>
      <ul>
        <li>Eventos não aparecem no Meta Events Manager dentro de 5 min</li>
        <li>Conversões muito menores que vendas reais (gap > 30% = problema sério)</li>
        <li>Atribuição errada (tudo virando "direto" no Analytics)</li>
        <li>Diagnóstico do AdBrief flagging "tracking gap"</li>
      </ul>
      <p>AdBrief detecta tracking quebrado automaticamente e te diz se é pixel, evento, ou Conversions API com problema — economiza horas de debug.</p>
    `,
    related: [
      { slug: "auditoria-meta-ads-ia", label: "Auditoria com IA" },
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
    ],
  },
  {
    slug: "como-estruturar-campanha-meta-ads-do-zero",
    title: "Como Estruturar Campanha Meta Ads do Zero — Passo a Passo 2026",
    description:
      "Estrutura completa de campanha Meta Ads pra 2026: do objetivo ao retargeting. CBO vs ABO, audience, criativo, budget, escala.",
    h1: "Como estruturar campanha Meta Ads do zero (passo a passo 2026)",
    bodyHTML: `
      <p>Estrutura de campanha Meta Ads em 2026 é mais simples do que era em 2020 — Meta consolidou muito da otimização internamente. Mas erro estrutural ainda destrói conta. Aqui vai o playbook que funciona.</p>
      <h2>1. Objetivo de campanha</h2>
      <ul>
        <li>Pra venda direta: <strong>Vendas</strong> com otimização Compra (ou Initiate Checkout se Compra ainda não tem 50/semana)</li>
        <li>Pra lead: <strong>Leads</strong> com otimização "Forms" se usar Lead Ad, ou "Conversões" se WhatsApp/landing</li>
        <li>Pra agendamento (clínica, serviço): <strong>Vendas</strong> + evento custom de "Schedule"</li>
        <li><strong>Não use:</strong> Tráfego, Engagement, Awareness — eles otimizam pra cliques baratos, não conversão</li>
      </ul>
      <h2>2. CBO vs ABO</h2>
      <p>Em 2026, CBO (Campaign Budget Optimization) ganhou: Meta distribui budget entre adsets melhor que humano. Use ABO só pra teste de criativo (1 adset = 1 criativo, mesma audience, comparar performance).</p>
      <h2>3. Audience</h2>
      <ul>
        <li><strong>Cold:</strong> Advantage+ Audience (a Meta escolhe) ou interest broad (1M+ pessoas)</li>
        <li><strong>Warm:</strong> Lookalike 1-3% baseado em compradores</li>
        <li><strong>Retargeting:</strong> Visitors 30 dias + Carrinho abandonado + Engagers Insta/FB</li>
      </ul>
      <h2>4. Criativo</h2>
      <p>Mínimo 3-5 variações por adset. Mistura formato (vídeo curto, imagem, carrossel). Refresh a cada 2-3 semanas.</p>
      <h2>5. Budget e escala</h2>
      <p>Começa com R$ 50-100/dia por adset pra sair do learning phase em 7 dias. Quando funcionar, escala 20-30%/dia.</p>
      <p>AdBrief monitora cada uma dessas camadas e te avisa quando algo precisa de ajuste — economiza tempo de revisar cada estrutura toda semana.</p>
    `,
    related: [
      { slug: "como-escalar-meta-ads-sem-perder-roas", label: "Como escalar sem perder ROAS" },
      { slug: "como-reduzir-cpa-meta-ads", label: "Como reduzir CPA" },
    ],
  },
  {
    slug: "ferramenta-relatorio-meta-ads-cliente",
    title: "Ferramenta de Relatório Meta Ads pra Cliente — AdBrief",
    description:
      "Gere relatórios mensais lindos pra cliente em 1 clique. Métricas + insights causais + plano de ação, em PT, pronto pra mandar via WhatsApp ou email.",
    h1: "Ferramenta pra gerar relatório Meta Ads pro cliente em 1 clique",
    bodyHTML: `
      <p>Toda agência odeia o ritual mensal de "compilar relatório pro cliente". Pegar dados do Meta Ads Manager, montar PDF/Slides, escrever insights — fácil consumir 4-6h por cliente. Multiplica por 10 clientes = sábado inteiro.</p>
      <h2>O que AdBrief gera automaticamente</h2>
      <ul>
        <li>Resumo de spend, conversões, ROAS, CPA do mês</li>
        <li>Comparativo vs mês anterior (delta % por métrica)</li>
        <li>Top 3 anúncios que mais converteram</li>
        <li>Top 3 anúncios que mais queimaram budget</li>
        <li>Insights causais ("CPA caiu 15% porque pausamos adset X em DD/MM")</li>
        <li>Plano de ação proposto pro próximo mês</li>
      </ul>
      <p>Tudo em PT direto, formato pronto pra mandar via WhatsApp ou email. Branded com sua agência (logo, cores, footer custom).</p>
      <h2>Tempo poupado por cliente</h2>
      <p>Antes: 4-6h por cliente, mensal. Depois: 10-15 min pra revisar e personalizar antes de mandar. Pra agência com 10 clientes, economiza 35-50h/mês — equivale a 1 funcionário PJ part-time.</p>
    `,
    related: [
      { slug: "ferramenta-agencia-meta-ads", label: "Pra Agências" },
      { slug: "gestao-multi-conta-meta-ads", label: "Multi-Conta" },
    ],
  },
];

/** Lookup helper used by BofuPage component. */
export function getBofuPageBySlug(slug: string): BofuPage | null {
  return BOFU_PAGES.find((p) => p.slug === slug) ?? null;
}
