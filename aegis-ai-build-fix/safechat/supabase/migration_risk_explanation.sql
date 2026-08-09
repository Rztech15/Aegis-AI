-- Migration: add actionable explanation + recommendation to risk warnings
-- for an existing Aegis AI database

alter table messages add column if not exists risk_explanation text;
alter table messages add column if not exists risk_recommendation text;
