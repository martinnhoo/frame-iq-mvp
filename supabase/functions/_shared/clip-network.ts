import { createClient } from "npm:@supabase/supabase-js@2";

export const clipCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export async function requireClipUser(req: Request) {
  const supabase = serviceClient();
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("unauthorized");
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) throw new Error("unauthorized");
  return { supabase, user };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...clipCors, "Content-Type": "application/json" },
  });
}

export function randomState(payload: Record<string, unknown>) {
  return btoa(JSON.stringify({ ...payload, nonce: crypto.randomUUID(), ts: Date.now() }));
}

function base64Url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return atob(padded);
}

async function stateKey() {
  const secret = Deno.env.get("CLIP_OAUTH_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret) throw new Error("CLIP_OAUTH_STATE_SECRET missing");
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function signClipState(payload: Record<string, unknown>) {
  const body = base64Url(new TextEncoder().encode(JSON.stringify({ ...payload, nonce: crypto.randomUUID(), ts: Date.now() })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await stateKey(), new TextEncoder().encode(body)));
  return `${body}.${base64Url(sig)}`;
}

export async function verifyClipState(state: string) {
  const [body, signature] = (state || "").split(".");
  if (!body || !signature) throw new Error("invalid OAuth state");
  const sigText = fromBase64Url(signature);
  const sig = Uint8Array.from(sigText, (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", await stateKey(), sig, new TextEncoder().encode(body));
  if (!ok) throw new Error("invalid OAuth state signature");
  const jsonText = fromBase64Url(body);
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(jsonText, (c) => c.charCodeAt(0))));
  if (!payload.ts || Date.now() - payload.ts > 15 * 60 * 1000) throw new Error("expired OAuth state");
  return payload;
}
