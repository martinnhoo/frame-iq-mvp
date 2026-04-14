import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatMoney(centavos: number): string {
  const reais = Math.abs(centavos) / 100;
  const prefix = centavos < 0 ? "-R$" : "R$";
  if (reais >= 100) return `${prefix}${Math.round(reais).toLocaleString("pt-BR")}`;
  return `${prefix}${reais.toFixed(2).replace(".", ",")}`;
}

// ================================================================
// TELEGRAM MESSAGE TEMPLATES
// ================================================================

interface KillAlert {
  type: "kill_alert";
  adName: string;
  campaignName: string;
  dailyWaste: number; // centavos
  waste7d: number;
  reason: string;
  feedUrl: string;
}

interface ActionFeedback {
  type: "action_feedback";
  actionType: string;
  targetName: string;
  dailyImpact: number;
  totalSaved: number;
}

interface DailySummary {
  type: "daily_summary";
  accountName: string;
  savedToday: number;
  revenueToday: number;
  actionsTaken: number;
  pendingDecisions: number;
  leakingNow: number;
  feedUrl: string;
}

interface DecisionResult48h {
  type: "decision_result_48h";
  actionType: string;
  targetName: string;
  estimatedImpact: number;
  actualImpact: number;
  totalSaved: number;
}

type TelegramPayload = KillAlert | ActionFeedback | DailySummary | DecisionResult48h;

function buildMessage(payload: TelegramPayload): string {
  switch (payload.type) {
    case "kill_alert":
      return [
        `🔴 *AÇÃO URGENTE* — AdBrief`,
        ``,
        `*"${payload.adName}"*`,
        `está gastando ${formatMoney(payload.dailyWaste)}/dia sem resultado.`,
        ``,
        `❌ ${payload.reason}`,
        ``,
        `💰 Se não pausar: ${formatMoney(-payload.waste7d)} em 7 dias`,
        ``,
        `→ [Pausar agora](${payload.feedUrl})`,
      ].join("\n");

    case "action_feedback":
      const emoji = payload.actionType.includes("pause") ? "🛑" : "🚀";
      return [
        `${emoji} *Ação executada* — AdBrief`,
        ``,
        `*${payload.targetName}*`,
        `💰 ${formatMoney(payload.dailyImpact)}/dia ${payload.actionType.includes("pause") ? "salvos" : "potencial ativado"}`,
        ``,
        `Total acumulado: ${formatMoney(payload.totalSaved)}`,
      ].join("\n");

    case "daily_summary":
      return [
        `☀️ *Bom dia!* Resumo de ontem — AdBrief`,
        ``,
        `📊 *${payload.accountName}*`,
        ``,
        payload.savedToday > 0 ? `💰 Economizou ${formatMoney(payload.savedToday)}` : "",
        payload.revenueToday > 0 ? `🚀 Gerou ${formatMoney(payload.revenueToday)} potencial` : "",
        payload.actionsTaken > 0 ? `⚡ ${payload.actionsTaken} ações executadas` : "",
        payload.pendingDecisions > 0 ? `⚠️ ${payload.pendingDecisions} decisões esperando` : "",
        payload.leakingNow > 0 ? `🔴 ${formatMoney(payload.leakingNow)}/dia vazando agora` : `✅ Sem vazamentos`,
        ``,
        `→ [Abrir AdBrief](${payload.feedUrl})`,
      ].filter(Boolean).join("\n");

    case "decision_result_48h":
      const improved = payload.actualImpact > 0;
      return [
        `${improved ? "✅" : "⚠️"} *Resultado 48h* — AdBrief`,
        ``,
        `Lembra que você ${payload.actionType.includes("pause") ? "pausou" : "escalou"} *"${payload.targetName}"*?`,
        ``,
        improved
          ? `📈 Resultado: ${formatMoney(payload.actualImpact)} economizados`
          : `📉 Resultado ainda inconclusivo`,
        ``,
        `Estimativa era: ${formatMoney(payload.estimatedImpact)}`,
        `Total acumulado: ${formatMoney(payload.totalSaved)}`,
      ].join("\n");
  }
}

async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { user_id, payload } = await req.json() as {
      user_id: string;
      payload: TelegramPayload;
    };

    // Get user's telegram settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("telegram_chat_id, telegram_enabled")
      .eq("user_id", user_id)
      .single();

    if (!settings?.telegram_enabled || !settings?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Telegram not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = buildMessage(payload);
    await sendTelegramMessage(settings.telegram_chat_id, message);

    // Log notification
    await supabase.from("notifications").insert({
      user_id,
      channel: "telegram",
      notification_type: payload.type,
      title: payload.type,
      body: message,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
