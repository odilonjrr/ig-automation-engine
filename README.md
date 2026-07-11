# IG Automation Engine — Fase 1

Fundação do pipeline: schema Supabase multi-conta + conexão de contas via Meta OAuth
(com formulário de configuração de janela de postagem e "DNA visual" da marca).

## O que está pronto nesta fase

- ✅ Schema Supabase completo (`supabase/migrations/0001_init.sql` +
  `0002_sense_targets.sql`) — todas as tabelas do pipeline Sense → Think →
  Make → Ship, com RLS.
- ✅ Criptografia AES-256-GCM de access tokens (`src/lib/token-crypto.ts`).
- ✅ Fluxo OAuth Meta completo: `/api/auth/meta/start` → autoriza → `/api/auth/meta/callback`
  troca o code por token long-lived (60 dias), descobre todas as contas
  Instagram Business vinculadas às Páginas do usuário e salva cada uma
  (suporte nativo a multi-conta).
- ✅ Dashboard `/accounts`: lista contas, toggle pausar/ativar, botão "Conectar conta".
- ✅ `/accounts/[id]`: formulário completo — janela de postagem, fuso horário,
  cores, prompt-base de estilo visual, prompt de voz/tom, slides por drop,
  proporção da imagem, **hashtags monitoradas e keywords do YouTube**.
- ✅ **Sense (Fase 3)**: scanner de tendências YouTube (`chart=mostPopular` ou
  `search.list` por keyword) + Instagram hashtag search (`ig_hashtag_search`
  → `top_media`), normalização num formato único e cálculo de
  `engagement_score` direto no banco (coluna gerada).
  - Cron diário protegido por `CRON_SECRET` (`/api/cron/sense`, agendado em
    `vercel.json`)
  - Botão de trigger manual no dashboard (`/accounts/[id]/trends`)
  - Falha isolada por conta — uma conta com erro não derruba o scan das outras
- ✅ **Think (Fase 4)**: Claude gera caption + hooks + hashtags + prompts de
  slide em JSON estruturado (validado com zod), a partir do trend de maior
  `engagement_score` ainda não usado.
  - System prompt monta o "DNA visual" (base_style_prompt) + voz da marca
    (voice_prompt) do brand_profile, repetidos/reforçados em todo prompt de
    slide gerado — é isso que mantém o carrossel visualmente coerente.
  - Cria o `content_drop` (status `ready`) + as `slides` (com prompt, sem
    imagem ainda — isso é a Fase 5/Make).
  - Marca o trend como `used = true` ao consumir.
  - Cron diário (`/api/cron/think`, 30min depois do Sense) + trigger manual
    em `/accounts/[id]/drops`.
  - UI de detalhe do drop em `/accounts/[id]/drops/[dropId]` — mostra
    legenda, hooks alternativos, hashtags e cada prompt de slide.
- ✅ **Make (Fase 5)**: DALL-E 3 gera cada imagem a partir do prompt salvo na
  fase Think, com retry de até 3 tentativas por slide (retry_count e
  error_message já persistidos por slide, para auditoria/debug).
  - Upload automático pro bucket público `slides` no Supabase Storage
    (necessário: a Graph API do Instagram busca a imagem por URL pública
    ao publicar, não aceita upload binário direto).
  - Uma falha de slide não derruba os outros — cada um é isolado.
  - Drop só vira `ready` (pronto pra Ship) se **todos** os slides tiverem
    sucesso; se algum falhar após os retries, o drop vira `failed` — evita
    enfileirar um carrossel incompleto para publicação.
  - Cron diário (`/api/cron/make`, roda depois do Think) + botão
    "Gerar imagens" / "Tentar novamente" na página do drop, que já mostra
    as imagens geradas em grade.
- ✅ **Ship (Fase 6)**: publicação real via Meta Graph API, com fila e
  horário randomizado.
  - `enqueueReadyDrops`: pega drops `ready`, sorteia um horário dentro da
    janela de postagem da conta (timezone-aware via `date-fns-tz`) e insere
    na `publish_queue`. Se a janela de hoje já passou, agenda pra amanhã.
  - `publishDueQueueItems`: publica os itens vencidos — post simples
    (1 slide) ou carrossel (N slides, via child containers + container
    `CAROUSEL`), com até `max_attempts` tentativas por item e log completo
    em `publish_log` (sucesso e falha).
  - `/accounts/[id]/queue`: visão da fila — status, tentativas, horário
    agendado convertido pro fuso da conta.
  - **Cron duplo**: `ship-schedule` roda 1x/dia (agenda os posts do dia);
    `ship-publish` precisa rodar a cada poucos minutos pra respeitar o
    horário sorteado — veja a nota de limitação do Vercel abaixo.

## Setup

### 1. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

