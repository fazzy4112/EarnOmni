-- ============================================================
-- GROWTH ENGINE: OUTREACH TARGETS
-- Advertiser/Investor Outreach Engine: companies/individuals being
-- prospected, either as ad-network partners or investors.
-- ============================================================

create table if not exists public.outreach_targets (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  platform_type text check (platform_type in ('ad_network', 'investor')),
  contact_email text,
  contact_name text,
  status text default 'new', -- new | contacted | responded | closed
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_outreach_targets_platform_type on public.outreach_targets(platform_type);
create index if not exists idx_outreach_targets_status on public.outreach_targets(status);

grant select, insert, update, delete on public.outreach_targets to authenticated;
grant all on public.outreach_targets to service_role;

alter table public.outreach_targets enable row level security;

drop policy if exists "admins manage outreach_targets" on public.outreach_targets;
create policy "admins manage outreach_targets" on public.outreach_targets
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
