import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const PRODUCTS = {
      maker:  "prod_U88ul5IK0HHW19",
      pro:    "prod_U88v5WVcy2NZV7",
      studio: "prod_U88wpX4Bphfifi",
    };

    const prices = await Promise.all([
      stripe.prices.create({
        product: PRODUCTS.maker,
        unit_amount: 18200,
        currency: "usd",
        recurring: { interval: "year", trial_period_days: 1 },
        nickname: "Maker Annual (1-day trial)",
      }),
      stripe.prices.create({
        product: PRODUCTS.pro,
        unit_amount: 47040,
        currency: "usd",
        recurring: { interval: "year", trial_period_days: 1 },
        nickname: "Pro Annual (1-day trial)",
      }),
      stripe.prices.create({
        product: PRODUCTS.studio,
        unit_amount: 142800,
        currency: "usd",
        recurring: { interval: "year", trial_period_days: 1 },
        nickname: "Studio Annual (1-day trial)",
      }),
    ]);

    return new Response(JSON.stringify({
      success: true,
      ANNUAL_PRICE_MAKER:  prices[0].id,
      ANNUAL_PRICE_PRO:    prices[1].id,
      ANNUAL_PRICE_STUDIO: prices[2].id,
      message: "Add these 3 as Supabase secrets"
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
