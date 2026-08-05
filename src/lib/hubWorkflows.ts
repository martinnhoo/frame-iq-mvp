/**
 * CRUD e runtime client-side dos Workflows.
 *
 * Regras:
 * - todo grafo Ã© validado antes de salvar ou executar;
 * - o frontend envia apenas os identificadores da marca;
 * - o backend carrega o contexto completo da marca;
 * - polling Ã© cancelÃ¡vel e nÃ£o acumula listeners.
 */

import {
  supabase,
} from "@/integrations/supabase/client";

import type {
  WfEdge,
  WfGraph,
  WfNode,
} from "./workflowTypes";

import {
  validateWorkflowGraph,
} from "./workflowValidation";

export type {
  WfEdge,
  WfGraph,
  WfNode,
} from "./workflowTypes";

export {
  validateWorkflowGraph,
} from "./workflowValidation";

/*
 * As tabelas de workflow ainda
 * nÃ£o estÃ£o nos tipos gerados.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const database =
  supabase as any;

export interface Workflow {
  id: string;
  user_id: string | null;
  name: string;
  description?: string | null;
  brand_id?: string | null;
  graph: WfGraph;
  is_template: boolean;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkflowSummary =
  Omit<
    Workflow,
    "graph"
  >;

export interface WorkflowRun {
  id: string;
  workflow_id: string;

  status:
    | "pending"
    | "running"
    | "succeeded"
    | "partial"
    | "failed";

  inputs?:
    Record<
      string,
      unknown
    >;

  outputs?:
    Record<
      string,
      unknown
    >;

  error?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

const SUMMARY_FIELDS =
  "id, user_id, name, description, brand_id, " +
  "is_template, thumbnail_url, created_at, updated_at";

function assertValidGraph(
  graph: WfGraph,
): void {
  const error =
    validateWorkflowGraph(
      graph,
    );

  if (error) {
    throw new Error(
      `workflow_invalid: ${error}`,
    );
  }
}

function deriveBrandId(
  graph: WfGraph,
): string | null {
  const brandNode =
    graph.nodes.find(
      (node) =>
        node.type ===
        "brand",
    );

  const value =
    brandNode?.data
      .brand_id;

  return (
    typeof value ===
      "string" &&
    value.trim()
  )
    ? value.trim()
    : null;
}

/*
 * NÃ£o resolve cores, assets ou notas no cliente.
 * Isso fica sob responsabilidade do backend.
 */
function buildBrandInputs(
  graph: WfGraph,
): Record<
  string,
  Record<
    string,
    unknown
  >
> {
  const inputs:
    Record<
      string,
      Record<
        string,
        unknown
      >
    > = {};

  for (
    const node
    of graph.nodes
  ) {
    if (
      node.type !==
      "brand"
    ) {
      continue;
    }

    inputs[node.id] = {
      brand_id:
        typeof node.data
          .brand_id ===
          "string" &&
        node.data
          .brand_id
          .trim()
          ? node.data
              .brand_id
              .trim()
          : null,

      market:
        typeof node.data
          .market ===
          "string" &&
        node.data
          .market
          .trim()
          ? node.data
              .market
              .trim()
          : null,

      include_disclaimer:
        Boolean(
          node.data
            .include_disclaimer,
        ),
    };
  }

  return inputs;
}

