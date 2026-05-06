// execute-workflow — runtime do Brilliant Workflows.
//
// Recebe { workflow_id, inputs } do front. Carrega o grafo do DB,
// aplica overrides dos nós-fonte, valida (sem ciclos), ordena
// topologicamente, e executa nós nível-a-nível chamando as edge
// functions já existentes (generate-image-hub etc).
//
// Pra MVP Fase 1: 4 tipos de nó suportados — brand, prompt, image-gen,
// output. Os 4 fazem o caso de uso "promo de jogo" rodar end-to-end.
//
// Execução é SÍNCRONA por enquanto (cliente espera). Fase 2/3 vão pra
// background com EdgeRuntime.waitUntil quando workflows ficarem maiores
// que 90s.

const FN_VERSION = "v5-async-count-2026-05-06";

// Limites de segurança pra fan-out (count + variation expandidos)
const MAX_TOTAL_NODES_AFTER_EXPANSION = 300; // hard cap
const MAX_IMAGE_GEN_COUNT = 50;

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── Tipos do grafo ──────────────────────────────────────────────────
interface GraphNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data: Record<string, unknown>;
}
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
interface Graph {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Map node_id → output value (qualquer JSON serializable)
type OutputsMap = Record<string, unknown>;

// ── Helpers ─────────────────────────────────────────────────────────
function applyInputOverrides(graph: Graph, inputs: Record<string, Record<string, unknown>> | undefined): Graph {
  if (!inputs) return graph;
  const nodes = graph.nodes.map(n => {
    const override = inputs[n.id];
    if (!override) return n;
    return { ...n, data: { ...n.data, ...override } };
  });
  return { ...graph, nodes };
}

/**
 * Expande nós `variation` em sub-grafos paralelos.
 *
 * Para cada variation node V com data.values = [v1, v2, v3]:
 *   - Encontra TODOS os nós downstream (alcançáveis via edges saindo de V)
 *   - Pra cada valor vi, clona TODOS os nós downstream com novos IDs
 *   - Aplica override do axis (data.axis) em cada clone — ex: aspect_ratio = vi
 *   - Reconecta upstream-of-V → clones (substitui V no grafo)
 *
 * Suporta apenas 1 nível de variation no MVP (sem nested variations).
 * Eixos suportados: aspect_ratio (override em image-gen).
 *
 * Resultado: grafo livre de variation nodes, com N branches paralelos.
 */
function expandVariations(graph: Graph): Graph {
  const variationNodes = graph.nodes.filter(n => n.type === "variation");
  if (variationNodes.length === 0) return graph;

  let workGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };

  for (const vNode of variationNodes) {
    const axis = String(vNode.data.axis || "aspect_ratio");
    const values = Array.isArray(vNode.data.values) ? (vNode.data.values as string[]) : [];
    if (values.length === 0) {
      // Sem valores — remove o nó da execução e conecta upstream direto ao downstream
      workGraph = bypassNode(workGraph, vNode.id);
      continue;
    }

    // Coleta downstream IDs (BFS a partir de vNode)
    const downstreamIds = new Set<string>();
    const queue = [vNode.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of workGraph.edges) {
        if (e.source === cur && !downstreamIds.has(e.target) && e.target !== vNode.id) {
          downstreamIds.add(e.target);
          queue.push(e.target);
        }
      }
    }

    const directDownstreamEdges = workGraph.edges.filter(e => e.source === vNode.id);
    const upstreamEdges = workGraph.edges.filter(e => e.target === vNode.id);

    // Remove vNode + downstream originais + edges relacionadas
    let newNodes = workGraph.nodes.filter(n => n.id !== vNode.id && !downstreamIds.has(n.id));
    let newEdges = workGraph.edges.filter(e =>
      e.source !== vNode.id && e.target !== vNode.id &&
      !downstreamIds.has(e.source) && !downstreamIds.has(e.target)
    );

    // Pra cada valor, clona o subgrafo downstream
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const idMap = new Map<string, string>();

