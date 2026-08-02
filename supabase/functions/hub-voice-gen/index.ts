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
 * ⚠️ FILTRO LEGAL — leia antes de mexer em ALLOWED_TAGS/BLOCKED.
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

const FN_VERSION = "v2-fish-audio-2026-08-02";

const cors = {
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
// Allowlist por tag de USO. Uma voz só aparece se declarar que serve pra
// locução comercial.
const ALLOWED_TAGS = new Set([
  "advertisement", "narration", "professional", "announcer", "social-media",
  "educational", "storytelling", "documentary", "commercial", "conversational",
  "narrador", "profissional da voz",
]);

// Blocklist por tag: personagem, anime, games e afins quase sempre são clone
// de propriedade intelectual de terceiros.
const BLOCKED_TAGS = new Set([
  "character-voice", "anime", "gaming", "celebrity", "politician", "meme",
]);

// Blocklist por nome. Cobre o que a tag não pega: figura pública clonada e
// batizada com o próprio nome. Não é exaustiva — é a primeira barreira.
const BLOCKED_NAME_PATTERNS = [
  /\blula\b/i, /\bbolsonaro\b/i, /\btrump\b/i, /\bgoku\b/i, /\bnaruto\b/i,
  /\bpomni\b/i, /\bmickey\b/i, /\bhomer\b/i, /\bbrainrot\b/i,
  /\bs[ãa]o\s+cipriano\b/i, /\bfaustao\b/i, /\bfaust[ãa]o\b/i,
  /\bsilvio\s+santos\b/i, /\bgalv[ãa]o\b/i, /\bcid\s+moreira\b/i,
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

/** Uma voz é publicável num produto comercial? */
function isVoiceAllowed(m: FishModel): boolean {
  if (m.state !== "trained") return false;
  if (m.dmca_taken_down) return false;

  const tags = (m.tags || []).map(t => t.toLowerCase());
  if (tags.some(t => BLOCKED_TAGS.has(t))) return false;

  const title = m.title || "";
  if (BLOCKED_NAME_PATTERNS.some(rx => rx.test(title))) return false;

  // Precisa declarar pelo menos um uso comercial legítimo.
  return tags.some(t => ALLOWED_TAGS.has(t));
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

      // Pede mais do que vai devolver: o filtro legal derruba boa parte.
      const params = new URLSearchParams({
        page_size: "40",
        page_number: String(page),
        language,
        sort_by: "task_count",
      });
      if (query) params.set("title", query);

      const r = await fetch(`${FISH_API}/model?${params}`, {
        headers: { Authorization: `Bearer ${FISH_KEY}` },
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error(`[hub-voice] catálogo falhou ${r.status}: ${txt.slice(0, 200)}`);
        return json({
          ok: false, error: "fish_catalog_failed",
          message: r.status === 401
            ? "Chave do Fish Audio inválida."
            : "Não foi possível carregar o catálogo de vozes.",
        }, 502);
      }

      const data = await r.json();
      const items: FishModel[] = data?.items || [];
      const allowed = items.filter(isVoiceAllowed);

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

    const r = await fetch(`${FISH_API}/v1/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FISH_KEY}`,
        "Content-Type": "application/json",
        model,
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: "mp3",
        mp3_bitrate: 128,
        latency: "normal",
        normalize: true,
        prosody: { speed, volume: 0 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`[hub-voice] fish ${r.status}: ${errText.slice(0, 300)}`);
      if (pendingReservation) {
        await refundCredits(sb, pendingReservation, `fish_${r.status}`);
        pendingReservation = null;
      }
      const message =
        r.status === 401 ? "Chave do Fish Audio inválida ou expirada."
        : r.status === 402 ? "Saldo do Fish Audio esgotado. Recarregue em fish.audio."
        : r.status === 429 ? "Muitas gerações simultâneas. Tente em alguns segundos."
        : `Fish Audio retornou ${r.status}.`;
      return json({ ok: false, error: "fish_tts_failed", message, status: r.status }, 502);
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
      // Storage falhou mas o áudio existe — devolve inline em vez de perder
      // a geração já paga.
      console.warn("[hub-voice] storage falhou, devolvendo inline:", upErr.message);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(audioBuf)));
      audioUrl = `data:audio/mpeg;base64,${b64}`;
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
      model,
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
