-- ============================================================
-- $1 GAME SYSTEM — run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/foofdltskckbrmihisll/sql
-- Safe to re-run (idempotent).
-- ============================================================

-- 1. Deposit balance — SEPARATE from earnings `balance`.
--    Game entries can only be paid from this, never from earnings.
--    (Stays at 0 for everyone until the real deposit/payment-gateway
--    system is built. Until then, use the admin "test credit" tool below.)
alter table public.profiles
  add column if not exists deposit_balance numeric(12,2) default 0;

-- 2. GAME ROUNDS
create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number bigint generated always as identity,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'open', -- open | completed | cancelled
  entry_fee numeric(12,2) not null default 1,
  prize_amount numeric(12,2) not null default 100,
  total_entries integer not null default 0,
  total_revenue numeric(12,2) not null default 0,
  winner_user_id uuid references public.profiles(id),
  winning_entry_id uuid,
  drawn_at timestamptz,
  created_at timestamptz default now()
);

grant select on public.game_rounds to authenticated, anon;
grant all on public.game_rounds to service_role;

alter table public.game_rounds enable row level security;

drop policy if exists "anyone reads game rounds" on public.game_rounds;
create policy "anyone reads game rounds" on public.game_rounds
  for select using (true);

-- 3. GAME ENTRIES
-- One row = one raffle ticket. A premium multiplier (e.g. Gold = 4x)
-- materializes as multiple rows for that single $1 payment, so every
-- ticket has an exactly equal chance and the whole thing stays
-- auditable by just counting rows — no hidden weighting math.
create table if not exists public.game_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.game_rounds(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entry_number bigint generated always as identity,
  created_at timestamptz default now()
);

create index if not exists idx_game_entries_round on public.game_entries(round_id);
create index if not exists idx_game_entries_user on public.game_entries(user_id);

grant select on public.game_entries to authenticated;
grant all on public.game_entries to service_role;

alter table public.game_entries enable row level security;

drop policy if exists "users read own entries" on public.game_entries;
create policy "users read own entries" on public.game_entries
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "admins read all entries" on public.game_entries;
create policy "admins read all entries" on public.game_entries
  for select to authenticated using (public.is_admin(auth.uid()));

alter table public.game_rounds
  add constraint game_rounds_winning_entry_fkey
  foreign key (winning_entry_id) references public.game_entries(id)
  on delete set null;

-- 4. Ensure there's always exactly one open round.
create or replace function public.ensure_open_game_round()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_rounds where status = 'open') then
    insert into public.game_rounds (starts_at, ends_at)
    values (now(), now() + interval '14 days');
  end if;
end;
$$;

grant execute on function public.ensure_open_game_round() to service_role;

-- 5. ENTER GAME — deducts $1 from deposit_balance, creates N tickets
-- based on the user's active subscription multiplier (default 1x).
create or replace function public.enter_game_round()
returns table(entries_created integer, round_id uuid) language plpgsql security definer set search_path = public as $$
declare
  v_round public.game_rounds%rowtype;
  v_multiplier integer := 1;
  v_fee numeric(12,2);
  i integer;
begin
  perform public.ensure_open_game_round();

  select * into v_round from public.game_rounds
    where status = 'open' and ends_at > now()
    order by starts_at desc limit 1
    for update;

  if v_round.id is null then
    raise exception 'No open round available right now.';
  end if;

  v_fee := v_round.entry_fee;

  -- Lock the user's profile row to make the balance check+deduct atomic.
  perform 1 from public.profiles where id = auth.uid() for update;

  if (select deposit_balance from public.profiles where id = auth.uid()) < v_fee then
    raise exception 'Insufficient deposit balance. Please deposit funds first.';
  end if;

  update public.profiles set deposit_balance = deposit_balance - v_fee where id = auth.uid();

  select coalesce(max(s.multiplier), 1) into v_multiplier
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.is_active = true
      and (s.end_date is null or s.end_date > now());

  for i in 1..v_multiplier loop
    insert into public.game_entries (round_id, user_id) values (v_round.id, auth.uid());
  end loop;

  update public.game_rounds
    set total_entries = total_entries + v_multiplier,
        total_revenue = total_revenue + v_fee
    where id = v_round.id;

  return query select v_multiplier, v_round.id;
end;
$$;

grant execute on function public.enter_game_round() to authenticated;