      for (const id of downstreamIds) {
        const orig = workGraph.nodes.find(n => n.id === id);
        if (!orig) continue;
        const newId = `${orig.id}_v${i}`;
        idMap.set(id, newId);
        const newData = { ...orig.data };
        // Aplica override do axis. Suportado: aspect_ratio.
        // Outros axes (market, etc) precisam de re-resolução de brand context
        // — fica pra Fase 3.
        if (axis === "aspect_ratio") newData.aspect_ratio = val;
        const offsetY = (orig.position?.y || 0) + i * 220;
        newNodes.push({
          ...orig,
          id: newId,
          data: newData,
          position: { x: (orig.position?.x || 0) + 80, y: offsetY },
        });
      }

      // Edges entre downstream nodes (interno ao subgrafo)
      for (const e of workGraph.edges) {
        if (downstreamIds.has(e.source) && downstreamIds.has(e.target)) {
          newEdges.push({
            id: `${e.id}_v${i}`,
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          });
        }
      }

      // Reconecta upstream → clone do direct downstream
      for (const dde of directDownstreamEdges) {
        const cloneTarget = idMap.get(dde.target);
        if (!cloneTarget) continue;
        for (const ue of upstreamEdges) {
          newEdges.push({
            id: `${ue.id}_${dde.id}_v${i}`,
            source: ue.source,
            sourceHandle: ue.sourceHandle,
            target: cloneTarget,
            targetHandle: dde.targetHandle,
          });
        }
        // Se variation não tinha upstream (nó-fonte), conecta nada — clone vira nó-fonte
        if (upstreamEdges.length === 0 && downstreamIds.has(dde.target)) {
          // Nó clone fica orfão, ainda pode ser executado (se for tipo brand/prompt)
        }
      }
    }

    workGraph = { ...workGraph, nodes: newNodes, edges: newEdges };
  }

  return workGraph;
}

/**
 * Remove um nó conectando direto seus upstreams aos downstreams.
 * Usado quando variation tem values=[].
 */
function bypassNode(graph: Graph, nodeId: string): Graph {
  const upstream = graph.edges.filter(e => e.target === nodeId);
  const downstream = graph.edges.filter(e => e.source === nodeId);
  const newEdges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
  for (const ue of upstream) {
    for (const de of downstream) {
      newEdges.push({
        id: `${ue.id}_${de.id}_bypass`,
        source: ue.source,
        sourceHandle: ue.sourceHandle,
        target: de.target,
        targetHandle: de.targetHandle,
      });
    }
  }
  return {
    ...graph,
    nodes: graph.nodes.filter(n => n.id !== nodeId),
    edges: newEdges,
  };
}

/**
 * Expande nós `image-gen` com data.count > 1 em N branches paralelos.
 *
 * Cada branch clona o image-gen + TODO o subgrafo downstream com novos IDs,
 * e reconecta upstream. Mesma técnica do expandVariations mas dispara só
 * quando count > 1.
 *
 * Usado pra "gerar 50 estáticos com 1 click" — user marca count=50,
 * graph rewriter cria 50 cópias paralelas.
 *
 * Cap em MAX_IMAGE_GEN_COUNT (50). Cap total no número de nós em
 * MAX_TOTAL_NODES_AFTER_EXPANSION (300) pra evitar workflows hostis.
 */
