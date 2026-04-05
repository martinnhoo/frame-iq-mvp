import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CREATE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "User not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return new Response(JSON.stringify({ error: "User not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    logStep("User authenticated", { email: user.email });

    const { price_id, billing } = await req.json();
    if (!price_id) throw new Error("Missing price_id");
    
    // Annual price IDs — created in Stripe with 20% discount, billed yearly
    // To activate: create annual prices in Stripe, add env vars ANNUAL_PRICE_MAKER/PRO/STUDIO
    const ANNUAL_PRICES: Record<string, string> = {
      "price_1T9sd1Dr9So14XztT3Mqddch": Deno.env.get("ANNUAL_PRICE_MAKER") || "price_1T9sd1Dr9So14XztT3Mqddch",
      "price_1T9sdfDr9So14XztPR3tI14Y": Deno.env.get("ANNUAL_PRICE_PRO")   || "price_1T9sdfDr9So14XztPR3tI14Y",
      "price_1T9seMDr9So14Xzt0vEJNQIX": Deno.env.get("ANNUAL_PRICE_STUDIO") || "price_1T9seMDr9So14Xzt0vEJNQIX",
    };
    const effective_price_id = billing === "annual" ? (ANNUAL_PRICES[price_id] || price_id) : price_id;
    logStep("Price ID received", { price_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // Check if already has active subscription
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      if (subs.data.length > 0) {
        logStep("User already has active subscription, redirecting to portal");
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${req.headers.get("origin")}/dashboard/settings`,
        });
        return new Response(JSON.stringify({ url: portal.url, portal: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const origin = req.headers.get("origin") || "https://adbrief.pro";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: effective_price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 3,
        metadata: { user_id: user.id },
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
