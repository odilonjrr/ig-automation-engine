import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { z } from 'zod'
import { isDryRun } from '@/lib/dev/dry-run'

/**
 * Think layer — dois modelos, como no playbook:
 *   1. GPT (gpt-4.1-mini) escreve a legenda + hooks + hashtags em JSON,
 *      na voz da marca. Modelo barato — texto só precisa de estrutura
 *      consistente, o dinheiro é melhor gasto na geração de imagem.
 *   2. Claude escreve 1 prompt de imagem por slide, todos derivados do
 *      mesmo "DNA visual" (base_style_prompt) — é isso que mantém o
 *      carrossel consistente através de N chamadas stateless na fase Make.
 *      Claude segura um brief de estilo longo de forma confiável em muitos
 *      slides, onde modelos de contexto curto derrapam depois de 4-5.
 *
 * Ambas as saídas são JSON estruturado (não texto livre) para o pipeline
 * não depender de parsing frágil.
 */

// gpt-4.1-mini class para o texto; Claude Sonnet para os prompts (segura
// contexto longo). THINK_MODEL é aceito como fallback legado.
const TEXT_MODEL = process.env.THINK_TEXT_MODEL || 'gpt-4.1-mini'
const PROMPT_MODEL =
  process.env.THINK_PROMPT_MODEL || process.env.THINK_MODEL || 'claude-sonnet-4-6'

const storySchema = z.object({
  caption: z.string().min(1),
  hooks: z.array(z.string()).min(1).max(5),
  hashtags: z.array(z.string()).min(1).max(15),
})

const slideSchema = z.object({
  filename: z.string(),
  prompt: z.string().min(20),
})

const slidesSchema = z.object({
  slides: z.array(slideSchema).min(1).max(10),
})

const contentSchema = storySchema.merge(slidesSchema)

export type GeneratedContent = z.infer<typeof contentSchema>

export interface GenerateContentParams {
  trendTopic: string
  trendPlatform: string
  voicePrompt: string
  baseStylePrompt: string
  slidesPerDrop: number
  aspectRatio: string
  footerText?: string | null
  primaryColor: string
  backgroundColor: string
}

// ── Prompt de sistema do GPT (voz da marca) ──────────────────────────
function buildVoiceSystemPrompt(p: GenerateContentParams) {
  return `Você é o redator de uma conta de Instagram automatizada.

VOZ DA MARCA:
${p.voicePrompt}

CONTEXTO IMPORTANTE: o "trend" informado é o título de um vídeo/post de terceiros
que está em alta agora (geralmente um título chamativo de YouTube/Instagram — pode
ser o anúncio de uma aula, live, curso ou notícia específica que NÃO é sua e não
existe dentro desta conta). NUNCA trate o trend como algo que "está acontecendo
aqui" ou que você está promovendo/descrevendo literalmente (nada de "este aulão",
"essa live", "baixe o curso" etc.). Em vez disso, extraia o TEMA ou o INSIGHT por
trás do título e escreva um post ORIGINAL sobre esse tema, na voz da marca — como
se você tivesse tido essa ideia sozinho(a), não como cobertura de outro conteúdo.

TAREFA: escreva conteúdo para um carrossel de Instagram com pouco espaço de texto
por slide — seja direto e específico, evite clichês genéricos de marketing
("arma secreta", "sem erro", "transforme seu negócio"). Prefira um gancho concreto
(um número, uma contradição, um erro comum) a uma frase de efeito vazia.
1. "caption": legenda principal da publicação.
2. "hooks": até 5 aberturas alternativas (primeira linha da legenda).
3. "hashtags": lista de hashtags relevantes, SEM o caractere '#'.

Responda APENAS com um JSON válido no formato:
{"caption": "...", "hooks": ["...", "..."], "hashtags": ["...", "..."]}`
}

