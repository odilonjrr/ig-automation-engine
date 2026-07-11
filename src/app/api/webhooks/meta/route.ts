import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/token-crypto'
import { sendPrivateReplyToComment } from '@/lib/meta-graph'

/**
 * Webhook nativo da Meta para comment-to-DM (Fase 8).
 *
 * GET  — verificação do webhook (hub.challenge) na configuração do app Meta.
 * POST — recebe eventos de comentário; se o texto casar com uma keyword
 *        configurada em `comment_automation`, envia uma private reply (DM)
 *        com o link/lead magnet.
 *
 * A rota é pública (Meta chama sem sessão). Responde 200 rápido — o
 * processamento é best-effort e falhas por regra não derrubam o batch.
 */

// ── GET: verificação do webhook ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

interface CommentChange {
  field: string
  value?: {
    id?: string
    text?: string
    from?: { id?: string; username?: string }
    media?: { id?: string }
  }
}

interface WebhookEntry {
  id?: string // ig_user_id da conta
  changes?: CommentChange[]
}

// ── POST: evento de comentário ───────────────────────────────────────
export async function POST(req: NextRequest) {
  let payload: { object?: string; entry?: WebhookEntry[] }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // ignora corpo inválido, mas responde 200
  }

  try {
    await processEntries(payload.entry ?? [])
  } catch (err) {
    // Nunca falha o webhook por erro de processamento — só loga.
    console.error('Erro processando webhook Meta:', err)
  }

  // A Meta espera 200 rápido, senão reenvia o evento.
  return NextResponse.json({ ok: true })
}

async function processEntries(entries: WebhookEntry[]) {
  const db = supabaseAdmin()

  for (const entry of entries) {
    const igUserId = entry.id
    if (!igUserId) continue

    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments') continue
      const value = change.value
      const commentId = value?.id
      const text = value?.text
      const fromId = value?.from?.id
      if (!commentId || !text) continue

      // Não responde aos próprios comentários da conta.
      if (fromId && fromId === igUserId) continue

      const { data: account } = await db
        .from('accounts')
        .select('id, ig_user_id, access_token_encrypted, token_iv, is_active')
        .eq('ig_user_id', igUserId)
        .maybeSingle()

      if (!account || !account.is_active) continue

      const { data: rules } = await db
        .from('comment_automation')
        .select('keyword, dm_message, attachment_url, require_follow, is_active')
        .eq('account_id', account.id)
        .eq('is_active', true)

      const normalized = text.toLowerCase()
      const match = (rules ?? []).find((r) =>
        normalized.includes(String(r.keyword).toLowerCase())
      )
      if (!match) continue

      // NOTA: require_follow está persistido mas ainda não é verificado aqui —
      // checar follow status exige uma chamada extra à Graph API.

      const message = match.attachment_url
        ? `${match.dm_message}\n${match.attachment_url}`
        : match.dm_message

      try {
        const token = decryptToken(account.access_token_encrypted, account.token_iv)
        await sendPrivateReplyToComment({
          igUserId,
          commentId,
          message,
          accessToken: token,
        })
      } catch (err) {
        console.error(`Falha ao responder comentário ${commentId}:`, err)
      }
    }
  }
}
