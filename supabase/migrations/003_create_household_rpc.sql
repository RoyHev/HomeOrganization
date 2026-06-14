-- Atomic household creation (avoids RLS chicken-and-egg on insert+returning)

create or replace function public.create_household(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.household_members where user_id = v_user_id) then
    raise exception 'Already in a household';
  end if;

  insert into public.households (name, invite_code)
  values (trim(p_name), upper(trim(p_invite_code)))
  returning id into v_household_id;

  select coalesce(
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1),
    'Member'
  )
  into v_display_name
  from auth.users u
  where u.id = v_user_id;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, v_user_id, 'owner', v_display_name);

  perform public.seed_household_categories(v_household_id);

  return v_household_id;
end;
$$;

grant execute on function public.create_household(text, text) to authenticated;
