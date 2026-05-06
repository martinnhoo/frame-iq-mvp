/**
 * compositeElements — junta N elementos PNG em uma imagem única com
 * fundo transparente, pra mandar como input pra BRIA Lifestyle Shot.
 *
 * BRIA Lifestyle Shot v1 aceita 1 product image. Pra suportar múltiplos
 * elementos (mascote + ícone + objeto), pré-compositamos via canvas no
 * frontend. Layout depende de quantos:
 *   1 elemento → centro, escala 80%
 *   2 elementos → lado a lado
 *   3 elementos → linha horizontal de 3
 *   4+ elementos → grid 2x2 (5+ truncados)
 *
 * Saída: data URL PNG transparente 1024x1024 pronto pro BRIA.
 */

export async function compositeElements(
  elements: Array<{ url: string }>,
  canvasSize = 1024,
): Promise<string> {
  if (elements.length === 0) return "";
  if (elements.length === 1) return elements[0].url; // sem trabalho extra

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("compositeElements: no canvas context");

  // Carrega todas as imagens em paralelo
  const imgs = await Promise.all(
    elements.map(el =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load element image`));
        img.src = el.url;
      }),
    ),
  );

  // Fundo transparente (default do canvas)
  const N = Math.min(imgs.length, 4); // máx 4 — 5+ trunca

  if (N === 2) {
    // Lado a lado, cada um ~45% da largura
    const sectionWidth = canvasSize / 2;
    for (let i = 0; i < 2; i++) {
      const img = imgs[i];
      const targetSize = sectionWidth * 0.85;
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const sectionX = i * sectionWidth;
      ctx.drawImage(
        img,
        sectionX + (sectionWidth - w) / 2,
        (canvasSize - h) / 2,
        w, h,
      );
    }
  } else if (N === 3) {
    // Linha horizontal de 3
    const sectionWidth = canvasSize / 3;
    for (let i = 0; i < 3; i++) {
      const img = imgs[i];
      const targetSize = sectionWidth * 0.85;
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const sectionX = i * sectionWidth;
      ctx.drawImage(
        img,
        sectionX + (sectionWidth - w) / 2,
        (canvasSize - h) / 2,
        w, h,
      );
    }
  } else {
    // 4 elementos: grid 2x2
    const cellSize = canvasSize / 2;
    for (let i = 0; i < 4; i++) {
      const img = imgs[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const targetSize = cellSize * 0.85;
      const scale = Math.min(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(
        img,
        col * cellSize + (cellSize - w) / 2,
        row * cellSize + (cellSize - h) / 2,
        w, h,
      );
    }
  }

  return canvas.toDataURL("image/png");
}
