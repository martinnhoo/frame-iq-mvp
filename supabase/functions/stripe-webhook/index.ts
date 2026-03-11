import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Maps Stripe price IDs to internal plan names
// Set STRIPE_PRICE_MAKER, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO as Supabase secrets
const getPlanFromPriceId = (priceId: string): string | null => {
  const map: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_MAKER')  ?? '__none__']: 'maker',
    [Deno.env.get('STRIPE_PRICE_PRO')    ?? '__none__']: 'pro',
    [Deno.env.get('STRIPE_PRICE_STUDIO') ?? '__none__']: 'studio',
  };
  return map[priceId] ?? null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const handleSubscriptionUpdate = async (sub: Stripe.Subscription, forceActive = false) => {
    const userId = sub.metadata?.user_id;
    if (!userId) {
      console.warn('No user_id in subscription metadata:', sub.id);
      return;
    }
    const priceId = sub.items.data[0]?.price?.id;
    const plan = getPlanFromPriceId(priceId);
    const isActive = forceActive || ['active', 'trialing'].includes(sub.status);
    await supabase
      .from('profiles')
      .update({
        plan: isActive && plan ? plan : 'free',
        stripe_customer_id: sub.customer as string,
        plan_started_at: new Date().toISOString(),
      })
      .eq('id', userId);
    console.log(`Updated user ${userId} to plan: ${isActive && plan ? plan : 'free'}`);
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await handleSubscriptionUpdate(sub, true);
      }
      break;
    }
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ plan: 'free', plan_started_at: new Date().toISOString() })
          .eq('id', userId);
        console.log(`Downgraded user ${userId} to free (subscription cancelled)`);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn('Payment failed for customer:', invoice.customer);
      // Optionally send email via Resend here
      break;
    }
    default:
      console.log('Unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
