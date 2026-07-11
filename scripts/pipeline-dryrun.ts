/**
 * Harness de dry-run do pipeline Sense → Think → Make → Ship.
 *
 * Roda as QUATRO camadas em sequência contra um Supabase em memória e com
 * todos os boundaries externos (IA, Storage, Meta, fetch de trends) mockados —
 * ZERO credenciais, ZERO publicação real. Serve para validar a lógica de
 * orquestração (seleção do trend vencedor, injeção do DNA visual nos prompts,
 * single vs carrossel, agendamento) end-to-end localmente.
 *
 * Uso:  npm run test:pipeline
 */

// Liga o modo dry-run ANTES de qualquer coisa — os guards leem em runtime.
process.env.PIPELINE_DRY_RUN = '1'
// Chave dummy só para o run-sense entrar no branch do YouTube (o fetch é fake).
process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'dry-run'

import { randomUUID } from 'crypto'
import { createFakeSupabase } from '@/lib/dev/fake-supabase'
import { setMockDb } from '@/lib/dev/dry-run'
import { runSenseForAccount } from '@/lib/trends/run-sense'
import { runThinkForAccount } from '@/lib/think/run-think'
import { runMakeForDrop } from '@/lib/make/run-make'
import { enqueueReadyDrops } from '@/lib/ship/run-enqueue'
import { publishDueQueueItems } from '@/lib/ship/run-publish'

// ── cores/format helpers ────────────────────────────────────────────
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
}

