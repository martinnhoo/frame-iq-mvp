/**
 * Receitas — a camada que faz a automação ser usável por quem não é técnico.
 *
 * O canvas de nós continua existindo e continua sendo a verdade: uma receita
 * NÃO é um formato novo de execução. Ela é um formulário curto que COMPILA
 * para o mesmo `WfGraph` que o `execute-workflow` já roda hoje. Isso é
 * deliberado — significa que:
 *
 *   - nenhuma capacidade se perde: o que a receita monta, o usuário pode
 *     abrir no modo avançado e continuar editando à mão;
 *   - não existe segundo executor pra manter em sincronia, que é como esse
 *     tipo de camada costuma apodrecer;
 *   - a validação, o metering e o estorno que já existem valem igual.
 *
 * O problema que isso resolve: a tela de nós pede que a pessoa saiba a
 * ARQUITETURA do sistema antes de conseguir a primeira saída. Ela precisa
 * descobrir sozinha que "prompt" alimenta "image-gen", que "brand" entra por
 * outra porta, que "variation" multiplica o que vem depois. Isso é pedir que
 * o cliente aprenda o nosso modelo de dados pra comprar o nosso produto.
 *
 * Uma receita pergunta em vez disso: o que você vende, pra quem, quantas
 * versões. Três campos. O grafo sai pronto.
 */

import type { WfGraph, WfNode, WfEdge } from "./hubWorkflows";
import { CREDIT_COSTS } from "./hubPlans";

// ── Tipos ───────────────────────────────────────────────────────────────────

export type FieldKind = "text" | "textarea" | "select" | "number" | "brand";

export interface RecipeField {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: { value: string; label: string; hint?: string }[];
  default?: string | number;
  min?: number;
  max?: number;
}

export interface Recipe {
  id: string;
  /** Nome no imperativo, do ponto de vista de quem faz anúncio. */
  name: string;
  /** Uma frase: o que sai disto. Não o que ele faz por dentro. */
  outcome: string;
  /** Quando escolher esta e não outra. */
  whenToUse: string;
  icon: string;
  /** Perguntas. Manter curto — cada campo a mais derruba a conversão. */
  fields: RecipeField[];
  /** Compila as respostas no grafo que o execute-workflow roda. */
  build: (a: Record<string, string>) => WfGraph;
  /** Créditos estimados, pra mostrar ANTES de rodar. */
  estimate: (a: Record<string, string>) => number;
}

// ── Helpers de construção ───────────────────────────────────────────────────

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function g(nodes: WfNode[], edges: WfEdge[]): WfGraph {
  return { version: 1, nodes, edges };
}

/**
 * O executor indexa os inputs de um nó pelo `targetHandle` da aresta, caindo
 * em "default" quando ela não tem. E cada handler lê uma chave específica:
 * execOutput lê `inputs.asset`, execBgRemove lê `inputs.image`, execVideo lê
 * `inputs.image`, execVoice lê `inputs.text`, execImageGen lê `inputs.prompt`
 * / `brand` / `reference`.
 *
 * Ou seja: aresta sem handle é aresta que não chega. O grafo fica bonito na
 * tela e falha com "missing_asset_input" no primeiro run. Por isso o handle
 * é obrigatório aqui — a assinatura não deixa esquecer.
 */
function edge(source: string, target: string, targetHandle: string): WfEdge {
  return {
    id: `e-${source}-${target}-${targetHandle}`,
    source,
    target,
    targetHandle,
  };
}

/** Nó de marca. brand_id vazio = sem marca, e o executor lida com isso. */
function brandNode(id: string, brandId: string, x = 40, y = 40): WfNode {
  return {
    id,
    type: "brand",
    position: { x, y },
    data: { brand_id: brandId || null, include_disclaimer: !!brandId },
  };
}

function promptNode(id: string, text: string, x = 40, y = 200): WfNode {
  return { id, type: "prompt", position: { x, y }, data: { text } };
}

const num = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

// ── Campos reaproveitados ───────────────────────────────────────────────────

const fBrand: RecipeField = {
  key: "brand_id",
  label: "Marca",
  kind: "brand",
  help: "Aplica cores, tom de voz e o texto legal que você cadastrou. Opcional.",
};

