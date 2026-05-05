/**
 * composeImageWithLicense — compõe license disclaimer no rodapé da imagem.
 *
 * Por que client-side (Canvas) ao invés de pedir pra IA gerar:
 *   Modelos de imagem (DALL-E 3, gpt-image-2) não conseguem renderizar
 *   100+ palavras de texto fino legivelmente. O resultado fica
 *   garbled/borrado. A solução real usada por agências é compor
 *   pós-produção: gerar imagem clean, sobrepor disclaimer com text-renderer
 *   real (ex: Photoshop, Canvas).
 *
 * Estratégia:
 *   1. Carrega imagem original (fetch como blob → data URL pra contornar CORS)
 *   2. Mede o texto pra calcular altura da faixa
 *   3. Desenha imagem original
 *   4. Sobrepõe faixa preta semi-transparente no rodapé
 *   5. Word-wrap o texto e desenha em branco
 *   6. Exporta como data URL PNG
 *
 * Output: data URL (image/png) pronto pra exibir/baixar.
 */

async function fetchAsDataUrl(url: string): Promise<string> {
  // Se já é data URL, retorna direto
  if (url.startsWith("data:")) return url;
  const r = await fetch(url);
  const blob = await r.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function composeImageWithLicense(
  sourceUrl: string,
  licenseText: string,
): Promise<string> {
  // 1. Buscar como data URL pra evitar canvas tainted (CORS)
  const dataUrl = await fetchAsDataUrl(sourceUrl);
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // 2. Desenha imagem original
  ctx.drawImage(img, 0, 0);

  // 3. Calcula dimensões da faixa baseado no tamanho da imagem
  // Font size escala com largura: 1024px → ~12px font; 1536px → ~17px
  const fontSize = Math.max(11, Math.round(W / 90));
  const padX = Math.round(fontSize * 1.4);
  const padTop = Math.round(fontSize * 0.85);
  const padBottom = Math.round(fontSize * 0.85);
  const lineHeight = Math.round(fontSize * 1.35);

  // Word wrap pra calcular altura final da faixa
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  const lines = wrapText(ctx, licenseText, W - padX * 2);
  const stripHeight = padTop + lines.length * lineHeight + padBottom;

  // 4. Desenha faixa escura semi-transparente no rodapé
  // Gradient sutil pro topo da faixa pra integrar visualmente com a imagem
  const gradient = ctx.createLinearGradient(0, H - stripHeight, 0, H - stripHeight + Math.min(20, stripHeight / 4));
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.92)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, H - stripHeight, W, stripHeight);

  // Faixa principal sólida (compensa a transição)
  const mainStripStart = H - stripHeight + Math.min(20, stripHeight / 4);
  ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
  ctx.fillRect(0, mainStripStart, W, H - mainStripStart);

  // 5. Desenha texto branco
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";

  let y = H - stripHeight + padTop;
  for (const line of lines) {
    ctx.fillText(line, padX, y);
    y += lineHeight;
  }

  // 6. Exporta
  return canvas.toDataURL("image/png");
}
