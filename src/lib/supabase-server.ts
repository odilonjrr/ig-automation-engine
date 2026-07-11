import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isDryRun, getMockDb } from '@/lib/dev/dry-run'

/**
 * Cliente server-side com service role — usado apenas em API routes
 * e cron jobs. NUNCA importar isso em componentes client.
 *
 * Ignora RLS: use somente após validar a sessão/ownership manualmente
 * (ex: filtrando por owner_user_id vindo de getSessionUser).
 */
export function supabaseAdmin() {
  // Dry-run: devolve o Supabase em memória injetado pelo harness (sem rede).
  if (isDryRun()) return getMockDb() as ReturnType<typeof createClient>

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase server env vars ausentes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

/**
 * Cliente server-side vinculado à sessão do usuário (Supabase Auth),
 * lendo/escrevendo os cookies da request. Use em Server Components,
 * Route Handlers e Server Actions para saber QUEM está autenticado.
 */
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookieStore = cookies()

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // `setAll` chamado a partir de um Server Component (cookies read-only).
          // O middleware já renova a sessão, então isso é seguro de ignorar.
        }
      },
    },
  })
}

/**
 * Retorna o usuário autenticado ou `null`. Não redireciona.
 */
export async function getSessionUser() {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser()
  return user
}

/**
 * Garante uma sessão válida; caso contrário redireciona para /login.
 * Use no topo de Server Components/páginas protegidas.
 */
export async function requireUser(redirectTo = '/accounts') {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`)
  }
  return user
}

/**
 * True se a conta pertence ao usuário. Usa o cliente admin (ignora RLS)
 * mas filtra explicitamente por owner_user_id.
 */
export async function userOwnsAccount(accountId: string, userId: string) {
  const { data } = await supabaseAdmin()
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  return !!data
}

/**
 * True se o drop pertence a uma conta do usuário.
 */
export async function userOwnsDrop(dropId: string, userId: string) {
  const { data } = await supabaseAdmin()
    .from('content_drops')
    .select('id, accounts!inner(owner_user_id)')
    .eq('id', dropId)
    .eq('accounts.owner_user_id', userId)
    .maybeSingle()
  return !!data
}
