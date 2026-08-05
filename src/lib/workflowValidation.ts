import type {
  WfEdge,
  WfGraph,
  WfNode,
} from "./workflowTypes";

const MAX_TOTAL_NODES = 300;
const MAX_VARIATION_VALUES = 50;
const MAX_IMAGE_COUNT = 50;

const HANDLES_BY_TARGET: Record<string, readonly string[]> = {
  "image-gen": [
    "prompt",
    "brand",
    "reference",
    "elements",
  ],
  "bg-remove": ["image"],
  storyboard: ["prompt", "brand"],
  video: ["prompt", "brand", "image"],
  voice: ["text"],
  output: ["asset"],
  variation: ["in", "default"],
};

const GENERATOR_TYPES = new Set([
  "image-gen",
  "bg-remove",
  "storyboard",
  "video",
  "voice",
]);

function incomingFor(
  incoming: Map<string, WfEdge[]>,
  nodeId: string,
): WfEdge[] {
  return incoming.get(nodeId) || [];
}

function outgoingFor(
  outgoing: Map<string, WfEdge[]>,
  nodeId: string,
): WfEdge[] {
  return outgoing.get(nodeId) || [];
}

function hasHttpUrl(value: unknown): boolean {
  return /^https?:\/\/\S+$/i.test(
    String(value || "").trim(),
  );
}

