/**
 * HubWorkflows — editor de pipelines reutilizáveis (Brilliant Workflows).
 *
 * Equivalente Brilliant ao Higgsfield Canvas: monta uma vez (brand →
 * prompt → image-gen → output) e roda N vezes trocando inputs.
 *
 * Layout:
 *   ┌────────────┬──────────────────────────┬─────────────┐
 *   │ Templates  │   React Flow canvas       │ Node config │
 *   │ + My WFs   │   (drag, connect, run)    │ (selecionar │
 *   │            │                           │  pra editar)│
 *   └────────────┴──────────────────────────┴─────────────┘
 *
 * Fase 1: 4 nós (brand, prompt, image-gen, output) + 1 template.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  applyNodeChanges, applyEdgeChanges, addEdge,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, Play, Save, Plus, Loader, Copy, Trash2, Sparkles,
  Image as ImageIcon, Type, Tag, Download, Scissors, Clapperboard, GitBranch, Mic,
} from "lucide-react";
import { HUB_BRANDS, HUB_MARKETS, getBrand, type MarketCode } from "@/data/hubBrands";
import {
  type Workflow, type WfGraph, type WfNode, type WfEdge,
  listMyWorkflows, listTemplates, getWorkflow, cloneWorkflow,
  updateWorkflowGraph, deleteWorkflow, createWorkflow, runWorkflow,
} from "@/lib/hubWorkflows";

// ── i18n minimal pt/en/es/zh ───────────────────────────────────────
const t = (pt: string) => pt; // MVP: só pt. i18n full vem depois.

// ── Custom node components ─────────────────────────────────────────
// Cada nó é um component React Flow. Visual segue o dark theme do Hub.

function NodeShell({
  icon, title, color, selected, children, handles,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  selected: boolean;
  children?: React.ReactNode;
  handles: Array<{ id: string; type: "source" | "target"; position: Position; label?: string }>;
}) {
  return (
    <div style={{
      minWidth: 200, maxWidth: 240,
      background: "#0d0d14",
      border: `1.5px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
      borderRadius: 10,
      boxShadow: selected ? `0 0 0 3px ${color}22` : "0 2px 6px rgba(0,0,0,0.4)",
      transition: "border-color 0.15s, box-shadow 0.15s",
      fontSize: 12,
      color: "#E5E7EB",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: `linear-gradient(180deg, ${color}11, transparent)`,
      }}>
        <div style={{ color, display: "flex" }}>{icon}</div>
        <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase", color }}>
          {title}
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5, color: "#9CA3AF" }}>
        {children}
      </div>
      {/* Handles */}
      {handles.map(h => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.type}
          position={h.position}
          style={{
            width: 10, height: 10,
            background: color,
            border: "2px solid #0d0d14",
          }}
        />
      ))}
    </div>
  );
}

function BrandNode({ data, selected }: { data: { brand_id?: string; market?: string }; selected: boolean }) {
  const brand = data.brand_id ? getBrand(data.brand_id) : null;
  return (
    <NodeShell
      icon={<Tag size={13} />}
      title="Marca"
      color="#EAB308"
      selected={selected}
      handles={[{ id: "out", type: "source", position: Position.Right }]}
    >
      <div style={{ color: "#fff", fontWeight: 600 }}>{brand?.name || data.brand_id || "Sem marca"}</div>
      {data.market && (
        <div style={{ marginTop: 2 }}>
          {HUB_MARKETS[data.market as MarketCode]?.flag} {HUB_MARKETS[data.market as MarketCode]?.labels.pt || data.market}
        </div>
      )}
    </NodeShell>
  );
}

function PromptNode({ data, selected }: { data: { text?: string }; selected: boolean }) {
  const preview = (data.text || "").slice(0, 80);
  return (
    <NodeShell
      icon={<Type size={13} />}
      title="Prompt"
      color="#60A5FA"
      selected={selected}
      handles={[{ id: "out", type: "source", position: Position.Right }]}
    >
      <div style={{ fontStyle: data.text ? "normal" : "italic", color: data.text ? "#9CA3AF" : "rgba(255,255,255,0.30)" }}>
        {preview || "Clique pra editar..."}{data.text && data.text.length > 80 ? "…" : ""}
      </div>
    </NodeShell>
  );
}

