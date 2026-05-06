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

  // Padding interno: mantém 12% de margem em todos os lados pra que o
  // BRIA tenha "espaço de respiração" pra gerar a cena sem encostar em
  // edges. Sem isso, ele tende a expandir o cenário e cortar headlines/
  // detalhes nas bordas.
  const PADDING = 0.12;
  const safeWidth = width * (1 - 2 * PADDING);
  const safeHeight = height * (1 - 2 * PADDING);
  const safeX = width * PADDING;
  const safeY = height * PADDING;

  if (N === 1) {
    // Centralizado dentro da safe area, escala adaptativa
    const img = imgs[0];
    const targetSize = Math.min(safeWidth, safeHeight) * 0.85;
    const scale = Math.min(targetSize / img.width, targetSize / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
  } else if (N === 2) {
    if (isPortrait) {
      const sectionHeight = safeHeight / 2;
      for (let i = 0; i < 2; i++) {
        const img = imgs[i];
        const targetSize = Math.min(safeWidth, sectionHeight) * 0.85;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, safeY + i * sectionHeight + (sectionHeight - h) / 2, w, h);
      }
    } else {
      const sectionWidth = safeWidth / 2;
      for (let i = 0; i < 2; i++) {
        const img = imgs[i];
        const targetSize = Math.min(sectionWidth, safeHeight) * 0.85;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, safeX + i * sectionWidth + (sectionWidth - w) / 2, (height - h) / 2, w, h);
      }
    }
  } else if (N === 3) {
    if (isPortrait) {
      const sectionHeight = safeHeight / 3;
      for (let i = 0; i < 3; i++) {
        const img = imgs[i];
        const targetSize = Math.min(safeWidth, sectionHeight) * 0.85;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, safeY + i * sectionHeight + (sectionHeight - h) / 2, w, h);
      }
    } else {
      const sectionWidth = safeWidth / 3;
      for (let i = 0; i < 3; i++) {
        const img = imgs[i];
        const targetSize = Math.min(sectionWidth, safeHeight) * 0.85;
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, safeX + i * sectionWidth + (sectionWidth - w) / 2, (height - h) / 2, w, h);
      }
    }
  } else {
    // 4+ elementos: grid 2x2 dentro da safe area
    const cellW = safeWidth / 2;
    const cellH = safeHeight / 2;
    for (let i = 0; i < Math.min(N, 4); i++) {
      const img = imgs[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const targetSize = Math.min(cellW, cellH) * 0.85;
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(
        img,
        safeX + col * cellW + (cellW - w) / 2,
        safeY + row * cellH + (cellH - h) / 2,
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
