/**
 * brand-context — carrega o contexto da marca do usuário para injetar no prompt.
 *
 * Substitui os mapas hardcoded que existiam em hub-caption-gen (BRAND_HINTS)
 * e execute-workflow (SERVER_HUB_BRANDS), onde BETBUS/ELUCK/COME/FUNILIVE
 * viviam em código. Agora toda marca é do usuário, vinda de `user_brands`.
 *
 * Fonte da verdade: tabela `user_brands` (nome, notes, logo_url) +
 * `brand_assets` (referências visuais).
 */

export interface BrandContext {
  id: string;
  name: string;
  /** Preferências/contexto escritos pelo usuário — vai direto pro prompt. */
  promptHint: string;
  logoUrl: string | null;
  /** URLs de assets de referência visual, na ordem de relevância. */
  assetUrls: string[];
}

/**
 * Carrega a marca. Retorna null quando não há marca, quando o id é "none",
 * ou quando a marca não pertence ao usuário.
 *
 * O filtro por `user_id` não é opcional: sem ele, um id de marca vazado
 * permitiria ler o contexto de marca de outro cliente.
 */
export async function loadBrandContext(
  sb: any,
  brandId: string | null | undefined,
  userId: string,
  maxAssets = 3,
): Promise<BrandContext | null> {
  if (!brandId || brandId === "none") return null;

  // uuid v4 — ids antigos ("betbus", "eluck") caem fora daqui de propósito.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId);
  if (!isUuid) {
    console.warn(`[brand-context] id de marca legado ignorado: ${brandId}`);
    return null;
  }

  try {
    const { data: brand, error } = await sb
      .from("user_brands")
      .select("id, name, notes, logo_url")
      .eq("id", brandId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !brand) return null;

    const { data: assets } = await sb
      .from("brand_assets")
      .select("asset_url, kind, position")
      .eq("brand_id", brandId)
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .limit(maxAssets);

    return {
      id: brand.id,
      name: brand.name,
      promptHint: (brand.notes || "").trim(),
      logoUrl: brand.logo_url || null,
      assetUrls: (assets || []).map((a: any) => a.asset_url).filter(Boolean),
    };
  } catch (e) {
    console.error("[brand-context] falha ao carregar marca:", e);
    return null;
  }
}

/**
 * Monta o trecho de prompt da marca.
 *
 * O contexto do usuário é tratado como preferência de marca, não como
 * instrução de sistema — se ele escrever algo conflitante, o prompt da
 * geração continua mandando.
 */
export function buildBrandPromptBlock(brand: BrandContext | null): string {
  if (!brand) return "";
  const parts: string[] = [`Brand: ${brand.name}.`];
  if (brand.promptHint) {
    parts.push(`Brand guidelines and preferences (follow unless the user's prompt says otherwise): ${brand.promptHint}`);
  }
  if (brand.assetUrls.length > 0) {
    parts.push(`${brand.assetUrls.length} reference image(s) from this brand are attached — match their visual style, palette and typography.`);
  }
  return parts.join(" ");
}
