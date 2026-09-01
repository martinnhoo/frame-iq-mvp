import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const META_ACCOUNT = "act_152022538205761";
const CAMPAIGN = "NIVARA | SALES | BR | BIDCAP | 01";
const NIVARA_API = "https://ceiyuefknqdtiosxqbue.supabase.co/functions/v1/nivara-dashboard";
const NIVARA_KEY = "nivaraDashboardTokenV1";

type AnyRow = Record<string, any>;

const N = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v: any) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const integer = (v: any) => Math.round(N(v)).toLocaleString("pt-BR");

const pct = (v: any) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : `${Number(v).toFixed(2).replace(".", ",")}%`;

const mult = (v: any) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : `${Number(v).toFixed(2).replace(".", ",")}x`;

function purchaseCount(actions: AnyRow[] = []) {
  const priority = [
    "offsite_conversion.fb_pixel_purchase",
    "purchase",
    "omni_purchase",
    "onsite_conversion.purchase",
  ];
  for (const type of priority) {
    const row = actions.find((x) => x?.action_type === type);
    if (row) return N(row.value);
  }
  return 0;
}

async function loadNivara() {
  let token = localStorage.getItem(NIVARA_KEY) || "";
  if (!token) {
    token = window.prompt("Senha do painel NIVARA:") || "";
    if (token) localStorage.setItem(NIVARA_KEY, token);
  }
  if (!token) throw new Error("Senha do painel NIVARA não informada.");

  const request = () =>
    fetch(NIVARA_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dashboard-token": token,
      },
      body: JSON.stringify({ action: "metrics", range: "all" }),
    });

  let res = await request();

  if (res.status === 401) {
    localStorage.removeItem(NIVARA_KEY);
    token = window.prompt("Senha do painel NIVARA:") || "";
    if (!token) throw new Error("Senha do painel NIVARA não informada.");
    localStorage.setItem(NIVARA_KEY, token);
    res = await request();
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Não consegui ler o backend da NIVARA.");
  return json;
}

async function loadMeta() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error("ADBRIEF_LOGIN_REQUIRED");
  }

  const userId = session.user.id;

  const { data: connData, error: connErr } = await supabase.functions.invoke("meta-oauth", {
    body: { action: "get_connections", user_id: userId },
  });

  if (connErr) throw new Error(`Meta: ${connErr.message}`);

  const connections: AnyRow[] = connData?.connections || [];
  const connection = connections.find(
    (c) =>
      c.platform === "meta" &&
      c.status === "active" &&
      (c.selected_account_id === META_ACCOUNT ||
        (Array.isArray(c.ad_accounts) &&
          c.ad_accounts.some((a: AnyRow) => a?.id === META_ACCOUNT)))
  );

  if (!connection?.persona_id) {
    throw new Error(
      "Não achei uma conexão Meta ativa do AdBrief para a conta da NIVARA."
    );
  }

  const { data: adsData, error: adsErr } = await supabase.functions.invoke("meta-oauth", {
    body: {
      action: "list_ads",
      user_id: userId,
      persona_id: connection.persona_id,
    },
  });

  if (adsErr) throw new Error(`Meta: ${adsErr.message}`);
  if (adsData?.error) throw new Error(`Meta: ${adsData.error}`);

  const allAds: AnyRow[] = adsData?.ads || [];
  const ads = allAds.filter(
    (ad) =>
      String(ad?.campaign_name || "").trim().toLowerCase() ===
      CAMPAIGN.toLowerCase()
  );

  const spend = ads.reduce((s, a) => s + N(a.spend), 0);
  const impressions = ads.reduce((s, a) => s + N(a.impressions), 0);
  const clicks = ads.reduce((s, a) => s + N(a.clicks), 0);
  const purchases = ads.reduce((s, a) => s + purchaseCount(a.actions || []), 0);
  const reach = ads.reduce((s, a) => s + N(a.reach), 0);

  return {
    account: adsData?.account || META_ACCOUNT,
    personaId: connection.persona_id,
    ads: ads
      .map((a) => ({
        id: a.ad_id || "",
        name: a.ad_name || "Sem nome",
        adset: a.adset_name || "",
        spend: N(a.spend),
        impressions: N(a.impressions),
        clicks: N(a.clicks),
        ctr: N(a.ctr),
        cpc: N(a.cpc),
        cpm: N(a.cpm),
        purchases: purchaseCount(a.actions || []),
      }))
      .sort((a, b) => b.spend - a.spend),
    spend,
    impressions,
    clicks,
    purchases,
    reach,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
  };
}

function Card({
  label,
  value,
  sub,
  tone = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="nv-card">
      <div className="nv-label">{label}</div>
      <div className={`nv-value ${tone}`}>{value}</div>
      {sub ? <div className="nv-sub">{sub}</div> : null}
    </div>
  );
}

