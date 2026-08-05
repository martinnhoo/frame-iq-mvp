/**
 * RecipeStudio — interface simples para Automações.
 *
 * Recebe o briefing criado na Home, escolhe a
 * automação adequada e preenche os campos.
 *
 * A marca selecionada na Home também é aplicada
 * automaticamente ao workflow.
 */

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Play,
  Loader,
  SlidersHorizontal,
  Coins,
} from "lucide-react";

import {
  RECIPES,
  missingField,
  type Recipe,
  type RecipeField,
} from "@/lib/workflowRecipes";

import type {
  WfGraph,
} from "@/lib/hubWorkflows";

import {
  useUserBrands,
} from "@/hooks/useUserBrands";

import FishVoiceSelect from "@/components/hub/FishVoiceSelect";

const T = {
  panel: "#0a0b10",
  line: "rgba(255,255,255,0.08)",
  lineHi:
    "rgba(255,255,255,0.16)",
  text: "#fff",
  dim: "rgba(255,255,255,0.56)",
  faint:
    "rgba(255,255,255,0.34)",
  accent: "#EAB308",
};

interface Props {
  onRun: (
    name: string,
    graph: WfGraph,
  ) => Promise<void>;

  running: boolean;

  onOpenAdvanced: (
    name: string,
    graph: WfGraph,
  ) => Promise<void>;

  balance: number;
}

