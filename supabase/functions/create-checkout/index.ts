import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
// create-checkout v3 — proteção anti-trial-abuse: disposable email, Stripe history, IP velocity

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CREATE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// ── Module-scope cache for Stripe customer lookups ────────────────────────────
// Survives warm invocations of the edge function. TTL 5min — enough to absorb
// retries, double-clicks, and rapid reloads without hammering Stripe. Not a
// true distributed cache; a bad actor can still force fresh lookups by
// cycling emails, but that burns their own rate limit first.
const customerCache = new Map<string, { ts: number; customers: any[] }>();
const CUSTOMER_CACHE_TTL_MS = 5 * 60 * 1000;

async function getStripeCustomersCached(
  stripe: Stripe,
  email: string,
  limit = 10,
): Promise<any[]> {
  const key = `${email.toLowerCase()}::${limit}`;
  const hit = customerCache.get(key);
  const now = Date.now();
  if (hit && now - hit.ts < CUSTOMER_CACHE_TTL_MS) {
    return hit.customers;
  }
  const res = await stripe.customers.list({ email, limit });
  customerCache.set(key, { ts: now, customers: res.data });
  // Keep the cache bounded — drop oldest if we grow past 500 entries.
  if (customerCache.size > 500) {
    const oldest = Array.from(customerCache.entries())
      .sort((a, b) => a[1].ts - b[1].ts)[0]?.[0];
    if (oldest) customerCache.delete(oldest);
  }
  return res.data;
}

