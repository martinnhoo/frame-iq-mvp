/**
 * hub-voice-gen — locução via Fish Audio.
 *
 * SUBSTITUI O ELEVENLABS POR COMPLETO (02/08/2026).
 *
 * Por quê:
 *   • Custo: Fish cobra $15 por 1M de bytes UTF-8. ElevenLabs cobra ~11x isso.
 *   • Modelo GRATUITO: `s2.1-pro-free` custa $0,00. É o default daqui.
 *   • Português: as 9 vozes fixas do ElevenLabs eram TODAS em inglês
 *     (Rachel, Domi, Bella, Antoni…). O catálogo público do Fish tem
 *     milhares de vozes PT-BR reais.
 *   • Preview grátis: cada voz expõe um `sample_audio`. O usuário escolhe
 *     pelo ouvido sem gastar um crédito sequer.
 *
 * Três ações:
 *   action=voices    → lista o catálogo filtrado (não gasta crédito)
 *   action=generate  → gera a locução (gasta crédito)
 *   action=models    → devolve os modelos TTS e seus custos
 *
 * ⚠️ FILTRO LEGAL — leia antes de mexer em BLOCKED_TAGS/BLOCKED_NAME_PATTERNS.
 * O catálogo público do Fish contém clones de pessoas reais e de personagens
 * protegidos: "Lula" (274 mil gerações), "Goku", "Pomni", "São Cipriano".
 * Num produto PAGO de PUBLICIDADE isso é direito de imagem/voz e reprovação
 * de anúncio na Meta. O filtro abaixo não é preciosismo — é o que separa
 * este produto de um processo.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  reserveCredits, confirmCredits, refundCredits,
  insufficientCreditsResponse, getUserPlan,
} from "../_shared/hub-credits.ts";

const FN_VERSION = "v5-2026-08-03-audio";

const cors = {
  // Versão do deploy em todas as respostas — torna possível
  // verificar de fora o que realmente está no ar.
  "x-fn-version": FN_VERSION,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FISH_API = "https://api.fish.audio";

// ── Modelos TTS ──────────────────────────────────────────────────────────────
// O free é o default. Ele existe, é bom o bastante para locução de anúncio, e
// zera a linha de áudio no COGS. Só sobe pro pago quem pedir qualidade máxima.
const TTS_MODELS = {
  "s2.1-pro-free": { label: "Padrão (grátis)",   usdPerMByte: 0,  credits: 0 },
  "s2-pro":        { label: "Alta qualidade",    usdPerMByte: 15, credits: 2 },
  "s1":            { label: "Rápido",            usdPerMByte: 15, credits: 2 },
} as const;
type TtsModelId = keyof typeof TTS_MODELS;
const DEFAULT_MODEL: TtsModelId = "s2.1-pro-free";

const MAX_CHARS = 5000;

// ── Filtro de vozes ──────────────────────────────────────────────────────────
// A primeira versão exigia que a voz DECLARASSE um uso comercial numa tag.
// Isso barrava por omissão: a maioria das vozes boas só tem tags descritivas
// ("male", "deep", "calm") e sumia do catálogo. Rendimento de ~35%.
//
// Invertido: libera por padrão, bloqueia por SINAL DE RISCO. O que precisa
// ser barrado é personagem, celebridade e nome impróprio — não a ausência de
// rótulo. Rendimento sobe para ~80% mantendo a mesma proteção.

// Tags que denunciam clone de personagem ou de propriedade intelectual.
const BLOCKED_TAGS = new Set([
  "character-voice", "anime", "gaming", "celebrity", "politician",
  "meme", "cartoon", "movie-character", "vtuber",
]);

// Nomes bloqueados. Cobre o que a tag não pega: figura pública real clonada
// e batizada com o próprio nome, e personagem com tag "inocente".
// Não é exaustiva — é a primeira barreira, não a única.
const BLOCKED_NAME_PATTERNS: RegExp[] = [
  // Figuras públicas brasileiras
  /\blula\b/i, /\bbolsonaro\b/i, /\bcid\s*moreira\b/i, /\bsilvio\s*santos\b/i,
  /\bfaust[ãa]o\b/i, /\bgalv[ãa]o\s*bueno\b/i, /\bratinho\b/i, /\bdatena\b/i,
  /\bxuxa\b/i, /\bana\s*maria\s*braga\b/i, /\bwilliam\s*bonner\b/i,
  /\bneymar\b/i, /\bronaldo\b/i, /\bpel[ée]\b/i, /\bt[ée]dio\b/i,
  // Figuras internacionais
  /\btrump\b/i, /\bobama\b/i, /\bbiden\b/i, /\bmusk\b/i, /\bputin\b/i,
  /\bmorgan\s*freeman\b/i, /\bdavid\s*attenborough\b/i,
  // Personagens e franquias
  /\bgoku\b/i, /\bnaruto\b/i, /\bsukuna\b/i, /\bgojo\b/i, /\bluffy\b/i,
  /\bmiku\b/i, /\bpomni\b/i, /\bfluttershy\b/i, /\bpinkie\b/i, /\btwilight\s*sparkle\b/i,
  /\bbob\s*esponja\b/i, /\bspongebob\b/i, /\bsonic\b/i, /\bmario\b/i, /\bmickey\b/i,
  /\bhomer\b/i, /\bsimpson\b/i, /\bshrek\b/i, /\bbatman\b/i, /\bcoringa\b/i,
  /\bjoker\b/i, /\bdarth\b/i, /\byoda\b/i, /\bpeppa\b/i, /\bbrainrot\b/i,
  /\bjujutsu\b/i, /\bone\s*piece\b/i, /\bdragon\s*ball\b/i, /\bpok[ée]mon\b/i,
  // Religioso / esotérico — costuma vir com uso indevido
  /\bs[ãa]o\s+cipriano\b/i, /\bora[çc][ãa]o\b/i,
  // Impróprio para um produto comercial
  /\bputinha\b/i, /\bputa\b/i, /\bgostosa\b/i, /\bsafad[ao]\b/i,
  /\bnsfw\b/i, /\bsexy\b/i, /\bh[ée]ntai\b/i,
];

interface FishModel {
  _id: string;
  title: string;
  languages?: string[];
  tags?: string[];
  like_count?: number;
  task_count?: number;
  visibility?: string;
  state?: string;
  dmca_taken_down?: boolean | null;
  samples?: Array<{ audio?: string }>;
  author?: { nickname?: string };
}

/**
 * Uma voz é publicável num produto comercial?
 * Libera por padrão; barra apenas quando há sinal concreto de risco.
 */
