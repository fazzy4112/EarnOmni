-- ============================================================
-- GROWTH ENGINE: AD CAMPAIGN BRIEFS
-- Ads Intelligence Engine output: generated campaign suggestions per
-- ad platform, optionally anchored to a researched keyword.
-- ============================================================

create table if not exists public.ad_campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  platform text check (platform in ('google_ads', 'meta_ads')),
  target_keyword_id uuid references public.seo_keywords(id) on delete set null,
  campaign_data jsonb default '{}'::jsonb,
  status text default 'draft', -- draft | review | approved | launched
  created_at timestamptz default now()
);

create index if not exists idx_ad_campaign_briefs_target_keyword on public.ad_campaign_briefs(target_keyword_id);
create index if not exists idx_ad_campaign_briefs_status on public.ad_campaign_briefs(status);

grant select, insert, update, delete on public.ad_campaign_briefs to authenticated;
grant all on public.ad_campaign_briefs to service_role;

alter table public.ad_campaign_briefs enable row level security;

drop policy if exists "admins manage ad_campaign_briefs" on public.ad_campaign_briefs;
create policy "admins manage ad_campaign_briefs" on public.ad_campaign_briefs
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
