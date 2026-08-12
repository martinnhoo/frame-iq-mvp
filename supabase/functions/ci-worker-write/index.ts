/**
 * ci-worker-write — caminho de escrita e de storage do worker.
 *
 * ── Por que esta função existe ─────────────────────────────────────────────
 * O banco de produção está no Lovable Cloud e a SUPABASE_SERVICE_ROLE_KEY não
 * é acessível fora dele. O worker roda no Fly (ou local) e precisa escrever em
 * tabelas cujas policies são SELECT-only para o cliente.
 *
 * A saída é esta: a função roda DENTRO do Supabase, onde a service role já está
 * injetada, e o worker fala com ela por um segredo compartilhado.
 *
 * Acabou saindo melhor que a ideia original de mandar a service role para o
 * Fly. A chave nunca sai do Supabase, e a superfície de ataque deixa de ser
 * "acesso total ao banco" e passa a ser exatamente o que está permitido aqui:
 * uma matriz por tabela/ação/identidade, RPCs fechadas e chaves brand-scoped.
 *
 * ── Arquivo grande NÃO passa por aqui ──────────────────────────────────────
 * Upload de vídeo usa URL assinada: a função devolve o token, e o worker faz o
 * PUT direto no storage. Um vídeo de 80 MB atravessando uma edge function
 * estouraria o limite de corpo e o timeout.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertWorkerOperationAllowed,
  isWorkerStorageKeyAllowed,
} from "../_shared/ci-worker-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ci-worker-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Lista fechada. Nenhuma outra função do banco é chamável por aqui. */
const RPC_ALLOWLIST = new Set([
  "ci_claim_job",
  "ci_reap_stale_jobs",
  "ci_refresh_taxonomy_stats",
  "ci_enqueue_legacy_mixed_job",
]);

