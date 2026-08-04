/**
 * PlansPage — planos do Hub, USD e BRL.
 *
 * A tabela mostra o que cada plano COMPRA, não quantos créditos tem.
 * "700 créditos" não significa nada para ninguém; "17 vídeos ou 175 imagens"
 * significa. Os números vêm de hubPlans.ts, que espelha o custo real.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, Zap, Tag, X } from "lucide-react";
import {
  HUB_PLANS, CREDIT_PACK, CREDIT_COSTS,
  type HubPlan, type PlanKey,
} from "@/lib/hubPlans";
import { useHubCredits } from "@/hooks/useHubCredits";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  border1: "rgba(240,246,252,0.07)", border2: "rgba(240,246,252,0.12)",
  text1: "#F0F6FC", text2: "rgba(240,246,252,0.72)", text3: "rgba(240,246,252,0.48)",
  blue: "#0ea5e9", green: "#4ADE80", purple: "#A78BFA",
  label: "rgba(240,246,252,0.40)",
};

type Currency = "brl" | "usd";

const ORDER: PlanKey[] = ["free", "creator", "pro", "studio"];

/** O que o plano compra, em unidades que o usuário entende. */
function capabilities(plan: HubPlan): string[] {
  const c = plan.credits;
  const out: string[] = [];

  if (plan.key === "free") {
    out.push(`${Math.floor(c / CREDIT_COSTS.video_draft_5s)} vídeo de teste`);
    out.push(`ou ${Math.floor(c / CREDIT_COSTS.image_standard)} imagens`);
  } else {
    out.push(`${Math.floor(c / CREDIT_COSTS.video_draft_5s)} vídeos em rascunho`);
    out.push(`ou ${Math.floor(c / CREDIT_COSTS.video_final_5s)} vídeos finais`);
    out.push(`ou ${Math.floor(c / CREDIT_COSTS.image_standard)} imagens`);
  }

  out.push("Locução ilimitada · sem custo");
  out.push(plan.brands === -1 ? "Marcas ilimitadas" : `${plan.brands} marca${plan.brands > 1 ? "s" : ""}`);
  if (plan.workflows > 0) out.push(`${plan.workflows} workflows salvos`);
  if (plan.workflows === -1) out.push("Workflows ilimitados");
  if (plan.proVideo) out.push("Vídeo 1080p");
  if (plan.watermark) out.push("Com marca d'água");

  return out;
}

