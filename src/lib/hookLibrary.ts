/**
 * hookLibrary — biblioteca de copy hooks pra iGaming.
 *
 * Lê de hub_hook_library (RLS authenticated read). Usado no modal do
 * nó Variation pra preencher o textarea com hooks pré-fabricados.
 */

import { supabase } from "@/integrations/supabase/client";

export type HookCategory =
  | "urgency"
  | "value"
  | "testimonial"
  | "comparison"
  | "offer"
  | "fomo"
  | "social_proof"
  | "question";

export interface HookRow {
  id: string;
  category: HookCategory;
  copy: string;
  locale: string | null;
  brand_kind: string | null;
  score: number;
}

export const HOOK_CATEGORIES: { id: HookCategory; label: { pt: string; en: string; es: string; zh: string }; emoji: string }[] = [
  { id: "urgency",      label: { pt: "Urgência",     en: "Urgency",      es: "Urgencia",     zh: "紧迫感" }, emoji: "⏰" },
  { id: "value",        label: { pt: "Valor/Bônus",  en: "Value/Bonus",  es: "Valor/Bono",   zh: "价值" }, emoji: "💰" },
  { id: "offer",        label: { pt: "Oferta",       en: "Offer",        es: "Oferta",       zh: "优惠" }, emoji: "🎁" },
  { id: "testimonial",  label: { pt: "Depoimento",   en: "Testimonial",  es: "Testimonio",   zh: "见证" }, emoji: "💬" },
  { id: "social_proof", label: { pt: "Prova social", en: "Social proof", es: "Prueba social",zh: "社会证明" }, emoji: "👥" },
  { id: "comparison",   label: { pt: "Comparação",   en: "Comparison",   es: "Comparación",  zh: "对比" }, emoji: "⚖️" },
  { id: "fomo",         label: { pt: "FOMO",         en: "FOMO",         es: "FOMO",         zh: "FOMO" }, emoji: "🔥" },
  { id: "question",     label: { pt: "Pergunta",     en: "Question",     es: "Pregunta",     zh: "提问" }, emoji: "❓" },
];

/**
 * Lê todos os hooks da biblioteca, ordenados por score desc dentro de
 * cada categoria. Retorna em formato { categoria → array de hooks }.
 */
export async function fetchHookLibrary(): Promise<Record<HookCategory, HookRow[]>> {
  const grouped: Record<HookCategory, HookRow[]> = {
    urgency: [], value: [], testimonial: [], comparison: [],
    offer: [], fomo: [], social_proof: [], question: [],
  };
  try {
    const { data, error } = await supabase
      .from("hub_hook_library" as never)
      .select("id, category, copy, locale, brand_kind, score")
      .order("score", { ascending: false });
    if (error) {
      console.warn("[hookLibrary] fetch error:", error.message);
      return grouped;
    }
    const rows = (data || []) as HookRow[];
    for (const r of rows) {
      if (grouped[r.category]) grouped[r.category].push(r);
    }
  } catch (e) {
    console.warn("[hookLibrary] exception:", e);
  }
  return grouped;
}
