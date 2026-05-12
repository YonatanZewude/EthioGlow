alter table public.content_items
add column if not exists show_on_landing boolean not null default false;

alter table public.content_items
add column if not exists landing_order integer;

create policy "landing content for public" on public.content_items
for select using (show_on_landing = true and type = 'image');

create policy "content update admin only" on public.content_items
for update using (public.is_admin(public.request_user_id()))
with check (public.is_admin(public.request_user_id()));

create policy "content delete admin only" on public.content_items
for delete using (public.is_admin(public.request_user_id()));

create policy "storage read landing images" on storage.objects
for select
using (
  bucket_id = 'premium-content'
  and exists (
    select 1
    from public.content_items ci
    where ci.file_path = name
      and ci.show_on_landing = true
      and ci.type = 'image'
  )
);

create policy "storage delete admin" on storage.objects
for delete
using (
  bucket_id = 'premium-content'
  and public.is_admin(public.request_user_id())
);