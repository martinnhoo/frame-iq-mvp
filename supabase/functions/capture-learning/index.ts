// capture-learning v2 — few-shot + chat_memory — alimenta a memória do produto com cada ação do usuário
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

    const body = await req.json();
    const { user_id, event_type, data } = body;

    // Version probe
    if (event_type === '__version') {
      return new Response(JSON.stringify({ version: 'v2-few-shot', ts: Date.now() }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

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
        const { blocks, feedback, message_text, persona_id: feedbackPersonaId } = data;

        // Always update learned_patterns for hooks
        const hookBlock = (blocks || []).find((b: any) => b.type === 'hooks' && b.items?.length);
        if (hookBlock) {
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
        }

        // FEW-SHOT: save liked responses as examples for future prompts
        if (feedback === 'like' && message_text && blocks?.length) {
          // Only save substantive responses (insight/action/dashboard blocks)
          const goodBlocks = (blocks || []).filter((b: any) =>
            ['insight', 'action', 'dashboard', 'warning'].includes(b.type) && b.content && b.content.length > 30
          );
          if (goodBlocks.length > 0) {
            // Cap at 20 examples per persona — remove oldest if over limit
            const { data: existing } = await (sb as any).from('chat_examples')
              .select('id, created_at')
              .eq('user_id', user_id)
              .eq('persona_id', feedbackPersonaId || null)
              .order('created_at', { ascending: true });

            if ((existing?.length || 0) >= 20) {
              // Delete oldest to make room
              const toDelete = existing!.slice(0, (existing!.length - 19));
              for (const old of toDelete) {
                await (sb as any).from('chat_examples').delete().eq('id', old.id);
              }
            }

            await (sb as any).from('chat_examples').insert({
              user_id,
              persona_id: feedbackPersonaId || null,
              user_message: String(message_text).slice(0, 400),
              assistant_blocks: goodBlocks.slice(0, 3),
              quality_score: 5,
            });
          }
        }

        // FEW-SHOT: remove disliked responses if they were previously saved
        if (feedback === 'dislike' && message_text) {
          await (sb as any).from('chat_examples')
            .delete()
            .eq('user_id', user_id)
            .ilike('user_message', `%${String(message_text).slice(0, 50)}%`);
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

      case 'preflight_run': {
        // Track preflight score trends per platform/market/format combination
        const { score, verdict, platform, market, format, hook_score, hook_type, top_fixes } = data;
        if (!score) break;
        const key = `preflight_${(platform||'tiktok').toLowerCase()}_${(market||'BR').toLowerCase()}`;
        const { data: ex } = await (sb as any).from('learned_patterns')
          .select('id, sample_size, variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        const entries = ((ex?.variables as any)?.entries || []);
        entries.unshift({ score, verdict, format, hook_score, hook_type, fixes: top_fixes, date: new Date().toISOString().split('T')[0] });
        const avgScore = entries.slice(0,10).reduce((s: number, e: any) => s + (e.score||0), 0) / Math.min(entries.length, 10);
        const isGettingBetter = entries.length >= 3 && entries[0].score > entries[2].score;
        if (ex) {
          await (sb as any).from('learned_patterns').update({
            sample_size: (ex.sample_size||0)+1,
            confidence: Math.min(1, ((ex.sample_size||0)+1) / 8),
            insight_text: `Preflight ${platform}/${market}: score médio ${avgScore.toFixed(0)}/100${isGettingBetter ? ' — melhorando' : ''} (${(ex.sample_size||0)+1} runs)`,
            last_updated: new Date().toISOString(),
            variables: { entries: entries.slice(0, 20) }
          }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({
            user_id, pattern_key: key, sample_size: 1, confidence: 0.15,
            insight_text: `Preflight ${platform}/${market}: primeiro run, score ${score}/100, veredicto ${verdict}`,
            variables: { entries: entries.slice(0, 20) }
          });
        }
        break;
      }

      case 'meta_action_executed': {
        // Every real Meta action (pause/enable/budget change) becomes a learning signal
        const { action, target_name, target_type, target_id, value, executed_at } = data;
        if (!action) break;
        const key = `action_${action.toLowerCase()}_${(target_type||'ad').toLowerCase()}`;
        const { data: ex } = await (sb as any).from('learned_patterns')
          .select('id, sample_size, variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        const entries = ((ex?.variables as any)?.entries || []);
        entries.unshift({ name: target_name?.slice(0,60), id: target_id, value, date: executed_at?.split('T')[0] || new Date().toISOString().split('T')[0] });
        if (ex) {
          await (sb as any).from('learned_patterns').update({
            sample_size: (ex.sample_size||0) + 1,
            confidence: Math.min(1, ((ex.sample_size||0) + 1) / 5),
            insight_text: `${action} executado ${(ex.sample_size||0)+1}x — último: "${target_name?.slice(0,40)}"`,
            last_updated: new Date().toISOString(),
            variables: { entries: entries.slice(0, 20) }
          }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({
            user_id, pattern_key: key, sample_size: 1, confidence: 0.2,
            insight_text: `${action} executado pela primeira vez em ${target_type}: "${target_name?.slice(0,40)}"`,
            variables: { entries: entries.slice(0, 20) }
          });
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

      // ── AI curiosity answer: user answered a strategic question from the AI ──
      // Saves the answer as a business insight for permanent use
      case 'ai_curiosity_answer': {
        const { question, answer, category } = data;
        if (!answer || !question) break;

        // Special handling: business_goal triggers goal calculation
        if (category === 'business_goal') {
          // Parse the goal from the answer and calculate reverse-funnel metrics
          // Example answer: "50 leads por mês com R$2.000 de budget"
          const budgetMatch = answer.match(/r\$\s*([\d.,]+)/i);
          const leadsMatch = answer.match(/(\d+)\s*(?:leads?|vendas?|agendamentos?|conversões?)/i);
          const budget = budgetMatch ? parseFloat(budgetMatch[1].replace(',', '.')) : null;
          const targetConversions = leadsMatch ? parseInt(leadsMatch[1]) : null;
          const targetCpa = budget && targetConversions ? (budget / targetConversions) : null;
          // Estimate required CTR: if avg CPA requires 2% CTR (heuristic based on funnel)
          const requiredCtr = targetCpa ? (targetCpa < 50 ? '2.5%' : targetCpa < 150 ? '1.5%' : '1.0%') : null;

          const goalData = {
            goal: answer,
            budget: budget ? `R$${budget.toFixed(0)}` : null,
            target_conversions: targetConversions,
            target_cpa: targetCpa ? `R$${targetCpa.toFixed(0)}` : null,
            required_ctr: requiredCtr,
            progress: 'aguardando dados de performance',
            set_at: new Date().toISOString(),
          };

          // Save as ai_recommendations.business_goal in user_ai_profile
          const { data: profile } = await (sb as any).from('user_ai_profile')
            .select('ai_recommendations').eq('user_id', user_id).maybeSingle();
          const currentRecs = (profile?.ai_recommendations as any) || {};
          await (sb as any).from('user_ai_profile').upsert({
            user_id,
            ai_recommendations: { ...currentRecs, business_goal: goalData },
            last_updated: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }

        // Map question to category key
        const catKey = (category || 'business_insight').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const key = `curiosity_${catKey}`;

        const { data: ex } = await (sb as any).from('learned_patterns')
          .select('id, sample_size, variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();

        const insight = `${question.slice(0, 60)}: "${answer.slice(0, 150)}"`;

        if (ex) {
          const entries = ((ex.variables as any)?.entries || []);
          entries.unshift({ question, answer, date: new Date().toISOString().split('T')[0] });
          await (sb as any).from('learned_patterns').update({
            sample_size: (ex.sample_size || 0) + 1,
            confidence: Math.min(0.95, ((ex.sample_size || 0) + 1) / 3),
            insight_text: insight,
            is_winner: true, // Direct user input = highest quality signal
            last_updated: new Date().toISOString(),
            variables: { entries: entries.slice(0, 10), category: catKey, latest_answer: answer },
          }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({
            user_id,
            pattern_key: key,
            insight_text: insight,
            hook_type: 'business_knowledge',
            is_winner: true,
            sample_size: 1,
            confidence: 0.8, // High confidence — user said it directly
            variables: {
              entries: [{ question, answer, date: new Date().toISOString().split('T')[0] }],
              category: catKey,
              latest_answer: answer,
            },
            last_updated: new Date().toISOString(),
          });
        }
        break;
      }

      // ── Cross-platform insight: fired when AI detects patterns across Meta+Google
      case 'cross_platform_insight': {
        // data: { platform_a, platform_b, angle, result_a, result_b, insight, persona_id }
        const { platform_a, platform_b, angle, result_a, result_b, insight } = data;
        if (!angle || !insight) break;
        const key = `cross_${(platform_a||'meta').toLowerCase()}_${(platform_b||'google').toLowerCase()}_${(angle||'').toLowerCase().replace(/\s+/g,'_').slice(0,30)}`;
        const { data: ex } = await (sb as any).from('learned_patterns')
          .select('id,sample_size,variables').eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
        const entry = {
          angle: angle?.slice(0,100),
          result_a, result_b,
          insight: insight?.slice(0,200),
          date: new Date().toISOString().split('T')[0],
        };
        if (ex) {
          const entries = ((ex.variables as any)?.entries || []);
          entries.unshift(entry);
          await (sb as any).from('learned_patterns').update({
            sample_size: (ex.sample_size||0) + 1,
            confidence: Math.min(1, ((ex.sample_size||0)+1) / 5),
            insight_text: `Cross [${platform_a}↔${platform_b}] "${angle?.slice(0,40)}": ${insight?.slice(0,100)}`,
            last_updated: new Date().toISOString(),
            variables: { platform_a, platform_b, angle, entries: entries.slice(0, 20) },
          }).eq('id', ex.id);
        } else {
          await (sb as any).from('learned_patterns').insert({
            user_id,
            pattern_key: key,
            persona_id: data.persona_id || null,
            sample_size: 1,
            confidence: 0.2,
            insight_text: `Cross [${platform_a}↔${platform_b}] "${angle?.slice(0,40)}": ${insight?.slice(0,100)}`,
            variables: { platform_a, platform_b, angle, entries: [entry] },
          });
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

// redeploy 202603262100
// redeploy 202603261317
