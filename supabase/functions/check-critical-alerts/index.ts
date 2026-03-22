// check-critical-alerts v2 — CERTEIRO, não banal
// Roda a cada 6h. Máximo 1 email/dia por usuário.
// Dedup por ad_id + tipo + semana — nunca repete o mesmo alerta.
// Cruza com learned_patterns — alerta quando repete padrão de fracasso conhecido.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <alertas@adbrief.pro>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

// Thresholds — não mudar levianamente
const T = {
  FREQ_CRITICAL:    4.0,   // frequência absoluta para alerta imediato
  CTR_DROP_PCT:     45,    // % de queda em 24h para ser crítico (não 40 — muito sensível)
  CTR_DROP_MIN:     0.006, // CTR mínimo anterior para validar queda (filtra ads com CTR já baixo)
  SPEND_NO_CONV:    80,    // spend sem conversão em 24h (era 50 — muito baixo para BR)
  SCALE_CTR:        0.030, // CTR mínimo para sugestão de escala
  SCALE_SPEND_MAX:  50,    // budget atual máximo para ser "subescalado"
  SCALE_SPEND_MIN:  8,     // spend mínimo para validar (não alertar sobre ads novos)
  PATTERN_CONF:     0.55,  // confiança mínima no padrão para usar no alerta
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: conns } = await sb.from("platform_connections" as any)
      .select("user_id, persona_id, access_token, ad_accounts, selected_account_id")
      .eq("platform", "meta").eq("status", "active");

    if (!conns?.length) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let alertsFired = 0;
    const now = new Date();
    // Dedup key: per ad + alert type + ISO week (Mon-Sun)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10); // e.g. "2026-03-16"

    for (const conn of conns as any[]) {
      try {
        const { data: profile } = await sb.from("profiles")
          .select("email, name, usage_alert_flags, plan")
          .eq("id", conn.user_id).maybeSingle();
        if (!profile?.email) continue;

        // Max 1 alert email per day per user — check if already sent today
        const today = now.toISOString().slice(0, 10);
        const flags: Record<string, boolean> = (profile.usage_alert_flags as any) || {};
        const dailyKey = `alert_sent_${today}`;
        if (flags[dailyKey]) continue;

        // Get ad account
        const accounts = (conn.ad_accounts as any[]) || [];
        const selId = conn.selected_account_id;
        const account = (selId && accounts.find((a: any) => a.id === selId)) || accounts[0];
        if (!account?.id) continue;

        const token = conn.access_token;
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
        const d2 = new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0];

        // Fetch current + previous 24h
        const fields = "ad_id,ad_name,campaign_name,adset_name,spend,ctr,cpc,cpm,frequency,actions,impressions";
        const [r1, r2] = await Promise.all([
          fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${yesterday}","until":"${today}"}&sort=spend_descending&limit=40&access_token=${token}`),
          fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d2}","until":"${yesterday}"}&sort=spend_descending&limit=40&access_token=${token}`),
        ]);
        const [d1, d0] = await Promise.all([r1.json(), r2.json()]);
        if (d1.error) continue;

        const curr: any[] = d1.data || [];
        const prev: any[] = d0.data || [];
        if (!curr.length) continue;

        const prevMap: Record<string, any> = {};
        prev.forEach((a: any) => { prevMap[a.ad_id] = a; });

        const parseN = (v: any) => parseFloat(v || "0");
        const getConv = (ad: any) => {
          const a = (ad.actions || []) as any[];
          const c = a.find((x: any) => ["purchase","lead","complete_registration","app_install"].includes(x.action_type));
          return c ? parseFloat(c.value || "0") : 0;
        };

        // Load learned patterns for this user — to detect repeated failure patterns
        const { data: patterns } = await sb.from("learned_patterns" as any)
          .select("pattern_key, is_winner, avg_ctr, confidence, insight_text, variables, sample_size")
          .eq("user_id", conn.user_id)
          .gte("confidence", T.PATTERN_CONF)
          .order("confidence", { ascending: false })
          .limit(30);

        const failurePatterns = ((patterns || []) as any[])
          .filter((p: any) => !p.is_winner && p.sample_size >= 3);
        const winnerPatterns  = ((patterns || []) as any[])
          .filter((p: any) => p.is_winner && p.sample_size >= 3);

        // Detect alerts — only fires if not already alerted this week for same ad+type
        const alerts: Array<{
          type: string; ad: string; campaign: string;
          detail: string; urgency: "🔴" | "🟡";
          dedup_key: string;
        }> = [];

        for (const ad of curr) {
          const adId = ad.ad_id || ad.ad_name;
          const ctr     = parseN(ad.ctr);
          const spend   = parseN(ad.spend);
          const freq    = parseN(ad.frequency);
          const conv    = getConv(ad);
          const prevAd  = prevMap[adId];
          const prevCtr = prevAd ? parseN(prevAd.ctr) : null;
          const adName  = (ad.ad_name || "Sem nome").slice(0, 55);
          const camp    = (ad.campaign_name || "").slice(0, 45);

          const push = (type: string, detail: string, urgency: "🔴" | "🟡") => {
            const dedup = `${weekKey}_${adId}_${type.replace(/\s/g, "_")}`;
            if (!flags[dedup]) alerts.push({ type, ad: adName, campaign: camp, detail, urgency, dedup_key: dedup });
          };

          // ─── CRITICAL SIGNALS ──────────────────────────────────────────────

          // 🔴 Frequência crítica — audiência queimada
          if (freq >= T.FREQ_CRITICAL) {
            push("FADIGA_CRITICA",
              `Frequência ${freq.toFixed(1)}x — esse público já viu esse anúncio demais. ` +
              `Pause hoje e substitua o criativo. Continuar vai só aumentar o CPM.`,
              "🔴");
          }

          // 🔴 CTR colapsou em 24h — apenas se tinha CTR relevante antes
          if (prevCtr !== null && prevCtr >= T.CTR_DROP_MIN && ctr < prevCtr * ((100 - T.CTR_DROP_PCT) / 100)) {
            const drop = Math.round(((prevCtr - ctr) / prevCtr) * 100);
            push("CTR_COLAPSOU",
              `CTR caiu ${drop}% em 24h: ${(prevCtr*100).toFixed(2)}% → ${(ctr*100).toFixed(2)}%. ` +
              `Pode ser fadiga ou mudança no algoritmo. Cheque a frequência e o copy.`,
              "🔴");
          }

          // 🔴 Spend alto sem nenhuma conversão
          if (spend >= T.SPEND_NO_CONV && conv === 0) {
            push("SPEND_SEM_RETORNO",
              `R$${spend.toFixed(0)} gastos hoje sem uma única conversão. ` +
              `Ou a oferta não está convertendo, ou o público errado. Pause e revise.`,
              "🔴");
          }

          // ─── PATTERN-BASED ALERTS (o diferencial) ──────────────────────────

          // Detecta se este ad está repetindo padrão de fracasso que a IA já viu
          if (failurePatterns.length > 0 && spend > 15) {
            // Match: frequência similar ao que levou ao fracasso antes
            for (const pattern of failurePatterns.slice(0, 5)) {
              const vars = (pattern.variables as any) || {};
              const histFreqs = (vars.history || []).map((h: any) => h.frequency || 0).filter((f: number) => f > 0);
              if (histFreqs.length < 2) continue;
              const patternAvgFreq = histFreqs.reduce((s: number, f: number) => s + f, 0) / histFreqs.length;

              // If current ad is approaching the frequency level where this pattern failed before
              if (freq > patternAvgFreq * 0.8 && freq >= 2.5 && pattern.confidence > 0.6) {
                const dedup = `${weekKey}_${adId}_PATTERN_FREQ`;
                if (!flags[dedup]) {
                  alerts.push({
                    type: "PADRÃO DE RISCO",
                    ad: adName, campaign: camp,
                    detail: `Frequência ${freq.toFixed(1)}x está se aproximando do nível onde criativos similares falharam na sua conta (média ${patternAvgFreq.toFixed(1)}x). ` +
                            `Histórico mostra que vale criar variação agora antes do CTR cair.`,
                    urgency: "🟡",
                    dedup_key: dedup,
                  });
                }
                break; // one pattern alert per ad
              }
            }
          }

          // ─── OPPORTUNITY SIGNAL ────────────────────────────────────────────

          // 🟡 CTR alto com budget baixo — oportunidade de escala
          if (ctr >= T.SCALE_CTR && spend >= T.SCALE_SPEND_MIN && spend <= T.SCALE_SPEND_MAX) {
            // Cross-check with winners: if similar pattern performed well before, confidence is higher
            const confirmedByPattern = winnerPatterns.some((p: any) => {
              const vars = (p.variables as any) || {};
              const adsetMatch = vars.adset && ad.adset_name && vars.adset.toLowerCase().includes(ad.adset_name.slice(0, 10).toLowerCase());
              return adsetMatch || (p.avg_ctr && p.avg_ctr > T.SCALE_CTR * 0.8);
            });
            push("OPORTUNIDADE_ESCALA",
              `CTR ${(ctr*100).toFixed(2)}% com apenas R$${spend.toFixed(0)} de budget hoje. ` +
              (confirmedByPattern ? `Padrão similar já performou bem na sua conta antes. ` : ``) +
              `Vale aumentar o budget em 20-30% e monitorar o CPM.`,
              "🟡");
          }
        }

        if (!alerts.length) continue;

        // Sort: 🔴 first, then 🟡. Cap at 3 total — qualidade > quantidade
        const sorted = alerts
          .sort((a, b) => (a.urgency === "🔴" ? -1 : 1) - (b.urgency === "🔴" ? -1 : 1))
          .slice(0, 3);

        const urgent = sorted.filter(a => a.urgency === "🔴").length;

        // Use Haiku to write a single sharp insight tying the alerts together
        let summaryInsight = "";
        if (ANTHROPIC_KEY && sorted.length > 1) {
          try {
            const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 120,
                system: "Você é o AdBrief AI. Escreva UMA frase de 20-30 palavras em PT-BR resumindo a situação da conta com base nos alertas. Seja específico, direto, sem floreios. Foque no impacto financeiro.",
                messages: [{ role: "user", content: JSON.stringify(sorted.map(a => ({ tipo: a.type, anuncio: a.ad, detalhe: a.detail }))) }],
              }),
            });
            const aiData = await aiRes.json();
            summaryInsight = aiData.content?.[0]?.text?.replace(/"/g, "").trim() || "";
          } catch (_) {}
        }

        // Build email
        const F = "'Inter', Arial, sans-serif";
        const subject = urgent > 0
          ? `⚠️ ${urgent} alerta${urgent > 1 ? "s" : ""} crítico${urgent > 1 ? "s" : ""} detectado${urgent > 1 ? "s" : ""} — AdBrief`
          : `💡 Oportunidade identificada na sua conta — AdBrief`;

        const alertRows = sorted.map(a => `
          <tr>
            <td style="padding:14px 20px;border-bottom:1px solid #13132a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 4px;">
                    <span style="font-size:10px;font-weight:700;color:${a.urgency === "🔴" ? "#f87171" : "#fbbf24"};font-family:${F};text-transform:uppercase;letter-spacing:0.1em;">${a.urgency} ${a.type.replace(/_/g, " ")}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 3px;">
                    <span style="font-size:14px;font-weight:700;color:#eef0f6;font-family:${F};">${a.ad}</span>
                    ${a.campaign ? `<span style="font-size:11px;color:rgba(238,240,246,0.4);font-family:${F};"> · ${a.campaign}</span>` : ""}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="font-size:12px;color:rgba(238,240,246,0.65);font-family:${F};line-height:1.5;">${a.detail}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`).join("");

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#07080f;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;">
  <tr><td align="center" style="padding:28px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#0d0d1a;border-radius:16px;overflow:hidden;border:1px solid #1a1a2e;">
      
      <!-- Header -->
      <tr><td style="padding:22px 20px 16px;background:linear-gradient(160deg,#0d0d1a 60%,#12122a);">
        <p style="margin:0 0 2px;font-size:10px;font-weight:800;color:#0ea5e9;font-family:${F};text-transform:uppercase;letter-spacing:0.14em;">AdBrief AI · ${account.name || account.id}</p>
        <p style="margin:0;font-size:20px;font-weight:900;color:#eef0f6;font-family:${F};letter-spacing:-0.03em;">
          ${urgent > 0 ? `${urgent} alerta${urgent > 1 ? "s" : ""} crítico${urgent > 1 ? "s" : ""} na conta` : "Oportunidade identificada"}
        </p>
        ${summaryInsight ? `<p style="margin:8px 0 0;font-size:12px;color:rgba(238,240,246,0.5);font-family:${F};line-height:1.5;">${summaryInsight}</p>` : ""}
      </td></tr>

      <!-- Alerts -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">${alertRows}</table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:18px 20px 22px;">
        <a href="https://adbrief.pro/dashboard/ai" style="display:block;text-align:center;padding:12px 20px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#000;font-family:${F};font-size:13px;font-weight:800;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
          Abrir AdBrief e agir →
        </a>
        <p style="margin:10px 0 0;text-align:center;font-size:10px;color:rgba(238,240,246,0.2);font-family:${F};">
          Detectado automaticamente · dados Meta Ads em tempo real · máx. 1 alerta/dia
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [profile.email], subject, html }),
        });

        if (emailRes.ok) {
          alertsFired++;
          // Mark: sent today + each individual alert deduped for this week
          const newFlags: Record<string, boolean> = { ...flags, [dailyKey]: true };
          sorted.forEach(a => { newFlags[a.dedup_key] = true; });
          await sb.from("profiles").update({ usage_alert_flags: newFlags } as any).eq("id", conn.user_id);
        }

      } catch (e) {
        console.error("Alert error for user:", conn.user_id, String(e));
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: conns.length, alerts_fired: alertsFired }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
// redeploy 202603262500