// ── Proteção 1: Domínios de email descartável ─────────────────────────────────
// Lista curada dos domínios mais usados para bypass de trial
const DISPOSABLE_DOMAINS = new Set([
  // YOPmail e variantes
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc","nomail.xl.cx",
  "mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf","monemail.fr.nf",
  "monmail.fr.nf",
  // Guerrilla mail
  "guerrillamail.com","guerrillamail.org","guerrillamail.net","guerrillamail.de",
  "guerrillamail.biz","guerrillamail.info","grr.la","guerrillamailblock.com","spam4.me",
  // Mailinator e variantes
  "mailinator.com","trashmail.com","trashmail.me","trashmail.net","trashmail.at",
  "trashmail.io","trashmail.xyz","trashmail.org","trashemail.de",
  // Temp-mail
  "temp-mail.org","temp-mail.ru","tempmail.com","tempmail.net","tempmail.us",
  "getairmail.com","airmail.cc","tempinbox.com","throwam.com","throwam.net",
  "spamgourmet.com","spamgourmet.net","spamgourmet.org",
  // 10 minute mail
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.de",
  "10minutemail.co.uk","10minutemail.us","10minutemail.info","10minmail.de",
  "10mail.org","10mail.com",
  // Sharklasers / guerrilla variants
  "sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info",
  "spam4.me","garrmail.com",
  // Outros populares
  "mailnull.com","spamspot.com","spam.la","dispostable.com","spamfree24.org",
  "spamfree24.de","spamfree24.eu","spamfree24.info","spamfree24.net","spamfree24.com",
  "mailexpire.com","filzmail.com","throwaway.email","tempr.email","discard.email",
  "fakeinbox.com","fakeinbox.org","maildrop.cc","maildrop.io",
  "safetymail.info","spamoff.de","spamthisplease.com","dodgit.com","dodgit.org",
  "mailnew.com","notmailinator.com","spam.su","spamgoes.in","spamhereplease.com",
  "deadaddress.com","despam.it","despammed.com","directmail24.de","discard.email",
  "trashmail.at","mohmal.com","mohmal.im","mohmal.in",
  "throwam.com","spambox.us","spambox.info","spambox.irishspringrealty.com",
  "spambox.org","spambox.win","spambox.xyz",
  "mailnesia.com","mailnull.com","mailtome.de","mailzilla.com",
  "meltmail.com","mexus.uk","mintemail.com","moncourrier.fr.nf",
  "nomail.pw","nomail.xl.cx","nomail2me.com","nobulk.com","noclickemail.com",
  "nogmailspam.info","nospam.ze.tc","notmailinator.com",
  "obobbo.com","onewaymail.com","owlpic.com",
  "pjjkp.com","plexolan.de","pookmail.com",
  "recursor.net","rtrtr.com",
  "s0ny.net","safe-mail.net","safetymail.info","sandelf.de","saynotospams.com",
  "secretinbox.com","shoot.pl","shortmail.net","sibmail.com","smellfear.com",
  "snaiperis.lt","sneakemail.com","spam.la","spambox.us","spamcero.com",
  "spamcon.org","spamevader.com","spamfree.eu","spamherelots.com",
  "spamhole.com","spamify.com","spaminator.de","spamkill.info",
  "spaml.com","spaml.de","spammotel.com","spamok.com","spamspot.com",
  "spamthisplease.com","spamtrap.ro","suremail.info","sweetxxx.de",
  "tempalias.com","tempe-mail.com","tempemail.biz","tempemail.com",
  "tempemail.net","tempinbox.co.uk","tempinbox.com","tempmail.eu",
  "tempomail.fr","temporaryemail.com","temporaryemail.net","temporaryemail.us",
  "temporaryforwarding.com","temporaryinbox.com","temporarymail.org",
  "tempthe.net","thankyou2010.com","thisisnotmyrealemail.com","throam.com",
  "throwam.com","throwcrap.com","throwem.com","throwemail.com",
  "trbvm.com","trillianpro.com","twinmail.de","tyldd.com",
  "uggsrock.com","uroid.com",
  "veryrealemail.com",
  "webemail.me","weg-werf-email.de","wegwerf-email.net","wegwerf-email.org",
  "wegwerfadresse.de","wegwerfemail.com","wegwerfemail.de","wegwerfemail.info",
  "wegwerfemail.net","wegwerfemail.org","wegwerfemails.de","wegwerfmail.de",
  "wegwerfmail.info","wegwerfmail.net","wegwerfmail.org","wetrainbayarea.org",
  "whyspam.me","willhackforfood.biz","willselfdestruct.com","wilemail.com",
  "wuzupmail.net",
  "xagloo.co","xagloo.com","xemaps.com","xents.com","xmaily.com",
  "xoxy.net","xyzfree.net",
  "yapped.net","yeah.net","yepmail.net","yodx.ro",
  "zahav.net.il","zehnminutenmail.de","zoemail.net","zoemail.org","zomg.info",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Heuristic: subdomains of known disposable providers
  for (const d of ["mailinator.com", "guerrillamail.com", "yopmail.com", "tempmail.com"]) {
    if (domain.endsWith("." + d)) return true;
  }
  return false;
}

// ── Proteção 2: Verificar histórico de trial no Stripe ───────────────────────
async function hasUsedTrialBefore(stripe: Stripe, email: string): Promise<{ used: boolean; reason: string }> {
  try {
    // Search ALL customers with this email (includes deleted) — cached 5min
    const customersData = await getStripeCustomersCached(stripe, email, 10);

    for (const customer of customersData) {
      // Check subscriptions (including canceled, trialing, past_due)
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });

      for (const sub of subs.data) {
        // If any subscription had a trial — even if canceled
        if (sub.trial_start !== null || sub.trial_end !== null) {
          logStep("Trial history found", { customerId: customer.id, subId: sub.id, status: sub.status });
          return { used: true, reason: `trial_used:${sub.status}` };
        }
        // If subscription was canceled within trial period (abuse pattern)
        if (sub.status === "canceled" && sub.trial_end) {
          return { used: true, reason: "trial_canceled" };
        }
      }

      // Check if customer has payment intents that failed / disputed (fraud signal)
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 5,
      });
      const hasDispute = paymentIntents.data.some((pi: any) =>
        pi.status === "canceled" || (pi.last_payment_error?.code === "card_declined")
      );
      if (hasDispute) {
        logStep("Payment issues found", { customerId: customer.id });
        // Don't block for this alone — just log
      }
    }

    return { used: false, reason: "" };
  } catch (e) {
    logStep("Stripe history check error (non-blocking)", { error: String(e) });
    return { used: false, reason: "" }; // fail open — never block on error
  }
}

