-- Admin features: get household members with their auth email

create or replace function public.get_household_members_with_email()
returns table (
  id uuid,
  household_id uuid,
  user_id uuid,
  role text,
  display_name text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    hm.id,
    hm.household_id,
    hm.user_id,
    hm.role,
    hm.display_name,
    au.email,
    hm.created_at
  from public.household_members hm
  join auth.users au on au.id = hm.user_id
  where hm.household_id = public.get_user_household_id()
  order by hm.created_at asc;
$$;

grant execute on function public.get_household_members_with_email() to authenticated;

-- Allow owners to update member roles within their household
create or replace function public.update_member_role(p_member_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_caller_role text;
begin
  -- Get caller's household and role
  select household_id, role
  into v_household_id, v_caller_role
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if v_caller_role <> 'owner' then
    raise exception 'Only owners can change member roles';
  end if;

  if p_new_role not in ('owner', 'member') then
    raise exception 'Invalid role';
  end if;

  update public.household_members
  set role = p_new_role
  where id = p_member_id
    and household_id = v_household_id
    and user_id <> auth.uid();
end;
$$;

grant execute on function public.update_member_role(uuid, text) to authenticated;

-- Allow owners to remove members from their household
create or replace function public.remove_household_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_caller_role text;
begin
  select household_id, role
  into v_household_id, v_caller_role
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if v_caller_role <> 'owner' then
    raise exception 'Only owners can remove members';
  end if;

  delete from public.household_members
  where id = p_member_id
    and household_id = v_household_id
    and user_id <> auth.uid();
end;
$$;

grant execute on function public.remove_household_member(uuid) to authenticated;

-- Allow owners to regenerate the household invite code
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_caller_role text;
  v_new_code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  select household_id, role
  into v_household_id, v_caller_role
  from public.household_members
  where user_id = auth.uid()
  limit 1;

  if v_caller_role <> 'owner' then
    raise exception 'Only owners can regenerate invite codes';
  end if;

  v_new_code := '';
  for i in 1..6 loop
    v_new_code := v_new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;

  update public.households
  set invite_code = v_new_code
  where id = v_household_id;

  return v_new_code;
end;
$$;

grant execute on function public.regenerate_invite_code() to authenticated;
