-- Migration: add login rate limiting to an existing Aegis AI database

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
-- except the service role (used server-side only).
