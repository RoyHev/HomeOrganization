-- Platform admin: global management (users & households), visible only to allowlisted emails

create table public.platform_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Replace with your login email if different
insert into public.platform_admins (email)
values ('roy@themarketbeyond.com')
on conflict (email) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.platform_admins pa
    join auth.users u on lower(u.email) = lower(pa.email)
    where u.id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.platform_admin_generate_invite_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  v_code := '';
  for i in 1..6 loop
    v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public.platform_admin_list_households()
returns table (
  id uuid,
  name text,
  invite_code text,
  member_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  select
    h.id,
    h.name,
    h.invite_code,
    count(hm.id) as member_count,
    h.created_at
  from public.households h
  left join public.household_members hm on hm.household_id = h.id
  group by h.id
  order by h.created_at desc;
end;
$$;

grant execute on function public.platform_admin_list_households() to authenticated;

create or replace function public.platform_admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  household_id uuid,
  household_name text,
  role text,
  email_confirmed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'display_name', hm.display_name, split_part(u.email, '@', 1))::text,
    hm.household_id,
    h.name,
    hm.role,
    u.email_confirmed_at,
    u.created_at
  from auth.users u
  left join public.household_members hm on hm.user_id = u.id
  left join public.households h on h.id = hm.household_id
  order by u.created_at desc;
end;
$$;

grant execute on function public.platform_admin_list_users() to authenticated;

create or replace function public.platform_admin_create_household(
  p_name text,
  p_owner_email text
)
returns table (
  household_id uuid,
  invite_code text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_id uuid;
  v_household_id uuid;
  v_invite_code text;
  v_display_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Household name is required';
  end if;

  select u.id
  into v_owner_id
  from auth.users u
  where lower(u.email) = lower(trim(p_owner_email));

  if v_owner_id is null then
    raise exception 'No user found with email %', p_owner_email;
  end if;

  if exists (select 1 from public.household_members where user_id = v_owner_id) then
    raise exception 'User is already in a household';
  end if;

  v_invite_code := public.platform_admin_generate_invite_code();

  insert into public.households (name, invite_code)
  values (trim(p_name), v_invite_code)
  returning id into v_household_id;

  select coalesce(
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1),
    'Owner'
  )
  into v_display_name
  from auth.users u
  where u.id = v_owner_id;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, v_owner_id, 'owner', v_display_name);

  perform public.seed_household_categories(v_household_id);

  return query select v_household_id, v_invite_code;
end;
$$;

grant execute on function public.platform_admin_create_household(text, text) to authenticated;

create or replace function public.platform_admin_add_user_to_household(
  p_household_id uuid,
  p_email text,
  p_role text default 'member',
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_display_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden';
  end if;

  if p_role not in ('owner', 'member') then
    raise exception 'Invalid role';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'No user found with email %', p_email;
  end if;

  if exists (select 1 from public.household_members where user_id = v_user_id) then
    raise exception 'User is already in a household';
  end if;

  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'Household not found';
  end if;

  v_display_name := coalesce(
    nullif(trim(p_display_name), ''),
    (select u.raw_user_meta_data->>'display_name' from auth.users u where u.id = v_user_id),
    split_part(p_email, '@', 1),
    'Member'
  );

  insert into public.household_members (household_id, user_id, role, display_name)
  values (p_household_id, v_user_id, p_role, v_display_name)
  returning id into v_member_id;

  return v_member_id;
end;
$$;

grant execute on function public.platform_admin_add_user_to_household(uuid, text, text, text) to authenticated;
