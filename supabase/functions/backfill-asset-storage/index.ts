// backfill-asset-storage — migra assets antigos com data URL embebido
// pra Supabase Storage. Reduz hub_assets de ~2MB/row pra ~200 bytes.
//
// Pipeline:
//   1. Pega N rows do user com content.image_url ou content.audio_url
//      começando com 'data:' (= ainda não migrado)
//   2. Pra cada row: decode base64 → upload pro Storage → update content
//      com nova URL pública
//   3. Retorna processed + remaining pra frontend orquestrar batches
//
// Idempotente: rodar de novo só processa o que ainda tá em data URL.
// RLS-bypass via service role (necessário pra atualizar content jsonb).
// Mas filtra por user_id pra que cada user só migre o que é seu.

const FN_VERSION = "v1-backfill-2026-05-06";

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

interface BackfillError { id: string; error: string }

console.log(`[backfill-asset-storage] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(20, Math.max(1, Math.floor(Number(body.batch_size) || 5)));
    const dryRun = !!body.dry_run;

    // ── 1. Pega rows que precisam migrar ──────────────────────────────
    // Nota: pulamos campos pesados na query inicial — só id e kind.
    // Content completo é lido por row no loop pra não estourar memória.
    const { data: candidateRows, error: fetchErr } = await sb
      .from("hub_assets")
      .select("id, kind, content")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: true }) // mais antigos primeiro
      .limit(200); // pega até 200 e filtra em JS — evita complexidade jsonb operator

    if (fetchErr) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "fetch_failed", message: fetchErr.message,
      }, 500);
    }

    // Filtra rows que TÊM data URL no image_url ou audio_url
    const needsMigration = (candidateRows || []).filter(r => {
      const c = (r.content || {}) as Record<string, unknown>;
      const img = c.image_url as string | undefined;
      const aud = c.audio_url as string | undefined;
      return (img && img.startsWith("data:")) || (aud && aud.startsWith("data:"));
    });

    const totalCandidates = needsMigration.length;
    const toProcess = needsMigration.slice(0, batchSize);

    if (dryRun) {
      return jsonResponse({
        _v: FN_VERSION, ok: true, dry_run: true,
        candidates_in_window: totalCandidates,
        would_process: toProcess.length,
        message: `Encontrados ${totalCandidates} assets pra migrar nas últimas 200 rows. Tira dry_run pra processar de fato.`,
      }, 200);
    }

    if (toProcess.length === 0) {
      return jsonResponse({
        _v: FN_VERSION, ok: true,
        processed: 0, remaining: 0, done: true,
        message: "Tudo migrado.",
      }, 200);
    }

    // ── 2. Pra cada row, faz upload + update ──────────────────────────
    let processed = 0;
    const errors: BackfillError[] = [];

    for (const row of toProcess) {
      const c = { ...(row.content as Record<string, unknown>) };
      let touched = false;

      // image_url
      const imgVal = c.image_url as string | undefined;
      if (imgVal && imgVal.startsWith("data:")) {
        const newUrl = await uploadDataUrl(imgVal, authUser.id, "backfill", sb);
        if (newUrl) {
          c.image_url = newUrl;
          touched = true;
        } else {
          errors.push({ id: row.id, error: "image_upload_failed" });
        }
      }

      // audio_url
      const audVal = c.audio_url as string | undefined;
      if (audVal && audVal.startsWith("data:")) {
        const newUrl = await uploadDataUrl(audVal, authUser.id, "backfill-audio", sb);
        if (newUrl) {
          c.audio_url = newUrl;
          touched = true;
        } else {
          errors.push({ id: row.id, error: "audio_upload_failed" });
        }
      }

      if (touched) {
        const { error: updateErr } = await sb
          .from("hub_assets")
          .update({ content: c })
          .eq("id", row.id);
        if (updateErr) {
          errors.push({ id: row.id, error: `db_update: ${updateErr.message.slice(0, 100)}` });
          // Não dá rollback do upload — fica orfão no Storage mas é raro
        } else {
          processed++;
        }
      }
    }

    const remaining = Math.max(0, totalCandidates - processed);
    console.log(`[backfill] user=${authUser.id} processed=${processed} remaining=${remaining} errors=${errors.length}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      processed,
      remaining,
      done: remaining === 0,
      errors: errors.length > 0 ? errors : undefined,
    }, 200);

  } catch (e) {
    console.error("[backfill] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});

/**
 * Decoda data URL → Uint8Array → upload pro Supabase Storage.
 * Retorna URL pública ou null se falhar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadDataUrl(dataUrl: string, userId: string, folder: string, sb: any): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return null;
    const mime = m[1] || "image/png";
    const b64 = m[2];
    const ext = mime === "image/jpeg" ? "jpg"
      : mime === "image/webp" ? "webp"
      : mime === "audio/mpeg" ? "mp3"
      : mime === "audio/wav" ? "wav"
      : "png";

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from("hub-images").upload(path, blob, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      console.warn(`[backfill] upload failed:`, upErr.message);
      return null;
    }
    const { data: urlData } = sb.storage.from("hub-images").getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.warn(`[backfill] uploadDataUrl exception:`, e);
    return null;
  }
}
