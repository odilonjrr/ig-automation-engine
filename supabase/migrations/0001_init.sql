-- ============================================================
-- IG Automation Engine — Schema inicial
-- Multi-conta, pipeline Sense -> Think -> Make -> Ship
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ------------------------------------------------------------
-- ACCOUNTS: contas Instagram conectadas via Meta OAuth
-- ------------------------------------------------------------
create table if not exists accounts (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null,                    -- dono no seu sistema de auth
  ig_user_id            text not null unique,              -- Instagram Business Account ID
  ig_username           text not null,
  fb_page_id            text not null,
  access_token_encrypted text not null,                    -- AES-256-GCM
  token_iv              text not null,                     -- IV usado na criptografia
  token_expires_at       timestamptz,
  is_active             boolean not null default true,     -- pausa por conta
  post_window_start      time not null default '07:00',
  post_window_end        time not null default '21:00',
  timezone              text not null default 'America/Sao_Paulo',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_accounts_owner on accounts(owner_user_id);
create index if not exists idx_accounts_active on accounts(is_active);

-- ------------------------------------------------------------
-- BRAND_PROFILES: "DNA visual" por conta — reutilizado em todo prompt
-- ------------------------------------------------------------
create table if not exists brand_profiles (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null unique references accounts(id) on delete cascade,
  name            text not null,
  primary_color   text not null default '#D97757',
  background_color text not null default '#FFFFFF',
  font_style      text not null default 'bold sans-serif',
  footer_text     text,
  logo_rules      text,
  base_style_prompt text not null,   -- bloco fixo prependado em todo prompt de imagem
  voice_prompt    text not null,     -- system prompt de tom/voz para legendas
  slides_per_drop  int not null default 6,
  aspect_ratio    text not null default '1:1',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_brand_profiles_account on brand_profiles(account_id);

-- ------------------------------------------------------------
-- TRENDS: tendências captadas (camada Sense)
-- ------------------------------------------------------------
create table if not exists trends (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  platform        text not null check (platform in ('instagram','youtube','twitter')),
  topic           text not null,
  source_url      text,
  likes           int default 0,
  comments        int default 0,
  shares          int default 0,
  reach           int default 1,
  engagement_score numeric generated always as (
    (likes*1 + comments*3 + shares*5)::numeric / greatest(reach,1)
  ) stored,
  raw_payload     jsonb,             -- resposta bruta da API, para auditoria
  captured_at      timestamptz not null default now(),
  used            boolean not null default false   -- já virou content_drop?
);

create index if not exists idx_trends_account_score on trends(account_id, engagement_score desc);
create index if not exists idx_trends_captured on trends(captured_at desc);

-- ------------------------------------------------------------
-- CONTENT_DROPS: um "drop" = trend selecionado + caption + prompts (camada Think)
-- ------------------------------------------------------------
create table if not exists content_drops (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  brand_profile_id uuid references brand_profiles(id),
  trend_id        uuid references trends(id),
  caption         text,
  hooks           jsonb,             -- array de hooks alternativos
  hashtags        jsonb,
  status          text not null default 'draft'
                    check (status in ('draft','generating_images','ready','queued','published','failed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_drops_account_status on content_drops(account_id, status);

-- ------------------------------------------------------------
-- SLIDES: imagens geradas por drop (camada Make)
-- ------------------------------------------------------------
create table if not exists slides (
  id              uuid primary key default gen_random_uuid(),
  drop_id         uuid not null references content_drops(id) on delete cascade,
  slide_order      int not null,
  filename        text not null,
  prompt          text not null,     -- prompt exato usado — auditoria
  image_url        text,             -- Supabase Storage public URL
  status          text not null default 'pending'
                    check (status in ('pending','generating','ok','failed')),
  retry_count      int not null default 0,
  error_message    text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_slides_drop on slides(drop_id, slide_order);

-- ------------------------------------------------------------
-- PUBLISH_QUEUE: fila de agendamento (camada Ship)
-- ------------------------------------------------------------
create table if not exists publish_queue (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  drop_id         uuid not null references content_drops(id) on delete cascade,
  scheduled_for    timestamptz not null,   -- horário randomizado dentro da janela
  status          text not null default 'scheduled'
                    check (status in ('scheduled','publishing','published','failed','cancelled')),
  attempts        int not null default 0,
  max_attempts     int not null default 3,
  created_at       timestamptz not null default now()
);

create index if not exists idx_queue_scheduled on publish_queue(status, scheduled_for);

-- ------------------------------------------------------------
-- PUBLISH_LOG: auditoria de cada tentativa de publicação
-- ------------------------------------------------------------
create table if not exists publish_log (
  id              uuid primary key default gen_random_uuid(),
  queue_id        uuid references publish_queue(id) on delete cascade,
  account_id      uuid not null references accounts(id),
  step            text not null,      -- 'create_container' | 'publish'
  response_code    int,
  creation_id      text,
  ig_media_id      text,
  error_message    text,
  logged_at        timestamptz not null default now()
);

create index if not exists idx_publish_log_queue on publish_log(queue_id);

-- ------------------------------------------------------------
-- COMMENT_AUTOMATION: regras de palavra-chave -> DM (fase 2, opcional)
-- ------------------------------------------------------------
create table if not exists comment_automation (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  keyword         text not null,
  dm_message      text not null,
  attachment_url   text,
  require_follow   boolean not null default false,
  is_active       boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists idx_comment_automation_account on comment_automation(account_id);

-- ------------------------------------------------------------
-- updated_at trigger genérico
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_accounts_updated before update on accounts
  for each row execute function set_updated_at();
create trigger trg_brand_profiles_updated before update on brand_profiles
  for each row execute function set_updated_at();
create trigger trg_drops_updated before update on content_drops
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS básico — cada owner só vê suas próprias contas e dados derivados
-- ------------------------------------------------------------
alter table accounts enable row level security;
alter table brand_profiles enable row level security;
alter table trends enable row level security;
alter table content_drops enable row level security;
alter table slides enable row level security;
alter table publish_queue enable row level security;
alter table publish_log enable row level security;
alter table comment_automation enable row level security;

create policy "owner_accounts" on accounts
  for all using (owner_user_id = auth.uid());

create policy "owner_brand_profiles" on brand_profiles
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));

create policy "owner_trends" on trends
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));

create policy "owner_drops" on content_drops
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));

create policy "owner_slides" on slides
  for all using (drop_id in (
    select cd.id from content_drops cd
    join accounts a on a.id = cd.account_id
    where a.owner_user_id = auth.uid()
  ));

create policy "owner_queue" on publish_queue
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));

create policy "owner_log" on publish_log
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));

create policy "owner_comment_automation" on comment_automation
  for all using (account_id in (select id from accounts where owner_user_id = auth.uid()));
