-- Migration: add trusted contacts to an existing Aegis AI database

create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  contact_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, contact_id)
);

alter table trusted_contacts enable row level security;

drop policy if exists "Users can view their own trusted contacts" on trusted_contacts;
create policy "Users can view their own trusted contacts"
  on trusted_contacts for select using (auth.uid() = user_id);

drop policy if exists "Users can add trusted contacts" on trusted_contacts;
create policy "Users can add trusted contacts"
  on trusted_contacts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove trusted contacts" on trusted_contacts;
create policy "Users can remove trusted contacts"
  on trusted_contacts for delete using (auth.uid() = user_id);
