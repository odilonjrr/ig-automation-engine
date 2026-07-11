import type { NormalizedTrend } from './youtube'
import { isDryRun } from '@/lib/dev/dry-run'

/**
 * Sense layer — Instagram hashtag search (Graph API)
 *
 * Fluxo: ig_hashtag_search (nome -> id) -> top_media (id -> posts).
 * Limite da própria API: 30 hashtags únicas consultadas por IG User ID
 * a cada 7 dias — por isso cacheamos o hashtag_id (ver `resolveHashtagId`)
 * em vez de resolver o nome toda vez.
 */

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

interface IgHashtagMediaItem {
  id: string
  caption?: string
  like_count?: number
  comments_count?: number
  permalink?: string
  timestamp?: string
  media_type?: string
}

/**
 * Resolve o nome de uma hashtag (sem #) para o hashtag_id do Graph API.
 * Conta contra o limite de 30/7 dias — chame só quando necessário.
 */
export async function resolveHashtagId(params: {
  igUserId: string
  accessToken: string
  hashtagName: string
}): Promise<string | null> {
  const url = new URL(`${GRAPH_BASE}/ig_hashtag_search`)
  url.searchParams.set('user_id', params.igUserId)
  url.searchParams.set('q', params.hashtagName)
  url.searchParams.set('access_token', params.accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`ig_hashtag_search falhou: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return data.data?.[0]?.id ?? null
}

/**
 * Busca os posts de melhor engajamento (top_media) para um hashtag_id já resolvido.
 */
export async function fetchHashtagTopMedia(params: {
  hashtagId: string
  igUserId: string
  accessToken: string
}): Promise<NormalizedTrend[]> {
  const url = new URL(`${GRAPH_BASE}/${params.hashtagId}/top_media`)
  url.searchParams.set('user_id', params.igUserId)
  url.searchParams.set(
    'fields',
    'id,caption,like_count,comments_count,permalink,timestamp,media_type'
  )
  url.searchParams.set('access_token', params.accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`top_media falhou: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { data: IgHashtagMediaItem[] }

  return (data.data ?? []).map((item) => {
    const likes = item.like_count ?? 0
    const comments = item.comments_count ?? 0
    // IG não expõe "reach" de posts de terceiros via hashtag search;
    // usamos um proxy conservador baseado em likes para não dividir por algo
    // artificialmente pequeno no cálculo de engagement_score.
    const reachProxy = Math.max(likes * 20, 1)

    return {
      platform: 'instagram' as const,
      topic: (item.caption ?? '(sem legenda)').slice(0, 200),
      source_url: item.permalink ?? null,
      likes,
      comments,
      shares: 0, // não exposto pela API para posts de terceiros
      reach: reachProxy,
      raw_payload: item,
    }
  })
}

/**
 * Helper de alto nível: resolve + busca em uma chamada, para uma lista de
 * hashtags-alvo definidas por conta (ex: nicho do brand_profile).
 */
export async function fetchInstagramTrendsForHashtags(params: {
  igUserId: string
  accessToken: string
  hashtags: string[]
}): Promise<NormalizedTrend[]> {
  if (isDryRun()) {
    return params.hashtags.map((tag, i) => ({
      platform: 'instagram' as const,
      topic: `[DRY] #${tag} post em alta`,
      source_url: `https://instagram.com/p/dryrun${i + 1}`,
      likes: 800 * (i + 1),
      comments: 60 * (i + 1),
      shares: 0,
      reach: Math.max(800 * (i + 1) * 20, 1),
      raw_payload: { dryRun: true, tag },
    }))
  }

  const results: NormalizedTrend[] = []

  for (const tag of params.hashtags) {
    try {
      const hashtagId = await resolveHashtagId({
        igUserId: params.igUserId,
        accessToken: params.accessToken,
        hashtagName: tag,
      })
      if (!hashtagId) continue

      const media = await fetchHashtagTopMedia({
        hashtagId,
        igUserId: params.igUserId,
        accessToken: params.accessToken,
      })
      results.push(...media)
    } catch (err) {
      // uma hashtag falhando não deve derrubar o scan inteiro
      console.error(`Falha ao buscar hashtag #${tag}:`, err)
    }
  }

  return results
}