function expandImageGenCount(graph: Graph): Graph {
  const targets = graph.nodes.filter(n =>
    n.type === "image-gen" && Number(n.data.count || 1) > 1
  );
  if (targets.length === 0) return graph;

  let workGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };

  for (const node of targets) {
    const requested = Math.floor(Number(node.data.count) || 1);
    const count = Math.min(MAX_IMAGE_GEN_COUNT, Math.max(1, requested));
    if (count <= 1) continue;

    // Coleta downstream IDs (BFS a partir desse image-gen)
    const downstreamIds = new Set<string>();
    const queue = [node.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of workGraph.edges) {
        if (e.source === cur && !downstreamIds.has(e.target) && e.target !== node.id) {
          downstreamIds.add(e.target);
          queue.push(e.target);
        }
      }
    }

    const directDownstreamEdges = workGraph.edges.filter(e => e.source === node.id);
    const upstreamEdges = workGraph.edges.filter(e => e.target === node.id);

    // Remove o image-gen original + downstream + edges relacionadas
    let newNodes = workGraph.nodes.filter(n => n.id !== node.id && !downstreamIds.has(n.id));
    let newEdges = workGraph.edges.filter(e =>
      e.source !== node.id && e.target !== node.id &&
      !downstreamIds.has(e.source) && !downstreamIds.has(e.target)
    );

    // Pra cada cópia (1 a count), clona image-gen + subgrafo downstream
    for (let i = 0; i < count; i++) {
      const idMap = new Map<string, string>();
      const newImageGenId = `${node.id}_n${i}`;
      idMap.set(node.id, newImageGenId);

      // Clone image-gen com count=1 (pra não re-expandir e travar em loop)
      newNodes.push({
        ...node,
        id: newImageGenId,
        data: { ...node.data, count: 1, _count_index: i, _count_total: count },
        position: { x: (node.position?.x || 0), y: (node.position?.y || 0) + i * 220 },
      });

      // Clone downstream nodes
      for (const did of downstreamIds) {
        const orig = workGraph.nodes.find(n => n.id === did);
        if (!orig) continue;
        const newId = `${orig.id}_n${i}`;
        idMap.set(did, newId);
        newNodes.push({
          ...orig,
          id: newId,
          data: { ...orig.data, _count_index: i, _count_total: count },
          position: { x: (orig.position?.x || 0) + 80, y: (orig.position?.y || 0) + i * 220 },
        });
      }

      // Clone edges entre downstream nodes
      for (const e of workGraph.edges) {
        if (downstreamIds.has(e.source) && downstreamIds.has(e.target)) {
          newEdges.push({
            id: `${e.id}_n${i}`,
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          });
        }
      }

      // Edges saindo do image-gen original → clone do direct downstream
      for (const dde of directDownstreamEdges) {
        const cloneTarget = idMap.get(dde.target);
        if (!cloneTarget) continue;
        newEdges.push({
          id: `${dde.id}_n${i}`,
          source: newImageGenId,
          sourceHandle: dde.sourceHandle,
          target: cloneTarget,
          targetHandle: dde.targetHandle,
        });
      }

      // Reconecta upstream do image-gen → clone do image-gen
      for (const ue of upstreamEdges) {
        newEdges.push({
          id: `${ue.id}_n${i}`,
          source: ue.source,
          sourceHandle: ue.sourceHandle,
          target: newImageGenId,
          targetHandle: ue.targetHandle,
        });
      }
    }

    workGraph = { ...workGraph, nodes: newNodes, edges: newEdges };

    // Hard cap pra evitar combinações que escalam fora de controle
    // (variation × count × ...). Aborta a expansão se o grafo passar do limite.
    if (workGraph.nodes.length > MAX_TOTAL_NODES_AFTER_EXPANSION) {
      throw new Error(`graph_too_large: ${workGraph.nodes.length} nodes exceeds ${MAX_TOTAL_NODES_AFTER_EXPANSION}`);
    }
  }

  return workGraph;
}

/**
 * Topo-sort: retorna níveis de execução (cada nível = nós que podem
 * rodar em paralelo). Detecta ciclo se algum nó ficar sem ser visitado.
 */
