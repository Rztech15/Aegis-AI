-- Migration: add username system to an existing Aegis AI database
-- Run this in Supabase SQL Editor (safe to run even if some parts already exist)

alter table profiles add column if not exists username text;

create unique index if not exists idx_profiles_username on profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, new.raw_user_meta_data->>'display_name', lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$ language plpgsql security definer;