// ── Proteção 3: Rate limit de checkout por IP ─────────────────────────────────
// Max 2 checkout attempts per IP per 24h (prevents IP rotation abuse)
async function checkIpRateLimit(
  supabase: any,
  ip: string
): Promise<{ allowed: boolean }> {
  if (!ip || ip === "unknown") return { allowed: true };
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("checkout_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", oneDayAgo);

    if ((count ?? 0) >= 3) {
      logStep("IP rate limit hit", { ip, count });
      return { allowed: false };
    }

    // Record this attempt (fire and forget)
    void supabase.from("checkout_attempts").insert({ ip_address: ip });
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ── PROTEÇÃO 1: Email descartável ────────────────────────────────────────
    if (isDisposableEmail(user.email)) {
      logStep("Disposable email blocked", { email: user.email });
      return new Response(JSON.stringify({
        error: "trial_not_available",
        message: "O trial gratuito não está disponível para emails temporários. Use um email permanente.",
        error_code: "disposable_email",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PROTEÇÃO 2: Histórico de trial no Stripe ─────────────────────────────
    const { used: trialUsed, reason } = await hasUsedTrialBefore(stripe, user.email);
    if (trialUsed) {
      logStep("Trial already used — creating session without trial", { reason });
      // Don't block checkout — just remove the trial (pay immediately)
      // This is fairer than a hard block: user can still subscribe, just pays full price
    }

    // ── PROTEÇÃO 3: IP rate limit ────────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || "unknown";

    // Only check IP for new customers (existing customers managing subscriptions are fine)
    const customersList = await getStripeCustomersCached(stripe, user.email, 1);
    const isNewCustomer = customersList.length === 0;

    if (isNewCustomer) {
      const { allowed } = await checkIpRateLimit(supabase, ip);
      if (!allowed) {
        logStep("IP rate limit blocked", { ip });
        return new Response(JSON.stringify({
          error: "rate_limited",
          message: "Muitas tentativas. Tente novamente em algumas horas.",
          error_code: "ip_rate_limit",
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Annual price IDs
    const ANNUAL_PRICES: Record<string, string> = {
      "price_1T9sd1Dr9So14XztT3Mqddch": Deno.env.get("ANNUAL_PRICE_MAKER") || "price_1T9sd1Dr9So14XztT3Mqddch",
      "price_1T9sdfDr9So14XztPR3tI14Y": Deno.env.get("ANNUAL_PRICE_PRO")   || "price_1T9sdfDr9So14XztPR3tI14Y",
      "price_1TMzhCDr9So14Xzt1rUmfs7h": Deno.env.get("ANNUAL_PRICE_STUDIO") || "price_1TMzhCDr9So14XztE4jqWz9c",
    };
    const effective_price_id = billing === "annual" ? (ANNUAL_PRICES[price_id] || price_id) : price_id;
    logStep("Price ID resolved", { price_id, effective_price_id, billing });

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
          return_url: `${req.headers.get("origin") || "https://adbrief.pro"}/dashboard/settings`,
        });
        return new Response(JSON.stringify({ url: portal.url, portal: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const origin = req.headers.get("origin") || "https://adbrief.pro";

    // Create checkout session — with or without trial based on history
    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: effective_price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: user.id },
      },
    };

    if (!trialUsed) {
      // First timer — grant full 3-day trial
      sessionParams.subscription_data.trial_period_days = 3;
      logStep("Trial granted (first time)");
    } else {
      // Trial already used — no trial, pay immediately
      // Optionally offer a smaller "welcome back" discount via coupon
      sessionParams.subscription_data.trial_period_days = 0;
      logStep("No trial — returning user", { reason });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, trial: !trialUsed });

    return new Response(JSON.stringify({
      url: session.url,
      trial: !trialUsed,
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
