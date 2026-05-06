/**
 * uploadAssetToStorage — converte data URL → Storage URL pública.
 *
 * Antes de salvar em hub_assets, se o image_url é uma data URL (~2MB
 * embebido), fazemos upload pro Supabase Storage e trocamos pela URL
 * pública (~80 chars). Reduz drasticamente o tamanho dos rows do banco.
 *
 * Aplica a TODOS os pontos onde frontend salva asset:
 *   - HubImageGenerator (após composeImage que retorna data URL)
 *   - HubPngGenerator (após bg-remove)
 *   - HubStoryboard (cada cena)
 *   - HubCarousel (cada slide)
 *
 * Se Storage upload falhar, retorna a data URL original (fallback) —
 * não quebra geração, só fica gordo no DB.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "hub-images";

/**
 * Recebe uma string que pode ser:
 *   - data URL (data:image/png;base64,...)
 *   - URL pública (https://...)
 *
 * Se for data URL, faz upload pro Storage e retorna URL pública.
 * Se já for URL pública, retorna ela mesma sem fazer nada.
 *
 * @param folder subpasta dentro de {user_id}/ (ex: "generated", "png", "storyboard")
 */
export async function uploadAssetToStorage(
  imageUrl: string,
  folder: string = "generated",
): Promise<string> {
  // Já é URL pública — retorna como tá
  if (!imageUrl.startsWith("data:")) return imageUrl;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      console.warn("[uploadAssetToStorage] not authenticated, returning data URL");
      return imageUrl;
    }

    // Parse data URL
    const m = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return imageUrl;
    const mime = m[1] || "image/png";
    const b64 = m[2];
    const ext = mime === "image/jpeg" ? "jpg"
      : mime === "image/webp" ? "webp"
      : "png";

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });

    const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      console.warn("[uploadAssetToStorage] upload failed:", upErr.message);
      return imageUrl; // fallback — salva como data URL no DB
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!urlData?.publicUrl) {
      console.warn("[uploadAssetToStorage] no public URL after upload");
      return imageUrl;
    }
    return urlData.publicUrl;
  } catch (e) {
    console.warn("[uploadAssetToStorage] exception:", e);
    return imageUrl; // fallback graceful
  }
}
