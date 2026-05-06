-- ============================================================
-- Auto-create a profiles row whenever a new auth.users row
-- is inserted (i.e. on every sign-up).
-- ============================================================

create or replace function fn_create_profile_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop first in case it already exists from an earlier attempt
drop trigger if exists trg_create_profile_on_signup on auth.users;

create trigger trg_create_profile_on_signup
  after insert on auth.users
  for each row execute function fn_create_profile_on_signup();
