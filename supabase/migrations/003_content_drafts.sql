-- ============================================================
-- GROWTH ENGINE: CONTENT DRAFTS
-- Content Engine output: AI-generated drafts targeting a researched
-- keyword, routed through the Dashboard/Approval System.
-- ============================================================

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_keyword_id uuid references public.seo_keywords(id) on delete set null,
  body text,
  seo_score numeric(5,2),
  status text default 'draft' check (status in ('draft', 'review', 'approved', 'published')),
  created_at timestamptz default now()
);

create index if not exists idx_content_drafts_target_keyword on public.content_drafts(target_keyword_id);
create index if not exists idx_content_drafts_status on public.content_drafts(status);

grant select, insert, update, delete on public.content_drafts to authenticated;
grant all on public.content_drafts to service_role;

alter table public.content_drafts enable row level security;

drop policy if exists "admins manage content_drafts" on public.content_drafts;
create policy "admins manage content_drafts" on public.content_drafts
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