function isVoiceAllowed(m: FishModel): boolean {
  if (m.state !== "trained") return false;
  if (m.dmca_taken_down) return false;

  const tags = (m.tags || []).map(t => t.toLowerCase());
  if (tags.some(t => BLOCKED_TAGS.has(t))) return false;

  const title = (m.title || "").trim();
  if (!title) return false;
  if (BLOCKED_NAME_PATTERNS.some(rx => rx.test(title))) return false;

  // Voz sem nenhum uso registrado costuma ser teste abandonado ou de
  // qualidade ruim — não vale ocupar espaço no catálogo.
  if ((m.task_count || 0) < 50) return false;

  return true;
}

/** Deriva gênero e idade das tags — o UI filtra por isso. */
function voiceMeta(tags: string[]) {
  const t = tags.map(x => x.toLowerCase());
  const gender = t.includes("female") ? "female" : t.includes("male") ? "male" : "neutral";
  const age = t.find(x => ["young", "middle-aged", "old"].includes(x)) || null;
  const useCase =
    t.includes("advertisement") || t.includes("commercial") ? "anuncio"
    : t.includes("social-media") ? "social"
    : t.includes("announcer") ? "locutor"
    : "narracao";
  return { gender, age, useCase };
}

/** Base64 em blocos: o spread de um array grande estoura a pilha. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify({ _v: FN_VERSION, ...(payload as object) }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Custo em créditos. O modelo grátis custa 0 — literalmente. */
function costFor(model: TtsModelId, text: string): number {
  const perM = TTS_MODELS[model].credits;
  if (perM === 0) return 0;
  const bytes = new TextEncoder().encode(text).length;
  return Math.max(1, Math.ceil((bytes / 1000) * perM));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let sb: any = null;
  let pendingReservation: string | null = null;

  try {
    const FISH_KEY = Deno.env.get("FISH_AUDIO_API_KEY");
    if (!FISH_KEY) {
      return json({
        ok: false, error: "missing_fish_key",
        message: "FISH_AUDIO_API_KEY não configurada. Pegue em fish.audio → API Keys e adicione nos secrets do Supabase.",
      }, 500);
    }

    sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    let userId = "";
    if (authHeader.startsWith("Bearer ")) {
      const { data: { user } } = await sb.auth.getUser(authHeader.slice(7));
      if (user) userId = user.id;
    }
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = (body.action || "generate").toString();

    // ── action=models ────────────────────────────────────────────────────────
    if (action === "models") {
      return json({
        ok: true,
        default: DEFAULT_MODEL,
        models: Object.entries(TTS_MODELS).map(([id, m]) => ({
          id, label: m.label, free: m.credits === 0,
        })),
      });
    }

    // ── action=voices — catálogo. Não custa crédito. ─────────────────────────
    if (action === "voices") {
      const language: string = (body.language || "pt").toString();
      const query: string = (body.query || "").toString().trim();
      const page: number = Math.max(1, Number(body.page) || 1);
      const useCase: string = (body.use_case || "").toString().trim();

      // Cada aba do UI vira uma consulta por tag no Fish. É isso que faz o
      // catálogo mudar de verdade entre "Anúncio" e "Narração", em vez de
      // filtrar sempre a mesma lista de populares.
      const USE_CASE_TAGS: Record<string, string[]> = {
        anuncio:  ["advertisement", "commercial"],
        narracao: ["narration", "storytelling", "documentary"],
        social:   ["social-media", "conversational"],
        locutor:  ["announcer", "radio"],
      };
      const tags = USE_CASE_TAGS[useCase] || [];

      // Busca duas páginas do Fish por requisição nossa: o catálogo fica o
      // dobro do tamanho sem custo perceptível, já que listar não gera áudio.
      const fetchPage = async (n: number, tag?: string) => {
        const params = new URLSearchParams({
          page_size: "50",
          page_number: String(n),
          language,
          sort_by: "task_count",
        });
        if (query) params.set("title", query);
        if (tag) params.set("tag", tag);
        const res = await fetch(`${FISH_API}/model?${params}`, {
          headers: { Authorization: `Bearer ${FISH_KEY}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      };

      let data: any;
      let items: FishModel[] = [];
      try {
        const base = (page - 1) * 2 + 1;
        const calls = tags.length > 0
          // Uma consulta por tag do uso escolhido, para cobrir sinônimos.
          ? tags.map(t => fetchPage(base, t).catch(() => ({ items: [] })))
          : [fetchPage(base), fetchPage(base + 1).catch(() => ({ items: [] }))];

        const results = await Promise.all(calls);
        data = results[0];

        // Dedup: a mesma voz pode aparecer em mais de uma tag.
        const seen = new Set<string>();
        for (const r of results) {
          for (const it of ((r as any)?.items || []) as FishModel[]) {
            if (it?._id && !seen.has(it._id)) { seen.add(it._id); items.push(it); }
          }
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const status = Number(raw) || 0;
        console.error(`[hub-voice] catálogo falhou: ${raw}`);
        return json({
          ok: false, error: "fish_catalog_failed",
          status,
          detail: raw.slice(0, 300),
          message: status === 401
            ? "Chave do Fish Audio inválida ou sem permissão."
            : status === 422
            ? "O Fish recusou os filtros da busca de vozes."
            : `Não foi possível carregar o catálogo de vozes (${raw.slice(0, 60)}).`,
        }, 502);
      }
      let allowed = items.filter(isVoiceAllowed);

      // Fallback progressivo: o combo (idioma + tag + popularidade >= 50)
      // frequentemente devolvia zero voz, deixando o select em branco.
      // Em vez de mostrar uma caixa vazia, afrouxa em degraus até ter opções.
      if (allowed.length === 0) {
        // 1) mesma busca, sem o piso de popularidade
        allowed = items.filter(m => isVoiceAllowed({ ...m, task_count: 999 }));
      }
      if (allowed.length === 0) {
        // 2) busca crua no idioma, sem tag de uso
        try {
          const raw = await fetchPage(1);
          const rawItems = ((raw as any)?.items || []) as FishModel[];
          allowed = rawItems.filter(m => isVoiceAllowed({ ...m, task_count: 999 }));
        } catch { /* mantém vazio */ }
      }
      if (allowed.length === 0 && language !== "en") {
        // 3) último degrau: catálogo global (multilíngue serve pra PT também)
        try {
          const params = new URLSearchParams({ page_size: "50", page_number: "1", sort_by: "task_count" });
          const res = await fetch(`${FISH_API}/model?${params}`, {
            headers: { Authorization: `Bearer ${FISH_KEY}` },
          });
          if (res.ok) {
            const raw = await res.json();
            allowed = (((raw as any)?.items || []) as FishModel[])
              .filter(m => isVoiceAllowed({ ...m, task_count: 999 }));
          }
        } catch { /* mantém vazio */ }
      }

      return json({
        ok: true,
        page,
        has_more: !!data?.has_more,
        // Quantas foram barradas — útil pra calibrar o filtro no admin.
        filtered_out: items.length - allowed.length,
        voices: allowed.map(m => {
          const tags = m.tags || [];
          return {
            id: m._id,
            name: m.title,
            author: m.author?.nickname || null,
            languages: m.languages || [],
            tags,
            ...voiceMeta(tags),
            popularity: m.task_count || 0,
            likes: m.like_count || 0,
            // Preview grátis: é isso que deixa a escolha de voz sem custo.
            sample_audio: m.samples?.[0]?.audio || null,
          };
        }),
      });
    }

    // ── action=generate ──────────────────────────────────────────────────────
    const text: string = (body.text || "").toString().trim();
    const voiceId: string = (body.voice_id || "").toString().trim();
    const rawModel: string = (body.model || DEFAULT_MODEL).toString();
    const model: TtsModelId = (rawModel in TTS_MODELS ? rawModel : DEFAULT_MODEL) as TtsModelId;
    const speed = Math.min(2, Math.max(0.5, Number(body.speed) || 1));

    if (!text) return json({ ok: false, error: "missing_text", message: "Texto vazio." }, 400);
    if (text.length > MAX_CHARS) {
      return json({
        ok: false, error: "text_too_long",
        message: `Texto excede ${MAX_CHARS} caracteres (${text.length}).`,
      }, 400);
    }
    if (!voiceId) {
      return json({ ok: false, error: "missing_voice", message: "Escolha uma voz." }, 400);
    }

    // Reserva só se o modelo custa. No `s2.1-pro-free` isso é pulado inteiro —
    // o usuário gera locução sem consumir nada do pool.
    const credits = costFor(model, text);
    if (credits > 0) {
      const plan = await getUserPlan(sb, userId);
      const res = await reserveCredits(sb, userId, plan, "voice_per_1k_chars",
        new TextEncoder().encode(text).length / 1000);
      if (!res.ok) return insufficientCreditsResponse(res, cors);
      pendingReservation = res.reservation_id ?? null;
    }

    const ttsBody = JSON.stringify({
      text,
      reference_id: voiceId,
      format: "mp3",
      mp3_bitrate: 128,
      latency: "normal",
      normalize: true,
      prosody: { speed, volume: 0 },
    });

    const callFish = (m: string) => fetch(`${FISH_API}/v1/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FISH_KEY}`,
        "Content-Type": "application/json",
        model: m,
      },
      body: ttsBody,
    });

    let usedModel = model;
    let r = await callFish(model);

    // O enum documentado do /v1/tts lista só s1 e s2-pro, mas a página de
    // modelos apresenta s2.1-pro-free como válido. Se o free for recusado,
    // tenta o pago em vez de falhar para o usuário.
    if (!r.ok && model === "s2.1-pro-free" && (r.status === 422 || r.status === 400)) {
      console.warn(`[hub-voice] ${model} recusado (${r.status}) — tentando s2-pro`);
      usedModel = "s2-pro";
      r = await callFish("s2-pro");
    }

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[hub-voice] fish ${r.status} (modelo ${usedModel}): ${errText.slice(0, 300)}`);
      if (pendingReservation) {
        await refundCredits(sb, pendingReservation, `fish_${r.status}`);
        pendingReservation = null;
      }
      const message =
        r.status === 401 ? "Chave do Fish Audio inválida ou expirada."
        : r.status === 402 ? "Saldo do Fish Audio esgotado. Recarregue em fish.audio."
        : r.status === 429 ? "Muitas gerações simultâneas. Tente em alguns segundos."
        : r.status === 422 ? "O Fish recusou os parâmetros da geração."
        : `Fish Audio retornou ${r.status}.`;
      // Devolve o corpo do erro: sem isso, diagnosticar exigia acesso ao log.
      return json({
        ok: false, error: "fish_tts_failed", message, status: r.status,
        model_tried: usedModel,
        detail: errText.slice(0, 400),
      }, 502);
    }

    const audioBuf = await r.arrayBuffer();
    if (audioBuf.byteLength === 0) {
      if (pendingReservation) {
        await refundCredits(sb, pendingReservation, "empty_audio");
        pendingReservation = null;
      }
      return json({ ok: false, error: "empty_audio", message: "Fish Audio devolveu áudio vazio." }, 502);
    }

    // Sobe pro Storage. Devolver base64 inline estourava o limite de resposta
    // em roteiros longos.
    const path = `${userId}/voice/${crypto.randomUUID()}.mp3`;
    const { error: upErr } = await sb.storage
      .from("hub-images")
      .upload(path, new Uint8Array(audioBuf), { contentType: "audio/mpeg", upsert: false });

    let audioUrl: string;
    if (upErr) {
      if (String(upErr.message || "").toLowerCase().includes("mime")) {
        console.error("[hub-voice] bucket recusa audio/mpeg — rode a migration 20260803150000");
      }
      // Storage falhou mas o áudio existe — devolve inline em vez de perder
      // a geração já paga.
      console.warn("[hub-voice] storage falhou, devolvendo inline:", upErr.message);
      // String.fromCharCode(...array) espalha cada byte como argumento da
      // função. Um MP3 de 30s tem ~480 mil bytes — isso estourava a pilha e
      // derrubava a função inteira, que era o "erro na edge function" que o
      // usuário via. Converte em blocos.
      audioUrl = `data:audio/mpeg;base64,${toBase64(new Uint8Array(audioBuf))}`;
    } else {
      audioUrl = sb.storage.from("hub-images").getPublicUrl(path).data.publicUrl;
    }

    if (pendingReservation) {
      await confirmCredits(sb, pendingReservation);
      pendingReservation = null;
    }

    return json({
      ok: true,
      audio_url: audioUrl,
      characters: text.length,
      size_kb: Math.round(audioBuf.byteLength / 1024),
      voice_id: voiceId,
      model: usedModel,
      credits_charged: credits,
      free: credits === 0,
    });

  } catch (e) {
    console.error("[hub-voice] erro inesperado:", e);
    if (sb && pendingReservation) {
      try { await refundCredits(sb, pendingReservation, "unexpected_error"); } catch { /* ignora */ }
    }
    return json({ ok: false, error: "internal_error", message: String(e).slice(0, 300) }, 500);
  }
});