export function validateWorkflowGraph(
  graph: WfGraph,
): string | null {
  if (
    !graph ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges)
  ) {
    return "estrutura do grafo inválida";
  }

  if (!graph.nodes.length) {
    return "workflow sem nós";
  }

  if (graph.nodes.length > MAX_TOTAL_NODES) {
    return `workflow excede o limite de ${MAX_TOTAL_NODES} nós`;
  }

  const nodeById = new Map<string, WfNode>();

  for (const node of graph.nodes) {
    if (!node.id) {
      return "nó sem id";
    }

    if (!node.type) {
      return `nó ${node.id} sem tipo`;
    }

    if (nodeById.has(node.id)) {
      return `id de nó duplicado: ${node.id}`;
    }

    nodeById.set(node.id, node);
  }

  const edgeIds = new Set<string>();
  const incoming = new Map<string, WfEdge[]>();
  const outgoing = new Map<string, WfEdge[]>();

  for (const item of graph.edges) {
    if (!item.id) {
      return "aresta sem id";
    }

    if (edgeIds.has(item.id)) {
      return `id de aresta duplicado: ${item.id}`;
    }

    edgeIds.add(item.id);

    if (!nodeById.has(item.source)) {
      return `origem inexistente: ${item.source}`;
    }

    if (!nodeById.has(item.target)) {
      return `destino inexistente: ${item.target}`;
    }

    const target = nodeById.get(item.target)!;
    const allowedHandles = HANDLES_BY_TARGET[target.type];

    if (allowedHandles) {
      if (!item.targetHandle) {
        return (
          `aresta ${item.id} sem targetHandle ` +
          `para ${target.type}`
        );
      }

      if (!allowedHandles.includes(item.targetHandle)) {
        return (
          `handle ${item.targetHandle} ` +
          `não é lido por ${target.type}`
        );
      }
    }

    incoming.set(
      item.target,
      [
        ...incomingFor(incoming, item.target),
        item,
      ],
    );

    outgoing.set(
      item.source,
      [
        ...outgoingFor(outgoing, item.source),
        item,
      ],
    );
  }

  /*
   * Detecta ciclos usando ordenação topológica.
   */
  const indegree = new Map<string, number>();

  for (const node of graph.nodes) {
    indegree.set(node.id, 0);
  }

  for (const item of graph.edges) {
    indegree.set(
      item.target,
      (indegree.get(item.target) || 0) + 1,
    );
  }

  const queue = graph.nodes
    .filter(
      (node) =>
        (indegree.get(node.id) || 0) === 0,
    )
    .map((node) => node.id);

  let visitedCount = 0;

  while (queue.length) {
    const current = queue.shift()!;
    visitedCount += 1;

    for (const item of outgoingFor(outgoing, current)) {
      const nextDegree =
        (indegree.get(item.target) || 0) - 1;

      indegree.set(item.target, nextDegree);

      if (nextDegree === 0) {
        queue.push(item.target);
      }
    }
  }

  if (visitedCount !== graph.nodes.length) {
    return "o workflow contém um ciclo";
  }

  const outputs = graph.nodes.filter(
    (node) => node.type === "output",
  );

  if (!outputs.length) {
    return "workflow sem output";
  }

  /*
   * Cada output deve receber exatamente um asset.
   */
  for (const output of outputs) {
    const assetEdges = incomingFor(
      incoming,
      output.id,
    ).filter(
      (item) => item.targetHandle === "asset",
    );

    if (assetEdges.length !== 1) {
      return (
        `output ${output.id} precisa ` +
        `receber exatamente um asset`
      );
    }
  }

  for (const node of graph.nodes) {
    const upstream = incomingFor(incoming, node.id);
    const downstream = outgoingFor(outgoing, node.id);

    if (node.type === "image-gen") {
      const countRaw = node.data.count;

      if (countRaw !== undefined) {
        const count = Number(countRaw);

        if (
          !Number.isInteger(count) ||
          count < 1 ||
          count > MAX_IMAGE_COUNT
        ) {
          return `image-gen ${node.id} tem count inválido`;
        }
      }

      const hasOwnPrompt =
        String(node.data.prompt || "").trim().length > 0;

      const hasPromptInput = upstream.some(
        (item) => item.targetHandle === "prompt",
      );

      if (!hasOwnPrompt && !hasPromptInput) {
        return `image-gen ${node.id} sem prompt`;
      }
    }

    if (
      node.type === "reference-image" &&
      !hasHttpUrl(node.data.image_url)
    ) {
      return (
        `reference-image ${node.id} ` +
        `sem URL pública válida`
      );
    }

    if (node.type === "variation") {
      const values = Array.isArray(node.data.values)
        ? node.data.values.filter(
            (item) => String(item).trim(),
          )
        : [];

      if (!values.length) {
        return `variation ${node.id} sem valores`;
      }

      if (values.length > MAX_VARIATION_VALUES) {
        return (
          `variation ${node.id} excede ` +
          `${MAX_VARIATION_VALUES} valores`
        );
      }

      if (!downstream.length) {
        return `variation ${node.id} sem saída`;
      }
    }

    if (node.type === "voice") {
      const hasText =
        String(node.data.text || "").trim().length > 0;

      const hasTextInput = upstream.some(
        (item) => item.targetHandle === "text",
      );

      if (!hasText && !hasTextInput) {
        return `voice ${node.id} sem texto`;
      }
    }

    if (node.type === "video") {
      const hasOwnPrompt =
        String(
          node.data.text ||
          node.data.prompt ||
          "",
        ).trim().length > 0;

      const hasPromptInput = upstream.some(
        (item) => item.targetHandle === "prompt",
      );

      const hasImageInput = upstream.some(
        (item) => item.targetHandle === "image",
      );

      if (
        !hasOwnPrompt &&
        !hasPromptInput &&
        !hasImageInput
      ) {
        return (
          `video ${node.id} ` +
          `sem prompt ou imagem`
        );
      }
    }

    if (node.type === "bg-remove") {
      const hasImageInput = upstream.some(
        (item) => item.targetHandle === "image",
      );

      if (!hasImageInput) {
        return `bg-remove ${node.id} sem imagem`;
      }
    }

    if (node.type === "storyboard") {
      const hasPromptInput = upstream.some(
        (item) => item.targetHandle === "prompt",
      );

      if (!hasPromptInput) {
        return `storyboard ${node.id} sem roteiro`;
      }
    }
  }

  /*
   * Todo nó que gera um asset precisa terminar
   * em pelo menos um output.
   */
  const reachesOutput = (startId: string): boolean => {
    const seen = new Set<string>();
    const pending = [startId];

    while (pending.length) {
      const current = pending.shift()!;

      if (seen.has(current)) {
        continue;
      }

      seen.add(current);

      if (nodeById.get(current)?.type === "output") {
        return true;
      }

      for (const item of outgoingFor(outgoing, current)) {
        pending.push(item.target);
      }
    }

    return false;
  };

  for (const node of graph.nodes) {
    if (
      GENERATOR_TYPES.has(node.type) &&
      !reachesOutput(node.id)
    ) {
      return (
        `${node.type} ${node.id} gera um asset ` +
        `que não chega a output`
      );
    }
  }

  return null;
}