const fOffer: RecipeField = {
  key: "offer",
  label: "O que você está vendendo",
  kind: "textarea",
  required: true,
  placeholder: "Curso de inglês para quem trava na hora de falar. 12 semanas, aulas ao vivo, R$ 197/mês.",
  help: "Escreva como você explicaria para um amigo. Quanto mais concreto, melhor sai.",
};

const fAudience: RecipeField = {
  key: "audience",
  label: "Para quem",
  kind: "text",
  required: true,
  placeholder: "Profissionais de 25 a 40 anos que precisam de inglês no trabalho",
};

const fFormat: RecipeField = {
  key: "aspect_ratio",
  label: "Formato",
  kind: "select",
  default: "9:16",
  options: [
    { value: "9:16", label: "Vertical", hint: "Stories, Reels, TikTok" },
    { value: "1:1",  label: "Quadrado", hint: "Feed do Instagram" },
    { value: "4:5",  label: "Retrato",  hint: "Feed, ocupa mais tela" },
    { value: "16:9", label: "Horizontal", hint: "YouTube, display" },
  ],
};

const fCount = (dflt: number, max: number): RecipeField => ({
  key: "count",
  label: "Quantas versões",
  kind: "number",
  default: dflt,
  min: 1,
  max,
  help: "Versões diferentes da mesma ideia, para você testar qual performa.",
});

// ── As receitas ─────────────────────────────────────────────────────────────
//
// Seis, não vinte. Cada uma cobre um trabalho que quem anuncia realmente
// tem — não uma combinação possível de nós. Uma galeria de trinta receitas
// reintroduz exatamente o problema de escolha que o canvas já tinha.

