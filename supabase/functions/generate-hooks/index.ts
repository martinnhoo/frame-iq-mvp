import { getEffectivePlan, getLimit, isWithinLimit } from "../_shared/plans.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Cost-based progressive throttle ──────────────────────────────────────────
const _COST_PER = { analysis:(3000/1e6*3)+(800/1e6*15), board:(2500/1e6*3)+(700/1e6*15), preflight:(2000/1e6*3)+(600/1e6*15), translation:(800/1e6*3)+(400/1e6*15), hook:(1500/1e6*3)+(400/1e6*15) };
const _PLAN_REV: Record<string,number> = { free:0, maker:19, pro:49, studio:149 };
async function checkThrottle(sb: any, uid: string): Promise<{allowed:boolean;retry_after:number}> {
  const period = new Date().toISOString().slice(0,7);
  const [{data:prof},{data:usage}] = await Promise.all([
    sb.from('profiles').select('plan,last_ai_action_at').eq('id',uid).single(),
    sb.from('usage').select('analyses_count,boards_count,translations_count,preflights_count,hooks_count').eq('user_id',uid).eq('period',period).single(),
  ]);
  const p = (prof as any);
  const u = (usage as any);
  const rev = _PLAN_REV[p?.plan||'free']??0;
  if(rev<=0) return {allowed:true,retry_after:0};
  const cost=(u?.analyses_count||0)*_COST_PER.analysis+(u?.boards_count||0)*_COST_PER.board+(u?.translations_count||0)*_COST_PER.translation+(u?.preflights_count||0)*_COST_PER.preflight+(u?.hooks_count||0)*_COST_PER.hook;
  const ratio=cost/rev;
  if(ratio<0.80) return {allowed:true,retry_after:0};
  const maxSec=480;
  const cooldown=ratio>=1?maxSec:Math.round(((ratio-0.80)/0.20)*maxSec);
  const elapsed=p?.last_ai_action_at?(Date.now()-new Date(p.last_ai_action_at).getTime())/1000:cooldown+1;
  const wait=Math.max(0,Math.ceil(cooldown-elapsed));
  if(wait>0) return {allowed:false,retry_after:wait};
  await sb.from('profiles').update({last_ai_action_at:new Date().toISOString()} as any).eq('id',uid);
  return {allowed:true,retry_after:0};
}
// ─────────────────────────────────────────────────────────────────────────────


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { product, niche, market, platform, tone, user_id, persona_id, count = 10, persona_context, funnel_stage = "tofu", context, angle } = await req.json();
    
    // ── Cap hook count by plan ─────────────────────────────────────────────
    let effectiveCount = count;
    if (user_id) {
      const { data: prof } = await supabase.from('profiles').select('plan, email').eq('id', user_id).maybeSingle();
      const plan = getEffectivePlan(prof?.plan, (prof as any)?.email);
      const hookCaps: Record<string, number> = { free: 3, maker: 5, pro: 8, studio: 10, creator: 5, starter: 8, scale: 10 };
      const cap = plan === 'studio' ? 10 : (hookCaps[plan] ?? 3);
      effectiveCount = Math.min(count, cap);
    }

    const FUNNEL_CONTEXT: Record<string, string> = {
      tofu: "TOP OF FUNNEL (cold audience) — hooks must generate AWARENESS. Interrupt the scroll, spark curiosity or emotion. No assumptions about brand knowledge. Lead with a problem, insight, or bold claim.",
      mofu: "MIDDLE OF FUNNEL (warm audience) — hooks must drive CONSIDERATION. The person knows the category but is evaluating. Lead with differentiation, social proof, or deeper benefit.",
      bofu: "BOTTOM OF FUNNEL (hot audience) — hooks must trigger CONVERSION. The person is ready to decide. Lead with urgency, specific offer, risk reversal, or final push.",
    };

    // Fallback: if no product, use niche or a safe default — never fail
    const effectiveProduct = product || niche || 'iGaming';

    // ── Cost-based throttle check ──
    if (user_id) {
      const _sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const throttle = await checkThrottle(_sb, user_id);
      if (!throttle.allowed) {
        return new Response(JSON.stringify({
          error: 'rate_limited',
          message: 'Processing will be available shortly. Please try again in a moment.',
          retry_after_seconds: throttle.retry_after,
        }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    // ── Load full account intelligence for hook personalization ──────────────
    let userContext = '';
    if (user_id) {
      // Parallel: ai_profile + Meta snapshot + loop context + winner patterns
      const [profileRes, snapshotRes, loopRes, winnersRes] = await Promise.allSettled([
        supabase.from('user_ai_profile')
          .select('top_performing_models, best_platforms, avg_hook_score, creative_style, ai_summary, industry, pain_point')
          .eq('user_id', user_id).maybeSingle(),
        supabase.from('daily_snapshots')
          .select('date, total_spend, avg_ctr, active_ads, top_ads, ai_insight, winners_count, losers_count')
          .eq('user_id', user_id).order('date', { ascending: false }).limit(1),
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/creative-loop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}` },
          body: JSON.stringify({ action: 'get_context', user_id, persona_id: persona_id || null }),
        }),
        // GAP 1 FIX: fetch ALL patterns server-side — winners AND losers
        // Never depend on frontend passing context — always fresh from DB
        supabase.from('learned_patterns')
          .select('pattern_key, insight_text, avg_ctr, avg_roas, confidence, hook_type, is_winner')
          .eq('user_id', user_id)
          .order('confidence', { ascending: false })
          .limit(20),
      ]);

      // AI Profile
      const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      if (profile) {
        const industry = profile.industry ? `Industry: ${profile.industry}.` : '';
        const style = profile.creative_style ? `Creative style: ${profile.creative_style}.` : '';
        const score = profile.avg_hook_score ? `Avg hook score: ${profile.avg_hook_score}/10.` : '';
        const models = (profile.top_performing_models || []).length ? `Best models: ${profile.top_performing_models.join(', ')}.` : '';
        // Extract user instructions (non-system notes)
        const rawNotes = profile.pain_point as string | null;
        const userInstructions = rawNotes ? rawNotes.split('|||').filter((s: string) => !s.startsWith('Usuário:') && !s.startsWith('Nicho:') && s.trim()).join(' | ') : '';
        userContext = `\n=== ACCOUNT PROFILE ===\n${industry} ${style} ${score} ${models}`.trim();
        if (userInstructions) userContext += `\nUser permanent instructions: ${userInstructions}`;
      }

      // Meta Ads snapshot
      const snapshot = snapshotRes.status === 'fulfilled' ? snapshotRes.value.data?.[0] : null;
      if (snapshot) {
        const topAds = (snapshot.top_ads as any[]) || [];
        const winners = topAds.filter((a: any) => a.isScalable || (a.ctr > 0.02)).slice(0, 3);
        const losers  = topAds.filter((a: any) => a.needsPause || (a.ctr < 0.005)).slice(0, 2);
        userContext += `\n\n=== META ADS DATA (${snapshot.date}) ===`;
        userContext += `\nAccount CTR: ${((snapshot.avg_ctr || 0) * 100).toFixed(2)}% | Spend: $${(snapshot.total_spend || 0).toFixed(0)} | Active ads: ${snapshot.active_ads || 0}`;
        if (winners.length) userContext += `\nWINNING ADS (high CTR — learn from these hooks): ${winners.map((a: any) => `"${a.name}" CTR ${((a.ctr||0)*100).toFixed(2)}%`).join(' | ')}`;
        if (losers.length)  userContext += `\nUNDERPERFORMING (avoid these hook patterns): ${losers.map((a: any) => `"${a.name}" CTR ${((a.ctr||0)*100).toFixed(2)}%`).join(' | ')}`;
        if (snapshot.ai_insight) userContext += `\nAccount insight: ${snapshot.ai_insight}`;
      }

      // Creative loop patterns
      try {
        const loopResp = loopRes.status === 'fulfilled' ? loopRes.value : null;
        if (loopResp && loopResp.ok) {
          const loopData = await loopResp.json();
          if (loopData.has_data && loopData.context) {
            userContext += `\n\n=== PROVEN CREATIVE PATTERNS (from this account's real ad data) ===\n${loopData.context}\n=== Generate hooks that match and build on these winning patterns. ===`;
          }
        }
      } catch { /* optional */ }

      // Winner hook types from learned_patterns — highest priority signal
      const allPatterns = winnersRes.status === 'fulfilled' ? winnersRes.value.data || [] : [];
      if (allPatterns.length > 0) {
        const winners = allPatterns.filter((p: any) => p.is_winner && p.confidence > 0.3);
        const losers = allPatterns.filter((p: any) => !p.is_winner && p.confidence > 0.3);
        
        if (winners.length > 0) {
          const lines = winners.filter((p: any) => p.insight_text).map((p: any) => {
            const ctr = p.avg_ctr ? ` CTR ${(p.avg_ctr * 100).toFixed(2)}%` : '';
            const roas = p.avg_roas ? ` ROAS ${p.avg_roas.toFixed(1)}x` : '';
            // Extract conversion data from variables if available
            const vars = (p.variables as any) || {};
            const lastEntry = vars.history?.[0] || {};
            const conv = lastEntry.conversions > 0 ? ` | ${lastEntry.conversions} conv` : '';
            const cpa = lastEntry.cpa ? ` | CPA R$${lastEntry.cpa.toFixed(0)}` : '';
            return `✓ ${p.insight_text}${ctr}${roas}${conv}${cpa}`;
          }).join('\n');
          userContext += `\n\n=== WHAT WORKS FOR THIS ACCOUNT (real performance) ===\n${lines}\nGenerate hooks that build on these proven angles. Prioritize angles with conversions and ROAS > 1.`;
        }
        
        if (losers.length > 0) {
          const lines = losers.filter((p: any) => p.insight_text).slice(0, 5).map((p: any) => {
            const ctr = p.avg_ctr ? ` CTR ${(p.avg_ctr * 100).toFixed(2)}%` : '';
            return `✗ ${p.insight_text}${ctr}`;
          }).join('\n');
          userContext += `\n\n=== WHAT DOES NOT WORK — AVOID THESE ANGLES ===\n${lines}`;
        }
      }
    }

    if (!ANTHROPIC_API_KEY) {
      // Mock response
      const mockHooks = Array.from({ length: effectiveCount }, (_, i) => ({
        hook: `Hook variation ${i + 1} for ${effectiveProduct} — ${['Stop scrolling', 'This changed everything', 'Nobody talks about this', 'I tested this for 30 days', 'The truth about'][i % 5]} ${effectiveProduct}`,
        hook_type: ['curiosity', 'social_proof', 'pattern_interrupt', 'direct_offer', 'emotional'][i % 5],
        predicted_score: Math.round((6 + Math.random() * 3) * 10) / 10,
        hook_strength: ['medium', 'high', 'high', 'viral', 'medium'][i % 5],
        platform_fit: [platform || 'TikTok'],
        why: `This hook works because it creates immediate curiosity about ${effectiveProduct}.`,
        cta_suggestion: 'Swipe up to learn more',
      }));
      return new Response(JSON.stringify({ hooks: mockHooks, mock_mode: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Auto-retry on 500/timeout — Haiku occasionally times out on long prompts
    const callAnthropic = async (_retrying?: boolean) => {
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `You are a senior creative strategist. You write hooks that earn trust and convert — not hooks that shock, scare or lie.

════════════════════════════════════════════════════════════
ADBRIEF AI CONSTITUTION — APLICA A TODO OUTPUT DESTA IA
════════════════════════════════════════════════════════════

BLOCO 1 — INTEGRIDADE DE DADOS (não negociável)

REGRA 1: ZERO NÚMEROS INVENTADOS
Nunca escreva percentuais, quantidades ou estatísticas que não estejam nos dados reais da conta ou contexto fornecido.
PROIBIDO: "80% dos pacientes", "2.400 casos", "15 mil clientes", "87% de sucesso", "3x mais resultados"
PERMITIDO: dados reais dos padrões da conta, ou especificidades verificáveis ("60 anos de experiência", "Jabaquara SP")
Se não há dado real → use especificidade de experiência, não estatística fabricada.

REGRA 2: ZERO CLAIMS NÃO VERIFICÁVEIS
PROIBIDO: "técnica que hospitais escondem", "médicos não querem que você saiba", "resultado garantido", "o único método"
PERMITIDO: o que a empresa pode demonstrar, mostrar, testemunhar publicamente.

REGRA 3: DADOS REAIS TÊM PRIORIDADE ABSOLUTA
Se o contexto contém dados reais da conta (CTR, ROAS, conversões, padrões aprendidos), USE-OS.
Dados reais > generalização de mercado > inferência > nada.

BLOCO 2 — INTELIGÊNCIA POR NICHO (o que torna preciso)

SAÚDE/MÉDICO: A pessoa com doença crônica já vive com o medo — NÃO amplifique.
"você pode estar acelerando a amputação" = predatório, não persuasivo.
Use: credibilidade ("60 anos tratando"), caminho forward, resultado de pacientes reais.
Evite: urgência falsa, consequências extremas, julgamento do paciente.

APOSTAS/IGAMING BR: use "autorizado" nunca "legalizado". Nunca implique ganho garantido.
CTA padrão: "Jogue agora". Inclua disclaimer de jogo responsável quando relevante.

FINANÇAS/CRÉDITO: Nunca prometa aprovação garantida. Evite linguagem que explore vulnerabilidade.

EMAGRECIMENTO/ESTÉTICA: Nunca prometa resultado específico sem laudo. Evite before/after com números sem evidência.

INFOPRODUTOS: Evite "R$X em Y dias" sem prova documental. Nunca use depoimentos de renda como padrão.

BLOCO 3 — TESTE DE QUALIDADE (antes de entregar)

Antes de finalizar qualquer output, verifique:
1. Contém número que não veio dos dados reais? → REMOVA
2. A empresa consegue provar esse claim se questionada? → Se não, REFORMULE
3. Isso poderia estar num artigo genérico sem contexto da conta? → Se sim, REESCREVA
4. Respeita as regras do nicho identificado? → Se não, AJUSTE

════════════════════════════════════════════════════════════

${userContext}
${persona_context ? `\nAUDIENCE:\n- ${persona_context.name} (${persona_context.age}) | pains: ${persona_context.pains?.join(', ')} | desires: ${persona_context.desires?.join(', ')}\n- Language style: ${persona_context.language_style}\n` : ''}
FUNNEL STAGE: ${FUNNEL_CONTEXT[funnel_stage] || FUNNEL_CONTEXT.tofu}

Generate ${effectiveCount} hooks for:
- Product/Service: ${effectiveProduct}
- Niche: ${niche || 'general'}
- Market: ${market || 'global'}
- Platform: ${platform || 'Meta/TikTok'}
- Tone: ${tone && tone !== 'aggressive, urgent, direct' ? tone : 'human, credible, specific'}
${angle ? `- Angle: ${angle}` : ''}
${context ? `- Context/account patterns: ${context}` : ''}

WHAT ACTUALLY WORKS (use these angles):
- Specificity of experience: "Ferida que não cicatriza há meses?" (they recognize themselves)
- Earned credibility: "60 anos tratando esse tipo de caso na Zona Sul"
- Outcome without exploitation: "Pacientes que voltaram a andar" — not "evite amputação"
- Contrast: "Curativo convencional vs o que realmente fecha feridas diabéticas"
- Question that interrupts: "Você ainda usa curativo comum em ferida diabética?"
- Story opener: "Chegou aqui sem esperança. Saiu caminhando."

VARY THE APPROACH — ${effectiveCount} genuinely different mechanisms:
curiosity | social_proof | authority | contrast | story_opener | outcome | question | relief

Return ONLY valid JSON:
{
  "hooks": [
    {
      "hook": "Exact words — what appears on screen or what is said",
      "hook_type": "curiosity|social_proof|authority|contrast|emotional|question|statement",
      "predicted_score": 7.5,
      "hook_strength": "low|medium|high|viral",
      "platform_fit": ["Meta", "Google"],
      "why": "Psychological mechanism + why it fits this specific audience",
      "cta_suggestion": "Best CTA to pair with this hook"
    }
  ]
}`
        }]
      })
    });

      });
    };
    let res = await callAnthropic();
    // Retry once on 500/529 with reduced max_tokens
    if (!res.ok && (res.status === 500 || res.status === 529 || res.status === 503)) {
      console.warn(`generate-hooks: retry after ${res.status}`);
      await new Promise(r => setTimeout(r, 1000));
      res = await callAnthropic(0.7);
    }
    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();
    const rawText = (data.content?.[0]?.text || '').trim();

    // Robust JSON extraction — handles markdown fences, trailing text, etc.
    let text = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // If there's text after the closing }, extract just the JSON object
    const jsonMatch = text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) text = jsonMatch[1];

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      // Last resort: try to extract hooks array directly
      const hooksMatch = rawText.match(/"hooks"\s*:\s*(\[[\s\S]*?\])/);
      if (hooksMatch) {
        try { parsed = { hooks: JSON.parse(hooksMatch[1]) }; }
        catch { throw new Error(`JSON parse failed: ${String(parseErr).slice(0, 100)}`); }
      } else {
        throw new Error(`JSON parse failed: ${String(parseErr).slice(0, 100)}`);
      }
    }

    // ── Post-generation filter: catch any invented numbers/fear amplification ──
    // This is a safety net — the prompt already prohibits these, but we verify
    const INVENTED_NUMBER_PATTERN = /\d+[%,.]?\d*\s*(?:dos|de|pacientes|casos|pessoas|curativos|cirurgi|amputaç)/i;
    const FEAR_AMPLIFICATION_PATTERN = /(?:acelerando|risco de|está em risco|pode perder|antes que|urgente|último aviso|médicos escondem|hospitais escondem)/i;
    
    const filteredHooks = (parsed.hooks || []).map((h: any) => {
      const hookText = h.hook || '';
      const hasInventedNumber = INVENTED_NUMBER_PATTERN.test(hookText);
      const hasFearAmplification = FEAR_AMPLIFICATION_PATTERN.test(hookText);
      
      if (hasInventedNumber || hasFearAmplification) {
        // Flag it — don't remove, but mark so the frontend can show a warning
        // and so we learn what to avoid
        return { ...h, flagged: true, flag_reason: hasInventedNumber ? 'invented_number' : 'fear_amplification' };
      }
      return h;
    });

    return new Response(JSON.stringify({ hooks: filteredHooks, mock_mode: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('generate-hooks:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// redeploy 202603251505
