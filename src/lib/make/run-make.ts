import { supabaseAdmin } from '@/lib/supabase-server'
import { generateImage, type ImageProvider } from './generate-image'
import { uploadSlideImage } from '@/lib/storage'

const MAX_RETRIES = 3

/**
 * Roda a geração de imagem para todos os slides pendentes/falhos de um drop.
 *   1. Marca o drop como 'generating_images'
 *   2. Para cada slide: gera via DALL-E 3, tenta até MAX_RETRIES vezes,
 *      salva o buffer no Supabase Storage e atualiza image_url/status
 *   3. Ao final: se todos os slides ficaram 'ok', marca o drop como 'ready'
 *      (pronto para a fase Ship). Se algum slide falhou mesmo após retries,
 *      marca o drop como 'failed' — evita enfileirar um carrossel incompleto.
 *
 * Cada slide é isolado: uma falha não impede os outros de serem gerados.
 */
export async function runMakeForDrop(dropId: string) {
  const db = supabaseAdmin()

  const { data: drop, error: dropErr } = await db
    .from('content_drops')
    .select('id, account_id')
    .eq('id', dropId)
    .single()

  if (dropErr || !drop) throw new Error('Drop não encontrado')

  const { data: brandProfile } = await db
    .from('brand_profiles')
    .select('aspect_ratio, image_provider, image_model')
    .eq('account_id', drop.account_id)
    .maybeSingle()

  const aspectRatio = brandProfile?.aspect_ratio ?? '1:1'
  const provider = (brandProfile?.image_provider ?? 'dalle') as ImageProvider
  const model = brandProfile?.image_model ?? null

  await db.from('content_drops').update({ status: 'generating_images' }).eq('id', dropId)

  const { data: slides, error: slidesErr } = await db
    .from('slides')
    .select('*')
    .eq('drop_id', dropId)
    .in('status', ['pending', 'failed'])
    .order('slide_order', { ascending: true })

  if (slidesErr) throw slidesErr

  let successCount = 0
  let failCount = 0

  for (const slide of slides ?? []) {
    await db.from('slides').update({ status: 'generating' }).eq('id', slide.id)

    let lastError: string | null = null
    let succeeded = false

    // Sempre recomeça do zero nesta chamada: slide.retry_count é o total
    // acumulado de tentativas passadas (para auditoria), não um limite que
    // deveria bloquear um novo clique manual em "Gerar Imagens" — usá-lo
    // como início do loop fazia um slide já esgotado (retry_count===MAX)
    // pular a tentativa inteira e voltar a 'failed' sem nem chamar a API.
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const buffer = await generateImage({ prompt: slide.prompt, aspectRatio, provider, model })
        const url = await uploadSlideImage({
          accountId: drop.account_id,
          dropId: drop.id,
          filename: slide.filename,
          imageBuffer: buffer,
        })

        await db
          .from('slides')
          .update({
            status: 'ok',
            image_url: url,
            retry_count: attempt + 1,
            error_message: null,
          })
          .eq('id', slide.id)

        succeeded = true
        break
      } catch (err: any) {
        lastError = err.message?.slice(0, 500) ?? 'erro desconhecido'
        await db
          .from('slides')
          .update({ retry_count: attempt + 1, error_message: lastError })
          .eq('id', slide.id)
      }
    }

    if (succeeded) {
      successCount++
    } else {
      failCount++
      await db
        .from('slides')
        .update({ status: 'failed', error_message: lastError })
        .eq('id', slide.id)
    }
  }

  const finalStatus = failCount === 0 ? 'ready' : 'failed'
  await db.from('content_drops').update({ status: finalStatus }).eq('id', dropId)

  return { successCount, failCount, status: finalStatus }
}