// ── Prompt de sistema do Claude (DNA visual) ─────────────────────────
function buildVisualDnaSystemPrompt(p: GenerateContentParams) {
  return `Você é o diretor de arte de uma conta de Instagram automatizada. Sua tarefa é escrever UM prompt de geração de imagem por slide de um carrossel.

DNA VISUAL (deve ser respeitado e repetido, com pequenas variações, em CADA prompt de slide — é isso que mantém o carrossel consistente):
${p.baseStylePrompt}
- Proporção obrigatória: ${p.aspectRatio} (declare a proporção na primeira linha de cada prompt)
- Cor de destaque: ${p.primaryColor}
- Cor de fundo: ${p.backgroundColor}
${p.footerText ? `- Rodapé em todo slide: ${p.footerText}` : ''}
- Nunca inclua watermarks, lorem ipsum, UI do Instagram ou texto com erro de ortografia.

Cada prompt conta uma parte da história: o slide 01 é o gancho (cover), o último é um fechamento/CTA suave (sem preço, sem "compre agora").

Responda APENAS com um JSON válido no formato:
{"slides": [{"filename": "01_cover.png", "prompt": "..."}, {"filename": "02_....png", "prompt": "..."}]}`
}

async function writeStory(params: GenerateContentParams): Promise<z.infer<typeof storySchema>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const resp = await client.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    messages: [
      { role: 'system', content: buildVoiceSystemPrompt(params) },
      {
        role: 'user',
        content: `Trend (${params.trendPlatform}): "${params.trendTopic}"\n\nGere caption, hooks e hashtags agora.`,
      },
    ],
  })

  const raw = resp.choices[0]?.message?.content
  if (!raw) throw new Error('GPT não retornou conteúdo de texto')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Falha ao parsear JSON do GPT: ${raw.slice(0, 300)}`)
  }

  const result = storySchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`JSON do GPT fora do schema: ${JSON.stringify(result.error.flatten())}`)
  }
  return result.data
}

async function writeSlidePrompts(
  params: GenerateContentParams,
  story: z.infer<typeof storySchema>
): Promise<z.infer<typeof slidesSchema>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: PROMPT_MODEL,
    max_tokens: 4000,
    system: buildVisualDnaSystemPrompt(params),
    messages: [
      {
        role: 'user',
        content: `História do post (do GPT):
Legenda: ${story.caption}
Ganchos: ${story.hooks.join(' | ')}

Gere EXATAMENTE ${params.slidesPerDrop} prompts de slide seguindo o DNA visual acima. Retorne apenas o JSON.`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude não retornou conteúdo de texto')
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Falha ao parsear JSON do Claude: ${cleaned.slice(0, 300)}`)
  }

  const result = slidesSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`JSON do Claude fora do schema: ${JSON.stringify(result.error.flatten())}`)
  }
  return result.data
}

export async function generateDropContent(
  params: GenerateContentParams
): Promise<GeneratedContent> {
  // Dry-run: conteúdo determinístico derivado dos params, sem chamar GPT/Claude.
  if (isDryRun()) return fakeDropContent(params)

  // 1. GPT escreve o texto; 2. Claude escreve os prompts a partir dele.
  const story = await writeStory(params)
  const { slides } = await writeSlidePrompts(params, story)
  return { ...story, slides }
}

// Conteúdo canned para o harness — respeita slidesPerDrop e injeta o DNA
// visual (base_style_prompt) em cada prompt, como o Claude faria de verdade.
function fakeDropContent(p: GenerateContentParams): GeneratedContent {
  const n = Math.max(1, p.slidesPerDrop)
  const slides = Array.from({ length: n }, (_, i) => {
    const order = String(i + 1).padStart(2, '0')
    const role = i === 0 ? 'cover' : i === n - 1 ? 'cta' : 'body'
    return {
      filename: `${order}_${role}.png`,
      prompt:
        `Proporção ${p.aspectRatio}. ${p.baseStylePrompt} ` +
        `Slide ${i + 1}/${n} sobre "${p.trendTopic}". ` +
        `Cor de destaque ${p.primaryColor}, fundo ${p.backgroundColor}.` +
        (p.footerText ? ` Rodapé: ${p.footerText}.` : ''),
    }
  })

  return {
    caption: `[DRY-RUN] ${p.trendTopic} — legenda gerada na voz da marca.`,
    hooks: [`Você viu isso sobre ${p.trendTopic}?`, `O que ninguém te contou sobre ${p.trendTopic}`],
    hashtags: ['dryrun', 'automacao', 'instagram'],
    slides,
  }
}
