-- Migration: add avatars, message delete permission to an existing Aegis AI database

alter table profiles add column if not exists avatar_url text;

drop policy if exists "Users can delete their own messages" on messages;
create policy "Users can delete their own messages"
  on messages for delete using (auth.uid() = sender_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