-- 6. DRAW A ROUND — picks one random ticket, pays the winner, opens
-- the next round. Only callable by service_role (the scheduled job),
-- never by regular users, so the draw can't be manipulated client-side.
create or replace function public.draw_game_round(p_round_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_round public.game_rounds%rowtype;
  v_winning_entry public.game_entries%rowtype;
begin
  select * into v_round from public.game_rounds where id = p_round_id for update;

  if v_round.id is null or v_round.status <> 'open' then
    return; -- already drawn or doesn't exist
  end if;

  if v_round.ends_at > now() then
    raise exception 'Round has not ended yet.';
  end if;

  select * into v_winning_entry from public.game_entries
    where round_id = p_round_id
    order by random()
    limit 1;

  if v_winning_entry.id is null then
    -- No entries this round — nothing to draw, just close it out.
    update public.game_rounds set status = 'cancelled', drawn_at = now() where id = p_round_id;
  else
    update public.game_rounds
      set status = 'completed',
          winner_user_id = v_winning_entry.user_id,
          winning_entry_id = v_winning_entry.id,
          drawn_at = now()
      where id = p_round_id;

    -- Prize goes to the winner's normal earnings balance (withdrawable).
    update public.profiles
      set balance = balance + v_round.prize_amount
      where id = v_winning_entry.user_id;
  end if;

  perform public.ensure_open_game_round();
end;
$$;

grant execute on function public.draw_game_round(uuid) to service_role;

-- 7. Find any round whose time is up and draw it. Call this on a
-- schedule (see pg_cron setup below).
create or replace function public.process_due_game_rounds()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select id from public.game_rounds where status = 'open' and ends_at <= now() loop
    perform public.draw_game_round(r.id);
  end loop;
  perform public.ensure_open_game_round();
end;
$$;

grant execute on function public.process_due_game_rounds() to service_role, postgres;

-- 8. Schedule it — runs every 5 minutes. Requires the pg_cron
-- extension (enable it once under Database > Extensions in the
-- Supabase dashboard if this errors).
select cron.schedule(
  'process-due-game-rounds',
  '*/5 * * * *',
  $$select public.process_due_game_rounds();$$
) where not exists (
  select 1 from cron.job where jobname = 'process-due-game-rounds'
);

-- 9. Kick off the very first round if none exists yet.
select public.ensure_open_game_round();

-- 10. TEMPORARY testing tool: admin-only function to credit a
-- user's deposit_balance directly, until the real deposit/payment
-- gateway system is built. Remove once deposits are live.
create or replace function public.admin_credit_deposit_balance(p_user_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized.';
  end if;
  update public.profiles set deposit_balance = deposit_balance + p_amount where id = p_user_id;
end;
$$;

grant execute on function public.admin_credit_deposit_balance(uuid, numeric) to authenticated;

-- ============================================================
-- 11. WINNER NOTIFICATIONS — track whether the winner has seen
-- their own personal "you won!" popup yet (shown once).
-- ============================================================
alter table public.game_rounds
  add column if not exists winner_seen boolean not null default false;

-- ============================================================
-- 12. UNIQUE USER ID + AVATAR SUPPORT
-- ============================================================

-- Human-friendly unique ID number, auto-assigned on signup.
-- Starts at 10001 so IDs always look like a clean 5-digit number.
alter table public.profiles
  add column if not exists user_number bigint generated always as identity (start with 10001);

-- Profile picture — either an uploaded photo (Storage public URL) or
-- one of the default preset avatars ('/avatars/male.svg' etc.)
alter table public.profiles
  add column if not exists avatar_url text;

-- Storage bucket for uploaded profile photos (public read so avatars
-- display without extra auth, but only the owner can upload/replace
-- their own file).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 13. GAME ON/OFF SWITCH — admin controls when the $1 Game goes
-- live (e.g. wait until there are enough users for good odds).
-- ============================================================
alter table public.platform_settings
  add column if not exists game_enabled boolean not null default false;

-- Clean slate: remove test rounds/entries from development testing.
-- Balances are untouched — only game_rounds/game_entries are cleared.
delete from public.game_entries;
delete from public.game_rounds;

-- Round creation now respects the on/off switch — no round exists
-- (and the page shows "Starting Soon") until admin turns it on.
create or replace function public.ensure_open_game_round()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
begin
  select game_enabled into v_enabled from public.platform_settings where id = 1;
  if not coalesce(v_enabled, false) then
    return;
  end if;
  if not exists (select 1 from public.game_rounds where status = 'open') then
    insert into public.game_rounds (starts_at, ends_at)
    values (now(), now() + interval '14 days');
  end if;
end;
$$;

create or replace function public.enter_game_round()
returns table(entries_created integer, round_id uuid) language plpgsql security definer set search_path = public as $$
declare
  v_round public.game_rounds%rowtype;
  v_multiplier integer := 1;
  v_fee numeric(12,2);
  v_enabled boolean;
  i integer;
begin
  select game_enabled into v_enabled from public.platform_settings where id = 1;
  if not coalesce(v_enabled, false) then
    raise exception 'The $1 Game is not live yet. Check back soon!';
  end if;

  perform public.ensure_open_game_round();

  select * into v_round from public.game_rounds
    where status = 'open' and ends_at > now()
    order by starts_at desc limit 1
    for update;

  if v_round.id is null then
    raise exception 'No open round available right now.';
  end if;

  v_fee := v_round.entry_fee;

  perform 1 from public.profiles where id = auth.uid() for update;

  if (select deposit_balance from public.profiles where id = auth.uid()) < v_fee then
    raise exception 'Insufficient deposit balance. Please deposit funds first.';
  end if;

  update public.profiles set deposit_balance = deposit_balance - v_fee where id = auth.uid();

  select coalesce(max(s.multiplier), 1) into v_multiplier
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.is_active = true
      and (s.end_date is null or s.end_date > now());

  for i in 1..v_multiplier loop
    insert into public.game_entries (round_id, user_id) values (v_round.id, auth.uid());
  end loop;

  update public.game_rounds
    set total_entries = total_entries + v_multiplier,
        total_revenue = total_revenue + v_fee
    where id = v_round.id;

  return query select v_multiplier, v_round.id;
end;
$$;

-- Admin toggle for the game switch.
create or replace function public.admin_set_game_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized.';
  end if;
  update public.platform_settings set game_enabled = p_enabled where id = 1;
  if p_enabled then
    perform public.ensure_open_game_round();
  end if;
end;
$$;

grant execute on function public.admin_set_game_enabled(boolean) to authenticated;
