/**
 * Receitas de automação do AdBrief.
 *
 * Cada receita transforma um formulário curto
 * no mesmo WfGraph executado pelo modo avançado.
 *
 * Toda receita é validada antes de ser entregue
 * ao banco ou ao executor.
 */

import {
  CREDIT_COSTS,
  getVoiceCost,
} from "./hubPlans";

import {
  buildCreativePrompt,
  CREATIVE_PROMPT_RULES,
} from "./creativePromptRules";

import type {
  WfEdge,
  WfGraph,
  WfNode,
} from "./workflowTypes";

import {
  validateWorkflowGraph,
} from "./workflowValidation";

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "brand"
  | "voice";

export interface RecipeField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: {
    value: string;
    label: string;
    hint?: string;
  }[];
  default?: string | number;
  min?: number;
  max?: number;
}

export interface Recipe {
  id: string;
  name: string;
  outcome: string;
  whenToUse: string;
  icon: string;
  fields: RecipeField[];

  build: (
    answers: Record<
      string,
      string
    >,
  ) => WfGraph;

  estimate: (
    answers: Record<
      string,
      string
    >,
  ) => number;
}

export type WorkflowObjective =
  | "static"
  | "video"
  | "campaign"
  | "carousel"
  | "adapt"
  | "social";

/*
 * Esta é a fonte única de verdade
 * entre a Home e Automações.
 */
export const RECIPE_BY_OBJECTIVE:
  Record<
    WorkflowObjective,
    string
  > = {
    static: "criativos-teste",
    video: "anuncio-video",
    campaign: "campanha-teste",
    carousel: "carrossel-oferta",
    adapt: "adaptar-criativo",
    social: "conteudo-social",
  };

let sequence = 0;

function nodeId(
  prefix: string,
): string {
  return (
    `${prefix}-` +
    `${Date.now().toString(36)}-` +
    `${(
      sequence++
    ).toString(36)}`
  );
}

function edge(
  source: string,
  target: string,
  targetHandle: string,
): WfEdge {
  return {
    id:
      `e-${source}-` +
      `${target}-` +
      `${targetHandle}`,
    source,
    target,
    targetHandle,
  };
}

function graph(
  nodes: WfNode[],
  edges: WfEdge[],
): WfGraph {
  const result: WfGraph = {
    version: 1,
    nodes,
    edges,
  };

  const validationError =
    validateWorkflowGraph(
      result,
    );

  if (validationError) {
    throw new Error(
      `Receita inválida: ${validationError}`,
    );
  }

  return result;
}

function brandNode(
  id: string,
  brandId: string,
  x = 40,
  y = 40,
): WfNode {
  return {
    id,
    type: "brand",
    position: { x, y },
    data: {
      brand_id:
        brandId || null,

      include_disclaimer:
        Boolean(brandId),
    },
  };
}

function promptNode(
  id: string,
  text: string,
  x = 40,
  y = 200,
): WfNode {
  return {
    id,
    type: "prompt",
    position: { x, y },
    data: { text },
  };
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    Math.floor(
      Number(value),
    );

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      parsed,
    ),
  );
}

