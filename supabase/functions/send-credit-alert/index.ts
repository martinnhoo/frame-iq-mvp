/**
 * send-credit-alert — Email notifications for credit usage thresholds
 *
 * Called internally by deductCredits when usage crosses 80% or 100%.
 * Two email types:
 *   - "warning" (80%): friendly heads-up with usage stats + upgrade button
 *   - "exhausted" (100%): credits finished, 10% discount offer with personalized Stripe link
 *
 * Body: { user_id, type: "warning" | "exhausted", remaining, total, used_pct, plan }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("RESEND_FROM_EMAIL") || "AdBrief <hello@adbrief.pro>";
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

// Price IDs for upgrade (monthly)
const PLAN_PRICE_IDS: Record<string, string> = {
  free:  Deno.env.get("PRICE_MAKER") || "price_1T9sd1Dr9So14XztT3Mqddch",
  maker: Deno.env.get("PRICE_PRO")   || "price_1T9sdfDr9So14XztPR3tI14Y",
  pro:   Deno.env.get("PRICE_STUDIO") || "price_1T9seMDr9So14Xzt0vEJNQIX",
};

// Next plan names
const NEXT_PLAN: Record<string, string> = {
  free:  "Maker",
  maker: "Pro",
  pro:   "Studio",
};

// ── Coupon: 10% off first month ─────────────────────────────────────────────
const COUPON_ID = "ADBRIEF_10OFF_FIRST_MONTH";

async function getOrCreateCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(COUPON_ID);
    return COUPON_ID;
  } catch {
    // Create if doesn't exist
    await stripe.coupons.create({
      id: COUPON_ID,
      percent_off: 10,
      duration: "once", // first month only
      name: "10% off first month",
    });
    return COUPON_ID;
  }
}

// ── Generate personalized checkout URL with 10% coupon ──────────────────────
async function createDiscountCheckoutUrl(
  stripe: Stripe,
  email: string,
  userId: string,
  plan: string,
): Promise<string | null> {
  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) return null; // studio users have no upgrade path

  const couponId = await getOrCreateCoupon(stripe);

  // Find or skip existing customer
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: "https://adbrief.pro/dashboard?checkout=success",
    cancel_url: "https://adbrief.pro/pricing?checkout=cancelled",
    discounts: [{ coupon: couponId }],
    subscription_data: {
      metadata: { user_id: userId, source: "credit_exhausted_email" },
    },
    metadata: { user_id: userId, source: "credit_exhausted_email" },
  });

  return session.url;
}

// ── Email templates ─────────────────────────────────────────────────────────

interface EmailContent {
  subject: string;
  html: string;
}

function warningEmail(firstName: string, usedPct: number, remaining: number, total: number, plan: string, lang: string): EmailContent {
  const nextPlan = NEXT_PLAN[plan] || "Pro";
  const upgradeUrl = "https://adbrief.pro/dashboard/pricing";

  if (lang === "pt" || lang === "es") {
    const subject = lang === "pt"
      ? `${firstName}, seus créditos estão quase acabando`
      : `${firstName}, tus créditos están por agotarse`;

    return {
      subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

    <div style="padding:32px 32px 0;">
      <img src="https://adbrief.pro/lovable-uploads/60ec6a1b-8e38-430e-b5ef-0be690878a63.png" alt="AdBrief" style="width:36px;height:36px;border-radius:8px;margin-bottom:20px;">

      <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 8px;">${lang === "pt" ? "Seus créditos estão acabando" : "Tus créditos se están agotando"}</h1>
      <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5;">
        ${lang === "pt"
          ? `Ei ${firstName}, você já usou <strong style="color:#1a1a2e">${usedPct}%</strong> dos seus créditos este mês.`
          : `Hey ${firstName}, ya usaste <strong style="color:#1a1a2e">${usedPct}%</strong> de tus créditos este mes.`}
      </p>
    </div>

    <div style="margin:0 32px;padding:16px 20px;background:#f8fafc;border-radius:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#94a3b8;">${lang === "pt" ? "Usados" : "Usados"}</span>
        <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${total - remaining} / ${total}</span>
      </div>
      <div style="width:100%;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
        <div style="width:${usedPct}%;height:100%;background:${usedPct >= 90 ? '#ef4444' : '#eab308'};border-radius:99px;"></div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">${remaining} ${lang === "pt" ? "créditos restantes" : "créditos restantes"}</p>
    </div>

    <div style="padding:24px 32px 32px;text-align:center;">
      <a href="${upgradeUrl}" style="display:inline-block;padding:12px 28px;background:#0da2e7;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">
        ${lang === "pt" ? `Upgrade para ${nextPlan}` : `Upgrade a ${nextPlan}`}
      </a>
      <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">
        ${lang === "pt" ? "Mais créditos, mais análises, mais resultados." : "Más créditos, más análisis, más resultados."}
      </p>
    </div>
  </div>
</body>
</html>`,
    };
  }

  // English
  return {
    subject: `${firstName}, your credits are running low`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

    <div style="padding:32px 32px 0;">
      <img src="https://adbrief.pro/lovable-uploads/60ec6a1b-8e38-430e-b5ef-0be690878a63.png" alt="AdBrief" style="width:36px;height:36px;border-radius:8px;margin-bottom:20px;">

      <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 8px;">Your credits are running low</h1>
      <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5;">
        Hey ${firstName}, you've used <strong style="color:#1a1a2e">${usedPct}%</strong> of your credits this month.
      </p>
    </div>

    <div style="margin:0 32px;padding:16px 20px;background:#f8fafc;border-radius:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#94a3b8;">Used</span>
        <span style="font-size:13px;font-weight:600;color:#1a1a2e;">${total - remaining} / ${total}</span>
      </div>
      <div style="width:100%;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
        <div style="width:${usedPct}%;height:100%;background:${usedPct >= 90 ? '#ef4444' : '#eab308'};border-radius:99px;"></div>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">${remaining} credits remaining</p>
    </div>

    <div style="padding:24px 32px 32px;text-align:center;">
      <a href="${upgradeUrl}" style="display:inline-block;padding:12px 28px;background:#0da2e7;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">
        Upgrade to ${nextPlan}
      </a>
      <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">
        More credits, more analyses, more results.
      </p>
    </div>
  </div>
</body>
</html>`,
  };
}

function exhaustedEmail(firstName: string, total: number, plan: string, lang: string, checkoutUrl: string | null): EmailContent {
  const nextPlan = NEXT_PLAN[plan] || "Pro";
  const fallbackUrl = "https://adbrief.pro/dashboard/pricing";
  const url = checkoutUrl || fallbackUrl;

  if (lang === "pt" || lang === "es") {
    const subject = lang === "pt"
      ? `${firstName}, seus créditos acabaram!`
      : `${firstName}, ¡tus créditos se agotaron!`;

    return {
      subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

    <div style="padding:32px 32px 0;">
      <img src="https://adbrief.pro/lovable-uploads/60ec6a1b-8e38-430e-b5ef-0be690878a63.png" alt="AdBrief" style="width:36px;height:36px;border-radius:8px;margin-bottom:20px;">

      <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 8px;">${lang === "pt" ? "Seus créditos acabaram" : "Tus créditos se agotaron"} 😔</h1>
      <p style="font-size:15px;color:#64748b;margin:0 0 8px;line-height:1.5;">
        ${lang === "pt"
          ? `${firstName}, você usou todos os <strong style="color:#1a1a2e">${total} créditos</strong> do mês.`
          : `${firstName}, usaste todos los <strong style="color:#1a1a2e">${total} créditos</strong> del mes.`}
      </p>
      <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5;">
        ${lang === "pt"
          ? "Para continuar usando o AdBrief, faça upgrade do seu plano."
          : "Para seguir usando AdBrief, mejora tu plan."}
      </p>
    </div>

    <div style="margin:0 32px;padding:20px;background:linear-gradient(135deg,#0da2e7 0%,#0284c7 100%);border-radius:10px;text-align:center;">
      <p style="font-size:20px;font-weight:800;color:#fff;margin:0 0 4px;">10% OFF</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0 0 16px;">
        ${lang === "pt" ? "no primeiro mês do plano " + nextPlan : "en el primer mes del plan " + nextPlan}
      </p>
      <a href="${url}" style="display:inline-block;padding:12px 32px;background:#fff;color:#0da2e7;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">
        ${lang === "pt" ? "Fazer upgrade agora" : "Hacer upgrade ahora"}
      </a>
    </div>

    <div style="padding:20px 32px 32px;text-align:center;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        ${lang === "pt"
          ? "O desconto é aplicado automaticamente no link acima."
          : "El descuento se aplica automáticamente en el enlace."}
      </p>
    </div>
  </div>
</body>
</html>`,
    };
  }

  // English
  return {
    subject: `${firstName}, your credits are used up!`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

    <div style="padding:32px 32px 0;">
      <img src="https://adbrief.pro/lovable-uploads/60ec6a1b-8e38-430e-b5ef-0be690878a63.png" alt="AdBrief" style="width:36px;height:36px;border-radius:8px;margin-bottom:20px;">

      <h1 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 8px;">Your credits are used up 😔</h1>
      <p style="font-size:15px;color:#64748b;margin:0 0 8px;line-height:1.5;">
        ${firstName}, you've used all <strong style="color:#1a1a2e">${total} credits</strong> this month.
      </p>
      <p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5;">
        To keep using AdBrief, upgrade your plan.
      </p>
    </div>

    <div style="margin:0 32px;padding:20px;background:linear-gradient(135deg,#0da2e7 0%,#0284c7 100%);border-radius:10px;text-align:center;">
      <p style="font-size:20px;font-weight:800;color:#fff;margin:0 0 4px;">10% OFF</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.8);margin:0 0 16px;">your first month on ${nextPlan}</p>
      <a href="${url}" style="display:inline-block;padding:12px 32px;background:#fff;color:#0da2e7;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">
        Upgrade now
      </a>
    </div>

    <div style="padding:20px 32px 32px;text-align:center;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        The discount is applied automatically via the link above.
      </p>
    </div>
  </div>
</body>
</html>`,
  };
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, type, remaining, total, used_pct, plan } = body;

    if (!user_id || !type) {
      return new Response(JSON.stringify({ error: "Missing user_id or type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name, preferred_language")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "No email found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we already sent this alert this period (prevent spam)
    const period = new Date().toISOString().slice(0, 7); // "2026-04"
    const alertKey = `credit_alert_${type}_${period}`;
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("user_id", user_id)
      .eq("action", alertKey)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[send-credit-alert] Already sent ${type} alert for ${user_id} this period`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = profile.preferred_language || "pt";
    const firstName = (profile.name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");

    let email: EmailContent;

    if (type === "exhausted") {
      // Generate personalized Stripe checkout URL with 10% discount
      let checkoutUrl: string | null = null;
      if (STRIPE_KEY && plan !== "studio") {
        try {
          const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" });
          checkoutUrl = await createDiscountCheckoutUrl(stripe, profile.email, user_id, plan);
        } catch (e) {
          console.error("[send-credit-alert] Stripe checkout error:", e);
        }
      }
      email = exhaustedEmail(firstName, total || 0, plan || "free", lang, checkoutUrl);
    } else {
      email = warningEmail(firstName, used_pct || 80, remaining || 0, total || 0, plan || "free", lang);
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [profile.email],
        subject: email.subject,
        html: email.html,
      }),
    });

    const resData = await res.json();

    // Record that we sent this alert (prevent duplicates)
    // Log alert (non-critical, ignore errors)
    const period = new Date().toISOString().slice(0, 7);
    await supabase.from("credit_transactions").insert({
      user_id,
      period,
      action: alertKey,
      credits: 0,
      balance_after: 0,
      metadata: { type, sent_to: profile.email, resend_id: resData?.id },
    }).then(() => {}, () => {});

    console.log(`[send-credit-alert] ${type} email sent to ${profile.email} (${res.ok ? "ok" : "failed"})`);

    return new Response(JSON.stringify({ ok: res.ok, ...resData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[send-credit-alert] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
