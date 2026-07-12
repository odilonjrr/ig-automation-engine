import OpenAI from 'openai'

/**
 * Geração de imagem via OpenAI. Default: gpt-image-1 (dall-e-3 foi
 * descontinuado nas contas OpenAI mais novas — "model does not exist").
 * Ainda aceitamos 'dall-e-3'/'dall-e-2' explicitamente via brand_profile.
 * Cada família tem tamanhos e parâmetro de qualidade diferentes.
 */
function isLegacyDalle(model: string): boolean {
  return model.startsWith('dall-e')
}

function mapAspectRatioToSize(
  aspectRatio: string,
  legacy: boolean
): '1024x1024' | '1792x1024' | '1024x1792' | '1536x1024' | '1024x1536' {
  if (legacy) {
    // dall-e-3: só 3 tamanhos fixos. 4:5 vira o retrato 1024x1792 (mais alto
    // que 4:5 real; cropar na fase de assembly se a exatidão for crítica).
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
  // gpt-image-1: 1024x1024, 1536x1024 (paisagem) ou 1024x1536 (retrato).
  switch (aspectRatio) {
    case '4:3':
      return '1536x1024'
    case '4:5':
      return '1024x1536'
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

  const model = params.model?.trim() || 'gpt-image-1'
  const legacy = isLegacyDalle(model)
  const size = mapAspectRatioToSize(params.aspectRatio, legacy)

  const response = await client.images.generate({
    model,
    prompt: params.prompt,
    size,
    n: 1,
    // dall-e-2/dall-e-3: 'standard'/'hd' + aceitam response_format (pedimos
    // b64_json direto, sem round-trip por URL).
    // gpt-image-1: 'low'/'medium'/'high'/'auto', sempre devolve b64_json e
    // rejeita response_format como parâmetro desconhecido.
    ...(legacy
      ? { quality: 'standard' as const, response_format: 'b64_json' as const }
      : { quality: 'high' as const }),
  })

  const first = response.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')

  // Fallback: se a API devolveu uma URL em vez de b64_json, baixa a imagem.
  if (first?.url) {
    const res = await fetch(first.url)
    if (!res.ok) throw new Error(`Falha ao baixar imagem da URL retornada: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  throw new Error(`${model} não retornou dados de imagem (nem b64_json nem url)`)
}