- `TOKEN_ENCRYPTION_KEY`: gere com `openssl rand -hex 32`
- `META_APP_ID` / `META_APP_SECRET`: do seu app em developers.facebook.com
- `META_REDIRECT_URI`: precisa bater exatamente com o configurado no app Meta
  (ex: `http://localhost:3000/api/auth/meta/callback` em dev)
- `SUPABASE_SERVICE_ROLE_KEY`: nunca exponha no client — só é usada em API routes
- `YOUTUBE_API_KEY`: console.cloud.google.com → ativar "YouTube Data API v3"
  → criar credencial de API key. Tier gratuito: 10.000 units/dia.
- `ANTHROPIC_API_KEY`: console.anthropic.com → API Keys. Usada na camada Think
  para os prompts de imagem por slide (Claude segura o DNA visual em muitos
  slides). Default `claude-sonnet-4-6`, configurável via `THINK_PROMPT_MODEL`.
  O texto (caption/hooks/hashtags) é escrito pelo GPT (`OPENAI_API_KEY`),
  default `gpt-4.1-mini`, configurável via `THINK_TEXT_MODEL` — exatamente a
  divisão de modelos do playbook.
- `OPENAI_API_KEY`: platform.openai.com → API Keys. Usada na camada Make
  quando o provider da conta é `dalle` (DALL-E 3). Billing ativo na conta.
- `FAL_KEY` (opcional): fal.ai → dashboard/keys. Usada quando o provider é
  `fal` (Flux via Fal.ai — barato/rápido, recomendação low-cost do playbook).
- `REPLICATE_API_TOKEN` (opcional): replicate.com → account/api-tokens. Usada
  quando o provider é `replicate` (Flux via Replicate).
  - O provider e o modelo são configuráveis **por conta** no formulário de
    brand profile (`image_provider` / `image_model` — migration `0004`).
- `CRON_SECRET`: qualquer string aleatória — a Vercel injeta automaticamente
  como `Authorization: Bearer $CRON_SECRET` nas chamadas de cron quando essa
  env var existe no projeto.

### 2. Banco de dados

Rode as migrations no seu projeto Supabase, em ordem (SQL Editor ou CLI):

```bash
supabase db push
# ou cole o conteúdo de 0001, 0002 e 0003 (nessa ordem) no SQL Editor
```

A migration `0003_storage_bucket.sql` cria o bucket público `slides` — é
onde as imagens geradas pelo DALL-E 3 ficam antes de serem publicadas.

### 3. App Meta

No developers.facebook.com, crie um app tipo **Business**, adicione o produto
**Instagram Graph API**, e configure o Redirect URI exatamente igual ao
`META_REDIRECT_URI`. Enquanto o App Review não é aprovado, você consegue
testar com sua própria conta em modo desenvolvedor (adicione-a como
Tester/Admin no app). O hashtag search exige o escopo
`instagram_business_content_publish` — já incluído no `buildMetaAuthUrl`.

⚠️ **Limite importante**: a API do Meta permite consultar no máximo **30
hashtags únicas a cada 7 dias** por IG User ID. Configure poucas hashtags
bem escolhidas por conta em vez de muitas genéricas.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000` → redireciona para `/accounts`.

Para testar o Sense manualmente sem esperar o cron: entre em qualquer conta
conectada → &quot;Tendências&quot; → &quot;Buscar tendências agora&quot;.

## Autenticação de usuário (Supabase Auth)

A autenticação usa **Supabase Auth** (e-mail/senha):

- `/login` — entrar ou criar conta (client component, `@supabase/ssr`).
- `src/middleware.ts` — renova a sessão em toda request e protege as rotas;
  não autenticado é redirecionado para `/login`. Rotas públicas: `/login`,
  `/auth/callback` e os crons (`/api/cron/*`, protegidos por `CRON_SECRET`).
- `/auth/callback` — troca o `code` (confirmação de e-mail) por sessão.
- `src/lib/supabase-server.ts` — `supabaseServer()` (sessão), `getSessionUser()`,
  `requireUser()` e helpers de ownership (`userOwnsAccount`, `userOwnsDrop`).
- O `owner_user_id` das contas vem de `getSessionUser()` no callback do Meta
  (`src/app/api/auth/meta/callback/route.ts`), e todo o dashboard/API é
  escopado por dono — batendo com as policies RLS (`auth.uid()`) do schema.

Por padrão o Supabase pede confirmação de e-mail no cadastro. Para testar mais
rápido em dev, desative "Confirm email" em Authentication → Providers → Email
no painel do Supabase (aí o cadastro já entra direto).

## Teste local do pipeline (dry-run, sem credenciais)

Dá para rodar o pipeline **Sense → Think → Make → Ship inteiro localmente**, sem
nenhuma chave de API e **sem publicar nada de verdade** no Instagram:

```bash
npm run test:pipeline
```

O harness (`scripts/pipeline-dryrun.ts`) liga `PIPELINE_DRY_RUN=1`, que faz cada
boundary externo curto-circuitar para um fake determinístico:

- **Banco**: Supabase em memória (`src/lib/dev/fake-supabase.ts`) — nada toca a rede.
- **Sense**: trends canned (YouTube/Instagram) em vez das APIs reais.
- **Think**: caption + prompts de slide gerados localmente (sem GPT/Claude), mas
  ainda injetando o DNA visual do `brand_profile` em cada prompt.
- **Make**: PNG placeholder por slide (sem DALL-E/Flux) e URL de Storage fake.
- **Ship**: containers e `media_publish` mockados (sem chamar a Meta Graph API).

Ele semeia 1 conta + `brand_profile`, roda as 4 camadas em sequência e imprime um
relatório de cada etapa (trend vencedor, slides, agendamento, `publish_log`),
terminando com o drop em `published`. Use `DRYRUN_SLIDES=1 npm run test:pipeline`
para exercitar o caminho de **post simples** em vez do de **carrossel**.

> O flag `PIPELINE_DRY_RUN` não tem efeito com ele desligado — os caminhos reais
> de produção ficam intactos. Ver `src/lib/dev/dry-run.ts`.

## ⚠️ Nota operacional importante: cron frequente para publicar

O `vercel.json` já agenda `/api/cron/ship-publish` a cada 10 minutos
(`*/10 * * * *`), mas **o Vercel Cron no plano Hobby só permite intervalo
mínimo de 1x/dia** — o cron frequente só funciona de verdade no plano Pro.

Alternativas gratuitas se você estiver no Hobby:
- **cron-job.org** (grátis): configure uma chamada GET a cada 5-10min pra
  `https://seudominio.vercel.app/api/cron/ship-publish` com o header
  `Authorization: Bearer <CRON_SECRET>`.
