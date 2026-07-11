import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /auth/callback
 * Troca o `code` do Supabase Auth (confirmação de e-mail / magic link)
 * por uma sessão e redireciona para o destino original.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect') || '/accounts'

  if (code) {
    const supabase = supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback', origin))
}
