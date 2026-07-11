import { NextRequest, NextResponse } from 'next/server'
import { runMakeForDrop } from '@/lib/make/run-make'
import { getSessionUser, userOwnsDrop } from '@/lib/supabase-server'

/**
 * POST /api/drops/[dropId]/generate-images
 * Gera (ou regera, para slides que falharam) as imagens de um drop.
 */
export async function POST(req: NextRequest, { params }: { params: { dropId: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!(await userOwnsDrop(params.dropId, user.id))) {
    return NextResponse.json({ error: 'drop não encontrado' }, { status: 404 })
  }

  try {
    const result = await runMakeForDrop(params.dropId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('Make falhou:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