export default function NivaraDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const [meta, nivara] = await Promise.all([loadMeta(), loadNivara()]);

      const f = nivara?.funnel || {};
      const m = nivara?.money || {};

      const buyers = N(f.purchases);
      const gross = N(m.gross);
      const net = N(m.net);
      const spend = N(meta.spend);

      setData({
        meta,
        nivara,
        real: {
          buyers,
          gross,
          net,
          cpa: buyers > 0 ? spend / buyers : null,
          roas: spend > 0 ? gross / spend : null,
          profit: net - spend,
          netAov: buyers > 0 ? net / buyers : null,
        },
      });

      setUpdated(new Date().toLocaleString("pt-BR"));
    } catch (e: any) {
      if (String(e?.message || e) === "ADBRIEF_LOGIN_REQUIRED") {
        setError("Você precisa estar logado no AdBrief. Entre na sua conta e volte para /nivara.");
      } else {
        setError(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 60000);
    return () => window.clearInterval(t);
  }, []);

  const diagnosis = useMemo(() => {
    if (!data) return null;

    const a = data.meta;
    const f = data.nivara?.funnel || {};
    const r = data.real;

    if (a.impressions < 300)
      return {
        tone: "warn",
        title: "Amostra pequena",
        text: "Ainda não há volume suficiente para julgar criativo ou funil.",
      };

    if (a.ctr != null && a.ctr < 0.8)
      return {
        tone: "bad",
        title: "Primeiro suspeito: criativo",
        text: "CTR está baixo. Hook, promessa ou peça provavelmente precisam melhorar.",
      };

    if (a.clicks >= 20 && N(f.quiz_started) / a.clicks < 0.5)
      return {
        tone: "bad",
        title: "Perda entre anúncio e quiz",
        text: "As pessoas clicam, mas poucas começam a leitura.",
      };

    if (N(f.quiz_started) >= 20 && N(f.quiz_completed) / N(f.quiz_started) < 0.6)
      return {
        tone: "warn",
        title: "Gargalo no quiz",
        text: "Muita gente começa, mas não termina.",
      };

    if (N(f.teaser_viewed) >= 10 && N(f.checkout_clicked) / N(f.teaser_viewed) < 0.2)
      return {
        tone: "warn",
        title: "Gargalo na oferta",
        text: "O teaser é visto, mas pouca gente vai para o checkout.",
      };

    if (N(f.checkout_clicked) >= 5 && N(f.purchases) / N(f.checkout_clicked) < 0.1)
      return {
        tone: "bad",
        title: "Gargalo no checkout",
        text: "Existe intenção, mas pouca compra confirmada.",
      };

    if (r.buyers > 0)
      return {
        tone: "good",
        title: "O funil já converte",
        text: "Agora compare CPA, AOV e quais criativos estão trazendo as melhores compras.",
      };

    return {
      tone: "warn",
      title: "Ainda coletando sinal",
      text: "Continue rodando. O painel vai apontar o gargalo conforme o volume crescer.",
    };
  }, [data]);

  const stages = useMemo(() => {
    if (!data) return [];
    const f = data.nivara?.funnel || {};
    return [
      ["Começaram a leitura", N(f.quiz_started)],
      ["Terminaram o quiz", N(f.quiz_completed)],
      ["Escolheram 3 cartas", N(f.cards_completed)],
      ["Deixaram contato", N(f.lead_submitted)],
      ["Viram o teaser", N(f.teaser_viewed)],
      ["Foram ao checkout", N(f.checkout_clicked)],
      ["Compraram", N(f.purchases)],
    ];
  }, [data]);

  const maxStage = Math.max(1, ...stages.map((x) => Number(x[1])));

  return (
    <>
      <style>{`
        :root{
          --nv-bg:#070b13; --nv-panel:#0d1320; --nv-panel2:#111927;
          --nv-line:#273247; --nv-text:#f5eee5; --nv-muted:#8f99aa;
          --nv-gold:#ddb36a; --nv-good:#7fc49c; --nv-warn:#e1b767; --nv-bad:#de8b8b;
        }
        *{box-sizing:border-box}
        body{margin:0}
        .nv-shell{
          min-height:100vh;color:var(--nv-text);
          background:linear-gradient(180deg,#070b13,#090e18 50%,#070b13);
          font:14px Inter,system-ui,-apple-system,Segoe UI,sans-serif;
        }
        .nv-wrap{max-width:1180px;margin:auto;padding:24px 16px 64px}
        .nv-top{display:flex;gap:18px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:20px}
        .nv-brand small{color:var(--nv-gold);letter-spacing:.2em}
        .nv-brand h1{font:400 34px Georgia,serif;margin:5px 0 0}
        .nv-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .nv-btn{
          border:1px solid var(--nv-line);background:#0b111c;color:#cfd6df;
          border-radius:10px;padding:10px 13px;cursor:pointer
        }
        .nv-live{border:1px solid #315340;color:#9fd4b2;border-radius:999px;padding:8px 11px}
        .nv-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .nv-card{
          background:linear-gradient(180deg,var(--nv-panel2),var(--nv-panel));
          border:1px solid var(--nv-line);border-radius:15px;padding:17px;min-height:116px
        }
        .nv-label{font-size:11px;color:var(--nv-muted);text-transform:uppercase;letter-spacing:.08em}
        .nv-value{font-size:29px;font-weight:650;margin-top:10px}
        .nv-sub{font-size:12px;color:var(--nv-muted);margin-top:6px;line-height:1.4}
        .good{color:var(--nv-good)} .warn{color:var(--nv-warn)} .bad{color:var(--nv-bad)}
        .nv-section{margin-top:18px}
        .nv-section h2{font:400 23px Georgia,serif;margin:0 0 11px}
        .nv-diag{padding:16px;border-radius:14px;border:1px solid #3b3540;background:#12121a;line-height:1.55}
        .nv-diag strong{display:block;margin-bottom:4px;font-size:15px}
        .nv-funnel{display:grid;gap:8px}
        .nv-step{
          display:grid;grid-template-columns:minmax(170px,1.5fr) 80px 90px 2fr;
          gap:12px;align-items:center;background:#0c121d;border:1px solid #202b3d;
          border-radius:12px;padding:12px 14px
        }
        .nv-step b{font-size:15px}.nv-num{font-size:20px;font-weight:650}
        .nv-rate{font-size:12px;color:var(--nv-muted)}
        .nv-bar{height:8px;background:#161f2d;border-radius:99px;overflow:hidden}
        .nv-bar i{display:block;height:100%;background:linear-gradient(90deg,#9e773d,#e6c17d);border-radius:99px}
        .nv-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .nv-table-wrap{overflow:auto;border:1px solid var(--nv-line);border-radius:14px}
        .nv-table{width:100%;border-collapse:collapse;min-width:900px;background:#0b111b}
        .nv-table th,.nv-table td{padding:11px 12px;text-align:right;border-bottom:1px solid #1e2838;white-space:nowrap}
        .nv-table th:first-child,.nv-table td:first-child{text-align:left}
        .nv-table th{font-size:10px;color:#8792a4;text-transform:uppercase;letter-spacing:.07em;background:#0f1622}
        .nv-table small{color:var(--nv-muted)}
        .nv-error{background:#281417;border:1px solid #5c2c34;color:#e3a0a8;padding:14px;border-radius:12px}
        .nv-muted{color:var(--nv-muted);font-size:12px}
        @media(max-width:900px){
          .nv-grid{grid-template-columns:repeat(2,1fr)}
          .nv-two{grid-template-columns:1fr}
          .nv-step{grid-template-columns:1fr 65px 90px}
          .nv-step .nv-bar{grid-column:1/-1}
        }
        @media(max-width:520px){
          .nv-grid{grid-template-columns:1fr 1fr}
          .nv-card{min-height:105px;padding:14px}
          .nv-value{font-size:24px}
          .nv-step{grid-template-columns:1fr 58px 68px;padding:11px}
          .nv-wrap{padding:18px 11px 50px}
          .nv-brand h1{font-size:29px}
        }
      `}</style>

      <div className="nv-shell">
        <div className="nv-wrap">
          <div className="nv-top">
            <div className="nv-brand">
              <small>NIVARA · OPERAÇÃO</small>
              <h1>Painel simples de performance</h1>
            </div>
            <div className="nv-actions">
              <span className="nv-live">Meta via AdBrief</span>
              <button className="nv-btn" onClick={refresh}>
                {loading ? "Atualizando…" : "↻ Atualizar"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="nv-error">
              <b>Não consegui carregar o painel.</b>
              <div style={{ marginTop: 6 }}>{error}</div>
              {error.includes("logado no AdBrief") ? (
                <div style={{ marginTop: 10 }}>
                  <a href="/login" style={{ color: "#ddb36a" }}>Entrar no AdBrief</a>
                </div>
              ) : null}
            </div>
          ) : null}

          {!error && loading && !data ? (
            <div className="nv-diag">Carregando Meta + funil + Cakto…</div>
          ) : null}

          {data ? (
            <>
              <div className="nv-grid">
                <Card label="Gasto Meta" value={money(data.meta.spend)} sub="campanha NIVARA · últimos 30 dias" />
                <Card label="Impressões" value={integer(data.meta.impressions)} sub="Meta Ads" />
                <Card label="Cliques" value={integer(data.meta.clicks)} sub={`CTR ${pct(data.meta.ctr)}`} />
                <Card label="CPC" value={money(data.meta.cpc)} sub={`CPM ${money(data.meta.cpm)}`} />

                <Card label="Compras Cakto" value={integer(data.real.buyers)} sub="pagamentos principais" />
                <Card label="CPA real" value={money(data.real.cpa)} sub="Meta ÷ compras Cakto" />
                <Card label="ROAS real" value={mult(data.real.roas)} sub="receita Cakto ÷ mídia" />
                <Card label="AOV líquido" value={money(data.real.netAov)} sub="após taxa estimada da Cakto" />
              </div>

              {diagnosis ? (
                <div className="nv-section">
                  <div className={`nv-diag ${diagnosis.tone}`}>
                    <strong>{diagnosis.title}</strong>
                    {diagnosis.text}
                  </div>
                </div>
              ) : null}

              <div className="nv-section">
                <h2>Funil em português</h2>
                <div className="nv-funnel">
                  {stages.map((s, i) => {
                    const prev = i > 0 ? Number(stages[i - 1][1]) : null;
                    const rate = prev && prev > 0 ? (Number(s[1]) / prev) * 100 : null;
                    return (
                      <div className="nv-step" key={String(s[0])}>
                        <b>{String(s[0])}</b>
                        <span className="nv-num">{integer(s[1])}</span>
                        <span className="nv-rate">{i === 0 ? "base" : pct(rate)}</span>
                        <span className="nv-bar">
                          <i style={{ width: `${Math.max(Number(s[1]) > 0 ? 3 : 0, (Number(s[1]) / maxStage) * 100)}%` }} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="nv-section nv-two">
                <div>
                  <h2>Dinheiro</h2>
                  <div className="nv-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <Card label="Receita bruta" value={money(data.real.gross)} />
                    <Card label="Após Cakto" value={money(data.real.net)} />
                    <Card
                      label="Resultado após mídia"
                      value={money(data.real.profit)}
                      tone={data.real.profit >= 0 ? "good" : "bad"}
                    />
                    <Card label="CPA alvo" value={money(data.nivara?.money?.cpa_target)} sub="com ~40% de folga" />
                  </div>
                </div>

                <div>
                  <h2>Monetização</h2>
                  <div className="nv-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <Card
                      label="Carta Oculta"
                      value={pct(data.nivara?.money?.bump_rate)}
                      sub={`${integer(data.nivara?.funnel?.orderbump_purchases)} pedido(s)`}
                    />
                    <Card
                      label="Leitura Profunda"
                      value={pct(data.nivara?.money?.upsell_rate)}
                      sub={`${integer(data.nivara?.funnel?.upsell_purchases)} pedido(s)`}
                    />
                    <Card
                      label="Pergunta Direta"
                      value={pct(data.nivara?.money?.downsell_rate)}
                      sub={`${integer(data.nivara?.funnel?.downsell_purchases)} pedido(s)`}
                    />
                    <Card
                      label="CPA break-even"
                      value={money(data.nivara?.money?.breakeven)}
                      sub="antes de outros custos"
                    />
                  </div>
                </div>
              </div>

              <div className="nv-section">
                <h2>Anúncios da campanha na Meta</h2>
                <div className="nv-table-wrap">
                  <table className="nv-table">
                    <thead>
                      <tr>
                        <th>Anúncio</th>
                        <th>Gasto</th>
                        <th>Impressões</th>
                        <th>Cliques</th>
                        <th>CTR</th>
                        <th>CPC</th>
                        <th>CPM</th>
                        <th>Compra Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.meta.ads.length ? (
                        data.meta.ads.map((ad: AnyRow) => (
                          <tr key={ad.id || ad.name}>
                            <td>
                              <b>{ad.name}</b>
                              <br />
                              <small>{ad.adset}</small>
                            </td>
                            <td>{money(ad.spend)}</td>
                            <td>{integer(ad.impressions)}</td>
                            <td>{integer(ad.clicks)}</td>
                            <td>{pct(ad.ctr)}</td>
                            <td>{money(ad.cpc)}</td>
                            <td>{money(ad.cpm)}</td>
                            <td>{integer(ad.purchases)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>A campanha ainda não retornou anúncios com gasto nos últimos 30 dias.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="nv-section">
                <div className="nv-muted">
                  Meta: conexão já existente do AdBrief · Campanha: {CAMPAIGN} ·
                  Nivara/Cakto: backend da NIVARA · Atualizado: {updated} · atualização automática a cada 60s.
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
