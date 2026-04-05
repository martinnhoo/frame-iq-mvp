// send-daily-intelligence-email v3 — redesign bold, sem v2 — consolidated multi-account report
// One email per user, all connected ad accounts together
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const L: Record<Lang, {
  subject: (n: number, totalSpend: string) => string;
  preheader: (insight: string) => string;
  greeting: string; subtitle: string;
  scale: string; pause: string; fatigue: string;
  spendLabel: string; ctrLabel: string; adsLabel: string;
  cta: string; ctaSub: string;
  footer: string; noActivity: string;
  urgentLabel: string; summaryLabel: string;
}> = {
  pt: {
    subject: (n, s) => n === 1 ? `Relatório diário · R$${s} esta semana` : `Relatório diário · ${n} contas · R$${s} total`,
    preheader: (i) => i || "Seus números de hoje, o que escalar e o que pausar — tudo aqui.",
    greeting: "Bom dia", subtitle: "Relatório de Performance",
    scale: "↑ Escalar", pause: "⏸ Pausar", fatigue: "⚠️ Fadiga",
    spendLabel: "Spend 7d", ctrLabel: "CTR", adsLabel: "Ads",
    cta: "Abrir AdBrief e agir →",
    ctaSub: "Conectado ao seu Meta Ads em tempo real",
    footer: "Você recebe isso porque tem contas Meta Ads conectadas no AdBrief.",
    noActivity: "Sem campanhas ativas esta semana.",
    urgentLabel: "URGENTE",
    summaryLabel: "Resumo geral",
  },
  en: {
    subject: (n, s) => n === 1 ? `Daily report · $${s} this week` : `Daily report · ${n} accounts · $${s} total`,
    preheader: (i) => i || "Today's numbers, what to scale and what to pause — all here.",
    greeting: "Good morning", subtitle: "Performance Report",
    scale: "↑ Scale", pause: "⏸ Pause", fatigue: "⚠️ Fatigue",
    spendLabel: "7d Spend", ctrLabel: "CTR", adsLabel: "Ads",
    cta: "Open AdBrief and act →",
    ctaSub: "Connected to your Meta Ads in real time",
    footer: "You receive this because you have Meta Ads accounts connected in AdBrief.",
    noActivity: "No active campaigns this week.",
    urgentLabel: "URGENT",
    summaryLabel: "Overall summary",
  },
  es: {
    subject: (n, s) => n === 1 ? `Reporte diario · $${s} esta semana` : `Reporte diario · ${n} cuentas · $${s} total`,
    preheader: (i) => i || "Tus números de hoy, qué escalar y qué pausar — todo aquí.",
    greeting: "Buenos días", subtitle: "Reporte de Performance",
    scale: "↑ Escalar", pause: "⏸ Pausar", fatigue: "⚠️ Fatiga",
    spendLabel: "Gasto 7d", ctrLabel: "CTR", adsLabel: "Anuncios",
    cta: "Abrir AdBrief y actuar →",
    ctaSub: "Conectado a tu Meta Ads en tiempo real",
    footer: "Recibes esto porque tienes cuentas Meta Ads conectadas en AdBrief.",
    noActivity: "Sin campañas activas esta semana.",
    urgentLabel: "URGENTE",
    summaryLabel: "Resumen general",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt"; if (c === "es") return "es"; return "en";
}

function ctrColor(ctr: number): string {
  return ctr >= 0.02 ? "#34d399" : ctr >= 0.01 ? "#fbbf24" : "#f87171";
}

function buildHtml(l: typeof L["pt"], firstName: string, snaps: any[], appUrl: string, lang: Lang): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";
  const M = "'Helvetica Neue',Arial,sans-serif";
  const curr = lang === "pt" ? "R$" : "$";
  const today = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en-US", { weekday: "long", day: "numeric", month: "long" });

  // Totals across all accounts
  const totalSpend = snaps.reduce((s, a) => s + (a.total_spend || 0), 0);
  const totalAds = snaps.reduce((s, a) => s + (a.active_ads || 0), 0);
  const avgCtr = totalSpend > 0 ? snaps.reduce((s, a) => s + (a.avg_ctr || 0) * (a.total_spend || 0), 0) / totalSpend : 0;
  const totalScale = snaps.reduce((s, a) => s + (a.winners_count || 0), 0);
  const totalPause = snaps.reduce((s, a) => s + (a.losers_count || 0), 0);

  // Collect ALL urgent actions across accounts
  const allUrgent: { account: string; action: any }[] = [];
  snaps.forEach(snap => {
    const actions = (snap.raw_period?.actions || []) as any[];
    actions.filter((a: any) => a.urgencia === "alta").slice(0, 2).forEach((a: any) => {
      allUrgent.push({ account: snap.account_name, action: a });
    });
  });

  // Summary row component
  const summaryRow = `
    <tr>
      <td style="padding:0 0 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(14,165,233,0.04);border-radius:14px;border:1px solid rgba(14,165,233,0.15);">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:rgba(238,240,246,0.30);letter-spacing:0.12em;text-transform:uppercase;font-family:${F};">${l.summaryLabel} · ${snaps.length} ${snaps.length === 1 ? "conta" : (lang === "pt" ? "contas" : lang === "es" ? "cuentas" : "accounts")}</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="25%" style="text-align:center;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#eef0f6;letter-spacing:-0.05em;font-family:${F};">${curr}${totalSpend.toFixed(0)}</p>
                <p style="margin:3px 0 0;font-size:9px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.spendLabel}</p>
              </td>
              <td width="25%" style="text-align:center;">
                <p style="margin:0;font-size:26px;font-weight:900;color:${ctrColor(avgCtr)};letter-spacing:-0.05em;font-family:${F};">${(avgCtr * 100).toFixed(2)}%</p>
                <p style="margin:3px 0 0;font-size:9px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.ctrLabel}</p>
              </td>
              <td width="25%" style="text-align:center;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#34d399;letter-spacing:-0.05em;font-family:${F};">${totalScale}</p>
                <p style="margin:3px 0 0;font-size:9px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.scale}</p>
              </td>
              <td width="25%" style="text-align:center;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#f87171;letter-spacing:-0.05em;font-family:${F};">${totalPause}</p>
                <p style="margin:3px 0 0;font-size:9px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;letter-spacing:0.08em;">${l.pause}</p>
              </td>
            </tr>
            </table>
          </td>
        </tr>
        </table>
      </td>
    </tr>`;

  // Urgent actions block (cross-account)
  const urgentBlock = allUrgent.length > 0 ? `
    <tr><td style="padding:0 0 20px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(248,113,113,0.06);border-radius:14px;border:1px solid rgba(248,113,113,0.18);">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:rgba(248,113,113,0.70);letter-spacing:0.12em;text-transform:uppercase;font-family:${F};">⚡ ${l.urgentLabel}</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${allUrgent.slice(0, 4).map(({ account, action }) => `
          <tr><td style="padding:0 0 8px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td style="padding:10px 14px;background:rgba(0,0,0,0.2);border-radius:9px;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${action.tipo === "escalar" ? "#34d399" : "#f87171"};font-family:${F};text-transform:uppercase;letter-spacing:0.05em;">${action.tipo === "escalar" ? l.scale : action.tipo === "pausar" ? l.pause : l.fatigue}</p>
                <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:rgba(238,240,246,0.85);font-family:${F};">${action.anuncio?.slice(0, 45) || "—"}</p>
                <p style="margin:0;font-size:11px;color:rgba(238,240,246,0.40);font-family:${M};">${action.motivo} · <span style="color:rgba(238,240,246,0.25);">${account}</span></p>
              </td>
            </tr></table>
          </td></tr>`).join("")}
        </table>
      </td></tr>
      </table>
    </td></tr>` : "";

  // Per-account sections
  const accountSections = snaps.map((snap, idx) => {
    const topAds = (snap.top_ads || []) as any[];
    const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 2);
    const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 2);
    const fatigued = topAds.filter((a: any) => a.isFatigued && !toPause.find((p: any) => p.id === a.id)).slice(0, 1);
    const hasData = snap.total_spend > 0;
    const borderColor = idx === 0 ? "rgba(14,165,233,0.20)" : "rgba(255,255,255,0.07)";

    const adPill = (ad: any, badge: string, color: string) => `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:6px;">
      <tr><td style="padding:9px 12px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid ${color};">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td>
            <p style="margin:0;font-size:12px;font-weight:600;color:rgba(238,240,246,0.80);font-family:${F};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">${ad.name?.slice(0, 42) || "—"}</p>
            <p style="margin:1px 0 0;font-size:10px;color:rgba(238,240,246,0.35);font-family:${M};">CTR ${(ad.ctr * 100)?.toFixed(2)}% · ${curr}${ad.spend?.toFixed(0)}${ad.conversions > 0 ? ` · ${ad.conversions} conv` : ""}</p>
          </td>
          <td align="right" style="white-space:nowrap;padding-left:8px;">
            <span style="font-size:10px;font-weight:700;color:${color};font-family:${F};">${badge}</span>
          </td>
        </tr></table>
      </td></tr>
      </table>`;

    return `
    <tr><td style="padding:0 0 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(160deg,#0e1628,#0a1020);border-radius:16px;border:1px solid ${borderColor};overflow:hidden;">

        <!-- Account header -->
        <tr><td style="padding:14px 20px;background:rgba(14,165,233,0.05);border-bottom:1px solid rgba(14,165,233,0.1);">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td>
              <p style="margin:0;font-size:13px;font-weight:700;color:#eef0f6;font-family:${F};">${snap.account_name || "Conta"}</p>
            </td>
            <td align="right">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 10px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;font-size:15px;font-weight:800;color:#eef0f6;font-family:${F};">${curr}${(snap.total_spend || 0).toFixed(0)}</p>
                  <p style="margin:0;font-size:8px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;">${l.spendLabel}</p>
                </td>
                <td style="padding:0 10px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;font-size:15px;font-weight:800;color:${ctrColor(snap.avg_ctr || 0)};font-family:${F};">${((snap.avg_ctr || 0) * 100).toFixed(2)}%</p>
                  <p style="margin:0;font-size:8px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;">${l.ctrLabel}</p>
                </td>
                <td style="padding:0 0 0 10px;text-align:center;">
                  <p style="margin:0;font-size:15px;font-weight:800;color:rgba(238,240,246,0.70);font-family:${F};">${snap.active_ads || 0}</p>
                  <p style="margin:0;font-size:8px;color:rgba(238,240,246,0.30);font-family:${M};text-transform:uppercase;">${l.adsLabel}</p>
                </td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>

        <!-- Ad actions -->
        <tr><td style="padding:14px 20px;">
          ${!hasData ? `<p style="margin:0;font-size:13px;color:rgba(238,240,246,0.30);font-family:${M};">${l.noActivity}</p>` : `
            ${toScale.map((a: any) => adPill(a, l.scale, "#34d399")).join("")}
            ${toPause.map((a: any) => adPill(a, l.pause, "#f87171")).join("")}
            ${fatigued.map((a: any) => adPill(a, l.fatigue, "#fbbf24")).join("")}
          `}
          ${snap.ai_insight ? `<p style="margin:10px 0 0;font-size:12px;color:rgba(238,240,246,0.50);line-height:1.55;font-family:${M};">💡 ${snap.ai_insight}</p>` : ""}
        </td></tr>

      </table>
    </td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/></head>
<body style="margin:0;padding:0;background:#050811;font-family:${M};-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${l.preheader(snaps[0]?.ai_insight || "")}&nbsp;‌&nbsp;‌&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050811;">
<tr><td align="center" style="padding:40px 16px 56px;">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

  <!-- LOGO + DATE — matches landing page exactly -->
  <tr><td style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td valign="middle">
        <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:20px;font-weight:800;color:#0ea5e9;letter-spacing:-0.05em;font-family:${F};">brief</span>
      </td>
      <td align="right" valign="middle">
        <p style="margin:0;font-size:11px;color:rgba(238,240,246,0.25);font-family:${M};">${today}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Hero greeting -->
  <tr><td style="padding-bottom:24px;">
    <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;font-family:${F};">${l.greeting}, ${firstName}.</h1>
    <p style="margin:0;font-size:14px;color:rgba(238,240,246,0.40);font-family:${M};">${l.subtitle}</p>
  </td></tr>

  <!-- Summary row (multi-account total) -->
  ${snaps.length > 1 ? summaryRow : ""}

  <!-- Urgent actions (cross-account) -->
  ${urgentBlock}

  <!-- Per-account sections -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${accountSections}
  </table>

  <!-- CTA -->
  <tr><td style="padding:8px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <a href="${appUrl}/dashboard/ai" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;font-family:${F};letter-spacing:-0.01em;box-shadow:0 8px 32px rgba(14,165,233,0.28);">${l.cta}</a>
      <p style="margin:8px 0 0;font-size:11px;color:rgba(238,240,246,0.22);font-family:${M};">${l.ctaSub}</p>
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:28px 4px 0;text-align:center;border-top:1px solid rgba(14,165,233,0.1);margin-top:28px;">
    <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.18);font-family:${M};">${l.footer}</p>
    <a href="${appUrl}" style="font-size:11px;color:rgba(255,255,255,0.22);font-family:${M};text-decoration:none;">adbrief.pro</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

    // Internal only — require service role
    const authH = req.headers.get("Authorization") ?? "";
    if (authH !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
  try {
    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";
    const body   = await req.json();

    let email: string, name: string, language: string, snaps: any[];

    if (body.user_id) {
      // Called from daily-intelligence with all_results (multiple accounts)
      const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: profile } = await sb.from("profiles").select("name, email, preferred_language").eq("id", body.user_id).single();
      if (!profile?.email) return new Response(JSON.stringify({ error: "no email" }), { status: 400, headers: cors });
      email = profile.email;
      name = profile.name || "";
      language = profile.preferred_language || "pt";

      if (body.all_results?.length > 0) {
        // Fetch full snapshots for today
        const today = new Date().toISOString().split("T")[0];
        const personaIds = body.all_results.map((r: any) => r.persona_id).filter(Boolean);
        const { data: snapData } = await sb.from("daily_snapshots" as any)
          .select("*").eq("user_id", body.user_id).eq("date", today);
        snaps = snapData || [];
      } else {
        snaps = body.snapshot ? [body.snapshot] : [];
      }
    } else {
      // Direct test call
      email = body.email;
      name = body.name || "";
      language = body.language || "pt";
      snaps = body.snapshots || (body.snapshot ? [body.snapshot] : []);
    }

    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: cors });
    if (!snaps.length) return new Response(JSON.stringify({ skipped: "no snapshots" }), { headers: cors });

    const lang = detectLang(language);
    const l = L[lang];
    const firstName = name.split(" ")[0] || (lang === "pt" ? "gestor" : "there");
    const curr = lang === "pt" ? "R$" : "$";
    const totalSpend = snaps.reduce((s: number, a: any) => s + (a.total_spend || 0), 0);
    const subject = l.subject(snaps.length, totalSpend.toFixed(0));
    const html = buildHtml(l, firstName, snaps, APP, lang);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, html }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, accounts: snaps.length, ...data }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
// redeploy 202604052100
