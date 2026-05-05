/**
 * saveHubAsset — persiste asset gerado em hub_assets direto do
 * frontend (RLS permite usuário gravar próprias linhas).
 *
 * IMPORTANTE: usa tabela DEDICADA `hub_assets` (não creative_memory).
 * creative_memory é da feature de Meta Ads analytics — tem schema
 * rígido (hook_type, platform, market, ctr, roas, etc.) sem coluna
 * `type` nem `content`. Tentar escrever lá falhava silenciosamente
 * com "column type does not exist".
 *
 * Tipos de asset suportados (campo `kind`):
 *   - hub_image     → Image Studio
 *   - hub_png       → PNG generator
 *   - hub_storyboard → Storyboard (uma row por cena, agrupadas por
 *                      content.storyboard_id)
 *   - hub_carousel  → Carousel (uma row por slide, agrupadas por
 *                      content.carousel_id)
 */

import { supabase } from "@/integrations/supabase/client";

export type HubAssetType = "hub_image" | "hub_png" | "hub_storyboard" | "hub_carousel" | "hub_transcribe";

export interface SaveHubAssetInput {
  userId: string;
  type: HubAssetType;
  /** Payload completo (vai dentro de hub_assets.content as jsonb). */
  content: Record<string, unknown>;
}

export async function saveHubAsset(input: SaveHubAssetInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("hub_assets" as never)
      .insert({
        user_id: input.userId,
        kind: input.type,
        content: input.content,
      } as never)
      .select("id")
      .single();
    if (error) {
      console.warn("[saveHubAsset] error:", error.message, error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: (data as { id?: string })?.id };
  } catch (e) {
    console.warn("[saveHubAsset] exception:", e);
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

/** Persiste múltiplas rows de uma vez (storyboard / carousel). */
export async function saveHubAssets(rows: SaveHubAssetInput[]): Promise<{ ok: boolean; count: number; error?: string }> {
  if (rows.length === 0) return { ok: true, count: 0 };
  try {
    const payload = rows.map(r => ({
      user_id: r.userId,
      kind: r.type,
      content: r.content,
    }));
    const { error } = await supabase
      .from("hub_assets" as never)
      .insert(payload as never);
    if (error) {
      console.warn("[saveHubAssets] error:", error.message, error);
      return { ok: false, count: 0, error: error.message };
    }
    return { ok: true, count: rows.length };
  } catch (e) {
    console.warn("[saveHubAssets] exception:", e);
    return { ok: false, count: 0, error: String(e).slice(0, 200) };
  }
}
