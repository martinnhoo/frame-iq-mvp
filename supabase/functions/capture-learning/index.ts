// capture-learning v1 — alimenta a memória do produto com cada ação do usuário
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, event_type, data } = await req.json();
    if (!user_id || !event_type) return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    switch (event_type) {

      case 'hooks_generated': {
        const { hooks, product, niche, market, platform, tone, context: ctx } = data;
        if (!hooks?.length) break;
        const rows = hooks.slice(0, 10).map((h: any) => ({
          user_id,
          hook_type: h.hook_type || 'generated',
          hook_score: h.predicted_score || null,
          platform: platform || 'Meta Feed',
          notes: JSON.stringify({ product, niche, market, tone, ctx: ctx?.slice(0, 100), text: (h.hook || String(h)).slice(0, 200) }),
          created_at: new Date().toISOString(),
        }));
        await (sb as any).from('creative_memory').insert(rows);
        break;
      }

      case 'chat_feedback': {
        const { blocks, feedback, message_text } = data;
        const hookBlock = (blocks || []).find((b: any) => b.type === 'hooks' && b.items?.length);
        if (!hookBlock) break;
        const key = `chat_hooks_${feedback}`;
        const { data: ex } = await (sb as any).from('learned_patterns').select('id,sample_size,variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        if (ex) {
          await (sb as any).from('learned_patterns').update({
            sample_size: (ex.sample_size || 0) + 1,
            confidence: Math.min(1, ((ex.sample_size || 0) + 1) / 10),
            is_winner: feedback === 'like',
            last_updated: new Date().toISOString(),
          }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({ user_id, pattern_key: key, is_winner: feedback === 'like', sample_size: 1, confidence: 0.1, insight_text: `User ${feedback}d chat hooks`, variables: {} });
        }
        break;
      }

      case 'competitor_analyzed': {
        const { industry, hook_score, hook_type, your_move, steal_this } = data;
        if (!industry) break;
        const key = `competitor_${industry.toLowerCase().replace(/[\s\/]+/g, '_').slice(0, 30)}`;
        const { data: ex } = await (sb as any).from('learned_patterns').select('id,sample_size,variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        const vars: any = (ex?.variables as any) || {};
        const analyses = vars.analyses || [];
        analyses.unshift({ hook_score, hook_type, steal: steal_this?.slice(0, 100), date: new Date().toISOString().split('T')[0] });
        const avg = analyses.slice(0, 10).reduce((s: number, a: any) => s + (a.hook_score || 0), 0) / Math.min(analyses.length, 10);
        if (ex) {
          await (sb as any).from('learned_patterns').update({ sample_size: (ex.sample_size||0)+1, confidence: Math.min(1,((ex.sample_size||0)+1)/5), insight_text: `${industry}: ${analyses.length} anúncios analisados, score médio ${avg.toFixed(0)}/1000`, last_updated: new Date().toISOString(), variables: { ...vars, analyses: analyses.slice(0,20), your_move, industry } }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({ user_id, pattern_key: key, sample_size: 1, confidence: 0.2, insight_text: `${industry}: primeiro anúncio analisado, score ${hook_score}/1000`, variables: { analyses: analyses.slice(0,20), your_move, industry, steal_this } });
        }
        break;
      }

      case 'performance_reported': {
        const { hook_type, ctr, roas, platform, market, hook_text } = data;
        if (!ctr && !roas) break;
        const key = `perf_${(hook_type||'unknown').toLowerCase().replace(/\s+/g,'_')}_${(platform||'meta').toLowerCase()}`;
        const { data: ex } = await (sb as any).from('learned_patterns').select('id,sample_size,avg_ctr,avg_roas,variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        if (ex) {
          const n = ex.sample_size || 0;
          const newCtr = ctr ? ((ex.avg_ctr||0)*n + ctr)/(n+1) : ex.avg_ctr;
          const newRoas = roas ? ((ex.avg_roas||0)*n + roas)/(n+1) : ex.avg_roas;
          const entries = ((ex.variables as any)?.entries || []);
          entries.unshift({ text: hook_text?.slice(0,100), ctr, roas, market, date: new Date().toISOString().split('T')[0] });
          await (sb as any).from('learned_patterns').update({ sample_size: n+1, avg_ctr: newCtr, avg_roas: newRoas, is_winner: (newCtr||0)>0.015||(newRoas||0)>2, confidence: Math.min(1,(n+1)/10), insight_text: `${hook_type} em ${platform}: CTR médio ${(newCtr||0).toFixed(3)}, ROAS médio ${(newRoas||0).toFixed(2)}`, last_updated: new Date().toISOString(), variables: { entries: entries.slice(0,20) } }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({ user_id, pattern_key: key, sample_size: 1, avg_ctr: ctr||null, avg_roas: roas||null, is_winner: (ctr||0)>0.015||(roas||0)>2, confidence: 0.1, insight_text: `${hook_type} em ${platform}: CTR ${ctr}, ROAS ${roas}`, variables: { entries: [{ text: hook_text?.slice(0,100), ctr, roas, market, date: new Date().toISOString().split('T')[0] }] } });
        }
        break;
      }
    }

    // Rebuild AI profile summary
    try {
      const [{ data: patterns }, { data: mem }] = await Promise.all([
        (sb as any).from('learned_patterns').select('is_winner,avg_ctr,avg_roas,insight_text,confidence').eq('user_id', user_id).order('confidence', { ascending: false }).limit(15),
        (sb as any).from('creative_memory').select('hook_type,hook_score,platform').eq('user_id', user_id).limit(50),
      ]);
      const winners = (patterns||[]).filter((p: any) => p.is_winner && p.confidence > 0.3);
      const topTypes = Object.entries((mem||[]).reduce((a: any, m: any) => { if(m.hook_type) a[m.hook_type]=(a[m.hook_type]||0)+1; return a; }, {})).sort((a: any,b: any) => b[1]-a[1]).slice(0,3).map(([t]) => t);
      const avgScore = (mem||[]).reduce((s: number, m: any) => s+(m.hook_score||0), 0) / Math.max(1,(mem||[]).length);
      const summary = [winners.length ? `Vencedores: ${winners.slice(0,2).map((p: any)=>p.insight_text).join(' | ')}` : '', topTypes.length ? `Tipos favoritos: ${topTypes.join(', ')}` : '', `${(mem||[]).length} criativos na memória`].filter(Boolean).join('. ');
      await (sb as any).from('user_ai_profile').upsert({ user_id, avg_hook_score: avgScore||null, top_performing_models: topTypes, ai_summary: summary, total_analyses: (mem||[]).length, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (_) {}

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('capture-learning:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

// redeploy 202603261600
