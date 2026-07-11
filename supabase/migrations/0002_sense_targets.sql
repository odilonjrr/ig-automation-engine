-- ============================================================
-- Fase 3 (Sense) — alvos de busca por conta
-- ============================================================

alter table brand_profiles
  add column if not exists target_hashtags jsonb not null default '[]'::jsonb,
  add column if not exists target_youtube_keywords jsonb not null default '[]'::jsonb,
  add column if not exists youtube_region_code text not null default 'BR';

comment on column brand_profiles.target_hashtags is
  'Hashtags (sem #) monitoradas no Instagram hashtag search. Limite da API: 30 únicas/7 dias por IG User ID.';
comment on column brand_profiles.target_youtube_keywords is
  'Palavras-chave usadas no YouTube search.list (busca direcionada, mais cara em quota que chart=mostPopular).';

-- Guarda o último resultado do scan, útil para debug/UI sem precisar
-- reconsultar a tabela trends inteira.
alter table accounts
  add column if not exists last_sense_run_at timestamptz,
  add column if not exists last_sense_status text;
