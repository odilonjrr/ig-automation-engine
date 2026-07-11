import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser } from '@/lib/supabase-server'
import { z } from 'zod'

const bodySchema = z.object({
  post_window_start: z.string(),
  post_window_end: z.string(),
  timezone: z.string(),
  name: z.string().min(1),
  primary_color: z.string(),
  background_color: z.string(),
  footer_text: z.string().optional(),
  base_style_prompt: z.string().min(1),
  voice_prompt: z.string().min(1),
  slides_per_drop: z.number().min(1).max(10),
  aspect_ratio: z.string(),
  image_provider: z.enum(['dalle', 'fal', 'replicate']).default('dalle'),
  image_model: z.string().optional().nullable(),
  target_hashtags: z.array(z.string()).default([]),
  target_youtube_keywords: z.array(z.string()).default([]),
  youtube_region_code: z.string().default('BR'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const db = supabaseAdmin()

  // 1. atualiza janela de postagem na conta (só se pertencer ao usuário)
  const { data: updatedAcc, error: accErr } = await db
    .from('accounts')
    .update({
      post_window_start: data.post_window_start,
      post_window_end: data.post_window_end,
      timezone: data.timezone,
    })
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .select('id')

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
  if (!updatedAcc || updatedAcc.length === 0) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }

  // 2. upsert do brand profile (uma conta = um profile por padrão nesta fase)
  const { error: bpErr } = await db.from('brand_profiles').upsert(
    {
      account_id: params.id,
      name: data.name,
      primary_color: data.primary_color,
      background_color: data.background_color,
      footer_text: data.footer_text,
      base_style_prompt: data.base_style_prompt,
      voice_prompt: data.voice_prompt,
      slides_per_drop: data.slides_per_drop,
      aspect_ratio: data.aspect_ratio,
      image_provider: data.image_provider,
      image_model: data.image_model?.trim() || null,
      target_hashtags: data.target_hashtags,
      target_youtube_keywords: data.target_youtube_keywords,
      youtube_region_code: data.youtube_region_code,
    },
    { onConflict: 'account_id' }
  )

  if (bpErr) return NextResponse.json({ error: bpErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
