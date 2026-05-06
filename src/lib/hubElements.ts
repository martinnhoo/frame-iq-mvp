/**
 * hubElements — CRUD da biblioteca de elementos do Hub.
 *
 * Antes: tudo em localStorage (data URLs base64) → estourava quota do
 * browser depois de poucos PNGs.
 *
 * Agora: tabela `hub_elements` (Postgres) + bucket `hub-images` (Storage)
 * sob prefixo `{user_id}/elements/{id}.png`. Sem limite prático.
 *
 * Migração one-shot: na primeira load, se o user tem elementos no
 * localStorage e nenhum no DB, faz upload de todos pra Storage e limpa
 * o localStorage. Não-destrutivo — em caso de falha mantém local até
 * próxima tentativa.
 */
import { supabase } from "@/integrations/supabase/client";

// `hub_elements` é tabela nova (migration 20260506120000) — types.ts ainda
// não foi regenerado. Cast pra any nas queries da tabela evita TS errors
// até o supabase gen types rodar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface HubElement {
  id: string;
  name: string;
  url: string;            // public URL no Storage (ou data URL durante migração)
  createdAt: string;
  storagePath?: string;   // path no bucket — pra delete
  byteSize?: number;
}

const BUCKET = "hub-images";

// Legacy localStorage keys — só lidos pra migração one-shot.
const LEGACY_ELEMENTS_KEY = "hub_elements_v1";
const LEGACY_SELECTED_KEY = "hub_elements_selected_v1";
const MIGRATION_DONE_KEY = "hub_elements_migrated_v2";

// Selected IDs ainda ficam em localStorage — são strings curtas, não tem
// problema de quota.
export const SELECTED_KEY = "hub_elements_selected_v1";

/**
 * Baixa uma URL pública (do Storage ou outra) e converte pra data URL
 * base64. Usado pra mandar elementos como base64 pro edge function
 * generate-image-hub (compat com versão v18b deployada hoje, que ainda
 * espera data URL e não URL do Storage).
 *
 * Cache leve em memória pra evitar baixar a mesma URL múltiplas vezes
 * dentro da mesma sessão (ex: gerando 3 variações com mesmo elemento).
 */
