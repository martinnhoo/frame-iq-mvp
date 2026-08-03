/**
 * useUserBrands — carrega as marcas do usuário e devolve no shape `HubBrand[]`
 * que todas as páginas do Hub já consomem.
 *
 * Substitui o antigo `HUB_BRANDS` hardcoded. A troca em cada página é uma
 * linha: `HUB_BRANDS` → `brands` vindo daqui.
 *
 * Uma marca é: nome + preferências (contexto livre) + logo + assets de
 * referência visual. Tudo reaproveitável entre imagem, vídeo, legenda,
 * storyboard e workflows.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  NO_BRAND,
  setBrandPool,
  userBrandToHubBrand,
  type HubBrand,
  type UserBrandRow,
} from "@/data/hubBrands";

interface UseUserBrandsResult {
  /** Marcas do usuário. Inclui "Sem marca" na primeira posição por padrão. */
  brands: HubBrand[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useUserBrands(includeNoBrand = true): UseUserBrandsResult {
  const [brands, setBrands] = useState<HubBrand[]>(includeNoBrand ? [NO_BRAND] : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBrandPool([NO_BRAND]);
        setBrands(includeNoBrand ? [NO_BRAND] : []);
        return;
      }

      const { data, error: qErr } = await (supabase
        .from("user_brands" as any)
        .select("id, name, notes, logo_url, markets, license")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }) as any);

      if (qErr) throw qErr;

      const mapped = ((data as UserBrandRow[]) || []).map(userBrandToHubBrand);
      const next = includeNoBrand ? [NO_BRAND, ...mapped] : mapped;
      // Publica no registro para os `getBrand(id)` espalhados pelo Hub.
      setBrandPool([NO_BRAND, ...mapped]);
      setBrands(next);
    } catch (e) {
      console.error("[useUserBrands]", e);
      setError(e instanceof Error ? e.message : "Falha ao carregar marcas");
      setBrands(includeNoBrand ? [NO_BRAND] : []);
    } finally {
      setLoading(false);
    }
  }, [includeNoBrand]);

  useEffect(() => { void load(); }, [load]);

  // Mantém a lista fresca quando a página de Marcas salva algo.
  useEffect(() => {
    const onChanged = () => { void load(); };
    window.addEventListener("brands-updated", onChanged);
    return () => window.removeEventListener("brands-updated", onChanged);
  }, [load]);

  return { brands, loading, error, reload: load };
}

/** Dispare após criar/editar/deletar marca pra atualizar o Hub inteiro. */
export function notifyBrandsUpdated() {
  window.dispatchEvent(new CustomEvent("brands-updated"));
}