export const RECIPES: Recipe[] = [
  {
    id: "criativos-teste",
    name: "Criar um lote de criativos para testar",
    outcome: "Várias imagens da mesma oferta, com ângulos diferentes, prontas para subir.",
    whenToUse: "Você tem uma oferta e ainda não sabe qual mensagem pega.",
    icon: "▦",
    fields: [fBrand, fOffer, fAudience, fFormat, fCount(4, 12)],
    build: (a) => {
      const b = nid("brand"), p = nid("prompt"), i = nid("img"), o = nid("out");
      const n = num(a.count, 4);
      return g(
        [
          brandNode(b, a.brand_id),
          promptNode(p,
            `Anúncio para: ${a.offer}\n` +
            `Público: ${a.audience}\n` +
            `Cada versão deve atacar um ângulo diferente — dor, resultado, prova, ` +
            `objeção. Texto curto e legível no celular.`),
          {
            id: i, type: "image-gen", position: { x: 400, y: 120 },
            data: { count: n, aspect_ratio: a.aspect_ratio || "9:16", quality: "medium" },
          },
          { id: o, type: "output", position: { x: 760, y: 120 }, data: { name_template: "{date}_teste_{slug}" } },
        ],
        [edge(b, i, "brand"), edge(p, i, "prompt"), edge(i, o, "asset")],
      );
    },
    estimate: (a) => num(a.count, 4) * CREDIT_COSTS.image_standard,
  },

  {
    id: "anuncio-video",
    name: "Transformar uma oferta em vídeo curto",
    outcome: "Um vídeo vertical de 5 segundos com locução, pronto para Reels e TikTok.",
    whenToUse: "Você quer testar vídeo sem gravar nada.",
    icon: "▶",
    fields: [
      fBrand, fOffer, fAudience,
      {
        key: "script", label: "Fala da locução", kind: "textarea",
        placeholder: "Você estuda inglês há anos e ainda trava na hora de falar. O problema não é você.",
        help: "Deixe em branco e a gente escreve a partir da oferta.",
      },
    ],
    build: (a) => {
      const b = nid("brand"), p = nid("prompt"), i = nid("img"),
            v = nid("vid"), s = nid("voice"),
            ov = nid("out"), os_ = nid("out");
      const script = (a.script || "").trim()
        || `${a.offer}. Feito para ${a.audience}.`;
      // Um output por asset. Duas arestas no mesmo handle "asset" fazem o
      // collectNodeInputs devolver um ARRAY, e o execOutput lê asset.video_url
      // em cima dele — vira undefined e estoura missing_asset_input.
      return g(
        [
          brandNode(b, a.brand_id),
          promptNode(p,
            `Primeiro quadro de um anúncio em vídeo para: ${a.offer}\n` +
            `Público: ${a.audience}\n` +
            `Composição vertical, rosto ou produto em destaque, espaço no topo para texto.`),
          { id: i, type: "image-gen", position: { x: 400, y: 60 }, data: { count: 1, aspect_ratio: "9:16", quality: "medium" } },
          { id: v, type: "video",  position: { x: 760, y: 60 },  data: { duration: 5, aspect_ratio: "9:16" } },
          { id: s, type: "voice",  position: { x: 760, y: 300 }, data: { text: script, speed: 1 } },
          { id: ov,  type: "output", position: { x: 1100, y: 60 },  data: { name_template: "{date}_video_{slug}" } },
          { id: os_, type: "output", position: { x: 1100, y: 300 }, data: { name_template: "{date}_locucao_{slug}" } },
        ],
        [edge(b, i, "brand"), edge(p, i, "prompt"), edge(i, v, "image"), edge(v, ov, "asset"), edge(s, os_, "asset")],
      );
    },
    estimate: () =>
      CREDIT_COSTS.image_standard + CREDIT_COSTS.video_final_5s + 12,
  },

  {
    id: "variacoes-headline",
    name: "Testar a mesma imagem com headlines diferentes",
    outcome: "A mesma arte, várias chamadas — o teste que isola só o texto.",
    whenToUse: "A arte já funciona e você quer saber qual frase converte.",
    icon: "≡",
    fields: [
      fBrand, fOffer, fFormat,
      {
        key: "headlines", label: "As chamadas", kind: "textarea", required: true,
        placeholder: "Você não precisa de mais um curso\nPare de estudar. Comece a falar.\n12 semanas para destravar",
        help: "Uma por linha. Cada uma vira um criativo.",
      },
    ],
    build: (a) => {
      const b = nid("brand"), p = nid("prompt"), vr = nid("var"), i = nid("img"), o = nid("out");
      const values = (a.headlines || "").split("\n").map(s => s.trim()).filter(Boolean);
      return g(
        [
          brandNode(b, a.brand_id),
          promptNode(p, `Anúncio para: ${a.offer}. Arte limpa, com área livre para a chamada.`),
          {
            id: vr, type: "variation", position: { x: 400, y: 220 },
            // axis "prompt" é o que faz o executor clonar o subgrafo abaixo
            // e injetar cada valor como _prompt_override.
            data: { axis: "prompt", values },
          },
          { id: i, type: "image-gen", position: { x: 760, y: 120 }, data: { count: 1, aspect_ratio: a.aspect_ratio || "1:1", quality: "medium" } },
          { id: o, type: "output", position: { x: 1100, y: 120 }, data: { name_template: "{date}_headline_{slug}" } },
        ],
        [edge(b, i, "brand"), edge(p, vr, "in"), edge(vr, i, "prompt"), edge(i, o, "asset")],
      );
    },
    estimate: (a) => {
      const n = (a.headlines || "").split("\n").filter(s => s.trim()).length || 1;
      return n * CREDIT_COSTS.image_standard;
    },
  },

  {
    id: "storyboard-roteiro",
    name: "Virar um roteiro em cenas",
    outcome: "Uma sequência de quadros com o mesmo personagem e o mesmo clima.",
    whenToUse: "Você tem uma história e precisa dela em imagem, na ordem.",
    icon: "▤",
    fields: [
      fBrand,
      {
        key: "script", label: "O roteiro", kind: "textarea", required: true,
        placeholder: "Ela chega em casa cansada. Abre o laptop. A aula começa. Três meses depois, apresenta em inglês para a diretoria.",
        help: "Escreva corrido. A gente divide nas cenas.",
      },
      {
        key: "scene_count", label: "Quantas cenas", kind: "number",
        default: 4, min: 2, max: 8,
      },
      fFormat,
    ],
    build: (a) => {
      const b = nid("brand"), p = nid("prompt"), s = nid("sb"), o = nid("out");
      return g(
        [
          brandNode(b, a.brand_id),
          promptNode(p, a.script || ""),
          {
            id: s, type: "storyboard", position: { x: 400, y: 120 },
            data: {
              scene_count: Math.max(2, Math.min(8, num(a.scene_count, 4))),
              aspect_ratio: a.aspect_ratio || "9:16",
              quality: "medium",
            },
          },
          { id: o, type: "output", position: { x: 760, y: 120 }, data: { name_template: "{date}_cena_{slug}" } },
        ],
        [edge(b, s, "brand"), edge(p, s, "prompt"), edge(s, o, "asset")],
      );
    },
    estimate: (a) => Math.max(2, Math.min(8, num(a.scene_count, 4))) * CREDIT_COSTS.storyboard_frame,
  },

  {
    id: "produto-em-cena",
    name: "Colocar meu produto numa cena",
    outcome: "A foto do seu produto, recortada e colocada num ambiente novo.",
    whenToUse: "Você tem a foto do produto e ela está num fundo feio.",
    icon: "◈",
    fields: [
      fBrand,
      {
        key: "image_url", label: "Foto do produto", kind: "text", required: true,
        placeholder: "Cole o link da imagem",
        help: "Se ela já está na sua Biblioteca, copie o link de lá.",
      },
      {
        key: "scene", label: "Onde colocar", kind: "textarea", required: true,
        placeholder: "Bancada de mármore, luz da manhã entrando pela janela, planta desfocada no fundo",
      },
      fFormat,
    ],
    build: (a) => {
      const b = nid("brand"), r = nid("ref"), bg = nid("bg"), p = nid("prompt"), i = nid("img"), o = nid("out");
      return g(
        [
          brandNode(b, a.brand_id),
          { id: r, type: "reference-image", position: { x: 40, y: 200 }, data: { image_url: a.image_url || "", description: "produto" } },
          { id: bg, type: "bg-remove", position: { x: 400, y: 200 }, data: {} },
          promptNode(p, `Cena: ${a.scene}. O produto entra na cena com sombra e perspectiva coerentes com a luz descrita.`, 40, 380),
          { id: i, type: "image-gen", position: { x: 760, y: 200 }, data: { count: 1, aspect_ratio: a.aspect_ratio || "1:1", quality: "high" } },
          { id: o, type: "output", position: { x: 1100, y: 200 }, data: { name_template: "{date}_cena_produto_{slug}" } },
        ],
        [edge(r, bg, "image"), edge(bg, i, "reference"), edge(b, i, "brand"), edge(p, i, "prompt"), edge(i, o, "asset")],
      );
    },
    estimate: () => CREDIT_COSTS.bg_remove + CREDIT_COSTS.image_high,
  },

  {
    id: "locucao-lote",
    name: "Gravar várias locuções de uma vez",
    outcome: "Um arquivo de áudio por texto, na mesma voz.",
    whenToUse: "Você tem vários roteiros e quer a mesma voz em todos.",
    icon: "◉",
    fields: [
      {
        key: "scripts", label: "Os textos", kind: "textarea", required: true,
        placeholder: "Primeiro roteiro aqui\n---\nSegundo roteiro aqui",
        help: "Separe cada um com três traços numa linha só: ---",
      },
      {
        key: "voice_id", label: "Voz", kind: "text",
        placeholder: "Deixe em branco para a voz padrão em português",
        help: "Escolha uma voz na tela de Locução e cole o código dela aqui.",
      },
    ],
    build: (a) => {
      const parts = (a.scripts || "").split(/^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
      const nodes: WfNode[] = [];
      const edges: WfEdge[] = [];
      // Um output por locução, pelo mesmo motivo: várias arestas no handle
      // "asset" do mesmo output viram array e o execOutput não lê array.
      parts.forEach((text, k) => {
        const v = nid("voice"), o = nid("out");
        nodes.push({
          id: v, type: "voice", position: { x: 120, y: 60 + k * 140 },
          data: { text, speed: 1, ...(a.voice_id ? { voice_id: a.voice_id.trim() } : {}) },
        });
        nodes.push({
          id: o, type: "output", position: { x: 560, y: 60 + k * 140 },
          data: { name_template: `{date}_locucao_${k + 1}` },
        });
        edges.push(edge(v, o, "asset"));
      });
      return g(nodes, edges);
    },
    estimate: (a) => {
      const parts = (a.scripts || "").split(/^\s*---\s*$/m).map(s => s.trim()).filter(Boolean);
      const chars = parts.reduce((sum, p) => sum + p.length, 0);
      return Math.max(1, Math.ceil((chars / 1000) * CREDIT_COSTS.voice_per_1k_chars));
    },
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id);
}

/** Campos obrigatórios preenchidos? Devolve o label do primeiro que falta. */
export function missingField(r: Recipe, a: Record<string, string>): string | null {
  for (const f of r.fields) {
    if (f.required && !(a[f.key] || "").trim()) return f.label;
  }
  return null;
}
