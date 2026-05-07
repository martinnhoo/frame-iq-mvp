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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addHubNotification, updateHubNotification } from "@/lib/hubNotifications";
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  applyNodeChanges, applyEdgeChanges, addEdge,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, Play, Save, Plus, Loader, Copy, Trash2, Sparkles,
  Image as ImageIcon, Type, Tag, Download, Scissors, Clapperboard, GitBranch, Mic, Video as VideoIcon,
  ChevronDown, X, Search, Menu,
} from "lucide-react";
import { HUB_BRANDS, HUB_MARKETS, getBrand, type MarketCode, type Lang } from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type Workflow, type WorkflowSummary, type WfGraph, type WfNode, type WfEdge,
  listMyWorkflows, listTemplates, getWorkflow, cloneWorkflow,
  updateWorkflowGraph, deleteWorkflow, createWorkflow, runWorkflow,
  pollWorkflowRun,
} from "@/lib/hubWorkflows";

// ── i18n strings ──────────────────────────────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  workflows:        { pt: "Workflows",          en: "Workflows",          es: "Workflows",          zh: "工作流" },
  templates:        { pt: "Templates",          en: "Templates",          es: "Plantillas",         zh: "模板" },
  myWorkflows:      { pt: "Meus workflows",     en: "My workflows",       es: "Mis workflows",      zh: "我的工作流" },
  newWorkflow:      { pt: "Novo workflow",      en: "New workflow",       es: "Nuevo workflow",     zh: "新建工作流" },
  addNode:          { pt: "Adicionar nó",       en: "Add node",           es: "Agregar nodo",       zh: "添加节点" },
  brand:            { pt: "Marca",              en: "Brand",              es: "Marca",              zh: "品牌" },
  prompt:           { pt: "Prompt",             en: "Prompt",             es: "Prompt",             zh: "提示词" },
  imageGen:         { pt: "Gerar imagem",       en: "Generate image",     es: "Generar imagen",     zh: "生成图像" },
  bgRemove:         { pt: "Remover fundo",      en: "Remove background",  es: "Quitar fondo",       zh: "移除背景" },
  storyboard:       { pt: "Storyboard",         en: "Storyboard",         es: "Storyboard",         zh: "故事板" },
  videoNode:        { pt: "Vídeo (Kling)",      en: "Video (Kling)",      es: "Video (Kling)",      zh: "视频 (Kling)" },
  voice:            { pt: "Voz",                en: "Voice",              es: "Voz",                zh: "语音" },
  variation:        { pt: "Variação",           en: "Variation",          es: "Variación",          zh: "变体" },
  saveNode:         { pt: "Salvar",             en: "Save",               es: "Guardar",            zh: "保存" },
  save:             { pt: "Salvar",             en: "Save",               es: "Guardar",            zh: "保存" },
  run:              { pt: "Rodar",              en: "Run",                es: "Ejecutar",           zh: "运行" },
  running:          { pt: "Rodando…",           en: "Running…",           es: "Ejecutando…",        zh: "运行中..." },
  delete:           { pt: "Deletar",            en: "Delete",             es: "Eliminar",           zh: "删除" },
  workflowName:     { pt: "Nome do workflow",   en: "Workflow name",      es: "Nombre del workflow",zh: "工作流名称" },
  noTemplate:       { pt: "Sem templates ainda.", en: "No templates yet.", es: "Sin plantillas aún.", zh: "还没有模板。" },
  noMyWf:           { pt: "Sem workflows. Abre um template ou cria do zero.",
                      en: "No workflows. Open a template or create from scratch.",
                      es: "Sin workflows. Abre una plantilla o crea desde cero.",
                      zh: "暂无工作流。打开模板或从头创建。" },
  loading:          { pt: "Carregando…",        en: "Loading…",           es: "Cargando…",          zh: "加载中..." },
  emptyTitle:       { pt: "Abra um template ou crie um workflow novo",
                      en: "Open a template or create a new workflow",
                      es: "Abre una plantilla o crea un workflow nuevo",
                      zh: "打开模板或创建新工作流" },
  emptyHint:        { pt: "Workflows automatizam pipelines de geração de criativos.",
                      en: "Workflows automate creative generation pipelines.",
                      es: "Los workflows automatizan pipelines de generación de creativos.",
                      zh: "工作流自动化创意生成流程。" },
  selectNodeHint:   { pt: "Selecione um nó pra editar, ou conecte os outputs (direita) aos inputs (esquerda).",
                      en: "Select a node to edit, or connect outputs (right) to inputs (left).",
                      es: "Selecciona un nodo para editar, o conecta los outputs (derecha) a los inputs (izquierda).",
                      zh: "选择节点编辑，或将输出（右）连接到输入（左）。" },
  whenRun:          { pt: "Quando rodar:",       en: "When you run:",      es: "Cuando ejecutas:",   zh: "运行时：" },
  hint1:            { pt: "Cada nó executa em ordem topológica", en: "Each node runs in topological order", es: "Cada nodo se ejecuta en orden topológico", zh: "每个节点按拓扑顺序执行" },
  hint2:            { pt: "Outputs viram inputs do próximo",     en: "Outputs become inputs of the next",  es: "Los outputs se convierten en inputs del siguiente", zh: "输出成为下一个的输入" },
  hint3:            { pt: "Resultado aparece aqui",              en: "Result appears here",                es: "El resultado aparece aquí",                          zh: "结果显示在这里" },
  runError:         { pt: "Erro ao rodar",        en: "Run error",         es: "Error al ejecutar",  zh: "运行错误" },
  close:            { pt: "Fechar",               en: "Close",             es: "Cerrar",             zh: "关闭" },
  errors:           { pt: "Erros",                en: "Errors",            es: "Errores",            zh: "错误" },
  noOutput:         { pt: "Nenhum output produzido.", en: "No output produced.", es: "Sin output producido.", zh: "未产生输出。" },
  download:         { pt: "Baixar",               en: "Download",          es: "Descargar",          zh: "下载" },
  // Field labels
  fieldBrand:       { pt: "Marca",                en: "Brand",             es: "Marca",              zh: "品牌" },
  fieldMarket:      { pt: "Mercado",              en: "Market",            es: "Mercado",            zh: "市场" },
  noMarket:         { pt: "(sem mercado)",        en: "(no market)",       es: "(sin mercado)",      zh: "（无市场）" },
  includeDisclaimer:{ pt: "Incluir disclaimer regulatório", en: "Include regulatory disclaimer", es: "Incluir disclaimer regulatorio", zh: "包含监管免责声明" },
  fieldPromptText:  { pt: "Texto do prompt",      en: "Prompt text",       es: "Texto del prompt",   zh: "提示词文本" },
  promptPh:         { pt: "Descreva o criativo…", en: "Describe the creative…", es: "Describe el creativo…", zh: "描述创意..." },
  fieldAspect:      { pt: "Aspect ratio",         en: "Aspect ratio",      es: "Aspect ratio",       zh: "宽高比" },
  fieldQuality:     { pt: "Qualidade",            en: "Quality",           es: "Calidad",            zh: "质量" },
  qDraft:           { pt: "Rascunho",             en: "Draft",             es: "Borrador",           zh: "草稿" },
  qMedium:          { pt: "Médio",                en: "Medium",            es: "Medio",              zh: "中等" },
  qHigh:            { pt: "Alta",                 en: "High",              es: "Alta",               zh: "高" },
  fieldNameTpl:     { pt: "Template do nome",     en: "Name template",     es: "Plantilla de nombre",zh: "名称模板" },
  varsHint:         { pt: "Vars: {brand} {market} {date} {time} {slug}", en: "Vars: {brand} {market} {date} {time} {slug}", es: "Vars: {brand} {market} {date} {time} {slug}", zh: "变量：{brand} {market} {date} {time} {slug}" },
  bgRemoveDesc:     { pt: "Sem configuração — recebe imagem upstream e devolve PNG transparente < 2MB via BRIA AI.",
                      en: "No config — receives upstream image and returns transparent PNG < 2MB via BRIA AI.",
                      es: "Sin configuración — recibe imagen upstream y devuelve PNG transparente < 2MB vía BRIA AI.",
                      zh: "无配置 — 接收上游图像并通过 BRIA AI 返回 < 2MB 的透明 PNG。" },
  fieldScenes:      { pt: "Número de cenas",      en: "Number of scenes",  es: "Número de escenas",  zh: "场景数" },
  fieldVoiceId:     { pt: "Voice ID (ElevenLabs)",en: "Voice ID (ElevenLabs)", es: "Voice ID (ElevenLabs)", zh: "Voice ID (ElevenLabs)" },
  fieldVoiceName:   { pt: "Nome (display)",       en: "Name (display)",    es: "Nombre (display)",   zh: "名称（显示）" },
  voiceDesc:        { pt: "Recebe o texto upstream e gera áudio MP3 via ElevenLabs.", en: "Receives upstream text and generates MP3 audio via ElevenLabs.", es: "Recibe el texto upstream y genera audio MP3 vía ElevenLabs.", zh: "接收上游文本并通过 ElevenLabs 生成 MP3 音频。" },
  fieldVarAxis:     { pt: "Eixo de variação",     en: "Variation axis",    es: "Eje de variación",   zh: "变体轴" },
  fieldVarValues:   { pt: "Valores (1 por linha)",en: "Values (1 per line)", es: "Valores (1 por línea)", zh: "值（每行一个）" },
  variationDesc:    { pt: "Pra cada valor, o subgrafo downstream é clonado e executado em paralelo.",
                      en: "For each value, the downstream subgraph is cloned and run in parallel.",
                      es: "Por cada valor, el subgrafo downstream se clona y ejecuta en paralelo.",
                      zh: "对于每个值，下游子图被克隆并并行运行。" },
  // Video node
  fieldProvider:    { pt: "Provider",             en: "Provider",          es: "Provider",           zh: "提供商" },
  fieldDuration:    { pt: "Duração (segundos)",   en: "Duration (seconds)",es: "Duración (segundos)",zh: "时长（秒）" },
  durationHint:     { pt: "3-15s. Quanto maior, mais cara a gen e maior risco de timeout (~120s budget).",
                      en: "3-15s. Longer = more expensive and higher timeout risk (~120s budget).",
                      es: "3-15s. Más largo = más caro y mayor riesgo de timeout (~120s).",
                      zh: "3-15 秒。越长越贵，超时风险越高（~120 秒预算）。" },
  fieldResolution:  { pt: "Resolução",            en: "Resolution",        es: "Resolución",         zh: "分辨率" },
  fieldMode:        { pt: "Modo",                 en: "Mode",              es: "Modo",               zh: "模式" },
  modeStandard:     { pt: "Standard",             en: "Standard",          es: "Standard",           zh: "标准" },
  modePro:          { pt: "Pro",                  en: "Pro",               es: "Pro",                zh: "专业" },
  audioToggle:      { pt: "Gerar áudio nativo (custo +50%)", en: "Generate native audio (+50% cost)", es: "Generar audio nativo (+50% costo)", zh: "生成原生音频（+50% 费用）" },
  videoCostTitle:   { pt: "Custo (PiAPI Kling 3.0):", en: "Cost (PiAPI Kling 3.0):", es: "Costo (PiAPI Kling 3.0):", zh: "费用 (PiAPI Kling 3.0):" },
  // Workflow brand
  workflowBrand:    { pt: "Marca padrão",         en: "Default brand",     es: "Marca por defecto",  zh: "默认品牌" },
  workflowBrandHint:{ pt: "Define a marca default. Aplicada como contexto base; nodes brand individuais ainda overridem.",
                      en: "Sets the default brand. Applied as base context; individual brand nodes still override.",
                      es: "Define la marca por defecto. Aplicada como contexto base; nodos brand individuales aún sobreescriben.",
                      zh: "设置默认品牌。作为基础上下文应用；单个品牌节点仍可覆盖。" },
  noBrand:          { pt: "Sem marca",            en: "No brand",          es: "Sin marca",          zh: "无品牌" },
  searchBrand:      { pt: "Buscar marca…",        en: "Search brand…",     es: "Buscar marca…",      zh: "搜索品牌..." },
  selectBrand:      { pt: "Selecionar marca",     en: "Select brand",      es: "Seleccionar marca",  zh: "选择品牌" },
  // Count fan-out
  fieldCount:       { pt: "Quantidade",           en: "Quantity",          es: "Cantidad",           zh: "数量" },
  countHint:        { pt: "Gera N imagens em paralelo. Máx 50. Cada imagem é uma row separada na biblioteca.",
                      en: "Generates N images in parallel. Max 50. Each image is a separate row in the library.",
                      es: "Genera N imágenes en paralelo. Máx 50. Cada imagen es una fila separada en la biblioteca.",
                      zh: "并行生成 N 张图像。最多 50 张。每张图像是库中单独的一行。" },
  // Run progress
  runProgress:      { pt: "Progresso",             en: "Progress",          es: "Progreso",           zh: "进度" },
  runCompleted:     { pt: "Concluído",             en: "Completed",         es: "Completado",         zh: "已完成" },
  runFailed:        { pt: "Falha",                 en: "Failed",            es: "Falló",              zh: "失败" },
  runStarting:      { pt: "Iniciando…",            en: "Starting…",         es: "Iniciando…",         zh: "启动中..." },
  nodesDone:        { pt: "nós completos",         en: "nodes done",        es: "nodos completos",    zh: "个节点完成" },
};

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

