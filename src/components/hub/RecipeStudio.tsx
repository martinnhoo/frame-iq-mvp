/**
 * Interface simples das Automações.
 *
 * A Home envia um briefing por sessionStorage.
 * Esta tela escolhe a receita correta e exige
 * confirmação dos dados antes de cobrar créditos.
 */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  ArrowLeft,
  Coins,
  Loader,
  Play,
  SlidersHorizontal,
} from "lucide-react";

import FishVoiceSelect from
  "@/components/hub/FishVoiceSelect";

import {
  useUserBrands,
} from "@/hooks/useUserBrands";

import type {
  WfGraph,
} from "@/lib/hubWorkflows";

import {
  RECIPES,
  RECIPE_BY_OBJECTIVE,
  missingField,
  type Recipe,
  type RecipeField,
  type WorkflowObjective,
} from "@/lib/workflowRecipes";

const COLORS = {
  panel: "#0a0b10",
  line:
    "rgba(255,255,255,0.08)",
  lineHigh:
    "rgba(255,255,255,0.16)",
  text: "#fff",
  dim:
    "rgba(255,255,255,0.56)",
  faint:
    "rgba(255,255,255,0.34)",
  accent: "#EAB308",
};

interface Props {
  onRun:
    (
      name: string,
      graph: WfGraph,
    ) => Promise<void>;

  running: boolean;

  onOpenAdvanced:
    (
      name: string,
      graph: WfGraph,
    ) => Promise<void>;

  balance: number;
}

type WorkflowSeed = {
  brief?: string;

  objective?:
    WorkflowObjective;

  channel?:
    | "meta"
    | "instagram"
    | "tiktok"
    | "linkedin";

  outputLanguage?:
    | "pt"
    | "en"
    | "es";
};

const HOME_SEED_KEY =
  "adbrief_workflow_seed";

const ACTIVE_BRAND_KEY =
  "adbrief_active_brand_id";

const CHANNEL_LABEL:
  Record<
    NonNullable<
      WorkflowSeed["channel"]
    >,
    string
  > = {
    meta: "Meta Ads",
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
  };

const LANGUAGE_LABEL:
  Record<
    NonNullable<
      WorkflowSeed[
        "outputLanguage"
      ]
    >,
    string
  > = {
    pt: "Português",
    en: "Inglês",
    es: "Espanhol",
  };

function defaultAnswers(
  recipe: Recipe,
): Record<
  string,
  string
> {
  const initial:
    Record<
      string,
      string
    > = {};

  for (
    const field
    of recipe.fields
  ) {
    if (
      field.default !==
      undefined
    ) {
      initial[
        field.key
      ] =
        String(
          field.default,
        );
    }
  }

  return initial;
}

function aspectRatioForChannel(
  channel:
    WorkflowSeed["channel"] |
    undefined,
): string {
  if (
    channel ===
    "linkedin"
  ) {
    return "1:1";
  }

  if (
    channel ===
    "meta"
  ) {
    return "4:5";
  }

  return "9:16";
}

function briefFromSeed(
  seed: WorkflowSeed,
): string {
  const lines = [
    seed.brief
      ?.trim() ||
      "",
  ];

  if (seed.channel) {
    lines.push(
      `Canal principal: ${
        CHANNEL_LABEL[
          seed.channel
        ]
      }.`,
    );
  }

  if (
    seed.outputLanguage
  ) {
    lines.push(
      `Idioma da peça: ${
        LANGUAGE_LABEL[
          seed.outputLanguage
        ]
      }.`,
    );
  }

  return lines
    .filter(Boolean)
    .join("\n");
}

function readActiveBrandId():
  string {
  try {
    return (
      localStorage.getItem(
        ACTIVE_BRAND_KEY,
      ) || ""
    );
  } catch {
    return "";
  }
}

function isPublicHttpUrl(
  value: string,
): boolean {
  try {
    const parsed =
      new URL(value);

    return (
      parsed.protocol ===
        "http:" ||
      parsed.protocol ===
        "https:"
    );
  } catch {
    return false;
  }
}

function countScripts(
  value: string,
): number {
  return value
    .split(
      /^\s*---\s*$/m,
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean)
    .length;
}

function countLines(
  value: string,
): number {
  return value
    .split("\n")
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean)
    .length;
}

