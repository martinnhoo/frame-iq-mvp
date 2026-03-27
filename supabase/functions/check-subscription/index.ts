import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { LIFETIME_ACCOUNTS } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Map Stripe product IDs to plan names
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U88ul5IK0HHW19": "maker",
  "prod_U88v5WVcy2NZV7": "pro",
  "prod_U88wpX4Bphfifi": "studio",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    if (user.email && LIFETIME_ACCOUNTS[user.email]) {
      const lifetimePlan = LIFETIME_ACCOUNTS[user.email];
      logStep("Lifetime account detected", { email: user.email, plan: lifetimePlan });
      return new Response(JSON.stringify({ subscribed: lifetimePlan !== "free", plan: lifetimePlan, lifetime: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      // Ensure profile plan is free
      await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    // Also check trialing
    let sub = subscriptions.data[0];
    if (!sub) {
      const trialing = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      sub = trialing.data[0];
    }

    if (!sub) {
      logStep("No active/trialing subscription");
      await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productId = sub.items.data[0].price.product as string;
    const plan = PRODUCT_TO_PLAN[productId] || "studio";
    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
    const isTrial = sub.status === "trialing";

    logStep("Active subscription found", { plan, productId, isTrial, end: subscriptionEnd });

    // Sync plan to profiles table
    await supabase.from("profiles").update({
      plan,
      stripe_customer_id: customerId,
      plan_started_at: new Date(sub.start_date * 1000).toISOString(),
    }).eq("id", user.id);

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      is_trial: isTrial,
    }), {
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
