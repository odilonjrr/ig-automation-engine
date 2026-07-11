import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getPagesAndInstagramAccounts,
} from '@/lib/meta-graph'
import { encryptToken } from '@/lib/token-crypto'
import { supabaseAdmin, getSessionUser } from '@/lib/supabase-server'

/**
 * GET /api/auth/meta/callback
 * Recebe o `code` do Meta, troca por token long-lived, descobre
 * as contas IG Business vinculadas e salva cada uma criptografada.
 *
 * Se o usuário tiver múltiplas Páginas/contas IG, todas são salvas
 * (suporte nativo a multi-conta).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('meta_oauth_state')?.value

  if (!code) {
    return NextResponse.redirect(new URL('/accounts?error=no_code', req.url))
  }
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/accounts?error=invalid_state', req.url))
  }

  try {
    // 1. code -> short-lived token
    const shortLived = await exchangeCodeForToken(code)

    // 2. short-lived -> long-lived (60 dias)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token)
    if (!longLived.expires_in) {
      console.error(
        'exchangeForLongLivedToken sem expires_in — resposta:',
        JSON.stringify(longLived)
      )
    }
    // Fallback: token de Página vinculado a um long-lived user token não
    // expira por padrão (a Graph API às vezes omite expires_in nesse caso);
    // 60 dias é a duração documentada do long-lived token quando presente.
    const expiresInSeconds = longLived.expires_in || 60 * 24 * 60 * 60

    // 3. descobre Páginas + contas IG Business vinculadas
    const pages = await getPagesAndInstagramAccounts(longLived.access_token)
    const pagesWithIg = pages.filter((p) => p.instagram_business_account)

    if (pagesWithIg.length === 0) {
      // Log de diagnóstico — útil pra depurar por que uma Página esperada não
      // veio na resposta (ex: falta de escopo, Página de outro Business Manager).
      console.error(
        'no_ig_business_account — páginas retornadas pela Graph API:',
        JSON.stringify(pages, null, 2)
      )
      return NextResponse.redirect(
        new URL('/accounts?error=no_ig_business_account', req.url)
      )
    }

    // owner_user_id vem da sessão autenticada (Supabase Auth)
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login?redirect=/accounts', req.url))
    }
    const ownerUserId = user.id

    const db = supabaseAdmin()
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

    // 4. salva cada conta IG encontrada, com o token da Página (não o de usuário)
    for (const page of pagesWithIg) {
      const ig = page.instagram_business_account!
      const { encrypted, iv } = encryptToken(page.access_token)

      await db.from('accounts').upsert(
        {
          owner_user_id: ownerUserId,
          ig_user_id: ig.id,
          ig_username: ig.username,
          fb_page_id: page.id,
          access_token_encrypted: encrypted,
          token_iv: iv,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
        },
        { onConflict: 'ig_user_id' }
      )
    }

    return NextResponse.redirect(new URL('/accounts?connected=1', req.url))
  } catch (err) {
    console.error('Erro no callback Meta OAuth:', err)
    return NextResponse.redirect(new URL('/accounts?error=oauth_failed', req.url))
  }
}