function ImageGenNode({ data, selected }: { data: { aspect_ratio?: string; quality?: string; count?: number }; selected: boolean }) {
  const count = Number(data.count || 1);
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
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>
        gpt-image-2{count > 1 ? ` · ×${count}` : ""}
      </div>
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

function VideoNode({ data, selected }: {
  data: { duration?: number; aspect_ratio?: string; mode?: string; resolution?: string; enable_audio?: boolean; provider?: string };
  selected: boolean;
}) {
  const dur = data.duration || 5;
  const aspect = data.aspect_ratio || "16:9";
  const res = data.resolution || "720p";
  const mode = data.mode || "std";
  const audio = data.enable_audio ? "+áudio" : "";
  return (
    <NodeShell
      icon={<VideoIcon size={13} />}
      title="Vídeo"
      color="#8B5CF6"
      selected={selected}
      handles={[
        { id: "prompt", type: "target", position: Position.Left },
        { id: "image", type: "target", position: Position.Top },
        { id: "out", type: "source", position: Position.Right },
      ]}
    >
      <div>{dur}s · {aspect} · {res} {audio}</div>
      <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>
        Kling 3.0 {mode} · {data.provider || "piapi"}
      </div>
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
  video: VideoNode,
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

/**
 * Estima total de nós que vão rodar após server expandir count + variation.
 * Usado pra mostrar barra de progresso (server retorna `total` real depois,
 * mas client mostra estimate enquanto espera resposta do execute-workflow).
 *
 * Cálculo: cada image-gen com count > 1 multiplica o subgraph downstream.
 * Variation com N values multiplica o subgraph downstream também.
 * Aproximação: total ≈ nodes_count + (count-1) × downstream_size por image-gen
 *               + (values-1) × downstream_size por variation
 */
function estimateNodeCountAfterExpansion(graph: WfGraph): number {
  // Contagem básica + multiplicador heurístico
  let total = graph.nodes.length;
  for (const n of graph.nodes) {
    if (n.type === "image-gen") {
      const count = Math.max(1, Math.min(50, Number(n.data.count) || 1));
      if (count > 1) {
        // Adiciona (count-1) × tamanho do subgraph downstream
        const downstreamCount = countDownstream(graph, n.id);
        total += (count - 1) * (1 + downstreamCount); // +1 pelo próprio image-gen clonado
      }
    } else if (n.type === "variation") {
      const values = Array.isArray(n.data.values) ? (n.data.values as string[]).length : 0;
      if (values > 1) {
        const downstreamCount = countDownstream(graph, n.id);
        total += (values - 1) * downstreamCount;
      }
    }
  }
  return total;
}

function countDownstream(graph: WfGraph, fromId: string): number {
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      if (e.source === cur && !visited.has(e.target)) {
        visited.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return visited.size - 1; // exclui o nó-fonte
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
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);
  const isMobile = useIsMobile();

  // userId pra disparar notificações no sino. Carregado uma vez.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) setUserId(user?.id || null);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Ref pra ID da notificação ativa (do run em andamento). Cada run cria
  // uma nova; updates apontam pra essa. Usar ref evita re-render quando muda.
  const currentRunNotifId = useRef<string | null>(null);

  // Mobile: sidebar esquerda (templates/lista) e painel direito (config nó)
  // viram overlays — escondidos por padrão, abertos via toggle/seleção.
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);

  // Sidebar state — listagens não têm graph (otimização: só carrega quando
  // user abre um workflow específico via getWorkflow).
  const [templates, setTemplates] = useState<WorkflowSummary[]>([]);
  const [myWorkflows, setMyWorkflows] = useState<WorkflowSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  // Anti-duplicação: enquanto está abrindo um workflow, ignora outros
  // clicks. Antes, durante DB timeout, cada click criava cópia parcial
  // — daí "5 Promo de jogo" duplicados na sidebar.
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  // Active workflow
  const [activeWf, setActiveWf] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // Brand level workflow — persiste em hub_workflows.brand_id, aplica como
  // contexto default pra TODOS os nós que aceitam brand (image-gen,
  // storyboard, video). Nodes brand individuais ainda overridem.
  const [workflowBrandId, setWorkflowBrandId] = useState<string>("none");
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const workflowBrand = useMemo(() => getBrand(workflowBrandId), [workflowBrandId]);

  // Run state
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    outputs?: Record<string, { image_url?: string; audio_url?: string; video_url?: string; name?: string }>;
    errors?: Record<string, string>;
    status?: string;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // Progress: nodes_done / total_expected. total é estimado client-side
  // (graph atual antes da expansão do server, mas com count contado).
  const [runProgress, setRunProgress] = useState<{
    done: number; failed: number; total: number; status: string;
  } | null>(null);

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

  // Quando um workflow é aberto (activeWf muda), checa se tem run em
  // andamento persistido em localStorage. Se sim, retoma polling sem
  // criar nova run. Servidor processa em background mesmo se a aba
  // foi fechada — esse hook só re-conecta a UI ao status do server.
  useEffect(() => {
    if (!activeWf || running) return;
    const saved = readActiveRun(activeWf.id);
    if (!saved) return;
    // Restora UI: mostra "running" e poll continua de onde parou
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setRunProgress({ done: 0, failed: 0, total: saved.total, status: "running" });
    (async () => {
      try {
        await pollAndApplyResult(saved.runId, saved.total);
      } catch (e) {
        console.error("[hub-workflows] restore run failed:", e);
        clearActiveRun(activeWf.id);
      } finally {
        setRunning(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWf?.id]);

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

  const openWorkflow = async (wf: WorkflowSummary) => {
    // Anti-duplicação: se já tá abrindo (qualquer item), ignora. Evita
    // que clicks repetidos durante DB lento criem múltiplas cópias.
    if (openingId) return;
    setOpeningId(wf.id);
    // Fecha o drawer mobile quando user abre um workflow
    if (isMobile) setMobileLeftOpen(false);
    try {
      // Listagens trazem só metadados (sem graph). Sempre busca o full
      // aqui — pra template clona e pra próprio busca direto.
      let toLoad: Workflow;
      if (wf.is_template) {
        toLoad = await cloneWorkflow(wf.id, wf.name);
        const mine = await listMyWorkflows();
        setMyWorkflows(mine);
      } else {
        const fresh = await getWorkflow(wf.id);
        if (!fresh) throw new Error("workflow não encontrado");
        toLoad = fresh;
      }
      const { nodes: rfNodes, edges: rfEdges } = graphToRf(toLoad.graph);
      setActiveWf(toLoad);
      setNodes(rfNodes);
      setEdges(rfEdges);
      setName(toLoad.name);
      setWorkflowBrandId(toLoad.brand_id || "none");
      setSelectedNodeId(null);
      setRunResult(null);
      setRunError(null);
    } catch (e) {
      const msg = (e as Error).message || "erro desconhecido";
      // Mensagem amigável pra timeout do DB (caso comum quando Supabase
      // tá sob pressão). Outros erros mostra mensagem raw.
      const friendly = msg.includes("statement timeout")
        ? "Banco de dados lento agora. Tenta de novo em 10s."
        : msg.includes("upstream")
        ? "Servidor demorou pra responder. Tenta de novo."
        : `Erro ao abrir: ${msg}`;
      toast.error(friendly);
    } finally {
      setOpeningId(null);
    }
  };

  const newBlankWorkflow = async () => {
    if (creatingNew || openingId) return;
    setCreatingNew(true);
    try {
      const wf = await createWorkflow({
        name: t("newWorkflow"),
        graph: { version: 1, nodes: [], edges: [] },
      });
      const mine = await listMyWorkflows();
      setMyWorkflows(mine);
      await openWorkflow(wf);
    } catch (e) {
      const msg = (e as Error).message || "erro";
      toast.error(msg.includes("timeout")
        ? "Banco lento. Tenta de novo em 10s."
        : `Erro: ${msg}`);
    } finally {
      setCreatingNew(false);
    }
  };

  const saveActive = async () => {
    if (!activeWf) return;
    try {
      const graph = rfToGraph(nodes, edges);
      await updateWorkflowGraph(activeWf.id, graph, name, workflowBrandId === "none" ? null : workflowBrandId);
      const mine = await listMyWorkflows();
      setMyWorkflows(mine);
      toast.success("Salvo");
    } catch (e) {
      const msg = (e as Error).message || "erro";
      toast.error(msg.includes("timeout")
        ? "Banco lento, tenta de novo em 10s."
        : `Erro ao salvar: ${msg}`);
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
      toast.success("Deletado");
    } catch (e) {
      toast.error(`Erro ao deletar: ${(e as Error).message}`);
    }
  };

  // Persistência da run: salva run_id+total em localStorage por workflow.
  // Server processa em background (EdgeRuntime.waitUntil) — sai/volta na
  // aba, run continua. Ao abrir o workflow de novo, retomamos o polling.
  const runStorageKey = (workflowId: string) => `hub_active_run_${workflowId}`;
  const saveActiveRun = (workflowId: string, runId: string, total: number) => {
    try {
      localStorage.setItem(runStorageKey(workflowId), JSON.stringify({ runId, total, ts: Date.now() }));
    } catch { /* quota? ignore */ }
  };
  const clearActiveRun = (workflowId: string) => {
    try { localStorage.removeItem(runStorageKey(workflowId)); } catch { /* ignore */ }
  };
  const readActiveRun = (workflowId: string): { runId: string; total: number; ts: number } | null => {
    try {
      const raw = localStorage.getItem(runStorageKey(workflowId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Expiração de segurança: se foi salvo há mais de 30min, descarta
      // (run que estourou wall-clock do edge function nunca completa).
      if (Date.now() - (parsed.ts || 0) > 30 * 60 * 1000) {
        localStorage.removeItem(runStorageKey(workflowId));
        return null;
      }
      return parsed;
    } catch { return null; }
  };

  /**
   * Pola um run existente até completar. Atualiza UI conforme progresso.
   * Usado tanto por runActive (após criar) quanto por restoreRun (ao
   * voltar pra aba e detectar run pendente).
   */
  const pollAndApplyResult = async (runId: string, total: number) => {
    setRunProgress({ done: 0, failed: 0, total, status: "pending" });
    const finalSnap = await pollWorkflowRun(runId, (snap) => {
      setRunProgress({
        done: snap.nodes_done,
        failed: snap.nodes_failed,
        total,
        status: snap.status,
      });
      // Atualiza notificação live com progresso N/M (sino mostra a barra)
      if (currentRunNotifId.current && userId) {
        updateHubNotification(userId, currentRunNotifId.current, {
          progress: { done: snap.nodes_done, total, failed: snap.nodes_failed },
        });
      }
    });
    if (!finalSnap) {
      // Run sumiu do servidor (foi limpa, expirou, ou nunca existiu —
      // stale localStorage). Limpa pra não tentar de novo no próximo
      // mount, libera a UI, e mostra erro claro.
      if (activeWf?.id) clearActiveRun(activeWf.id);
      setRunError("Run não encontrado — possivelmente foi limpo do servidor. Tenta rodar de novo.");
      setRunProgress(null);
      // Marca notif como falha
      if (currentRunNotifId.current && userId) {
        updateHubNotification(userId, currentRunNotifId.current, {
          kind: "workflow_failed",
          title: "Workflow falhou",
          description: "Run não encontrado no servidor.",
          progress: undefined,
        });
        currentRunNotifId.current = null;
      }
      return;
    }
    setRunResult({
      outputs: finalSnap.outputs as Record<string, { image_url?: string; audio_url?: string; video_url?: string; name?: string }>,
      errors: finalSnap.errors || undefined,
      status: finalSnap.status,
    });
    if (activeWf?.id && ["succeeded", "partial", "failed"].includes(finalSnap.status)) {
      clearActiveRun(activeWf.id);
    }
    // Finaliza notificação com resumo do resultado
    if (currentRunNotifId.current && userId) {
      const isSuccess = finalSnap.status === "succeeded";
      const isPartial = finalSnap.status === "partial";
      const failedCount = finalSnap.nodes_failed;
      const doneCount = finalSnap.nodes_done;
      const wfName = activeWf?.name || "Workflow";
      let title = "Workflow concluído";
      let description = `${doneCount} de ${total} itens gerados`;
      let kind: "workflow_done" | "workflow_failed" = "workflow_done";
      if (!isSuccess) {
        if (isPartial) {
          title = "Workflow parcialmente concluído";
          description = `${doneCount} ok, ${failedCount} falharam`;
        } else {
          title = "Workflow falhou";
          description = `${failedCount} de ${total} falharam`;
          kind = "workflow_failed";
        }
      } else {
        description = `${wfName}: ${doneCount} itens prontos na biblioteca`;
      }
      updateHubNotification(userId, currentRunNotifId.current, {
        kind, title, description,
        href: "/dashboard/hub/library",
        progress: undefined,
      });
      currentRunNotifId.current = null;
    }
  };

  const runActive = async () => {
    if (!activeWf || running) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    setRunProgress(null);
    try {
      const graph = rfToGraph(nodes, edges);
      await updateWorkflowGraph(activeWf.id, graph, name, workflowBrandId === "none" ? null : workflowBrandId);

      const totalEstimate = estimateNodeCountAfterExpansion(graph);
      setRunProgress({ done: 0, failed: 0, total: totalEstimate, status: "pending" });

      const r = await runWorkflow({ workflow_id: activeWf.id, graph });
      if (!r.ok || !r.run_id) {
        setRunError(r.message || "Falha ao iniciar workflow");
        setRunning(false);
        setRunProgress(null);
        return;
      }
      const total = (r.total ?? totalEstimate) || 1;
      // Persiste run_id pra retomar caso user feche aba/saia da página
      saveActiveRun(activeWf.id, r.run_id, total);
      // Cria notificação no sino com progress 0/total. updateHubNotification
      // dentro de pollAndApplyResult vai atualizar conforme avança.
      if (userId) {
        const wfName = activeWf.name || "Workflow";
        const notifId = addHubNotification(userId, {
          kind: "workflow_running",
          title: `Rodando ${wfName}`,
          description: `Gerando ${total} ${total === 1 ? "item" : "itens"}…`,
          progress: { done: 0, total, failed: 0 },
          href: "/dashboard/hub/workflows",
        });
        currentRunNotifId.current = notifId;
      }
      await pollAndApplyResult(r.run_id, total);
    } catch (e) {
      setRunError(String(e).slice(0, 200));
      // Marca notif como falha se já tinha sido criada
      if (currentRunNotifId.current && userId) {
        updateHubNotification(userId, currentRunNotifId.current, {
          kind: "workflow_failed",
          title: "Workflow falhou",
          description: String(e).slice(0, 100),
          progress: undefined,
        });
        currentRunNotifId.current = null;
      }
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
      "image-gen": { aspect_ratio: "1:1", quality: "medium", count: 1 },
      "bg-remove": {},
      storyboard: { scene_count: 4, aspect_ratio: "9:16", quality: "medium" },
      video: { duration: 5, aspect_ratio: "16:9", mode: "std", resolution: "720p", enable_audio: false, provider: "piapi" },
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
        display: "flex", alignItems: "center", gap: isMobile ? 6 : 10,
        padding: isMobile ? "8px 10px" : "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#0a0b10",
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        <button onClick={() => navigate("/dashboard/hub")} style={iconBtn}>
          <ArrowLeft size={14} />
        </button>
        {isMobile && (
          <button
            onClick={() => setMobileLeftOpen(true)}
            style={iconBtn}
            aria-label={t("templates")}
            title={t("templates")}
          >
            <Menu size={14} />
          </button>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("workflows")}</div>
        <div style={{ flex: 1 }} />
        {activeWf && (
          <>
            {/* Em mobile o input de nome só aparece após estourar pra
                segunda linha do flexWrap pra não comer espaço dos botões. */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("workflowName")}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, padding: "6px 10px",
                color: "#fff", fontSize: 12,
                width: isMobile ? "100%" : 200,
                order: isMobile ? 10 : 0,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {/* Brand selector — fica salvo em hub_workflows.brand_id.
                Aparece como chip clicável; abre modal pra trocar. */}
            <button
              onClick={() => setBrandModalOpen(true)}
              title={t("workflowBrandHint")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: isMobile ? "6px 8px" : "6px 10px",
                background: workflowBrand && workflowBrand.id !== "none" ? "rgba(234,179,8,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${workflowBrand && workflowBrand.id !== "none" ? "rgba(234,179,8,0.30)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 6,
                color: workflowBrand && workflowBrand.id !== "none" ? "#FACC15" : "rgba(255,255,255,0.55)",
                fontSize: 11.5, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                maxWidth: isMobile ? 130 : "none",
                overflow: "hidden",
              }}
            >
              <Tag size={11} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {workflowBrand && workflowBrand.id !== "none" ? workflowBrand.name : t("noBrand")}
              </span>
              <ChevronDown size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
            </button>
            <button onClick={saveActive} style={btnSecondary} title={t("save")}>
              <Save size={13} /> {!isMobile && t("save")}
            </button>
            <button onClick={runActive} disabled={running} style={btnPrimary} title={t("run")}>
              {running ? <Loader size={13} className="spin" /> : <Play size={13} />}
              {!isMobile && (running ? t("running") : t("run"))}
            </button>
            <button onClick={deleteActive} style={iconBtn} title={t("delete")}>
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {/* Backdrop pra fechar sidebar no mobile (clicando fora) */}
        {isMobile && mobileLeftOpen && (
          <div
            onClick={() => setMobileLeftOpen(false)}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(2px)",
              zIndex: 20,
            }}
          />
        )}
        {/* Sidebar esquerda — desktop: coluna fixa, mobile: overlay drawer */}
        <div style={{
          width: isMobile ? "min(280px, 80vw)" : 220,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "#08090e",
          padding: "12px 10px",
          overflowY: "auto",
          ...(isMobile ? {
            position: "absolute",
            top: 0, bottom: 0, left: 0,
            zIndex: 21,
            transform: mobileLeftOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.2s ease-out",
            boxShadow: mobileLeftOpen ? "0 0 24px rgba(0,0,0,0.5)" : "none",
          } : {}),
        }}>
          <button onClick={newBlankWorkflow} style={{
            ...btnSecondary,
            width: "100%", justifyContent: "center", marginBottom: 14,
          }}>
            <Plus size={13} /> {t("newWorkflow")}
          </button>

          <div style={sidebarLabel}>{t("templates")}</div>
          {loadingList ? (
            <div style={sidebarHint}>{t("loading")}</div>
          ) : templates.length === 0 ? (
            <div style={sidebarHint}>{t("noTemplate")}</div>
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

          <div style={{ ...sidebarLabel, marginTop: 18 }}>{t("myWorkflows")}</div>
          {myWorkflows.length === 0 ? (
            <div style={sidebarHint}>{t("noMyWf")}</div>
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
              <div style={{ ...sidebarLabel, marginTop: 18 }}>{t("addNode")}</div>
              <button onClick={() => addNodeOfType("brand")} style={paletteBtn("#EAB308")}>
                <Tag size={11} /> {t("brand")}
              </button>
              <button onClick={() => addNodeOfType("prompt")} style={paletteBtn("#60A5FA")}>
                <Type size={11} /> {t("prompt")}
              </button>
              <button onClick={() => addNodeOfType("image-gen")} style={paletteBtn("#3B82F6")}>
                <ImageIcon size={11} /> {t("imageGen")}
              </button>
              <button onClick={() => addNodeOfType("bg-remove")} style={paletteBtn("#A855F7")}>
                <Scissors size={11} /> {t("bgRemove")}
              </button>
              <button onClick={() => addNodeOfType("storyboard")} style={paletteBtn("#F97316")}>
                <Clapperboard size={11} /> {t("storyboard")}
              </button>
              <button onClick={() => addNodeOfType("video")} style={paletteBtn("#8B5CF6")}>
                <VideoIcon size={11} /> {t("videoNode")}
              </button>
              <button onClick={() => addNodeOfType("voice")} style={paletteBtn("#06B6D4")}>
                <Mic size={11} /> {t("voice")}
              </button>
              <button onClick={() => addNodeOfType("variation")} style={paletteBtn("#EC4899")}>
                <GitBranch size={11} /> {t("variation")}
              </button>
              <button onClick={() => addNodeOfType("output")} style={paletteBtn("#10B981")}>
                <Download size={11} /> {t("saveNode")}
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
                {t("emptyTitle")}
              </div>
              <div style={{ fontSize: 11.5 }}>
                {t("emptyHint")}
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

        {/* Right panel — node config OR run result.
            Mobile: bottom sheet que só aparece quando há conteúdo
            (node selecionado, run em progresso, resultado ou erro).
            Desktop: coluna fixa sempre visível. */}
        {(() => {
          const hasContent = !!(selectedNodeId || runResult || (running && runProgress) || runError);
          if (isMobile && !hasContent) return null;
          return (
        <div style={{
          width: isMobile ? "100%" : 280,
          flexShrink: 0,
          borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
          borderTop: isMobile ? "1px solid rgba(255,255,255,0.10)" : "none",
          background: "#08090e",
          padding: "12px 14px",
          overflowY: "auto",
          ...(isMobile ? {
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            maxHeight: "55vh",
            zIndex: 15,
            boxShadow: "0 -4px 16px rgba(0,0,0,0.45)",
            borderRadius: "12px 12px 0 0",
          } : {}),
        }}>
          {/* Botão fechar (drag handle visual) só no mobile */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: "rgba(255,255,255,0.20)",
                margin: "0 auto",
              }} />
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setRunResult(null);
                  setRunProgress(null);
                  setRunError(null);
                }}
                style={{ ...iconBtn, position: "absolute", top: 10, right: 10 }}
                aria-label={t("close")}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {runResult ? (
            <RunResultPanel result={runResult} onClose={() => { setRunResult(null); setRunProgress(null); }} t={t} />
          ) : running && runProgress ? (
            <RunProgressPanel progress={runProgress} t={t} />
          ) : runError ? (
            <div style={{ fontSize: 12, color: "#F87171" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("runError")}</div>
              <div style={{ background: "rgba(248,113,113,0.10)", padding: 10, borderRadius: 8 }}>{runError}</div>
              <button onClick={() => setRunError(null)} style={{ ...btnSecondary, marginTop: 10 }}>{t("close")}</button>
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
              t={t}
              lang={lang}
            />
          ) : activeWf ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}>
              <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>{activeWf.name}</div>
              <div>{t("selectNodeHint")}</div>
              <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.5 }}>
                <div style={{ color: "rgba(255,255,255,0.40)", marginBottom: 4 }}>{t("whenRun")}</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>{t("hint1")}</li>
                  <li>{t("hint2")}</li>
                  <li>{t("hint3")}</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
          );
        })()}
      </div>

      {/* Brand modal — usado pra setar workflow.brand_id (default level) */}
      {brandModalOpen && (
        <div onClick={() => setBrandModalOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
            maxWidth: 480, width: "100%", maxHeight: "80vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>{t("workflowBrand")}</h3>
              <button onClick={() => setBrandModalOpen(false)} style={iconBtn}>
                <X size={12} />
              </button>
            </div>
            <div style={{ padding: "10px 16px 4px", fontSize: 11, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>
              {t("workflowBrandHint")}
            </div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.40)" }} />
                <input
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  placeholder={t("searchBrand")}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 8,
                    color: "#fff", fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <button
                onClick={() => { setWorkflowBrandId("none"); setBrandModalOpen(false); }}
                style={{
                  padding: 12,
                  background: workflowBrandId === "none" ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${workflowBrandId === "none" ? "#EAB308" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{t("noBrand")}</div>
              </button>
              {Object.values(HUB_BRANDS)
                .filter(b => b.id !== "none")
                .filter(b => !brandSearch.trim() || b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                .map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setWorkflowBrandId(b.id); setBrandModalOpen(false); }}
                    style={{
                      padding: 12,
                      background: workflowBrandId === b.id ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${workflowBrandId === b.id ? "#EAB308" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{b.name}</div>
                    {b.markets && b.markets.length > 0 && (
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                        {b.markets.map(m => HUB_MARKETS[m]?.flag).join(" ")}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

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
  node, onUpdate, onDelete, t, lang,
}: {
  node: Node;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  t: (key: keyof typeof STR) => string;
  lang: Lang;
}) {
  const data = node.data as Record<string, unknown>;
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(255,255,255,0.50)" }}>
          {nodeLabel(node.type || "", t)}
        </div>
        <button onClick={onDelete} style={iconBtn} title={t("delete")}>
          <Trash2 size={11} />
        </button>
      </div>

      {node.type === "brand" && (
        <>
          <FieldLabel>{t("fieldBrand")}</FieldLabel>
          <select
            value={(data.brand_id as string) || "none"}
            onChange={e => onUpdate({ brand_id: e.target.value })}
            style={selectStyle}
          >
            {Object.values(HUB_BRANDS).map(b => (
              <option key={b.id} value={b.id} style={{ background: "#0d0d14" }}>{b.name}</option>
            ))}
          </select>
          <FieldLabel>{t("fieldMarket")}</FieldLabel>
          <select
            value={(data.market as string) || ""}
            onChange={e => onUpdate({ market: e.target.value })}
            style={selectStyle}
          >
            <option value="" style={{ background: "#0d0d14" }}>{t("noMarket")}</option>
            {Object.values(HUB_MARKETS).map(m => (
              <option key={m.code} value={m.code} style={{ background: "#0d0d14" }}>
                {m.flag} {m.labels[lang] || m.labels.pt}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!data.include_disclaimer}
              onChange={e => onUpdate({ include_disclaimer: e.target.checked })}
            />
            {t("includeDisclaimer")}
          </label>
        </>
      )}

      {node.type === "prompt" && (
        <>
          <FieldLabel>{t("fieldPromptText")}</FieldLabel>
          <textarea
            value={(data.text as string) || ""}
            onChange={e => onUpdate({ text: e.target.value })}
            rows={6}
            placeholder={t("promptPh")}
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
          <FieldLabel>{t("fieldCount")}</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <input
              type="range"
              min={1}
              max={50}
              value={Number(data.count || 1)}
              onChange={e => onUpdate({ count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
              style={{ flex: 1, accentColor: "#3B82F6" }}
            />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6", minWidth: 32, textAlign: "right" }}>
              {Number(data.count || 1)}
            </span>
          </div>
          <div style={{ marginTop: 0, marginBottom: 10, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            {t("countHint")}
          </div>
          <FieldLabel>{t("fieldAspect")}</FieldLabel>
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
          <FieldLabel>{t("fieldQuality")}</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: "low", l: t("qDraft") },
              { v: "medium", l: t("qMedium") },
              { v: "high", l: t("qHigh") },
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
          <FieldLabel>{t("fieldNameTpl")}</FieldLabel>
          <input
            value={(data.name_template as string) || "{date}_{slug}"}
            onChange={e => onUpdate({ name_template: e.target.value })}
            style={selectStyle}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            {t("varsHint")}
          </div>
        </>
      )}

      {node.type === "bg-remove" && (
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          {t("bgRemoveDesc")}
        </div>
      )}

      {node.type === "storyboard" && (
        <>
          <FieldLabel>{t("fieldScenes")}</FieldLabel>
          <input
            type="number"
            min={2}
            max={8}
            value={Number(data.scene_count || 4)}
            onChange={e => onUpdate({ scene_count: Math.max(2, Math.min(8, Number(e.target.value) || 4)) })}
            style={selectStyle}
          />
          <FieldLabel>{t("fieldAspect")}</FieldLabel>
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
          <FieldLabel>{t("fieldQuality")}</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: "low", l: t("qDraft") },
              { v: "medium", l: t("qMedium") },
              { v: "high", l: t("qHigh") },
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

      {node.type === "video" && (
        <>
          <FieldLabel>{t("fieldProvider")}</FieldLabel>
          <select
            value={(data.provider as string) || "piapi"}
            onChange={e => onUpdate({ provider: e.target.value })}
            style={selectStyle}
          >
            <option value="piapi" style={{ background: "#0d0d14" }}>PiAPI (default)</option>
            <option value="falai" style={{ background: "#0d0d14" }}>fal.ai (em breve)</option>
          </select>
          <FieldLabel>{t("fieldDuration")}</FieldLabel>
          <input
            type="number"
            min={3}
            max={15}
            value={Number(data.duration || 5)}
            onChange={e => onUpdate({ duration: Math.max(3, Math.min(15, Number(e.target.value) || 5)) })}
            style={selectStyle}
          />
          <div style={{ marginTop: 2, fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>
            {t("durationHint")}
          </div>
          <FieldLabel>{t("fieldAspect")}</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["16:9", "9:16", "1:1"].map(ar => (
              <button
                key={ar}
                onClick={() => onUpdate({ aspect_ratio: ar })}
                style={pillStyle(data.aspect_ratio === ar)}
              >
                {ar}
              </button>
            ))}
          </div>
          <FieldLabel>{t("fieldResolution")}</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[
              { v: "720p", l: "720p" },
              { v: "1080p", l: "1080p" },
            ].map(r => (
              <button
                key={r.v}
                onClick={() => onUpdate({ resolution: r.v })}
                style={pillStyle(data.resolution === r.v)}
              >
                {r.l}
              </button>
            ))}
          </div>
          <FieldLabel>{t("fieldMode")}</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[
              { v: "std", l: t("modeStandard") },
              { v: "pro", l: t("modePro") },
            ].map(m => (
              <button
                key={m.v}
                onClick={() => onUpdate({ mode: m.v })}
                style={pillStyle(data.mode === m.v)}
              >
                {m.l}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!data.enable_audio}
              onChange={e => onUpdate({ enable_audio: e.target.checked })}
            />
            {t("audioToggle")}
          </label>
          <div style={{ marginTop: 10, padding: 8, background: "rgba(139,92,246,0.10)", borderRadius: 6, fontSize: 10.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            <strong style={{ color: "#A78BFA" }}>{t("videoCostTitle")}</strong><br/>
            720p sem áudio: $0.10/s · 720p com áudio: $0.15/s<br/>
            1080p sem áudio: $0.15/s · 1080p com áudio: $0.20/s
          </div>
        </>
      )}

      {node.type === "voice" && (
        <>
          <FieldLabel>{t("fieldVoiceId")}</FieldLabel>
          <input
            value={(data.voice_id as string) || ""}
            onChange={e => onUpdate({ voice_id: e.target.value })}
            placeholder="21m00Tcm4TlvDq8ikWAM (Rachel)"
            style={selectStyle}
          />
          <FieldLabel>{t("fieldVoiceName")}</FieldLabel>
          <input
            value={(data.voice_name as string) || ""}
            onChange={e => onUpdate({ voice_name: e.target.value })}
            placeholder="Rachel"
            style={selectStyle}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            {t("voiceDesc")}
          </div>
        </>
      )}

      {node.type === "variation" && (
        <>
          <FieldLabel>{t("fieldVarAxis")}</FieldLabel>
          <select
            value={(data.axis as string) || "aspect_ratio"}
            onChange={e => onUpdate({ axis: e.target.value })}
            style={selectStyle}
          >
            <option value="aspect_ratio" style={{ background: "#0d0d14" }}>Aspect ratio</option>
          </select>
          <FieldLabel>{t("fieldVarValues")}</FieldLabel>
          <textarea
            value={(data.values as string[] || []).join("\n")}
            onChange={e => onUpdate({ values: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
            rows={4}
            placeholder="1:1&#10;9:16&#10;16:9"
            style={{ ...selectStyle, fontFamily: "inherit", resize: "vertical", minHeight: 80 }}
          />
          <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
            {t("variationDesc")}
          </div>
        </>
      )}
    </div>
  );
}

// ── Run progress panel ─────────────────────────────────────────────
// Mostrado enquanto run está em pending/running. Atualiza com snapshot
// de cada poll (a cada ~2.5s).
function RunProgressPanel({
  progress, t,
}: {
  progress: { done: number; failed: number; total: number; status: string };
  t: (key: keyof typeof STR) => string;
}) {
  const { done, failed, total, status } = progress;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isStarting = status === "pending";
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Loader size={13} className="spin" style={{ color: "#3B82F6" }} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#3B82F6" }}>
          {isStarting ? t("runStarting") : t("runProgress")}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, borderRadius: 4,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        marginBottom: 8,
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
          transition: "width 0.4s ease",
          borderRadius: 4,
        }} />
      </div>

      {/* Counter */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>{done} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.50)" }}>
        {done} {t("nodesDone")}{failed > 0 ? ` · ${failed} ${t("runFailed").toLowerCase()}` : ""}
      </div>

      <div style={{ marginTop: 14, padding: 10, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.20)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
        Pode minimizar essa aba — execução continua em background. Resultado aparece aqui quando terminar.
      </div>
    </div>
  );
}

// ── Run result panel ───────────────────────────────────────────────
function RunResultPanel({
  result, onClose, t,
}: {
  result: { outputs?: Record<string, { image_url?: string; audio_url?: string; video_url?: string; name?: string }>; errors?: Record<string, string>; status?: string };
  onClose: () => void;
  t: (key: keyof typeof STR) => string;
}) {
  const outputs = result.outputs || {};
  const errors = result.errors || {};
  // Coleta assets visíveis: imagens, áudios, vídeos (qualquer nó que retornou um deles)
  const finalAssets = Object.entries(outputs)
    .filter(([_, v]) => {
      if (!v || typeof v !== "object") return false;
      const obj = v as { image_url?: string; audio_url?: string; video_url?: string };
      return !!(obj.image_url || obj.audio_url || obj.video_url);
    })
    .map(([id, v]) => ({ id, ...(v as { image_url?: string; audio_url?: string; video_url?: string; name?: string }) }));

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
        finalAssets.map(a => {
          const url = a.video_url || a.image_url || a.audio_url;
          const ext = a.video_url ? "mp4" : a.image_url ? "png" : "mp3";
          return (
            <div key={a.id} style={{ marginBottom: 12 }}>
              {a.video_url && (
                <video
                  src={a.video_url}
                  controls
                  style={{
                    width: "100%", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "#000",
                  }}
                />
              )}
              {a.image_url && !a.video_url && (
                <img src={a.image_url} alt={a.name || "image"}
                  loading="lazy" decoding="async"
                  style={{
                    width: "100%", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.10)",
                  }} />
              )}
              {a.audio_url && !a.video_url && !a.image_url && (
                <audio src={a.audio_url} controls style={{ width: "100%", marginTop: 4 }} />
              )}
              <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{a.name || a.id}</div>
              {url && (
                <a
                  href={url}
                  download={`${a.name || a.id}.${ext}`}
                  style={{
                    ...btnSecondary,
                    marginTop: 6, justifyContent: "center", textDecoration: "none",
                  }}
                >
                  <Download size={11} /> Baixar
                </a>
              )}
            </div>
          );
        })
      ) : (
        <div style={{ color: "rgba(255,255,255,0.50)" }}>{t("noOutput")}</div>
      )}

      {Object.keys(errors).length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(248,113,113,0.10)", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: "#F87171", marginBottom: 4 }}>{t("errors")}</div>
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

function nodeLabel(type: string, t: (k: keyof typeof STR) => string): string {
  switch (type) {
    case "brand":     return t("brand");
    case "prompt":    return t("prompt");
    case "image-gen": return t("imageGen");
    case "bg-remove": return t("bgRemove");
    case "storyboard":return t("storyboard");
    case "video":     return t("videoNode");
    case "voice":     return t("voice");
    case "variation": return t("variation");
    case "output":    return t("saveNode");
    default: return type;
  }
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
