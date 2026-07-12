-- ============================================================
-- GROWTH ENGINE: SEO AUDITS
-- On-Page SEO Engine output: per-page audit runs with structured
-- issue lists and a severity rollup for the dashboard.
-- ============================================================

create table if not exists public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  page_url text not null,
  audit_date timestamptz default now(),
  issues jsonb default '[]'::jsonb,
  severity_summary jsonb default '{}'::jsonb,
  status text default 'pending', -- pending | in_progress | completed
  created_at timestamptz default now()
);

create index if not exists idx_seo_audits_page_url on public.seo_audits(page_url);
create index if not exists idx_seo_audits_status on public.seo_audits(status);

grant select, insert, update, delete on public.seo_audits to authenticated;
grant all on public.seo_audits to service_role;

alter table public.seo_audits enable row level security;

drop policy if exists "admins manage seo_audits" on public.seo_audits;
create policy "admins manage seo_audits" on public.seo_audits
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
