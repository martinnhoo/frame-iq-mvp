import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// purchase-capacity-pack — One-time Stripe Checkout for extra capacity
// Flow: Frontend POST { pack } → maps to Stripe price → creates one-time checkout session → redirect

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[PURCHASE-CAPACITY] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Pack definitions — price IDs come from env (set after creating products in Stripe)
const PACK_DEFS: Record<string, { credits: number; fallbackPrice: string }> = {
  pack_100:  { credits: 100,  fallbackPrice: "price_capacity_100" },
  pack_300:  { credits: 300,  fallbackPrice: "price_capacity_300" },
  pack_1000: { credits: 1000, fallbackPrice: "price_capacity_1000" },
};

function getPackPriceId(pack: string): string | null {
  // Prefer env vars so we can update without redeploy
  const envMap: Record<string, string> = {
    pack_100:  Deno.env.get("CAPACITY_PRICE_100")  || PACK_DEFS.pack_100.fallbackPrice,
    pack_300:  Deno.env.get("CAPACITY_PRICE_300")  || PACK_DEFS.pack_300.fallbackPrice,
    pack_1000: Deno.env.get("CAPACITY_PRICE_1000") || PACK_DEFS.pack_1000.fallbackPrice,
  };
  return envMap[pack] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAnon.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("User authenticated", { email: user.email, id: user.id });

    // ── Parse body ────────────────────────────────────────────────────────────
    const { pack } = await req.json();
    if (!pack || !PACK_DEFS[pack]) {
      return new Response(JSON.stringify({ error: "Invalid pack. Use: pack_100, pack_300, pack_1000" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = getPackPriceId(pack);
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Pack price not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Block free users — they must upgrade first ────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, stripe_customer_id")
      .eq("id", user.id)
      .single();

    const userPlan = profile?.plan || "free";
    if (userPlan === "free") {
      logStep("Free user blocked from packs", { userId: user.id });
      return new Response(JSON.stringify({
        error: "upgrade_required",
        message: "Capacity packs are available for paid plans. Upgrade first.",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ── Find or reference existing Stripe customer ────────────────────────────
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "https://adbrief.pro";
    const packCredits = PACK_DEFS[pack].credits;

    // ── Create one-time checkout session ──────────────────────────────────────
    const sessionParams: any = {
      customer: customerId || undefined,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment", // one-time, not subscription
      success_url: `${origin}/dashboard?capacity=success&pack=${pack}`,
      cancel_url: `${origin}/dashboard?capacity=cancelled`,
      metadata: {
        user_id: user.id,
        pack,
        credits: String(packCredits),
        type: "capacity_pack",
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, pack, credits: packCredits });

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