function ImageGenNode({ data, selected }: { data: { aspect_ratio?: string; quality?: string }; selected: boolean }) {
  return (
    <NodeShell
      icon={<ImageIcon size={13} />}
      title="Gerar imagem"
      color="#3B82F6"
      selected={selected}
      handles={[
        { id: "prompt", type: "target", position: Position.Left },
        { id: "brand", type: "target", position: Position.Top },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>{data.aspect_ratio || "1:1"} · {data.quality || "medium"}</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>gpt-image-2</div>
    </NodeShell>
  );
}

function OutputNode({ data, selected }: { data: { name_template?: string }; selected: boolean }) {
  return (
    <NodeShell
      icon={<Download size={13} />}
      title="Salvar na biblioteca"
      color="#10B981"
      selected={selected}
      handles={[{ id: "asset", type: "target", position: Position.Left }]}
    >
      <div style={{ fontSize: 10.5 }}>{data.name_template || "{date}_{slug}"}</div>
    </NodeShell>
  );
}

function BgRemoveNode({ selected }: { selected: boolean }) {
  return (
    <NodeShell
      icon={<Scissors size={13} />}
      title="Remover fundo"
      color="#A855F7"
      selected={selected}
      handles={[
        { id: "image", type: "target", position: Position.Left },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>BRIA AI</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>PNG transparente {"<"} 2MB</div>
    </NodeShell>
  );
}

function StoryboardNode({ data, selected }: { data: { scene_count?: number; aspect_ratio?: string; quality?: string }; selected: boolean }) {
  return (
    <NodeShell
      icon={<Clapperboard size={13} />}
      title="Storyboard"
      color="#F97316"
      selected={selected}
      handles={[
        { id: "prompt", type: "target", position: Position.Left },
        { id: "brand", type: "target", position: Position.Top },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>{data.scene_count || 4} cenas · {data.aspect_ratio || "9:16"}</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>{data.quality || "medium"}</div>
    </NodeShell>
  );
}

function VoiceNode({ data, selected }: { data: { voice_id?: string; voice_name?: string }; selected: boolean }) {
  return (
    <NodeShell
      icon={<Mic size={13} />}
      title="Voz"
      color="#06B6D4"
      selected={selected}
      handles={[
        { id: "text", type: "target", position: Position.Left },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>{data.voice_name || "Rachel (default)"}</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>ElevenLabs</div>
    </NodeShell>
  );
}

function VariationNode({ data, selected }: { data: { axis?: string; values?: string[] }; selected: boolean }) {
  const values = data.values || [];
  return (
    <NodeShell
      icon={<GitBranch size={13} />}
      title="Variação"
      color="#EC4899"
      selected={selected}
      handles={[
        { id: "in", type: "target", position: Position.Left },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>Eixo: {data.axis || "aspect_ratio"}</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.50)" }}>
        {values.length === 0 ? "Sem valores" : `${values.length} variantes: ${values.join(", ")}`}
      </div>
    </NodeShell>
  );
}

const nodeTypes = {
  brand: BrandNode,
  prompt: PromptNode,
  "image-gen": ImageGenNode,
  "bg-remove": BgRemoveNode,
  storyboard: StoryboardNode,
  voice: VoiceNode,
  variation: VariationNode,
  output: OutputNode,
};

// Helper: convert WfGraph (DB shape) → React Flow nodes+edges
function graphToRf(graph: WfGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graph.nodes || []).map(n => ({
    id: n.id,
    type: n.type,
    position: n.position || { x: 0, y: 0 },
    data: n.data || {},
  }));
  const edges: Edge[] = (graph.edges || []).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: "default",
    style: { stroke: "rgba(255,255,255,0.30)", strokeWidth: 1.5 },
  }));
  return { nodes, edges };
}

function rfToGraph(nodes: Node[], edges: Edge[]): WfGraph {
  return {
    version: 1,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type || "prompt",
      position: n.position,
      data: n.data as Record<string, unknown>,
    })) as WfNode[],
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    })) as WfEdge[],
  };
}

