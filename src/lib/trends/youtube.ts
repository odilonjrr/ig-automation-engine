/**
 * Sense layer — YouTube Data API v3
 * Tier gratuito comporta bem 1 execução/dia por conta (quota de 10k units/dia,
 * cada search.list custa 100 units, videos.list custa 1 unit por item).
 */

import { isDryRun } from '@/lib/dev/dry-run'

export interface NormalizedTrend {
  platform: 'youtube' | 'instagram' | 'twitter'
  topic: string
  source_url: string | null
  likes: number
  comments: number
  shares: number
  reach: number
  raw_payload: unknown
}

// Trends canned para o harness — variam o engagement para exercitar a
// seleção do vencedor (threshold + ordenação por engagement_score).
function fakeYoutubeTrends(seed: string, count: number): NormalizedTrend[] {
  return Array.from({ length: count }, (_, i) => ({
    platform: 'youtube' as const,
    topic: `[DRY] ${seed} — tópico ${i + 1}`,
    source_url: `https://youtube.com/watch?v=dryrun${i + 1}`,
    likes: 1000 * (count - i),
    comments: 100 * (count - i),
    shares: 0,
    reach: 50000,
    raw_payload: { dryRun: true, seed, i },
  }))
}

interface YoutubeVideoItem {
  id: string
  snippet: {
    title: string
    publishedAt: string
    channelTitle: string
  }
  statistics: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
}

/**
 * Busca os vídeos mais populares de uma região (chart=mostPopular),
 * opcionalmente filtrados por categoria. Não precisa de query de busca —
 * é o endpoint mais barato em quota.
 */
export async function fetchYoutubeTrends(params: {
  apiKey: string
  regionCode?: string
  maxResults?: number
}): Promise<NormalizedTrend[]> {
  const { apiKey, regionCode = 'BR', maxResults = 15 } = params
  if (isDryRun()) return fakeYoutubeTrends(regionCode, maxResults)

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,statistics')
  url.searchParams.set('chart', 'mostPopular')
  url.searchParams.set('regionCode', regionCode)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`YouTube API falhou: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { items: YoutubeVideoItem[] }

  return data.items.map((item) => {
    const views = Number(item.statistics.viewCount ?? 1)
    const likes = Number(item.statistics.likeCount ?? 0)
    const comments = Number(item.statistics.commentCount ?? 0)

    return {
      platform: 'youtube' as const,
      topic: item.snippet.title,
      source_url: `https://youtube.com/watch?v=${item.id}`,
      likes,
      comments,
      shares: 0, // YouTube não expõe shares via API pública
      reach: views,
      raw_payload: item,
    }
  })
}

/**
 * Busca por termo específico (search.list) — mais caro em quota (100 units),
 * usar com moderação. Útil quando você já sabe o nicho/palavra-chave da conta.
 */
export async function searchYoutubeByTopic(params: {
  apiKey: string
  query: string
  maxResults?: number
}): Promise<NormalizedTrend[]> {
  const { apiKey, query, maxResults = 10 } = params
  if (isDryRun()) return fakeYoutubeTrends(query, maxResults)

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('order', 'viewCount')
  const publishedAfter = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  searchUrl.searchParams.set('publishedAfter', publishedAfter)
  searchUrl.searchParams.set('maxResults', String(maxResults))
  searchUrl.searchParams.set('key', apiKey)

  const searchRes = await fetch(searchUrl.toString())
  if (!searchRes.ok) {
    throw new Error(`YouTube search falhou: ${searchRes.status} ${await searchRes.text()}`)
  }
  const searchData = await searchRes.json()
  const ids = (searchData.items ?? [])
    .map((it: any) => it.id?.videoId)
    .filter(Boolean)
    .join(',')

  if (!ids) return []

  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('part', 'snippet,statistics')
  statsUrl.searchParams.set('id', ids)
  statsUrl.searchParams.set('key', apiKey)

  const statsRes = await fetch(statsUrl.toString())
  if (!statsRes.ok) {
    throw new Error(`YouTube videos.list falhou: ${statsRes.status} ${await statsRes.text()}`)
  }
  const statsData = (await statsRes.json()) as { items: YoutubeVideoItem[] }

  return statsData.items.map((item) => {
    const views = Number(item.statistics.viewCount ?? 1)
    const likes = Number(item.statistics.likeCount ?? 0)
    const comments = Number(item.statistics.commentCount ?? 0)

    return {
      platform: 'youtube' as const,
      topic: item.snippet.title,
      source_url: `https://youtube.com/watch?v=${item.id}`,
      likes,
      comments,
      shares: 0,
      reach: views,
      raw_payload: item,
    }
  })
}
