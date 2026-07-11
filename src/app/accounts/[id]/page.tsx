import { supabaseAdmin, requireUser } from '@/lib/supabase-server'
import BrandProfileForm from '@/components/BrandProfileForm'
import CommentAutomationForm from '@/components/CommentAutomationForm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage({ params }: { params: { id: string } }) {
  const user = await requireUser(`/accounts/${params.id}`)
  const db = supabaseAdmin()

  const { data: account } = await db
    .from('accounts')
    .select('*')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .single()

  if (!account) return notFound()

  const { data: brandProfile } = await db
    .from('brand_profiles')
    .select('*')
    .eq('account_id', params.id)
    .maybeSingle()

  const { data: commentRules } = await db
    .from('comment_automation')
    .select('id, keyword, dm_message, attachment_url, require_follow, is_active')
    .eq('account_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <a href="/accounts" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← voltar
      </a>
      <h1 className="text-2xl font-bold mt-2">@{account.ig_username}</h1>
      <p className="text-neutral-400 text-sm mt-1 mb-8">
        Configure a janela de postagem e o &quot;DNA visual&quot; usado em todo
        prompt gerado para esta conta.
      </p>

      <BrandProfileForm accountId={account.id} account={account} existingProfile={brandProfile} />

      <section className="mt-12 pt-8 border-t border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">
          Automação de comentários → DM
        </h2>
        <p className="text-neutral-500 text-sm mb-4">
          Quando alguém comentar a palavra-chave num post desta conta, o webhook
          envia automaticamente um DM com o link. Requer o webhook Meta configurado.
        </p>
        <CommentAutomationForm accountId={account.id} rules={commentRules ?? []} />
      </section>
    </main>
  )
}
