-- Allow shopping list items that aren't tied to pantry or supply inventory
alter table public.shopping_list_items
  drop constraint shopping_list_items_l1_check;

alter table public.shopping_list_items
  add constraint shopping_list_items_l1_check
  check (l1 in ('pantry', 'supply', 'general'));
