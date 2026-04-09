// cancel-subscription — smart cancellation: pause, discount offer, or cancel with survey
// Actions: "pause" (pause 30 days), "discount" (apply 30% off 3 months), "cancel" (with reason/feedback)

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[CANCEL-SUB] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing Stripe config");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ── Get profile ──────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id, plan, cancel_reason")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: "no_subscription" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action; // "pause" | "discount" | "cancel"

    // ── PAUSE — schedule cancellation at end of period, set pause_until ────
    if (action === "pause") {
      log("Pausing subscription", { userId: user.id });

      // Cancel at period end (user keeps access until then)
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      const pauseUntil = new Date(Date.now() + 30 * 86400000).toISOString();
      await supabase.from("profiles").update({
        pause_until: pauseUntil,
        cancel_reason: "paused",
      } as any).eq("id", user.id);

      log("Subscription paused", { userId: user.id, pauseUntil });
      return new Response(JSON.stringify({ success: true, action: "paused", pause_until: pauseUntil }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── DISCOUNT — apply 30% off coupon for 3 months ─────────────────────────
    if (action === "discount") {
      log("Applying retention discount", { userId: user.id });

      // Create or find a 30% off coupon
      let coupon: Stripe.Coupon;
      try {
        coupon = await stripe.coupons.retrieve("retention_30pct_3mo");
      } catch {
        coupon = await stripe.coupons.create({
          id: "retention_30pct_3mo",
          percent_off: 30,
          duration: "repeating",
          duration_in_months: 3,
          name: "Retention — 30% off for 3 months",
        });
      }

      // Remove cancel_at_period_end if set, and apply discount
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: false,
        discounts: [{ coupon: coupon.id }],
      });

      await supabase.from("profiles").update({
        cancel_reason: null,
        pause_until: null,
      } as any).eq("id", user.id);

      log("Discount applied", { userId: user.id, coupon: coupon.id });
      return new Response(JSON.stringify({ success: true, action: "discount_applied", percent_off: 30, months: 3 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── CANCEL — immediate cancel at period end + save reason ────────────────
    if (action === "cancel") {
      const reason = body.reason || "no_reason";
      const feedback = body.feedback || "";
      log("Cancelling subscription", { userId: user.id, reason });

      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      await supabase.from("profiles").update({
        cancel_reason: reason,
        cancel_feedback: feedback,
      } as any).eq("id", user.id);

      log("Subscription cancelled", { userId: user.id, reason });
      return new Response(JSON.stringify({ success: true, action: "cancelled", reason }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid_action" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    log("ERROR", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
