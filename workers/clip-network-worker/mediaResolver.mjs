/**
 * mediaResolver — a única porta de entrada de mídia no pipeline de cortes.
 *
 * Por que existir isolado: a estratégia de obtenção é a parte mais instável do
 * sistema (muda de provedor, muda de ferramenta, muda de política). Todo o
 * resto do worker só conhece `resolveMedia()` e recebe um caminho de arquivo
 * local. Trocar a estratégia depois não deve exigir tocar em transcrição,
 * análise, render ou banco.
 *
 * ── Limites deliberados ─────────────────────────────────────────────────────
 * - Só atua em fonte com rights_confirmed = true. Sem autorização explícita
 *   registrada no banco, a função recusa antes de qualquer requisição de rede.
 * - Nenhum mecanismo de evasão: sem bypass de DRM, sem anti-detecção, sem
 *   proxy, sem captcha. Se a obtenção normal falhar, o erro sobe claro e o job
 *   para. Falhar visível é o comportamento correto aqui.
 * - O master é temporário: vive no diretório do job e é apagado pelo chamador.
 */
import { spawn } from "node:child_process";
import { stat, readdir } from "node:fs/promises";
import { join } from "node:path";

export class MediaResolverError extends Error {
  constructor(message, { code = "media_resolver_failed", retryable = true } = {}) {
    super(message);
    this.name = "MediaResolverError";
    this.code = code;
    this.retryable = retryable;
  }
}

function run(bin, args, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new MediaResolverError(`${bin} excedeu o tempo limite`, { code: "timeout" }));
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); reject(new MediaResolverError(`${bin} indisponível: ${e.message}`, { code: "tool_missing", retryable: false })); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new MediaResolverError(`${bin} saiu com código ${code}: ${(stderr || stdout).slice(-1500)}`, { code: "tool_failed" }));
    });
  });
}

/**
 * Traduz o erro cru da ferramenta em algo que o dashboard possa mostrar sem
 * que alguém precise abrir o log do Fly. Um bloqueio da plataforma não é bug
 * nosso e não deve ser retentado em laço: marcamos como não-retentável.
 */
function classifyDownloadError(raw) {
  const text = String(raw || "").toLowerCase();
  if (text.includes("sign in to confirm") || text.includes("bot")) {
    return new MediaResolverError(
      "O YouTube exigiu verificação para servir esta mídia. Obtenção normal bloqueada — nenhum contorno será tentado. Baixe o master manualmente e use o upload de fallback.",
      { code: "provider_blocked", retryable: false },
    );
  }
  if (text.includes("private video") || text.includes("members-only") || text.includes("unavailable") || text.includes("removed")) {
    return new MediaResolverError("Vídeo indisponível na origem (privado, restrito ou removido).", { code: "source_unavailable", retryable: false });
  }
  if (text.includes("drm") || text.includes("protected")) {
    return new MediaResolverError("Mídia protegida. O AdBrief não contorna proteção de conteúdo.", { code: "drm_protected", retryable: false });
  }
  if (text.includes("http error 429") || text.includes("too many requests")) {
    return new MediaResolverError("Origem limitou a taxa de requisições. Tentar novamente mais tarde.", { code: "rate_limited", retryable: true });
  }
  return new MediaResolverError(String(raw).slice(0, 1200), { code: "download_failed", retryable: true });
}

async function pickDownloadedFile(dir) {
  const files = (await readdir(dir)).filter((f) => f.startsWith("master."));
  if (!files.length) throw new MediaResolverError("Download terminou sem produzir arquivo", { code: "empty_output" });
  const sized = await Promise.all(files.map(async (f) => ({ f, size: (await stat(join(dir, f))).size })));
  sized.sort((a, b) => b.size - a.size);
  if (sized[0].size < 100_000) throw new MediaResolverError("Arquivo baixado é muito pequeno para ser o master", { code: "empty_output" });
  return join(dir, sized[0].f);
}

/**
 * Estratégia YouTube. Usa yt-dlp com o cliente padrão e sem nenhuma opção de
 * evasão. `MAX_HEIGHT` limita a resolução porque o corte final é 1080x1920:
 * baixar 4K só gastaria disco, banda e CPU de escala.
 */
