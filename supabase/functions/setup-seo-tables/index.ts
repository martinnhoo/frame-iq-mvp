import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase    = createClient(supabaseUrl, serviceKey);

  const log: { step: string; status: string; detail?: string }[] = [];

  // Execute SQL via Supabase postgres REST endpoint (service role bypasses RLS)
  const sql = async (step: string, query: string) => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ sql: query }),
      });
      const body = await res.text();
      // "already exists" is fine
      if (res.ok || body.includes('already exists') || body.includes('does not exist')) {
        log.push({ step, status: 'ok' });
      } else {
        log.push({ step, status: 'error', detail: body.slice(0, 300) });
      }
    } catch (e) {
      log.push({ step, status: 'exception', detail: String(e) });
    }
  };

  // ── TABLES ──────────────────────────────────────────────────

  await sql('create seo_ads', `
    CREATE TABLE IF NOT EXISTS public.seo_ads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, title text NOT NULL,
      platform text NOT NULL, industry text NOT NULL,
      brand text, brand_display text, market text,
      ad_format text, creative_type text, hook_type text, cta_type text,
      duration_s integer, language text DEFAULT 'en',
      hook_text text, hook_score numeric(3,1), hook_strength text,
      transcript text, analysis text, why_it_works text, creative_model text,
      engagement_level text, estimated_spend text, performance_notes text,
      thumbnail_url text, video_url text, preview_gif_url text,
      meta_title text, meta_description text, tags text[] DEFAULT '{}',
      published boolean DEFAULT false, featured boolean DEFAULT false,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS seo_ads_platform_idx ON public.seo_ads(platform) WHERE published=true;
    CREATE INDEX IF NOT EXISTS seo_ads_industry_idx ON public.seo_ads(industry) WHERE published=true;
    CREATE INDEX IF NOT EXISTS seo_ads_slug_idx ON public.seo_ads(slug);
    ALTER TABLE public.seo_ads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_ads" ON public.seo_ads;
    CREATE POLICY "public read seo_ads" ON public.seo_ads FOR SELECT USING (published=true);
  `);

  await sql('create seo_hooks', `
    CREATE TABLE IF NOT EXISTS public.seo_hooks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, hook_text text NOT NULL, hook_type text NOT NULL,
      platform text, industry text, market text DEFAULT 'GLOBAL',
      hook_score numeric(3,1), why_it_works text, example_use text,
      tags text[] DEFAULT '{}',
      source_ad_id uuid REFERENCES public.seo_ads(id) ON DELETE SET NULL,
      published boolean DEFAULT false, featured boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS seo_hooks_type_idx ON public.seo_hooks(hook_type) WHERE published=true;
    CREATE INDEX IF NOT EXISTS seo_hooks_platform_idx ON public.seo_hooks(platform) WHERE published=true;
    ALTER TABLE public.seo_hooks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_hooks" ON public.seo_hooks;
    CREATE POLICY "public read seo_hooks" ON public.seo_hooks FOR SELECT USING (published=true);
  `);

  await sql('create seo_content', `
    CREATE TABLE IF NOT EXISTS public.seo_content (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, section text NOT NULL, cluster text,
      title text NOT NULL, subtitle text, body_mdx text, summary text,
      meta_title text, meta_description text, og_image_url text,
      keywords text[] DEFAULT '{}', canonical_url text,
      related_slugs text[] DEFAULT '{}', tool_slugs text[] DEFAULT '{}',
      cta_type text DEFAULT 'signup',
      published boolean DEFAULT false, featured boolean DEFAULT false,
      read_time_min integer,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS seo_content_section_idx ON public.seo_content(section) WHERE published=true;
    CREATE INDEX IF NOT EXISTS seo_content_cluster_idx ON public.seo_content(cluster) WHERE published=true;
    ALTER TABLE public.seo_content ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_content" ON public.seo_content;
    CREATE POLICY "public read seo_content" ON public.seo_content FOR SELECT USING (published=true);
  `);

  await sql('create seo_tools', `
    CREATE TABLE IF NOT EXISTS public.seo_tools (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, name text NOT NULL,
      description text, long_description text,
      meta_title text, meta_description text, keywords text[] DEFAULT '{}',
      tool_type text, is_free boolean DEFAULT true,
      requires_auth boolean DEFAULT false, dashboard_route text,
      related_guide_slugs text[] DEFAULT '{}', related_tool_slugs text[] DEFAULT '{}',
      published boolean DEFAULT false, created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.seo_tools ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_tools" ON public.seo_tools;
    CREATE POLICY "public read seo_tools" ON public.seo_tools FOR SELECT USING (published=true);
  `);

  await sql('create seo_comparisons', `
    CREATE TABLE IF NOT EXISTS public.seo_comparisons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, competitor_name text NOT NULL, competitor_slug text NOT NULL,
      headline text, summary text, body_mdx text,
      frameiq_pros text[] DEFAULT '{}', competitor_pros text[] DEFAULT '{}',
      frameiq_cons text[] DEFAULT '{}', competitor_cons text[] DEFAULT '{}',
      feature_table jsonb DEFAULT '[]',
      meta_title text, meta_description text, keywords text[] DEFAULT '{}',
      frameiq_price text, competitor_price text,
      published boolean DEFAULT false, created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.seo_comparisons ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_comparisons" ON public.seo_comparisons;
    CREATE POLICY "public read seo_comparisons" ON public.seo_comparisons FOR SELECT USING (published=true);
  `);

  await sql('create seo_landing_pages', `
    CREATE TABLE IF NOT EXISTS public.seo_landing_pages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE, title text NOT NULL,
      headline text, subheadline text, body_intro text, body_bottom text,
      filter_platform text, filter_industry text, filter_hook_type text,
      filter_format text, filter_market text,
      meta_title text, meta_description text, keywords text[] DEFAULT '{}', og_image_url text,
      related_page_slugs text[] DEFAULT '{}', related_guide_slugs text[] DEFAULT '{}',
      published boolean DEFAULT false, created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.seo_landing_pages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_landing_pages" ON public.seo_landing_pages;
    CREATE POLICY "public read seo_landing_pages" ON public.seo_landing_pages FOR SELECT USING (published=true);
  `);

  await sql('create seo_sitemap_urls', `
    CREATE TABLE IF NOT EXISTS public.seo_sitemap_urls (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      url text NOT NULL UNIQUE, section text,
      priority numeric(2,1) DEFAULT 0.5, changefreq text DEFAULT 'weekly',
      last_mod timestamptz DEFAULT now(), indexed boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS seo_sitemap_section_idx ON public.seo_sitemap_urls(section);
    ALTER TABLE public.seo_sitemap_urls ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public read seo_sitemap_urls" ON public.seo_sitemap_urls;
    CREATE POLICY "public read seo_sitemap_urls" ON public.seo_sitemap_urls FOR SELECT USING (true);
  `);

  // ── SEED DATA ───────────────────────────────────────────────

  await sql('seed seo_tools', `
    INSERT INTO public.seo_tools (slug,name,description,meta_title,meta_description,keywords,tool_type,is_free,requires_auth,dashboard_route,published) VALUES
    ('ad-hook-generator','Ad Hook Generator','Generate 10 high-converting hooks for any product in seconds.','Free Ad Hook Generator — FrameIQ','Generate high-converting ad hooks for TikTok and Facebook.',ARRAY['ad hook generator','tiktok hook ideas','free ad hook generator'],'generator',true,false,'/dashboard/hooks',true),
    ('ad-creative-analyzer','Ad Creative Analyzer','Upload any video ad and get an instant hook score.','Free Ad Creative Analyzer — FrameIQ','Analyze your video ad for hook strength and platform fit.',ARRAY['ad creative analyzer','hook score tool','video ad analyzer'],'analyzer',true,true,'/dashboard/analyses/new',true),
    ('competitor-ad-decoder','Competitor Ad Decoder','Paste any competitor ad and get the full creative framework.','Competitor Ad Decoder — Free | FrameIQ','Reverse-engineer any competitor ad in seconds.',ARRAY['competitor ad analysis','decode competitor ad'],'analyzer',true,false,'/dashboard/competitor',true),
    ('ad-script-generator','Ad Script Generator','Turn your product description into a full video ad script.','Free Ad Script Generator — FrameIQ','Generate complete video ad scripts for TikTok and Reels.',ARRAY['ad script generator','video script generator'],'generator',true,true,'/dashboard/boards/new',true),
    ('ctr-estimator','CTR Estimator','Estimate ad CTR based on hook type and platform benchmarks.','Ad CTR Estimator — Free | FrameIQ','Estimate your ad CTR before spending a dollar.',ARRAY['ctr estimator','ad ctr calculator'],'calculator',true,false,null,true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  await sql('seed seo_comparisons', `
    INSERT INTO public.seo_comparisons (slug,competitor_name,competitor_slug,headline,summary,meta_title,meta_description,keywords,frameiq_price,competitor_price,frameiq_pros,competitor_pros,feature_table,published) VALUES
    ('frameiq-vs-adspy','AdSpy','adspy','FrameIQ vs AdSpy — Which Tool Is Right for You?','AdSpy is a Facebook ad spy tool. FrameIQ is an AI-powered creative analyzer.','FrameIQ vs AdSpy 2025 — FrameIQ','FrameIQ vs AdSpy: full comparison of features, pricing, and use cases.',ARRAY['frameiq vs adspy','adspy alternative'],'From $19/mo','$149/mo',ARRAY['AI hook scoring','Video analysis in 60s','Free plan'],ARRAY['Massive ad database','Facebook coverage'],'[{"feature":"AI hook scoring","frameiq":"Yes","competitor":"No"},{"feature":"Free plan","frameiq":"Yes","competitor":"No"},{"feature":"Price","frameiq":"$19/mo","competitor":"$149/mo"}]'::jsonb,true),
    ('frameiq-vs-bigspy','BigSpy','bigspy','FrameIQ vs BigSpy — Ad Spy vs AI Analyzer','BigSpy is an ad spy tool. FrameIQ improves YOUR own creatives with AI.','FrameIQ vs BigSpy 2025 — FrameIQ','FrameIQ vs BigSpy: compare features, pricing, and use cases.',ARRAY['frameiq vs bigspy','bigspy alternative'],'From $19/mo','From $9/mo',ARRAY['AI creative analysis','Hook scoring'],ARRAY['Multi-platform ad library'],'[{"feature":"AI hook scoring","frameiq":"Yes","competitor":"No"},{"feature":"Free plan","frameiq":"Yes","competitor":"Limited"},{"feature":"Price","frameiq":"$19/mo","competitor":"$9/mo"}]'::jsonb,true),
    ('frameiq-vs-minea','Minea','minea','FrameIQ vs Minea — Creative Intelligence vs Product Research','Minea is a product research tool. FrameIQ is built for creative teams.','FrameIQ vs Minea 2025 — FrameIQ','FrameIQ vs Minea: which tool is best for ad creative analysis?',ARRAY['frameiq vs minea','minea alternative'],'From $19/mo','From $49/mo',ARRAY['AI analysis in 60s','Free plan'],ARRAY['Product research','Influencer discovery'],'[{"feature":"AI hook scoring","frameiq":"Yes","competitor":"No"},{"feature":"Free plan","frameiq":"Yes","competitor":"No"},{"feature":"Price","frameiq":"$19/mo","competitor":"$49/mo"}]'::jsonb,true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  await sql('seed seo_landing_pages', `
    INSERT INTO public.seo_landing_pages (slug,title,headline,subheadline,body_intro,meta_title,meta_description,keywords,filter_platform,filter_industry,published) VALUES
    ('tiktok-ad-examples','TikTok Ad Examples','The Best TikTok Ad Examples — Analyzed','See what makes top TikTok ads work.','Every ad scored for hook strength, creative model, and platform fit.','Best TikTok Ad Examples — FrameIQ','Browse the best TikTok ad examples with hook scores and AI analysis.',ARRAY['tiktok ad examples','best tiktok ads'],'tiktok',null,true),
    ('facebook-ad-examples','Facebook Ad Examples','High-Performing Facebook Ad Examples','Real ads, real breakdowns.','The best Facebook ads share a pattern: a scroll-stopping hook and a CTA that feels inevitable.','Best Facebook Ad Examples — FrameIQ','Browse top Facebook ad examples with AI analysis and hook scores.',ARRAY['facebook ad examples','best facebook ads'],'facebook',null,true),
    ('ugc-ad-examples','UGC Ad Examples','The Best UGC Ad Examples','UGC ads outperform polished creative by 4x.','This library collects the highest-scoring UGC ads across platforms with full creative analysis.','Best UGC Ad Examples — FrameIQ','Browse the best UGC ad examples with hook scores.',ARRAY['ugc ad examples','ugc advertising examples'],null,null,true),
    ('igaming-ad-examples','iGaming Ad Examples','Top iGaming and Betting Ad Examples','The highest-performing casino and sports betting ads, analyzed.','This library focuses on BR, MX, and IN markets with full creative analysis.','Best iGaming Ad Examples — FrameIQ','Browse top iGaming and betting ad examples with hook scores.',ARRAY['igaming ad examples','betting ad examples'],null,'igaming',true),
    ('ecommerce-ad-examples','Ecommerce Ad Examples','Top Ecommerce Ad Examples','The creative formulas that drive DTC revenue.','Ecommerce advertising lives and dies by the first 3 seconds.','Best Ecommerce Ad Examples — FrameIQ','Browse top ecommerce ad examples with AI analysis.',ARRAY['ecommerce ad examples','dtc ad examples'],null,'ecommerce',true),
    ('best-ad-hooks','Best Ad Hooks','50 Best Ad Hooks — Scored and Categorized','The opening lines that stop the scroll.','This database collects the highest-performing hooks across all major ad platforms.','Best Ad Hooks — FrameIQ','Browse 50+ high-performing ad hooks with hook scores and analysis.',ARRAY['best ad hooks','tiktok ad hooks'],null,null,true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  await sql('seed seo_content', `
    INSERT INTO public.seo_content (slug,section,cluster,title,summary,meta_title,meta_description,keywords,read_time_min,related_slugs,cta_type,published) VALUES
    ('tiktok-ads-guide','guides','tiktok-ads','TikTok Ads: The Complete Guide for 2025','A complete guide to TikTok advertising: creative formats, hook types, and scaling.','TikTok Ads Guide 2025 — FrameIQ','The complete guide to TikTok advertising in 2025.',ARRAY['tiktok ads guide','how to advertise on tiktok'],12,ARRAY['tiktok-ad-hooks-guide','tiktok-ad-testing-guide'],'signup',true),
    ('tiktok-ad-hooks-guide','guides','tiktok-ads','TikTok Ad Hooks: 15 Proven Formulas','15 hook formulas that consistently score 8+ on TikTok with real examples.','Best TikTok Ad Hooks — FrameIQ','15 TikTok ad hook formulas that stop the scroll.',ARRAY['tiktok ad hooks','best tiktok hooks'],8,ARRAY['tiktok-ads-guide','tiktok-ad-structure-guide'],'tool',true),
    ('tiktok-ad-structure-guide','guides','tiktok-ads','TikTok Ad Structure: Hook to Story to CTA','The proven 3-part structure behind every high-performing TikTok ad.','TikTok Ad Structure Guide — FrameIQ','How to structure a TikTok ad that converts.',ARRAY['tiktok ad structure','tiktok ad framework'],7,ARRAY['tiktok-ads-guide','tiktok-ad-hooks-guide'],'signup',true),
    ('tiktok-ad-testing-guide','guides','tiktok-ads','TikTok Ad Testing: Find Your Winning Creative Fast','How to test TikTok creatives efficiently without burning budget.','TikTok Ad Testing Guide — FrameIQ','How to test TikTok ads and find winning creatives.',ARRAY['tiktok ad testing','tiktok creative testing'],9,ARRAY['tiktok-ads-guide','tiktok-ad-scaling-guide'],'signup',true),
    ('tiktok-ad-scaling-guide','guides','tiktok-ads','How to Scale TikTok Ads Without Creative Fatigue','Scaling TikTok ads is a creative problem. This guide covers horizontal scaling and refresh cadence.','How to Scale TikTok Ads — FrameIQ','How to scale TikTok ads without creative fatigue.',ARRAY['scale tiktok ads','tiktok ads scaling'],10,ARRAY['tiktok-ads-guide','tiktok-ad-testing-guide'],'signup',true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  // ── VERIFY tables exist ──────────────────────────────────────
  const tables = ['seo_ads','seo_hooks','seo_content','seo_tools','seo_comparisons','seo_landing_pages','seo_sitemap_urls'];
  const verify: Record<string, boolean> = {};
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    verify[t] = !error || error.code !== '42P01';
  }

  return new Response(
    JSON.stringify({
      success: Object.values(verify).every(Boolean),
      tables_verified: verify,
      execution_log: log,
    }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
