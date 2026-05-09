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

const FN_VERSION = "v14-angle-distribution-2026-05-08";

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
 * Eixos suportados: aspect_ratio, prompt, angle.
 *
 * Resultado: grafo livre de variation nodes, com N branches paralelos.
 */

// Mirror server-side de src/data/angleLibrary.ts — 16 angles iGaming-ready.
// Mantido em sync manualmente. Quando adicionar/remover angle no client,
// atualize este mapa também (os labels/intent não importam server-side,
// só o prompt_prefix que vai pra OpenAI).
const SERVER_ANGLE_LIBRARY: Record<string, { label: string; prompt_prefix: string }> = {
  // SAFE
  direct_offer: {
    label: "Oferta Direta",
    prompt_prefix: "CREATIVE ANGLE: Direct response. Center the offer + CTA as the dominant visual element. Clear hierarchy: hook on top, offer in the middle (largest typography), CTA at the bottom. Minimal distractions. High contrast. Safe scalable layout.",
  },
  before_after: {
    label: "Antes/Depois",
    prompt_prefix: "CREATIVE ANGLE: Before/After split. Vertical or horizontal split frame. Left/top = problem state (muted, gray, low-energy). Right/bottom = solution state (vibrant, confident, energized). Same subject in both halves when applicable. Minimal text overlay.",
  },
  social_proof: {
    label: "Social Proof",
    prompt_prefix: "CREATIVE ANGLE: Social proof first. Foreground = stars rating + customer count badge + quote-style testimonial. Visual must feel like screenshots of real reviews. Avoid stock-photo aesthetic.",
  },
  authority_premium: {
    label: "Autoridade Premium",
    prompt_prefix: "CREATIVE ANGLE: Premium authority. Dark background. Gold or platinum accents. Centered hierarchy. Generous whitespace. Serif or geometric sans typography. Cinematic lighting on subject. Conveys exclusivity without saying 'exclusive'.",
  },
  comparison_us_vs: {
    label: "Comparação",
    prompt_prefix: "CREATIVE ANGLE: Direct comparison layout. Two-column visual: left = competitor (muted, X marks), right = brand (highlighted, check marks). Honest framing — only compare on dimensions where the brand actually wins.",
  },
  feature_zoom: {
    label: "Feature Zoom",
    prompt_prefix: "CREATIVE ANGLE: Feature highlight. Extreme close-up or macro shot of the product/UI. Annotation labels with thin lines pointing to key elements. iPhone screenshot aesthetic when applicable. Crisp, technical, confident.",
  },
  // MODERATE
  emotional_reaction: {
    label: "Reação Emocional",
    prompt_prefix: "CREATIVE ANGLE: Emotional reaction. Close-up of a person's face showing genuine surprise, joy, or relief. Slight imperfect framing (smartphone camera feel). Natural skin tones. Eyes engage the viewer. Minimal copy — let the face do the talking.",
  },
  curiosity_gap: {
    label: "Curiosity Gap",
    prompt_prefix: "CREATIVE ANGLE: Curiosity gap. Provocative question or incomplete statement as the hook. Visual partially obscured (cropped, blurred edges, thumbnail-style mystery). Forces the viewer to click to resolve the gap. No spoilers.",
  },
  urgency_scarcity: {
    label: "Urgência/Escassez",
    prompt_prefix: "CREATIVE ANGLE: Urgency/scarcity. Visible time pressure element (countdown, calendar, expiring badge). Aggressive typography for time markers. Red/orange accents for urgency. Subject framed as taking action NOW.",
  },
  beginner_friendly: {
    label: "Beginner-Friendly",
    prompt_prefix: "CREATIVE ANGLE: Beginner-friendly. Reassuring tone. Simple shapes, friendly colors. Subject = approachable, smiling, ordinary. Hook addresses the beginner directly: 'Pra quem nunca...', 'Sem experiência'.",
  },
  fomo_aspirational: {
    label: "FOMO Aspiracional",
    prompt_prefix: "CREATIVE ANGLE: Aspirational FOMO. Lifestyle shot of someone living the upgraded outcome. Slight envy-inducing framing. Hook implies viewer is missing out without saying it directly.",
  },
  // EXPERIMENTAL
  meme_native: {
    label: "Meme Native",
    prompt_prefix: "CREATIVE ANGLE: Meme-native. Low-polish aesthetic. Impact font with white-and-black outline OR subtitled meme template. Slightly oversaturated. Visual hierarchy ignores rules — caption and visual fight for attention. Short shelf life.",
  },
  fake_screenshot: {
    label: "Fake Screenshot",
    prompt_prefix: "CREATIVE ANGLE: Native UI mock. Looks like an iOS/Android push notification, DM thread, or in-app screen capture. Authentic platform fonts. Slight overlay shadows. Avoid making it look like an ad — make it look like a screenshot somebody shared.",
  },
  chaotic_typography: {
    label: "Tipografia Caótica",
    prompt_prefix: "CREATIVE ANGLE: Typography chaos. Numbers/keywords sized enormously (50%+ of frame). Asymmetric placement. Mixed weights. Negative space used intentionally. Visual energy must interrupt feed scroll. Not 'pretty' — disruptive.",
  },
  creator_pov: {
    label: "Creator POV",
    prompt_prefix: "CREATIVE ANGLE: Creator POV. First-person selfie or talking-head shot. Vertical 9:16 framing. Natural ring-light or window light. Subject talks directly to camera. Caption overlay = subtitle style. Imperfect. Authentic.",
  },
  split_chaos: {
    label: "Split Chaos",
    prompt_prefix: "CREATIVE ANGLE: Multi-panel chaos. 3-6 visual elements overlapping or in irregular grid. Each panel = different angle of the offer. Eye must work to find the focal point. Color-coded panels for hierarchy.",
  },
};

