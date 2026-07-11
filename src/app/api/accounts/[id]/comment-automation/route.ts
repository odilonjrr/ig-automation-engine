import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser, userOwnsAccount } from '@/lib/supabase-server'
import { z } from 'zod'

/**
 * CRUD das regras de comment-to-DM (tabela comment_automation) de uma conta.
 * GET    — lista as regras.
 * POST   — cria uma regra { keyword, dm_message, attachment_url?, require_follow? }.
 * DELETE — remove uma regra { ruleId }.
 * Tudo escopado por dono da conta.
 */

const createSchema = z.object({
  keyword: z.string().min(1).max(100),
  dm_message: z.string().min(1).max(1000),
  attachment_url: z.string().url().optional().nullable(),
  require_follow: z.boolean().optional().default(false),
})

async function guard(accountId: string) {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) }
  if (!(await userOwnsAccount(accountId, user.id))) {
    return { error: NextResponse.json({ error: 'conta não encontrada' }, { status: 404 }) }
  }
  return { user }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id)
  if (g.error) return g.error

  const { data, error } = await supabaseAdmin()
    .from('comment_automation')
    .select('id, keyword, dm_message, attachment_url, require_follow, is_active, created_at')
    .eq('account_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id)
  if (g.error) return g.error

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const { error } = await supabaseAdmin()
    .from('comment_automation')
    .insert({
      account_id: params.id,
      keyword: d.keyword.trim(),
      dm_message: d.dm_message,
      attachment_url: d.attachment_url?.trim() || null,
      require_follow: d.require_follow ?? false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(params.id)
  if (g.error) return g.error

  const { ruleId } = await req.json()
  if (!ruleId) return NextResponse.json({ error: 'ruleId ausente' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('comment_automation')
    .delete()
    .eq('id', ruleId)
    .eq('account_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
