/**
 * compositeElements — junta N elementos PNG em uma imagem única com
 * fundo transparente, no aspect ratio correto pra BRIA Lifestyle Shot.
 *
 * BRIA Lifestyle Shot v1 aceita 1 product image — o output herda o
 * shape do input. Por isso compositamos sempre na resolução do output
 * desejado (1:1 → 1024x1024, 9:16 → 1024x1536, 16:9 → 1536x1024).
 *
 * Layout depende de quantos elementos:
 *   1 → centro do canvas, escala adaptativa
 *   2 → lado a lado (em landscape) ou empilhados (em portrait)
 *   3 → linha horizontal (landscape) ou coluna (portrait)
 *   4+ → grid 2x2 (5+ truncados)
 *
 * Saída: data URL PNG transparente do tamanho pedido.
 */

export interface CompositeOptions {
  width?: number;
  height?: number;
}

const DEFAULT_DIMS = { width: 1024, height: 1024 };

export async function compositeElements(
  elements: Array<{ url: string }>,
  options: CompositeOptions = {},
): Promise<string> {
  if (elements.length === 0) return "";

  const width = options.width ?? DEFAULT_DIMS.width;
  const height = options.height ?? DEFAULT_DIMS.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("compositeElements: no canvas context");

  // Carrega todas as imagens em paralelo
  const imgs = await Promise.all(
    elements.slice(0, 4).map(el =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load element image`));
        img.src = el.url;
      }),
    ),
  );

  const N = imgs.length;
  // Aspect ratio dita orientation: portrait (height > width) usa stack
  // vertical pra elementos múltiplos; landscape/square usa horizontal.
  const isPortrait = height > width;

  if (N === 1) {
    // Centralizado, escala adaptativa: ocupa ~70% do menor lado
    const img = imgs[0];
    const targetSize = Math.min(width, height) * 0.70;
    const scale = Math.min(targetSize / img.width, targetSize / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  } else if (N === 2) {
    // Portrait → empilha vertical; landscape/square → lado a lado
    if (isPortrait) {
      const sectionHeight = height / 2;
      for (let i = 0; i < 2; i++) {
        const img = imgs[i];
        const targetSize = Math.min(width, sectionHeight) * 0.80;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, i * sectionHeight + (sectionHeight - h) / 2, w, h);
      }
    } else {
      const sectionWidth = width / 2;
      for (let i = 0; i < 2; i++) {
        const img = imgs[i];
        const targetSize = Math.min(sectionWidth, height) * 0.80;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, i * sectionWidth + (sectionWidth - w) / 2, (height - h) / 2, w, h);
      }
    }
  } else if (N === 3) {
    // Portrait → coluna; landscape → linha
    if (isPortrait) {
      const sectionHeight = height / 3;
      for (let i = 0; i < 3; i++) {
        const img = imgs[i];
        const targetSize = Math.min(width, sectionHeight) * 0.80;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, i * sectionHeight + (sectionHeight - h) / 2, w, h);
      }
    } else {
      const sectionWidth = width / 3;
      for (let i = 0; i < 3; i++) {
        const img = imgs[i];
        const targetSize = Math.min(sectionWidth, height) * 0.80;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, i * sectionWidth + (sectionWidth - w) / 2, (height - h) / 2, w, h);
      }
    }
  } else {
    // 4+ elementos: grid 2x2 sempre (independente de orientation)
    const cellW = width / 2;
    const cellH = height / 2;
    for (let i = 0; i < Math.min(N, 4); i++) {
      const img = imgs[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const targetSize = Math.min(cellW, cellH) * 0.80;
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(
        img,
        col * cellW + (cellW - w) / 2,
        row * cellH + (cellH - h) / 2,
        w, h,
      );
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Mapa aspect_ratio (chave do Hub) → dimensions do canvas.
 * Match com SIZE_MAP da edge function.
 */
export const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 1024 },
  "9:16": { width: 1024, height: 1536 },
};
