import OpenAI from 'openai'

/**
 * DALL-E 3 (OpenAI). Só aceita 3 tamanhos fixos — mapeamos a proporção
 * configurada para o mais próximo. 4:5 vira o retrato 1024x1792 (mais alto
 * que 4:5 real; cropar na fase de assembly se a exatidão for crítica).
 * Melhor aderência a prompt, porém 5-100x mais caro que Flux.
 */
function mapAspectRatioToSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
  switch (aspectRatio) {
    case '4:3':
      return '1792x1024'
    case '4:5':
      return '1024x1792'
    case '1:1':
    default:
      return '1024x1024'
  }
}

export async function generateWithDalle(params: {
  prompt: string
  aspectRatio: string
  model?: string | null
}): Promise<Buffer> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.images.generate({
    model: params.model || 'dall-e-3',
    prompt: params.prompt,
    size: mapAspectRatioToSize(params.aspectRatio),
    quality: 'standard',
    response_format: 'b64_json',
    n: 1,
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('DALL-E 3 não retornou dados de imagem (b64_json ausente)')
  }
  return Buffer.from(b64, 'base64')
}
