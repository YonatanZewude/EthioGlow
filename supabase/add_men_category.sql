insert into public.categories (name, slug)
values ('Men', 'men')
on conflict (slug) do update
set name = excluded.name;