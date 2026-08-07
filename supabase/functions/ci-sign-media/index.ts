/**
 * ci-sign-media — assina URLs de mídia do bucket privado, no servidor.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * A página assinava direto do navegador, o que exige policy de leitura em
 * storage.objects. Passei muitas rodadas tentando fazer essa policy funcionar:
 * ela existe, é PERMISSIVE, o predicado avaliado à mão devolve TRUE, não há
 * policy restritiva, o dono confere, a RLS está ligada — e mesmo assim o
 * usuário vê 0 de 356 objetos. Não descobri por quê.
 *
 * Em vez de continuar caçando, tirei a dependência: quem assina é o servidor,
 * que já sabe autorizar. A autorização não fica mais fraca — fica em UM lugar,
 * explícito e testável, em vez de espalhada numa expressão de policy que
 * ninguém consegue depurar.
 *
 * ── A verificação ─────────────────────────────────────────────────────────
 * O caminho no bucket é `brands/{brand_id}/...`. A função extrai o brand_id,
 * confere com a service role se aquela marca é do usuário do JWT, e só então
 * assina. Um usuário pedindo mídia de marca alheia recebe 403 — a mesma
 * garantia da policy, num lugar onde dá para ler o código e escrever teste.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "ci-media";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Cliente COM o token do usuário, só para descobrir quem ele é. A partir
  // daqui tudo é feito com a service role — mas sempre filtrado pelo id que
  // veio deste passo, nunca por um id que o cliente tenha mandado.
  const comUsuario = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: erroUser } = await comUsuario.auth.getUser();
  if (erroUser || !user) return json({ error: "unauthorized" }, 401);

  let body: { keys?: string[]; expires_in?: number };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const keys = (body.keys ?? []).filter(k => typeof k === "string" && k.length > 0);
  if (keys.length === 0) return json({ error: "bad_request", message: "informe keys[]" }, 400);
  // Teto de 60: uma tela mostra no máximo algumas dezenas de keyframes, e sem
  // limite alguém poderia pedir mil assinaturas numa chamada.
  if (keys.length > 60) return json({ error: "too_many", message: "máximo 60 por chamada" }, 400);

  const admin = createClient(url, service);

  // ── Autorização ─────────────────────────────────────────────────────────
  // Um único SELECT resolve todas as chaves: pega as marcas do usuário e
  // confere se cada caminho aponta para uma delas.
  const { data: marcas } = await admin
    .from("ci_brands").select("id").eq("user_id", user.id);
  const minhas = new Set((marcas ?? []).map((m: { id: string }) => m.id));

  const negadas: string[] = [];
  const permitidas = keys.filter(k => {
    // brands/{brand_id}/...  — o mesmo formato que o worker grava.
    const brand = k.split("/")[1] ?? "";
    const ok = k.startsWith("brands/") && minhas.has(brand);
    if (!ok) negadas.push(k);
    return ok;
  });

  if (permitidas.length === 0) {
    return json({ error: "forbidden", message: "nenhuma das chaves pertence a você" }, 403);
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(permitidas, Math.min(body.expires_in ?? 3600, 24 * 3600));

  if (error) return json({ error: "storage_error", message: error.message }, 502);

  // Devolve mapa chave → URL. Chave que falhou vem com o erro, em vez de
  // sumir: a tela precisa saber a diferença entre "não autorizado" e "não
  // existe", e um objeto ausente é bug do worker, não de permissão.
  const urls: Record<string, string> = {};
  const falhas: Record<string, string> = {};
  (data ?? []).forEach((item, i) => {
    const chave = permitidas[i];
    if (item?.signedUrl) urls[chave] = item.signedUrl;
    else falhas[chave] = item?.error ?? "sem URL";
  });
  for (const k of negadas) falhas[k] = "não pertence a este usuário";

  return json({ urls, falhas });
});