const urlToBase64Cache = new Map<string, string>();
export async function urlToBase64(url: string): Promise<string> {
  // Se já é data URL, retorna como tá
  if (url.startsWith("data:")) return url;
  const cached = urlToBase64Cache.get(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch_failed: ${res.status} ${url.slice(0, 100)}`);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
  urlToBase64Cache.set(url, dataUrl);
  return dataUrl;
}

/**
 * Lista todos os elementos do user atual (mais recentes primeiro).
 * Retorna [] se não autenticado ou se a tabela ainda não existe (migration pendente).
 */
export async function listElements(): Promise<HubElement[]> {
  const { data, error } = await sb
    .from("hub_elements")
    .select("id, name, public_url, storage_path, byte_size, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[hubElements] list error:", error.message);
    return [];
  }
  return (data || []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    url: row.public_url as string,
    createdAt: row.created_at as string,
    storagePath: row.storage_path as string,
    byteSize: row.byte_size as number,
  }));
}

/**
 * Faz upload de 1 PNG pro Storage + insere row em hub_elements.
 * Retorna o elemento já com URL pública.
 *
 * Throws em caso de falha. Caller deve catch + mostrar erro.
 */
export async function uploadElement(args: {
  blob: Blob;
  name: string;
}): Promise<HubElement> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("not_authenticated");

  const ext = args.blob.type === "image/jpeg" ? "jpg"
    : args.blob.type === "image/webp" ? "webp"
    : "png";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${userId}/elements/${filename}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, args.blob, {
      contentType: args.blob.type || "image/png",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) throw new Error(`upload_failed: ${uploadErr.message}`);

  // Pega URL pública (bucket é public:true)
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    // Cleanup: tenta apagar o que subiu pra não vazar
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw new Error("public_url_missing");
  }

  const trimmedName = (args.name || "elemento").trim().slice(0, 60) || "elemento";
  const { data: inserted, error: dbErr } = await sb
    .from("hub_elements")
    .insert({
      user_id: userId,
      name: trimmedName,
      storage_path: storagePath,
      public_url: publicUrl,
      byte_size: args.blob.size,
      mime_type: args.blob.type || "image/png",
    })
    .select("id, name, public_url, storage_path, byte_size, created_at")
    .single();

  if (dbErr || !inserted) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`db_insert_failed: ${dbErr?.message || "unknown"}`);
  }

  return {
    id: inserted.id as string,
    name: inserted.name as string,
    url: inserted.public_url as string,
    createdAt: inserted.created_at as string,
    storagePath: inserted.storage_path as string,
    byteSize: inserted.byte_size as number,
  };
}

/**
 * Renomeia um elemento (in-place, só atualiza coluna `name`).
 */
export async function renameElement(id: string, newName: string): Promise<void> {
  const trimmed = (newName || "").trim().slice(0, 60);
  if (!trimmed) return;
  const { error } = await sb
    .from("hub_elements")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) throw new Error(`rename_failed: ${error.message}`);
}

/**
 * Deleta elemento: row + arquivo no Storage. Não-destrutivo se falhar
 * em uma das pontas (tenta a outra mesmo assim) — caller decide se
 * recarrega a lista.
 */
export async function deleteElement(id: string, storagePath?: string): Promise<void> {
  // Pega o storage_path do DB se não foi passado
  let path = storagePath;
  if (!path) {
    const { data } = await sb
      .from("hub_elements")
      .select("storage_path")
      .eq("id", id)
      .single();
    path = data?.storage_path;
  }

  // Apaga do Storage primeiro (se sobrar row órfã, é menos pior que arquivo órfão)
  if (path) {
    await supabase.storage.from("hub-images").remove([path]).catch(err => {
      console.warn("[hubElements] storage delete failed:", err);
    });
  }
  const { error } = await sb.from("hub_elements").delete().eq("id", id);
  if (error) throw new Error(`db_delete_failed: ${error.message}`);
}

/**
 * Migração one-shot: pega o que tava no localStorage `hub_elements_v1`
 * (data URLs base64) e faz upload pro Storage.
 *
 * Idempotente — usa flag `hub_elements_migrated_v2` em localStorage pra
 * não rodar 2x. Se rodar com sucesso, limpa o localStorage antigo pra
 * liberar quota.
 *
 * Falhas individuais não param a migração — pula o item e segue.
 *
 * Retorna { migrated, failed } pra debug.
 */
export async function migrateLocalElementsIfNeeded(): Promise<{ migrated: number; failed: number }> {
  // Se já migrou, sai
  try {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === "true") {
      return { migrated: 0, failed: 0 };
    }
  } catch { /* ignore */ }

  let legacy: { id: string; name: string; url: string; createdAt: string }[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_ELEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) legacy = parsed;
    }
  } catch { /* ignore */ }

  if (legacy.length === 0) {
    // Marca como migrado mesmo se vazio — evita re-checagem em todo mount
    try { localStorage.setItem(MIGRATION_DONE_KEY, "true"); } catch { /* ignore */ }
    return { migrated: 0, failed: 0 };
  }

  let migrated = 0;
  let failed = 0;
  for (const item of legacy) {
    try {
      // Converte data URL → Blob
      const m = item.url.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) { failed++; continue; }
      const mime = m[1];
      const b64 = m[2];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      await uploadElement({ blob, name: item.name });
      migrated++;
    } catch (e) {
      console.warn("[hubElements] migration item failed:", item.id, e);
      failed++;
    }
  }

  // Se TUDO foi OK, limpa o legacy. Se algo falhou, mantém pra próxima tentativa.
  if (failed === 0) {
    try {
      localStorage.removeItem(LEGACY_ELEMENTS_KEY);
      // Limpa seleção também — IDs antigos (el_xxx) não batem com UUIDs novos
      localStorage.removeItem(LEGACY_SELECTED_KEY);
      localStorage.setItem(MIGRATION_DONE_KEY, "true");
    } catch { /* ignore */ }
  }

  return { migrated, failed };
}

/**
 * Carrega seleção de elementos persistida em localStorage (só IDs, leve).
 */
export function loadSelectedIds(): string[] {
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Persiste seleção em localStorage. IDs são strings curtas, sem problema de quota.
 */
export function saveSelectedIds(ids: string[]): void {
  try { localStorage.setItem(SELECTED_KEY, JSON.stringify(ids)); }
  catch { /* ignore */ }
}
