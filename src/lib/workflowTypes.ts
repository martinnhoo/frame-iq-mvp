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
