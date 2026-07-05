-- ============================================================
-- MANUAL DEPOSIT VERIFICATION SYSTEM — run this in Supabase SQL Editor
-- Mirrors the existing plan-subscription request/approve flow:
-- user submits a tx hash, admin manually verifies on Binance, approves.
-- ============================================================

-- Reuse the existing (already-referenced-in-admin-UI) wallet address
-- column, adding it if it doesn't already exist live.
alter table public.platform_settings
  add column if not exists usdt_bep20_address text,
  add column if not exists min_deposit numeric(12,2) default 5;

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount_usd numeric(12,2) not null,
  tx_hash text not null,
  network text,
  status text not null default 'pending', -- pending | approved | rejected
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index if not exists idx_deposits_user on public.deposits(user_id);
create index if not exists idx_deposits_status on public.deposits(status);

grant select, insert on public.deposits to authenticated;
grant all on public.deposits to service_role;

alter table public.deposits enable row level security;

drop policy if exists "users read own deposits" on public.deposits;
create policy "users read own deposits" on public.deposits
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own deposits" on public.deposits;
create policy "users insert own deposits" on public.deposits
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "admins read all deposits" on public.deposits;
create policy "admins read all deposits" on public.deposits
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "admins update all deposits" on public.deposits;
create policy "admins update all deposits" on public.deposits
  for update to authenticated using (public.is_admin(auth.uid()));

-- Approve a deposit: credits deposit_balance, marks reviewed. Admin-only.
create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_deposit public.deposits%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized.';
  end if;

  select * into v_deposit from public.deposits where id = p_deposit_id for update;
  if v_deposit.id is null or v_deposit.status <> 'pending' then
    raise exception 'Deposit not found or already reviewed.';
  end if;

  update public.deposits set status = 'approved', reviewed_at = now() where id = p_deposit_id;
  update public.profiles set deposit_balance = deposit_balance + v_deposit.amount_usd where id = v_deposit.user_id;
end;
$$;

grant execute on function public.admin_approve_deposit(uuid) to authenticated;

create or replace function public.admin_reject_deposit(p_deposit_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized.';
  end if;
  update public.deposits
    set status = 'rejected', reviewed_at = now(), admin_note = p_note
    where id = p_deposit_id and status = 'pending';
end;
$$;

grant execute on function public.admin_reject_deposit(uuid, text) to authenticated;
