// Valida os grafos que as receitas produzem contra as MESMAS regras do
// validateGraph do HubWorkflows, para não descobrir isso em produção.
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// transpila os dois módulos com esbuild para ESM puro
execSync(`npx esbuild src/lib/workflowRecipes.ts --bundle --format=esm --outfile=/tmp/recipes.mjs --external:react --log-level=error`, { cwd: "/tmp/fiq" });
const { RECIPES } = await import("/tmp/recipes.mjs");

function validate(graph) {
  const nodes = graph.nodes;
  if (!nodes.length) return "vazio";
  const byId = new Map(nodes.map(n => [n.id, n]));
  const incoming = {};
  for (const e of graph.edges) (incoming[e.target] ||= []).push(e.source);

  if (!nodes.some(n => ["image-gen","video","voice","storyboard","bg-remove","output"].includes(n.type)))
    return "sem gerador";

  for (const n of nodes) {
    if (n.type === "image-gen") {
      const own = (n.data?.prompt || "").trim();
      const up = (incoming[n.id]||[]).some(s => ["prompt","variation","image-gen"].includes(byId.get(s)?.type));
      if (!own && !up) return `image-gen ${n.id} sem prompt`;
    }
    if (n.type === "video") {
      if (!(n.data?.prompt||"").trim() && !(incoming[n.id]||[]).length) return `video ${n.id} sem origem`;
    }
    if (n.type === "voice") {
      if (!(n.data?.text||"").trim() && !(incoming[n.id]||[]).length) return `voice ${n.id} sem texto`;
    }
    if (["bg-remove","storyboard","output"].includes(n.type)) {
      if (!(incoming[n.id]||[]).length) return `${n.type} ${n.id} desconectado`;
    }
  }
  for (const e of graph.edges) {
    if (!byId.has(e.source)) return `aresta com source fantasma: ${e.source}`;
    if (!byId.has(e.target)) return `aresta com target fantasma: ${e.target}`;
  }

  // Handles que CADA handler do executor realmente lê. Aresta que chega num
  // handle fora desta lista some em inputs.default e o nó morre em runtime.
  const READS = {
    "image-gen":  ["prompt", "brand", "reference", "elements"],
    "bg-remove":  ["image"],
    "storyboard": ["prompt", "brand"],
    "video":      ["prompt", "brand", "image"],
    "voice":      ["text"],
    "output":     ["asset"],
    "variation":  ["in", "default"],
  };
  for (const e of graph.edges) {
    const t = byId.get(e.target);
    const allowed = READS[t.type];
    if (!allowed) continue;
    if (!e.targetHandle) return `aresta ${e.source}->${e.target} (${t.type}) sem targetHandle: cai em inputs.default`;
    if (!allowed.includes(e.targetHandle))
      return `aresta ${e.source}->${e.target}: handle "${e.targetHandle}" nao e lido por ${t.type} (le: ${allowed.join(", ")})`;
  }

  // Todo nó gerador precisa terminar em algum output, senão gera e joga fora.
  const hasOut = nodes.some(n => n.type === "output");
  if (!hasOut) return "nada conectado a um output: gera e descarta";

  // collectNodeInputs agrupa arestas do mesmo handle num ARRAY. execOutput
  // faz asset?.image_url direto — em cima de array isso e undefined.
  const perHandle = {};
  for (const e of graph.edges) {
    const k = `${e.target}|${e.targetHandle}`;
    perHandle[k] = (perHandle[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(perHandle)) {
    const [tid, h] = k.split("|");
    const t = byId.get(tid);
    if (n > 1 && t.type === "output" && h === "asset")
      return `${n} arestas no handle asset de ${tid}: vira array e execOutput quebra`;
  }

  return null;
}

const answers = {
  "criativos-teste":     { brand_id:"", offer:"Curso de ingles", audience:"profissionais", aspect_ratio:"9:16", count:"4" },
  "anuncio-video":       { brand_id:"", offer:"Curso de ingles", audience:"profissionais", script:"" },
  "variacoes-headline":  { brand_id:"", offer:"Curso", aspect_ratio:"1:1", headlines:"A\nB\nC" },
  "storyboard-roteiro":  { brand_id:"", script:"Ela chega em casa.", scene_count:"4", aspect_ratio:"9:16" },
  "produto-em-cena":     { brand_id:"", image_url:"https://x/y.png", scene:"bancada de marmore", aspect_ratio:"1:1" },
  "locucao-lote":        { scripts:"Primeiro\n---\nSegundo", voice_id:"" },
};

let bad = 0;
for (const r of RECIPES) {
  const a = answers[r.id];
  if (!a) { console.log(`SEM TESTE  ${r.id}`); bad++; continue; }
  const gph = r.build(a);
  const err = validate(gph);
  const cost = r.estimate(a);
  if (err) { console.log(`FALHOU     ${r.id.padEnd(22)} ${err}`); bad++; }
  else console.log(`ok         ${r.id.padEnd(22)} ${gph.nodes.length} nós, ${gph.edges.length} arestas, ${cost} créditos`);
}
console.log(bad ? `\n${bad} receita(s) com problema` : "\ntodas as 6 receitas produzem grafo válido");
process.exit(bad ? 1 : 0);