function topoSort(graph: Graph): { levels: GraphNode[][]; hasCycle: boolean } {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeById = new Map<string, GraphNode>();

  for (const n of graph.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
    nodeById.set(n.id, n);
  }
  for (const e of graph.edges) {
    if (!adj.has(e.source) || !inDegree.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  const levels: GraphNode[][] = [];
  let frontier = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const visited = new Set<string>();

  while (frontier.length) {
    const level = frontier.map(id => nodeById.get(id)!).filter(Boolean);
    levels.push(level);
    const next: string[] = [];
    for (const id of frontier) {
      visited.add(id);
      for (const target of adj.get(id) || []) {
        const d = (inDegree.get(target) || 1) - 1;
        inDegree.set(target, d);
        if (d === 0) next.push(target);
      }
    }
    frontier = next;
  }

  const hasCycle = visited.size !== graph.nodes.length;
  return { levels, hasCycle };
}

/**
 * Coleta inputs de um nó: olha as edges que terminam nele, busca o
 * output do source no outputs map, e agrupa por targetHandle.
 *
 * Retorno é { handleName: value }. Se um handle tem múltiplas edges
 * apontando, vira array. Caso contrário, valor único.
 */
function collectNodeInputs(node: GraphNode, graph: Graph, outputs: OutputsMap): Record<string, unknown> {
  const result: Record<string, unknown[]> = {};
  for (const e of graph.edges) {
    if (e.target !== node.id) continue;
    const sourceOutput = outputs[e.source];
    if (sourceOutput === undefined) continue;
    const handle = e.targetHandle || "default";
    if (!result[handle]) result[handle] = [];
    result[handle].push(sourceOutput);
  }
  // Reduz arrays de 1 elemento pra valor único (UX dos nós fica mais natural)
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result)) {
    flat[k] = v.length === 1 ? v[0] : v;
  }
  return flat;
}

// ── Node executors ──────────────────────────────────────────────────
// Cada executor recebe { node, inputs, ctx } e retorna o output.
// Throw em caso de erro fatal — o caller marca o nó como failed.

interface ExecCtx {
  supabaseUrl: string;
  serviceRoleKey: string;
  authToken: string;          // token do user (pra chamar outras edge functions com auth)
  userId: string;
  runId: string;
}

async function execBrand(node: GraphNode): Promise<Record<string, unknown>> {
  // Brand é passthrough — o frontend já resolveu brand_id+market →
  // brand_hint+license_text e sobrescreveu via inputs override.
  // Aqui só repassa os campos relevantes.
  return {
    brand_id: node.data.brand_id || null,
    market: node.data.market || null,
    brand_hint: (node.data.brand_hint as string) || "",
    license_text: (node.data.license_text as string) || "",
    include_disclaimer: !!node.data.include_disclaimer,
  };
}

async function execPrompt(node: GraphNode): Promise<{ text: string }> {
  const text = String(node.data.text || "").trim();
  if (text.length < 5) throw new Error("prompt_too_short");
  return { text };
}

