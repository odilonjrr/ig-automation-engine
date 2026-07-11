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
- **Ainda falta**: (1) preencher credenciais reais — `.env.local` está VAZIO e desatualizado vs `.env.example` (faltam FAL_KEY, REPLICATE_API_TOKEN, THINK_TEXT_MODEL/THINK_PROMPT_MODEL, META_WEBHOOK_VERIFY_TOKEN); (2) teste end-to-end com serviços REAIS (o dry-run cobre só a orquestração/lógica, não a integração real com as APIs); (3) `git init` (projeto ainda não é repo).
