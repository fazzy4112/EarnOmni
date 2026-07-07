-- ============================================================
-- GROWTH ENGINE: SOCIAL DESIGNS
-- Social Media Design Engine output: generated creatives, optionally
-- tied back to a content draft, awaiting approval per platform.
-- ============================================================

create table if not exists public.social_designs (
  id uuid primary key default gen_random_uuid(),
  content_draft_id uuid references public.content_drafts(id) on delete set null,
  design_type text,
  image_url text,
  caption text,
  platform text,
  status text default 'draft', -- draft | review | approved | published
  created_at timestamptz default now()
);

create index if not exists idx_social_designs_content_draft on public.social_designs(content_draft_id);
create index if not exists idx_social_designs_status on public.social_designs(status);

grant select, insert, update, delete on public.social_designs to authenticated;
grant all on public.social_designs to service_role;

alter table public.social_designs enable row level security;

drop policy if exists "admins manage social_designs" on public.social_designs;
create policy "admins manage social_designs" on public.social_designs
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