// ── Página ─────────────────────────────────────────────────────────
export default function HubWorkflows() {
  return (
    <ReactFlowProvider>
      <HubWorkflowsInner />
    </ReactFlowProvider>
  );
}

function HubWorkflowsInner() {
  const navigate = useNavigate();

  // Sidebar state
  const [templates, setTemplates] = useState<Workflow[]>([]);
  const [myWorkflows, setMyWorkflows] = useState<Workflow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active workflow
  const [activeWf, setActiveWf] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Run state
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ outputs?: Record<string, { image_url?: string; name?: string }>; errors?: Record<string, string>; status?: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tpls, mine] = await Promise.all([listTemplates(), listMyWorkflows()]);
      if (cancelled) return;
      setTemplates(tpls);
      setMyWorkflows(mine);
      setLoadingList(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // React Flow handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, []);
  const onConnect = useCallback((conn: Connection) => {
    setEdges(eds => addEdge({
      ...conn,
      type: "default",
      style: { stroke: "rgba(255,255,255,0.30)", strokeWidth: 1.5 },
    }, eds));
  }, []);

  const openWorkflow = async (wf: Workflow) => {
    let toLoad = wf;
    // Se for template, clona pra o user antes de abrir (templates são read-only)
    if (wf.is_template) {
      try {
        toLoad = await cloneWorkflow(wf.id, wf.name);
        // Refresh sidebar
        const mine = await listMyWorkflows();
        setMyWorkflows(mine);
      } catch (e) {
        alert(`Erro ao abrir template: ${(e as Error).message}`);
        return;
      }
    } else {
      const fresh = await getWorkflow(wf.id);
      if (fresh) toLoad = fresh;
    }
    const { nodes: rfNodes, edges: rfEdges } = graphToRf(toLoad.graph);
    setActiveWf(toLoad);
    setNodes(rfNodes);
    setEdges(rfEdges);
    setName(toLoad.name);
    setSelectedNodeId(null);
    setRunResult(null);
    setRunError(null);
  };

  const newBlankWorkflow = async () => {
    try {
      const wf = await createWorkflow({
        name: "Novo workflow",
        graph: { version: 1, nodes: [], edges: [] },
      });
      const mine = await listMyWorkflows();
      setMyWorkflows(mine);
      await openWorkflow(wf);
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    }
  };

  const saveActive = async () => {
    if (!activeWf) return;
    try {
      const graph = rfToGraph(nodes, edges);
      await updateWorkflowGraph(activeWf.id, graph, name);
      const mine = await listMyWorkflows();
      setMyWorkflows(mine);
    } catch (e) {
      alert(`Erro ao salvar: ${(e as Error).message}`);
    }
  };

  const deleteActive = async () => {
    if (!activeWf) return;
    if (!confirm(`Deletar workflow "${activeWf.name}"?`)) return;
    try {
      await deleteWorkflow(activeWf.id);
      setActiveWf(null);
      setNodes([]);
      setEdges([]);
      const mine = await listMyWorkflows();
      setMyWorkflows(mine);
    } catch (e) {
      alert(`Erro ao deletar: ${(e as Error).message}`);
    }
  };

  const runActive = async () => {
    if (!activeWf || running) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      // Salva antes de rodar — graph atual no estado pode ter mudanças
      const graph = rfToGraph(nodes, edges);
      await updateWorkflowGraph(activeWf.id, graph, name);

      const r = await runWorkflow({ workflow_id: activeWf.id, graph });
      if (!r.ok) {
        setRunError(r.message || "Falha ao executar workflow");
      } else {
        setRunResult({
          outputs: r.outputs as Record<string, { image_url?: string; name?: string }>,
          errors: r.errors,
          status: r.status,
        });
      }
    } catch (e) {
      setRunError(String(e).slice(0, 200));
    } finally {
      setRunning(false);
    }
  };

  // Add node from palette
  const addNodeOfType = (type: string) => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultData: Record<string, Record<string, unknown>> = {
      brand: { brand_id: "betbus", market: "MX", include_disclaimer: true },
      prompt: { text: "" },
      "image-gen": { aspect_ratio: "1:1", quality: "medium" },
      "bg-remove": {},
      storyboard: { scene_count: 4, aspect_ratio: "9:16", quality: "medium" },
      voice: { voice_id: "21m00Tcm4TlvDq8ikWAM", voice_name: "Rachel" },
      variation: { axis: "aspect_ratio", values: ["1:1", "9:16", "16:9"] },
      output: { name_template: "{date}_{slug}", save_to_library: true },
    };
    const newNode: Node = {
      id,
      type,
      position: { x: 100 + nodes.length * 40, y: 100 + nodes.length * 30 },
      data: defaultData[type] || {},
    };
    setNodes(nds => [...nds, newNode]);
  };

  // Update selected node data
  const updateSelectedData = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n
    ));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#06070a", color: "#fff", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0b10",
      }}>
        <button onClick={() => navigate("/dashboard/hub")} style={iconBtn}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Workflows</div>
        <div style={{ flex: 1 }} />
        {activeWf && (
          <>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do workflow"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, padding: "6px 10px",
                color: "#fff", fontSize: 12, width: 220,
                fontFamily: "inherit",
              }}
            />
            <button onClick={saveActive} style={btnSecondary}>
              <Save size={13} /> Salvar
            </button>
            <button onClick={runActive} disabled={running} style={btnPrimary}>
              {running ? <Loader size={13} className="spin" /> : <Play size={13} />}
              {running ? "Rodando..." : "Run"}
            </button>
            <button onClick={deleteActive} style={iconBtn} title="Deletar">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar esquerda */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "#08090e",
          padding: "12px 10px",
          overflowY: "auto",
        }}>
          <button onClick={newBlankWorkflow} style={{
            ...btnSecondary,
            width: "100%", justifyContent: "center", marginBottom: 14,
          }}>
            <Plus size={13} /> Novo workflow
          </button>

          <div style={sidebarLabel}>Templates</div>
          {loadingList ? (
            <div style={sidebarHint}>Carregando...</div>
          ) : templates.length === 0 ? (
            <div style={sidebarHint}>Sem templates ainda.</div>
          ) : templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => openWorkflow(tpl)}
              style={sidebarItem(activeWf?.id === tpl.id)}
            >
              <Sparkles size={11} />
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
            </button>
          ))}

          <div style={{ ...sidebarLabel, marginTop: 18 }}>Meus workflows</div>
          {myWorkflows.length === 0 ? (
            <div style={sidebarHint}>Sem workflows. Abre um template ou cria do zero.</div>
          ) : myWorkflows.map(wf => (
            <button
              key={wf.id}
              onClick={() => openWorkflow(wf)}
              style={sidebarItem(activeWf?.id === wf.id)}
            >
              <Copy size={11} />
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wf.name}</span>
            </button>
          ))}

          {activeWf && (
            <>
              <div style={{ ...sidebarLabel, marginTop: 18 }}>Adicionar nó</div>
              <button onClick={() => addNodeOfType("brand")} style={paletteBtn("#EAB308")}>
                <Tag size={11} /> Marca
              </button>
              <button onClick={() => addNodeOfType("prompt")} style={paletteBtn("#60A5FA")}>
                <Type size={11} /> Prompt
              </button>
              <button onClick={() => addNodeOfType("image-gen")} style={paletteBtn("#3B82F6")}>
                <ImageIcon size={11} /> Gerar imagem
              </button>
              <button onClick={() => addNodeOfType("bg-remove")} style={paletteBtn("#A855F7")}>
                <Scissors size={11} /> Remover fundo
              </button>
              <button onClick={() => addNodeOfType("storyboard")} style={paletteBtn("#F97316")}>
                <Clapperboard size={11} /> Storyboard
              </button>
              <button onClick={() => addNodeOfType("voice")} style={paletteBtn("#06B6D4")}>
                <Mic size={11} /> Voz
              </button>
              <button onClick={() => addNodeOfType("variation")} style={paletteBtn("#EC4899")}>
                <GitBranch size={11} /> Variação
              </button>
              <button onClick={() => addNodeOfType("output")} style={paletteBtn("#10B981")}>
                <Download size={11} /> Salvar
              </button>
            </>
          )}
        </div>

        {/* Canvas central */}
        <div style={{ flex: 1, position: "relative", background: "#06070a" }}>
          {!activeWf ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8,
              color: "rgba(255,255,255,0.40)",
            }}>
              <Sparkles size={28} style={{ opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
                Abra um template ou crie um workflow novo
              </div>
              <div style={{ fontSize: 11.5 }}>
                Workflows automatizam pipelines de geração de criativos.
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              colorMode="dark"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="rgba(255,255,255,0.05)" />
              <Controls position="bottom-right" />
            </ReactFlow>
          )}
        </div>

        {/* Right panel — node config OR run result */}
        <div style={{
          width: 280, flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "#08090e",
          padding: "12px 14px",
          overflowY: "auto",
        }}>
          {runResult ? (
            <RunResultPanel result={runResult} onClose={() => setRunResult(null)} />
          ) : runError ? (
            <div style={{ fontSize: 12, color: "#F87171" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Erro ao rodar</div>
              <div style={{ background: "rgba(248,113,113,0.10)", padding: 10, borderRadius: 8 }}>{runError}</div>
              <button onClick={() => setRunError(null)} style={{ ...btnSecondary, marginTop: 10 }}>Fechar</button>
            </div>
          ) : selectedNode ? (
            <NodeConfigPanel
              node={selectedNode}
              onUpdate={updateSelectedData}
              onDelete={() => {
                setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNodeId(null);
              }}
            />
          ) : activeWf ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}>
              <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>{activeWf.name}</div>
              <div>Selecione um nó pra editar, ou conecte os outputs (direita) aos inputs (esquerda).</div>
              <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.5 }}>
                <div style={{ color: "rgba(255,255,255,0.40)", marginBottom: 4 }}>Quando rodar:</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>Cada nó executa em ordem topológica</li>
                  <li>Outputs viram inputs do próximo</li>
                  <li>Resultado aparece aqui</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 0.8s linear infinite; }
        .react-flow__renderer { background: #06070a; }
      `}</style>
    </div>
  );
}

// ── Node config panel ──────────────────────────────────────────────
function NodeConfigPanel({
  node, onUpdate, onDelete,
}: {
  node: Node;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const data = node.data as Record<string, unknown>;
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(255,255,255,0.50)" }}>
          {nodeLabel(node.type || "")}
        </div>
        <button onClick={onDelete} style={iconBtn} title="Deletar nó">
          <Trash2 size={11} />
        </button>
      </div>

      {node.type === "brand" && (
        <>
          <FieldLabel>Marca</FieldLabel>
          <select
            value={(data.brand_id as string) || "none"}
            onChange={e => onUpdate({ brand_id: e.target.value })}
            style={selectStyle}
          >
            {Object.values(HUB_BRANDS).map(b => (
              <option key={b.id} value={b.id} style={{ background: "#0d0d14" }}>{b.name}</option>
            ))}
          </select>
          <FieldLabel>Mercado</FieldLabel>
          <select
            value={(data.market as string) || ""}
            onChange={e => onUpdate({ market: e.target.value })}
            style={selectStyle}
          >
            <option value="" style={{ background: "#0d0d14" }}>(sem mercado)</option>
            {Object.values(HUB_MARKETS).map(m => (
              <option key={m.code} value={m.code} style={{ background: "#0d0d14" }}>
                {m.flag} {m.labels.pt}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!data.include_disclaimer}
              onChange={e => onUpdate({ include_disclaimer: e.target.checked })}
            />
            Incluir disclaimer regulatório
          </label>
        </>
      )}

      {node.type === "prompt" && (
        <>
          <FieldLabel>Texto do prompt</FieldLabel>
          <textarea
            value={(data.text as string) || ""}
            onChange={e => onUpdate({ text: e.target.value })}
            rows={6}
            placeholder="Descreva o criativo..."
            style={{
              ...selectStyle,
              fontFamily: "inherit", resize: "vertical",
              minHeight: 120,
            }}
          />
        </>
      )}

      {node.type === "image-gen" && (
        <>
          <FieldLabel>Aspect ratio</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["1:1", "9:16", "16:9", "4:5"].map(ar => (
              <button
                key={ar}
                onClick={() => onUpdate({ aspect_ratio: ar })}
                style={pillStyle(data.aspect_ratio === ar)}
              >
                {ar}
              </button>
            ))}
          </div>
          <FieldLabel>Qualidade</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: "low", l: "Rascunho" },
              { v: "medium", l: "Médio" },
              { v: "high", l: "Alta" },
            ].map(q => (
              <button
                key={q.v}
                onClick={() => onUpdate({ quality: q.v })}
                style={pillStyle(data.quality === q.v)}
              >
                {q.l}
              </button>
            ))}
          </div>
        </>
      )}

      {node.type === "output" && (
        <>
          <FieldLabel>Template do nome</FieldLabel>
          <input
            value={(data.name_template as string) || "{date}_{slug}"}
            onChange={e => onUpdate({ name_template: e.target.value })}
            style={selectStyle}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            Vars: {"{brand}"} {"{market}"} {"{date}"} {"{time}"} {"{slug}"}
          </div>
        </>
      )}

      {node.type === "bg-remove" && (
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          Sem configuração — recebe imagem upstream e devolve PNG transparente {"<"} 2MB via BRIA AI.
        </div>
      )}

      {node.type === "storyboard" && (
        <>
          <FieldLabel>Número de cenas</FieldLabel>
          <input
            type="number"
            min={2}
            max={8}
            value={Number(data.scene_count || 4)}
            onChange={e => onUpdate({ scene_count: Math.max(2, Math.min(8, Number(e.target.value) || 4)) })}
            style={selectStyle}
          />
          <FieldLabel>Aspect ratio</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["1:1", "9:16", "16:9"].map(ar => (
              <button
                key={ar}
                onClick={() => onUpdate({ aspect_ratio: ar })}
                style={pillStyle(data.aspect_ratio === ar)}
              >
                {ar}
              </button>
            ))}
          </div>
          <FieldLabel>Qualidade</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: "low", l: "Rascunho" },
              { v: "medium", l: "Médio" },
              { v: "high", l: "Alta" },
            ].map(q => (
              <button
                key={q.v}
                onClick={() => onUpdate({ quality: q.v })}
                style={pillStyle(data.quality === q.v)}
              >
                {q.l}
              </button>
            ))}
          </div>
        </>
      )}

      {node.type === "voice" && (
        <>
          <FieldLabel>Voice ID (ElevenLabs)</FieldLabel>
          <input
            value={(data.voice_id as string) || ""}
            onChange={e => onUpdate({ voice_id: e.target.value })}
            placeholder="21m00Tcm4TlvDq8ikWAM (Rachel)"
            style={selectStyle}
          />
          <FieldLabel>Nome (display)</FieldLabel>
          <input
            value={(data.voice_name as string) || ""}
            onChange={e => onUpdate({ voice_name: e.target.value })}
            placeholder="Rachel"
            style={selectStyle}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            Recebe o texto upstream e gera áudio MP3 via ElevenLabs.
          </div>
        </>
      )}

      {node.type === "variation" && (
        <>
          <FieldLabel>Eixo de variação</FieldLabel>
          <select
            value={(data.axis as string) || "aspect_ratio"}
            onChange={e => onUpdate({ axis: e.target.value })}
            style={selectStyle}
          >
            <option value="aspect_ratio" style={{ background: "#0d0d14" }}>Aspect ratio</option>
            {/* market: requer re-resolução de brand context — Fase 3 */}
          </select>
          <FieldLabel>Valores (1 por linha)</FieldLabel>
          <textarea
            value={(data.values as string[] || []).join("\n")}
            onChange={e => onUpdate({ values: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
            rows={4}
            placeholder="1:1&#10;9:16&#10;16:9"
            style={{ ...selectStyle, fontFamily: "inherit", resize: "vertical", minHeight: 80 }}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            Pra cada valor, o subgrafo downstream é clonado e executado em paralelo.
          </div>
        </>
      )}
    </div>
  );
}

// ── Run result panel ───────────────────────────────────────────────
function RunResultPanel({
  result, onClose,
}: {
  result: { outputs?: Record<string, { image_url?: string; audio_url?: string; name?: string }>; errors?: Record<string, string>; status?: string };
  onClose: () => void;
}) {
  const outputs = result.outputs || {};
  const errors = result.errors || {};
  // Coleta assets visíveis: imagens E áudios (qualquer nó que retornou um deles)
  const finalAssets = Object.entries(outputs)
    .filter(([_, v]) => {
      if (!v || typeof v !== "object") return false;
      const obj = v as { image_url?: string; audio_url?: string };
      return !!(obj.image_url || obj.audio_url);
    })
    .map(([id, v]) => ({ id, ...(v as { image_url?: string; audio_url?: string; name?: string }) }));

  const statusColor = result.status === "succeeded" ? "#10B981"
    : result.status === "partial" ? "#F59E0B"
    : "#F87171";

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: statusColor }}>
          {result.status}
        </div>
        <button onClick={onClose} style={iconBtn}>×</button>
      </div>

      {finalAssets.length > 0 ? (
        finalAssets.map(a => (
          <div key={a.id} style={{ marginBottom: 12 }}>
            {a.image_url && (
              <img src={a.image_url} alt={a.name || "image"} style={{
                width: "100%", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.10)",
              }} />
            )}
            {a.audio_url && (
              <audio src={a.audio_url} controls style={{ width: "100%", marginTop: 4 }} />
            )}
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{a.name || a.id}</div>
            {(a.image_url || a.audio_url) && (
              <a
                href={(a.image_url || a.audio_url)!}
                download={`${a.name || a.id}.${a.image_url ? "png" : "mp3"}`}
                style={{
                  ...btnSecondary,
                  marginTop: 6, justifyContent: "center", textDecoration: "none",
                }}
              >
                <Download size={11} /> Baixar
              </a>
            )}
          </div>
        ))
      ) : (
        <div style={{ color: "rgba(255,255,255,0.50)" }}>Nenhum output produzido.</div>
      )}

      {Object.keys(errors).length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(248,113,113,0.10)", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: "#F87171", marginBottom: 4 }}>Erros</div>
          {Object.entries(errors).map(([id, msg]) => (
            <div key={id} style={{ fontSize: 11, color: "#FCA5A5", marginBottom: 4 }}>
              <span style={{ opacity: 0.7 }}>{id}:</span> {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
      textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
      marginTop: 10, marginBottom: 4,
    }}>{children}</div>
  );
}

function nodeLabel(t: string): string {
  return ({
    brand: "Marca",
    prompt: "Prompt",
    "image-gen": "Gerar imagem",
    "bg-remove": "Remover fundo",
    storyboard: "Storyboard",
    voice: "Voz",
    variation: "Variação",
    output: "Salvar",
  } as Record<string, string>)[t] || t;
}

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#9CA3AF", cursor: "pointer", fontFamily: "inherit",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  color: "#fff", fontSize: 11.5, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 14px",
  background: "#3B82F6",
  border: "1px solid #3B82F6",
  borderRadius: 6,
  color: "#fff", fontSize: 11.5, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};

const sidebarLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.40)",
  marginBottom: 6, padding: "0 4px",
};
const sidebarHint: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.30)",
  padding: "0 4px",
  lineHeight: 1.4,
};
function sidebarItem(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 6,
    width: "100%", padding: "6px 8px", marginBottom: 2,
    background: active ? "rgba(59,130,246,0.10)" : "transparent",
    border: "none",
    borderRadius: 6,
    color: active ? "#fff" : "rgba(255,255,255,0.70)",
    fontSize: 11.5, fontFamily: "inherit",
    cursor: "pointer", textAlign: "left",
  };
}
function paletteBtn(color: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 6,
    width: "100%", padding: "6px 8px", marginBottom: 4,
    background: "rgba(255,255,255,0.03)",
    border: `1px dashed ${color}55`,
    borderRadius: 6,
    color, fontSize: 11.5, fontFamily: "inherit",
    cursor: "pointer", textAlign: "left",
  };
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  color: "#fff", fontSize: 12,
  fontFamily: "inherit",
  marginBottom: 4,
  outline: "none",
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "6px 10px",
    background: active ? "rgba(59,130,246,0.20)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#3B82F6" : "rgba(255,255,255,0.10)"}`,
    borderRadius: 6,
    color: active ? "#3B82F6" : "rgba(255,255,255,0.70)",
    fontSize: 11, fontFamily: "inherit",
    cursor: "pointer",
  };
}
