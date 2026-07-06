-- ============================================================
-- CHANGE UID FORMAT: sequential (UID-10001) -> random alphanumeric
-- (UID-7K3M9X2A). Looks more established, doesn't reveal low user
-- counts. Run this once in Supabase SQL Editor.
-- ============================================================

-- Generates an 8-char unique code, avoiding visually-confusing
-- characters (0/O, 1/I) for readability when users read it aloud
-- to support or type it in manually.
create or replace function public.generate_unique_uid()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i integer;
  already_taken boolean;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.profiles where user_number = result) into already_taken;
    exit when not already_taken;
  end loop;
  return result;
end;
$$;

-- Convert the column from sequential bigint identity to random text.
alter table public.profiles alter column user_number drop identity if exists;
alter table public.profiles alter column user_number type text using user_number::text;
alter table public.profiles alter column user_number set default public.generate_unique_uid();

-- Regenerate IDs for all existing users so everyone gets the new format.
update public.profiles set user_number = public.generate_unique_uid();