function expandVariations(graph: Graph): Graph {
  const variationNodes = graph.nodes.filter(n => n.type === "variation");
  if (variationNodes.length === 0) return graph;

  let workGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };

  for (const vNode of variationNodes) {
    const axis = String(vNode.data.axis || "aspect_ratio");
    const values = Array.isArray(vNode.data.values) ? (vNode.data.values as string[]) : [];
    console.log(`[expandVariations] processing vNode=${vNode.id} axis=${axis} values=${JSON.stringify(values)}`);

    if (values.length === 0) {
      console.warn(`[expandVariations] vNode=${vNode.id} has empty values — bypassing`);
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

    if (downstreamIds.size === 0) {
      // Variation sem nada downstream → não tem o que clonar.
      // CAUSA COMUM do "duplicado": user pôs variation desconectada do
      // image-gen, ou pôs variation DEPOIS do image-gen (prompt →
      // image-gen → variation → output). Posição correta: prompt →
      // variation → image-gen → output.
      console.warn(`[expandVariations] vNode=${vNode.id} has NO downstream — variation will have NO effect. Provavelmente o user conectou na ordem errada (variation depois do image-gen).`);
      workGraph = bypassNode(workGraph, vNode.id);
      continue;
    }
    console.log(`[expandVariations] vNode=${vNode.id} downstream count=${downstreamIds.size} ids=${[...downstreamIds].join(",")}`);

    const directDownstreamEdges = workGraph.edges.filter(e => e.source === vNode.id);
    const upstreamEdges = workGraph.edges.filter(e => e.target === vNode.id);

    // BUG FIX: edges que vinham de FORA do subgraph variation (ex:
    // brand → image-gen, prompt → image-gen quando variation está ao
    // lado e não na linha do prompt) eram REMOVIDAS sem reconectar.
    // Resultado: clones do image-gen ficavam SEM brand context, image
    // gerada fora do estilo da marca.
    // Solução: pra cada edge externa que apontava pra um node downstream,
    // criar uma cópia apontando pra cada clone.
    const externalEdgesToDownstream = workGraph.edges.filter(e =>
      // Edge não vem de dentro do subgraph (source não é variation nem downstream)
      e.source !== vNode.id && !downstreamIds.has(e.source) &&
      // Edge aponta pra dentro do subgraph (target é downstream do variation)
      downstreamIds.has(e.target)
    );

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
        const newData: Record<string, unknown> = { ...orig.data };
        // Aplica override do axis. Suportados:
        //   - aspect_ratio → muda formato (1:1, 9:16, 16:9)
        //   - prompt → muda copy. Setamos _prompt_override que image-gen
        //     prioriza sobre o input.prompt. Cobre cenário "variar copy"
        //     (ganhe 100/50/20 rodadas etc)
        //   - angle → injeta direção criativa (composição, hierarquia,
        //     emoção). Não substitui o prompt — ANEXA como prefix. Cada
        //     val é um angle_id, resolvido server-side via SERVER_ANGLE_LIBRARY.
        if (axis === "aspect_ratio") {
          newData.aspect_ratio = val;
          console.log(`[expandVariations] clone ${newId} (type=${orig.type}) aspect_ratio override: ${orig.data.aspect_ratio || "(none)"} → ${val}`);
        } else if (axis === "prompt") {
          newData._prompt_override = val;
          console.log(`[expandVariations] clone ${newId} (type=${orig.type}) prompt override: "${val.slice(0, 60)}…"`);
        } else if (axis === "angle") {
          // val pode ser um angle_id ("emotional_reaction") ou já vir como
          // o prompt_prefix completo (back-compat). Resolve via lookup.
          const angle = SERVER_ANGLE_LIBRARY[val];
          newData._angle_id = angle ? val : null;
          newData._angle_label = angle?.label || val;
          newData._angle_prefix = angle ? angle.prompt_prefix : val;
          console.log(`[expandVariations] clone ${newId} angle override: ${val} (label=${angle?.label || "raw"})`);
        }
        // Tag de rastreio — útil pra debug e pra UI mostrar "qual variação"
        newData._variation_axis = axis;
        newData._variation_value = val;
        newData._variation_index = i;
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

      // Edges EXTERNAS que apontavam pra downstream (ex: brand → image-gen)
      // — reconecta cada uma pra o clone correspondente.
      for (const e of externalEdgesToDownstream) {
        const cloneTarget = idMap.get(e.target);
        if (!cloneTarget) continue;
        newEdges.push({
          id: `${e.id}_v${i}`,
          source: e.source,           // mantém origem externa (brand, prompt etc)
          sourceHandle: e.sourceHandle,
          target: cloneTarget,        // aponta pro clone (n3_v0, n3_v1...)
          targetHandle: e.targetHandle,
        });
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
        // UUID pra evitar colisão quando há múltiplos bypass na sequência
        // (ex: 2 variation nodes vazias no mesmo path gerando edges com
        // sufixo _bypass que repetiam IDs)
        id: `bypass_${crypto.randomUUID()}`,
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

// Retorna true se ALGUM ancestral direto/indireto de `node` falhou (está em
// errors). Usado pra evitar cascata: se imagem upstream falhou, o save
// downstream não tenta rodar com input undefined — vira blocked com
// mensagem clara em vez de gerar erro genérico tipo missing_asset.
function hasFailedAncestor(
  nodeId: string,
  graph: Graph,
  errors: Record<string, string>,
): string | null {
  const visited = new Set<string>();
  const stack: string[] = [];
  // Coleta ancestrais imediatos
  for (const e of graph.edges) {
    if (e.target === nodeId) stack.push(e.source);
  }
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (errors[id]) return id; // achou ancestral falho
    for (const e of graph.edges) {
      if (e.target === id) stack.push(e.source);
    }
  }
  return null;
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

// Persiste asset gerado em hub_assets pra Library mostrar.
// generate-image-hub e generate-storyboard-hub escrevem em creative_memory
// (legacy, lá só é lido por features de analytics — Library não vê).
// Chamadas standalone do Hub salvam em hub_assets via saveHubAsset no
// frontend; workflows precisam fazer o equivalente aqui no servidor.
//
// Falha silenciosamente — não derruba o workflow se o save falhar.
async function saveWorkflowAssetToLibrary(
  ctx: ExecCtx,
  kind: "hub_image" | "hub_png" | "hub_storyboard" | "hub_carousel",
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    const sb = createClient(ctx.supabaseUrl, ctx.serviceRoleKey);
    const { data, error } = await sb.from("hub_assets").insert({
      user_id: ctx.userId,
      kind,
      content,
      created_at: new Date().toISOString(),
    }).select("id").single();
    if (error) {
      console.warn(`[execute-workflow] hub_assets save failed (${kind}):`, error.message);
      return null;
    }
    return (data as { id?: string })?.id || null;
  } catch (e) {
    console.warn(`[execute-workflow] hub_assets save exception (${kind}):`, e);
    return null;
  }
}

// ── Brand + Market context (mirror de src/data/hubBrands.ts) ──────
// Server-side replica do registro de marcas/mercados pra que workflows
// resolvam contexto sem depender de override do frontend. Templates
// oficiais só guardam brand_id + market — aqui resolvemos brand_hint
// completo + license_text + market context (incluindo lang da copy).
//
// IMPORTANTE: manter sincronizado com src/data/hubBrands.ts. Se uma
// marca for adicionada/editada, atualizar AMBOS lugares.
const SERVER_HUB_MARKETS: Record<string, { promptContext: string }> = {
  BR: {
    promptContext: "Target market: Brazil. If people appear, they should reflect the diverse Brazilian population (mix of skin tones — afro-Brazilian, multiracial, white, indigenous heritage — authentic and modern, not stereotyped). Any on-image text in Brazilian Portuguese. By default avoid national flags, carnival imagery, tropical/jungle clichés, and nationalistic symbols UNLESS the user prompt explicitly requests them — the user's instruction always overrides this default. Otherwise keep the creative modern and brand-driven.",
  },
  MX: {
    promptContext: "Target market: Mexico. If people appear, they should reflect the Mexican population (mestizo, indigenous and afro-mestizo features, varied skin tones — authentic, modern). Any on-image text in Mexican Spanish. By default avoid flags, mariachi, sombreros, lucha libre, and other national/cultural clichés UNLESS the user prompt explicitly requests them — the user's instruction always overrides this default. Otherwise keep it modern and brand-driven.",
  },
  CO: {
    promptContext: "Target market: Colombia. If people appear, they should reflect the Colombian population (mestizo, afro-Colombian, varied features — authentic, modern). Any on-image text in Colombian Spanish. By default avoid flags, national symbols, and cultural clichés UNLESS the user prompt explicitly requests them. Otherwise keep it modern and brand-driven.",
  },
  PE: {
    promptContext: "Target market: Peru. If people appear, they should reflect the Peruvian population (predominantly mestizo, Andean indigenous features common — authentic, not exotic or touristy). Any on-image text in Peruvian Spanish. By default avoid flags, Andean costumes, llamas, Machu Picchu, and cultural clichés UNLESS the user prompt explicitly requests them. Otherwise keep it modern and brand-driven.",
  },
  US: {
    promptContext: "Target market: United States. If people appear, they should reflect the diverse US population (varied ethnicities, ages — natural and authentic representation). Any on-image text in American English. By default avoid flags, eagles, and heavy-handed patriotic imagery UNLESS the user prompt explicitly requests them. Otherwise keep it modern and brand-driven.",
  },
  IN: {
    promptContext: "Target market: India. If people appear, they should reflect the Indian population (South Asian features, varied skin tones from light to dark, modern attire — not always traditional). Any on-image text MUST be in HINGLISH (Hindi mixed with English written in Latin/Roman script — NEVER Devanagari). Examples: 'Aaj hi khelo aur jeeto big!', 'Apna luck try karo', 'Bonus milega 100% guaranteed'. By default avoid flags, saris, turbans, Taj Mahal, Bollywood dance, mandalas, henna, and cultural clichés UNLESS the user prompt explicitly requests them. Otherwise keep it modern and brand-driven.",
  },
};

const SERVER_HUB_BRANDS: Record<string, { promptHint: string; license?: Record<string, string> }> = {
  betbus: {
    promptHint: "BETBUS branding context: online casino & sports betting brand. Visual style: bold red and gold accents, high-energy gaming atmosphere, modern premium look with selective use of neon and gold sparkles when appropriate.",
    license: {
      MX: "Betbus es un sitio web de entretenimiento online autorizado mediante oficio numero DGJS/0175/2023 de la Dirección de Juegos y Sorteos de los Estados Unidos Mexicanos y operado por Energy C2, S.A.P.I. de C.V., autorizado por The Fabulous Vegas Games S.A. de C.V., empresa registrada en México con autorización para operar en línea por la Secretaría de Gobernación – Dirección General de Juegos y Sorteos de los Estados Unidos Mexicanos No. DGJS/DGAAD/DCRCA/SSCCARb/2852/2015. Los Juegos Con Apuesta Estan Prohibidos Para Menores De Edad. 18+ Aplican T&C, Permiso: P-08/2015-Ter.",
    },
  },
  eluck: {
    promptHint: "ELUCK branding context: online casino brand operating across multiple markets. Visual style: vibrant green and gold accents, modern energetic aesthetic, premium gaming atmosphere with celebratory mood.",
  },
  come: {
    promptHint: "COME.COM branding context: online casino & gaming brand. Visual style: warm saffron and red accents, modern tech-forward look, premium feel with high contrast. Energetic but clean — not over-decorated.",
  },
  funilive: {
    promptHint: "FUNILIVE branding context: Live casino & betting brand with international presence. Visual style: modern vibrant aesthetic with purple and magenta tones, live entertainment vibe, dynamic and youthful.",
  },
};

function resolveBrandContext(brandId: string | null, market: string | null, includeLicense: boolean): {
  brand_hint: string;
  license_text: string;
  has_license: boolean;
} {
  const parts: string[] = [];
  const brand = brandId ? SERVER_HUB_BRANDS[brandId] : null;
  const mkt = market ? SERVER_HUB_MARKETS[market] : null;
  if (brand?.promptHint) parts.push(brand.promptHint);
  if (mkt?.promptContext) parts.push(mkt.promptContext);
  const brand_hint = parts.join("\n\n");
  const license_text = includeLicense && brand?.license && market ? (brand.license[market] || "") : "";
  return { brand_hint, license_text, has_license: !!license_text };
}

async function execBrand(node: GraphNode): Promise<Record<string, unknown>> {
  // Resolve brand_id + market → brand_hint completo + license_text.
  // Antes só passthrough: templates com `{ brand_id: "betbus", market: "MX",
  // include_disclaimer: true }` rodavam SEM brand context, SEM market
  // context (lang da copy errada — saía PT-BR pra mercado MX), SEM
  // disclaimer regulatório. Agora resolvemos do registro embedded.
  const brand_id = (node.data.brand_id as string) || null;
  const market = (node.data.market as string) || null;
  const include_disclaimer = !!node.data.include_disclaimer;

  // Se o frontend já mandou brand_hint/license_text resolvidos via override
  // (caso futuro de UI de edit), respeita. Senão, resolve do registro.
  const explicitHint = (node.data.brand_hint as string)?.trim();
  const explicitLicense = (node.data.license_text as string)?.trim();

  const resolved = (!explicitHint || !explicitLicense)
    ? resolveBrandContext(brand_id, market, include_disclaimer)
    : { brand_hint: "", license_text: "", has_license: false };

  const brand_hint = explicitHint || resolved.brand_hint;
  const license_text = explicitLicense || resolved.license_text;

  console.log(`[execBrand] node=${node.id} brand=${brand_id} market=${market} include_disclaimer=${include_disclaimer} brand_hint_len=${brand_hint.length} license_text_len=${license_text.length}`);

  return {
    brand_id,
    market,
    brand_hint,
    license_text,
    include_disclaimer,
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
  // Pega prompt — prioridade:
  //   1. _prompt_override (vem da expansão do variation com axis="prompt")
  //   2. inputs.prompt (vem do nó prompt upstream)
  // Variation com axis="prompt" injeta _prompt_override em cada clone do
  // image-gen pra que cada variant gere uma copy diferente.
  const overridePrompt = (node.data._prompt_override as string | undefined)?.trim();
  const promptInput = inputs.prompt as { text?: string } | string | undefined;
  const inputPromptText = typeof promptInput === "string"
    ? promptInput
    : (promptInput?.text || "");
  const promptText = overridePrompt || inputPromptText;
  if (!promptText || promptText.length < 5) throw new Error("missing_prompt");
  if (overridePrompt) {
    console.log(`[execImageGen] node=${node.id} using prompt OVERRIDE from variation: "${overridePrompt.slice(0, 80)}…"`);
  }

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

  // Pega reference images (opcional). Vem do nó reference-image ligado
  // ao image-gen via handle "reference". Cada reference vira input_image
  // adicional pro gpt-image-2 — modelo usa como guia de estilo/composição
  // (modo "Recriar Anúncio" estilo Higgsfield).
  const referenceImages: string[] = [];
  let referenceDescription = "";
  if (inputs.reference) {
    const arr = Array.isArray(inputs.reference) ? inputs.reference : [inputs.reference];
    for (const item of arr) {
      if (item && typeof item === "object") {
        const ref = item as { image_url?: string; description?: string };
        if (ref.image_url) referenceImages.push(ref.image_url);
        if (ref.description && !referenceDescription) referenceDescription = ref.description;
      }
    }
  }

  // Concatena reference description ao prompt se houver
  const finalPromptText = referenceDescription
    ? `${promptText}\n\nREFERENCE IMAGE STYLE: ${referenceDescription}. Recreate the same visual style, composition and mood as the reference image, but adapted to the brand and prompt above.`
    : promptText;

  // Angle Distribution Engine — quando variation node tem axis="angle",
  // o clone recebe _angle_prefix com a direção criativa. Injeta ANTES do
  // prompt do usuário pra guiar composição/hierarquia/emoção sem
  // sobrescrever a oferta. Resultado: 10 variations = 10 angles diferentes
  // do MESMO produto/oferta, não 10 cópias rebuçadas.
  const anglePrefix = (node.data._angle_prefix as string | undefined)?.trim();
  const angleId = node.data._angle_id as string | undefined;
  const angleLabel = node.data._angle_label as string | undefined;
  const promptWithAngle = anglePrefix
    ? `${anglePrefix}\n\n---\n\nUSER PROMPT (the offer/content):\n${finalPromptText}`
    : finalPromptText;
  if (anglePrefix) {
    console.log(`[execImageGen] node=${node.id} angle injected: ${angleLabel || angleId || "(custom)"}`);
  }

  const aspect_ratio = (node.data.aspect_ratio as string) || "1:1";
  const quality = (node.data.quality as string) || "medium";

  // Combina elements + reference images no input_images_base64 do
  // gpt-image-2. Reference vem com prioridade visual (entra primeiro
  // no array) — modelo dá mais peso pro estilo da reference.
  const allInputImages = [...referenceImages, ...elements];

  const r = await fetch(`${ctx.supabaseUrl}/functions/v1/generate-image-hub`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ctx.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: promptWithAngle,
      aspect_ratio,
      quality,
      brand_id,
      brand_hint,
      market,
      include_license,
      license_text,
      ...(allInputImages.length > 0 ? { input_images_base64: allInputImages } : {}),
    }),
  });
  const text = await r.text();
  let payload: { ok?: boolean; image_url?: string; memory_id?: string; message?: string; error?: string };
  try { payload = JSON.parse(text); } catch { throw new Error(`image-gen non-json response: ${text.slice(0, 200)}`); }
  if (!payload.ok || !payload.image_url) {
    throw new Error(payload.message || payload.error || "image-gen failed");
  }

  // Salva no hub_assets pra aparecer na Library (workflow-only — standalone
  // já salva via frontend saveHubAsset). generate-image-hub escreve só em
  // creative_memory legacy.
  const hubAssetId = await saveWorkflowAssetToLibrary(ctx, "hub_image", {
    prompt: promptText,
    image_url: payload.image_url,
    aspect_ratio,
    quality,
    model: "gpt-image-2",
    brand_id,
    market,
    license_included: include_license,
    license_text: include_license ? license_text : null,
    source: "workflow",
    workflow_run_id: ctx.runId,
    // Rastreio de variation pra debug e UI futura
    variation_axis: node.data._variation_axis as string | undefined,
    variation_value: node.data._variation_value as string | undefined,
    variation_index: node.data._variation_index as number | undefined,
    // Creative Intent Engine — cada criativo carrega seu angle
    // estratégico. Library pode filtrar/agrupar por angle pra ver
    // rapidamente "quais angles foram testados".
    angle_id: angleId || null,
    angle_label: angleLabel || null,
  });
  console.log(`[execImageGen] node=${node.id} aspect_ratio=${aspect_ratio} variation_value=${node.data._variation_value || "(none)"} memory_id=${hubAssetId}`);

  return {
    asset_id: hubAssetId || payload.memory_id || null,
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

  // Salva PNG transparente em hub_assets pra Library
  const hubAssetId = await saveWorkflowAssetToLibrary(ctx, "hub_png", {
    image_url: payload.image_url,
    source_image_url: image_url,
    model: "bria-bg-remove",
    workflow_run_id: ctx.runId,
  });

  return { asset_id: hubAssetId || payload.memory_id || null, image_url: payload.image_url };
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
  const storyboardId = payload.storyboard_id || `sb-${Date.now()}`;
  const sceneList = payload.scenes || [];

  // Salva uma row por cena em hub_assets pra Library (agrupa via storyboard_id)
  const scenes = await Promise.all(sceneList.map(async (s) => {
    if (!s.image_url) return { n: s.n, image_url: s.image_url, asset_id: null };
    const aid = await saveWorkflowAssetToLibrary(ctx, "hub_storyboard", {
      image_url: s.image_url,
      storyboard_id: storyboardId,
      scene_n: s.n,
      scene_count: sceneList.length,
      script,
      aspect_ratio,
      quality,
      brand_id: brandInput?.brand_id || null,
      market: brandInput?.market || null,
      workflow_run_id: ctx.runId,
    });
    return { n: s.n, image_url: s.image_url, asset_id: aid };
  }));

  return { storyboard_id: storyboardId, scenes };
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
  // Kling 3.0: mode determina resolução. Aceita "pro" do node data OU
  // infere de resolution=1080p como compatibilidade com workflows antigos.
  const wantsPro = (node.data.mode as string) === "pro"
    || (node.data.resolution as string) === "1080p";
  const mode = wantsPro ? "pro" : "std";
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
      mode,                // backend deriva resolution de mode
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
    case "brand":           return await execBrand(node);
    case "prompt":          return await execPrompt(node);
    case "image-gen":       return await execImageGen(node, inputs, ctx);
    case "bg-remove":       return await execBgRemove(node, inputs, ctx);
    case "storyboard":      return await execStoryboard(node, inputs, ctx);
    case "video":           return await execVideo(node, inputs, ctx);
    case "voice":           return await execVoice(node, inputs, ctx);
    case "variation":       return await execVariation(node, inputs);
    case "output":          return await execOutput(node, inputs, ctx);
    case "reference-image": return await execReferenceImage(node);
    default: throw new Error(`unknown_node_type:${node.type}`);
  }
}

