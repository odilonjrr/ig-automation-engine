/**
 * Cliente Meta Graph API — OAuth, troca de token long-lived,
 * descoberta de contas IG Business e publicação em 2 passos.
 *
 * Referências oficiais: developers.facebook.com/docs/instagram-api
 */

import { isDryRun } from '@/lib/dev/dry-run'
import { randomUUID } from 'crypto'

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

// ID de container/publicação falso para o dry-run (não chama a Graph API).
const fakeId = (kind: string) => ({ id: `dryrun-${kind}-${randomUUID().slice(0, 8)}` })

// ------------------------------------------------------------
// 1. OAuth: URL de autorização
// ------------------------------------------------------------
export function buildMetaAuthUrl(state: string) {
  // Nomes de escopo do fluxo "Instagram API with Facebook Login" (OAuth
  // dialog clássico em facebook.com/dialog/oauth, host graph.facebook.com).
  // Os nomes com prefixo "instagram_business_*" são de um fluxo DIFERENTE
  // (Instagram Login direto) e são rejeitados como "Invalid Scopes" aqui.
  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_read_engagement',
    // Necessário desde a v18 da Graph API para /me/accounts retornar
    // Páginas pertencentes a um Portfólio de Negócios (Business Manager) —
    // sem isso, Páginas com dono empresarial somem da lista mesmo com o
    // usuário tendo acesso total a elas.
    'business_management',
  ].join(',')

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: scopes,
    response_type: 'code',
    state,
  })

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

// ------------------------------------------------------------
// 2. Troca do "code" do callback por um token de curta duração
// ------------------------------------------------------------
export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  })

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`)
  if (!res.ok) throw new Error(`Falha ao trocar code por token: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>
}

// ------------------------------------------------------------
// 3. Troca de short-lived por long-lived token (60 dias)
// ------------------------------------------------------------
export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  })

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`)
  if (!res.ok) throw new Error(`Falha ao gerar long-lived token: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>
}

// ------------------------------------------------------------
// 4. Descobre as Páginas do usuário e a IG Business Account vinculada
// ------------------------------------------------------------
export async function getPagesAndInstagramAccounts(userToken: string) {
  const res = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=200&access_token=${userToken}`
  )
  if (!res.ok) throw new Error(`Falha ao buscar páginas: ${await res.text()}`)

  const data = await res.json()
  return (data.data ?? []) as Array<{
    id: string
    name: string
    access_token: string
    instagram_business_account?: { id: string; username: string }
  }>
}

// ------------------------------------------------------------
// 5. Publicação — passo 1: cria o container de mídia
// ------------------------------------------------------------
export async function createMediaContainer(params: {
  igUserId: string
  imageUrl: string
  caption: string
  accessToken: string
}) {
  if (isDryRun()) return fakeId('container')

  const body = new URLSearchParams({
    image_url: params.imageUrl,
    caption: params.caption,
    access_token: params.accessToken,
  })

  const res = await fetch(`${GRAPH_BASE}/${params.igUserId}/media`, {
    method: 'POST',
    body,
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao criar media container: ${JSON.stringify(json)}`)
  }
  return json as { id: string } // creation_id
}

// ------------------------------------------------------------
// 6. Publicação — passo 2: publica o container criado
// ------------------------------------------------------------
export async function publishMediaContainer(params: {
  igUserId: string
  creationId: string
  accessToken: string
}) {
  if (isDryRun()) return fakeId('media')

  const body = new URLSearchParams({
    creation_id: params.creationId,
    access_token: params.accessToken,
  })

  const res = await fetch(`${GRAPH_BASE}/${params.igUserId}/media_publish`, {
    method: 'POST',
    body,
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao publicar media: ${JSON.stringify(json)}`)
  }
  return json as { id: string } // ig_media_id
}

// ------------------------------------------------------------
// 7. Carrossel — cria containers filhos + container pai
// ------------------------------------------------------------
export async function createCarouselContainer(params: {
  igUserId: string
  childCreationIds: string[]
  caption: string
  accessToken: string
}) {
  if (isDryRun()) return fakeId('carousel')

  const body = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: params.childCreationIds.join(','),
    caption: params.caption,
    access_token: params.accessToken,
  })

  const res = await fetch(`${GRAPH_BASE}/${params.igUserId}/media`, {
    method: 'POST',
    body,
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao criar carousel container: ${JSON.stringify(json)}`)
  }
  return json as { id: string }
}

export async function createCarouselChildItem(params: {
  igUserId: string
  imageUrl: string
  accessToken: string
}) {
  if (isDryRun()) return fakeId('child')

  const body = new URLSearchParams({
    image_url: params.imageUrl,
    is_carousel_item: 'true',
    access_token: params.accessToken,
  })

  const res = await fetch(`${GRAPH_BASE}/${params.igUserId}/media`, {
    method: 'POST',
    body,
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao criar carousel child: ${JSON.stringify(json)}`)
  }
  return json as { id: string }
}

// ------------------------------------------------------------
// 8. Comment-to-DM — private reply a um comentário (Fase 8)
// ------------------------------------------------------------
/**
 * Envia uma resposta privada (DM) a um comentário, usando o mecanismo de
 * "private reply" da Graph API — `recipient: { comment_id }`. É o caminho
 * sancionado para comment-to-DM: permite UMA resposta privada por comentário
 * dentro de 7 dias, sem depender da janela de 24h de mensagens.
 */
export async function sendPrivateReplyToComment(params: {
  igUserId: string
  commentId: string
  message: string
  accessToken: string
}) {
  const res = await fetch(
    `${GRAPH_BASE}/${params.igUserId}/messages?access_token=${encodeURIComponent(params.accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: params.commentId },
        message: { text: params.message },
      }),
    }
  )

  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Falha ao enviar private reply: ${JSON.stringify(json)}`)
  }
  return json
}
