import { supabaseAdmin } from '@/lib/supabase-server'
import { generateDropContent } from './generate-content'

// Regras de filtragem do playbook (camada Sense → seleção do vencedor):
const FRESHNESS_HOURS = 48 // descarta trends com mais de 48h
const DEDUP_DAYS = 14 // pula tópicos já postados nos últimos 14 dias
const TOP_FRACTION = 0.2 // considera apenas os ~20% melhores do dia

/**
 * Seleciona o trend vencedor para a conta, aplicando as regras do playbook:
 *   - Freshness: só trends capturados nas últimas 48h.
 *   - Threshold: só os ~20% de maior engagement_score entram no páreo.
 *   - Dedup: pula tópicos já usados em drops dos últimos 14 dias.
 * Retorna o trend escolhido ou null (nada fresco/novo o suficiente hoje).
 */
async function selectWinningTrend(
  db: ReturnType<typeof supabaseAdmin>,
  accountId: string
) {
  const freshSince = new Date(Date.now() - FRESHNESS_HOURS * 3600 * 1000).toISOString()
  const dedupSince = new Date(Date.now() - DEDUP_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: candidates, error: candErr } = await db
    .from('trends')
    .select('*')
    .eq('account_id', accountId)
    .eq('used', false)
    .gte('captured_at', freshSince)
    .order('engagement_score', { ascending: false })
    .limit(100)
  if (candErr) throw candErr
  if (!candidates || candidates.length === 0) return null

  // Threshold: mantém apenas os top ~20% (no mínimo 1).
  const keep = Math.max(1, Math.ceil(candidates.length * TOP_FRACTION))
  const pool = candidates.slice(0, keep)

  // Dedup: tópicos de drops criados nos últimos 14 dias.
  const { data: recentDrops, error: dupErr } = await db
    .from('content_drops')
    .select('trends(topic)')
    .eq('account_id', accountId)
    .gte('created_at', dedupSince)
  if (dupErr) throw dupErr

  const recentTopics = new Set(
    (recentDrops ?? [])
      .map((d) => (d as any).trends?.topic as string | undefined)
      .filter(Boolean)
      .map((t) => t!.toLowerCase().trim())
  )

  return pool.find((c) => !recentTopics.has(c.topic.toLowerCase().trim())) ?? null
}

/**
 * Roda o pipeline Think para UMA conta:
 *   1. Seleciona o trend vencedor (freshness + threshold + dedup do playbook)
 *   2. Chama Claude com o brand_profile da conta
 *   3. Cria o content_drop (status 'draft' — ainda sem imagens, isso é a
 *      Fase 5/Make) e as linhas de `slides` com os prompts já definidos
 *   4. Marca o trend como usado
 *
 * Retorna o drop_id criado, ou null se não havia trend elegível.
 */
export async function runThinkForAccount(accountId: string): Promise<string | null> {
  const db = supabaseAdmin()

  const { data: brandProfile, error: bpErr } = await db
    .from('brand_profiles')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (bpErr) throw bpErr
  if (!brandProfile) {
    throw new Error('Conta sem brand_profile configurado — preencha em /accounts/[id] antes de gerar conteúdo.')
  }

  const trend = await selectWinningTrend(db, accountId)
  if (!trend) return null // nada fresco/novo o suficiente — rode o Sense ou aguarde

  const generated = await generateDropContent({
    trendTopic: trend.topic,
    trendPlatform: trend.platform,
    voicePrompt: brandProfile.voice_prompt,
    baseStylePrompt: brandProfile.base_style_prompt,
    slidesPerDrop: brandProfile.slides_per_drop,
    aspectRatio: brandProfile.aspect_ratio,
    footerText: brandProfile.footer_text,
    primaryColor: brandProfile.primary_color,
    backgroundColor: brandProfile.background_color,
  })

  const { data: drop, error: dropErr } = await db
    .from('content_drops')
    .insert({
      account_id: accountId,
      brand_profile_id: brandProfile.id,
      trend_id: trend.id,
      caption: generated.caption,
      hooks: generated.hooks,
      hashtags: generated.hashtags,
      status: 'draft', // legenda/prompts prontos — imagens ainda pendentes (fase Make)
    })
    .select('id')
    .single()

  if (dropErr) throw dropErr

  const slideRows = generated.slides.map((s, idx) => ({
    drop_id: drop.id,
    slide_order: idx + 1,
    filename: s.filename,
    prompt: s.prompt,
    status: 'pending' as const,
  }))

  const { error: slidesErr } = await db.from('slides').insert(slideRows)
  if (slidesErr) throw slidesErr

  await db.from('trends').update({ used: true }).eq('id', trend.id)

  return drop.id
}
