-- Migration: add block/report + image sharing to an existing Aegis AI database
-- Run this in Supabase SQL Editor

create table if not exists blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table blocked_users enable row level security;

drop policy if exists "Users can view their own block list" on blocked_users;
create policy "Users can view their own block list"
  on blocked_users for select using (auth.uid() = blocker_id);

drop policy if exists "Users can block others" on blocked_users;
create policy "Users can block others"
  on blocked_users for insert with check (auth.uid() = blocker_id);

drop policy if exists "Users can unblock others" on blocked_users;
create policy "Users can unblock others"
  on blocked_users for delete using (auth.uid() = blocker_id);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) not null,
  reported_id uuid references profiles(id) not null,
  conversation_id uuid references conversations(id),
  reason text,
  evidence_message_ids uuid[],
  status text default 'submitted' check (status in ('submitted', 'reviewed')),
  created_at timestamptz default now()
);

alter table reports enable row level security;

drop policy if exists "Users can view their own reports" on reports;
create policy "Users can view their own reports"
  on reports for select using (auth.uid() = reporter_id);

drop policy if exists "Users can create reports" on reports;
create policy "Users can create reports"
  on reports for insert with check (auth.uid() = reporter_id);

insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload message media" on storage.objects;
create policy "Authenticated users can upload message media"
  on storage.objects for insert
  with check (bucket_id = 'message-media' and auth.role() = 'authenticated');

drop policy if exists "Anyone can view message media" on storage.objects;
create policy "Anyone can view message media"
  on storage.objects for select
  using (bucket_id = 'message-media');