async function execImageGen(
  node: GraphNode,
  inputs: Record<string, unknown>,
  ctx: ExecCtx,
): Promise<{ asset_id: string | null; image_url: string; prompt_used: string }> {
  // Pega prompt do input (esperado: { text } do nó prompt)
  const promptInput = inputs.prompt as { text?: string } | string | undefined;
  const promptText = typeof promptInput === "string"
    ? promptInput
    : (promptInput?.text || "");
  if (!promptText || promptText.length < 5) throw new Error("missing_prompt");

  // Pega brand context (opcional)
  const brandInput = inputs.brand as Record<string, unknown> | undefined;
  const brand_id = (brandInput?.brand_id as string) || null;
  const market = (brandInput?.market as string) || null;
  const brand_hint = (brandInput?.brand_hint as string) || "";
  const license_text = (brandInput?.license_text as string) || "";
  const include_license = !!brandInput?.include_disclaimer && !!license_text;

  // Pega elementos (opcional, array de URLs)
  let elements: string[] = [];
  if (inputs.elements) {
    const arr = Array.isArray(inputs.elements) ? inputs.elements : [inputs.elements];
    elements = arr.flat().filter((x): x is string => typeof x === "string");
  }

  const aspect_ratio = (node.data.aspect_ratio as string) || "1:1";
  const quality = (node.data.quality as string) || "medium";

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/generate-image-hub`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: promptText,
      aspect_ratio,
      quality,
      brand_id,
      brand_hint,
      market,
      include_license,
      license_text,
      ...(elements.length > 0 ? { input_images_base64: elements } : {}),
    }),
  });
  const text = await r.text();
  let payload: { ok?: boolean; image_url?: string; memory_id?: string; message?: string; error?: string };
  try { payload = JSON.parse(text); } catch { throw new Error(`image-gen non-json response: ${text.slice(0, 200)}`); }
  if (!payload.ok || !payload.image_url) {
    throw new Error(payload.message || payload.error || "image-gen failed");
  }
  return {
    asset_id: payload.memory_id || null,
    image_url: payload.image_url,
    prompt_used: promptText,
  };
}

interface OutputResult {
  asset_id: string | null;
  image_url: string;
  name: string;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
}

function formatDate(d = new Date()): { date: string; time: string } {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return { date: `${yyyy}${mm}${dd}`, time: `${hh}${min}` };
}

async function execBgRemove(
  _node: GraphNode,
  inputs: Record<string, unknown>,
  ctx: ExecCtx,
): Promise<{ asset_id: string | null; image_url: string }> {
  // Recebe { image_url } do nó upstream (image-gen ou direto URL)
  const imgInput = inputs.image as { image_url?: string } | string | undefined;
  const image_url = typeof imgInput === "string" ? imgInput : imgInput?.image_url;
  if (!image_url) throw new Error("missing_image_input");

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/hub-bria-bg-remove`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url }),
  });
  const text = await r.text();
  let payload: { ok?: boolean; image_url?: string; memory_id?: string; message?: string; error?: string };
  try { payload = JSON.parse(text); } catch { throw new Error(`bg-remove non-json: ${text.slice(0, 200)}`); }
  if (!payload.ok || !payload.image_url) {
    throw new Error(payload.message || payload.error || "bg-remove failed");
  }
  return { asset_id: payload.memory_id || null, image_url: payload.image_url };
}

