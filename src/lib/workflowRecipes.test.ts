import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RECIPES,
  RECIPE_BY_OBJECTIVE,
  getRecipe,
} from "./workflowRecipes";

import {
  validateWorkflowGraph,
} from "./workflowValidation";

import type {
  WfGraph,
} from "./workflowTypes";

const ANSWERS:
  Record<
    string,
    Record<
      string,
      string
    >
  > = {
    "criativos-teste": {
      brand_id: "",

      offer:
        "Curso de inglês de 12 semanas",

      audience:
        "Profissionais que usam inglês no trabalho",

      aspect_ratio:
        "9:16",

      count:
        "4",
    },

    "campanha-teste": {
      brand_id: "",

      offer:
        "Curso de inglês de 12 semanas",

      audience:
        "Profissionais que usam inglês no trabalho",
    },

    "anuncio-video": {
      brand_id: "",

      offer:
        "Curso de inglês de 12 semanas",

      audience:
        "Profissionais que usam inglês no trabalho",

      script:
        "Fale inglês com mais confiança no trabalho.",
    },

    "variacoes-headline": {
      brand_id: "",

      offer:
        "Curso de inglês de 12 semanas",

      aspect_ratio:
        "1:1",

      headlines:
        "Pare de travar ao falar\n" +
        "Inglês para o trabalho\n" +
        "12 semanas de prática",
    },

    "storyboard-roteiro": {
      brand_id: "",

      script:
        "Ela chega ao trabalho. Abre a apresentação. " +
        "Começa a falar em inglês.",

      scene_count:
        "4",

      aspect_ratio:
        "9:16",
    },

    "carrossel-oferta": {
      brand_id: "",

      offer:
        "Curso de inglês de 12 semanas",

      audience:
        "Profissionais que usam inglês no trabalho",

      scene_count:
        "5",

      aspect_ratio:
        "4:5",
    },

    "produto-em-cena": {
      brand_id: "",

      image_url:
        "https://example.com/product.png",

      scene:
        "Bancada de mármore com luz natural",

      aspect_ratio:
        "1:1",
    },

    "adaptar-criativo": {
      brand_id: "",

      image_url:
        "https://example.com/ad.png",

      offer:
        "Cardápio de almoço de um restaurante nordestino",

      adaptation:
        "Adaptar para Stories e destacar o almoço executivo",

      aspect_ratio:
        "9:16",
    },

    "conteudo-social": {
      brand_id: "",

      offer:
        "Restaurante nordestino com almoço executivo",

      audience:
        "Pessoas que trabalham perto do restaurante",

      aspect_ratio:
        "4:5",

      count:
        "5",
    },

    "locucao-lote": {
      scripts:
        "Primeiro roteiro\n---\nSegundo roteiro",

      voice_id:
        "voice-1",
    },
  };

describe(
  "workflow recipes",
  () => {
    it(
      "mantém todos os objetivos apontando para receitas existentes",
      () => {
        for (
          const recipeId
          of Object.values(
            RECIPE_BY_OBJECTIVE,
          )
        ) {
          expect(
            getRecipe(
              recipeId,
            ),

            `receita ausente: ${recipeId}`,
          ).toBeDefined();
        }
      },
    );

    for (
      const recipe
      of RECIPES
    ) {
      it(
        `${recipe.id} produz grafo válido e custo positivo`,
        () => {
          const answers =
            ANSWERS[
              recipe.id
            ];

          expect(
            answers,

            `faltam respostas de teste para ${recipe.id}`,
          ).toBeDefined();

          const graph =
            recipe.build(
              answers,
            );

          expect(
            validateWorkflowGraph(
              graph,
            ),
          ).toBeNull();

          expect(
            recipe.estimate(
              answers,
            ),
          ).toBeGreaterThan(
            0,
          );
        },
      );
    }

    it(
      "limita o lote de criativos ao máximo declarado",
      () => {
        const recipe =
          getRecipe(
            "criativos-teste",
          );

        expect(
          recipe,
        ).toBeDefined();

        const graph =
          recipe!.build({
            ...ANSWERS[
              "criativos-teste"
            ],

            count:
              "999",
          });

        expect(
          graph.nodes.filter(
            (node) =>
              node.type ===
              "image-gen",
          ),
        ).toHaveLength(
          12,
        );
      },
    );

    it(
      "rejeita output com mais de um asset",
      () => {
        const invalidGraph:
          WfGraph = {
            version: 1,

            nodes: [
              {
                id:
                  "voice-1",

                type:
                  "voice",

                position: {
                  x: 0,
                  y: 0,
                },

                data: {
                  text: "A",
                },
              },

              {
                id:
                  "voice-2",

                type:
                  "voice",

                position: {
                  x: 0,
                  y: 100,
                },

                data: {
                  text: "B",
                },
              },

              {
                id:
                  "output",

                type:
                  "output",

                position: {
                  x: 300,
                  y: 0,
                },

                data: {},
              },
            ],

            edges: [
              {
                id: "e1",

                source:
                  "voice-1",

                target:
                  "output",

                targetHandle:
                  "asset",
              },

              {
                id: "e2",

                source:
                  "voice-2",

                target:
                  "output",

                targetHandle:
                  "asset",
              },
            ],
          };

        expect(
          validateWorkflowGraph(
            invalidGraph,
          ),
        ).toContain(
          "exatamente um asset",
        );
      },
    );
  },
);
