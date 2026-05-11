create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'paying_user');

create table if not exists public.profiles (
  id text primary key,
  email text,
  role public.user_role not null default 'paying_user',
  subscription_status text not null default 'inactive',
  subscription_active boolean not null default false,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null check (type in ('image', 'video')),
  category_id uuid not null references public.categories(id),
  file_path text not null,
  file_url text,
  is_premium boolean not null default true,
  created_by text not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.content_items
add column if not exists file_url text;

update public.content_items
set file_url = file_path
where file_url is null;

create table if not exists public.favorites (
  user_id text not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create table if not exists public.stripe_customers (
  user_id text primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.request_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.is_admin(uid text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.has_active_subscription(uid text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and (p.subscription_active = true or p.role = 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.content_items enable row level security;
alter table public.favorites enable row level security;
alter table public.stripe_customers enable row level security;

create policy "profiles self read" on public.profiles
for select using (public.request_user_id() = id);

create policy "profiles self insert" on public.profiles
for insert with check (public.request_user_id() = id);

create policy "profiles self update" on public.profiles
for update using (public.request_user_id() = id)
with check (public.request_user_id() = id);

create policy "categories for authenticated" on public.categories
for select using (public.request_user_id() is not null);

create policy "content for active users" on public.content_items
for select using (public.has_active_subscription(public.request_user_id()));

create policy "content insert admin only" on public.content_items
for insert with check (public.is_admin(public.request_user_id()));

create policy "favorites own select" on public.favorites
for select using (public.request_user_id() = user_id);

create policy "favorites own insert" on public.favorites
for insert with check (public.request_user_id() = user_id);

create policy "favorites own delete" on public.favorites
for delete using (public.request_user_id() = user_id);

create policy "stripe customers admin only" on public.stripe_customers
for all using (public.is_admin(public.request_user_id()));

insert into public.categories (name, slug)
values
  ('Nytt', 'new'),
  ('Populärt', 'popular'),
  ('Premium', 'premium'),
  ('Video', 'video'),
  ('Bild', 'image')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public)
values ('premium-content', 'premium-content', false)
on conflict (id) do nothing;

create policy "storage read active users" on storage.objects
for select
using (
  bucket_id = 'premium-content'
  and public.has_active_subscription(public.request_user_id())
);

create policy "storage upload admin" on storage.objects
for insert
with check (
  bucket_id = 'premium-content'
  and public.is_admin(public.request_user_id())
);
