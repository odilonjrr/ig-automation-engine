import { generateWithDalle } from './providers/dalle'
import { generateWithFal } from './providers/fal'
import { generateWithReplicate } from './providers/replicate'
import { isDryRun, fakePngBuffer } from '@/lib/dev/dry-run'

/**
 * Make layer — geração de imagem, com provider configurável por conta.
 *
 *   - 'dalle'     → DALL-E 3 (OpenAI). Mais fiel ao prompt, mais caro.
 *   - 'fal'       → Flux via Fal.ai. Barato e rápido (recomendação low-cost).
 *   - 'replicate' → Flux via Replicate. Barato, catálogo grande de modelos.
 *
 * `model` é opcional; quando ausente, cada provider usa seu default.
 * Todos retornam um Buffer PNG pronto para upload no Storage.
 */
export type ImageProvider = 'dalle' | 'fal' | 'replicate'

export interface GenerateImageParams {
  prompt: string
  aspectRatio: string
  provider?: ImageProvider
  model?: string | null
}

export async function generateImage(params: GenerateImageParams): Promise<Buffer> {
  // Dry-run: PNG placeholder, sem chamar nenhum provedor pago.
  if (isDryRun()) return fakePngBuffer()

  const provider = params.provider ?? 'dalle'
  const args = { prompt: params.prompt, aspectRatio: params.aspectRatio, model: params.model }

  switch (provider) {
    case 'fal':
      return generateWithFal(args)
    case 'replicate':
      return generateWithReplicate(args)
    case 'dalle':
    default:
      return generateWithDalle(args)
  }
}
