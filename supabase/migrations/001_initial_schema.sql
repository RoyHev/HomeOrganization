-- Home Organizer initial schema

create extension if not exists "pgcrypto";

-- Households
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- Household members
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members(user_id);

-- Categories (L2 under L1 pantry/supply)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  l1 text not null check (l1 in ('pantry', 'supply')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, l1, name)
);

create index categories_household_l1_idx on public.categories(household_id, l1);

-- Inventory items (pantry + supply)
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  l1 text not null check (l1 in ('pantry', 'supply')),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'each',
  low_stock_threshold numeric,
  notes text,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_household_l1_idx on public.inventory_items(household_id, l1);

-- Shopping list
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  l1 text not null check (l1 in ('pantry', 'supply')),
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'each',
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index shopping_list_household_idx on public.shopping_list_items(household_id);

-- Recipes
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  servings int not null default 4,
  instructions text not null default '',
  prep_minutes int,
  cook_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'each',
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  sort_order int not null default 0
);

create table public.recipe_macros (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric
);

-- Activity log
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Helper: get current user's household id
create or replace function public.get_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1;
$$;

-- Seed default categories for a household
create or replace function public.seed_household_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pantry_cats text[] := array[
    'Produce', 'Dairy', 'Meat & Fish', 'Baking', 'Canned',
    'Spices', 'Frozen', 'Snacks', 'Beverages'
  ];
  supply_cats text[] := array[
    'Cleaning', 'Laundry', 'Bathroom', 'Paper Products',
    'Kitchen Supplies', 'Personal Care'
  ];
  cat text;
  i int;
begin
  i := 0;
  foreach cat in array pantry_cats loop
    insert into public.categories (household_id, l1, name, sort_order)
    values (p_household_id, 'pantry', cat, i)
    on conflict (household_id, l1, name) do nothing;
    i := i + 1;
  end loop;

  i := 0;
  foreach cat in array supply_cats loop
    insert into public.categories (household_id, l1, name, sort_order)
    values (p_household_id, 'supply', cat, i)
    on conflict (household_id, l1, name) do nothing;
    i := i + 1;
  end loop;
end;
$$;

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_macros enable row level security;
alter table public.activity_log enable row level security;

-- Households policies
create policy "Members can view their household"
  on public.households for select
  using (id = public.get_user_household_id());

create policy "Authenticated users can create households"
  on public.households for insert
  with check (auth.uid() is not null);

create policy "Owners can update household"
  on public.households for update
  using (
    id = public.get_user_household_id()
    and exists (
      select 1 from public.household_members
      where household_id = households.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- Allow joining by invite code lookup (only invite_code column exposed via function)
create or replace function public.lookup_household_by_invite(p_invite_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.households where invite_code = upper(trim(p_invite_code)) limit 1;
$$;

grant execute on function public.lookup_household_by_invite(text) to authenticated;

-- Household members policies
create policy "Members can view household members"
  on public.household_members for select
  using (household_id = public.get_user_household_id());

create policy "Users can join households"
  on public.household_members for insert
  with check (user_id = auth.uid());

create policy "Users can update own membership"
  on public.household_members for update
  using (user_id = auth.uid());

-- Categories policies
create policy "Members can manage categories"
  on public.categories for all
  using (household_id = public.get_user_household_id())
  with check (household_id = public.get_user_household_id());

-- Inventory policies
create policy "Members can manage inventory"
  on public.inventory_items for all
  using (household_id = public.get_user_household_id())
  with check (household_id = public.get_user_household_id());

-- Shopping list policies
create policy "Members can manage shopping list"
  on public.shopping_list_items for all
  using (household_id = public.get_user_household_id())
  with check (household_id = public.get_user_household_id());

-- Recipes policies
create policy "Members can manage recipes"
  on public.recipes for all
  using (household_id = public.get_user_household_id())
  with check (household_id = public.get_user_household_id());

create policy "Members can manage recipe ingredients"
  on public.recipe_ingredients for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  );

create policy "Members can manage recipe macros"
  on public.recipe_macros for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_macros.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_macros.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  );

-- Activity log policies
create policy "Members can view activity"
  on public.activity_log for select
  using (household_id = public.get_user_household_id());

create policy "Members can insert activity"
  on public.activity_log for insert
  with check (household_id = public.get_user_household_id());

-- Enable realtime
alter publication supabase_realtime add table public.inventory_items;
alter publication supabase_realtime add table public.shopping_list_items;
alter publication supabase_realtime add table public.recipes;

grant execute on function public.get_user_household_id() to authenticated;
grant execute on function public.seed_household_categories(uuid) to authenticated;