function validateAnswers(
  recipe: Recipe,

  answers:
    Record<
      string,
      string
    >,
): string | null {
  const missing =
    missingField(
      recipe,
      answers,
    );

  if (missing) {
    return (
      `Falta preencher: ` +
      `${missing}`
    );
  }

  for (
    const field
    of recipe.fields
  ) {
    if (
      field.kind !==
      "number"
    ) {
      continue;
    }

    const raw =
      answers[
        field.key
      ];

    const value =
      Number(raw);

    if (
      !Number.isInteger(
        value,
      )
    ) {
      return (
        `${field.label} ` +
        `precisa ser um número inteiro.`
      );
    }

    if (
      field.min !==
        undefined &&
      value < field.min
    ) {
      return (
        `${field.label} ` +
        `precisa ser no mínimo ${field.min}.`
      );
    }

    if (
      field.max !==
        undefined &&
      value > field.max
    ) {
      return (
        `${field.label} ` +
        `pode ser no máximo ${field.max}.`
      );
    }
  }

  if (
    answers.image_url &&
    !isPublicHttpUrl(
      answers.image_url
        .trim(),
    )
  ) {
    return (
      "O link da imagem precisa começar " +
      "com http:// ou https:// e ser público."
    );
  }

  if (
    recipe.id ===
    "variacoes-headline"
  ) {
    const total =
      countLines(
        answers.headlines ||
        "",
      );

    if (total > 12) {
      return (
        "Use no máximo 12 headlines " +
        "por execução."
      );
    }
  }

  if (
    recipe.id ===
    "locucao-lote"
  ) {
    const total =
      countScripts(
        answers.scripts ||
        "",
      );

    if (total > 20) {
      return (
        "Use no máximo 20 roteiros " +
        "por execução."
      );
    }
  }

  return null;
}

