-- ============================================================
-- 0005 — Logo da marca (upload/armazenamento, sem composição
-- automática nos slides ainda — ver campo `logo_rules` para as
-- instruções textuais já existentes de como usá-la nos prompts).
-- ============================================================

alter table brand_profiles
  add column if not exists logo_url text;  -- Supabase Storage public URL
