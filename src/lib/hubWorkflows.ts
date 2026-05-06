/**
 * hubWorkflows — CRUD client-side da feature Workflows.
 *
 * Tabela hub_workflows guarda o grafo (nodes + edges em JSON).
 * Tabela hub_workflow_runs guarda execuções.
 *
 * Resolução de `brand` node: o frontend resolve brand_id+market →
 * brand_hint+license_text via getBrand() ANTES de submeter a run, e
 * passa como overrides via `inputs`. Server trata brand como passthrough.
 */
import { supabase } from "@/integrations/supabase/client";
import { getBrand, HUB_MARKETS, type MarketCode } from "@/data/hubBrands";

// Cast pra any: tabelas hub_workflows/hub_workflow_runs são novas (migration
// 20260506140000), types.ts ainda não regenerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ── Tipos do grafo ──────────────────────────────────────────────────
export interface WfNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}
export interface WfEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
export interface WfGraph {
  version: number;
  nodes: WfNode[];
  edges: WfEdge[];
}

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

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: "pending" | "running" | "succeeded" | "partial" | "failed";
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

// ── List ────────────────────────────────────────────────────────────
export async function listMyWorkflows(): Promise<Workflow[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return [];
  const { data, error } = await sb
    .from("hub_workflows")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[hubWorkflows] list mine error:", error.message);
    return [];
  }
  return (data || []) as Workflow[];
}

export async function listTemplates(): Promise<Workflow[]> {
  const { data, error } = await sb
    .from("hub_workflows")
    .select("*")
    .eq("is_template", true)
    .is("user_id", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[hubWorkflows] list templates error:", error.message);
    return [];
  }
  return (data || []) as Workflow[];
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data, error } = await sb
    .from("hub_workflows")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Workflow;
}

// ── Create / update / delete ────────────────────────────────────────
export async function createWorkflow(args: {
  name: string;
  description?: string;
  brand_id?: string | null;
  graph: WfGraph;
}): Promise<Workflow> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("not_authenticated");
  const { data, error } = await sb
    .from("hub_workflows")
    .insert({
      user_id: userId,
      name: args.name.trim() || "Workflow sem nome",
      description: args.description || null,
      brand_id: args.brand_id || null,
      graph: args.graph,
      is_template: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`create failed: ${error?.message}`);
  return data as Workflow;
}

export async function updateWorkflowGraph(
  id: string,
  graph: WfGraph,
  name?: string,
  brand_id?: string | null,
): Promise<void> {
  const update: Record<string, unknown> = { graph };
  if (name !== undefined) update.name = name.trim() || "Workflow sem nome";
  if (brand_id !== undefined) update.brand_id = brand_id;
  const { error } = await sb.from("hub_workflows").update(update).eq("id", id);
  if (error) throw new Error(`update failed: ${error.message}`);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await sb.from("hub_workflows").delete().eq("id", id);
  if (error) throw new Error(`delete failed: ${error.message}`);
}

/**
 * Duplica um workflow (template ou próprio) como novo workflow do user.
 * Útil pra "abrir template" sem editar o original.
 */
export async function cloneWorkflow(sourceId: string, newName?: string): Promise<Workflow> {
  const src = await getWorkflow(sourceId);
  if (!src) throw new Error("source not found");
  return await createWorkflow({
    name: newName || `${src.name} (cópia)`,
    description: src.description || undefined,
    brand_id: src.brand_id,
    graph: src.graph,
  });
}

// ── Execução ────────────────────────────────────────────────────────
/**
 * Resolve brand nodes do grafo: pra cada nó `brand`, pega brand_id +
 * market do data e gera brand_hint + license_text via getBrand().
 *
 * Retorna inputs override no formato esperado pelo execute-workflow:
 *   { [nodeId]: { brand_hint, license_text, market, brand_id, include_disclaimer } }
 */
function resolveBrandNodes(graph: WfGraph): Record<string, Record<string, unknown>> {
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const node of graph.nodes) {
    if (node.type !== "brand") continue;
    const brand_id = (node.data.brand_id as string) || null;
    const market = (node.data.market as string) || null;
    const include_disclaimer = !!node.data.include_disclaimer;

    const brand = brand_id ? getBrand(brand_id) : null;
    let brand_hint = brand?.promptHint || "";
    if (market && HUB_MARKETS[market as MarketCode]?.promptContext) {
      brand_hint = `${brand_hint}\n\n${HUB_MARKETS[market as MarketCode].promptContext}`.trim();
    }

    const license_text = brand?.license && market
      ? brand.license[market as MarketCode] || ""
      : "";

    overrides[node.id] = {
      brand_id,
      market,
      brand_hint,
      license_text,
      include_disclaimer: include_disclaimer && !!license_text,
    };
  }
  return overrides;
}

