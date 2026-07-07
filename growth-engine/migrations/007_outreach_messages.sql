-- ============================================================
-- GROWTH ENGINE: OUTREACH MESSAGES
-- Advertiser/Investor Outreach Engine: drafted messages sent to an
-- outreach target over a given channel.
-- ============================================================

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  outreach_target_id uuid references public.outreach_targets(id) on delete cascade not null,
  channel text check (channel in ('email', 'dm')),
  subject text,
  body text,
  status text default 'draft' check (status in ('draft', 'sent', 'replied')),
  created_at timestamptz default now()
);

create index if not exists idx_outreach_messages_target on public.outreach_messages(outreach_target_id);
create index if not exists idx_outreach_messages_status on public.outreach_messages(status);

grant select, insert, update, delete on public.outreach_messages to authenticated;
grant all on public.outreach_messages to service_role;

alter table public.outreach_messages enable row level security;

drop policy if exists "admins manage outreach_messages" on public.outreach_messages;
create policy "admins manage outreach_messages" on public.outreach_messages
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