export default function PlansPage() {
  const credits = useHubCredits();
  // Real por padrão: o público inicial é Brasil.
  const [currency, setCurrency] = useState<Currency>("brl");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cupom de campanha. A oferta de entrada não é pública — quem chega
  // orgânico vê o preço de tabela; quem vem da campanha digita o código.
  const [coupon, setCoupon] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<{
    code: string; label: string; plan: string;
    intro_price_brl: number | null; intro_price_usd: number | null;
    intro_months: number; remaining: number | null;
  } | null>(null);

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCouponError("Faça login para usar um cupom."); return; }

      // Não manda mais o user_id: a RPC antiga aceitava o uuid do alvo, e
      // passando o de outra pessoa dava para descobrir que cupons ela já usou.
      // A versão _my resolve por auth.uid() dentro do banco.
      const { data, error: rpcErr } = await (supabase
        .rpc("hub_validate_my_campaign" as any, { p_code: code }) as any);
      if (rpcErr) throw rpcErr;

      if (!data?.valid) {
        setCampaign(null);
        setCouponError({
          sold_out: "Todas as vagas desta oferta foram preenchidas.",
          expired: "Esta oferta expirou.",
          not_started: "Esta oferta ainda não começou.",
          already_used: "Você já usou este cupom.",
          inactive: "Esta oferta não está mais disponível.",
        }[data?.reason as string] || "Cupom inválido.");
        return;
      }
      setCampaign(data);
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : "Não foi possível validar o cupom.");
    } finally {
      setCouponChecking(false);
    }
  };

  const clearCoupon = () => { setCampaign(null); setCoupon(""); setCouponError(null); };

  const currentPlan = credits.plan.key;

  const checkout = async (planKey: PlanKey | "pack") => {
    setBusy(planKey);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planKey, currency, coupon: campaign?.code || undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error(data?.message || "Não foi possível abrir o checkout.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no checkout");
    } finally {
      setBusy(null);
    }
  };

  const price = (p: HubPlan) =>
    p.usd === 0 ? (currency === "brl" ? "R$ 0" : "$0")
    : currency === "brl" ? `R$ ${p.brl}` : `$${p.usd}`;

  /** Preço promocional deste plano, se a campanha cobrir ele. */
  const introPrice = (p: HubPlan): string | null => {
    if (!campaign || campaign.plan !== p.key) return null;
    const v = currency === "brl" ? campaign.intro_price_brl : campaign.intro_price_usd;
    if (v == null) return null;
    return currency === "brl"
      ? `R$ ${v.toFixed(2).replace(".", ",")}`
      : `$${v.toFixed(2)}`;
  };

  const packPrice = currency === "brl" ? `R$ ${CREDIT_PACK.brl}` : `$${CREDIT_PACK.usd}`;

  const usagePct = useMemo(() => {
    const total = credits.planCredits + credits.packCredits;
    return total > 0 ? Math.min(100, Math.round((credits.used / total) * 100)) : 0;
  }, [credits]);

  return (
    <div style={{ minHeight: "100%", background: T.bg0, color: T.text1, padding: "22px 24px" }}>
      <Helmet><title>Planos · AdBrief Hub</title></Helmet>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 5px" }}>Planos</h1>
          <p style={{ fontSize: 12.5, color: T.text3, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
            Você gasta crédito só quando gera. Rascunho custa uma fração do render
            final — teste à vontade e pague pelo que aprovar.
          </p>
        </div>

        <div style={{ display: "flex", background: T.bg1, borderRadius: 8, padding: 3, border: `1px solid ${T.border1}` }}>
          {(["brl", "usd"] as Currency[]).map(c => (
            <button
              key={c} onClick={() => setCurrency(c)}
              style={{
                padding: "6px 14px", fontSize: 11.5, fontWeight: 700, borderRadius: 6,
                border: "none", cursor: "pointer",
                background: currency === c ? T.bg3 : "transparent",
                color: currency === c ? T.text1 : T.text3,
              }}
            >{c === "brl" ? "R$ BRL" : "$ USD"}</button>
          ))}
        </div>
      </div>

      {/* Saldo atual */}
      {!credits.loading && (
        <div style={{
          background: T.bg1, border: `1px solid ${T.border1}`, borderRadius: 10,
          padding: "13px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={labelStyle}>Saldo</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: credits.balance > 0 ? T.green : T.text3 }}>
              {credits.balance}
              <span style={{ fontSize: 11, fontWeight: 500, color: T.text3, marginLeft: 5 }}>créditos</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.text3, marginBottom: 5 }}>
              <span>Usado neste ciclo</span>
              <span>{credits.used} / {credits.planCredits + credits.packCredits}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: T.bg3, overflow: "hidden" }}>
              <div style={{
                width: `${usagePct}%`, height: "100%",
                background: usagePct > 85 ? "#F87171" : usagePct > 60 ? "#FBBF24" : T.green,
                transition: "width .3s",
              }} />
            </div>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: T.purple, background: "rgba(167,139,250,0.1)",
            border: "1px solid rgba(167,139,250,0.25)", borderRadius: 5, padding: "5px 9px",
          }}>
            {credits.plan.label}
          </div>
        </div>
      )}

      {/* Cupom de campanha */}
      <div style={{ marginBottom: 18 }}>
        {campaign ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            background: "rgba(74,222,128,0.07)",
            border: "1px solid rgba(74,222,128,0.3)",
            borderLeft: `2px solid ${T.green}`,
            borderRadius: 9, padding: "12px 15px",
          }}>
            <Tag size={15} color={T.green} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                {campaign.label}
              </div>
              <div style={{ fontSize: 11.5, color: T.text2 }}>
                Cupom <strong>{campaign.code}</strong> aplicado ·{" "}
                {campaign.intro_months} {campaign.intro_months === 1 ? "mês" : "meses"} com desconto,
                depois o valor normal do plano.
                {campaign.remaining != null && campaign.remaining <= 20 && (
                  <span style={{ color: "#FBBF24" }}>
                    {" "}Restam {campaign.remaining} vagas.
                  </span>
                )}
              </div>
            </div>
            <button onClick={clearCoupon} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: T.text3, display: "grid", placeItems: "center", padding: 4,
            }} title="Remover cupom">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 1 260px" }}>
              <Tag size={13} style={{ position: "absolute", left: 10, top: 10, color: T.label }} />
              <input
                value={coupon}
                onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponError(null); }}
                onKeyDown={e => { if (e.key === "Enter") void applyCoupon(); }}
                placeholder="Tem um cupom?"
                style={{
                  width: "100%", padding: "8px 10px 8px 30px", fontSize: 12,
                  background: T.bg1, border: `1px solid ${couponError ? "rgba(248,113,113,0.4)" : T.border1}`,
                  borderRadius: 7, color: T.text1, outline: "none",
                  letterSpacing: "0.04em", fontWeight: 600,
                }}
              />
            </div>
            <button
              onClick={applyCoupon}
              disabled={!coupon.trim() || couponChecking}
              style={{
                padding: "8px 15px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                border: `1px solid ${T.border2}`, background: "transparent",
                color: coupon.trim() ? T.text1 : T.text3,
                cursor: coupon.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {couponChecking && <Loader2 size={12} className="animate-spin" />}
              Aplicar
            </button>
            {couponError && (
              <span style={{ fontSize: 11.5, color: "#F87171" }}>{couponError}</span>
            )}
          </div>
        )}
      </div>

      {/* Planos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12 }}>
        {ORDER.map(key => {
          const p = HUB_PLANS[key];
          const isCurrent = currentPlan === key;
          const featured = !!p.highlight;
          return (
            <div key={key} style={{
              background: featured ? T.bg2 : T.bg1,
              border: `1px solid ${featured ? "rgba(14,165,233,0.35)" : T.border1}`,
              borderLeft: `2px solid ${featured ? T.blue : "transparent"}`,
              borderRadius: 11, padding: 17, display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{p.label}</span>
                {featured && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: T.blue, background: "rgba(14,165,233,0.12)", borderRadius: 4, padding: "2px 6px",
                  }}>Mais escolhido</span>
                )}
              </div>

              {(() => {
                const intro = introPrice(p);
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 25, fontWeight: 800, color: intro ? T.green : T.text1 }}>
                        {intro || price(p)}
                      </span>
                      {p.usd > 0 && <span style={{ fontSize: 11, color: T.text3 }}>/mês</span>}
                      {intro && (
                        <span style={{ fontSize: 12, color: T.text3, textDecoration: "line-through" }}>
                          {price(p)}
                        </span>
                      )}
                    </div>
                    {intro && campaign && (
                      <div style={{ fontSize: 10.5, color: T.green, marginBottom: 3 }}>
                        nos {campaign.intro_months} primeiros meses, depois {price(p)}
                      </div>
                    )}
                  </>
                );
              })()}

              <div style={{ fontSize: 10.5, color: T.text3, marginBottom: 14 }}>
                {p.credits} créditos{p.renews ? " por mês" : " (uma vez)"}
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", flex: 1 }}>
                {capabilities(p).map((f, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 7,
                    fontSize: 11.5, color: T.text2, marginBottom: 7, lineHeight: 1.45,
                  }}>
                    <Check size={12} color={featured ? T.blue : T.green} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && p.usd > 0 && checkout(key)}
                disabled={isCurrent || p.usd === 0 || busy === key}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 7, border: "none",
                  fontSize: 12.5, fontWeight: 700,
                  cursor: isCurrent || p.usd === 0 ? "default" : "pointer",
                  background: isCurrent ? T.bg3 : p.usd === 0 ? "transparent" : featured ? T.blue : T.bg3,
                  color: isCurrent ? T.text3 : p.usd === 0 ? T.text3 : featured ? "#fff" : T.text1,
                  border: p.usd === 0 ? `1px solid ${T.border1}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {busy === key
                  ? <><Loader2 size={13} className="animate-spin" /> Abrindo…</>
                  : isCurrent ? "Plano atual"
                  : p.usd === 0 ? "Grátis" : "Assinar"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Pacote avulso */}
      <div style={{
        marginTop: 14, background: T.bg1, border: `1px solid ${T.border1}`,
        borderRadius: 10, padding: "15px 17px",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <Zap size={17} color={T.purple} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
            Acabaram os créditos antes do fim do mês?
          </div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>
            +{CREDIT_PACK.credits} créditos avulsos, válidos por 12 meses. Não renova sozinho.
          </div>
        </div>
        <button
          onClick={() => checkout("pack")}
          disabled={busy === "pack"}
          style={{
            padding: "9px 16px", borderRadius: 7, border: `1px solid ${T.border2}`,
            background: "transparent", color: T.text1, fontSize: 12.5, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {busy === "pack" ? <Loader2 size={13} className="animate-spin" /> : null}
          {packPrice}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 14, padding: 11, borderRadius: 8, fontSize: 12,
          background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
          color: "#F87171",
        }}>{error}</div>
      )}

      {/* Tabela de custos — transparência evita ticket de suporte */}
      <div style={{ marginTop: 26 }}>
        <div style={{ ...labelStyle, marginBottom: 9 }}>Quanto custa cada ação</div>
        <div style={{
          background: T.bg1, border: `1px solid ${T.border1}`, borderRadius: 10,
          overflow: "hidden",
        }}>
          {[
            ["Locução (qualquer tamanho)", "grátis"],
            ["Imagem em rascunho", `${CREDIT_COSTS.image_draft} crédito`],
            ["Imagem padrão", `${CREDIT_COSTS.image_standard} créditos`],
            ["Imagem alta qualidade", `${CREDIT_COSTS.image_high} créditos`],
            ["Vídeo 5s rascunho", `${CREDIT_COSTS.video_draft_5s} créditos`],
            ["Vídeo 5s final", `${CREDIT_COSTS.video_final_5s} créditos`],
            ["Vídeo 5s em 1080p", `${CREDIT_COSTS.video_pro_5s} créditos`],
            ["Remover fundo", `${CREDIT_COSTS.bg_remove} créditos`],
            ["Troca de rosto", `${CREDIT_COSTS.faceswap} créditos`],
            ["Legenda, hook, roteiro", `${CREDIT_COSTS.caption} crédito`],
          ].map(([k, v], i) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", padding: "9px 15px",
              fontSize: 12, borderTop: i === 0 ? "none" : `1px solid ${T.border1}`,
            }}>
              <span style={{ color: T.text2 }}>{k}</span>
              <span style={{ color: v === "grátis" ? T.green : T.text1, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: T.text3, marginTop: 8, lineHeight: 1.5 }}>
          Créditos do plano renovam todo mês e não acumulam. Pacotes avulsos valem 12 meses.
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: T.label, marginBottom: 4,
};
