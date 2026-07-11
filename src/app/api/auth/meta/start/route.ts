import { NextRequest, NextResponse } from 'next/server'
import { buildMetaAuthUrl } from '@/lib/meta-graph'
import crypto from 'crypto'

/**
 * GET /api/auth/meta/start
 * Redireciona o usuário para o dialog de autorização do Meta.
 * O `state` é um token aleatório salvo em cookie httpOnly para
 * validar o callback (proteção CSRF básica).
 */
export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = buildMetaAuthUrl(state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutos
  })
  return res
}