async function execStoryboard(
  node: GraphNode,
  inputs: Record<string, unknown>,
  ctx: ExecCtx,
): Promise<{ storyboard_id: string; scenes: Array<{ n: number; image_url: string | null; asset_id: string | null }> }> {
  // Recebe { text } do prompt + { brand } opcional
  const promptInput = inputs.prompt as { text?: string } | string | undefined;
  const script = typeof promptInput === "string" ? promptInput : (promptInput?.text || "");
  if (!script || script.length < 10) throw new Error("missing_script");

  const brandInput = inputs.brand as Record<string, unknown> | undefined;
  const scene_count = Math.max(2, Math.min(8, Number(node.data.scene_count) || 4));
  const aspect_ratio = (node.data.aspect_ratio as string) || "9:16";
  const quality = (node.data.quality as string) || "medium";

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/generate-storyboard-hub`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      script,
      scene_count,
      aspect_ratio,
      quality,
      brand_id: brandInput?.brand_id || null,
      brand_hint: brandInput?.brand_hint || "",
      market: brandInput?.market || null,
      market_context: "",
    }),
  });
  const text = await r.text();
  let payload: { ok?: boolean; storyboard_id?: string; scenes?: Array<{ n: number; image_url: string | null }>; message?: string; error?: string };
  try { payload = JSON.parse(text); } catch { throw new Error(`storyboard non-json: ${text.slice(0, 200)}`); }
  if (!payload.ok) throw new Error(payload.message || payload.error || "storyboard failed");
  const scenes = (payload.scenes || []).map(s => ({
    n: s.n,
    image_url: s.image_url,
    asset_id: null,
  }));
  return { storyboard_id: payload.storyboard_id || `sb-${Date.now()}`, scenes };
}

async function execVideo(
  node: GraphNode,
  inputs: Record<string, unknown>,
  ctx: ExecCtx,
): Promise<{ asset_id: string | null; video_url: string; duration_s: number }> {
  // Inputs:
  //   prompt (string) — required, do nó prompt upstream
  //   brand (object)  — optional
  //   image (object)  — optional, output do image-gen → vira image-to-video
  const promptInput = inputs.prompt as { text?: string } | string | undefined;
  const promptText = typeof promptInput === "string" ? promptInput : (promptInput?.text || "");
  if (!promptText || promptText.length < 5) throw new Error("missing_prompt");

  const brandInput = inputs.brand as Record<string, unknown> | undefined;
  const imageInput = inputs.image as { image_url?: string } | string | undefined;
  const image_url = typeof imageInput === "string" ? imageInput : imageInput?.image_url;

  const duration = Math.max(3, Math.min(15, Number(node.data.duration) || 5));
  const aspect_ratio = (node.data.aspect_ratio as string) || "16:9";
  const enable_audio = !!node.data.enable_audio;
  const mode = ((node.data.mode as string) === "pro") ? "pro" : "std";
  const resolution = ((node.data.resolution as string) === "1080p") ? "1080p" : "720p";
  const provider = (node.data.provider as string) || "piapi";

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/hub-video-gen`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: promptText,
      image_url: image_url || null,
      duration,
      aspect_ratio,
      enable_audio,
      mode,
      resolution,
      provider,
      brand_id: brandInput?.brand_id || null,
      market: brandInput?.market || null,
      brand_hint: brandInput?.brand_hint || "",
    }),
  });
  const text = await r.text();
  let payload: { ok?: boolean; video_url?: string; memory_id?: string; duration_s?: number; message?: string; error?: string };
  try { payload = JSON.parse(text); } catch { throw new Error(`video non-json: ${text.slice(0, 200)}`); }
  if (!payload.ok || !payload.video_url) {
    throw new Error(payload.message || payload.error || "video failed");
  }
  return {
    asset_id: payload.memory_id || null,
    video_url: payload.video_url,
    duration_s: payload.duration_s || duration,
  };
}

