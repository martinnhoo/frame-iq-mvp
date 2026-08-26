/* eslint-disable @typescript-eslint/no-explicit-any -- Scheduler rows are narrow runtime payloads. */
import { clipCors, json, serviceClient } from "../_shared/clip-network.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    const cronSecret = Deno.env.get("CLIP_NETWORK_CRON_SECRET");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!cronSecret
      || req.headers.get("x-clip-cron-secret") !== cronSecret
      || req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
      return json({ error: "unauthorized" }, 401);
    }
    const supabase = serviceClient();
    const now = new Date().toISOString();

    // First resume Instagram containers still processing.
    const { data: processing } = await supabase.from("clip_publications")
      .select("id")
      .eq("platform", "instagram")
      .eq("status", "processing")
      .limit(20);

    // Then pick publications whose schedule is due.
    const { data: queued } = await supabase.from("clip_publications")
      .select("id")
      .eq("platform", "instagram")
      .eq("status", "queued")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    const base = Deno.env.get("SUPABASE_URL") || "";
    const jobs = [
      ...(processing || []).map((x: any) => ({ id: x.id, action: "check" })),
      ...(queued || []).map((x: any) => ({ id: x.id, action: "publish" })),
    ];
    const results: any[] = [];
    for (const job of jobs) {
      try {
        const res = await fetch(`${base}/functions/v1/clip-network-publish-instagram`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "x-clip-cron-secret": cronSecret,
          },
          body: JSON.stringify({ publication_id: job.id, action: job.action }),
        });
        results.push({ publication_id: job.id, ok: res.ok, body: await res.json().catch(() => null) });
      } catch (e) {
        results.push({ publication_id: job.id, ok: false, error: String(e) });
      }
    }
    return json({ success: true, checked: results.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
