/**
 * composeImageWithLicense — composição pós-produção via Canvas.
 *
 * Aplica:
 *   - Logo da marca no canto superior direito (opcional)
 *   - Disclaimer regulatório no rodapé (opcional)
 *
 * Por que client-side (Canvas) ao invés de pedir pra IA:
 *   Modelos de imagem não conseguem renderizar logos específicos com
 *   fidelidade nem texto fino legível. Composição em Canvas é o que
 *   agências usam (Photoshop equivalente em browser).
 *
 * Trade-off: imagem final é PNG via canvas.toDataURL — ~2-3MB. OK pro
 * uso interno (sem Storage).
 */

async function fetchAsDataUrl(url: string): Promise<string> {
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
    img.crossOrigin = "anonymous";
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

interface ComposeOptions {
  /** Texto regulatório no rodapé. Se null, não desenha. */
  licenseText?: string | null;
  /** URL ou path do PNG do logo (e.g. "/brand-logos/betbus.png"). Se null, não desenha. */
  logoUrl?: string | null;
  /** Posição do logo. Default: top-right. */
  logoPosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export async function composeImage(
  sourceUrl: string,
  options: ComposeOptions,
): Promise<string> {
  const dataUrl = await fetchAsDataUrl(sourceUrl);
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // 1. Desenha imagem original
  ctx.drawImage(img, 0, 0);

  // 2. Logo (top-right por padrão) — proporção ~12% da largura, max 200px
  if (options.logoUrl) {
    try {
      const logoData = await fetchAsDataUrl(options.logoUrl);
      const logo = await loadImage(logoData);
      const logoTargetW = Math.min(220, Math.round(W * 0.16));
      const aspect = logo.naturalWidth / logo.naturalHeight;
      const logoW = logoTargetW;
      const logoH = Math.round(logoW / aspect);
      const margin = Math.round(W * 0.03);
      const pos = options.logoPosition || "top-right";
      let lx = 0, ly = 0;
      if (pos === "top-right")    { lx = W - logoW - margin; ly = margin; }
      if (pos === "top-left")     { lx = margin;             ly = margin; }
      if (pos === "bottom-right") { lx = W - logoW - margin; ly = H - logoH - margin; }
      if (pos === "bottom-left")  { lx = margin;             ly = H - logoH - margin; }
      // Sombra sutil pra legibilidade sobre qualquer fundo
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = Math.max(4, Math.round(W / 200));
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.drawImage(logo, lx, ly, logoW, logoH);
      // Reset shadow pra não afetar o disclaimer
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    } catch (e) {
      console.warn("[compose] logo load failed:", e);
    }
  }

  // 3. License disclaimer no rodapé
  if (options.licenseText && options.licenseText.trim()) {
    const licenseText = options.licenseText.trim();
    const fontSize = Math.max(11, Math.round(W / 90));
    const padX = Math.round(fontSize * 1.4);
    const padTop = Math.round(fontSize * 0.85);
    const padBottom = Math.round(fontSize * 0.85);
    const lineHeight = Math.round(fontSize * 1.35);

    ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, licenseText, W - padX * 2);
    const stripHeight = padTop + lines.length * lineHeight + padBottom;

    // Faixa com gradient sutil no topo
    const gradient = ctx.createLinearGradient(0, H - stripHeight, 0, H - stripHeight + Math.min(20, stripHeight / 4));
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, H - stripHeight, W, stripHeight);

    const mainStripStart = H - stripHeight + Math.min(20, stripHeight / 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    ctx.fillRect(0, mainStripStart, W, H - mainStripStart);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "top";
    let y = H - stripHeight + padTop;
    for (const line of lines) {
      ctx.fillText(line, padX, y);
      y += lineHeight;
    }
  }

  return canvas.toDataURL("image/png");
}

/** Backward compat: helper que só compõe license (assinatura antiga). */
export async function composeImageWithLicense(
  sourceUrl: string,
  licenseText: string,
): Promise<string> {
  return composeImage(sourceUrl, { licenseText });
}
