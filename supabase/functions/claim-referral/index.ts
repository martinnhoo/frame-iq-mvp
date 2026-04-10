// claim-referral — validate referral code & grant +10 bonus analyses to both parties
// Auth required. Each user can only be referred once.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[CLAIM-REFERRAL] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

const BONUS = 10; // analyses granted to both referrer and referee

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

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const action = body.action || "claim"; // "claim" | "get_info" | "leaderboard"

    // ── GET INFO — return user's referral code + stats ───────────────────────
    if (action === "get_info") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code, referral_bonus_analyses, referred_by")
        .eq("id", user.id)
        .single();

      if (!profile?.referral_code) {
        // Generate one if missing (shouldn't happen with trigger, but safety net)
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
        profile!.referral_code = code;
      }

      // Count successful referrals
      const { count } = await supabase
        .from("referral_claims")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", user.id);

      return new Response(JSON.stringify({
        referral_code: profile?.referral_code,
        bonus_analyses: profile?.referral_bonus_analyses || 0,
        total_referrals: count || 0,
        already_referred: !!profile?.referred_by,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── LEADERBOARD — top 10 referrers this month ────────────────────────────
    if (action === "leaderboard") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: claims } = await supabase
        .from("referral_claims")
        .select("referrer_id")
        .gte("created_at", startOfMonth.toISOString());

      // Count per referrer
      const counts: Record<string, number> = {};
      for (const c of claims || []) {
        counts[c.referrer_id] = (counts[c.referrer_id] || 0) + 1;
      }

      // Sort and take top 10
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (sorted.length === 0) {
        return new Response(JSON.stringify({ leaderboard: [] }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Fetch names
      const ids = sorted.map(([id]) => id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", ids);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const leaderboard = sorted.map(([id, count], i) => {
        const p = profileMap.get(id);
        return {
          rank: i + 1,
          name: p?.name ? p.name.split(" ")[0] : "User",
          avatar_url: p?.avatar_url || null,
          referrals: count,
          is_you: id === user.id,
        };
      });

      return new Response(JSON.stringify({ leaderboard }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── CLAIM — validate code and grant bonus ────────────────────────────────
    const code = (body.code || "").trim().toUpperCase();
    if (!code || code.length < 4) {
      return new Response(JSON.stringify({ error: "invalid_code", message: "Invalid referral code." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log("Claim attempt", { userId: user.id, code });

    // Check if user already has been referred
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("referred_by, referral_code")
      .eq("id", user.id)
      .single();

    if (myProfile?.referred_by) {
      return new Response(JSON.stringify({ error: "already_referred", message: "You've already used a referral code." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Can't refer yourself
    if (myProfile?.referral_code === code) {
      return new Response(JSON.stringify({ error: "self_referral", message: "You can't use your own code." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Find referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", code)
      .single();

    if (!referrer) {
      return new Response(JSON.stringify({ error: "code_not_found", message: "Referral code not found." }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Grant bonuses ────────────────────────────────────────────────────────
    // 1. Mark referee as referred
    await supabase.from("profiles").update({
      referred_by: referrer.id,
      referral_bonus_analyses: (myProfile as any)?.referral_bonus_analyses
        ? (myProfile as any).referral_bonus_analyses + BONUS
        : BONUS,
    }).eq("id", user.id);

    // 2. Grant bonus to referrer
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("referral_bonus_analyses")
      .eq("id", referrer.id)
      .single();

    await supabase.from("profiles").update({
      referral_bonus_analyses: (referrerProfile?.referral_bonus_analyses || 0) + BONUS,
    }).eq("id", referrer.id);

    // 3. Log the claim
    const { error: claimErr } = await supabase.from("referral_claims").insert({
      referrer_id: referrer.id,
      referee_id: user.id,
      bonus_granted: BONUS,
    });

    if (claimErr) {
      log("Claim insert error", { error: String(claimErr) });
      // Likely duplicate — already claimed
      return new Response(JSON.stringify({ error: "already_claimed", message: "Already claimed." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log("Claim success", { referrerId: referrer.id, refereeId: user.id, bonus: BONUS });

    return new Response(JSON.stringify({
      success: true,
      bonus: BONUS,
      message: `You earned +${BONUS} bonus analyses! Your referrer also got +${BONUS}.`,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    log("ERROR", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
