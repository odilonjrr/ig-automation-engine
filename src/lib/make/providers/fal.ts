import { fetchImageBuffer } from './fetch-image'

/**
 * Flux via Fal.ai. Rápido e barato (~$0.002-0.02/imagem) — a recomendação
 * de baixo custo do playbook. Modelo default: fal-ai/flux/dev.
 *
 * Fal.ai aceita apenas presets de tamanho — mapeamos a proporção para o
 * enum mais próximo.
 */
function mapAspectRatioToImageSize(aspectRatio: string): string {
  switch (aspectRatio) {
    case '4:3':
      return 'landscape_4_3'
    case '4:5':
      return 'portrait_4_3' // aproximação; Fal não tem 4:5 nativo
    case '1:1':
    default:
      return 'square_hd'
  }
}

export async function generateWithFal(params: {
  prompt: string
  aspectRatio: string
  model?: string | null
}): Promise<Buffer> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY ausente no ambiente')

  const model = params.model || 'fal-ai/flux/dev'
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      image_size: mapAspectRatioToImageSize(params.aspectRatio),
      num_images: 1,
      enable_safety_checker: true,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Fal.ai retornou ${res.status}: ${detail.slice(0, 300)}`)
  }

  const json = (await res.json()) as { images?: Array<{ url?: string }> }
  const url = json.images?.[0]?.url
  if (!url) throw new Error('Fal.ai não retornou URL de imagem')

  return fetchImageBuffer(url)
}
