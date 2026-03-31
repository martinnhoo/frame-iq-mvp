// setup-cron v2
// Configura pg_cron via postgres direto usando pg driver
// Invoke UMA VEZ: Lovable Cloud → Edge Functions → setup-cron → Invoke
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  // Admin only — require service role
  const authH = req.headers.get('Authorization') ?? '';
  if (authH !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });
  }

  // These are always available in Supabase edge functions
  const DB_URL     = Deno.env.get('SUPABASE_DB_URL') ?? '';
  const BASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!DB_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({
      error: 'Missing env vars',
      has_db_url: !!DB_URL,
      has_service_key: !!SERVICE_KEY,
      has_base_url: !!BASE_URL,
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const schedules = [
    { name: 'adbrief-daily-intelligence',  cron: '0 11 * * *',   fn: 'daily-intelligence',  body: '{}' },
    { name: 'adbrief-market-intelligence', cron: '30 11 * * *',  fn: 'market-intelligence', body: '{}' },
    { name: 'adbrief-creative-director',   cron: '0 11 * * 1',   fn: 'creative-director',   body: '{}' },
    { name: 'adbrief-weekly-report',       cron: '0 12 * * 0',   fn: 'weekly-report',       body: '{}' },
    { name: 'adbrief-trend-watch',         cron: '0 */2 * * *',  fn: 'trend-watcher',       body: '{"mode":"auto","geo":"BR"}' },
  ];

  const results: any[] = [];

  // Connect directly to postgres
  const sql = postgres(DB_URL, { max: 1, connect_timeout: 10 });

  try {
    // Enable extensions
    await sql`create extension if not exists pg_cron`;
    await sql`create extension if not exists pg_net`;

    // Remove old adbrief schedules
    await sql`
      select cron.unschedule(jobname)
      from cron.job
      where jobname like 'adbrief-%'
    `.catch(() => []);

    // Create each schedule
    for (const s of schedules) {
      try {
        const httpCall = `select net.http_post(
          url := '${BASE_URL}/functions/v1/${s.fn}',
          headers := '{"Authorization":"Bearer ${SERVICE_KEY}","Content-Type":"application/json"}'::jsonb,
          body := '${s.body}'::jsonb
        )`;

        await sql`select cron.schedule(${s.name}, ${s.cron}, ${httpCall})`;

        results.push({ name: s.name, cron: s.cron, status: 'created' });
      } catch(e: any) {
        results.push({ name: s.name, cron: s.cron, status: 'error', error: String(e.message || e) });
      }
    }

    // Verify
    const jobs = await sql`
      select jobname, schedule, active
      from cron.job
      where jobname like 'adbrief-%'
      order by jobname
    `;

    await sql.end();

    const allOk = results.every(r => r.status === 'created');

    return new Response(JSON.stringify({
      ok: allOk,
      results,
      active_jobs: jobs,
      message: allOk
        ? '✅ Todos os 5 schedules criados com sucesso'
        : '⚠️ Verifique results para detalhes',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch(e: any) {
    await sql.end().catch(() => {});
    return new Response(JSON.stringify({
      error: String(e.message || e),
      hint: 'Verifique se SUPABASE_DB_URL está disponível',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// v3 redeploy 202603251706
