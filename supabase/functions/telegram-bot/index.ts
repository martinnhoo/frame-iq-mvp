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
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";

  // Guard: sem token não há como responder
  if (!TELEGRAM_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not set in Supabase secrets");
    return new Response("ok", { headers: cors }); // responde 200 pro Telegram não retentar
  }

  // Valida webhook secret SOMENTE se configurado E request vier do Telegram
  // (não bloquear calls internas sem o header)
  if (WEBHOOK_SECRET && req.headers.get("user-agent")?.includes("TelegramBot")) {
    const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (incomingSecret !== WEBHOOK_SECRET) {
      console.error("Webhook secret mismatch");
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }
  }

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
        `/pausar — listar e pausar anúncios\n` +
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
      .neq("active", false)  // aceita true OU null
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
        const ad_meta_id = params[0];
        const ad_name = params[1] ? decodeURIComponent(params[1]) : ad_meta_id;

        // Call meta-actions to pause — use correct action name "pause"
        const { data: metaResult, error } = await supabase.functions.invoke("meta-actions", {
          body: { action: "pause", target_id: ad_meta_id, target_type: "ad", user_id },
        });

        if (error || metaResult?.error) {
          const errMsg = metaResult?.error || (error as any)?.message || "Erro desconhecido";
          await sendMessage(TELEGRAM_TOKEN, chat_id,
            `❌ Erro ao pausar <b>${ad_name}</b>.\n<code>${errMsg}</code>\n\nVerifique em adbrief.pro ou tente novamente.`
          );
        } else {
          const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          await sendMessage(TELEGRAM_TOKEN, chat_id,
            `✅ <b>${ad_name}</b> pausado com sucesso.\n📅 ${now}\n\nRegistrado no seu AdBrief.`
          );

          // Register action in account_alerts
          await (supabase as any).from("account_alerts").insert({
            user_id,
            type: "action",
            urgency: "low",
            ad_name,
            detail: `Criativo pausado via Telegram às ${now}.`,
            action_suggestion: "Considere criar uma variação com hook diferente.",
            created_at: new Date().toISOString(),
          });
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
        `/pausar — lista anúncios ativos (responda com o número)\n` +
        `/pausar [nome] — busca e pausa por nome\n` +
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

    // /pausar — list active ads or search by name
    if (text === "/pausar" || text.startsWith("/pausar ")) {
      const searchArg = text.replace("/pausar", "").trim();

      // Fetch active ads from the ads table (real data, not just snapshots)
      const { data: adAccounts } = await (supabase as any)
        .from("ad_accounts")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "active");

      const accountIds = (adAccounts || []).map((a: any) => a.id);
      let activeAds: any[] = [];

      if (accountIds.length > 0) {
        const { data: ads } = await (supabase as any)
          .from("ads")
          .select("meta_ad_id, name, status, effective_status, ad_set:ad_sets(name, campaign:campaigns(name))")
          .in("account_id", accountIds)
          .in("effective_status", ["ACTIVE", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "PENDING_REVIEW", "PREAPPROVED"])
          .order("name")
          .limit(30);
        activeAds = ads || [];
      }

      // Fallback: also check daily_snapshots top_ads
      if (activeAds.length === 0) {
        const { data: snap } = await (supabase as any)
          .from("daily_snapshots")
          .select("top_ads")
          .eq("user_id", user_id)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        const topAds = (snap?.top_ads as any[]) || [];
        activeAds = topAds.map((a: any) => ({
          meta_ad_id: a.id || a.meta_ad_id,
          name: a.name,
          status: "ACTIVE",
          effective_status: "ACTIVE",
        }));
      }

      if (activeAds.length === 0) {
        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `📭 Nenhum anúncio ativo encontrado.\n\nConecte ou sincronize sua conta Meta em adbrief.pro.`
        );
        return new Response("ok", { headers: cors });
      }

      // If search argument provided, filter by name
      let filteredAds = activeAds;
      if (searchArg) {
        filteredAds = activeAds.filter((a: any) =>
          a.name?.toLowerCase().includes(searchArg.toLowerCase())
        );
        if (filteredAds.length === 0) {
          await sendMessage(TELEGRAM_TOKEN, chat_id,
            `❓ Nenhum anúncio encontrado com "<b>${searchArg}</b>".\n\nEnvie /pausar sem argumento para ver a lista completa.`
          );
          return new Response("ok", { headers: cors });
        }
      }

      // If only 1 result, show confirmation directly
      if (filteredAds.length === 1) {
        const ad = filteredAds[0];
        const metaId = ad.meta_ad_id;
        const displayName = ad.name || metaId;
        const campaign = ad.ad_set?.campaign?.name || "";
        const info = campaign ? `\nCampanha: ${campaign}` : "";

        await sendMessage(TELEGRAM_TOKEN, chat_id,
          `⚠️ <b>Confirmar pausa</b>\n\n<b>${displayName}</b>${info}\n\nEssa ação será executada no Meta Ads.`,
          {
            inline_keyboard: [[
              { text: "⏸ Pausar", callback_data: `pause_confirm:${metaId}:${encodeURIComponent(displayName)}` },
              { text: "❌ Cancelar", callback_data: `pause_cancel::${encodeURIComponent(displayName)}` },
            ]],
          }
        );
        return new Response("ok", { headers: cors });
      }

      // Multiple results: show numbered list
      const listLines = filteredAds.slice(0, 20).map((ad: any, i: number) => {
        const campaign = ad.ad_set?.campaign?.name;
        const ctx = campaign ? ` <i>(${campaign})</i>` : "";
        return `<b>${i + 1}.</b> ${ad.name || ad.meta_ad_id}${ctx}`;
      });

      // Store the list in a temp cache so we can match the number reply
      await (supabase as any).from("telegram_pairing_tokens").upsert({
        user_id,
        token: `pausar_list_${chat_id}`,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
        // Store ad list as JSON in a metadata trick: reuse the token field
      }, { onConflict: "token" });

      // Store the actual ad list in account_alerts as a temporary entry
      await (supabase as any).from("account_alerts").upsert({
        id: `tg_pausar_${user_id}`,
        user_id,
        type: "system",
        urgency: "low",
        detail: JSON.stringify(filteredAds.slice(0, 20).map((a: any) => ({
          id: a.meta_ad_id,
          name: a.name || a.meta_ad_id,
        }))),
        created_at: new Date().toISOString(),
      }, { onConflict: "id" });

      const moreText = filteredAds.length > 20 ? `\n\n<i>+${filteredAds.length - 20} não mostrados. Use /pausar [nome] para filtrar.</i>` : "";

      await sendMessage(TELEGRAM_TOKEN, chat_id,
        `⏸ <b>Qual anúncio pausar?</b>\n\n${listLines.join("\n")}${moreText}\n\n<b>Responda com o número</b> (ex: <code>3</code>)`
      );
      return new Response("ok", { headers: cors });
    }

    // ── Number reply — user selecting ad from /pausar list ───────────────────
    const num = parseInt(text.trim());
    if (!isNaN(num) && num >= 1 && num <= 20) {
      // Check if there's an active pausar list for this user
      const { data: listEntry } = await (supabase as any)
        .from("account_alerts")
        .select("detail, created_at")
        .eq("id", `tg_pausar_${user_id}`)
        .maybeSingle();

      if (listEntry) {
        // Check if list is still fresh (5 min)
        const listAge = Date.now() - new Date(listEntry.created_at).getTime();
        if (listAge < 5 * 60 * 1000) {
          try {
            const adList = JSON.parse(listEntry.detail);
            const selected = adList[num - 1];
            if (selected) {
              // Clean up the temp list
              await (supabase as any).from("account_alerts").delete().eq("id", `tg_pausar_${user_id}`);

              // Show confirmation
              await sendMessage(TELEGRAM_TOKEN, chat_id,
                `⚠️ <b>Confirmar pausa</b>\n\n<b>${selected.name}</b>\n\nEssa ação será executada no Meta Ads.`,
                {
                  inline_keyboard: [[
                    { text: "⏸ Pausar", callback_data: `pause_confirm:${selected.id}:${encodeURIComponent(selected.name)}` },
                    { text: "❌ Cancelar", callback_data: `pause_cancel::${encodeURIComponent(selected.name)}` },
                  ]],
                }
              );
              return new Response("ok", { headers: cors });
            }
          } catch { /* JSON parse fail — ignore */ }
        } else {
          // List expired, clean up
          await (supabase as any).from("account_alerts").delete().eq("id", `tg_pausar_${user_id}`);
        }
      }
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