// Reference Image — recebe upload de imagem (URL pública ou base64) e
// passa pra image-gen via input "references". Image-gen anexa isso ao
// input_images_base64 que vai pro gpt-image-2. Estilo "Recriar Anúncio"
// do Higgsfield: drag um ad existente, recria com seu produto.
async function execReferenceImage(node: GraphNode): Promise<{ image_url: string; description: string }> {
  const url = (node.data.image_url as string)?.trim();
  if (!url) throw new Error("missing_reference_image_url");
  const description = (node.data.description as string)?.trim() || "";
  return { image_url: url, description };
}

// ── Background processor ────────────────────────────────────────────
// Executa o workflow nível-a-nível, atualizando hub_workflow_runs.outputs
// após cada nível pra UI poder polar progresso. Roda em background via
// EdgeRuntime.waitUntil — caller já recebeu run_id e voltou pro client.
//
// Limite de wall-clock do Supabase Edge Function: 150s default.
//
// ESTRATÉGIA PRA WORKFLOWS GRANDES (50+ imagens):
// 1. Concurrency limit dentro de cada nível: max 3 nodes em paralelo
//    (rate limit OpenAI ~5/min, evita throttle e amplifica error blast)
// 2. Time-budget guard: antes de cada batch, verifica se ainda cabe.
//    Se restam <30s, salva checkpoint e re-invoca a function pra
//    continuar do próximo nível. Cada self-invoke ganha +120s de budget.
// 3. Hard cap: 5 self-invokes max (~10 min total). Suficiente pra 50
//    image-gens com OpenAI rate limits.
// 4. Idempotência: ler outputs/errors do DB no boot. Pula nodes já
//    processados (re-invokes não duplicam trabalho).
// Supabase Edge Functions: hard limit 150s. Margem aumentada de 20s
// pra 5s — re-invoke precisa só ~3s. Ganha 15s por iteração ⇒ workflows
// grandes (50+ imgs) precisam menos re-invokes (cada um com overhead
// de ~10s de boot+state load).
const HARD_BUDGET_MS = 145_000;
const RESERVE_FOR_REINVOKE_MS = 8_000;
const NODE_CONCURRENCY = 5;          // OpenAI gpt-image-2 Tier 2 = 50 req/min, 5 paralelos é seguro
const MAX_REINVOKES = 5;

