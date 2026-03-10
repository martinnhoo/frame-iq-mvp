-- ============================================================
-- FRAMEIQ — PROGRAMMATIC SEO DATA MODEL
-- Phase 2: Tables for ads library, hooks, templates, guides,
--           comparisons, and keyword-driven landing pages
-- ============================================================

-- ── 1. ADS LIBRARY ───────────────────────────────────────────
-- Core table. Each row = one ad creative entry in the public library.
-- Supports /ads-library/{platform}/{industry}/{brand}/{slug}

create table if not exists public.seo_ads (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,            -- URL-safe identifier
  title           text not null,                   -- e.g. "Nubank Curiosity Hook 30s"

  -- Classification
  platform        text not null,                   -- tiktok | facebook | instagram | youtube | snapchat
  industry        text not null,                   -- ecommerce | igaming | fintech | beauty | saas | health | food | travel
  brand           text,                            -- brand slug, e.g. "nubank"
  brand_display   text,                            -- display name, e.g. "Nubank"
  market          text,                            -- BR | MX | US | IN | GLOBAL

  -- Creative metadata
  ad_format       text,                            -- ugc | motion | static | carousel | story | short-form
  creative_type   text,                            -- talking-head | screen-record | animated | product-demo | testimonial
  hook_type       text,                            -- curiosity | social-proof | pattern-interrupt | direct-offer | emotional | question | fear | transformation
  cta_type        text,                            -- link-in-bio | swipe-up | shop-now | sign-up | download | learn-more
  duration_s      integer,                         -- seconds
  language        text default 'en',

  -- Content
  hook_text       text,                            -- the first 3s hook verbatim
  hook_score      numeric(3,1),                    -- 0.0–10.0
  hook_strength   text,                            -- viral | high | medium | low
  transcript      text,                            -- full VO/script
  analysis        text,                            -- AI analysis paragraph
  why_it_works    text,                            -- editorial explanation
  creative_model  text,                            -- e.g. "UGC Testimonial"

  -- Performance signals (optional, qualitative)
  engagement_level  text,                          -- viral | high | medium | low
  estimated_spend   text,                          -- low | medium | high | very-high
  performance_notes text,

  -- Media
  thumbnail_url   text,
  video_url       text,
  preview_gif_url text,

  -- SEO
  meta_title      text,
  meta_description text,
  tags            text[] default '{}',

  -- Status
  published       boolean default false,
  featured        boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Indexes for filter pages and joins
create index if not exists seo_ads_platform_idx   on public.seo_ads (platform) where published = true;
create index if not exists seo_ads_industry_idx   on public.seo_ads (industry) where published = true;
create index if not exists seo_ads_hook_type_idx  on public.seo_ads (hook_type) where published = true;
create index if not exists seo_ads_brand_idx      on public.seo_ads (brand)    where published = true;
create index if not exists seo_ads_market_idx     on public.seo_ads (market)   where published = true;
create index if not exists seo_ads_featured_idx   on public.seo_ads (featured) where published = true;
create index if not exists seo_ads_slug_idx       on public.seo_ads (slug);

-- ── 2. AD HOOKS DATABASE ─────────────────────────────────────
-- Supports /ad-hooks, /ad-hooks/{type}, /ad-hooks/{platform}

create table if not exists public.seo_hooks (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,

  hook_text     text not null,                     -- the actual hook copy
  hook_type     text not null,                     -- curiosity | social-proof | fear | transformation | question | pattern-interrupt | storytelling | direct-offer
  platform      text,                              -- tiktok | facebook | instagram | youtube | all
  industry      text,                              -- ecommerce | igaming | saas | beauty | health | all
  market        text default 'GLOBAL',

  -- Quality signals
  hook_score    numeric(3,1),
  why_it_works  text,
  example_use   text,                              -- how to adapt it
  tags          text[] default '{}',

  -- Source (optional link back to seo_ads)
  source_ad_id  uuid references public.seo_ads(id) on delete set null,

  published     boolean default false,
  featured      boolean default false,
  created_at    timestamptz default now()
);

create index if not exists seo_hooks_type_idx     on public.seo_hooks (hook_type) where published = true;
create index if not exists seo_hooks_platform_idx on public.seo_hooks (platform)  where published = true;
create index if not exists seo_hooks_industry_idx on public.seo_hooks (industry)  where published = true;

-- ── 3. GUIDES / BLOG ─────────────────────────────────────────
-- Supports /guides/{slug}, /blog/{slug}

create table if not exists public.seo_content (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  section         text not null,                   -- guides | blog | reports
  cluster         text,                            -- e.g. "tiktok-ads" — groups related guides

  title           text not null,
  subtitle        text,
  body_mdx        text,                            -- markdown/MDX content
  summary         text,                            -- short description, used in cards

  -- SEO
  meta_title      text,
  meta_description text,
  og_image_url    text,
  keywords        text[] default '{}',
  canonical_url   text,

  -- Linking
  related_slugs   text[] default '{}',             -- internal links to other content
  tool_slugs      text[] default '{}',             -- links to /tools/*
  cta_type        text default 'signup',           -- signup | upgrade | tool

  -- Status
  published       boolean default false,
  featured        boolean default false,
  read_time_min   integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists seo_content_section_idx on public.seo_content (section) where published = true;
create index if not exists seo_content_cluster_idx on public.seo_content (cluster) where published = true;

-- ── 4. TOOLS ─────────────────────────────────────────────────
-- Supports /tools/{slug}

create table if not exists public.seo_tools (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,            -- e.g. "ad-hook-generator"
  name            text not null,                   -- "Ad Hook Generator"
  description     text,
  long_description text,

  -- SEO
  meta_title      text,
  meta_description text,
  keywords        text[] default '{}',

  -- Config
  tool_type       text,                            -- generator | calculator | analyzer | checker
  is_free         boolean default true,
  requires_auth   boolean default false,           -- if true, redirects to signup
  dashboard_route text,                            -- e.g. "/dashboard/hooks"

  -- Linking
  related_guide_slugs text[] default '{}',
  related_tool_slugs  text[] default '{}',

  published       boolean default false,
  created_at      timestamptz default now()
);

-- ── 5. COMPARISON PAGES ──────────────────────────────────────
-- Supports /compare/frameiq-vs-{competitor}

create table if not exists public.seo_comparisons (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,          -- "frameiq-vs-adspy"
  competitor_name   text not null,                 -- "AdSpy"
  competitor_slug   text not null,                 -- "adspy"

  -- Content
  headline          text,
  summary           text,
  body_mdx          text,

  -- Structured comparison
  frameiq_pros      text[] default '{}',
  competitor_pros   text[] default '{}',
  frameiq_cons      text[] default '{}',
  competitor_cons   text[] default '{}',

  -- Feature table (JSON array of {feature, frameiq, competitor})
  feature_table     jsonb default '[]',

  -- SEO
  meta_title        text,
  meta_description  text,
  keywords          text[] default '{}',

  -- Pricing context
  frameiq_price     text,
  competitor_price  text,

  published         boolean default false,
  created_at        timestamptz default now()
);

-- ── 6. SEO LANDING PAGES (keyword-driven) ────────────────────
-- Supports /tiktok-ad-examples, /best-ad-hooks, etc.
-- These are static-ish pages with curated content + SEO copy

create table if not exists public.seo_landing_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,            -- "tiktok-ad-examples"
  title           text not null,
  headline        text,
  subheadline     text,
  body_intro      text,                            -- SEO paragraph above fold
  body_bottom     text,                            -- SEO paragraph below ads grid

  -- Filters applied to pull ads from seo_ads
  filter_platform text,
  filter_industry text,
  filter_hook_type text,
  filter_format   text,
  filter_market   text,

  -- SEO
  meta_title      text,
  meta_description text,
  keywords        text[] default '{}',
  og_image_url    text,

  -- Linking
  related_page_slugs text[] default '{}',
  related_guide_slugs text[] default '{}',

  published       boolean default false,
  created_at      timestamptz default now()
);

-- ── 7. SITEMAP TRACKING ──────────────────────────────────────
-- Lightweight table to drive sitemap.xml generation at scale

create table if not exists public.seo_sitemap_urls (
  id          uuid primary key default gen_random_uuid(),
  url         text not null unique,
  section     text,                                -- ads-library | guides | tools | compare | hooks | landing
  priority    numeric(2,1) default 0.5,            -- 0.1–1.0
  changefreq  text default 'weekly',               -- always | hourly | daily | weekly | monthly
  last_mod    timestamptz default now(),
  indexed     boolean default false,               -- set true after GSC confirms indexing
  created_at  timestamptz default now()
);

create index if not exists seo_sitemap_section_idx on public.seo_sitemap_urls (section);

-- ── 8. RLS — public read, no write from client ───────────────

alter table public.seo_ads            enable row level security;
alter table public.seo_hooks          enable row level security;
alter table public.seo_content        enable row level security;
alter table public.seo_tools          enable row level security;
alter table public.seo_comparisons    enable row level security;
alter table public.seo_landing_pages  enable row level security;
alter table public.seo_sitemap_urls   enable row level security;

-- Published rows are publicly readable (anon)
create policy "public read seo_ads"           on public.seo_ads           for select using (published = true);
create policy "public read seo_hooks"         on public.seo_hooks         for select using (published = true);
create policy "public read seo_content"       on public.seo_content       for select using (published = true);
create policy "public read seo_tools"         on public.seo_tools         for select using (published = true);
create policy "public read seo_comparisons"   on public.seo_comparisons   for select using (published = true);
create policy "public read seo_landing_pages" on public.seo_landing_pages for select using (published = true);
create policy "public read seo_sitemap_urls"  on public.seo_sitemap_urls  for select using (true);

-- ── 9. UPDATED_AT TRIGGERS ───────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger seo_ads_updated_at
  before update on public.seo_ads
  for each row execute function public.set_updated_at();

create trigger seo_content_updated_at
  before update on public.seo_content
  for each row execute function public.set_updated_at();