function stage(n: number, title: string) {
  console.log('\n' + c.bold(c.cyan(`━━ ${n}. ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)))
}

// ── seed: 1 conta + brand_profile (sem trends — o Sense os cria) ────
const ACCOUNT_ID = randomUUID()
const BRAND_ID = randomUUID()

function seed() {
  const account = {
    id: ACCOUNT_ID,
    owner_user_id: randomUUID(),
    ig_user_id: '17841400000000000',
    ig_username: 'conta_dryrun',
    fb_page_id: '1000000000',
    access_token_encrypted: 'placeholder', // decryptToken é bypassado no dry-run
    token_iv: 'placeholder',
    is_active: true,
    post_window_start: '07:00',
    post_window_end: '21:00',
    timezone: 'America/Sao_Paulo',
  }

  const brandProfile = {
    id: BRAND_ID,
    account_id: ACCOUNT_ID,
    name: 'Marca Dry-Run',
    primary_color: '#D97757',
    background_color: '#FFFFFF',
    font_style: 'bold sans-serif',
    footer_text: '@conta_dryrun',
    logo_rules: null,
    base_style_prompt: 'Estilo editorial minimalista, alto contraste, tipografia bold.',
    voice_prompt: 'Tom direto, jornalístico, curioso, sem clickbait barato.',
    // slides_per_drop=1 exercita o caminho de post simples; >1, o de carrossel.
    // Override com DRYRUN_SLIDES=1 npm run test:pipeline
    slides_per_drop: Number(process.env.DRYRUN_SLIDES) || 3,
    aspect_ratio: '4:5',
    // config da camada Make (migration 0004)
    image_provider: 'fal',
    image_model: null,
    // alvos da camada Sense
    target_youtube_keywords: ['inteligência artificial'],
    target_hashtags: ['ia', 'tecnologia'],
    youtube_region_code: 'BR',
  }

  const db = createFakeSupabase({ accounts: [account], brand_profiles: [brandProfile] })
  setMockDb(db)
  return db
}

async function main() {
  console.log(c.bold('\n🧪 PIPELINE DRY-RUN — Sense → Think → Make → Ship (mock, sem publicar)\n'))
  const db = seed()
  const T = db.__tables

  // 1. SENSE ────────────────────────────────────────────────────────
  stage(1, 'SENSE — captar tendências')
  const senseCount = await runSenseForAccount({
    id: ACCOUNT_ID,
    ig_user_id: '17841400000000000',
    access_token_encrypted: 'placeholder',
    token_iv: 'placeholder',
  })
  console.log(`   ${c.green('✓')} ${senseCount} trends captados e persistidos`)
  const top = [...T.trends].sort((a, b) => b.engagement_score - a.engagement_score)[0]
  console.log(
    c.dim(`   top engagement_score=${top.engagement_score.toFixed(2)} · "${top.topic}"`)
  )

  // 2. THINK ─────────────────────────────────────────────────────────
  stage(2, 'THINK — selecionar vencedor + gerar caption/prompts')
  const dropId = await runThinkForAccount(ACCOUNT_ID)
  if (!dropId) {
    console.log(c.red('   ✗ Nenhum trend elegível — pipeline abortado.'))
    return
  }
  const drop = T.content_drops.find((d) => d.id === dropId)!
  const slides = T.slides.filter((s) => s.drop_id === dropId).sort((a, b) => a.slide_order - b.slide_order)
  console.log(`   ${c.green('✓')} drop ${c.dim(dropId.slice(0, 8))} criado — status="${drop.status}"`)
  console.log(c.dim(`   caption: ${drop.caption}`))
  console.log(c.dim(`   ${slides.length} slides (prompts com DNA visual injetado):`))
  for (const s of slides) console.log(c.dim(`     • ${s.filename}: ${s.prompt.slice(0, 70)}…`))
  const usedTrend = T.trends.find((t) => t.id === drop.trend_id)
  console.log(c.dim(`   trend vencedor marcado used=${usedTrend?.used} · "${usedTrend?.topic}"`))

  // 3. MAKE ──────────────────────────────────────────────────────────
  stage(3, 'MAKE — gerar imagens dos slides')
  const makeResult = await runMakeForDrop(dropId)
  console.log(
    `   ${c.green('✓')} ${makeResult.successCount} ok / ${makeResult.failCount} falhas — drop status="${makeResult.status}"`
  )
  for (const s of T.slides.filter((s) => s.drop_id === dropId)) {
    console.log(c.dim(`     • ${s.filename}: status=${s.status} url=${s.image_url}`))
  }

  // 4a. SHIP — enfileirar ────────────────────────────────────────────
  stage(4, 'SHIP — enfileirar drop pronto (horário aleatório na janela)')
  const enqueued = await enqueueReadyDrops()
  console.log(`   ${c.green('✓')} ${enqueued.length} drop(s) processado(s)`)
  const queueItem = T.publish_queue.find((q) => q.drop_id === dropId)
  if (!queueItem) {
    console.log(c.red('   ✗ Nada foi enfileirado.'))
    return
  }
  console.log(
    c.dim(`   agendado para ${queueItem.scheduled_for} (status=${queueItem.status}) · drop agora "${T.content_drops.find((d) => d.id === dropId)!.status}"`)
  )

  // 4b. SHIP — publicar (forçando o horário para o passado) ───────────
  stage(5, 'SHIP — publicar itens vencidos (Meta Graph mockado)')
  queueItem.scheduled_for = new Date(Date.now() - 60_000).toISOString() // vence agora
  const published = await publishDueQueueItems()
  for (const p of published) {
    const ok = p.status === 'published'
    console.log(`   ${ok ? c.green('✓') : c.red('✗')} queue ${c.dim(p.queueId.slice(0, 8))} → ${p.status}${p.error ? ' — ' + p.error : ''}`)
  }
  const finalDrop = T.content_drops.find((d) => d.id === dropId)!
  console.log(c.dim(`   drop status final="${finalDrop.status}"`))
  console.log(c.dim(`   publish_log: ${T.publish_log.length} passos registrados`))
  for (const log of T.publish_log) {
    console.log(c.dim(`     • ${log.step}${log.ig_media_id ? ' ig_media_id=' + log.ig_media_id : ''}${log.creation_id ? ' creation_id=' + log.creation_id : ''}`))
  }

  // ── resumo ────────────────────────────────────────────────────────
  const success = finalDrop.status === 'published'
  console.log(
    '\n' +
      (success
        ? c.bold(c.green('✅ PIPELINE COMPLETO — drop publicado (mock) de ponta a ponta.'))
        : c.bold(c.yellow(`⚠️  Pipeline terminou com drop status="${finalDrop.status}".`)))
  )
  console.log(
    c.dim(
      `   trends=${T.trends.length} drops=${T.content_drops.length} slides=${T.slides.length} fila=${T.publish_queue.length} logs=${T.publish_log.length}\n`
    )
  )
  process.exit(success ? 0 : 1)
}

main().catch((err) => {
  console.error('\n' + c.red('💥 Erro no harness:'), err)
  process.exit(1)
})
