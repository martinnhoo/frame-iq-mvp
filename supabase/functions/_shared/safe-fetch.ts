// safe-fetch — baixar URL que veio do corpo do request sem virar SSRF.
//
// Três funções do Hub recebem uma URL do cliente e dão fetch nela:
// hub-bria-bg-remove (imagem), hub-caption-gen (vídeo para o Whisper) e
// hub-faceswap (HEAD de validação). Nenhuma conferia nada.
//
// O alvo interessante é o serviço de metadados da nuvem — 169.254.169.254 —
// e qualquer coisa em rede privada que o runtime alcance. No caption-gen o
// buraco é pior que leitura cega: o conteúdo baixado vai para o Whisper e o
// transcript volta no corpo da resposta, o que é um canal de exfiltração.
//
// Não dá para exigir que a URL seja sempre do nosso Storage: o produto aceita
// imagem de fora. Então a regra é por destino, não por origem — bloqueia o
// que não deveria ser alcançável de jeito nenhum.

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,                       // link-local, inclui o metadata da AWS/GCP
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
  /^198\.(1[89])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^203\.0\.113\./,
  /^2(2[4-9]|3\d)\./,                  // multicast
  /^24[0-9]\./, /^25[0-5]\./,          // reservado
];

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;

  // IPv6: ::1, fc00::/7 (ULA), fe80::/10 (link-local), e ::ffff:x.x.x.x
  if (h === "::1" || h === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return PRIVATE_V4.some((re) => re.test(mapped[1]));

  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return PRIVATE_V4.some((re) => re.test(h));

  return false;
}

/** Devolve a URL se for segura para buscar, ou null com o motivo no log. */
export function safeMediaUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;

  // data: URL é conteúdo embutido, não vai para a rede.
  if (raw.startsWith("data:image/") || raw.startsWith("data:video/")) return raw;

  let u: URL;
  try { u = new URL(raw); } catch { return null; }

  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  // Credencial embutida serve para esconder o host real do olho humano
  // (https://storage.supabase.co@evil.com/...). Não temos uso legítimo.
  if (u.username || u.password) return null;

  if (isBlockedHost(u.hostname)) {
    console.warn(`[safe-fetch] host bloqueado: ${u.hostname}`);
    return null;
  }
  return u.toString();
}

/**
 * fetch com a checagem aplicada e sem seguir redirect — seguir redirect
 * anularia a checagem, porque o primeiro salto pode ser um host público que
 * responde 302 para 169.254.169.254.
 */
export async function safeFetch(raw: unknown, init: RequestInit = {}): Promise<Response> {
  const url = safeMediaUrl(raw);
  if (!url) throw new Error("blocked_url");
  const res = await fetch(url, { ...init, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    const safeNext = next ? safeMediaUrl(new URL(next, url).toString()) : null;
    if (!safeNext) throw new Error("blocked_redirect");
    return await fetch(safeNext, { ...init, redirect: "manual" });
  }
  return res;
}
