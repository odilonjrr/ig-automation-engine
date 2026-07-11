import { supabaseAdmin } from '@/lib/supabase-server'
import { decryptToken } from '@/lib/token-crypto'
import { fetchYoutubeTrends, searchYoutubeByTopic } from '@/lib/trends/youtube'
import { fetchInstagramTrendsForHashtags } from '@/lib/trends/instagram'
import type { NormalizedTrend } from '@/lib/trends/youtube'

interface AccountRow {
  id: string
  ig_user_id: string
  access_token_encrypted: string
  token_iv: string
}

/**
 * Roda o pipeline Sense (YouTube + Instagram hashtag search) para UMA conta
 * e persiste os resultados na tabela `trends`. Usada tanto pelo cron diário
 * quanto por um trigger manual no dashboard.
 */
export async function runSenseForAccount(account: AccountRow) {
  const db = supabaseAdmin()

  const { data: profile } = await db
    .from('brand_profiles')
    .select('target_hashtags, target_youtube_keywords, youtube_region_code')
    .eq('account_id', account.id)
    .maybeSingle()

  const trends: NormalizedTrend[] = []

  if (process.env.YOUTUBE_API_KEY) {
    const region = profile?.youtube_region_code ?? 'BR'
    const keywords = (profile?.target_youtube_keywords as string[]) ?? []

    if (keywords.length > 0) {
      for (const kw of keywords) {
        const results = await searchYoutubeByTopic({
          apiKey: process.env.YOUTUBE_API_KEY,
          query: kw,
          maxResults: 8,
        })
        trends.push(...results)
      }
    } else {
      const results = await fetchYoutubeTrends({
        apiKey: process.env.YOUTUBE_API_KEY,
        regionCode: region,
        maxResults: 15,
      })
      trends.push(...results)
    }
  }

  const hashtags = (profile?.target_hashtags as string[]) ?? []
  if (hashtags.length > 0) {
    const igToken = decryptToken(account.access_token_encrypted, account.token_iv)
    const igResults = await fetchInstagramTrendsForHashtags({
      igUserId: account.ig_user_id,
      accessToken: igToken,
      hashtags,
    })
    trends.push(...igResults)
  }

  if (trends.length > 0) {
    const rows = trends.map((t) => ({
      account_id: account.id,
      platform: t.platform,
      topic: t.topic,
      source_url: t.source_url,
      likes: t.likes,
      comments: t.comments,
      shares: t.shares,
      reach: t.reach,
      raw_payload: t.raw_payload,
    }))
    const { error: insertErr } = await db.from('trends').insert(rows)
    if (insertErr) throw insertErr
  }

  await db
    .from('accounts')
    .update({
      last_sense_run_at: new Date().toISOString(),
      last_sense_status: 'ok',
    })
    .eq('id', account.id)

  return trends.length
}