export default function RecipeStudio({
  onRun,
  running,
  onOpenAdvanced,
  balance,
}: Props) {
  const [
    picked,
    setPicked,
  ] =
    useState<
      Recipe | null
    >(null);

  const [
    answers,
    setAnswers,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const {
    brands,
    loading:
      brandsLoading,
  } =
    useUserBrands();

  /*
   * Recebe o briefing
   * criado na Home.
   */
  useEffect(() => {
    let rawSeed:
      string | null =
        null;

    try {
      rawSeed =
        sessionStorage
          .getItem(
            HOME_SEED_KEY,
          );
    } catch {
      return;
    }

    if (!rawSeed) {
      return;
    }

    try {
      const seed =
        JSON.parse(
          rawSeed,
        ) as WorkflowSeed;

      const brief =
        seed.brief
          ?.trim();

      if (!brief) {
        return;
      }

      const recipeId =
        seed.objective
          ? RECIPE_BY_OBJECTIVE[
              seed.objective
            ]
          : RECIPE_BY_OBJECTIVE
              .static;

      const recipe =
        RECIPES.find(
          (item) =>
            item.id ===
            recipeId,
        );

      if (!recipe) {
        return;
      }

      const initial =
        defaultAnswers(
          recipe,
        );

      const hasField =
        (key: string) =>
          recipe.fields
            .some(
              (field) =>
                field.key ===
                key,
            );

      if (
        hasField(
          "brand_id",
        )
      ) {
        initial.brand_id =
          readActiveBrandId();
      }

      if (
        hasField(
          "offer",
        )
      ) {
        initial.offer =
          briefFromSeed(
            seed,
          );
      }

      if (
        hasField(
          "adaptation",
        )
      ) {
        initial.adaptation =
          briefFromSeed(
            seed,
          );
      }

      if (
        hasField(
          "aspect_ratio",
        )
      ) {
        initial.aspect_ratio =
          aspectRatioForChannel(
            seed.channel,
          );
      }

      /*
       * Não finge que inferiu
       * uma audiência.
       */
      if (
        hasField(
          "audience",
        )
      ) {
        initial.audience =
          "";
      }

      setPicked(
        recipe,
      );

      setAnswers(
        initial,
      );

      setError(
        null,
      );
    } catch {
      /*
       * Um seed antigo ou
       * inválido não quebra
       * a tela manual.
       */
    } finally {
      try {
        sessionStorage
          .removeItem(
            HOME_SEED_KEY,
          );
      } catch {
        /*
         * Storage
         * indisponível.
         */
      }
    }
  }, []);

  /*
   * Atualiza a marca caso
   * ela seja trocada na Home.
   */
  useEffect(() => {
    const handleBrandChange =
      (event: Event) => {
        if (
          !picked
            ?.fields
            .some(
              (field) =>
                field.key ===
                "brand_id",
            )
        ) {
          return;
        }

        const customEvent =
          event as
            CustomEvent<{
              brandId?:
                string |
                null;
            }>;

        setAnswers(
          (current) => ({
            ...current,

            brand_id:
              customEvent
                .detail
                ?.brandId ||
              "",
          }),
        );
      };

    window.addEventListener(
      "active-brand-changed",
      handleBrandChange,
    );

    return () => {
      window.removeEventListener(
        "active-brand-changed",
        handleBrandChange,
      );
    };
  }, [picked]);

  /*
   * Não mantém selecionado
   * um ID de marca removido.
   */
  useEffect(() => {
    if (
      brandsLoading
    ) {
      return;
    }

    const selected =
      answers.brand_id;

    if (!selected) {
      return;
    }

    if (
      brands.some(
        (brand) =>
          brand.id ===
          selected,
      )
    ) {
      return;
    }

    setAnswers(
      (current) => ({
        ...current,
        brand_id: "",
      }),
    );
  }, [
    answers.brand_id,
    brands,
    brandsLoading,
  ]);

  const cost =
    useMemo(
      () => {
        if (!picked) {
          return 0;
        }

        try {
          return picked
            .estimate(
              answers,
            );
        } catch {
          return 0;
        }
      },
      [
        picked,
        answers,
      ],
    );

  const enough =
    balance >= cost;

  function selectRecipe(
    recipe: Recipe,
  ) {
    const initial =
      defaultAnswers(
        recipe,
      );

    if (
      recipe.fields
        .some(
          (field) =>
            field.key ===
            "brand_id",
        )
    ) {
      initial.brand_id =
        readActiveBrandId();
    }

    setPicked(
      recipe,
    );

    setAnswers(
      initial,
    );

    setError(
      null,
    );
  }

  async function execute(
    advanced: boolean,
  ) {
    if (
      !picked ||
      running
    ) {
      return;
    }

    const answerError =
      validateAnswers(
        picked,
        answers,
      );

    if (answerError) {
      setError(
        answerError,
      );

      return;
    }

    if (cost <= 0) {
      setError(
        "Não foi possível calcular o custo desta automação.",
      );

      return;
    }

    if (!enough) {
      setError(
        "Saldo insuficiente para executar a automação completa.",
      );

      return;
    }

    try {
      setError(
        null,
      );

      const resultGraph =
        picked.build(
          answers,
        );

      if (advanced) {
        await onOpenAdvanced(
          picked.name,
          resultGraph,
        );
      } else {
        await onRun(
          picked.name,
          resultGraph,
        );
      }
    } catch (caught) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : "Não foi possível montar esta automação.",
      );
    }
  }

  if (!picked) {
    return (
      <div style={pageStyle}>
        <style>
          {responsiveCss}
        </style>

        <div
          style={{
            maxWidth: 980,
            margin:
              "0 auto",
          }}
        >
          <h1
            className="recipe-head"
            style={titleStyle}
          >
            O que você quer produzir?
          </h1>

          <p
            style={
              subtitleStyle
            }
          >
            Escolha o resultado. A automação monta o
            processo correto e só executa depois de
            validar todos os campos.
          </p>

          <div
            className="recipe-grid"
            style={
              recipeGridStyle
            }
          >
            {RECIPES.map(
              (recipe) => (
                <button
                  key={
                    recipe.id
                  }
                  type="button"
                  onClick={() =>
                    selectRecipe(
                      recipe,
                    )
                  }
                  style={
                    recipeCardStyle
                  }
                  onMouseEnter={(
                    event,
                  ) => {
                    event
                      .currentTarget
                      .style
                      .borderColor =
                        COLORS
                          .lineHigh;

                    event
                      .currentTarget
                      .style
                      .transform =
                        "translateY(-1px)";
                  }}
                  onMouseLeave={(
                    event,
                  ) => {
                    event
                      .currentTarget
                      .style
                      .borderColor =
                        COLORS.line;

                    event
                      .currentTarget
                      .style
                      .transform =
                        "none";
                  }}
                >
                  <span
                    style={{
                      color:
                        COLORS.accent,
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    {recipe.icon}
                  </span>

                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {recipe.name}
                  </span>

                  <span
                    style={{
                      color:
                        COLORS.dim,
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {recipe.outcome}
                  </span>

                  <span
                    style={{
                      marginTop: 2,
                      color:
                        COLORS.faint,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {recipe.whenToUse}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <style>
        {responsiveCss}
      </style>

      <div
        style={{
          maxWidth: 680,
          margin:
            "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setPicked(
              null,
            );

            setAnswers(
              {},
            );

            setError(
              null,
            );
          }}
          style={
            backButtonStyle
          }
        >
          <ArrowLeft
            size={13}
          />

          Escolher outro resultado
        </button>

        <h2
          style={{
            margin:
              "0 0 6px",
            fontSize: 21,
            fontWeight: 800,
          }}
        >
          {picked.name}
        </h2>

        <p
          style={{
            ...subtitleStyle,
            marginBottom: 22,
          }}
        >
          {picked.outcome}
        </p>

        <div
          className="recipe-form"
          style={
            formStyle
          }
        >
          {picked.fields.map(
            (field) => (
              <Field
                key={
                  field.key
                }
                field={
                  field
                }
                value={
                  answers[
                    field.key
                  ] ?? ""
                }
                brands={
                  brands
                }
                brandsLoading={
                  brandsLoading
                }
                onChange={(
                  value,
                ) => {
                  setAnswers(
                    (
                      current,
                    ) => ({
                      ...current,

                      [field.key]:
                        value,
                    }),
                  );

                  setError(
                    null,
                  );
                }}
              />
            ),
          )}
        </div>

        <div
          style={{
            ...costBoxStyle,

            borderColor:
              enough
                ? "rgba(234,179,8,0.22)"
                : "rgba(239,68,68,0.30)",

            background:
              enough
                ? "rgba(234,179,8,0.07)"
                : "rgba(239,68,68,0.09)",
          }}
        >
          <Coins
            size={15}
            color={
              enough
                ? COLORS.accent
                : "#F87171"
            }
          />

          <strong
            style={{
              fontSize: 13,
            }}
          >
            {cost > 0
              ? `Custa ${cost} crédito${
                  cost === 1
                    ? ""
                    : "s"
                }`
              : "Preencha para ver o custo"}
          </strong>

          <span
            style={{
              color:
                COLORS.dim,
              fontSize: 12.5,
            }}
          >
            · você tem {balance}
          </span>
        </div>

        {error && (
          <div
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}

        <div
          className="recipe-actions"
          style={
            actionsStyle
          }
        >
          <button
            type="button"
            onClick={() =>
              void execute(
                false,
              )
            }
            disabled={
              running ||
              !enough ||
              cost <= 0
            }
            style={primaryButtonStyle(
              running ||
                !enough ||
                cost <= 0,
            )}
          >
            {running ? (
              <Loader
                size={15}
                className="spin"
              />
            ) : (
              <Play
                size={15}
              />
            )}

            {running
              ? "Gerando…"
              : "Gerar agora"}
          </button>

          <button
            type="button"
            onClick={() =>
              void execute(
                true,
              )
            }
            disabled={
              running
            }
            style={secondaryButtonStyle(
              running,
            )}
          >
            <SlidersHorizontal
              size={14}
            />

            Abrir no modo avançado
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  brands,
  brandsLoading,
}: {
  field: RecipeField;
  value: string;

  onChange:
    (
      value: string,
    ) => void;

  brands: {
    id: string;
    name: string;
  }[];

  brandsLoading:
    boolean;
}) {
  return (
    <label
      style={{
        display:
          "block",
      }}
    >
      <span
        style={
          labelStyle
        }
      >
        {field.label}

        {!field.required && (
          <span
            style={{
              color:
                COLORS.faint,
              fontWeight: 500,
            }}
          >
            {" "}
            · opcional
          </span>
        )}
      </span>

      {field.kind ===
        "textarea" && (
        <textarea
          rows={4}
          value={value}
          placeholder={
            field.placeholder
          }
          onChange={(
            event,
          ) =>
            onChange(
              event
                .target
                .value,
            )
          }
          style={{
            ...inputStyle,
            resize:
              "vertical",
            lineHeight: 1.6,
          }}
        />
      )}

      {field.kind ===
        "text" && (
        <input
          value={value}
          placeholder={
            field.placeholder
          }
          onChange={(
            event,
          ) =>
            onChange(
              event
                .target
                .value,
            )
          }
          style={
            inputStyle
          }
        />
      )}

      {field.kind ===
        "number" && (
        <input
          type="number"
          value={value}
          min={field.min}
          max={field.max}
          step={1}
          onChange={(
            event,
          ) =>
            onChange(
              event
                .target
                .value,
            )
          }
          style={{
            ...inputStyle,
            maxWidth: 140,
          }}
        />
      )}

      {field.kind ===
        "brand" && (
        <select
          value={value}
          onChange={(
            event,
          ) =>
            onChange(
              event
                .target
                .value,
            )
          }
          style={{
            ...inputStyle,
            cursor:
              "pointer",
          }}
        >
          <option value="">
            {brandsLoading
              ? "Carregando marcas..."
              : "Sem marca"}
          </option>

          {brands
            .filter(
              (brand) =>
                brand.id &&
                brand.id !==
                  "none",
            )
            .map(
              (brand) => (
                <option
                  key={
                    brand.id
                  }
                  value={
                    brand.id
                  }
                >
                  {brand.name}
                </option>
              ),
            )}
        </select>
      )}

      {field.kind ===
        "voice" && (
        <FishVoiceSelect
          value={value}
          onChange={(
            id,
          ) =>
            onChange(
              id,
            )
          }
          style={
            inputStyle
          }
          multiple
        />
      )}

      {field.kind ===
        "select" && (
        <div
          style={{
            display:
              "flex",
            flexWrap:
              "wrap",
            gap: 8,
          }}
        >
          {(
            field.options ||
            []
          ).map(
            (option) => {
              const selected =
                value ===
                option.value;

              return (
                <button
                  key={
                    option.value
                  }
                  type="button"
                  onClick={() =>
                    onChange(
                      option.value,
                    )
                  }
                  style={optionButtonStyle(
                    selected,
                  )}
                >
                  <span>
                    {option.label}
                  </span>

                  {option.hint && (
                    <span
                      style={{
                        opacity: 0.7,
                        fontSize: 10.5,
                      }}
                    >
                      {option.hint}
                    </span>
                  )}
                </button>
              );
            },
          )}
        </div>
      )}

      {field.help && (
        <span
          style={
            helpStyle
          }
        >
          {field.help}
        </span>
      )}
    </label>
  );
}

const responsiveCss = `
  @keyframes recipe-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .spin {
    animation: recipe-spin .8s linear infinite;
  }

  @media (max-width: 760px) {
    .recipe-grid {
      grid-template-columns: 1fr !important;
    }

    .recipe-head {
      font-size: 22px !important;
    }

    .recipe-form {
      padding: 16px !important;
    }

    .recipe-actions {
      flex-direction: column !important;
      align-items: stretch !important;
    }
  }
`;

const pageStyle:
  CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding:
      "28px 20px 80px",
  };

const titleStyle:
  CSSProperties = {
    margin: 0,
    color:
      COLORS.text,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing:
      "-0.03em",
  };

const subtitleStyle:
  CSSProperties = {
    maxWidth: 620,
    margin:
      "8px 0 26px",
    color:
      COLORS.dim,
    fontSize: 14,
    lineHeight: 1.6,
  };

const recipeGridStyle:
  CSSProperties = {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0,1fr))",

    gap: 12,
  };

const recipeCardStyle:
  CSSProperties = {
    display: "flex",

    flexDirection:
      "column",

    gap: 8,
    padding: 18,

    color:
      COLORS.text,

    textAlign:
      "left",

    cursor:
      "pointer",

    border:
      `1px solid ${COLORS.line}`,

    borderRadius: 12,

    background:
      COLORS.panel,

    fontFamily:
      "inherit",

    transition:
      "border-color .15s, transform .15s",
  };

const backButtonStyle:
  CSSProperties = {
    display:
      "inline-flex",

    alignItems:
      "center",

    gap: 6,

    marginBottom:
      16,

    padding: 0,

    color:
      COLORS.dim,

    cursor:
      "pointer",

    border:
      "none",

    background:
      "transparent",

    fontSize:
      12.5,

    fontFamily:
      "inherit",
  };

const formStyle:
  CSSProperties = {
    display:
      "flex",

    flexDirection:
      "column",

    gap: 18,
    padding: 20,

    border:
      `1px solid ${COLORS.line}`,

    borderRadius:
      12,

    background:
      COLORS.panel,
  };

const costBoxStyle:
  CSSProperties = {
    display:
      "flex",

    alignItems:
      "center",

    flexWrap:
      "wrap",

    gap: 10,

    marginTop:
      14,

    padding:
      "12px 14px",

    border:
      "1px solid transparent",

    borderRadius:
      10,
  };

const errorStyle:
  CSSProperties = {
    marginTop:
      10,

    color:
      "#F87171",

    fontSize:
      12.5,

    lineHeight:
      1.5,
  };

const actionsStyle:
  CSSProperties = {
    display:
      "flex",

    alignItems:
      "center",

    gap: 10,

    marginTop:
      16,
  };

function primaryButtonStyle(
  disabled: boolean,
): CSSProperties {
  return {
    display:
      "inline-flex",

    flex: 1,

    minHeight:
      46,

    alignItems:
      "center",

    justifyContent:
      "center",

    gap: 8,

    padding:
      "13px 18px",

    color:
      disabled
        ? COLORS.faint
        : "#111",

    cursor:
      disabled
        ? "not-allowed"
        : "pointer",

    border:
      "none",

    borderRadius:
      10,

    background:
      disabled
        ? "rgba(255,255,255,0.10)"
        : COLORS.accent,

    fontSize:
      14,

    fontWeight:
      700,

    fontFamily:
      "inherit",
  };
}

function secondaryButtonStyle(
  disabled: boolean,
): CSSProperties {
  return {
    display:
      "inline-flex",

    minHeight:
      46,

    alignItems:
      "center",

    justifyContent:
      "center",

    gap: 7,

    padding:
      "13px 16px",

    color:
      COLORS.dim,

    cursor:
      disabled
        ? "not-allowed"
        : "pointer",

    opacity:
      disabled
        ? 0.6
        : 1,

    border:
      `1px solid ${COLORS.line}`,

    borderRadius:
      10,

    background:
      "transparent",

    fontSize:
      13,

    fontWeight:
      600,

    fontFamily:
      "inherit",

    whiteSpace:
      "nowrap",
  };
}

const labelStyle:
  CSSProperties = {
    display:
      "block",

    marginBottom:
      6,

    color:
      COLORS.text,

    fontSize:
      12,

    fontWeight:
      700,
  };

const helpStyle:
  CSSProperties = {
    display:
      "block",

    marginTop:
      6,

    color:
      COLORS.faint,

    fontSize:
      11.5,

    lineHeight:
      1.5,
  };

const inputStyle:
  CSSProperties = {
    width:
      "100%",

    minHeight:
      44,

    boxSizing:
      "border-box",

    padding:
      "11px 12px",

    color:
      COLORS.text,

    outline:
      "none",

    border:
      `1px solid ${COLORS.line}`,

    borderRadius:
      8,

    background:
      "rgba(255,255,255,0.04)",

    fontSize:
      13.5,

    fontFamily:
      "inherit",
  };

function optionButtonStyle(
  selected: boolean,
): CSSProperties {
  return {
    display:
      "flex",

    minHeight:
      40,

    flexDirection:
      "column",

    alignItems:
      "flex-start",

    gap: 1,

    padding:
      "9px 13px",

    color:
      selected
        ? COLORS.accent
        : COLORS.dim,

    cursor:
      "pointer",

    border:
      `1px solid ${
        selected
          ? COLORS.accent
          : COLORS.line
      }`,

    borderRadius:
      8,

    background:
      selected
        ? "rgba(234,179,8,0.15)"
        : "rgba(255,255,255,0.03)",

    fontSize:
      12.5,

    fontWeight:
      600,

    fontFamily:
      "inherit",
  };
}