function nonEmptyLines(
  value: string | undefined,
): string[] {
  return (value || "")
    .split("\n")
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

const brandField:
  RecipeField = {
    key: "brand_id",
    label: "Marca",
    kind: "brand",

    help:
      "Aplica o contexto visual, " +
      "o tom e as regras da marca cadastrada.",
  };

const offerField:
  RecipeField = {
    key: "offer",

    label:
      "O que você está vendendo",

    kind: "textarea",
    required: true,

    placeholder:
      "Curso de inglês para quem trava ao falar. " +
      "12 semanas, aulas ao vivo, R$ 197/mês.",

    help:
      "Inclua somente informações reais. " +
      "Quanto mais concreto, melhor o resultado.",
  };

const audienceField:
  RecipeField = {
    key: "audience",
    label: "Para quem",
    kind: "text",
    required: true,

    placeholder:
      "Profissionais de 25 a 40 anos " +
      "que precisam de inglês no trabalho",
  };

const formatOptions = [
  {
    value: "9:16",
    label: "Vertical",
    hint:
      "Stories, Reels, TikTok",
  },
  {
    value: "1:1",
    label: "Quadrado",
    hint:
      "Feed do Instagram",
  },
  {
    value: "4:5",
    label: "Retrato",
    hint:
      "Feed, ocupa mais tela",
  },
  {
    value: "16:9",
    label: "Horizontal",
    hint:
      "YouTube, display",
  },
];

const formatField:
  RecipeField = {
    key: "aspect_ratio",
    label: "Formato",
    kind: "select",
    default: "9:16",
    options: formatOptions,
  };

const carouselFormatField:
  RecipeField = {
    ...formatField,
    default: "4:5",
  };

const socialFormatField:
  RecipeField = {
    ...formatField,
    default: "4:5",
  };

function countField(
  fallback: number,
  max: number,
): RecipeField {
  return {
    key: "count",
    label: "Quantas versões",
    kind: "number",
    default: fallback,
    min: 1,
    max,

    help:
      "Cada versão usa uma direção estratégica " +
      "diferente, não só outra redação.",
  };
}

interface CreativeDirection {
  id: string;
  label: string;
  instruction: string;
}

const CREATIVE_TEST_ANGLES:
  CreativeDirection[] = [
    {
      id: "dor",
      label: "Dor",

      instruction:
        "Mostre com clareza a situação frustrante " +
        "anterior à solução. A tensão precisa ser " +
        "percebida imediatamente. Não transforme " +
        "a mesma peça em antes e depois.",
    },
    {
      id: "resultado",
      label: "Resultado",

      instruction:
        "Mostre o estado desejado depois de usar " +
        "a oferta. Concentre a composição na " +
        "transformação concreta e no benefício final.",
    },
    {
      id: "prova",
      label: "Prova",

      instruction:
        "Construa a peça em torno de uma evidência " +
        "realmente fornecida no briefing. Não invente " +
        "números, avaliações, depoimentos, certificados " +
        "ou resultados.",
    },
    {
      id: "objecao",
      label: "Objeção",

      instruction:
        "Ataque somente a principal razão pela qual " +
        "o público poderia não comprar e apresente " +
        "a oferta como resposta.",
    },
    {
      id: "mecanismo",
      label: "Mecanismo",

      instruction:
        "Destaque como ou por que a solução funciona. " +
        "Transforme o mecanismo central em uma ideia " +
        "visual simples, sem inventar processos técnicos.",
    },
    {
      id: "urgencia",
      label: "Urgência",

      instruction:
        "Mostre a consequência de continuar adiando " +
        "a decisão. Não invente prazo, estoque, desconto, " +
        "escassez ou contagem regressiva.",
    },
    {
      id: "comparacao",
      label: "Comparação",

      instruction:
        "Contraste a alternativa comum com a proposta " +
        "da oferta dentro de uma única composição, " +
        "sem criar dois anúncios lado a lado.",
    },
    {
      id: "identidade",
      label: "Identidade",

      instruction:
        "Faça o público reconhecer imediatamente que " +
        "a oferta foi criada para alguém como ele, " +
        "usando sinais visuais coerentes e sem caricaturas.",
    },
    {
      id: "demonstracao",
      label: "Demonstração",

      instruction:
        "Mostre o produto, serviço ou processo em uso. " +
        "A demonstração deve ser o foco principal da peça.",
    },
    {
      id: "facilidade",
      label: "Facilidade",

      instruction:
        "Destaque simplicidade, conveniência ou redução " +
        "de esforço somente quando isso estiver " +
        "sustentado pelo briefing.",
    },
    {
      id: "especificidade",
      label: "Especificidade",

      instruction:
        "Use detalhes concretos presentes na oferta, " +
        "como duração, formato, método, quantidade " +
        "ou característica específica.",
    },
    {
      id: "curiosidade",
      label: "Curiosidade",

      instruction:
        "Crie uma lacuna de informação ligada diretamente " +
        "à oferta, sem clickbait ou mistério desconectado " +
        "do produto.",
    },
  ];

const SOCIAL_DIRECTIONS:
  CreativeDirection[] = [
    {
      id: "educativo",
      label: "Educativo",

      instruction:
        "Ensine uma ideia útil e específica ligada " +
        "à oferta. A peça deve ser compreendida sem " +
        "depender de uma legenda longa.",
    },
    {
      id: "problema",
      label:
        "Problema reconhecível",

      instruction:
        "Retrate uma situação cotidiana em que o público " +
        "se reconheça imediatamente, sem exagerar " +
        "ou inventar consequências.",
    },
    {
      id: "bastidor",
      label: "Bastidor",

      instruction:
        "Mostre processo, cuidado, preparação ou rotina " +
        "por trás da entrega, com aparência natural " +
        "e menos publicitária.",
    },
    {
      id: "prova-social",
      label: "Prova social",

      instruction:
        "Use somente evidências presentes no briefing. " +
        "Se não houver prova concreta, mostre o produto " +
        "em contexto real, sem inventar avaliações.",
    },
    {
      id: "oferta",
      label: "Oferta direta",

      instruction:
        "Apresente o que está sendo oferecido com " +
        "hierarquia simples, benefício claro e nenhuma " +
        "informação criada além do briefing.",
    },
    {
      id: "faq",
      label: "Dúvida frequente",

      instruction:
        "Transforme uma dúvida provável e diretamente " +
        "relacionada à oferta em uma peça simples " +
        "de pergunta e resposta visual.",
    },
    {
      id: "identidade",
      label:
        "Identidade da marca",

      instruction:
        "Crie uma peça que reforce personalidade, " +
        "atmosfera e códigos visuais da marca sem " +
        "virar um anúncio genérico de venda.",
    },
  ];

function pickDirections(
  list: CreativeDirection[],
  value: string | undefined,
  fallback: number,
): CreativeDirection[] {
  const count =
    boundedInteger(
      value,
      fallback,
      1,
      list.length,
    );

  return list.slice(
    0,
    count,
  );
}

function buildIndependentImageBranches(
  args: {
    brandId: string;
    offer: string;
    audience: string;
    aspectRatio: string;
    directions:
      CreativeDirection[];
    namePrefix: string;
  },
): WfGraph {
  const brand =
    nodeId("brand");

  const nodes:
    WfNode[] = [
      brandNode(
        brand,
        args.brandId,
        40,
        40,
      ),
    ];

  const edges:
    WfEdge[] = [];

  args.directions.forEach(
    (
      direction,
      index,
    ) => {
      const prompt =
        nodeId(
          `prompt-${direction.id}`,
        );

      const image =
        nodeId(
          `img-${direction.id}`,
        );

      const output =
        nodeId(
          `out-${direction.id}`,
        );

      const rowY =
        160 + index * 230;

      const promptText =
        buildCreativePrompt({
          offer:
            args.offer,

          audience:
            args.audience,

          angle:
            direction.label,

          angleInstruction:
            direction.instruction,

          headlineInstruction:
            "Use no máximo uma headline principal " +
            "baseada apenas nas informações do briefing. " +
            "Se não houver uma chamada segura e concreta, " +
            "priorize a mensagem visual.",

          extraContext:
            `Esta ramificação deve trabalhar somente ` +
            `a direção estratégica "${direction.label}". ` +
            `Não combine duas estratégias principais ` +
            `na mesma peça.`,
        });

      nodes.push(
        promptNode(
          prompt,
          promptText,
          40,
          rowY,
        ),
        {
          id: image,
          type: "image-gen",

          position: {
            x: 440,
            y: rowY,
          },

          data: {
            count: 1,

            aspect_ratio:
              args.aspectRatio,

            quality:
              "medium",
          },
        },
        {
          id: output,
          type: "output",

          position: {
            x: 820,
            y: rowY,
          },

          data: {
            name_template:
              `{date}_` +
              `${args.namePrefix}_` +
              `${direction.id}_` +
              `{slug}`,
          },
        },
      );

      edges.push(
        edge(
          brand,
          image,
          "brand",
        ),
        edge(
          prompt,
          image,
          "prompt",
        ),
        edge(
          image,
          output,
          "asset",
        ),
      );
    },
  );

  return graph(
    nodes,
    edges,
  );
}

function buildCampaignGraph(
  answers: Record<
    string,
    string
  >,
): WfGraph {
  const brand =
    nodeId("brand");

  const nodes:
    WfNode[] = [
      brandNode(
        brand,
        answers.brand_id,
        40,
        40,
      ),
    ];

  const edges:
    WfEdge[] = [];

  const directions =
    CREATIVE_TEST_ANGLES.slice(
      0,
      3,
    );

  const placements = [
    {
      ratio: "4:5",
      id: "feed",
      label: "Feed",
    },
    {
      ratio: "9:16",
      id: "story",
      label:
        "Stories/Reels",
    },
  ];

  let row = 0;

  for (
    const direction
    of directions
  ) {
    for (
      const placement
      of placements
    ) {
      const prompt =
        nodeId(
          `prompt-` +
          `${direction.id}-` +
          `${placement.id}`,
        );

      const image =
        nodeId(
          `img-` +
          `${direction.id}-` +
          `${placement.id}`,
        );

      const output =
        nodeId(
          `out-` +
          `${direction.id}-` +
          `${placement.id}`,
        );

      const rowY =
        160 + row * 230;

      row += 1;

      const promptText =
        buildCreativePrompt({
          offer:
            answers.offer,

          audience:
            answers.audience,

          angle:
            direction.label,

          angleInstruction:
            direction.instruction,

          headlineInstruction:
            "Use no máximo uma headline principal " +
            "baseada somente nas informações reais da oferta.",

          extraContext:
            "Esta peça faz parte de um pacote inicial de campanha. " +
            `Placement: ${placement.label}, ` +
            `formato ${placement.ratio}. ` +
            "Preserve a mesma oferta, mas adapte hierarquia " +
            "e composição ao placement.",
        });

      nodes.push(
        promptNode(
          prompt,
          promptText,
          40,
          rowY,
        ),
        {
          id: image,
          type: "image-gen",

          position: {
            x: 440,
            y: rowY,
          },

          data: {
            count: 1,

            aspect_ratio:
              placement.ratio,

            quality:
              "medium",
          },
        },
        {
          id: output,
          type: "output",

          position: {
            x: 820,
            y: rowY,
          },

          data: {
            name_template:
              `{date}_campanha_` +
              `${direction.id}_` +
              `${placement.id}_` +
              `{slug}`,
          },
        },
      );

      edges.push(
        edge(
          brand,
          image,
          "brand",
        ),
        edge(
          prompt,
          image,
          "prompt",
        ),
        edge(
          image,
          output,
          "asset",
        ),
      );
    }
  }

  return graph(
    nodes,
    edges,
  );
}

export const RECIPES:
  Recipe[] = [
    {
      id:
        "criativos-teste",

      name:
        "Criar um lote de criativos para testar",

      outcome:
        "Imagens da mesma oferta com estratégias realmente diferentes.",

      whenToUse:
        "Você tem uma oferta e ainda não sabe qual mensagem vai performar.",

      icon: "▦",

      fields: [
        brandField,
        offerField,
        audienceField,
        formatField,
        countField(
          4,
          12,
        ),
      ],

      build:
        (answers) =>
          buildIndependentImageBranches({
            brandId:
              answers.brand_id,

            offer:
              answers.offer,

            audience:
              answers.audience,

            aspectRatio:
              answers.aspect_ratio ||
              "9:16",

            directions:
              pickDirections(
                CREATIVE_TEST_ANGLES,
                answers.count,
                4,
              ),

            namePrefix:
              "teste",
          }),

      estimate:
        (answers) =>
          pickDirections(
            CREATIVE_TEST_ANGLES,
            answers.count,
            4,
          ).length *
          CREDIT_COSTS
            .image_standard,
    },

    {
      id:
        "campanha-teste",

      name:
        "Montar um pacote inicial de campanha",

      outcome:
        "Seis peças: três ângulos em Feed e Stories/Reels.",

      whenToUse:
        "Você quer sair com um primeiro pacote organizado para testar no Meta Ads.",

      icon: "◆",

      fields: [
        brandField,
        offerField,
        audienceField,
      ],

      build:
        buildCampaignGraph,

      estimate:
        () =>
          6 *
          CREDIT_COSTS
            .image_standard,
    },

    {
      id:
        "anuncio-video",

      name:
        "Criar um vídeo curto com locução",

      outcome:
        "Um vídeo vertical de 5 segundos e uma locução em arquivo separado, prontos para edição.",

      whenToUse:
        "Você quer validar uma direção de vídeo sem gravar material novo.",

      icon: "▶",

      fields: [
        brandField,
        offerField,
        audienceField,
        {
          key: "script",

          label:
            "Fala da locução",

          kind:
            "textarea",

          placeholder:
            "Você estuda inglês há anos e ainda trava na hora de falar. O problema não é você.",

          help:
            "Deixe em branco para usar uma fala simples baseada na oferta.",
        },
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const prompt =
            nodeId("prompt");

          const image =
            nodeId("img");

          const video =
            nodeId("vid");

          const voice =
            nodeId("voice");

          const videoOutput =
            nodeId(
              "out-video",
            );

          const voiceOutput =
            nodeId(
              "out-voice",
            );

          const script =
            (
              answers.script ||
              ""
            ).trim() ||
            `${answers.offer}. ` +
            `Feito para ` +
            `${answers.audience}.`;

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              promptNode(
                prompt,

                buildCreativePrompt({
                  offer:
                    answers.offer,

                  audience:
                    answers.audience,

                  angle:
                    "Abertura de vídeo",

                  angleInstruction:
                    "Crie o primeiro quadro de um anúncio vertical. " +
                    "Use uma única cena, com rosto ou produto em destaque " +
                    "e composição preparada para movimento sutil.",

                  headlineInstruction:
                    "Não coloque texto longo. " +
                    "No máximo uma frase curta e legível.",
                }),
              ),

              {
                id: image,

                type:
                  "image-gen",

                position: {
                  x: 400,
                  y: 60,
                },

                data: {
                  count: 1,

                  aspect_ratio:
                    "9:16",

                  quality:
                    "medium",
                },
              },

              {
                id: video,

                type:
                  "video",

                position: {
                  x: 760,
                  y: 60,
                },

                data: {
                  duration: 5,

                  aspect_ratio:
                    "9:16",

                  text:
                    `Anúncio em vídeo para: ${answers.offer}. ` +
                    `Público: ${answers.audience}. ` +
                    "Movimento natural e discreto, foco no elemento " +
                    "principal, ritmo de Reels, sem deformar texto, " +
                    "rosto, mãos ou produto.",
                },
              },

              {
                id: voice,

                type:
                  "voice",

                position: {
                  x: 760,
                  y: 300,
                },

                data: {
                  text:
                    script,

                  speed: 1,
                },
              },

              {
                id:
                  videoOutput,

                type:
                  "output",

                position: {
                  x: 1100,
                  y: 60,
                },

                data: {
                  name_template:
                    "{date}_video_{slug}",
                },
              },

              {
                id:
                  voiceOutput,

                type:
                  "output",

                position: {
                  x: 1100,
                  y: 300,
                },

                data: {
                  name_template:
                    "{date}_locucao_{slug}",
                },
              },
            ],

            [
              edge(
                brand,
                image,
                "brand",
              ),

              edge(
                prompt,
                image,
                "prompt",
              ),

              edge(
                image,
                video,
                "image",
              ),

              edge(
                video,
                videoOutput,
                "asset",
              ),

              edge(
                voice,
                voiceOutput,
                "asset",
              ),
            ],
          );
        },

      estimate:
        (answers) => {
          const script =
            (
              answers.script ||
              ""
            ).trim() ||
            `${answers.offer || ""}. ` +
            `Feito para ` +
            `${answers.audience || ""}.`;

          return (
            CREDIT_COSTS
              .image_standard +
            CREDIT_COSTS
              .video_final_5s +
            getVoiceCost(
              script,
            )
          );
        },
    },

    {
      id:
        "variacoes-headline",

      name:
        "Testar a mesma imagem com headlines diferentes",

      outcome:
        "Uma arte-base e versões que alteram somente a chamada principal.",

      whenToUse:
        "Você quer isolar o impacto da headline sem trocar toda a direção visual.",

      icon: "≡",

      fields: [
        brandField,
        offerField,
        formatField,
        {
          key:
            "headlines",

          label:
            "As chamadas",

          kind:
            "textarea",

          required:
            true,

          placeholder:
            "Você não precisa de mais um curso\n" +
            "Pare de estudar. Comece a falar.\n" +
            "12 semanas para destravar",

          help:
            "Uma por linha. O limite técnico é 12 chamadas por execução.",
        },
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const prompt =
            nodeId("prompt");

          const baseImage =
            nodeId("img-base");

          const variation =
            nodeId("variation");

          const image =
            nodeId("img");

          const output =
            nodeId("out");

          const headlines =
            nonEmptyLines(
              answers.headlines,
            ).slice(
              0,
              12,
            );

          const aspectRatio =
            answers
              .aspect_ratio ||
            "1:1";

          const basePrompt =
            `Crie uma arte-base para esta oferta: ${answers.offer}. ` +
            "Reserve uma área limpa para uma headline, " +
            "mas não escreva texto na imagem-base.\n\n" +
            CREATIVE_PROMPT_RULES;

          const values =
            headlines.map(
              (headline) =>
                "Use a imagem de referência como base visual. " +
                "Preserve composição, enquadramento, cores, " +
                "iluminação e elementos principais. " +
                `A única mudança permitida é inserir exatamente ` +
                `esta headline: "${headline}". ` +
                "Não inclua outra chamada, subtítulo, lista, selo " +
                "ou variação. Gere um único anúncio ocupando " +
                "o quadro inteiro.",
            );

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              promptNode(
                prompt,
                basePrompt,
              ),

              {
                id:
                  baseImage,

                type:
                  "image-gen",

                position: {
                  x: 400,
                  y: 60,
                },

                data: {
                  count: 1,

                  aspect_ratio:
                    aspectRatio,

                  quality:
                    "medium",
                },
              },

              {
                id:
                  variation,

                type:
                  "variation",

                position: {
                  x: 400,
                  y: 320,
                },

                data: {
                  axis:
                    "prompt",

                  values,
                },
              },

              {
                id: image,

                type:
                  "image-gen",

                position: {
                  x: 760,
                  y: 120,
                },

                data: {
                  count: 1,

                  aspect_ratio:
                    aspectRatio,

                  quality:
                    "medium",
                },
              },

              {
                id: output,

                type:
                  "output",

                position: {
                  x: 1100,
                  y: 120,
                },

                data: {
                  name_template:
                    "{date}_headline_{slug}",
                },
              },
            ],

            [
              edge(
                brand,
                baseImage,
                "brand",
              ),

              edge(
                prompt,
                baseImage,
                "prompt",
              ),

              edge(
                brand,
                image,
                "brand",
              ),

              edge(
                baseImage,
                image,
                "reference",
              ),

              edge(
                variation,
                image,
                "prompt",
              ),

              edge(
                image,
                output,
                "asset",
              ),
            ],
          );
        },

      estimate:
        (answers) =>
          (
            Math.min(
              12,

              Math.max(
                1,

                nonEmptyLines(
                  answers.headlines,
                ).length,
              ),
            ) + 1
          ) *
          CREDIT_COSTS
            .image_standard,
    },

    {
      id:
        "storyboard-roteiro",

      name:
        "Virar um roteiro em cenas",

      outcome:
        "Uma sequência visual coerente, com cenas na ordem do roteiro.",

      whenToUse:
        "Você já tem uma história e precisa visualizar a produção.",

      icon: "▤",

      fields: [
        brandField,
        {
          key:
            "script",

          label:
            "O roteiro",

          kind:
            "textarea",

          required:
            true,

          placeholder:
            "Ela chega em casa cansada. Abre o laptop. " +
            "A aula começa. Três meses depois, apresenta " +
            "em inglês para a diretoria.",

          help:
            "Escreva em sequência; o workflow divide o texto em cenas.",
        },
        {
          key:
            "scene_count",

          label:
            "Quantas cenas",

          kind:
            "number",

          default: 4,
          min: 2,
          max: 8,
        },
        formatField,
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const prompt =
            nodeId("prompt");

          const storyboard =
            nodeId("storyboard");

          const output =
            nodeId("out");

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              promptNode(
                prompt,
                answers.script ||
                  "",
              ),

              {
                id:
                  storyboard,

                type:
                  "storyboard",

                position: {
                  x: 400,
                  y: 120,
                },

                data: {
                  scene_count:
                    boundedInteger(
                      answers
                        .scene_count,
                      4,
                      2,
                      8,
                    ),

                  aspect_ratio:
                    answers
                      .aspect_ratio ||
                    "9:16",

                  quality:
                    "medium",
                },
              },

              {
                id: output,

                type:
                  "output",

                position: {
                  x: 760,
                  y: 120,
                },

                data: {
                  name_template:
                    "{date}_cena_{slug}",
                },
              },
            ],

            [
              edge(
                brand,
                storyboard,
                "brand",
              ),

              edge(
                prompt,
                storyboard,
                "prompt",
              ),

              edge(
                storyboard,
                output,
                "asset",
              ),
            ],
          );
        },

      estimate:
        (answers) =>
          boundedInteger(
            answers.scene_count,
            4,
            2,
            8,
          ) *
          CREDIT_COSTS
            .storyboard_frame,
    },

    {
      id:
        "carrossel-oferta",

      name:
        "Transformar uma oferta em carrossel",

      outcome:
        "Uma sequência de slides com começo, desenvolvimento e CTA final.",

      whenToUse:
        "Você quer explicar uma oferta em etapas no Instagram ou LinkedIn.",

      icon: "▥",

      fields: [
        brandField,
        offerField,
        audienceField,
        {
          key:
            "scene_count",

          label:
            "Quantos slides",

          kind:
            "number",

          default: 5,
          min: 3,
          max: 8,
        },
        carouselFormatField,
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const prompt =
            nodeId("prompt");

          const storyboard =
            nodeId("storyboard");

          const output =
            nodeId("out");

          const slideCount =
            boundedInteger(
              answers.scene_count,
              5,
              3,
              8,
            );

          const brief =
            `Crie um carrossel de ${slideCount} slides ` +
            `para esta oferta: ${answers.offer}\n` +
            `Público: ${answers.audience}\n` +
            "Estrutura: slide 1 com hook; slides centrais " +
            "desenvolvem uma única linha de raciocínio; " +
            "último slide conclui com CTA coerente. " +
            "Mantenha identidade, personagem, paleta e " +
            "hierarquia consistentes. Cada cena gerada " +
            "corresponde a um slide completo. " +
            "Não invente fatos, números, preços, " +
            "depoimentos ou promessas.";

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              promptNode(
                prompt,
                brief,
              ),

              {
                id:
                  storyboard,

                type:
                  "storyboard",

                position: {
                  x: 400,
                  y: 120,
                },

                data: {
                  scene_count:
                    slideCount,

                  aspect_ratio:
                    answers
                      .aspect_ratio ||
                    "4:5",

                  quality:
                    "medium",
                },
              },

              {
                id: output,

                type:
                  "output",

                position: {
                  x: 760,
                  y: 120,
                },

                data: {
                  name_template:
                    "{date}_carrossel_{slug}",
                },
              },
            ],

            [
              edge(
                brand,
                storyboard,
                "brand",
              ),

              edge(
                prompt,
                storyboard,
                "prompt",
              ),

              edge(
                storyboard,
                output,
                "asset",
              ),
            ],
          );
        },

      estimate:
        (answers) =>
          boundedInteger(
            answers.scene_count,
            5,
            3,
            8,
          ) *
          CREDIT_COSTS
            .storyboard_frame,
    },

    {
      id:
        "produto-em-cena",

      name:
        "Colocar meu produto numa cena",

      outcome:
        "O produto recortado e integrado a um ambiente novo.",

      whenToUse:
        "Você tem uma foto de produto com fundo ruim ou sem contexto.",

      icon: "◈",

      fields: [
        brandField,
        {
          key:
            "image_url",

          label:
            "Link da foto do produto",

          kind:
            "text",

          required:
            true,

          placeholder:
            "https://.../produto.png",

          help:
            "Use uma URL pública da Biblioteca. " +
            "Upload direto continua disponível na tela de PNG.",
        },
        {
          key: "scene",

          label:
            "Onde colocar",

          kind:
            "textarea",

          required:
            true,

          placeholder:
            "Bancada de mármore, luz da manhã entrando pela janela, " +
            "planta desfocada ao fundo",
        },
        formatField,
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const reference =
            nodeId("reference");

          const removeBackground =
            nodeId("bg-remove");

          const prompt =
            nodeId("prompt");

          const image =
            nodeId("img");

          const output =
            nodeId("out");

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              {
                id:
                  reference,

                type:
                  "reference-image",

                position: {
                  x: 40,
                  y: 200,
                },

                data: {
                  image_url:
                    answers
                      .image_url ||
                    "",

                  description:
                    "produto",
                },
              },

              {
                id:
                  removeBackground,

                type:
                  "bg-remove",

                position: {
                  x: 400,
                  y: 200,
                },

                data: {},
              },

              promptNode(
                prompt,

                `Integre o produto nesta cena: ${answers.scene}. ` +
                "Preserve forma, embalagem, rótulo e proporções. " +
                "A sombra, a perspectiva e a luz precisam ser coerentes.\n\n" +
                CREATIVE_PROMPT_RULES,

                40,
                380,
              ),

              {
                id: image,

                type:
                  "image-gen",

                position: {
                  x: 760,
                  y: 200,
                },

                data: {
                  count: 1,

                  aspect_ratio:
                    answers
                      .aspect_ratio ||
                    "1:1",

                  quality:
                    "high",
                },
              },

              {
                id: output,

                type:
                  "output",

                position: {
                  x: 1100,
                  y: 200,
                },

                data: {
                  name_template:
                    "{date}_cena_produto_{slug}",
                },
              },
            ],

            [
              edge(
                reference,
                removeBackground,
                "image",
              ),

              edge(
                removeBackground,
                image,
                "reference",
              ),

              edge(
                brand,
                image,
                "brand",
              ),

              edge(
                prompt,
                image,
                "prompt",
              ),

              edge(
                image,
                output,
                "asset",
              ),
            ],
          );
        },

      estimate:
        () =>
          CREDIT_COSTS
            .bg_remove +
          CREDIT_COSTS
            .image_high,
    },

    {
      id:
        "adaptar-criativo",

      name:
        "Adaptar um criativo existente",

      outcome:
        "Uma nova peça baseada no criativo de referência, ajustada ao objetivo informado.",

      whenToUse:
        "Você já tem uma peça e quer adaptar público, canal, formato ou mensagem.",

      icon: "↗",

      fields: [
        brandField,
        {
          key:
            "image_url",

          label:
            "Link do criativo original",

          kind:
            "text",

          required:
            true,

          placeholder:
            "https://.../criativo-original.png",

          help:
            "Use uma URL pública da Biblioteca.",
        },
        offerField,
        {
          key:
            "adaptation",

          label:
            "O que precisa mudar",

          kind:
            "textarea",

          required:
            true,

          placeholder:
            "Adaptar para donos de restaurantes, manter a composição " +
            "geral e trocar a mensagem para um cardápio de almoço.",
        },
        formatField,
      ],

      build:
        (answers) => {
          const brand =
            nodeId("brand");

          const reference =
            nodeId("reference");

          const prompt =
            nodeId("prompt");

          const image =
            nodeId("img");

          const output =
            nodeId("out");

          const adaptationPrompt =
            "CRIAÇÃO BASEADA EM REFERÊNCIA\n" +
            `Oferta/contexto: ${answers.offer}\n` +
            `Alteração solicitada: ${answers.adaptation}\n` +
            "Use a referência para preservar a lógica visual útil, " +
            "mas não copie marcas, logos, personagens protegidos " +
            "ou textos que não pertençam ao usuário. " +
            "Entregue uma única peça final no novo formato.\n\n" +
            CREATIVE_PROMPT_RULES;

          return graph(
            [
              brandNode(
                brand,
                answers.brand_id,
              ),

              {
                id:
                  reference,

                type:
                  "reference-image",

                position: {
                  x: 40,
                  y: 180,
                },

                data: {
                  image_url:
                    answers
                      .image_url ||
                    "",

                  description:
                    "criativo original a ser adaptado",
                },
              },

              promptNode(
                prompt,
                adaptationPrompt,
                40,
                360,
              ),

              {
                id: image,

                type:
                  "image-gen",

                position: {
                  x: 500,
                  y: 220,
                },

                data: {
                  count: 1,

                  aspect_ratio:
                    answers
                      .aspect_ratio ||
                    "9:16",

                  quality:
                    "high",
                },
              },

              {
                id: output,

                type:
                  "output",

                position: {
                  x: 880,
                  y: 220,
                },

                data: {
                  name_template:
                    "{date}_adaptado_{slug}",
                },
              },
            ],

            [
              edge(
                brand,
                image,
                "brand",
              ),

              edge(
                reference,
                image,
                "reference",
              ),

              edge(
                prompt,
                image,
                "prompt",
              ),

              edge(
                image,
                output,
                "asset",
              ),
            ],
          );
        },

      estimate:
        () =>
          CREDIT_COSTS
            .image_high,
    },

    {
      id:
        "conteudo-social",

      name:
        "Criar uma sequência de conteúdo para redes",

      outcome:
        "Peças visuais com papéis diferentes dentro de uma sequência editorial.",

      whenToUse:
        "Você quer variedade de conteúdo sem repetir a mesma oferta em todos os posts.",

      icon: "✦",

      fields: [
        brandField,
        offerField,
        audienceField,
        socialFormatField,
        countField(
          5,
          7,
        ),
      ],

      build:
        (answers) =>
          buildIndependentImageBranches({
            brandId:
              answers.brand_id,

            offer:
              answers.offer,

            audience:
              answers.audience,

            aspectRatio:
              answers.aspect_ratio ||
              "4:5",

            directions:
              pickDirections(
                SOCIAL_DIRECTIONS,
                answers.count,
                5,
              ),

            namePrefix:
              "social",
          }),

      estimate:
        (answers) =>
          pickDirections(
            SOCIAL_DIRECTIONS,
            answers.count,
            5,
          ).length *
          CREDIT_COSTS
            .image_standard,
    },

    {
      id:
        "locucao-lote",

      name:
        "Gravar várias locuções de uma vez",

      outcome:
        "Um arquivo de áudio por texto, com a voz ou o rodízio de vozes escolhido.",

      whenToUse:
        "Você tem vários roteiros e quer produzir as locuções em lote.",

      icon: "◉",

      fields: [
        {
          key:
            "scripts",

          label:
            "Os textos",

          kind:
            "textarea",

          required:
            true,

          placeholder:
            "Primeiro roteiro aqui\n---\nSegundo roteiro aqui",

          help:
            "Separe cada roteiro com três traços em uma linha: ---",
        },
        {
          key:
            "voice_id",

          label:
            "Vozes",

          kind:
            "voice",

          required:
            true,

          help:
            "Com mais de uma voz, o workflow alterna entre elas.",
        },
      ],

      build:
        (answers) => {
          const scripts =
            (
              answers.scripts ||
              ""
            )
              .split(
                /^\s*---\s*$/m,
              )
              .map(
                (item) =>
                  item.trim(),
              )
              .filter(Boolean)
              .slice(
                0,
                20,
              );

          const voiceIds =
            (
              answers.voice_id ||
              ""
            )
              .split(",")
              .map(
                (item) =>
                  item.trim(),
              )
              .filter(Boolean);

          const nodes:
            WfNode[] = [];

          const edges:
            WfEdge[] = [];

          scripts.forEach(
            (
              text,
              index,
            ) => {
              const voice =
                nodeId("voice");

              const output =
                nodeId("out");

              const voiceId =
                voiceIds[
                  index %
                    voiceIds.length
                ];

              nodes.push(
                {
                  id: voice,

                  type:
                    "voice",

                  position: {
                    x: 120,
                    y:
                      60 +
                      index *
                        140,
                  },

                  data: {
                    text,
                    speed: 1,

                    ...(
                      voiceId
                        ? {
                            voice_id:
                              voiceId,
                          }
                        : {}
                    ),
                  },
                },

                {
                  id: output,

                  type:
                    "output",

                  position: {
                    x: 560,
                    y:
                      60 +
                      index *
                        140,
                  },

                  data: {
                    name_template:
                      `{date}_locucao_` +
                      `${index + 1}`,
                  },
                },
              );

              edges.push(
                edge(
                  voice,
                  output,
                  "asset",
                ),
              );
            },
          );

          return graph(
            nodes,
            edges,
          );
        },

      estimate:
        (answers) => {
          const scripts =
            (
              answers.scripts ||
              ""
            )
              .split(
                /^\s*---\s*$/m,
              )
              .map(
                (item) =>
                  item.trim(),
              )
              .filter(Boolean)
              .slice(
                0,
                20,
              );

          return getVoiceCost(
            scripts.join(
              "\n",
            ),
          );
        },
    },
  ];

export function getRecipe(
  id: string,
): Recipe | undefined {
  return RECIPES.find(
    (recipe) =>
      recipe.id === id,
  );
}

export function missingField(
  recipe: Recipe,
  answers: Record<
    string,
    string
  >,
): string | null {
  for (
    const field
    of recipe.fields
  ) {
    if (
      field.required &&
      !(
        answers[
          field.key
        ] || ""
      ).trim()
    ) {
      return field.label;
    }
  }

  return null;
}
