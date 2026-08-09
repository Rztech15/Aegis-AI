-- Migration: add media_mime column so encrypted images can be decrypted
-- back to the correct file type on display

alter table messages add column if not exists media_mime text;
