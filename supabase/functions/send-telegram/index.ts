// send-telegram — envia mensagem para um usuário via Telegram
// Chamado por: check-critical-alerts, adbrief-ai-chat (ações registradas), crons
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendMessage(token: string, chat_id: string, text: string, reply_markup?: object) {
  const body: Record<string, unknown> = {
    chat_id,
    text,
    parse_mode: "HTML",
  };
  if (reply_markup) body.reply_markup = reply_markup;
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    if (!TELEGRAM_TOKEN) return new Response(JSON.stringify({ error: "no token" }), { status: 500, headers: cors });

    const { user_id, message, reply_markup, alert_id } = await req.json();
    if (!user_id || !message) return new Response(JSON.stringify({ error: "missing params" }), { status: 400, headers: cors });

    // Get user's telegram chat_id
    const { data: conn } = await (supabase as any)
      .from("telegram_connections")
      .select("chat_id")
      .eq("user_id", user_id)
      .eq("active", true)
      .maybeSingle();

    if (!conn?.chat_id) {
      return new Response(JSON.stringify({ sent: false, reason: "not_connected" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sent = await sendMessage(TELEGRAM_TOKEN, conn.chat_id, message, reply_markup);

    // Log in account_alerts that telegram was notified
    if (sent && alert_id) {
      await (supabase as any)
        .from("account_alerts")
        .update({ telegram_sent_at: new Date().toISOString() })
        .eq("id", alert_id);
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
