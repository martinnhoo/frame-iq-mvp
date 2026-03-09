import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SIGNUPS_PER_HOUR = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ip_address } = await req.json();

    if (!ip_address) {
      return new Response(
        JSON.stringify({ allowed: false, error: "Missing IP address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cleanup old entries
    await supabaseAdmin.rpc("cleanup_old_rate_limits");

    // Count signups from this IP in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("signup_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip_address)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Count error:", countError);
      return new Response(
        JSON.stringify({ allowed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((count ?? 0) >= MAX_SIGNUPS_PER_HOUR) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: "Too many signup attempts. Please try again later.",
          remaining: 0,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record this signup attempt
    const { error: insertError } = await supabaseAdmin
      .from("signup_rate_limits")
      .insert({ ip_address });

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        remaining: MAX_SIGNUPS_PER_HOUR - (count ?? 0) - 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Rate limit check error:", err);
    return new Response(
      JSON.stringify({ allowed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
