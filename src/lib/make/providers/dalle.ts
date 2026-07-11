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

  const model = params.model?.trim() || 'dall-e-3'
  const size = mapAspectRatioToSize(params.aspectRatio)
  const base = { model, prompt: params.prompt, size, n: 1 as const }

  let response
  try {
    // dall-e-2/dall-e-3 aceitam response_format (pedimos b64_json direto,
    // sem round-trip por URL). gpt-image-1 rejeita esse parâmetro como
    // desconhecido — cai no catch e refaz sem ele.
    response = await client.images.generate({
      ...base,
      quality: 'standard',
      response_format: 'b64_json',
    })
  } catch (err: any) {
    if (!String(err?.message).includes("Unknown parameter: 'response_format'")) throw err
    response = await client.images.generate(base)
  }

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
