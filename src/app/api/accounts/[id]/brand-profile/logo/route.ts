import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser, userOwnsAccount } from '@/lib/supabase-server'
import { uploadBrandLogo } from '@/lib/storage'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

/**
 * POST /api/accounts/[id]/brand-profile/logo
 * Upload da logo da marca (multipart/form-data, campo "file").
 * Requer que o brand_profile já exista (salve o formulário principal antes).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!(await userOwnsAccount(params.id, user.id))) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'arquivo ausente' }, { status: 400 })
  }
  const extension = ALLOWED_TYPES[file.type]
  if (!extension) {
    return NextResponse.json(
      { error: 'formato não suportado — use PNG, JPG, WEBP ou SVG' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'arquivo maior que 5MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadBrandLogo({
    accountId: params.id,
    imageBuffer: buffer,
    contentType: file.type,
    extension,
  })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('brand_profiles')
    .update({ logo_url: logoUrl })
    .eq('account_id', params.id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'salve o perfil da marca (formulário principal) antes de enviar a logo' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, logoUrl })
}
