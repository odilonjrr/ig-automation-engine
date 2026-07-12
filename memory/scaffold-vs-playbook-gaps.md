---
name: scaffold-vs-playbook-gaps
description: Where the existing scaffold diverges from the playbook spec
metadata:
  type: project
---

Diagnóstico scaffold atual × playbook (2026-07-10):

- **Auth (FEITO 2026-07-10)**: Supabase Auth plugado. `src/middleware.ts` protege rotas, `/login` + `/auth/callback`, `supabaseServer()`/`getSessionUser()`/`requireUser()` + helpers de ownership em `supabase-server.ts`. Callback do Meta usa a sessão real; dashboard/API escopados por `owner_user_id` (bate com RLS `auth.uid()`).
- **Make multi-provider (FEITO 2026-07-10)**: `src/lib/make/providers/` (dalle, fal, replicate) + dispatcher em `generate-image.ts`. Config por conta via `brand_profiles.image_provider`/`image_model` (migration `0004`), seletor no `BrandProfileForm`. Envs: `FAL_KEY`, `REPLICATE_API_TOKEN`.
- **Build**: 2 bugs pré-existentes corrigidos — `date-fns-tz` v3 (`fromZonedTime`) no Ship e guard no DALL-E. `tsc --noEmit` passa limpo.
- **Sense/seleção (FEITO 2026-07-10)**: score bate com o playbook (coluna gerada). Os filtros de **freshness 48h + threshold top ~20% + dedup 14 dias** foram implementados em `selectWinningTrend` no `run-think.ts` (constantes FRESHNESS_HOURS/DEDUP_DAYS/TOP_FRACTION).
- **Think (FEITO 2026-07-10)**: separado em 2 chamadas como o playbook — GPT (`THINK_TEXT_MODEL`, default `gpt-4.1-mini`, JSON mode) escreve caption/hooks/hashtags; Claude (`THINK_PROMPT_MODEL`, default `claude-sonnet-4-6`) escreve os prompts de slide a partir da história. Corrigido o model id inválido `claude-sonnet-5`.
- **Make**: só **DALL-E 3** (3 tamanhos fixos; 4:3 do playbook cai em 1792x1024, perda de fidelidade). Precisa de abstração de provedor p/ suportar Flux também (ver [[project-decisions]]).
- **Ship**: completo (single + carrossel, agendamento aleatório timezone-aware, publish_log).
- **Comment-to-DM (Fase 8) (FEITO 2026-07-11)**: webhook nativo Meta implementado em `src/app/api/webhooks/meta/route.ts` — GET (verificação `hub.challenge` via `META_WEBHOOK_VERIFY_TOKEN`) + POST (casa keyword de `comment_automation`, envia private reply via `sendPrivateReplyToComment` em `meta-graph.ts`, responde 200 rápido best-effort). Pendência conhecida: `require_follow` está persistido mas ainda não é verificado (exigiria chamada extra à Graph API).
- **Estado do build (2026-07-11)**: `tsc --noEmit` passa limpo. As 3 prioridades do backlog (auth, Make multi-provider, webhook) estão FEITAS.
- **Teste local dry-run (FEITO 2026-07-11)**: `npm run test:pipeline` roda Sense→Think→Make→Ship inteiro SEM credenciais e sem publicar. Flag `PIPELINE_DRY_RUN=1` faz cada boundary (DB, IA texto/imagem, Storage, Meta, fetch de trends, decryptToken) curto-circuitar para fake determinístico via guards `isDryRun()`. Peças: `src/lib/dev/dry-run.ts` (flag + holder do mock), `src/lib/dev/fake-supabase.ts` (Supabase em memória — query builder mínimo com embeds accounts/trends e engagement_score computado), `scripts/pipeline-dryrun.ts` (harness, semeia 1 conta+brand_profile, imprime relatório). Dep nova: `tsx`. `DRYRUN_SLIDES=1` testa post simples; default 3 = carrossel. Validado: ambos os caminhos terminam com drop `published`. Flag desligado = caminhos de produção intactos.
- **Deploy em produção (FEITO 2026-07-11)**: repo em github.com/odilonjrr/ig-automation-engine, deploy automático no Vercel (plano Hobby) em `ig-automation-engine.vercel.app`. Supabase, OpenAI, Anthropic, YouTube e Meta configurados nas env vars do Vercel. `ship-publish` NÃO está no `vercel.json` (Hobby só permite cron 1x/dia) — precisa de um cron externo (cron-job.org) chamando essa rota a cada poucos minutos; isso ainda não foi configurado.
- **Pipeline real ponta a ponta validado (FEITO 2026-07-12)**: Sense → Think → Make → Ship rodaram com sucesso contra APIs reais e publicaram um post de verdade no Instagram (`@jking.mkt`). Marco: primeiro ciclo 100% funcional em produção.
- **cron-job.org configurado (FEITO 2026-07-12)**: job `ship-publish` rodando a cada 5-10min, timeout aumentado pra 60s (publicar carrossel = várias chamadas sequenciais à Graph API, estourava o padrão de 30s). Rotas `ship-publish`, `generate-images` (manual e cron) ganharam `export const maxDuration = 60` no código — o padrão do Vercel (10s) não é suficiente pra chamadas sequenciais de API (N slides ou N containers de carrossel).
- **Bugs reais encontrados e corrigidos durante o teste em produção** (ver histórico de commits 2026-07-11 para detalhes técnicos):
  - OAuth do Meta pedia escopos do fluxo errado (`instagram_business_*` em vez de `instagram_basic` etc. — são dois fluxos de login diferentes).
  - Faltava o escopo `business_management`: sem ele, `/me/accounts` omite Páginas pertencentes a um Business Manager mesmo com o usuário tendo acesso total.
  - `expires_in` pode vir ausente na troca de long-lived token — `new Date(NaN)` derrubava o callback inteiro.
  - Formulário de hashtags só separava por vírgula; usuários digitam hashtags separadas por espaço (`#a #b #c`) — virava uma hashtag gigante inválida.
  - `top_media` do Instagram hashtag search falhava com erro genérico "reduce data" sem um `limit` explícito.
  - `engagement_score` explodia (valores tipo 1641) quando `like_count=0` (IG às vezes esconde a contagem) — o piso do reach-proxy era baixo demais.
  - Loop de retry do Make usava `slide.retry_count` salvo no banco como ponto de partida — um slide que já tinha esgotado tentativas numa rodada anterior nunca era tentado de novo num clique manual novo.
  - `dall-e-3` foi descontinuado na conta OpenAI do usuário ("model does not exist") — provider trocado para `gpt-image-1` como default, com tamanhos/qualidade próprios dessa família.
  - Prompt do Think tratava o título do trend (vídeo de terceiros, ex: "AULÃO META ADS 2026") como se fosse conteúdo da própria conta, gerando legendas incoerentes ("este aulão é sua arma secreta"). Prompt ajustado pra extrair o tema/insight em vez de descrever o vídeo literalmente.
- **Feature nova**: botão "Limpar tendências" na tela de tendências, pra descartar trends não usadas (ex: resultados genéricos capturados antes de configurar hashtags/keywords, que tinham score alto e afogavam os relevantes).
- **Ainda falta**: (1) acompanhar a qualidade do texto gerado ao longo de mais posts (o ajuste de prompt do Think foi validado só 1x); (2) considerar Fal.ai/Replicate se o custo do gpt-image-1 pesar (hoje só DALL-E/gpt-image-1 está configurado); (3) Fase 8 (comment-to-DM) segue implementada mas não testada em produção.
