import { fetchImageBuffer } from './fetch-image'

/**
 * Flux via Replicate. Catálogo grande de modelos; barato. Modelo default:
 * black-forest-labs/flux-dev. Usamos o header `Prefer: wait` para uma
 * chamada síncrona (sem polling manual do prediction).
 *
 * O flux-dev aceita aspect_ratio nativamente (inclui 1:1, 4:5, 4:3),
 * então repassamos a proporção direto.
 */
const SUPPORTED_RATIOS = new Set(['1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '4:3', '3:4', '9:16'])

export async function generateWithReplicate(params: {
  prompt: string
  aspectRatio: string
  model?: string | null
}): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN ausente no ambiente')

  const model = params.model || 'black-forest-labs/flux-dev'
  const aspect_ratio = SUPPORTED_RATIOS.has(params.aspectRatio) ? params.aspectRatio : '1:1'

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: params.prompt,
        aspect_ratio,
        output_format: 'png',
        num_outputs: 1,
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Replicate retornou ${res.status}: ${detail.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    status?: string
    error?: string
    output?: string | string[]
  }

  if (json.error) throw new Error(`Replicate: ${json.error}`)

  // output pode ser uma URL única ou um array de URLs
  const url = Array.isArray(json.output) ? json.output[0] : json.output
  if (!url) {
    throw new Error(`Replicate não retornou imagem (status: ${json.status ?? 'desconhecido'})`)
  }

  return fetchImageBuffer(url)
}
