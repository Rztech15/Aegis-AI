-- Migration: add end-to-end encryption support to an existing Aegis AI database
-- Existing messages remain readable (encrypted = false); only new messages
-- sent after this deploy will be encrypted.

alter table profiles add column if not exists public_key text;
alter table messages add column if not exists encrypted boolean default false;
alter table messages add column if not exists iv text;