const BUCKET = "ci-media";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const expected = Deno.env.get("CI_WORKER_SECRET");
  if (!expected) {
    return json({ error: "not_configured", message: "CI_WORKER_SECRET não está definido." }, 503);
  }

  const provided = req.headers.get("x-ci-worker-secret") ?? "";
  // Comparação de tempo constante. Comparar com === vaza, pelo tempo de
  // resposta, quantos caracteres iniciais o atacante acertou — é o suficiente
  // para descobrir o segredo caractere a caractere.
  if (provided.length !== expected.length) {
    return json({ error: "unauthorized" }, 401);
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return json({ error: "unauthorized" }, 401);

  let body: {
    action?: string;
    table?: string;
    rows?: unknown;
    patch?: Record<string, unknown>;
    match?: Record<string, string>;
    filters?: Record<string, string>;
    select?: string;
    order?: string;
    limit?: number;
    on_conflict?: string;
    ignore_duplicates?: boolean;
    fn?: string;
    args?: Record<string, unknown>;
    key?: string;
    expires_in?: number;
    content_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request", message: "corpo precisa ser JSON" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { action } = body;

  try {
    if (action === "select" || action === "insert" || action === "update") {
      try {
        assertWorkerOperationAllowed(body);
      } catch (error) {
        return json({
          error: "operation_not_allowed",
          message: error instanceof Error ? error.message : "worker operation denied",
        }, 403);
      }
    }

    // ── Leitura ──────────────────────────────────────────────────────────────
    if (action === "select") {
      if (!body.table) return json({ error: "table_required" }, 400);
      let q = admin.from(body.table).select(body.select ?? "*");
      for (const [column, filter] of Object.entries(body.filters ?? {})) {
        const [op, ...rest] = filter.split(".");
        const value = rest.join(".");
        if (op === "eq") q = q.eq(column, value);
        else if (op === "in") q = q.in(column, value.replace(/^\(|\)$/g, "").split(","));
        else if (op === "is") q = q.is(column, value === "null" ? null : value);
        else if (op === "neq") q = q.neq(column, value);
        else return json({ error: "filter_not_allowed", message: op }, 400);
      }
      if (body.order) q = q.order(body.order.replace(/\.desc$/, ""), { ascending: !body.order.endsWith(".desc") });
      if (body.limit) q = q.limit(body.limit);
      const { data, error } = await q;
      if (error) return json({ error: "db_error", message: error.message }, 400);
      return json({ data });
    }

    // ── Escrita ──────────────────────────────────────────────────────────────
    if (action === "insert") {
      if (!body.table) return json({ error: "table_required" }, 400);
      const q = body.on_conflict
        ? admin.from(body.table).upsert(body.rows as never, {
            onConflict: body.on_conflict,
            ignoreDuplicates: body.ignore_duplicates ?? false,
          })
        : admin.from(body.table).insert(body.rows as never);
      const { data, error } = await q.select();
      if (error) return json({ error: "db_error", message: error.message }, 400);
      return json({ data });
    }

    if (action === "update") {
      if (!body.table) return json({ error: "table_required" }, 400);
      // UPDATE sem filtro reescreveria a tabela inteira. Recusar é mais seguro
      // que confiar em quem chama.
      if (!body.match || Object.keys(body.match).length === 0) {
        return json({ error: "match_required", message: "update exige ao menos um filtro" }, 400);
      }
      let q = admin.from(body.table).update(body.patch ?? {});
      for (const [column, filter] of Object.entries(body.match)) {
        const [op, ...rest] = filter.split(".");
        const value = rest.join(".");
        if (op === "eq") q = q.eq(column, value);
        else return json({ error: "filter_not_allowed", message: op }, 400);
      }
      const { data, error } = await q.select();
      if (error) return json({ error: "db_error", message: error.message }, 400);
      return json({ data });
    }

    // ── RPC ──────────────────────────────────────────────────────────────────
    if (action === "rpc") {
      if (!body.fn || !RPC_ALLOWLIST.has(body.fn)) return json({ error: "rpc_not_allowed" }, 403);
      if (body.fn === "ci_claim_job") {
        const kind = body.args?.p_kind;
        const lease = Number(body.args?.p_lease_secs);
        if (!(["download", "analysis"] as unknown[]).includes(kind) || !Number.isInteger(lease) || lease < 60 || lease > 3600) {
          return json({ error: "rpc_args_not_allowed" }, 400);
        }
      }
      if (body.fn === "ci_refresh_taxonomy_stats") {
        const brandId = String(body.args?.p_brand_id ?? "");
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brandId)) {
          return json({ error: "rpc_args_not_allowed" }, 400);
        }
      }
      if (body.fn === "ci_enqueue_legacy_mixed_job") {
        const ids = [body.args?.p_asset_id, body.args?.p_brand_id, body.args?.p_user_id];
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (ids.some((value) => !uuid.test(String(value ?? ""))) || body.args?.p_contract_version !== "legacy/semantic-v7") {
          return json({ error: "rpc_args_not_allowed" }, 400);
        }
      }
      if (body.fn === "ci_reap_stale_jobs" && Object.keys(body.args ?? {}).length > 0) {
        return json({ error: "rpc_args_not_allowed" }, 400);
      }
      const { data, error } = await admin.rpc(body.fn, body.args ?? {});
      if (error) return json({ error: "db_error", message: error.message }, 400);
      return json({ data });
    }

    // ── Storage ──────────────────────────────────────────────────────────────
    if (action === "sign_upload") {
      if (!body.key) return json({ error: "key_required" }, 400);
      if (!isWorkerStorageKeyAllowed(body.key)) return json({ error: "storage_key_not_allowed" }, 403);
      // O arquivo não passa por aqui: devolvemos o token e o worker faz o PUT
      // direto no storage. Um vídeo de 80 MB atravessando a edge function
      // estouraria o limite de corpo.
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(body.key, { upsert: true });
      if (error) return json({ error: "storage_error", message: error.message }, 400);
      return json({ data });
    }

    if (action === "sign_download") {
      if (!body.key) return json({ error: "key_required" }, 400);
      if (!isWorkerStorageKeyAllowed(body.key)) return json({ error: "storage_key_not_allowed" }, 403);
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(body.key, body.expires_in ?? 3600);
      if (error) return json({ error: "storage_error", message: error.message }, 400);
      return json({ data });
    }

    if (action === "storage_remove") {
      if (!body.key) return json({ error: "key_required" }, 400);
      if (!isWorkerStorageKeyAllowed(body.key)) return json({ error: "storage_key_not_allowed" }, 403);
      const { error } = await admin.storage.from(BUCKET).remove([body.key]);
      if (error) return json({ error: "storage_error", message: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "ping") {
      // Serve para o worker validar segredo e conectividade na largada, em vez
      // de descobrir que está errado no meio do primeiro job.
      return json({ ok: true, bucket: BUCKET, ts: new Date().toISOString() });
    }

    return json({ error: "unknown_action", message: String(action) }, 400);
  } catch (err) {
    // A mensagem pode carregar detalhe interno; devolvemos genérico e deixamos
    // o específico só no log da função.
    console.error("ci-worker-write falhou:", err);
    return json({ error: "internal_error" }, 500);
  }
});
