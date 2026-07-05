-- ============================================================
-- AdEarn Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/foofdltskckbrmihisll/sql
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  balance numeric(12,2) default 0,
  points integer default 0,
  referral_code text unique,
  referred_by text,
  plan text default 'basic',
  is_active boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    upper(substr(md5(new.id::text || random()::text), 1, 8)),
    new.raw_user_meta_data->>'referred_by'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. ADS
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  ad_url text not null,
  thumbnail_url text,
  duration_seconds integer default 30,
  reward_points integer default 50,
  is_active boolean default true,
  created_at timestamptz default now()
);

grant select on public.ads to authenticated, anon;
grant all on public.ads to service_role;

alter table public.ads enable row level security;

drop policy if exists "anyone reads active ads" on public.ads;
create policy "anyone reads active ads" on public.ads
  for select using (is_active = true);

-- 3. AD VIEWS
create table if not exists public.ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ad_id uuid references public.ads(id) on delete cascade not null,
  points_earned integer not null,
  watched_at timestamptz default now()
);

create index if not exists idx_ad_views_user_date on public.ad_views(user_id, watched_at);

grant select, insert on public.ad_views to authenticated;
grant all on public.ad_views to service_role;

alter table public.ad_views enable row level security;

drop policy if exists "users read own ad_views" on public.ad_views;
create policy "users read own ad_views" on public.ad_views
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own ad_views" on public.ad_views;
create policy "users insert own ad_views" on public.ad_views
  for insert to authenticated with check (auth.uid() = user_id);

-- 4. WITHDRAWALS
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(12,2) not null,
  payment_method text not null,
  wallet_address text not null,
  status text default 'pending',
  admin_notes text,
  created_at timestamptz default now()
);

grant select, insert on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;

alter table public.withdrawals enable row level security;

drop policy if exists "users read own withdrawals" on public.withdrawals;
create policy "users read own withdrawals" on public.withdrawals
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own withdrawals" on public.withdrawals;
create policy "users insert own withdrawals" on public.withdrawals
  for insert to authenticated with check (auth.uid() = user_id);

-- 5. REFERRALS
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) on delete cascade not null,
  referred_id uuid references public.profiles(id) on delete cascade not null,
  commission_amount numeric(12,2) default 0,
  created_at timestamptz default now()
);

grant select, insert on public.referrals to authenticated;
grant all on public.referrals to service_role;

alter table public.referrals enable row level security;

drop policy if exists "users read own referrals" on public.referrals;
create policy "users read own referrals" on public.referrals
  for select to authenticated using (auth.uid() = referrer_id);

-- 6. SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_name text not null,
  multiplier integer default 1,
  price_usd numeric(12,2) not null,
  start_date timestamptz default now(),
  end_date timestamptz,
  is_active boolean default true
);

grant select, insert on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

drop policy if exists "users read own subscriptions" on public.subscriptions;
create policy "users read own subscriptions" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own subscriptions" on public.subscriptions;
create policy "users insert own subscriptions" on public.subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

-- 7. TASKS (investor uploads)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  task_url text not null,
  reward_points integer default 100,
  budget_usd numeric(12,2) not null,
  status text default 'pending',
  created_at timestamptz default now()
);

grant select, insert on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

drop policy if exists "anyone reads active tasks" on public.tasks;
create policy "anyone reads active tasks" on public.tasks
  for select to authenticated using (status = 'active' or investor_id = auth.uid());

drop policy if exists "users insert own tasks" on public.tasks;
create policy "users insert own tasks" on public.tasks
  for insert to authenticated with check (auth.uid() = investor_id);

-- Seed a few demo ads (safe to re-run)
insert into public.ads (title, description, ad_url, thumbnail_url, duration_seconds, reward_points)
select * from (values
  ('Crypto Wallet Promo', 'Learn about secure crypto storage', 'https://www.youtube.com/embed/dQw4w9WgXcQ', null, 30, 50),
  ('NFT Marketplace', 'Discover trending NFTs', 'https://www.youtube.com/embed/dQw4w9WgXcQ', null, 30, 50),
  ('DeFi Yield Farming', 'Maximize your returns', 'https://www.youtube.com/embed/dQw4w9WgXcQ', null, 45, 75),
  ('Trading Bot Demo', 'Automated trading explained', 'https://www.youtube.com/embed/dQw4w9WgXcQ', null, 30, 50),
  ('Web3 Game Trailer', 'Play to earn revolution', 'https://www.youtube.com/embed/dQw4w9WgXcQ', null, 30, 50)
) as v
where not exists (select 1 from public.ads limit 1);
-- ============================================================
-- 8. ADMIN POLICIES
-- A security-definer helper avoids recursive RLS lookups on profiles.
-- ============================================================
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- Admins can read & update everything
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins update all profiles" on public.profiles;
create policy "admins update all profiles" on public.profiles
  for update to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins read all withdrawals" on public.withdrawals;
create policy "admins read all withdrawals" on public.withdrawals
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins update withdrawals" on public.withdrawals;
create policy "admins update withdrawals" on public.withdrawals
  for update to authenticated using (public.is_admin(auth.uid()));

grant update on public.withdrawals to authenticated;

drop policy if exists "admins manage ads" on public.ads;
create policy "admins manage ads" on public.ads
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

grant insert, update, delete on public.ads to authenticated;

drop policy if exists "admins read all ad_views" on public.ad_views;
create policy "admins read all ad_views" on public.ad_views
  for select to authenticated using (public.is_admin(auth.uid()));
-- ============================================================
-- FRAUD DETECTION SYSTEM TABLES
-- ============================================================