async function processWorkflow(
  runId: string,
  graph: Graph,
  ctx: ExecCtx,
  levels: GraphNode[][],
  sb: ReturnType<typeof createClient>,
  reinvokeCount = 0,
): Promise<void> {
  const startedAt = Date.now();
  // Read state atual do DB pra suportar resume após self-invoke. Outputs
  // de chunks anteriores ficam intactos.
  const outputs: OutputsMap = {};
  const errors: Record<string, string> = {};
  try {
    const { data: existing } = await sb.from("hub_workflow_runs")
      .select("outputs, error")
      .eq("id", runId)
      .maybeSingle();
    if (existing?.outputs) Object.assign(outputs, existing.outputs as OutputsMap);
    if (existing?.error) {
      try { Object.assign(errors, JSON.parse(existing.error as string)); } catch { /* ignore */ }
    }
  } catch (e) { console.warn("[execute-workflow] read state failed:", e); }

  // Marca como running. Updated_at do DB serve como heartbeat — o client
  // pode detectar travamento se passa muito tempo sem updated_at mudar.
  if (reinvokeCount === 0) {
    await sb.from("hub_workflow_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);
  }

  // Encontra próximo nível incompleto (resume após re-invoke)
  let resumeIdx = 0;
  for (let i = 0; i < levels.length; i++) {
    const allDone = levels[i].every(n => outputs[n.id] !== undefined || errors[n.id]);
    if (allDone) resumeIdx = i + 1;
    else break;
  }

  const elapsed = () => Date.now() - startedAt;
  const remainingBudget = () => HARD_BUDGET_MS - elapsed();

  try {
    for (let levelIdx = resumeIdx; levelIdx < levels.length; levelIdx++) {
      const level = levels[levelIdx];

      // Separa nós executáveis vs blocked-by-upstream
      const executable: GraphNode[] = [];
      for (const node of level) {
        if (outputs[node.id] !== undefined || errors[node.id]) continue; // já processado
        const failedAncestor = hasFailedAncestor(node.id, graph, errors);
        if (failedAncestor) {
          errors[node.id] = `upstream_failed:${failedAncestor}`;
          console.warn(`[execute-workflow] node ${node.id} blocked: upstream ${failedAncestor} failed`);
        } else {
          executable.push(node);
        }
      }

      // Processa em batches limitados pra não sobrecarregar OpenAI E pra
      // poder pausar entre batches caso budget aperte.
      for (let batchStart = 0; batchStart < executable.length; batchStart += NODE_CONCURRENCY) {
        // Time-budget guard: se sobra menos do que precisamos pra
        // re-invocar, abandona o batch e marca pra resume.
        if (remainingBudget() < RESERVE_FOR_REINVOKE_MS) {
          console.log(`[execute-workflow] run ${runId} budget low (${remainingBudget()}ms left), persisting + reinvoke ${reinvokeCount + 1}/${MAX_REINVOKES}`);
          await sb.from("hub_workflow_runs")
            .update({ outputs, error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : null })
            .eq("id", runId);
          if (reinvokeCount + 1 >= MAX_REINVOKES) {
            errors["__system__"] = "max_reinvokes_exceeded — workflow muito grande, quebra em workflows menores";
            await finalizeRun(sb, runId, outputs, errors, graph);
            return;
          }
          await selfReinvoke(runId, reinvokeCount);
          return;
        }

        const batch = executable.slice(batchStart, batchStart + NODE_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(node => executeNode(node, graph, outputs, ctx))
        );
        for (let i = 0; i < batch.length; i++) {
          const node = batch[i];
          const r = results[i];
          if (r.status === "fulfilled") {
            outputs[node.id] = r.value;
          } else {
            const msg = (r.reason as Error)?.message || String(r.reason);
            errors[node.id] = msg.slice(0, 300);
            console.error(`[execute-workflow] node ${node.id} (${node.type}) failed:`, msg);
          }
        }
        // Persiste após cada batch pra UI ver progresso fino (ex: 11/50)
        await sb.from("hub_workflow_runs")
          .update({ outputs, error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : null })
          .eq("id", runId);
      }
    }

    // Todos os níveis processados: finaliza
    await finalizeRun(sb, runId, outputs, errors, graph);
  } catch (e) {
    console.error(`[execute-workflow] run ${runId} fatal:`, e);
    // Antes de sobrescrever status="failed", checa se a run já foi
    // finalizada (succeeded/partial/failed). Se sim, mantém — senão
    // corrompe runs onde tudo deu certo mas o final teve um hiccup
    // (ex: timeout no save da última tabela).
    try {
      const { data: current } = await sb.from("hub_workflow_runs")
        .select("status, outputs")
        .eq("id", runId)
        .single();
      const currentStatus = (current as { status?: string } | null)?.status;
      if (currentStatus && ["succeeded", "partial", "failed"].includes(currentStatus)) {
        console.log(`[execute-workflow] run ${runId} already finalized as ${currentStatus} — skipping fatal overwrite`);
        return;
      }
    } catch { /* falha do check, segue pro fallback */ }

    // Não foi finalizado. Decide status baseado nos outputs em memória:
    // se algo foi gerado, marca partial (preserva os assets); senão failed.
    const successCount = Object.keys(outputs).length;
    const fallbackStatus = successCount > 0 ? "partial" : "failed";
    await sb.from("hub_workflow_runs")
      .update({
        status: fallbackStatus,
        outputs,
        error: `processWorkflow exception: ${String(e).slice(0, 200)}`,
        ended_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
}

// Calcula status final e fecha o run no DB.
// Regra: failed = NADA gerado. partial = algo gerado mas com erros.
// Antes era "successCount > errorCount" — agressivo demais, marcava
// 4 ok + 6 falhas como "failed" mesmo tendo 4 imagens reais geradas.
async function finalizeRun(
  sb: ReturnType<typeof createClient>,
  runId: string,
  outputs: OutputsMap,
  errors: Record<string, string>,
  graph: Graph,
): Promise<void> {
  const totalNodes = graph.nodes.length;
  const successCount = Object.keys(outputs).length;
  const errorCount = Object.keys(errors).length;
  let status: "succeeded" | "partial" | "failed";
  if (successCount === 0) status = "failed";       // nada gerado
  else if (errorCount === 0) status = "succeeded"; // tudo ok
  else status = "partial";                          // algo gerado, com erros

  await sb.from("hub_workflow_runs")
    .update({
      status,
      outputs,
      error: errorCount > 0 ? JSON.stringify(errors) : null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", runId);

  console.log(`[execute-workflow] run ${runId} ${status} — ${successCount}/${totalNodes} nodes ok, ${errorCount} errors`);
}

// Re-invoca a function pra continuar onde parou. POST com flag de resume
// + service role token (auth interna). A nova invocação lê o estado atual
// (outputs/errors persistidos) e continua dos próximos nodes.
async function selfReinvoke(runId: string, reinvokeCount = 0): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    // Fire-and-forget — a nova invocação tem seu próprio budget de 150s
    fetch(`${SUPABASE_URL}/functions/v1/execute-workflow`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "x-resume-internal": "1",
      },
      body: JSON.stringify({ resume_run_id: runId, reinvoke_count: reinvokeCount }),
    }).catch(e => console.warn(`[execute-workflow] selfReinvoke ${runId} fetch error:`, e));
  } catch (e) {
    console.error(`[execute-workflow] selfReinvoke ${runId} fatal:`, e);
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

    const body = await req.json().catch(() => ({}));

    // ── RESUME PATH ───────────────────────────────────────────────────
    // Self re-invoke pra continuar workflow grande que estourou budget.
    // Auth interna via service role token + flag header. Lê estado atual
    // do DB e continua processWorkflow do próximo nível incompleto.
    const isResume = req.headers.get("x-resume-internal") === "1" && authToken === SERVICE_KEY;
    if (isResume) {
      const { resume_run_id, reinvoke_count } = body as { resume_run_id?: string; reinvoke_count?: number };
      if (!resume_run_id) return jsonResponse({ _v: FN_VERSION, ok: false, error: "missing_resume_run_id" }, 400);
      const { data: runData } = await sb.from("hub_workflow_runs")
        .select("id, workflow_id, user_id, inputs")
        .eq("id", resume_run_id).maybeSingle();
      if (!runData) return jsonResponse({ _v: FN_VERSION, ok: false, error: "run_not_found" }, 404);
      const { data: wfRow } = await sb.from("hub_workflows").select("graph").eq("id", runData.workflow_id).single();
      if (!wfRow?.graph) return jsonResponse({ _v: FN_VERSION, ok: false, error: "workflow_not_found" }, 404);
      const rawGraphR = wfRow.graph as Graph;
      const overriddenR = applyInputOverrides(rawGraphR, runData.inputs as Record<string, Record<string, unknown>> | undefined);
      const expandedR = expandImageGenCount(expandVariations(overriddenR));
      const levelsR = topoLevels(expandedR);
      const ctxR: ExecCtx = {
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_KEY,
        authToken: SERVICE_KEY, // resume usa service role pras edge calls
        userId: runData.user_id as string,
        runId: resume_run_id,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ER1 = (globalThis as any).EdgeRuntime;
      const nextCount = (reinvoke_count || 0) + 1;
      if (ER1?.waitUntil) {
        ER1.waitUntil(processWorkflow(resume_run_id, expandedR, ctxR, levelsR, sb, nextCount));
      } else {
        processWorkflow(resume_run_id, expandedR, ctxR, levelsR, sb, nextCount).catch(e =>
          console.error("[execute-workflow] resume bg fallback:", e)
        );
      }
      return jsonResponse({ _v: FN_VERSION, ok: true, resumed: true, run_id: resume_run_id }, 200);
    }

    // ── RESCUE STALE PATH ─────────────────────────────────────────────
    // Frontend chama isso quando detecta run "running" há > 5min sem
    // update. Faz 3 coisas:
    //   1. Recomputa expansão pra ver quantos nodes deveria ter
    //   2. Compara com outputs no DB
    //   3. Se alguns ok: marca como "partial". Se nenhum: "failed".
    //   4. Tenta self-resume (1 chance) caso seja só travamento curto.
    const rescueRunId = (body as { rescue_stale_run_id?: string })?.rescue_stale_run_id;
    if (rescueRunId) {
      // Auth: precisa ser do user dono do run
      const { data: userData } = await sb.auth.getUser(authToken);
      if (!userData?.user) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
      const { data: runRow } = await sb.from("hub_workflow_runs")
        .select("id, workflow_id, user_id, inputs, status, outputs, started_at")
        .eq("id", rescueRunId).maybeSingle();
      if (!runRow) return jsonResponse({ _v: FN_VERSION, ok: false, error: "run_not_found" }, 404);
      if (runRow.user_id !== userData.user.id) return jsonResponse({ _v: FN_VERSION, ok: false, error: "forbidden" }, 403);
      if (runRow.status !== "running" && runRow.status !== "pending") {
        return jsonResponse({ _v: FN_VERSION, ok: true, message: "already_terminal", status: runRow.status }, 200);
      }
      const ageMs = Date.now() - new Date(runRow.started_at as string || Date.now()).getTime();
      if (ageMs < 60_000) {
        // < 1min: provavelmente ainda processando, recusa rescue
        return jsonResponse({ _v: FN_VERSION, ok: false, error: "too_young", ageMs }, 400);
      }
      const outs = (runRow.outputs as OutputsMap) || {};
      const successCount = Object.keys(outs).length;
      // Marca status final imediatamente
      const finalStatus = successCount > 0 ? "partial" : "failed";
      const finalError = successCount > 0
        ? `Workflow ficou travado após ${Math.round(ageMs / 1000)}s. ${successCount} outputs salvos.`
        : `Workflow não produziu outputs em ${Math.round(ageMs / 1000)}s.`;
      await sb.from("hub_workflow_runs").update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        error: JSON.stringify({ __rescue__: finalError }),
      }).eq("id", rescueRunId);
      console.log(`[execute-workflow] RESCUED stale run ${rescueRunId} as ${finalStatus} (${successCount} outputs, age ${ageMs}ms)`);
      return jsonResponse({
        _v: FN_VERSION, ok: true, rescued: true,
        status: finalStatus, outputs_saved: successCount,
      }, 200);
    }

    // ── NEW RUN PATH ──────────────────────────────────────────────────
    const { data: userData } = await sb.auth.getUser(authToken);
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

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
