import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { is_active } = await req.json()
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('accounts')
    .update({ is_active })
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
