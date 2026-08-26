/**
 * Cliente do clip-worker-gateway.
 *
 * O worker do Fly não tem service role nem chave de IA: tudo que exige
 * privilégio passa por esta função de borda, autenticada por CLIP_WORKER_SECRET.
 * Aqui só existe HTTP.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const WORKER_SECRET = process.env.CLIP_WORKER_SECRET || "";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/clip-worker-gateway`;

export async function call(action, payload = {}, { timeoutMs = 180_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-clip-worker-secret": WORKER_SECRET },
      body: JSON.stringify({ action, payload }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`gateway ${action} falhou (${res.status}): ${JSON.stringify(body).slice(0, 400)}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** URL assinada de leitura para um caminho do bucket privado. */
export async function signedDownload(path, expiresIn = 3600) {
  const { signed_url } = await call("signed_download", { path, expires_in: expiresIn });
  return signed_url;
}

/** Sobe bytes para o bucket privado usando URL assinada de escrita. */
export async function uploadBytes(path, bytes, contentType = "application/octet-stream") {
  const { signed_url } = await call("signed_upload", { path });
  const res = await fetch(signed_url, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload assinado falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return path;
}

/**
 * Shim mínimo com a forma do supabase-js que o mediaResolver usa
 * (`supabase.storage.from(bucket).download(path)`), implementado sobre a
 * signed URL. Mantém o resolver intocado.
 */
export const storageShim = {
  storage: {
    from() {
      return {
        async download(path) {
          try {
            const url = await signedDownload(path, 3600);
            const res = await fetch(url);
            if (!res.ok) return { data: null, error: new Error(`download ${res.status}`) };
            return { data: await res.blob(), error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      };
    },
  },
};