- **GitHub Actions** com `schedule:` no workflow, rodando `curl` pra mesma rota.

Sem isso, os posts ficam "presos" em `scheduled` até alguém chamar a rota
manualmente — o agendamento (horário sorteado) continua correto, só a
execução no horário certo depende desse cron externo.

## Próximas fases (ainda não implementadas)

- **Fase 7**: dashboard consolidado (visão geral de todas as contas, métricas
  de `publish_log`, alertas de token expirado/falhas recorrentes).
- **Fase 8 (opcional)**: automação comentário → DM via webhook nativo Meta
  (schema já preparado em `comment_automation`).

## Estrutura do projeto

```
src/
  app/
    accounts/                       → dashboard de contas
    accounts/[id]/                  → configurações + brand profile
    accounts/[id]/trends/           → tendências capturadas (Sense)
    accounts/[id]/drops/            → lista de conteúdo gerado (Think)
    accounts/[id]/drops/[dropId]/   → detalhe: caption, hooks, slides + imagens
    accounts/[id]/queue/            → fila de publicação (Ship)
    api/auth/meta/                  → fluxo OAuth
    api/accounts/[id]/              → toggle pausa, brand profile, run-sense,
                                       generate-drop (triggers manuais)
    api/drops/[dropId]/
      generate-images/              → trigger manual do Make (gerar/regerar)
    api/cron/sense/                 → cron diário do Sense
    api/cron/think/                 → cron diário do Think (30min após Sense)
    api/cron/make/                  → cron diário do Make (após Think)
    api/cron/ship-schedule/         → cron diário — enfileira drops prontos
    api/cron/ship-publish/          → cron frequente — publica itens vencidos
  components/
    AccountCard.tsx
    BrandProfileForm.tsx
    RunSenseButton.tsx
    GenerateDropButton.tsx
    GenerateImagesButton.tsx
  lib/
    supabase-server.ts              → cliente admin (service role)
    supabase-browser.ts             → cliente client-side
    token-crypto.ts                  → AES-256-GCM
    meta-graph.ts                    → OAuth + publish flow (Graph API, single + carrossel)
    storage.ts                       → upload de imagens pro Supabase Storage
    trends/
      youtube.ts                     → YouTube Data API v3
      instagram.ts                    → Instagram hashtag search
      run-sense.ts                     → orquestração por conta (Sense)
    think/
      generate-content.ts              → chamada Claude + validação JSON (zod)
      run-think.ts                      → orquestração por conta (Think)
    make/
      generate-image.ts                 → chamada DALL-E 3
      run-make.ts                        → orquestração por drop, com retry (Make)
    ship/
      schedule.ts                        → horário randomizado, timezone-aware
      run-enqueue.ts                      → enfileira drops prontos
      run-publish.ts                       → publica itens vencidos (single/carrossel)
supabase/
  migrations/
    0001_init.sql                    → schema completo (todas as fases)
    0002_sense_targets.sql           → hashtags/keywords por conta
    0003_storage_bucket.sql          → bucket público 'slides' + policies
vercel.json                          → agenda dos crons (sense 09:00, think 09:30,
                                        make 10:00, ship-schedule 10:30 UTC,
                                        ship-publish a cada 10min — ver nota Hobby/Pro)
```
