import { supabaseAdmin } from '@/lib/supabase-server'

export const SLIDES_BUCKET = 'slides'

/**
 * Faz upload de uma imagem (buffer) para o bucket público `slides` e
 * retorna a URL pública — necessária porque a Graph API do Instagram
 * exige uma URL http(s) acessível publicamente (`image_url`), não aceita
 * upload de binário direto no create_media_container.
 */
export async function uploadSlideImage(params: {
  accountId: string
  dropId: string
  filename: string
  imageBuffer: Buffer
  contentType?: string
}): Promise<string> {
  const db = supabaseAdmin()
  const path = `${params.accountId}/${params.dropId}/${params.filename}`

  const { error } = await db.storage
    .from(SLIDES_BUCKET)
    .upload(path, params.imageBuffer, {
      contentType: params.contentType ?? 'image/png',
      upsert: true,
    })

  if (error) {
    throw new Error(`Falha ao subir imagem para Storage: ${error.message}`)
  }

  const { data } = db.storage.from(SLIDES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