export async function listMyWorkflows():
  Promise<
    WorkflowSummary[]
  > {
  const {
    data:
      sessionData,
  } =
    await supabase
      .auth
      .getSession();

  const userId =
    sessionData
      ?.session
      ?.user
      ?.id;

  if (!userId) {
    return [];
  }

  const {
    data,
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .select(
        SUMMARY_FIELDS,
      )
      .eq(
        "user_id",
        userId,
      )
      .order(
        "updated_at",
        {
          ascending:
            false,
        },
      );

  if (error) {
    console.error(
      "[hubWorkflows] list mine error:",
      error.message,
    );

    return [];
  }

  return (
    data || []
  ) as WorkflowSummary[];
}

export async function listTemplates():
  Promise<
    WorkflowSummary[]
  > {
  const {
    data,
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .select(
        SUMMARY_FIELDS,
      )
      .eq(
        "is_template",
        true,
      )
      .is(
        "user_id",
        null,
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        },
      );

  if (error) {
    console.error(
      "[hubWorkflows] list templates error:",
      error.message,
    );

    return [];
  }

  return (
    data || []
  ) as WorkflowSummary[];
}

export async function getWorkflow(
  id: string,
): Promise<
  Workflow | null
> {
  const {
    data,
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .select("*")
      .eq(
        "id",
        id,
      )
      .single();

  if (
    error ||
    !data
  ) {
    if (error) {
      console.error(
        "[hubWorkflows] get error:",
        error.message,
      );
    }

    return null;
  }

  return data as Workflow;
}

export async function createWorkflow(
  args: {
    name: string;
    description?: string;
    brand_id?:
      string | null;
    graph: WfGraph;
  },
): Promise<Workflow> {
  assertValidGraph(
    args.graph,
  );

  const {
    data:
      sessionData,
  } =
    await supabase
      .auth
      .getSession();

  const userId =
    sessionData
      ?.session
      ?.user
      ?.id;

  if (!userId) {
    throw new Error(
      "not_authenticated",
    );
  }

  const {
    data,
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .insert({
        user_id:
          userId,

        name:
          args.name
            .trim() ||
          "Workflow sem nome",

        description:
          args.description
            ?.trim() ||
          null,

        brand_id:
          args.brand_id ===
          undefined
            ? deriveBrandId(
                args.graph,
              )
            : args.brand_id ||
              null,

        graph:
          args.graph,

        is_template:
          false,
      })
      .select("*")
      .single();

  if (
    error ||
    !data
  ) {
    throw new Error(
      "create failed: " +
      (
        error?.message ||
        "unknown_error"
      ),
    );
  }

  return data as Workflow;
}

export async function updateWorkflowGraph(
  id: string,
  graph: WfGraph,
  name?: string,
  brandId?: string | null,
): Promise<void> {
  assertValidGraph(
    graph,
  );

  const update:
    Record<
      string,
      unknown
    > = {
      graph,

      brand_id:
        brandId ===
        undefined
          ? deriveBrandId(
              graph,
            )
          : brandId,
    };

  if (
    name !== undefined
  ) {
    update.name =
      name.trim() ||
      "Workflow sem nome";
  }

  const {
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .update(
        update,
      )
      .eq(
        "id",
        id,
      );

  if (error) {
    throw new Error(
      `update failed: ${error.message}`,
    );
  }
}

export async function deleteWorkflow(
  id: string,
): Promise<void> {
  const {
    error,
  } =
    await database
      .from(
        "hub_workflows",
      )
      .delete()
      .eq(
        "id",
        id,
      );

  if (error) {
    throw new Error(
      `delete failed: ${error.message}`,
    );
  }
}

export async function cloneWorkflow(
  sourceId: string,
  newName?: string,
): Promise<Workflow> {
  const source =
    await getWorkflow(
      sourceId,
    );

  if (!source) {
    throw new Error(
      "source_not_found",
    );
  }

  return createWorkflow({
    name:
      newName ||
      `${source.name} (cÃ³pia)`,

    description:
      source.description ||
      undefined,

    brand_id:
      source.brand_id,

    graph:
      source.graph,
  });
}

function responseMessage(
  payload:
    Record<
      string,
      unknown
    >,
  fallback: string,
): string {
  const candidates = [
    payload.message,
    payload.error,
    payload.details,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return fallback;
}

export async function runWorkflow(
  args: {
    workflow_id: string;
    graph: WfGraph;

    extraInputs?:
      Record<
        string,
        Record<
          string,
          unknown
        >
      >;
  },
): Promise<{
  ok: boolean;
  run_id?: string;
  status?: string;
  total?: number;
  message?: string;
}> {
  const graphError =
    validateWorkflowGraph(
      args.graph,
    );

  if (graphError) {
    return {
      ok: false,

      message:
        `Workflow invÃ¡lido: ${graphError}`,
    };
  }

  const SUPABASE_URL = String(
    import.meta.env.VITE_SUPABASE_URL || "",
  );

  const ANON_KEY = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  );

  if (
    !SUPABASE_URL ||
    !ANON_KEY
  ) {
    return {
      ok: false,

      message:
        "ConfiguraÃ§Ã£o do Supabase ausente",
    };
  }

  const {
    data:
      sessionData,
  } =
    await supabase
      .auth
      .getSession();

  const token =
    sessionData
      ?.session
      ?.access_token;

  if (!token) {
    return {
      ok: false,

      message:
        "SessÃ£o expirada. Entre novamente.",
    };
  }

  const inputs =
    buildBrandInputs(
      args.graph,
    );

  for (
    const [
      nodeId,
      override,
    ]
    of Object.entries(
      args.extraInputs ||
      {},
    )
  ) {
    inputs[nodeId] = {
      ...(
        inputs[nodeId] ||
        {}
      ),

      ...override,
    };
  }

  let response:
    Response;

  try {
    response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/execute-workflow`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

            apikey:
              ANON_KEY,
          },

          body:
            JSON.stringify({
              workflow_id:
                args.workflow_id,

              inputs,
            }),
        },
      );
  } catch (error) {
    return {
      ok: false,

      message:
        error instanceof
          Error
          ? `Falha de rede: ${error.message}`
          : "Falha de rede ao iniciar o workflow",
    };
  }

  const text =
    await response.text();

  let payload:
    Record<
      string,
      unknown
    > = {};

  if (text.trim()) {
    try {
      payload =
        JSON.parse(
          text,
        ) as Record<
          string,
          unknown
        >;
    } catch {
      return {
        ok: false,

        message:
          response.ok
            ? "O servidor retornou uma resposta invÃ¡lida"
            : text.slice(
                0,
                240,
              ),
      };
    }
  }

  if (!response.ok) {
    return {
      ok: false,

      message:
        responseMessage(
          payload,

          `Falha ao iniciar workflow (${response.status})`,
        ),
    };
  }

  const ok =
    Boolean(
      payload.ok,
    );

  return {
    ok,

    run_id:
      typeof payload.run_id ===
        "string"
        ? payload.run_id
        : undefined,

    status:
      typeof payload.status ===
        "string"
        ? payload.status
        : undefined,

    total:
      typeof payload.total ===
        "number"
        ? payload.total
        : undefined,

    message:
      responseMessage(
        payload,

        ok
          ? "Workflow iniciado"
          : "Falha ao iniciar workflow",
      ),
  };
}

export interface RunSnapshot {
  id: string;
  workflow_id: string;

  status:
    | "pending"
    | "running"
    | "succeeded"
    | "partial"
    | "failed";

  outputs:
    Record<
      string,
      unknown
    >;

  errors:
    Record<
      string,
      string
    > | null;

  nodes_done: number;
  nodes_failed: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

function normalizeRunStatus(
  value: unknown,
): RunSnapshot["status"] {
  if (
    value ===
      "pending" ||
    value ===
      "running" ||
    value ===
      "succeeded" ||
    value ===
      "partial" ||
    value ===
      "failed"
  ) {
    return value;
  }

  return "failed";
}

function normalizeErrors(
  value: unknown,
): Record<
  string,
  string
> | null {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<
          string,
          unknown
        >,
      ).map(
        ([
          key,
          item,
        ]) => [
          key,

          typeof item ===
            "string"
            ? item
            : JSON.stringify(
                item,
              ),
        ],
      ),
    );
  }

  if (
    typeof value ===
    "string"
  ) {
    try {
      const parsed =
        JSON.parse(
          value,
        ) as unknown;

      return (
        normalizeErrors(
          parsed,
        ) ||
        {
          run: value,
        }
      );
    } catch {
      return {
        run: value,
      };
    }
  }

  return {
    run:
      String(value),
  };
}

export async function getWorkflowRun(
  runId: string,
): Promise<
  RunSnapshot | null
> {
  const {
    data:
      sessionData,
  } =
    await supabase
      .auth
      .getSession();

  const userId =
    sessionData
      ?.session
      ?.user
      ?.id;

  if (!userId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await database
      .from(
        "hub_workflow_runs",
      )
      .select(
        "id, workflow_id, status, outputs, error, " +
        "started_at, ended_at, created_at",
      )
      .eq(
        "id",
        runId,
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[hubWorkflows] get run error:",
      error.message,
    );

    return null;
  }

  if (!data) {
    return null;
  }

  const outputs =
    data.outputs &&
    typeof data.outputs ===
      "object"
      ? data.outputs as Record<
          string,
          unknown
        >
      : {};

  const errors =
    normalizeErrors(
      data.error,
    );

  return {
    id:
      data.id,

    workflow_id:
      data.workflow_id,

    status:
      normalizeRunStatus(
        data.status,
      ),

    outputs,
    errors,

    nodes_done:
      Object.keys(
        outputs,
      ).length,

    nodes_failed:
      errors
        ? Object.keys(
            errors,
          ).length
        : 0,

    started_at:
      data.started_at ||
      null,

    ended_at:
      data.ended_at ||
      null,

    created_at:
      data.created_at,
  };
}

function isTerminal(
  status:
    RunSnapshot["status"],
): boolean {
  return (
    status ===
      "succeeded" ||
    status ===
      "partial" ||
    status ===
      "failed"
  );
}

async function cancelableSleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      let settled =
        false;

      const finish =
        () => {
          if (settled) {
            return;
          }

          settled =
            true;

          clearTimeout(
            timer,
          );

          signal
            ?.removeEventListener(
              "abort",
              finish,
            );

          resolve();
        };

      const timer =
        setTimeout(
          finish,
          milliseconds,
        );

      if (
        signal?.aborted
      ) {
        finish();
        return;
      }

      signal
        ?.addEventListener(
          "abort",
          finish,
          {
            once: true,
          },
        );
    },
  );
}

export async function pollWorkflowRun(
  runId: string,

  onProgress:
    (
      snapshot:
        RunSnapshot,
    ) => void,

  options?: {
    intervalMs?: number;
    maxWallMs?: number;
    stopSignal?:
      AbortSignal;
  },
): Promise<
  RunSnapshot | null
> {
  const intervalMs =
    options
      ?.intervalMs ??
    2500;

  const maxWallMs =
    options
      ?.maxWallMs ??
    8 *
      60 *
      1000;

  const startedAt =
    Date.now();

  const staleThresholdMs =
    5 *
    60 *
    1000;

  const maxConsecutiveNulls =
    3;

  let snapshot:
    RunSnapshot | null =
      null;

  let consecutiveNulls =
    0;

  let lastProgressCount =
    -1;

  let lastProgressAt =
    Date.now();

  let rescueAttempted =
    false;

  while (
    Date.now() -
      startedAt <
    maxWallMs
  ) {
    if (
      options
        ?.stopSignal
        ?.aborted
    ) {
      return snapshot;
    }

    const fresh =
      await getWorkflowRun(
        runId,
      );

    if (!fresh) {
      consecutiveNulls +=
        1;

      if (
        consecutiveNulls >=
        maxConsecutiveNulls
      ) {
        console.warn(
          `[pollWorkflowRun] run ${runId} ` +
          `nÃ£o encontrado apÃ³s ` +
          `${maxConsecutiveNulls} consultas`,
        );

        return null;
      }
    } else {
      consecutiveNulls =
        0;

      snapshot =
        fresh;

      onProgress(
        fresh,
      );

      if (
        isTerminal(
          fresh.status,
        )
      ) {
        return fresh;
      }

      const progressCount =
        fresh.nodes_done +
        fresh.nodes_failed;

      if (
        progressCount !==
        lastProgressCount
      ) {
        lastProgressCount =
          progressCount;

        lastProgressAt =
          Date.now();
      } else if (
        !rescueAttempted &&
        Date.now() -
          lastProgressAt >=
          staleThresholdMs
      ) {
        rescueAttempted =
          true;

        try {
          await triggerStaleRescue(
            runId,
          );
        } catch (error) {
          console.warn(
            "[pollWorkflowRun] rescue failed:",
            error,
          );
        }
      }
    }

    await cancelableSleep(
      intervalMs,
      options
        ?.stopSignal,
    );
  }

  if (
    snapshot &&
    !isTerminal(
      snapshot.status,
    ) &&
    !options
      ?.stopSignal
      ?.aborted
  ) {
    try {
      await triggerStaleRescue(
        runId,
      );

      await cancelableSleep(
        1200,
        options
          ?.stopSignal,
      );

      const rescued =
        await getWorkflowRun(
          runId,
        );

      if (rescued) {
        onProgress(
          rescued,
        );

        return rescued;
      }
    } catch (error) {
      console.warn(
        "[pollWorkflowRun] timeout rescue failed:",
        error,
      );
    }
  }

  return snapshot;
}

async function triggerStaleRescue(
  runId: string,
): Promise<void> {
  const SUPABASE_URL = String(
    import.meta.env.VITE_SUPABASE_URL || "",
  );

  const ANON_KEY = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  );

  const {
    data:
      sessionData,
  } =
    await supabase
      .auth
      .getSession();

  const token =
    sessionData
      ?.session
      ?.access_token;

  if (
    !SUPABASE_URL ||
    !ANON_KEY
  ) {
    throw new Error(
      "missing_supabase_config",
    );
  }

  if (!token) {
    throw new Error(
      "no_session",
    );
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/functions/v1/execute-workflow`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          apikey:
            ANON_KEY,
        },

        body:
          JSON.stringify({
            rescue_stale_run_id:
              runId,
          }),
      },
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      text.slice(
        0,
        240,
      ) ||
      `rescue_failed_${response.status}`,
    );
  }
}
