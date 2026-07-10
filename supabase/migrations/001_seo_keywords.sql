-- ============================================================
-- GROWTH ENGINE: SEO KEYWORDS
-- Research Engine output: researched keywords with volume/difficulty
-- scoring, feeding the Content and Ads Intelligence engines.
-- ============================================================

create table if not exists public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  search_volume integer,
  difficulty_score numeric(5,2),
  intent text check (intent in ('informational', 'commercial', 'navigational')),
  target_country text default 'US',
  priority integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_seo_keywords_intent on public.seo_keywords(intent);
create index if not exists idx_seo_keywords_priority on public.seo_keywords(priority);

grant select, insert, update, delete on public.seo_keywords to authenticated;
grant all on public.seo_keywords to service_role;

alter table public.seo_keywords enable row level security;

drop policy if exists "admins manage seo_keywords" on public.seo_keywords;
create policy "admins manage seo_keywords" on public.seo_keywords
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