type WorkflowSeed = {
  brief?: string;

  objective?:
    | "static"
    | "video"
    | "campaign"
    | "carousel"
    | "adapt"
    | "social";

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

const RECIPE_BY_OBJECTIVE: Record<
  NonNullable<
    WorkflowSeed["objective"]
  >,
  string
> = {
  static: "criativos-teste",
  video: "anuncio-video",
  campaign: "criativos-teste",
  carousel: "criativos-teste",
  adapt: "criativos-teste",
  social: "criativos-teste",
};

const CHANNEL_LABEL: Record<
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

const LANGUAGE_LABEL: Record<
  NonNullable<
    WorkflowSeed["outputLanguage"]
  >,
  string
> = {
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
};

function defaultAnswers(
  recipe: Recipe,
): Record<string, string> {
  const initial: Record<
    string,
    string
  > = {};

  for (
    const field of recipe.fields
  ) {
    if (
      field.default !== undefined
    ) {
      initial[field.key] =
        String(field.default);
    }
  }

  return initial;
}

function aspectRatioForChannel(
  channel:
    | WorkflowSeed["channel"]
    | undefined,
): string {
  if (channel === "linkedin") {
    return "1:1";
  }

  if (channel === "meta") {
    return "4:5";
  }

  return "9:16";
}

function briefFromSeed(
  seed: WorkflowSeed,
): string {
  const lines = [
    seed.brief?.trim() || "",
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

  if (seed.outputLanguage) {
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

function readActiveBrandId(): string {
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
    useState<Recipe | null>(null);

  const [
    answers,
    setAnswers,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    err,
    setErr,
  ] =
    useState<string | null>(null);

  const {
    brands,
  } = useUserBrands();

  useEffect(() => {
    let rawSeed:
      | string
      | null = null;

    try {
      rawSeed =
        sessionStorage.getItem(
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
        seed.brief?.trim();

      if (!brief) {
        return;
      }

      const recipeId =
        seed.objective
          ? RECIPE_BY_OBJECTIVE[
              seed.objective
            ]
          : "criativos-teste";

      const recipe =
        RECIPES.find(
          (item) =>
            item.id === recipeId,
        );

      if (!recipe) {
        return;
      }

      const initial =
        defaultAnswers(recipe);

      const hasBrandField =
        recipe.fields.some(
          (field) =>
            field.key ===
            "brand_id",
        );

      if (hasBrandField) {
        initial.brand_id =
          readActiveBrandId();
      }

      const hasOfferField =
        recipe.fields.some(
          (field) =>
            field.key === "offer",
        );

      if (hasOfferField) {
        initial.offer =
          briefFromSeed(seed);
      }

      const hasAudienceField =
        recipe.fields.some(
          (field) =>
            field.key ===
            "audience",
        );

      if (hasAudienceField) {
        initial.audience =
          "Inferir o público mais provável a partir do briefing.";
      }

      const hasFormatField =
        recipe.fields.some(
          (field) =>
            field.key ===
            "aspect_ratio",
        );

      if (hasFormatField) {
        initial.aspect_ratio =
          aspectRatioForChannel(
            seed.channel,
          );
      }

      setPicked(recipe);
      setAnswers(initial);
      setErr(null);
    } catch {
      // Seed inválido:
      // mantém a escolha normal.
    } finally {
      try {
        sessionStorage.removeItem(
          HOME_SEED_KEY,
        );
      } catch {
        // Storage indisponível.
      }
    }
  }, []);

  const cost = useMemo(() => {
    if (!picked) {
      return 0;
    }

    try {
      return picked.estimate(
        answers,
      );
    } catch {
      return 0;
    }
  }, [picked, answers]);

  const enough =
    balance >= cost;

  function pick(
    recipe: Recipe,
  ) {
    setPicked(recipe);
    setErr(null);

    const initial =
      defaultAnswers(recipe);

    if (
      recipe.fields.some(
        (field) =>
          field.key ===
          "brand_id",
      )
    ) {
      initial.brand_id =
        readActiveBrandId();
    }

    setAnswers(initial);
  }

  async function go(
    advanced: boolean,
  ) {
    if (!picked) {
      return;
    }

    const miss =
      missingField(
        picked,
        answers,
      );

    if (miss) {
      setErr(
        `Falta preencher: ${miss}`,
      );

      return;
    }

    setErr(null);

    const graph =
      picked.build(answers);

    const name =
      picked.name;

    if (advanced) {
      await onOpenAdvanced(
        name,
        graph,
      );

      return;
    }

    await onRun(
      name,
      graph,
    );
  }

  if (!picked) {
    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding:
            "28px 20px 60px",
        }}
      >
        <style>{`
          @media (max-width: 760px) {
            .recipe-grid {
              grid-template-columns: 1fr !important;
            }

            .recipe-head {
              font-size: 22px !important;
            }
          }
        `}</style>

        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
          }}
        >
          <h1
            className="recipe-head"
            style={{
              margin: 0,
              color: T.text,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing:
                "-0.03em",
            }}
          >
            O que você quer produzir?
          </h1>

          <p
            style={{
              maxWidth: 620,
              margin:
                "8px 0 26px",
              color: T.dim,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Escolha o resultado.
            Você responde algumas
            perguntas e a automação
            roda sozinha, sem montar
            nada.
          </p>

          <div
            className="recipe-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0,1fr))",
              gap: 12,
            }}
          >
            {RECIPES.map(
              (recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() =>
                    pick(recipe)
                  }
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: 8,
                    padding: 18,
                    color: T.text,
                    textAlign: "left",
                    cursor: "pointer",
                    border: `1px solid ${T.line}`,
                    borderRadius: 12,
                    background:
                      T.panel,
                    fontFamily:
                      "inherit",
                    transition:
                      "border-color .15s, transform .15s",
                  }}
                  onMouseEnter={(
                    event,
                  ) => {
                    event.currentTarget.style.borderColor =
                      T.lineHi;

                    event.currentTarget.style.transform =
                      "translateY(-1px)";
                  }}
                  onMouseLeave={(
                    event,
                  ) => {
                    event.currentTarget.style.borderColor =
                      T.line;

                    event.currentTarget.style.transform =
                      "none";
                  }}
                >
                  <span
                    style={{
                      color:
                        T.accent,
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
                      letterSpacing:
                        "-0.01em",
                    }}
                  >
                    {recipe.name}
                  </span>

                  <span
                    style={{
                      color: T.dim,
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {
                      recipe.outcome
                    }
                  </span>

                  <span
                    style={{
                      marginTop: 2,
                      color:
                        T.faint,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {
                      recipe.whenToUse
                    }
                  </span>
                </button>
              ),
            )}
          </div>

          <div
            style={{
              marginTop: 26,
              padding: 16,
              color: T.faint,
              border: `1px dashed ${T.line}`,
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            Precisa de algo que
            não está aqui? O{" "}
            <strong
              style={{
                color: T.dim,
              }}
            >
              Modo avançado
            </strong>{" "}
            abre o editor de nós,
            onde dá para montar
            qualquer combinação.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding:
          "22px 20px 80px",
      }}
    >
      <style>{`
        @media (max-width: 760px) {
          .recipe-form {
            padding: 16px !important;
          }

          .recipe-actions {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 660,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setPicked(null)
          }
          style={{
            display:
              "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            padding: 0,
            color: T.dim,
            cursor: "pointer",
            border: "none",
            background:
              "transparent",
            fontSize: 12.5,
            fontFamily:
              "inherit",
          }}
        >
          <ArrowLeft size={13} />

          Escolher outro resultado
        </button>

        <h2
          style={{
            margin:
              "0 0 6px",
            fontSize: 21,
            fontWeight: 800,
            letterSpacing:
              "-0.02em",
          }}
        >
          {picked.name}
        </h2>

        <p
          style={{
            margin:
              "0 0 22px",
            color: T.dim,
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          {picked.outcome}
        </p>

        <div
          className="recipe-form"
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: 18,
            padding: 20,
            border: `1px solid ${T.line}`,
            borderRadius: 12,
            background:
              T.panel,
          }}
        >
          {picked.fields.map(
            (field) => (
              <Field
                key={field.key}
                field={field}
                value={
                  answers[
                    field.key
                  ] ?? ""
                }
                brands={brands}
                onChange={(
                  value,
                ) =>
                  setAnswers(
                    (
                      current,
                    ) => ({
                      ...current,
                      [field.key]:
                        value,
                    }),
                  )
                }
              />
            ),
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 14,
            padding:
              "12px 14px",
            border: `1px solid ${
              enough
                ? "rgba(234,179,8,0.22)"
                : "rgba(239,68,68,0.30)"
            }`,
            borderRadius: 10,
            background: enough
              ? "rgba(234,179,8,0.07)"
              : "rgba(239,68,68,0.09)",
          }}
        >
          <Coins
            size={15}
            color={
              enough
                ? T.accent
                : "#F87171"
            }
          />

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {cost > 0
              ? `Custa ${cost} crédito${
                  cost === 1
                    ? ""
                    : "s"
                }`
              : "Preencha para ver o custo"}
          </span>

          <span
            style={{
              color: T.dim,
              fontSize: 12.5,
            }}
          >
            · você tem {balance}
          </span>

          {!enough &&
            cost > 0 && (
              <span
                style={{
                  width: "100%",
                  color:
                    "#F87171",
                  fontSize:
                    12.5,
                }}
              >
                Saldo insuficiente.
                A automação não roda
                pela metade — ou sai
                inteira, ou nada é
                cobrado.
              </span>
            )}
        </div>

        {err && (
          <div
            style={{
              marginTop: 10,
              color: "#F87171",
              fontSize: 12.5,
            }}
          >
            {err}
          </div>
        )}

        <div
          className="recipe-actions"
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 10,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={() =>
              go(false)
            }
            disabled={
              running ||
              !enough ||
              cost === 0
            }
            style={{
              display:
                "inline-flex",
              flex: 1,
              minHeight: 46,
              alignItems:
                "center",
              justifyContent:
                "center",
              gap: 8,
              padding:
                "13px 18px",
              color:
                running ||
                !enough ||
                cost === 0
                  ? T.faint
                  : "#111",
              cursor:
                running ||
                !enough ||
                cost === 0
                  ? "not-allowed"
                  : "pointer",
              border: "none",
              borderRadius: 10,
              background:
                running ||
                !enough ||
                cost === 0
                  ? "rgba(255,255,255,0.10)"
                  : T.accent,
              fontSize: 14,
              fontWeight: 700,
              fontFamily:
                "inherit",
            }}
          >
            {running ? (
              <Loader
                size={15}
                className="spin"
              />
            ) : (
              <Play size={15} />
            )}

            {running
              ? "Gerando…"
              : "Gerar agora"}
          </button>

          <button
            type="button"
            onClick={() =>
              go(true)
            }
            disabled={running}
            title="Abre o editor de nós com esta automação já montada"
            style={{
              display:
                "inline-flex",
              minHeight: 46,
              alignItems:
                "center",
              justifyContent:
                "center",
              gap: 7,
              padding:
                "13px 16px",
              color: T.dim,
              cursor: running
                ? "not-allowed"
                : "pointer",
              opacity: running
                ? 0.6
                : 1,
              border: `1px solid ${T.line}`,
              borderRadius: 10,
              background:
                "transparent",
              fontSize: 13,
              fontWeight: 600,
              fontFamily:
                "inherit",
              whiteSpace:
                "nowrap",
            }}
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

const labelSt:
  React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: T.text,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const helpSt:
  React.CSSProperties = {
  display: "block",
  marginTop: 6,
  color: T.faint,
  fontSize: 11.5,
  lineHeight: 1.5,
};

const inputSt:
  React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  boxSizing: "border-box",
  padding: "11px 12px",
  color: T.text,
  outline: "none",
  border: `1px solid ${T.line}`,
  borderRadius: 8,
  background:
    "rgba(255,255,255,0.04)",
  fontSize: 13.5,
  fontFamily: "inherit",
};

function Field({
  field,
  value,
  onChange,
  brands,
}: {
  field: RecipeField;

  value: string;

  onChange:
    (value: string) => void;

  brands: {
    id: string;
    name: string;
  }[];
}) {
  return (
    <label
      style={{
        display: "block",
      }}
    >
      <span style={labelSt}>
        {field.label}

        {!field.required && (
          <span
            style={{
              color: T.faint,
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
              event.target.value,
            )
          }
          style={{
            ...inputSt,
            resize: "vertical",
            lineHeight: 1.6,
            scrollMarginBottom:
              140,
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
              event.target.value,
            )
          }
          style={inputSt}
        />
      )}

      {field.kind ===
        "number" && (
        <input
          type="number"
          value={value}
          min={field.min}
          max={field.max}
          onChange={(
            event,
          ) =>
            onChange(
              event.target.value,
            )
          }
          style={{
            ...inputSt,
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
              event.target.value,
            )
          }
          style={{
            ...inputSt,
            cursor: "pointer",
          }}
        >
          <option value="">
            Sem marca
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
                  {
                    brand.name
                  }
                </option>
              ),
            )}
        </select>
      )}

      {field.kind ===
        "voice" && (
        <FishVoiceSelect
          value={value}
          onChange={(id) =>
            onChange(id)
          }
          style={inputSt}
          multiple
        />
      )}

      {field.kind ===
        "select" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {(field.options ||
            []).map(
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
                  style={{
                    display:
                      "flex",
                    minHeight: 40,
                    flexDirection:
                      "column",
                    alignItems:
                      "flex-start",
                    gap: 1,
                    padding:
                      "9px 13px",
                    color:
                      selected
                        ? T.accent
                        : T.dim,
                    cursor:
                      "pointer",
                    border: `1px solid ${
                      selected
                        ? T.accent
                        : T.line
                    }`,
                    borderRadius: 8,
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
                  }}
                >
                  <span>
                    {
                      option.label
                    }
                  </span>

                  {option.hint && (
                    <span
                      style={{
                        opacity:
                          0.7,
                        fontSize:
                          10.5,
                        fontWeight:
                          500,
                      }}
                    >
                      {
                        option.hint
                      }
                    </span>
                  )}
                </button>
              );
            },
          )}
        </div>
      )}

      {field.help && (
        <span style={helpSt}>
          {field.help}
        </span>
      )}
    </label>
  );
}
