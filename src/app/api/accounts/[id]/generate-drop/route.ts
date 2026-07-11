import { NextRequest, NextResponse } from 'next/server'
import { runThinkForAccount } from '@/lib/think/run-think'
import { getSessionUser, userOwnsAccount } from '@/lib/supabase-server'

/**
 * POST /api/accounts/[id]/generate-drop
 * Gera um novo content_drop (caption + prompts de slide) a partir do
 * melhor trend ainda não usado desta conta.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!(await userOwnsAccount(params.id, user.id))) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }

  try {
    const dropId = await runThinkForAccount(params.id)
    if (!dropId) {
      return NextResponse.json(
        { error: 'Nenhum trend disponível. Rode o Sense primeiro.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true, dropId })
  } catch (err: any) {
    console.error('Think falhou:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
