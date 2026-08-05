/**
 * Regras compartilhadas para geração de criativos.
 *
 * Este arquivo concentra instruções que devem ser reutilizadas pelas receitas
 * de workflow. Ele não executa nenhuma geração e não conhece o formato do
 * grafo: apenas monta prompts consistentes.
 */

/**
 * Garante que o modelo gere uma peça completa, e não uma apresentação com
 * várias opções, mosaicos ou anúncios lado a lado.
 */
export const SINGLE_CREATIVE_RULE = `
REGRA DE COMPOSIÇÃO:
- Gere UMA ÚNICA peça publicitária ocupando 100% do quadro.
- A imagem final deve ser o próprio anúncio, e não uma apresentação do anúncio.
- Não crie mosaico, grade, colagem, sequência de quadros ou múltiplos painéis.
- Não mostre duas ou mais versões lado a lado.
- Não gere comparativos dividindo a imagem em vários anúncios independentes.
- Não coloque a peça dentro de mockup de celular, computador, outdoor ou interface de aplicativo.
- Use uma única cena, uma única composição e uma única mensagem principal.
- Todos os elementos devem fazer parte da mesma peça visual.
`.trim();

/**
 * Impede que o modelo invente informações comerciais ou coloque texto demais
 * dentro da imagem.
 */
export const TEXT_DISCIPLINE_RULE = `
REGRA DE TEXTO:
- Use somente informações presentes no briefing.
- Não invente preços, descontos, percentuais, prazos, resultados, depoimentos, avaliações, números, garantias, selos ou benefícios.
- Não invente escassez, urgência, disponibilidade limitada ou contagem regressiva.
- Não invente nomes de pessoas, empresas, veículos de imprensa ou especialistas.
- Use no máximo uma headline principal.
- Não duplique palavras ou frases.
- Não transforme a imagem em um cartaz cheio de texto.
- Evite parágrafos, listas extensas ou blocos longos.
- Todo texto inserido deve ser curto, correto e legível em uma tela de celular.
- Não inclua textos decorativos sem função estratégica.
- Caso nenhuma headline seja explicitamente solicitada, priorize a composição visual e não invente uma chamada.
`.trim();

/**
 * Orienta o modelo a produzir uma peça com hierarquia visual e aparência de
 * anúncio real, evitando o visual genérico associado a templates automáticos.
 */
export const PERFORMANCE_CREATIVE_RULE = `
REGRA DE PERFORMANCE:
- A mensagem principal deve ser compreendida nos primeiros segundos.
- Crie uma hierarquia visual clara: primeiro o foco principal, depois a mensagem e por último os elementos de apoio.
- Dê destaque imediato ao produto, à pessoa, ao benefício ou à tensão central do anúncio.
- Use contraste suficiente entre fundo, elementos principais e texto.
- Preserve espaço negativo para evitar uma composição apertada ou confusa.
- Evite excesso de elementos decorativos, efeitos, brilhos, ícones e formas sem função.
- Evite aparência de template genérico, apresentação corporativa ou arte produzida automaticamente.
- A peça deve parecer um anúncio real criado especificamente para esta oferta e este público.
- Use uma direção visual coerente, intencional e plausível para a categoria anunciada.
- Não tente comunicar vários benefícios, dores ou ideias ao mesmo tempo.
- Priorize uma única promessa, tensão ou demonstração.
`.trim();

export interface BuildCreativePromptArgs {
  /** Produto, serviço, promoção ou oferta anunciada. */
  offer: string;

  /** Público para quem a peça será criada. */
  audience?: string;

  /** Nome curto do ângulo, por exemplo: dor, resultado ou prova. */
  angle: string;

  /** Instrução concreta de como o ângulo deve aparecer na peça. */
  angleInstruction: string;

  /**
   * Instrução opcional sobre a headline.
   *
   * Exemplos:
   * - "Use exatamente a headline: Pare de estudar. Comece a falar."
   * - "Não inclua headline nesta peça."
   */
  headlineInstruction?: string;

  /** Informações adicionais específicas da receita. */
  extraContext?: string;
}

function normalizeText(value: string | undefined): string {
  return (value || "").trim();
}

/**
 * Monta o prompt final de uma ramificação de criativo.
 *
 * Cada chamada desta função deve representar uma única estratégia e uma única
 * imagem. Não passe vários ângulos dentro de angleInstruction.
 */
export function buildCreativePrompt(
  args: BuildCreativePromptArgs,
): string {
  const offer = normalizeText(args.offer);
  const audience = normalizeText(args.audience);
  const angle = normalizeText(args.angle);
  const angleInstruction = normalizeText(args.angleInstruction);
  const headlineInstruction = normalizeText(args.headlineInstruction);
  const extraContext = normalizeText(args.extraContext);

  const sections: string[] = [
    "Crie uma peça publicitária de performance com base no briefing abaixo.",
    "",
    "OFERTA:",
    offer || "Oferta não informada.",
  ];

  if (audience) {
    sections.push(
      "",
      "PÚBLICO:",
      audience,
    );
  }

  sections.push(
    "",
    "ÂNGULO DESTA PEÇA:",
    angle || "Ângulo não informado.",
    "",
    "COMO MATERIALIZAR O ÂNGULO:",
    angleInstruction || "Trabalhe somente uma ideia principal nesta peça.",
  );

  if (headlineInstruction) {
    sections.push(
      "",
      "INSTRUÇÃO DE HEADLINE:",
      headlineInstruction,
    );
  }

  if (extraContext) {
    sections.push(
      "",
      "CONTEXTO ADICIONAL:",
      extraContext,
    );
  }

  sections.push(
    "",
    SINGLE_CREATIVE_RULE,
    "",
    TEXT_DISCIPLINE_RULE,
    "",
    PERFORMANCE_CREATIVE_RULE,
    "",
    "ENTREGA FINAL:",
    "- Entregue somente uma peça publicitária final.",
    "- Não explique as decisões de design.",
    "- Não apresente alternativas.",
    "- Não inclua bordas, legendas externas ou comentários fora da peça.",
  );

  return sections.join("\n");
}

/**
 * Bloco completo de regras, útil em receitas que já montam o próprio briefing
 * e precisam apenas acrescentar as restrições compartilhadas.
 */
export const CREATIVE_PROMPT_RULES = [
  SINGLE_CREATIVE_RULE,
  TEXT_DISCIPLINE_RULE,
  PERFORMANCE_CREATIVE_RULE,
].join("\n\n");
