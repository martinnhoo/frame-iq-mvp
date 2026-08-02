#!/usr/bin/env node
/**
 * stripe-setup — cria os produtos e preços do Hub no Stripe, em USD e BRL.
 *
 * Rodar uma vez:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs
 *
 * Modo seguro por padrão: sem --apply ele só MOSTRA o que faria.
 *   node scripts/stripe-setup.mjs            → simulação
 *   node scripts/stripe-setup.mjs --apply    → cria de verdade
 *
 * Idempotente: usa `lookup_key` nos preços. Rodar duas vezes não duplica.
 * No fim imprime o mapa de price_id que a edge function `create-checkout`
 * precisa — cole no secret STRIPE_PRICE_MAP.
 */

const KEY = process.env.STRIPE_SECRET_KEY;
const APPLY = process.argv.includes("--apply");

if (!KEY) {
  console.error("Faltou STRIPE_SECRET_KEY no ambiente.");
  process.exit(1);
}
if (KEY.startsWith("sk_live") && !process.argv.includes("--i-know-its-live")) {
  console.error("Chave LIVE detectada. Rode com --i-know-its-live se é isso mesmo.");
  process.exit(1);
}

// Espelha src/lib/hubPlans.ts e public.hub_plan_config.
// Valores em centavos.
const PLANS = [
  { key: "creator", name: "AdBrief Hub — Creator", credits: 700,  usd: 1900, brl: 9700  },
  { key: "pro",     name: "AdBrief Hub — Pro",     credits: 2000, usd: 4900, brl: 24700 },
  { key: "studio",  name: "AdBrief Hub — Studio",  credits: 4500, usd: 9900, brl: 49700 },
];

// Pacote avulso: cobrança única, não assinatura.
const PACK = { key: "pack_1k", name: "AdBrief Hub — 1.000 créditos", credits: 1000, usd: 2900, brl: 14900 };

// Anual = 10 meses (2 grátis). Antecipa caixa, o que importa muito com
// providers pré-pagos.
const ANNUAL_MONTHS = 10;

// ── Campanhas ────────────────────────────────────────────────────────────────
// A oferta de entrada NÃO é pública: vira um promotion code que só quem tem o
// link/código consegue usar. Preço de tabela fica intacto para o orgânico.
//
// `duration: repeating` + `duration_in_months` é o que faz o desconto valer só
// nos primeiros ciclos e o preço cheio entrar sozinho depois. Nada de cron,
// nada de lógica nossa — o Stripe cuida da transição.
const CAMPAIGNS = [
  {
    code: "LANCAMENTO",
    name: "Lançamento — 3 meses com desconto",
    plan: "pro",
    months: 3,
    // Quanto tirar do preço cheio, em centavos.
    // Pro: R$ 247 → R$ 49,90  |  $49 → $24,90
    offBrl: 24700 - 4990,
    offUsd: 4900 - 2490,
    maxRedemptions: 100,
  },
];

async function stripe(path, method = "GET", body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error?.message || res.status}`);
  return json;
}

async function findOrCreateProduct(key, name, credits) {
  const existing = await stripe(`/products/search?query=${encodeURIComponent(`metadata['hub_plan']:'${key}'`)}`);
  if (existing.data?.length) {
    console.log(`  produto existe: ${name} (${existing.data[0].id})`);
    return existing.data[0].id;
  }
  if (!APPLY) { console.log(`  [simulação] criaria produto: ${name}`); return `prod_SIMULADO_${key}`; }
  const p = await stripe("/products", "POST", {
    name,
    "metadata[hub_plan]": key,
    "metadata[credits]": String(credits),
  });
  console.log(`  produto criado: ${name} (${p.id})`);
  return p.id;
}

async function findOrCreatePrice(productId, lookupKey, opts) {
  const existing = await stripe(`/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
  if (existing.data?.length) {
    console.log(`    preço existe: ${lookupKey} → ${existing.data[0].id}`);
    return existing.data[0].id;
  }
  if (!APPLY) { console.log(`    [simulação] criaria preço: ${lookupKey}`); return `price_SIMULADO_${lookupKey}`; }

  const body = {
    product: productId,
    currency: opts.currency,
    unit_amount: String(opts.amount),
    lookup_key: lookupKey,
    "metadata[credits]": String(opts.credits),
  };
  if (opts.interval) {
    body["recurring[interval]"] = opts.interval;
  }
  const p = await stripe("/prices", "POST", body);
  console.log(`    preço criado: ${lookupKey} → ${p.id}`);
  return p.id;
}

const map = {};

console.log(APPLY ? "\n=== APLICANDO NO STRIPE ===\n" : "\n=== SIMULAÇÃO (use --apply para criar) ===\n");

