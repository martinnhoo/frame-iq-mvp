// TEMP: simulação dos pré-moldes de workflow contra as regras do executor.
import { RECIPES } from "./src/lib/workflowRecipes";

type N = { id: string; type: string; data: Record<string, any> };
type E = { id: string; source: string; target: string; targetHandle?: string };

const TEXT_KEYS = ["text", "script", "vo_script", "caption", "prompt", "content", "value", "output"];
const IMAGE_KEYS = ["image_url", "url", "output_url", "src"];

function pickText(v: any, d = 0): string {
  if (v == null || d > 3) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(x => pickText(x, d + 1)).filter(Boolean).join("\n\n").trim();
  if (typeof v === "object") { for (const k of TEXT_KEYS) { const g = pickText(v[k], d + 1); if (g) return g; } }
  return "";
}
function pickImageUrl(v: any, d = 0): string {
  if (v == null || d > 3) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) { for (const x of v) { const g = pickImageUrl(x, d + 1); if (g) return g; } return ""; }
  if (typeof v === "object") {
    for (const k of IMAGE_KEYS) { const g = pickImageUrl(v[k], d + 1); if (g) return g; }
    return pickImageUrl(v.scenes, d + 1);
  }
  return "";
}
const resolveText = (inp: any, node?: N) => {
  for (const h of ["prompt", "text", "script", "default", "in"]) { const g = pickText(inp[h]); if (g) return g; }
  for (const v of Object.values(inp)) { const g = pickText(v); if (g) return g; }
  if (node) for (const k of ["text", "script", "prompt"]) { const g = pickText(node.data[k]); if (g) return g; }
  return "";
};
const resolveImageUrl = (inp: any, node?: N) => {
  for (const h of ["image", "asset", "reference", "default", "in"]) { const g = pickImageUrl(inp[h]); if (g) return g; }
  for (const v of Object.values(inp)) { const g = pickImageUrl(v); if (g) return g; }
  if (node) { const g = pickImageUrl(node.data.image_url); if (g) return g; }
  return "";
};

function collect(node: N, edges: E[], outputs: Record<string, any>) {
  const r: Record<string, any[]> = {};
  for (const e of edges) {
    if (e.target !== node.id) continue;
    if (outputs[e.source] === undefined) continue;
    const h = e.targetHandle || "default";
    (r[h] ||= []).push(outputs[e.source]);
  }
  const flat: Record<string, any> = {};
  for (const [k, v] of Object.entries(r)) flat[k] = v.length === 1 ? v[0] : v;
  return flat;
}

function run(nodes: N[], edges: E[]) {
  const errs: string[] = [];
  const outputs: Record<string, any> = {};
  // topo
  const indeg: Record<string, number> = {};
  nodes.forEach(n => (indeg[n.id] = 0));
  edges.forEach(e => { if (indeg[e.target] !== undefined) indeg[e.target]++; });
  const order: N[] = [];
  const q = nodes.filter(n => indeg[n.id] === 0);
  const seen = new Set<string>();
  while (q.length) {
    const n = q.shift()!; if (seen.has(n.id)) continue; seen.add(n.id); order.push(n);
    for (const e of edges.filter(e => e.source === n.id)) {
      indeg[e.target]--; if (indeg[e.target] === 0) q.push(nodes.find(x => x.id === e.target)!);
    }
  }
  if (order.length !== nodes.length) errs.push("ciclo ou nó órfão no grafo");

  for (const n of order) {
    const inp = collect(n, edges, outputs);
    try {
      switch (n.type) {
        case "brand": outputs[n.id] = { brand_id: n.data.brand_id, brand_hint: "", license_text: "" }; break;
        case "prompt": {
          const t = String(n.data.text || "").trim();
          if (t.length < 5) throw new Error("prompt_too_short");
          outputs[n.id] = { text: t }; break;
        }
        case "reference-image": {
          if (!String(n.data.image_url || "").trim()) throw new Error("missing_reference_image_url");
          outputs[n.id] = { image_url: n.data.image_url, description: n.data.description || "" }; break;
        }
        case "variation": outputs[n.id] = inp.in ?? inp.default ?? {}; break;
        case "image-gen": {
          const p = n.data._prompt_override || resolveText(inp, n);
          if (!p || p.length < 5) throw new Error("missing_prompt");
          outputs[n.id] = { asset_id: "a", image_url: "https://x/img.png", prompt_used: p }; break;
        }
        case "bg-remove": {
          if (!resolveImageUrl(inp, n)) throw new Error("missing_image_input");
          outputs[n.id] = { asset_id: "a", image_url: "https://x/png.png" }; break;
        }
        case "storyboard": {
          const s = resolveText(inp, n);
          if (!s || s.length < 10) throw new Error("missing_script");
          outputs[n.id] = { storyboard_id: "sb", scenes: [{ n: 1, image_url: "https://x/1.png", asset_id: "a" }] }; break;
        }
        case "video": {
          const p = resolveText(inp, n);
          if (!p || p.length < 5) throw new Error("missing_prompt");
          outputs[n.id] = { asset_id: "a", video_url: "https://x/v.mp4", duration_s: 5 }; break;
        }
        case "voice": {
          const t = resolveText(inp, n);
          if (!t) throw new Error("missing_text");
          outputs[n.id] = { asset_id: "a", audio_url: "https://x/a.mp3" }; break;
        }
        case "output": {
          const cands: any[] = [];
          const c = (v: any, d = 0) => { if (!v || d > 3) return; if (Array.isArray(v)) { v.forEach(x => c(x, d + 1)); return; } if (typeof v === "object") { cands.push(v); if (Array.isArray((v as any).scenes)) c((v as any).scenes, d + 1); } };
          c(inp.asset); for (const [k, v] of Object.entries(inp)) if (k !== "asset") c(v);
          if (!cands.find(a => a.image_url || a.audio_url || a.video_url)) throw new Error("missing_asset_input");
          outputs[n.id] = { name: "ok" }; break;
        }
        default: throw new Error("unknown_node_type:" + n.type);
      }
    } catch (e: any) { errs.push(`${n.id} (${n.type}): ${e.message}`); }
  }
  return errs;
}

const answers: Record<string, Record<string, string>> = {
  "criativos-teste": { offer: "Curso de inglês online, 12 semanas, R$197/mês", audience: "Profissionais 25-40", aspect_ratio: "9:16", count: "4" },
  "anuncio-video": { offer: "Curso de inglês online", audience: "Profissionais 25-40", script: "Você trava na hora de falar inglês." },
  "variacoes-headline": { offer: "Curso de inglês", aspect_ratio: "1:1", headlines: "Chamada um aqui\nChamada dois aqui" },
  "storyboard-roteiro": { script: "Ela chega em casa cansada, abre o laptop e a aula começa.", scene_count: "4", aspect_ratio: "9:16" },
  "produto-em-cena": { image_url: "https://x/produto.jpg", scene: "Bancada de mármore com luz da manhã", aspect_ratio: "1:1" },
  "locucao-lote": { scripts: "Primeiro roteiro aqui\n---\nSegundo roteiro aqui", voice_id: "" },
};

let fails = 0;
for (const r of RECIPES) {
  const a = answers[r.id] || {};
  const graph = r.build(a) as any;
  const errs = run(graph.nodes, graph.edges);
  if (errs.length) { fails++; console.log(`FAIL  ${r.id}\n      ` + errs.join("\n      ")); }
  else console.log(`OK    ${r.id}  (${graph.nodes.length} nós, ${r.estimate(a)} créditos)`);
}
console.log(fails ? `\n${fails} receita(s) com falha` : "\nTodas passaram");