-- 1. DEVICE FINGERPRINTS
create table if not exists public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ip_address inet,
  user_agent text,
  device_id text,
  browser text,
  os text,
  country text default 'PK',
  is_vpn boolean default false,
  risk_level text default 'low',
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  device_risk_score integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_device_fingerprints_user on public.device_fingerprints(user_id);
create index if not exists idx_device_fingerprints_ip on public.device_fingerprints(ip_address);

grant select, insert, update on public.device_fingerprints to authenticated;
grant all on public.device_fingerprints to service_role;

alter table public.device_fingerprints enable row level security;

drop policy if exists "users can view own devices" on public.device_fingerprints;
create policy "users can view own devices" on public.device_fingerprints
  for select to authenticated using (auth.uid() = user_id);

-- 2. TASK VERIFICATION LOGS
create table if not exists public.task_verification_logs (
  id uuid primary key default gen_random_uuid(),
  task_completion_id uuid references public.task_completions(id) on delete cascade not null,
  device_fingerprint_id uuid references public.device_fingerprints(id),
  task_type text not null,
  fraud_score integer default 0,
  device_check boolean default true,
  time_check boolean default true,
  behavioral_check boolean default true,
  ip_check boolean default true,
  duplicate_check boolean default true,
  verification_details jsonb,
  flagged_reason text,
  auto_approved boolean default false,
  requires_manual_review boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_verification_logs_task on public.task_verification_logs(task_completion_id);
create index if not exists idx_verification_logs_fraud_score on public.task_verification_logs(fraud_score);

grant select, insert on public.task_verification_logs to authenticated;
grant all on public.task_verification_logs to service_role;

alter table public.task_verification_logs enable row level security;

drop policy if exists "users can view own verification logs" on public.task_verification_logs;
create policy "users can view own verification logs" on public.task_verification_logs
  for select to authenticated using (
    exists (
      select 1 from public.task_completions tc
      where tc.id = task_completion_id and tc.user_id = auth.uid()
    )
  );

drop policy if exists "admin_can_view_all_verification_logs" on public.task_verification_logs;
create policy "admin_can_view_all_verification_logs" on public.task_verification_logs
  for select to authenticated using (public.is_admin(auth.uid()));

-- 3. FRAUD RULES
create table if not exists public.fraud_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text unique not null,
  task_type text,
  rule_type text not null,
  condition_json jsonb,
  risk_weight integer default 10,
  enabled boolean default true,
  description text,
  created_at timestamptz default now()
);

grant select on public.fraud_rules to authenticated;
grant all on public.fraud_rules to service_role;

insert into public.fraud_rules (rule_name, task_type, rule_type, condition_json, risk_weight, description)
values
  ('Same IP Multiple Users', 'all', 'device', '{"check": "ip_multiple_users"}', 30, 'Same IP from different accounts'),
  ('VPN/Proxy Detected', 'all', 'device', '{"check": "vpn_detected"}', 25, 'User using VPN or proxy'),
  ('Task Too Fast', 'all', 'time', '{"check": "completion_time", "threshold": 5}', 20, 'Task completed in less than 5 seconds'),
  ('Suspicious Device', 'all', 'device', '{"check": "new_device"}', 15, 'First time using this device'),
  ('Duplicate Completion', 'all', 'duplicate', '{"check": "same_user_same_task"}', 40, 'User already completed this task'),
  ('Bot-like Behavior', 'all', 'behavioral', '{"check": "rapid_submissions"}', 35, 'Multiple tasks submitted in short time'),
  ('High Risk Country', 'all', 'device', '{"check": "high_risk_country"}', 15, 'Task from high-risk geography')
on conflict (rule_name) do nothing;

-- 4. USER TASK HISTORY
create table if not exists public.user_task_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  completed_count integer default 1,
  last_completed timestamptz default now(),
  avg_time_seconds integer,
  device_changes integer default 0
);

create index if not exists idx_user_task_history on public.user_task_history(user_id, task_id);

grant select, insert, update on public.user_task_history to authenticated;
grant all on public.user_task_history to service_role;

alter table public.user_task_history enable row level security;

drop policy if exists "users can view own task history" on public.user_task_history;
create policy "users can view own task history" on public.user_task_history
  for select to authenticated using (auth.uid() = user_id);
-- ============================================================
-- FIX: admin insert/update on subscriptions was never granted.
-- This silently broke "Approve" in Plan Requests and now the
-- manual plan-change dropdown too. Run this once.
-- ============================================================
grant update on public.subscriptions to authenticated;

drop policy if exists "admins insert any subscription" on public.subscriptions;
create policy "admins insert any subscription" on public.subscriptions
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins update any subscription" on public.subscriptions;
create policy "admins update any subscription" on public.subscriptions
  for update to authenticated
  using (public.is_admin(auth.uid()));

-- ============================================================
-- FIX: task_completions never stored the actual points awarded
-- (only applied live to profiles.points/balance), so earning
-- history couldn't reconstruct historical task earnings accurately.
-- ============================================================
alter table public.task_completions
  add column if not exists points_awarded numeric;

-- ============================================================
-- EMAIL CONFIRMATION TRACKING
-- Profiles rows get created at signup time (before email
-- confirmation), so we need a separate flag + trigger that syncs
-- from auth.users.email_confirmed_at once the user actually
-- confirms. This lets the admin panel and referral counts
-- distinguish "signed up" from "signed up AND confirmed".
-- ============================================================

alter table public.profiles
  add column if not exists email_confirmed boolean not null default false;

-- Backfill existing users based on their current auth.users state.
update public.profiles p
set email_confirmed = true
from auth.users u
where p.id = u.id and u.email_confirmed_at is not null;

create or replace function public.sync_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null) then
    update public.profiles set email_confirmed = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute function public.sync_email_confirmed();
