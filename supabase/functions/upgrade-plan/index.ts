import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Stripe Price IDs — set these as Supabase secrets ─────────────────────────
// STRIPE_PRICE_MAKER, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PLANS = ['free', 'maker', 'pro', 'studio'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, new_plan } = await req.json();

    if (!user_id || !new_plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, new_plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_PLANS.includes(new_plan)) {
      return new Response(
        JSON.stringify({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const APP_URL = Deno.env.get('APP_URL') || 'https://www.adbrief.pro';

    const PRICE_IDS: Record<string, string | undefined> = {
      maker:  Deno.env.get('STRIPE_PRICE_MAKER'),
      pro:    Deno.env.get('STRIPE_PRICE_PRO'),
      studio: Deno.env.get('STRIPE_PRICE_STUDIO'),
    };

    // ── Get profile ───────────────────────────────────────────────────────────
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, email, name, plan')
      .eq('id', user_id)
      .single();

    // ── Downgrade to free: cancel subscription ────────────────────────────────
    if (new_plan === 'free') {
      if (STRIPE_SECRET_KEY && profile?.stripe_customer_id) {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
        });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
      await supabaseClient
        .from('profiles')
        .update({ plan: 'free', plan_started_at: new Date().toISOString() })
        .eq('id', user_id);
      return new Response(
        JSON.stringify({ success: true, new_plan: 'free' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceId = PRICE_IDS[new_plan];

    // ── No Stripe key: mock mode ──────────────────────────────────────────────
    if (!STRIPE_SECRET_KEY || !priceId) {
      await supabaseClient
        .from('profiles')
        .update({ plan: new_plan, plan_started_at: new Date().toISOString() })
        .eq('id', user_id);
      return new Response(
        JSON.stringify({ success: true, mock_mode: true, new_plan }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Stripe checkout ───────────────────────────────────────────────────────
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? undefined,
        name: profile?.name ?? undefined,
        metadata: { user_id, plan: new_plan },
      });
      customerId = customer.id;
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }

    // Check for existing active subscription to upgrade/downgrade
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subs.data.length > 0) {
      // Upgrade/downgrade existing subscription
      const sub = subs.data[0];
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0].id, price: priceId }],
        proration_behavior: 'always_invoice',
        metadata: { adbrief_plan: new_plan },
      });
      await supabaseClient
        .from('profiles')
        .update({ plan: new_plan, plan_started_at: new Date().toISOString() })
        .eq('id', user_id);
      return new Response(
        JSON.stringify({ success: true, upgraded: true, new_plan }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New subscription via checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id, adbrief_plan: new_plan },
      },
      success_url: `${APP_URL}/dashboard?upgraded=${new_plan}`,
      cancel_url: `${APP_URL}/pricing`,
      metadata: { user_id, adbrief_plan: new_plan },
    });

    return new Response(
      JSON.stringify({ success: true, checkout_url: session.url, new_plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upgrade-plan:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