async function execVoice(
  node: GraphNode,
  inputs: Record<string, unknown>,
  ctx: ExecCtx,
): Promise<{ asset_id: string | null; audio_url: string; characters: number }> {
  const textInput = inputs.text as { text?: string } | string | undefined;
  const text = typeof textInput === "string" ? textInput : (textInput?.text || "");
  if (!text || text.length < 3) throw new Error("missing_text");

  const voice_id = (node.data.voice_id as string) || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
  const model_id = (node.data.model_id as string) || "eleven_multilingual_v2";
  const stability = Number(node.data.stability) || 0.5;
  const similarity_boost = Number(node.data.similarity_boost) || 0.75;

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/hub-voice-gen`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice_id, model_id, stability, similarity_boost }),
  });
  const respText = await r.text();
  let payload: { ok?: boolean; audio_url?: string; memory_id?: string; characters?: number; error?: string; message?: string };
  try { payload = JSON.parse(respText); } catch { throw new Error(`voice non-json: ${respText.slice(0, 200)}`); }
  if (!payload.ok || !payload.audio_url) {
    throw new Error(payload.message || payload.error || "voice failed");
  }
  return {
    asset_id: payload.memory_id || null,
    audio_url: payload.audio_url,
    characters: payload.characters || 0,
  };
}

async function execVariation(
  _node: GraphNode,
  inputs: Record<string, unknown>,
): Promise<{ value: string; passthrough: unknown }> {
  // Variation é EXPANDIDO antes da execução (graph rewrite). No runtime
  // o nó já não existe — esse handler só roda se alguém deixar variation
  // sem expansão. Retorna passthrough do default input.
  const passthrough = inputs.in || inputs.default || null;
  return { value: "", passthrough };
}

interface FullOutputResult {
  asset_id: string | null;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  name: string;
}

async function execOutput(
  node: GraphNode,
  inputs: Record<string, unknown>,
  _ctx: ExecCtx,
): Promise<FullOutputResult> {
  // asset upstream pode ser:
  //   image-gen / bg-remove → { image_url }
  //   voice → { audio_url }
  //   video → { video_url }
  const asset = inputs.asset as { asset_id?: string; image_url?: string; audio_url?: string; video_url?: string; prompt_used?: string } | undefined;
  if (!asset?.image_url && !asset?.audio_url && !asset?.video_url) throw new Error("missing_asset_input");

  const tpl = (node.data.name_template as string) || "{date}_{slug}";
  const { date, time } = formatDate();
  const slug = slugify(asset.prompt_used || "ad");
  const name = tpl
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{slug\}/g, slug)
    .replace(/\{brand\}/g, "")
    .replace(/\{market\}/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return {
    asset_id: asset.asset_id || null,
    image_url: asset.image_url,
    audio_url: asset.audio_url,
    video_url: asset.video_url,
    name: name || "asset",
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────
async function executeNode(
  node: GraphNode,
  graph: Graph,
  outputs: OutputsMap,
  ctx: ExecCtx,
): Promise<unknown> {
  const inputs = collectNodeInputs(node, graph, outputs);
  switch (node.type) {
    case "brand":      return await execBrand(node);
    case "prompt":     return await execPrompt(node);
    case "image-gen":  return await execImageGen(node, inputs, ctx);
    case "bg-remove":  return await execBgRemove(node, inputs, ctx);
    case "storyboard": return await execStoryboard(node, inputs, ctx);
    case "video":      return await execVideo(node, inputs, ctx);
    case "voice":      return await execVoice(node, inputs, ctx);
    case "variation":  return await execVariation(node, inputs);
    case "output":     return await execOutput(node, inputs, ctx);
    default: throw new Error(`unknown_node_type:${node.type}`);
  }
}

// ── Background processor ────────────────────────────────────────────
// Executa o workflow nível-a-nível, atualizando hub_workflow_runs.outputs
// após cada nível pra UI poder polar progresso. Roda em background via
// EdgeRuntime.waitUntil — caller já recebeu run_id e voltou pro client.
//
// Limite de wall-clock do Supabase Edge Function: 150s default. Pra
// 50 image-gens em paralelo (~30-60s OpenAI side + rate limits), entra
// no budget. Workflows mais longos vão estourar — caller recebe status
// 'failed' com 'wall_clock_timeout' no error.
async function processWorkflow(
  runId: string,
  graph: Graph,
  ctx: ExecCtx,
  levels: GraphNode[][],
  sb: ReturnType<typeof createClient>,
): Promise<void> {
  const outputs: OutputsMap = {};
  const errors: Record<string, string> = {};

  // Marca como running (caso ainda não tenha sido)
  await sb.from("hub_workflow_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  try {
    for (const level of levels) {
      const results = await Promise.allSettled(
        level.map(node => executeNode(node, graph, outputs, ctx))
      );
      for (let i = 0; i < level.length; i++) {
        const node = level[i];
        const r = results[i];
        if (r.status === "fulfilled") {
          outputs[node.id] = r.value;
        } else {
          const msg = (r.reason as Error)?.message || String(r.reason);
          errors[node.id] = msg.slice(0, 300);
          console.error(`[execute-workflow] node ${node.id} (${node.type}) failed:`, msg);
        }
      }
      // Persiste outputs após cada nível pra polling refletir progresso
      await sb.from("hub_workflow_runs")
        .update({ outputs, error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : null })
        .eq("id", runId);
    }

    // Status final
    const totalNodes = graph.nodes.length;
    const successCount = Object.keys(outputs).length;
    const errorCount = Object.keys(errors).length;
    let status: "succeeded" | "partial" | "failed";
    if (errorCount === 0) status = "succeeded";
    else if (successCount > errorCount) status = "partial";
    else status = "failed";

    await sb.from("hub_workflow_runs")
      .update({
        status,
        outputs,
        error: errorCount > 0 ? JSON.stringify(errors) : null,
        ended_at: new Date().toISOString(),
      })
      .eq("id", runId);

    console.log(`[execute-workflow] run ${runId} ${status} — ${successCount}/${totalNodes} nodes ok`);
  } catch (e) {
    console.error(`[execute-workflow] run ${runId} fatal:`, e);
    await sb.from("hub_workflow_runs")
      .update({
        status: "failed",
        outputs,
        error: `processWorkflow exception: ${String(e).slice(0, 200)}`,
        ended_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}

// ── Main handler ────────────────────────────────────────────────────
console.log(`[execute-workflow] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const authToken = authHeader.slice(7);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authToken);
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { workflow_id, inputs } = body as { workflow_id?: string; inputs?: Record<string, Record<string, unknown>> };
    if (!workflow_id) return jsonResponse({ _v: FN_VERSION, ok: false, error: "missing_workflow_id" }, 400);

    // Carrega workflow (RLS garante: user só vê próprios + templates)
    const { data: wfData, error: wfErr } = await sb
      .from("hub_workflows")
      .select("id, name, graph, user_id, is_template")
      .eq("id", workflow_id)
      .single();
    if (wfErr || !wfData) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "workflow_not_found", detail: wfErr?.message }, 404);
    }
    // Permissão: ou é o dono ou é template público
    if (wfData.user_id && wfData.user_id !== authUser.id && !wfData.is_template) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "forbidden" }, 403);
    }

    const rawGraph = wfData.graph as Graph;
    if (!rawGraph?.nodes?.length) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "empty_graph" }, 400);
    }
    const overridden = applyInputOverrides(rawGraph, inputs);
    // Pipeline de expansão: variation primeiro (cria branches por axis),
    // depois count (multiplica image-gens por count=N). Ordem importa pra
    // que count expanda DENTRO de cada branch da variation.
    let graph: Graph;
    try {
      const afterVariation = expandVariations(overridden);
      graph = expandImageGenCount(afterVariation);
    } catch (expansionErr) {
      // graph_too_large ou outro erro de expansão
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: "graph_expansion_failed",
        message: String(expansionErr).slice(0, 300),
      }, 400);
    }

    // Validação: topo-sort (detecta ciclo)
    const { levels, hasCycle } = topoSort(graph);
    if (hasCycle) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "graph_has_cycle" }, 400);
    }

    // Cria run row já em status=pending. processWorkflow vai marcar como
    // running quando começar, e finalizar com succeeded/partial/failed.
    const { data: runData, error: runErr } = await sb
      .from("hub_workflow_runs")
      .insert({
        user_id: authUser.id,
        workflow_id,
        status: "pending",
        inputs: inputs || {},
        outputs: {},
      })
      .select("id")
      .single();
    if (runErr || !runData) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "run_create_failed", detail: runErr?.message }, 500);
    }
    const runId = runData.id as string;
    const ctx: ExecCtx = {
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
      authToken,
      userId: authUser.id,
      runId,
    };

    const totalNodes = graph.nodes.length;

    // Async via EdgeRuntime.waitUntil — caller recebe run_id imediatamente,
    // processamento continua em background até completar ou estourar
    // wall-clock (~150s).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ER = (globalThis as any).EdgeRuntime;
    if (ER && typeof ER.waitUntil === "function") {
      ER.waitUntil(processWorkflow(runId, graph, ctx, levels, sb));
    } else {
      // Fallback: roda sync se EdgeRuntime não tá disponível (dev local).
      // Não faz await pra retornar rápido; o Deno worker pode matar a Promise
      // mas é um fallback aceitável.
      processWorkflow(runId, graph, ctx, levels, sb).catch(e =>
        console.error("[execute-workflow] background fallback failed:", e)
      );
    }

    console.log(`[execute-workflow] run ${runId} kicked off — ${totalNodes} nodes after expansion`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      run_id: runId,
      status: "pending",
      total: totalNodes,
    }, 200);

  } catch (e) {
    console.error("[execute-workflow] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
