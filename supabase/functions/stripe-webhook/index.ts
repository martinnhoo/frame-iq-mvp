import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U88ul5IK0HHW19": "maker",
  "prod_U88v5WVcy2NZV7": "pro",
  "prod_U88wpX4Bphfifi": "studio",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) throw new Error("Missing Stripe config");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) throw new Error("No stripe-signature header");

    const event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        logStep("Checkout completed", { customerId, customerEmail });

        if (customerEmail) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", customerEmail)
            .limit(1);

          if (profiles && profiles.length > 0) {
            // Get subscription to determine plan
            const subscriptionId = session.subscription as string;
            if (subscriptionId) {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              const productId = sub.items.data[0]?.price?.product as string;
              const plan = PRODUCT_TO_PLAN[productId] || "maker";

              await supabase.from("profiles").update({
                plan,
                stripe_customer_id: customerId,
                plan_started_at: new Date().toISOString(),
              }).eq("id", profiles[0].id);
              logStep("Profile updated after checkout", { userId: profiles[0].id, plan });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const productId = sub.items.data[0]?.price?.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || "maker";
        const isActive = sub.status === "active" || sub.status === "trialing";

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          await supabase.from("profiles").update({
            plan: isActive ? plan : "free",
          }).eq("id", profiles[0].id);
          logStep("Subscription updated", { userId: profiles[0].id, plan: isActive ? plan : "free" });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          await supabase.from("profiles").update({ plan: "free" }).eq("id", profiles[0].id);
          logStep("Subscription deleted, downgraded to free", { userId: profiles[0].id });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { customerId: invoice.customer, invoiceId: invoice.id });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
