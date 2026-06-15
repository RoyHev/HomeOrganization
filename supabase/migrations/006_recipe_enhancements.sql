-- Recipe L1 categories, free-text type, source link, and images

alter table public.recipes
  add column l1 text check (l1 in ('desserts', 'starters', 'entrees')),
  add column recipe_type text,
  add column source_url text;

create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index recipe_images_recipe_idx on public.recipe_images(recipe_id);

alter table public.recipe_images enable row level security;

create policy "Members can manage recipe images"
  on public.recipe_images for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_images.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_images.recipe_id
        and r.household_id = public.get_user_household_id()
    )
  );

-- Storage bucket for uploaded recipe images
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "Household members can view recipe images"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "Household members can upload recipe images"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = public.get_user_household_id()::text
  );

create policy "Household members can delete recipe images"
  on storage.objects for delete
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = public.get_user_household_id()::text
  );
