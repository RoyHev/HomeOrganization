-- Personal API tokens for Siri / iOS Shortcuts → shopping list

create table public.shortcut_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id)
);

create index shortcut_tokens_hash_idx on public.shortcut_tokens (token_hash);

alter table public.shortcut_tokens enable row level security;

create policy "Users can view own shortcut token row"
  on public.shortcut_tokens for select
  using (user_id = auth.uid());

-- Create or replace personal shortcut token; returns plain token once.
create or replace function public.create_shortcut_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_household_id uuid;
  v_token text;
  v_hash text;
begin
  v_household_id := public.get_user_household_id();
  if v_household_id is null then
    raise exception 'No household';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.shortcut_tokens (user_id, household_id, token_hash)
  values (auth.uid(), v_household_id, v_hash)
  on conflict (user_id) do update
    set household_id = excluded.household_id,
        token_hash = excluded.token_hash,
        created_at = now(),
        last_used_at = null;

  return v_token;
end;
$$;

create or replace function public.has_shortcut_token()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shortcut_tokens where user_id = auth.uid()
  );
$$;

create or replace function public.revoke_shortcut_token()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shortcut_tokens where user_id = auth.uid();
end;
$$;

grant execute on function public.create_shortcut_token() to authenticated;
grant execute on function public.has_shortcut_token() to authenticated;
grant execute on function public.revoke_shortcut_token() to authenticated;