/**
 * Inicia um run de workflow. Retorna run_id imediatamente — execução
 * acontece em background (EdgeRuntime.waitUntil). Caller deve usar
 * pollWorkflowRun pra acompanhar progresso.
 */
export async function runWorkflow(args: {
  workflow_id: string;
  graph: WfGraph;
  /** Overrides extras dos nós-fonte (ex: novo prompt). */
  extraInputs?: Record<string, Record<string, unknown>>;
}): Promise<{
  ok: boolean;
  run_id?: string;
  status?: string;
  total?: number;
  message?: string;
}> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { ok: false, message: "session expired" };

  const brandOverrides = resolveBrandNodes(args.graph);
  const inputs: Record<string, Record<string, unknown>> = { ...brandOverrides };
  if (args.extraInputs) {
    for (const [k, v] of Object.entries(args.extraInputs)) {
      inputs[k] = { ...(inputs[k] || {}), ...v };
    }
  }

  const r = await fetch(`${SUPABASE_URL}/functions/v1/execute-workflow`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ workflow_id: args.workflow_id, inputs }),
  });
  const text = await r.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(text); } catch { return { ok: false, message: text.slice(0, 200) }; }
  return {
    ok: !!payload.ok,
    run_id: payload.run_id as string | undefined,
    status: payload.status as string | undefined,
    total: payload.total as number | undefined,
    message: payload.message as string | undefined,
  };
}

/**
 * Snapshot atual do run. Usado pra polling.
 */
export interface RunSnapshot {
  id: string;
  workflow_id: string;
  status: "pending" | "running" | "succeeded" | "partial" | "failed";
  outputs: Record<string, unknown>;
  errors: Record<string, string> | null;
  nodes_done: number;
  nodes_failed: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export async function getWorkflowRun(runId: string): Promise<RunSnapshot | null> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  const r = await fetch(`${SUPABASE_URL}/functions/v1/get-workflow-run?run_id=${encodeURIComponent(runId)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": ANON_KEY,
    },
  });
  if (!r.ok) return null;
  const payload = await r.json().catch(() => null);
  if (!payload?.ok || !payload.run) return null;
  return payload.run as RunSnapshot;
}

/**
 * Pola o run a cada `intervalMs` até status ∈ {succeeded, partial, failed}
 * ou até stopSignal disparar. Chama onProgress a cada snapshot pra UI
 * atualizar barra de progresso + thumbs conforme aparecem.
 *
 * Timeout máximo: 8 minutos (gera 50 imgs ~5min, dá folga). Se exceder,
 * retorna o último snapshot com status atual (pode ser 'running' ainda).
 */
export async function pollWorkflowRun(
  runId: string,
  onProgress: (snap: RunSnapshot) => void,
  opts?: { intervalMs?: number; maxWallMs?: number; stopSignal?: AbortSignal },
): Promise<RunSnapshot | null> {
  const intervalMs = opts?.intervalMs ?? 2500;
  const maxWallMs = opts?.maxWallMs ?? 8 * 60 * 1000;
  const startedAt = Date.now();
  let snap: RunSnapshot | null = null;
  // Bug fix: se getWorkflowRun retorna null (404 — run sumiu do servidor),
  // antes ficava polando 8min sem nunca terminar — UI presa em "running".
  // Agora aborta após 3 nulls consecutivos. Run só "some" se foi limpa
  // ou nunca existiu (stale localStorage).
  let consecutiveNulls = 0;
  const MAX_CONSECUTIVE_NULLS = 3;

  while (Date.now() - startedAt < maxWallMs) {
    if (opts?.stopSignal?.aborted) return snap;
    const fresh = await getWorkflowRun(runId);
    if (fresh) {
      consecutiveNulls = 0;
      snap = fresh;
      onProgress(fresh);
      if (["succeeded", "partial", "failed"].includes(fresh.status)) {
        return fresh;
      }
    } else {
      consecutiveNulls++;
      if (consecutiveNulls >= MAX_CONSECUTIVE_NULLS) {
        console.warn(`[pollWorkflowRun] run ${runId} not found after ${MAX_CONSECUTIVE_NULLS} polls — aborting`);
        return null;
      }
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return snap;
}
