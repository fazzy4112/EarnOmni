-- ============================================================
-- GROWTH ENGINE: SOCIAL DESIGNS — CAMPAIGN DATA
-- Adds a campaign_data jsonb column to social_designs so the
-- Social Media Design Engine can store structured design-prompt
-- data (platform size, prompt text, target keywords) alongside
-- the existing design_type/image_url/caption columns.
-- ============================================================

alter table public.social_designs
  add column if not exists campaign_data jsonb default '{}'::jsonb;
