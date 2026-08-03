import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/credits.ts";

// Versao do deploy — permite verificar de fora o que esta no ar.
const FN_VERSION = "v3-2026-08-03-billing";

const corsHeaders = {
  "x-fn-version": FN_VERSION,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Mapa legado dos produtos criados em abril/2026. Mantido para as
// assinaturas que já existem — não remover enquanto houver cliente neles.
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U88ul5IK0HHW19": "maker",
  "prod_U88v5WVcy2NZV7": "pro",
  "prod_U88wpX4Bphfifi": "studio",
};

const VALID_PLANS = new Set(["free", "creator", "maker", "pro", "starter", "studio", "scale"]);

/**
 * Descobre o plano a partir da assinatura.
 *
 * Ordem: metadata do produto → metadata do preço → mapa legado → free.
 *
 * O mapa de IDs fixos era uma armadilha: qualquer produto criado depois
 * dele caía em "free", ou seja, o cliente pagava e continuava sem acesso —
 * falhando em silêncio, que é o pior tipo de falha em cobrança.
 * Agora basta o produto ter metadata hub_plan para funcionar.
 */
async function resolvePlanFromSubscription(stripe: any, sub: any): Promise<string> {
  const item = sub?.items?.data?.[0];
  const price = item?.price;
  const productRef = price?.product;

  // metadata do preço (já vem expandida na maioria dos eventos)
  const fromPrice = price?.metadata?.hub_plan;
  if (fromPrice && VALID_PLANS.has(fromPrice)) return fromPrice;

  const productId = typeof productRef === "string" ? productRef : productRef?.id;
  if (!productId) return "free";

  // metadata do produto
  try {
    const product = typeof productRef === "object" && productRef?.metadata
      ? productRef
      : await stripe.products.retrieve(productId);
    const fromProduct = product?.metadata?.hub_plan;
    if (fromProduct && VALID_PLANS.has(fromProduct)) return fromProduct;
  } catch (e) {
    logStep("Falha ao ler metadata do produto", { productId, error: String(e) });
  }

  const legacy = PRODUCT_TO_PLAN[productId];
  if (legacy) return legacy;

  logStep("AVISO: produto sem hub_plan e fora do mapa legado — caindo para free", { productId });
  return "free";
}

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

    // ── Idempotency guard — skip already-processed events ────────────────
    const { data: existing } = await supabase
      .from("processed_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existing) {
      logStep("Duplicate event skipped", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // O registro do evento acontece DEPOIS do processamento, não antes.
    //
    // Antes: gravava primeiro, e o catch devolvia 400. Se qualquer coisa
    // falhasse no meio (timeout do Stripe, update recusado), o retry do
    // Stripe chegava e era descartado como duplicado. Resultado: pagamento
    // confirmado, plano nunca aplicado, e nenhum alarme.
    //
    // Agora, se falhar, o evento não é marcado e o retry reprocessa.

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;
        logStep("Checkout completed", { customerId, customerEmail, mode: session.mode });

        // ── Capacity pack (one-time payment) ─────────────────────────────────
        if (session.metadata?.type === "capacity_pack") {
          const credits = parseInt(session.metadata.credits || "0", 10);
          const pack = session.metadata.pack || "unknown";
          const metadataUserId = session.metadata.user_id;

          // SECURITY: never trust session.metadata.user_id blindly — a malicious
          // session creator could set someone else's user_id and credit their
          // account. Resolve user via the Stripe customer email (Stripe-authenticated)
          // and only accept the metadata user_id when it matches that resolved id.
          let resolvedUserId: string | null = null;
          if (customerEmail) {
            const { data: profilesByEmail } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("email", customerEmail)
              .limit(1);
            if (profilesByEmail && profilesByEmail.length > 0) {
              resolvedUserId = profilesByEmail[0].id;
            }
          }

          // Fallback: resolve via stripe_customer_id stored on profile
          if (!resolvedUserId && customerId) {
            const { data: profilesByCustomer } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("stripe_customer_id", customerId)
              .limit(1);
            if (profilesByCustomer && profilesByCustomer.length > 0) {
              resolvedUserId = profilesByCustomer[0].id;
            }
          }

          // Guard: if metadata.user_id was supplied but does NOT match the
          // authenticated customer, refuse the credit (do not escalate to
          // metadataUserId; that is the whole attack vector).
          if (metadataUserId && resolvedUserId && metadataUserId !== resolvedUserId) {
            logStep("SECURITY: metadata.user_id mismatch — refusing capacity pack", {
              metadataUserId, resolvedUserId, customerEmail,
            });
            break;
          }

          const userId = resolvedUserId || null;

          if (userId && credits > 0) {
            // Call add_bonus_credits RPC to add capacity
            const { error: rpcError } = await supabase.rpc("add_bonus_credits", {
              p_user_id: userId,
              p_credits: credits,
              p_reason: "capacity_pack",
              p_total_credits: 0,
            });

            if (rpcError) {
              logStep("ERROR adding bonus credits", { userId, credits, error: rpcError.message });
            } else {
              logStep("Capacity pack applied", { userId, pack, credits });
            }
          } else {
            logStep("Capacity pack missing data", { userId, credits, pack, customerEmail });
          }
          break;
        }

        // ── Subscription checkout (existing flow) ────────────────────────────
        // O user_id vai em subscription_data.metadata no create-checkout.
        // Buscar só por email exato (case-sensitive) fazia o cliente pagar e
        // ficar no free sempre que o email do Stripe divergisse do cadastro.
        const metaUserId = (session.metadata?.user_id
          || (session as any).subscription_data?.metadata?.user_id) as string | undefined;

        if (customerEmail || metaUserId) {
          let profiles: Array<{ id: string }> | null = null;

          if (metaUserId) {
            const { data } = await supabase
              .from("profiles").select("id").eq("id", metaUserId).limit(1);
            if (data?.length) profiles = data;
          }

          if (!profiles && customerEmail) {
            const { data } = await supabase
              .from("profiles").select("id").ilike("email", customerEmail).limit(1);
            profiles = data;
          }

          if (profiles && profiles.length > 0) {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("id", profiles[0].id)
              .maybeSingle();

            const subscriptionId = session.subscription as string;
            if (subscriptionId) {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              const dbPlan = await resolvePlanFromSubscription(stripe, sub);
              const plan = getEffectivePlan(dbPlan, profileRow?.email);

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
        const plan = await resolvePlanFromSubscription(stripe, sub);
        const isActive = sub.status === "active" || sub.status === "trialing";
        const isTrialing = sub.status === "trialing";
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const nextPlan = getEffectivePlan(isActive ? plan : "free", profiles[0].email);
          await supabase.from("profiles").update({
            plan: nextPlan,
            subscription_status: nextPlan === "studio" && !isActive ? "active" : sub.status,
            trial_end: isTrialing ? trialEnd : null,
            current_period_end: nextPlan === "studio" && !isActive ? "2099-12-31T23:59:59Z" : periodEnd,
            stripe_subscription_id: sub.id,
          } as any).eq("id", profiles[0].id);
          logStep("Subscription updated", { userId: profiles[0].id, plan: nextPlan, status: sub.status, isTrialing });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const nextPlan = getEffectivePlan("free", profiles[0].email);
          await supabase.from("profiles").update({
            plan: nextPlan,
            subscription_status: nextPlan === "studio" ? "active" : "canceled",
            trial_end: null,
            current_period_end: nextPlan === "studio" ? "2099-12-31T23:59:59Z" : null,
          } as any).eq("id", profiles[0].id);
          logStep("Subscription deleted", { userId: profiles[0].id, plan: nextPlan });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        logStep("Invoice paid", { customerId, invoiceId: invoice.id });

        // Confirm plan is synced on every successful payment (renewals included)
        const subId = invoice.subscription as string;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          // Usava o mapa legado direto: na renovação, produto novo virava
          // "free" e o cliente era rebaixado justamente ao pagar.
          const plan = await resolvePlanFromSubscription(stripe, sub);

          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email")
            .eq("stripe_customer_id", customerId)
            .limit(1);

          if (profiles && profiles.length > 0) {
            const nextPlan = getEffectivePlan(plan, profiles[0].email);
            await supabase.from("profiles").update({ plan: nextPlan }).eq("id", profiles[0].id);
            logStep("Plan confirmed after invoice.paid", { userId: profiles[0].id, plan: nextPlan });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const failedCustomerId = invoice.customer as string;
        logStep("Payment failed", { customerId: failedCustomerId, invoiceId: invoice.id });

        // Flag user as past_due for recovery flow
        const { data: failedProfiles } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("stripe_customer_id", failedCustomerId)
          .limit(1);

        if (failedProfiles && failedProfiles.length > 0) {
          await supabase.from("profiles").update({
            subscription_status: "past_due",
          } as any).eq("id", failedProfiles[0].id);
          logStep("User flagged past_due", { userId: failedProfiles[0].id, email: failedProfiles[0].email });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // Processou sem erro — agora sim marca, para o retry não duplicar.
    await supabase.from("processed_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR — evento NAO marcado, Stripe vai reenviar", { message: msg });
    // 500 e não 400: 4xx sinaliza ao Stripe "não tente de novo", que é o
    // oposto do que queremos quando a falha é nossa.
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
