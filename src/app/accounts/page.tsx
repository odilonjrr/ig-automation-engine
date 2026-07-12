import { supabaseAdmin, requireUser } from '@/lib/supabase-server'
import AccountCard from '@/components/AccountCard'
import LogoutButton from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string }
}) {
  const user = await requireUser('/accounts')
  const db = supabaseAdmin()
  const { data: accounts } = await db
    .from('accounts')
    .select('id, ig_username, is_active, post_window_start, post_window_end, timezone, token_expires_at')
    .eq('owner_user_id', user.id)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Contas conectadas</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Gerencie suas contas Instagram e o pipeline de automação por conta.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/api/auth/meta/start"
            className="bg-accent hover:bg-accent/90 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
          >
            + Conectar conta
          </a>
          <LogoutButton />
        </div>
      </div>

      {searchParams.connected && (
        <div className="mb-6 rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 text-green-300 text-sm">
          Conta conectada com sucesso.
        </div>
      )}
      {searchParams.error && (
        <div className="mb-6 rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-red-300 text-sm">
          Erro ao conectar: {searchParams.error}
        </div>
      )}

      {!accounts || accounts.length === 0 ? (
        <div className="border border-dashed border-neutral-700 rounded-xl py-16 text-center text-neutral-500">
          Nenhuma conta conectada ainda. Clique em &quot;Conectar conta&quot; para
          autorizar via Meta e vincular sua conta Instagram Business.
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </div>
      )}
    </main>
  )
}
