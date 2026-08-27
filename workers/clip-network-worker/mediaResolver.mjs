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
import {
  stat,
  readdir,
  mkdir,
  copyFile,
  rename,
  rm,
} from "node:fs/promises";
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

function minimumSourceDuration() {
  const configured = Number(process.env.CLIP_MIN_SOURCE_DURATION_SECONDS || 181);
  return Number.isFinite(configured) && configured > 0 ? configured : 181;
}


let lastCachePruneAt = 0;

function mediaCacheRoot() {
  return process.env.CLIP_MASTER_CACHE_DIR || "/data/cache/clip-masters";
}

function mediaCacheTtlMs() {
  const hours = Number(
    process.env.CLIP_MASTER_CACHE_TTL_HOURS || 48
  );

  return Math.max(1,hours) * 60 * 60 * 1000;
}

function mediaCacheMaxBytes() {
  const gb = Number(
    process.env.CLIP_MASTER_CACHE_MAX_GB || 6
  );

  return Math.max(1,gb) * 1024 * 1024 * 1024;
}

function cacheId(video) {
  return String(
    video?.id ||
    video?.provider_video_id ||
    ""
  ).replace(/[^a-zA-Z0-9_-]/g,"");
}

function cachePath(video) {
  const id=cacheId(video);

  return id
    ? join(mediaCacheRoot(), id + ".mp4")
    : null;
}

async function pruneMediaCache() {
  // No máximo uma limpeza a cada 10 minutos.
  if(
    Date.now() - lastCachePruneAt <
    10 * 60 * 1000
  ){
    return;
  }

  lastCachePruneAt=Date.now();

  const root=mediaCacheRoot();

  await mkdir(root,{recursive:true});

  const names=await readdir(root);

  const entries=[];

  for(const name of names){
    if(!name.endsWith(".mp4")) continue;

    const path=join(root,name);

    try{
      const info=await stat(path);

      if(
        info.size < 100000 ||
        Date.now() - info.mtimeMs >
          mediaCacheTtlMs()
      ){
        await rm(path,{force:true});
        continue;
      }

      entries.push({
        path,
        size:info.size,
        mtimeMs:info.mtimeMs,
      });
    }catch{
      // arquivo desapareceu durante limpeza
    }
  }

  let total=entries.reduce(
    (sum,item)=>sum+item.size,
    0
  );

  if(total <= mediaCacheMaxBytes()){
    return;
  }

  // Remove primeiro os masters mais antigos.
  entries.sort(
    (a,b)=>a.mtimeMs-b.mtimeMs
  );

  for(const item of entries){
    if(total <= mediaCacheMaxBytes()){
      break;
    }

    await rm(item.path,{force:true});

    total-=item.size;
  }
}

async function getCachedMaster(
  video,
  onProgress
){
  const path=cachePath(video);

  if(!path) return null;

  try{
    const info=await stat(path);

    if(
      info.size < 100000 ||
      Date.now() - info.mtimeMs >
        mediaCacheTtlMs()
    ){
      await rm(path,{force:true});
      return null;
    }

    onProgress?.(
      "reutilizando master do cache local"
    );

    return path;
  }catch{
    return null;
  }
}

async function persistMasterCache(
  video,
  sourcePath
){
  const finalPath=cachePath(video);

  if(!finalPath){
    return sourcePath;
  }

  await mkdir(
    mediaCacheRoot(),
    {recursive:true}
  );

  const tempPath=
    finalPath +
    "." +
    process.pid +
    ".tmp";

  await copyFile(
    sourcePath,
    tempPath
  );

  await rename(
    tempPath,
    finalPath
  );

  return finalPath;
}

/** Validação pura para o guard long-form; metadata sem duração segue o fluxo normal. */
export function enforceMinimumDuration(metadata, threshold = minimumSourceDuration()) {
  const duration = Number(metadata?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (duration < threshold) {
    throw new MediaResolverError(
      `Fonte ignorada por ser curta: ${Math.round(duration)}s (mínimo ${threshold}s para conteúdo long-form).`,
      { code: "source_too_short", retryable: false },
    );
  }
  return duration;
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

    onProgress?.("verificando duração da fonte");
    let metadata;
    try {
      const { stdout } = await run("yt-dlp", [
        "--skip-download",
        "--dump-single-json",
        "--no-playlist",
        url,
      ], { timeoutMs: 120_000 });
      metadata = JSON.parse(stdout);
    } catch (e) {
      throw classifyDownloadError(e?.message || e);
    }
    const metadataDuration = enforceMinimumDuration(metadata);
    if (metadataDuration == null) {
      onProgress?.("duração indisponível na metadata; seguindo obtenção normal");
    }

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
export async function resolveMedia({
  video,
  source,
  dir,
  supabase,
  bucket = "clip-network",
  onProgress,
}) {
  if (
    !source?.rights_confirmed ||
    !video?.rights_confirmed
  ) {
    throw new MediaResolverError(
      "Fonte sem autorização confirmada. A obtenção de mídia só roda em fontes marcadas como autorizadas.",
      {
        code: "rights_not_confirmed",
        retryable: false,
      },
    );
  }

  await pruneMediaCache().catch(
    () => {}
  );

  // Primeiro tenta o volume persistente do Fly.
  const cached =
    await getCachedMaster(
      video,
      onProgress,
    );

  if(cached){
    return {
      path: cached,
      strategy: "cache:fly-volume",
    };
  }

  const ordered =
    (
      video.media_storage_path ||
      video.media_url
    )
      ? strategies
      : strategies.filter(
          strategy =>
            strategy !== storageStrategy
        );

  let lastError=null;

  for(const strategy of ordered){
    if(!strategy.supports(source)){
      continue;
    }

    try{
      const downloaded =
        await strategy.download({
          video,
          source,
          dir,
          supabase,
          bucket,
          onProgress,
        });

      let finalPath=downloaded;

      try{
        finalPath=
          await persistMasterCache(
            video,
            downloaded,
          );

        if(finalPath !== downloaded){
          onProgress?.(
            "master salvo no cache local"
          );
        }
      }catch(cacheError){
        console.warn(
          "[media-cache] não foi possível persistir master:",
          cacheError?.message || cacheError
        );

        // Cache nunca pode quebrar o pipeline.
        finalPath=downloaded;
      }

      return {
        path: finalPath,
        strategy:
          finalPath === downloaded
            ? strategy.id
            : strategy.id + "+cache",
      };
    }catch(error){
      lastError=error;

      if(
        error instanceof MediaResolverError &&
        error.retryable === false
      ){
        throw error;
      }
    }
  }

  throw (
    lastError ||
    new MediaResolverError(
      "Nenhuma estratégia de obtenção aplicável",
      {
        code:"no_strategy",
        retryable:false,
      },
    )
  );
}

export async function probeDuration(file) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ], { timeoutMs: 60_000 });
  const value = Number(String(stdout).trim());
  return Number.isFinite(value) ? value : null;
}