const youtubeStrategy = {
  id: "youtube:yt-dlp",
  supports: (source) => source.provider === "youtube",
  async download({ video, dir, onProgress }) {
    const url = video.source_url || (video.provider_video_id ? `https://www.youtube.com/watch?v=${video.provider_video_id}` : null);
    if (!url) throw new MediaResolverError("Vídeo sem URL de origem", { code: "missing_url", retryable: false });
    const maxHeight = Number(process.env.CLIP_MAX_HEIGHT || 1080);
    onProgress?.("baixando master do YouTube");
    try {
      await run("yt-dlp", [
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--retries", "3",
        "--fragment-retries", "3",
        "-f", `bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/bv*+ba/b`,
        "--merge-output-format", "mp4",
        "-o", join(dir, "master.%(ext)s"),
        url,
      ]);
    } catch (e) {
      throw classifyDownloadError(e.message);
    }
    return pickDownloadedFile(dir);
  },
};

/**
 * Fallback de depuração: master já presente no bucket (upload manual). Continua
 * existindo de propósito — quando a origem bloqueia, é o caminho legítimo para
 * seguir com um master que você obteve por conta própria. Não é o fluxo
 * principal.
 */
const storageStrategy = {
  id: "storage:manual",
  supports: () => true,
  async download({ video, dir, supabase, bucket, onProgress }) {
    if (!video.media_storage_path && !video.media_url) {
      throw new MediaResolverError(
        "Nenhuma estratégia de obtenção disponível para esta fonte.",
        { code: "no_strategy", retryable: false },
      );
    }
    onProgress?.("carregando master já existente");
    const { writeFile } = await import("node:fs/promises");
    const out = join(dir, "master.mp4");
    if (video.media_storage_path) {
      const { data, error } = await supabase.storage.from(bucket).download(video.media_storage_path);
      if (error) throw new MediaResolverError(`Falha ao ler master do storage: ${error.message}`, { code: "storage_read_failed" });
      await writeFile(out, new Uint8Array(await data.arrayBuffer()));
    } else {
      const res = await fetch(video.media_url);
      if (!res.ok) throw new MediaResolverError(`Falha ao baixar master (${res.status})`, { code: "http_failed" });
      await writeFile(out, new Uint8Array(await res.arrayBuffer()));
    }
    return pickDownloadedFile(dir);
  },
};

const strategies = [storageStrategy, youtubeStrategy];

/**
 * @returns {Promise<{path:string, strategy:string}>} caminho local do master.
 * O chamador é responsável por apagar o diretório ao terminar.
 */
export async function resolveMedia({ video, source, dir, supabase, bucket = "clip-network", onProgress }) {
  if (!source?.rights_confirmed || !video?.rights_confirmed) {
    throw new MediaResolverError(
      "Fonte sem autorização confirmada. A obtenção de mídia só roda em fontes marcadas como autorizadas.",
      { code: "rights_not_confirmed", retryable: false },
    );
  }
  // Um master já materializado tem prioridade: reprocessar não deve rebaixar
  // nem repagar a obtenção.
  const ordered = (video.media_storage_path || video.media_url)
    ? strategies
    : strategies.filter((s) => s !== storageStrategy);

  let lastError = null;
  for (const strategy of ordered) {
    if (!strategy.supports(source)) continue;
    try {
      const path = await strategy.download({ video, source, dir, supabase, bucket, onProgress });
      return { path, strategy: strategy.id };
    } catch (e) {
      lastError = e;
      // Erro não-retentável para essa estratégia não deve ser mascarado por um
      // fallback silencioso: se o YouTube bloqueou, o job precisa parar com o
      // motivo real na tela.
      if (e instanceof MediaResolverError && e.retryable === false) throw e;
    }
  }
  throw lastError || new MediaResolverError("Nenhuma estratégia de obtenção aplicável", { code: "no_strategy", retryable: false });
}

export async function probeDuration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ], { timeoutMs: 60_000 });
  const value = Number(String(stdout).trim());
  return Number.isFinite(value) ? value : null;
}
