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
