/**
 * compressPng — garante que um PNG (data URL) fique abaixo do limite
 * de bytes especificado, pra poder ser usado como elemento (max 2MB).
 *
 * Estratégia:
 *   1. Calcula tamanho atual a partir do base64
 *   2. Se já tá abaixo, retorna sem mexer
 *   3. Senão, escala dimensões pra baixo iterativamente (em passos de
 *      15%) até bater o limite
 *   4. Floor de 30% (não diminui infinitamente — se nem em 30% couber,
 *      retorna o último resultado)
 *
 * Mantém formato PNG (preserva transparência). Não perde alpha channel.
 */

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function compressPngIfNeeded(
  dataUrl: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<string> {
  if (!dataUrl) return dataUrl;
  if (approxDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

  // Carrega imagem
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Failed to load image for compression"));
    i.src = dataUrl;
  });

  let scale = 1;
  let current = dataUrl;
  const minScale = 0.3;

  while (approxDataUrlBytes(current) > maxBytes && scale > minScale) {
    scale -= 0.15;
    const canvas = document.createElement("canvas");
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    // Habilita smoothing pra melhor qualidade no resize
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    current = canvas.toDataURL("image/png");
  }

  return current;
}

function approxDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  // base64 → binary: cada 4 chars = 3 bytes
  return Math.floor(b64.length * 0.75);
}
