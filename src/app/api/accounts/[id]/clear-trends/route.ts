import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser, userOwnsAccount } from '@/lib/supabase-server'

/**
 * Apaga as trends NÃO usadas de uma conta — útil pra descartar resultados
 * genéricos capturados antes de configurar hashtags/keywords no brand_profile
 * (eles ficam com engagement_score alto e "afogam" as trends relevantes no
 * topo da lista). Trends já usadas em algum content_drop são preservadas
 * (auditoria) e a FK em content_drops.trend_id impediria o delete mesmo assim.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!(await userOwnsAccount(params.id, user.id))) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }

  const db = supabaseAdmin()
  const { error, count } = await db
    .from('trends')
    .delete({ count: 'exact' })
    .eq('account_id', params.id)
    .eq('used', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
