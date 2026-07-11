import { supabaseAdmin } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/token-crypto'
import {
  createMediaContainer,
  publishMediaContainer,
  createCarouselContainer,
  createCarouselChildItem,
} from '@/lib/meta-graph'

/**
 * Publica todos os itens da publish_queue com status 'scheduled' cujo
 * horário já chegou. Deve ser chamada com frequência (a cada poucos
 * minutos) por um cron externo — ver nota no README sobre limitação do
 * Vercel Cron no plano Hobby (mínimo 1x/dia).
 *
 * Fluxo por item:
 *   1 slide  -> create_media_container -> media_publish (post simples)
 *   N slides -> N child containers (is_carousel_item) -> container CAROUSEL
 *               com children -> media_publish
 *
 * Cada passo é logado em publish_log para auditoria. Respeita max_attempts
 * — depois de esgotar as tentativas, o item vai para 'failed' definitivo.
 */
export async function publishDueQueueItems() {
  const db = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: dueItems, error } = await db
    .from('publish_queue')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)

  if (error) throw error

  const results: Array<{ queueId: string; status: string; error?: string }> = []

  for (const item of dueItems ?? []) {
    if (item.attempts >= item.max_attempts) {
      await db.from('publish_queue').update({ status: 'failed' }).eq('id', item.id)
      results.push({ queueId: item.id, status: 'failed', error: 'max_attempts esgotado' })
      continue
    }

    await db
      .from('publish_queue')
      .update({ status: 'publishing', attempts: item.attempts + 1 })
      .eq('id', item.id)

    try {
      const publishedId = await publishOne(db, item)
      await db.from('publish_queue').update({ status: 'published' }).eq('id', item.id)
      await db.from('content_drops').update({ status: 'published' }).eq('id', item.drop_id)
      results.push({ queueId: item.id, status: 'published' })
      void publishedId // reservado para uso futuro (ex: iniciar automação de comentário->DM)
    } catch (err: any) {
      const willRetry = item.attempts + 1 < item.max_attempts
      await db
        .from('publish_queue')
        .update({ status: willRetry ? 'scheduled' : 'failed' })
        .eq('id', item.id)

      await db.from('publish_log').insert({
        queue_id: item.id,
        account_id: item.account_id,
        step: 'publish_failed',
        error_message: String(err.message).slice(0, 500),
      })

      if (!willRetry) {
        await db.from('content_drops').update({ status: 'failed' }).eq('id', item.drop_id)
      }

      results.push({ queueId: item.id, status: willRetry ? 'retry_scheduled' : 'failed', error: err.message })
    }
  }

  return results
}

async function publishOne(
  db: ReturnType<typeof supabaseAdmin>,
  item: { id: string; account_id: string; drop_id: string }
): Promise<string> {
  const { data: account, error: accErr } = await db
    .from('accounts')
    .select('ig_user_id, access_token_encrypted, token_iv')
    .eq('id', item.account_id)
    .single()
  if (accErr || !account) throw new Error('Conta não encontrada')

  const { data: drop, error: dropErr } = await db
    .from('content_drops')
    .select('caption')
    .eq('id', item.drop_id)
    .single()
  if (dropErr || !drop) throw new Error('Drop não encontrado')

  const { data: slides, error: slidesErr } = await db
    .from('slides')
    .select('*')
    .eq('drop_id', item.drop_id)
    .eq('status', 'ok')
    .order('slide_order', { ascending: true })
  if (slidesErr) throw slidesErr
  if (!slides || slides.length === 0) throw new Error('Nenhum slide pronto para publicar')

  const accessToken = decryptToken(account.access_token_encrypted, account.token_iv)
  const igUserId = account.ig_user_id
  const caption = drop.caption ?? ''

  async function log(step: string, payload: Record<string, unknown>) {
    await db.from('publish_log').insert({
      queue_id: item.id,
      account_id: item.account_id,
      step,
      ...payload,
    })
  }

  if (slides.length === 1) {
    // --- post simples ---
    const container = await createMediaContainer({
      igUserId,
      imageUrl: slides[0].image_url!,
      caption,
      accessToken,
    })
    await log('create_container', { response_code: 200, creation_id: container.id })

    const published = await publishMediaContainer({
      igUserId,
      creationId: container.id,
      accessToken,
    })
    await log('publish', { response_code: 200, ig_media_id: published.id })

    return published.id
  }

  // --- carrossel ---
  const childIds: string[] = []
  for (const slide of slides) {
    const child = await createCarouselChildItem({
      igUserId,
      imageUrl: slide.image_url!,
      accessToken,
    })
    childIds.push(child.id)
  }
  await log('create_container', { response_code: 200, creation_id: childIds.join(',') })

  const carouselContainer = await createCarouselContainer({
    igUserId,
    childCreationIds: childIds,
    caption,
    accessToken,
  })
  await log('create_container', { response_code: 200, creation_id: carouselContainer.id })

  const published = await publishMediaContainer({
    igUserId,
    creationId: carouselContainer.id,
    accessToken,
  })
  await log('publish', { response_code: 200, ig_media_id: published.id })

  return published.id
}
