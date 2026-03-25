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
      const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user_id).maybeSingle();
      const plan = prof?.plan || 'free';
      const hookCaps: Record<string, number> = { free: 3, maker: 5, pro: 8, studio: 10, creator: 5, starter: 8, scale: 10 };
      const cap = hookCaps[plan] ?? 3;
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
        // NEW: fetch winner patterns directly — hook types that actually convert
        supabase.from('learned_patterns')
          .select('pattern_key, insight_text, avg_ctr, avg_roas, confidence, hook_type')
          .eq('user_id', user_id)
          .eq('is_winner', true)
          .order('confidence', { ascending: false })
          .limit(8),
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
      const winnerPatterns = winnersRes.status === 'fulfilled' ? winnersRes.value.data || [] : [];
      if (winnerPatterns.length > 0) {
        const winnerLines = winnerPatterns
          .filter((p: any) => p.insight_text)
          .map((p: any) => {
            const ctr = p.avg_ctr ? ` CTR ${(p.avg_ctr * 100).toFixed(2)}%` : '';
            const roas = p.avg_roas ? ` ROAS ${p.avg_roas.toFixed(1)}x` : '';
            const conf = p.confidence ? ` (confidence: ${Math.round(p.confidence * 100)}%)` : '';
            return `• [${p.pattern_key || p.hook_type || 'pattern'}]${conf}: ${p.insight_text}${ctr}${roas}`;
          }).join('\n');
        if (winnerLines) {
          userContext += `\n\n=== WINNING HOOK PATTERNS — PRIORITIZE THESE ===\nThese hook types have proven to convert for this specific account. Build on them:\n${winnerLines}\n=== END WINNER PATTERNS ===`;
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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `You are a senior creative strategist. Your job is to understand the person on the other side of the ad before writing a single word.

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

STEP 1 — READ THE ROOM:
Before writing, ask:
- What is this person already feeling when they see this ad?
- What does their life look like right now because of this problem?
- What do they need — hope, validation, information, relief, confidence?

If someone is already scared (chronic illness, financial trouble, relationship pain):
→ Do NOT amplify the fear. They're living in it. You're not revealing anything new — you're just being cruel.
→ Instead: offer credibility, calm authority, a path forward.

If someone doesn't know they have the problem yet:
→ Pattern interrupts and contrast work. Create awareness of something they haven't noticed.

STEP 2 — WHAT EARNS TRUST IN SENSITIVE NICHES (health, finance, mental health):
- Specificity of experience: "Feridas que não cicatrizam há meses" (they recognize themselves)
- Earned credibility: "60 anos tratando esse tipo de ferida"
- Outcome without exploitation: "Pacientes que voltaram a andar" not "evite amputação"
- Normalization: "Você não está sozinho nisso"

STEP 3 — WHAT DESTROYS TRUST IN ANY NICHE:
- ALL CAPS: "MÉDICOS ESCONDEM", "ÚLTIMO AVISO" — looks like a scam
- Invented numbers: "90% dos pacientes", "2.847 casos" — immediately distrusted
- Fear amplification of what they already feel: predatory, not persuasive
- "Doctors don't want you to know" — overused by spam for 15 years
- Mismatch with platform: Google = confirm search intent (max 30 chars). Meta/TikTok = interrupt + intrigue

STEP 4 — VARY THE APPROACH:
Give ${effectiveCount} hooks with genuinely different mechanisms — not the same hook reworded:
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

    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify({ hooks: parsed.hooks, mock_mode: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('generate-hooks:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// redeploy 202603261600
