// telegram-bot v2 — recebe webhooks do Telegram, processa comandos, executa ações
// Webhook URL: https://<project>.supabase.co/functions/v1/telegram-bot
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendMessage(token: string, chat_id: string | number, text: string, reply_markup?: object) {
  const body: Record<string, unknown> = { chat_id, text, parse_mode: "HTML" };
  if (reply_markup) body.reply_markup = reply_markup;
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallback(token: string, callback_query_id: string, text?: string) {
  await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id, text: text || "" }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const update = await req.json();

    // ── /start TOKEN — pairing flow ──────────────────────────────────────────
    if (update.message?.text?.startsWith("/start")) {
      const chat_id = update.message.chat.id;
      const from = update.message.from;
      const token = update.message.text.split(" ")[1]; // /start <token>

      if (!token) {
        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `👋 <b>Bem-vindo ao AdBrief Alerts!</b>\n\nPara conectar sua conta, vá em <b>adbrief.pro → Configurações → Conectar Telegram</b> e clique no link gerado lá.`
        );
        return new Response("ok", { headers: cors });
      }

      // Verify pairing token
      const { data: pairing } = await (supabase as any)
        .from("telegram_pairing_tokens")
        .select("user_id, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (!pairing || new Date(pairing.expires_at) < new Date()) {
        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `❌ Link expirado ou inválido.\n\nGere um novo link em <b>adbrief.pro → Configurações</b>.`
        );
        return new Response("ok", { headers: cors });
      }

      // Save connection
      await (supabase as any).from("telegram_connections").upsert({
        user_id: pairing.user_id,
        chat_id: chat_id.toString(),
        telegram_username: from?.username || null,
        telegram_first_name: from?.first_name || null,
        active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Delete used token
      await (supabase as any).from("telegram_pairing_tokens").delete().eq("token", token);

      // Register in account_alerts as system message
      await (supabase as any).from("account_alerts").insert({
        user_id: pairing.user_id,
        type: "system",
        urgency: "low",
        detail: `Telegram conectado — @${from?.username || from?.first_name || "usuário"}. Alertas e comandos ativados.`,
        created_at: new Date().toISOString(),
      });

      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `✅ <b>Telegram conectado com sucesso!</b>\n\n` +
        `A partir de agora você vai receber:\n` +
        `⚠️ Alertas críticos da sua conta Meta Ads\n` +
        `📊 Resumo diário de performance\n\n` +
        `<b>Comandos disponíveis:</b>\n` +
        `/status — resumo da conta agora\n` +
        `/alertas — ver alertas ativos\n` +
        `/pausar [nome do ad] — pausar um criativo\n` +
        `/ajuda — ver todos os comandos\n\n` +
        `Tudo que você fizer aqui será registrado no seu AdBrief.`
      );

      return new Response("ok", { headers: cors });
    }

    // ── Get user from chat_id ────────────────────────────────────────────────
    const chat_id = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (!chat_id) return new Response("ok", { headers: cors });

    const { data: conn } = await (supabase as any)
      .from("telegram_connections")
      .select("user_id")
      .eq("chat_id", chat_id.toString())
      .eq("active", true)
      .maybeSingle();

    if (!conn?.user_id) {
      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `⚠️ Conta não encontrada.\n\nConecte sua conta em <b>adbrief.pro → Configurações → Conectar Telegram</b>.`
      );
      return new Response("ok", { headers: cors });
    }

    const user_id = conn.user_id;

    // ── Handle callback_query (button presses) ───────────────────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      await answerCallback(TELEGRAM_TOKEN, cq.id);
      const [action, ...params] = cq.data.split(":");

      if (action === "pause_confirm") {
        const ad_id = params[0];
        const ad_name = params[1] ? decodeURIComponent(params[1]) : ad_id;

        // Call meta-actions to pause
        const { data: metaResult, error } = await supabase.functions.invoke("meta-actions", {
          body: { action: "pause_ad", ad_id, user_id },
        });

        if (error || metaResult?.error) {
          await sendMessage(TELEGRAM_TOKEN, chat_id,
            `❌ Erro ao pausar <b>${ad_name}</b>.\n\nVerifique em adbrief.pro ou tente novamente.`
          );
        } else {
          const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          await sendMessage(TELEGRAM_TOKEN, chat_id,
            `✅ <b>${ad_name}</b> pausado com sucesso.\n📅 ${now}\n\nRegistrado no seu AdBrief.`
          );

          // Register action in account_alerts (appears in chat with timestamp)
          await (supabase as any).from("account_alerts").insert({
            user_id,
            type: "action",
            urgency: "low",
            ad_name,
            detail: `Criativo pausado via Telegram às ${now}.`,
            action_suggestion: "Considere criar uma variação com hook diferente.",
            created_at: new Date().toISOString(),
          });

          // Save to learned_patterns — this ad was paused due to low performance
          await (supabase as any).from("learned_patterns").upsert({
            user_id,
            pattern_key: `paused_via_telegram:${ad_id}`,
            is_winner: false,
            confidence: 0.7,
            insight_text: `Ad "${ad_name}" foi pausado via Telegram por baixa performance.`,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,pattern_key" });
        }
        return new Response("ok", { headers: cors });
      }

      if (action === "pause_cancel") {
        await sendMessage(TELEGRAM_TOKEN, chat_id, `👍 Ok, ${params[1] ? decodeURIComponent(params[1]) : "o criativo"} continua rodando.`);
        return new Response("ok", { headers: cors });
      }

      if (action === "dismiss_alert") {
        const alert_id = params[0];
        await (supabase as any).from("account_alerts").update({ dismissed_at: new Date().toISOString() }).eq("id", alert_id);
        await sendMessage(TELEGRAM_TOKEN, chat_id, `✓ Alerta dispensado.`);
        return new Response("ok", { headers: cors });
      }
    }

    // ── Text commands ────────────────────────────────────────────────────────
    const text = update.message?.text || "";

    // /ajuda
    if (text === "/ajuda" || text === "/help" || text === "/start") {
      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `<b>AdBrief Alerts — Comandos</b>\n\n` +
        `/status — resumo da conta agora\n` +
        `/alertas — ver alertas ativos\n` +
        `/pausar [nome] — pausar criativo (pede confirmação)\n` +
        `/desconectar — remover esta conexão\n\n` +
        `Tudo que você fizer aqui é registrado no AdBrief com data e hora.`
      );
      return new Response("ok", { headers: cors });
    }

    // /status — resumo da conta
    if (text === "/status") {
      const { data: snap } = await (supabase as any)
        .from("daily_snapshots")
        .select("date, total_spend, avg_ctr, active_ads, winners_count, losers_count, ai_insight")
        .eq("user_id", user_id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!snap) {
        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `📊 Sem dados ainda.\n\nConecte o Meta Ads em adbrief.pro para começar a receber dados.`
        );
      } else {
        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `📊 <b>Status da conta — ${snap.date}</b>\n\n` +
          `💰 Spend: R$${(snap.total_spend || 0).toFixed(0)}\n` +
          `📈 CTR médio: ${((snap.avg_ctr || 0) * 100).toFixed(2)}%\n` +
          `🎬 Anúncios ativos: ${snap.active_ads || 0}\n` +
          (snap.winners_count ? `✅ Vencedores: ${snap.winners_count}\n` : "") +
          (snap.losers_count ? `⚠️ Com baixa perf: ${snap.losers_count}\n` : "") +
          (snap.ai_insight ? `\n💡 <i>${snap.ai_insight}</i>` : "")
        );
      }
      return new Response("ok", { headers: cors });
    }

    // /alertas — ver alertas ativos
    if (text === "/alertas") {
      const { data: alerts } = await (supabase as any)
        .from("account_alerts")
        .select("id, urgency, detail, ad_name, created_at")
        .eq("user_id", user_id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!alerts?.length) {
        await sendMessage(TELEGRAM_TOKEN, chat_id, `✅ Nenhum alerta ativo no momento.`);
      } else {
        const lines = alerts.map((a: any) => {
          const icon = a.urgency === "high" ? "🔴" : "🟡";
          const when = new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          return `${icon} ${a.detail}${a.ad_name ? ` — <i>${a.ad_name}</i>` : ""}\n   <code>${when}</code>`;
        }).join("\n\n");
        await sendMessage(TELEGRAM_TOKEN, chat_id, `⚠️ <b>Alertas ativos (${alerts.length})</b>\n\n${lines}\n\nUse /pausar [nome] para agir.`);
      }
      return new Response("ok", { headers: cors });
    }

    // /pausar [nome do ad]
    if (text.startsWith("/pausar ")) {
      const adName = text.replace("/pausar ", "").trim();
      if (!adName) {
        await sendMessage(TELEGRAM_TOKEN, chat_id, `❓ Use: /pausar [nome do criativo]\n\nEx: /pausar Creative_042`);
        return new Response("ok", { headers: cors });
      }

      // Find the ad in daily_snapshots top_ads
      const { data: snap } = await (supabase as any)
        .from("daily_snapshots")
        .select("top_ads")
        .eq("user_id", user_id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const topAds = (snap?.top_ads as any[]) || [];
      const match = topAds.find((a: any) =>
        a.name?.toLowerCase().includes(adName.toLowerCase())
      );

      const adId = match?.id || adName;
      const adDisplayName = match?.name || adName;
      const ctr = match?.ctr ? `CTR ${((match.ctr) * 100).toFixed(2)}%` : "";
      const spend = match?.spend ? ` | R$${match.spend.toFixed(0)} gasto` : "";

      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `⚠️ <b>Confirmar ação</b>\n\nPausar: <b>${adDisplayName}</b>\n${ctr}${spend}\n\nEssa ação será executada no Meta Ads e registrada no AdBrief.`,
        {
          inline_keyboard: [[
            { text: "✅ Pausar", callback_data: `pause_confirm:${adId}:${encodeURIComponent(adDisplayName)}` },
            { text: "❌ Cancelar", callback_data: `pause_cancel::${encodeURIComponent(adDisplayName)}` },
          ]],
        }
      );
      return new Response("ok", { headers: cors });
    }

    // /desconectar
    if (text === "/desconectar") {
      await (supabase as any)
        .from("telegram_connections")
        .update({ active: false })
        .eq("user_id", user_id);
      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `🔌 Telegram desconectado do AdBrief.\n\nPara reconectar, acesse adbrief.pro → Configurações.`
      );
      return new Response("ok", { headers: cors });
    }

    // Unknown command
    if (text.startsWith("/")) {
      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `❓ Comando não reconhecido.\n\nUse /ajuda para ver os comandos disponíveis.`
      );
    }

    return new Response("ok", { headers: cors });
  } catch (e: any) {
    console.error("telegram-bot error:", e.message);
    return new Response("ok", { headers: cors }); // always 200 to Telegram
  }
});
