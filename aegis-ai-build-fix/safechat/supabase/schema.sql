-- Aegis AI database schema
-- Run this in the Supabase SQL Editor (or `supabase db push`)

-- ============ login_attempts ============
-- Tracks failed sign-in attempts for rate limiting. No RLS policies are
-- granted here on purpose — only the service role (used server-side in
-- /api/auth/login) can read or write this table, never the browser.
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz default now()
);

create index if not exists idx_login_attempts_email_time on login_attempts (email, created_at);

alter table login_attempts enable row level security;
-- Intentionally no policies: RLS with zero policies blocks all access
-- except the service role, which bypasses RLS entirely.

-- ============ profiles ============
-- Extends Supabase's built-in auth.users with app-specific fields
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  public_key text,
  created_at timestamptz default now()
);

create unique index if not exists idx_profiles_username on profiles (lower(username));

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- ============ conversations ============
-- MVP: 1-to-1 only, so exactly two participant ids
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid references profiles(id) on delete cascade not null,
  participant_two uuid references profiles(id) on delete cascade not null,
  risk_level text default 'low' check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  constraint distinct_participants check (participant_one <> participant_two)
);

create index if not exists idx_conversations_participants
  on conversations (participant_one, participant_two);

alter table conversations enable row level security;

create policy "Users can view their own conversations"
  on conversations for select
  using (auth.uid() = participant_one or auth.uid() = participant_two);

create policy "Users can create conversations they're part of"
  on conversations for insert
  with check (auth.uid() = participant_one or auth.uid() = participant_two);

-- ============ messages ============
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  content text not null,
  media_url text,
  media_mime text,
  encrypted boolean default false,
  iv text,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  risk_reasons jsonb,
  risk_explanation text,
  risk_recommendation text,
  sent_at timestamptz default now()
);

create index if not exists idx_messages_conversation on messages (conversation_id, sent_at);

alter table messages enable row level security;

create policy "Users can view messages in their conversations"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
    )
  );

create policy "Users can send messages in their conversations"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.participant_one = auth.uid() or c.participant_two = auth.uid())
    )
  );

create policy "Users can delete their own messages"
  on messages for delete using (auth.uid() = sender_id);

-- ============ trusted_contacts ============
create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  contact_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, contact_id)
);

alter table trusted_contacts enable row level security;

create policy "Users can view their own trusted contacts"
  on trusted_contacts for select using (auth.uid() = user_id);

create policy "Users can add trusted contacts"
  on trusted_contacts for insert with check (auth.uid() = user_id);

create policy "Users can remove trusted contacts"
  on trusted_contacts for delete using (auth.uid() = user_id);

-- ============ blocked_users ============
create table if not exists blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table blocked_users enable row level security;

create policy "Users can view their own block list"
  on blocked_users for select using (auth.uid() = blocker_id);

create policy "Users can block others"
  on blocked_users for insert with check (auth.uid() = blocker_id);

create policy "Users can unblock others"
  on blocked_users for delete using (auth.uid() = blocker_id);

-- ============ reports ============
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

create policy "Users can view their own reports"
  on reports for select using (auth.uid() = reporter_id);

create policy "Users can create reports"
  on reports for insert with check (auth.uid() = reporter_id);

-- ============ evidence_reports ============
-- Opt-in only — created explicitly by a user action, never automatically
create table if not exists evidence_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  conversation_id uuid references conversations(id) not null,
  message_ids uuid[] not null,
  status text default 'saved' check (status in ('saved', 'submitted')),
  created_at timestamptz default now()
);

alter table evidence_reports enable row level security;

create policy "Users can view their own evidence reports"
  on evidence_reports for select using (auth.uid() = user_id);

create policy "Users can create their own evidence reports"
  on evidence_reports for insert with check (auth.uid() = user_id);

-- ============ realtime ============
-- Enable realtime on messages so clients get live updates via Supabase Realtime
alter publication supabase_realtime add table messages;

-- ============ storage: message media ============
insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload message media"
  on storage.objects for insert
  with check (bucket_id = 'message-media' and auth.role() = 'authenticated');

create policy "Anyone can view message media"
  on storage.objects for select
  using (bucket_id = 'message-media');

-- ============ storage: profile avatars ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ============ auto-create profile on signup ============
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, new.raw_user_meta_data->>'display_name', lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
