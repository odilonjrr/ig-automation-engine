'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  accountId: string
  account: {
    post_window_start: string
    post_window_end: string
    timezone: string
  }
  existingProfile: {
    id?: string
    name?: string
    primary_color?: string
    background_color?: string
    footer_text?: string
    base_style_prompt?: string
    voice_prompt?: string
    slides_per_drop?: number
    aspect_ratio?: string
    image_provider?: string
    image_model?: string | null
    target_hashtags?: string[]
    target_youtube_keywords?: string[]
    youtube_region_code?: string
  } | null
}

export default function BrandProfileForm({ accountId, account, existingProfile }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    post_window_start: account.post_window_start?.slice(0, 5) ?? '07:00',
    post_window_end: account.post_window_end?.slice(0, 5) ?? '21:00',
    timezone: account.timezone ?? 'America/Sao_Paulo',
    name: existingProfile?.name ?? '',
    primary_color: existingProfile?.primary_color ?? '#D97757',
    background_color: existingProfile?.background_color ?? '#FFFFFF',
    footer_text: existingProfile?.footer_text ?? '',
    base_style_prompt: existingProfile?.base_style_prompt ?? '',
    voice_prompt: existingProfile?.voice_prompt ?? '',
    slides_per_drop: existingProfile?.slides_per_drop ?? 6,
    aspect_ratio: existingProfile?.aspect_ratio ?? '1:1',
    image_provider: existingProfile?.image_provider ?? 'dalle',
    image_model: existingProfile?.image_model ?? '',
    target_hashtags: (existingProfile?.target_hashtags ?? []).join(', '),
    target_youtube_keywords: (existingProfile?.target_youtube_keywords ?? []).join(', '),
    youtube_region_code: existingProfile?.youtube_region_code ?? 'BR',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      // Aceita vírgula OU espaço como separador (usuários costumam digitar
      // hashtags no estilo "#foo #bar", sem vírgula) e remove o '#' de cada
      // termo individualmente, não só do início da string inteira.
      target_hashtags: form.target_hashtags
        .split(/[,\s]+/)
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean),
      target_youtube_keywords: form.target_youtube_keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    const res = await fetch(`/api/accounts/${accountId}/brand-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  const inputClass =
    'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent'
  const labelClass = 'block text-sm font-medium text-neutral-300 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
          Janela de postagem
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Início</label>
            <input
              type="time"
              className={inputClass}
              value={form.post_window_start}
              onChange={(e) => update('post_window_start', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Fim</label>
            <input
              type="time"
              className={inputClass}
              value={form.post_window_end}
              onChange={(e) => update('post_window_end', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Fuso horário</label>
            <input
              type="text"
              className={inputClass}
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          O horário de publicação é sorteado aleatoriamente dentro dessa janela, todos os dias.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
          DNA visual da marca
        </h2>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nome do perfil de marca</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Ex: Zero Canon — dark/coral"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cor de destaque</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded border border-neutral-700 bg-neutral-900"
                  value={form.primary_color}
                  onChange={(e) => update('primary_color', e.target.value)}
                />
                <input
                  type="text"
                  className={inputClass}
                  value={form.primary_color}
                  onChange={(e) => update('primary_color', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Cor de fundo</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded border border-neutral-700 bg-neutral-900"
                  value={form.background_color}
                  onChange={(e) => update('background_color', e.target.value)}
                />
                <input
                  type="text"
                  className={inputClass}
                  value={form.background_color}
                  onChange={(e) => update('background_color', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Slides por drop</label>
              <input
                type="number"
                min={1}
                max={10}
                className={inputClass}
                value={form.slides_per_drop}
                onChange={(e) => update('slides_per_drop', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Proporção</label>
              <select
                className={inputClass}
                value={form.aspect_ratio}
                onChange={(e) => update('aspect_ratio', e.target.value)}
              >
                <option value="1:1">1:1 (quadrado)</option>
                <option value="4:5">4:5 (retrato)</option>
                <option value="4:3">4:3 (paisagem)</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Texto de rodapé</label>
            <input
              type="text"
              className={inputClass}
              placeholder="@seuusuario"
              value={form.footer_text}
              onChange={(e) => update('footer_text', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>
              Prompt-base de estilo visual (prependado em toda imagem gerada)
            </label>
            <textarea
              className={inputClass}
              rows={5}
              placeholder="Ex: fundo escuro #0F0F0F, tipografia sans-serif bold, um único acento de cor coral, sem watermark, sem lorem ipsum..."
              value={form.base_style_prompt}
              onChange={(e) => update('base_style_prompt', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>
              Prompt de voz/tom (usado para gerar a legenda)
            </label>
            <textarea
              className={inputClass}
              rows={4}
              placeholder="Ex: tom direto, confiante, frases curtas, sem emojis em excesso..."
              value={form.voice_prompt}
              onChange={(e) => update('voice_prompt', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
          Geração de imagem (Make)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Provedor</label>
            <select
              className={inputClass}
              value={form.image_provider}
              onChange={(e) => update('image_provider', e.target.value)}
            >
              <option value="dalle">DALL-E 3 (OpenAI) — fiel, mais caro</option>
              <option value="fal">Flux via Fal.ai — barato/rápido</option>
              <option value="replicate">Flux via Replicate — barato</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Modelo (opcional)</label>
            <input
              type="text"
              className={inputClass}
              placeholder={
                form.image_provider === 'fal'
                  ? 'fal-ai/flux/dev'
                  : form.image_provider === 'replicate'
                  ? 'black-forest-labs/flux-dev'
                  : 'gpt-image-1'
              }
              value={form.image_model}
              onChange={(e) => update('image_model', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Vazio usa o modelo padrão do provedor. Fal.ai exige a env{' '}
          <code className="text-neutral-400">FAL_KEY</code>; Replicate exige{' '}
          <code className="text-neutral-400">REPLICATE_API_TOKEN</code>; DALL-E usa{' '}
          <code className="text-neutral-400">OPENAI_API_KEY</code>.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">
          Fontes de tendência (Sense)
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Hashtags monitoradas no Instagram (separadas por vírgula, sem #)
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="marketingdigital, iaaplicada, empreendedorismo"
              value={form.target_hashtags}
              onChange={(e) => update('target_hashtags', e.target.value)}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Limite da API do Meta: 30 hashtags únicas consultadas a cada 7 dias por conta.
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Palavras-chave de busca no YouTube (opcional — vazio usa o chart geral da região)
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="produtividade com IA, automação"
              value={form.target_youtube_keywords}
              onChange={(e) => update('target_youtube_keywords', e.target.value)}
            />
          </div>

          <div className="w-40">
            <label className={labelClass}>Região YouTube</label>
            <input
              type="text"
              className={inputClass}
              placeholder="BR"
              value={form.youtube_region_code}
              onChange={(e) => update('youtube_region_code', e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-accent hover:bg-accent/90 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {saved && <span className="text-sm text-green-400">Salvo ✓</span>}
      </div>
    </form>
  )
}
