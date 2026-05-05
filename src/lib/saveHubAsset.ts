/**
 * saveHubAsset — persiste asset gerado em creative_memory direto do
 * frontend (RLS permite usuário gravar próprias linhas).
 *
 * Por que daqui: o edge function tava falhando silenciosamente no
 * INSERT (provável tamanho de payload ou algum trigger). Saving from
 * the FE garante a row, sem depender de service-role do server.
 *
 * Tipos de asset suportados:
 *   - hub_image     → Image Studio
 *   - hub_png       → PNG generator
 *   - hub_storyboard → Storyboard (uma row por cena, agrupadas por
 *                      storyboard_id)
 *   - hub_carousel  → Carousel (uma row por slide, agrupadas por
 *                      carousel_id)
 */

import { supabase } from "@/integrations/supabase/client";

export type HubAssetType = "hub_image" | "hub_png" | "hub_storyboard" | "hub_carousel";

export interface SaveHubAssetInput {
  userId: string;
  type: HubAssetType;
  /** Payload completo (vai dentro de creative_memory.content as jsonb). */
  content: Record<string, unknown>;
}

export async function saveHubAsset(input: SaveHubAssetInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("creative_memory" as never)
      .insert({
        user_id: input.userId,
        type: input.type,
        content: input.content,
        created_at: new Date().toISOString(),
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
      type: r.type,
      content: r.content,
      created_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("creative_memory" as never)
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