for (const plan of PLANS) {
  console.log(`${plan.name}`);
  const productId = await findOrCreateProduct(plan.key, plan.name, plan.credits);

  for (const currency of ["usd", "brl"]) {
    const monthly = plan[currency];
    map[`${plan.key}_${currency}_month`] = await findOrCreatePrice(
      productId, `hub_${plan.key}_${currency}_month`,
      { currency, amount: monthly, interval: "month", credits: plan.credits },
    );
    map[`${plan.key}_${currency}_year`] = await findOrCreatePrice(
      productId, `hub_${plan.key}_${currency}_year`,
      { currency, amount: monthly * ANNUAL_MONTHS, interval: "year", credits: plan.credits },
    );
  }
  console.log("");
}

console.log(`${PACK.name}`);
const packProduct = await findOrCreateProduct(PACK.key, PACK.name, PACK.credits);
for (const currency of ["usd", "brl"]) {
  map[`${PACK.key}_${currency}`] = await findOrCreatePrice(
    packProduct, `hub_${PACK.key}_${currency}`,
    { currency, amount: PACK[currency], credits: PACK.credits },
  );
}

// ── Cupons de campanha ──────────────────────────────────────────────────────
for (const camp of CAMPAIGNS) {
  console.log(`\nCampanha: ${camp.name}`);

  for (const currency of ["brl", "usd"]) {
    const off = currency === "brl" ? camp.offBrl : camp.offUsd;
    const couponId = `${camp.code.toLowerCase()}_${currency}`;

    let coupon;
    try {
      coupon = await stripe(`/coupons/${couponId}`);
      console.log(`  cupom existe: ${couponId}`);
    } catch {
      if (!APPLY) {
        console.log(`  [simulação] criaria cupom ${couponId}: -${off / 100} ${currency.toUpperCase()} por ${camp.months} meses`);
        continue;
      }
      coupon = await stripe("/coupons", "POST", {
        id: couponId,
        name: camp.name,
        currency,
        amount_off: String(off),
        duration: "repeating",
        duration_in_months: String(camp.months),
        "metadata[campaign]": camp.code,
        "metadata[plan]": camp.plan,
      });
      console.log(`  cupom criado: ${couponId} (-${off / 100} ${currency.toUpperCase()} × ${camp.months} meses)`);
    }

    // Promotion code = o texto que o cliente digita. Um por moeda, porque o
    // cupom é preso à moeda.
    const promoCode = `${camp.code}${currency === "usd" ? "USD" : ""}`;
    const existing = await stripe(`/promotion_codes?code=${encodeURIComponent(promoCode)}&limit=1`);

    if (existing.data?.length) {
      map[`promo_${camp.code}_${currency}`] = existing.data[0].id;
      console.log(`    promotion code existe: ${promoCode} → ${existing.data[0].id}`);
    } else if (!APPLY) {
      console.log(`    [simulação] criaria promotion code ${promoCode}`);
    } else {
      const pc = await stripe("/promotion_codes", "POST", {
        coupon: coupon.id,
        code: promoCode,
        max_redemptions: String(camp.maxRedemptions),
        "restrictions[first_time_transaction]": "true",
      });
      map[`promo_${camp.code}_${currency}`] = pc.id;
      console.log(`    promotion code criado: ${promoCode} → ${pc.id}`);
    }
  }

  console.log(`\n  SQL para ligar a campanha no Supabase:`);
  console.log(`  update hub_campaigns set`);
  console.log(`    stripe_promotion_code_brl = '${map[`promo_${camp.code}_brl`] || "promo_..."}',`);
  console.log(`    stripe_promotion_code_usd = '${map[`promo_${camp.code}_usd`] || "promo_..."}'`);
  console.log(`  where code = '${camp.code}';`);
}

console.log("\n═══════════════════════════════════════════════════");
console.log("Cole isto no secret STRIPE_PRICE_MAP do Supabase:\n");
console.log(JSON.stringify(map));
console.log("\n═══════════════════════════════════════════════════");

if (!APPLY) {
  console.log("\nNada foi criado — isto foi uma simulação.");
  console.log("Para valer: node scripts/stripe-setup.mjs --apply\n");
} else {
  console.log("\nFalta ainda, no painel do Stripe:");
  console.log("  1. Ativar BRL em Settings → Payment methods (e Pix, se quiser)");
  console.log("  2. Apontar o webhook para a função stripe-webhook");
  console.log("  3. Eventos: checkout.session.completed, customer.subscription.updated,");
  console.log("     customer.subscription.deleted, invoice.payment_failed\n");
}
