-- ============================================================
-- 0004 — Provedor de geração de imagem configurável por conta
-- (camada Make). Suporta DALL-E 3 (OpenAI), Flux via Fal.ai e
-- Flux via Replicate. O modelo específico é opcional; quando nulo,
-- cada provider usa seu default.
-- ============================================================

alter table brand_profiles
  add column if not exists image_provider text not null default 'dalle'
    check (image_provider in ('dalle', 'fal', 'replicate'));

alter table brand_profiles
  add column if not exists image_model text;  -- null => default do provider
