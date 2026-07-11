/**
 * Supabase em memória — só para o harness de dry-run.
 *
 * Implementa exatamente o subconjunto do query-builder do supabase-js que o
 * pipeline usa: select/insert/update, filtros (eq/neq/gte/lte/in), order/limit,
 * terminais maybeSingle()/single() e await direto (thenable), além das duas
 * relações embutidas usadas nos joins (`accounts` e `trends`) e da coluna
 * gerada `engagement_score`. NÃO é um Postgres — é o mínimo para exercitar a
 * lógica de orquestração das 4 camadas com dados determinísticos.
 *
 * Este arquivo é importado APENAS pelo harness (scripts/), nunca pelo código
 * de produção — mantém o fake fora do bundle do Next.
 */
import { randomUUID } from 'crypto'

type Row = Record<string, any>
type QueryResult = { data: any; error: { message: string } | null }

const TABLES = [
  'accounts',
  'brand_profiles',
  'trends',
  'content_drops',
  'slides',
  'publish_queue',
  'publish_log',
  'comment_automation',
] as const
type TableName = (typeof TABLES)[number]

// Chave estrangeira → tabela alvo, para resolver os embeds do .select().
const EMBED_FK: Record<string, { table: TableName; fk: string }> = {
  accounts: { table: 'accounts', fk: 'account_id' },
  trends: { table: 'trends', fk: 'trend_id' },
}

const now = () => new Date().toISOString()

// Defaults de coluna aplicados no insert (o Postgres real faz via DEFAULT /
// coluna gerada; aqui replicamos só o que o pipeline lê depois).
function applyDefaults(table: TableName, row: Row): Row {
  const base: Row = { id: row.id ?? randomUUID(), ...row }

  switch (table) {
    case 'trends': {
      const likes = base.likes ?? 0
      const comments = base.comments ?? 0
      const shares = base.shares ?? 0
      const reach = base.reach ?? 1
      return {
        likes,
        comments,
        shares,
        reach,
        used: false,
        raw_payload: null,
        captured_at: now(),
        ...base,
        // coluna gerada — sempre recomputada, ignora valor fornecido
        engagement_score: (likes * 1 + comments * 3 + shares * 5) / Math.max(reach, 1),
      }
    }
    case 'content_drops':
      return { status: 'draft', created_at: now(), updated_at: now(), ...base }
    case 'slides':
      return {
        status: 'pending',
        retry_count: 0,
        image_url: null,
        error_message: null,
        created_at: now(),
        ...base,
      }
    case 'publish_queue':
      return { status: 'scheduled', attempts: 0, max_attempts: 3, created_at: now(), ...base }
    case 'publish_log':
      return { logged_at: now(), ...base }
    default:
      return base
  }
}

interface Filter {
  op: 'eq' | 'neq' | 'gte' | 'lte' | 'in'
  col: string
  val: any
}

interface EmbedSpec {
  name: string
  inner: boolean
}

function passesFilter(value: any, f: Filter): boolean {
  switch (f.op) {
    case 'eq':
      return value === f.val
    case 'neq':
      return value !== f.val
    case 'gte':
      return value >= f.val
    case 'lte':
      return value <= f.val
    case 'in':
      return Array.isArray(f.val) && f.val.includes(value)
  }
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private filters: Filter[] = []
  private selectSpec = '*'
  private embeds: EmbedSpec[] = []
  private orderCol?: string
  private orderAsc = true
  private limitN?: number
  private mode: 'select' | 'insert' | 'update' = 'select'
  private payload: any = null
  private wantSingle = false
  private wantMaybe = false

  constructor(private store: Record<string, Row[]>, private table: TableName) {}

  select(spec = '*'): this {
    this.selectSpec = spec
    this.embeds = parseEmbeds(spec)
    return this
  }

  insert(rows: Row | Row[]): this {
    this.mode = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(patch: Row): this {
    this.mode = 'update'
    this.payload = patch
    return this
  }

  eq(col: string, val: any): this {
    this.filters.push({ op: 'eq', col, val })
    return this
  }
  neq(col: string, val: any): this {
    this.filters.push({ op: 'neq', col, val })
    return this
  }
  gte(col: string, val: any): this {
    this.filters.push({ op: 'gte', col, val })
    return this
  }
  lte(col: string, val: any): this {
    this.filters.push({ op: 'lte', col, val })
    return this
  }
  in(col: string, val: any[]): this {
    this.filters.push({ op: 'in', col, val })
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col
    this.orderAsc = opts?.ascending ?? true
    return this
  }

  limit(n: number): this {
    this.limitN = n
    return this
  }

  maybeSingle(): Promise<QueryResult> {
    this.wantMaybe = true
    return this.exec()
  }

  single(): Promise<QueryResult> {
    this.wantSingle = true
    return this.exec()
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected)
  }

  // Filtros sobre colunas diretas (sem ponto).
  private matchesBase(row: Row): boolean {
    return this.filters.filter((f) => !f.col.includes('.')).every((f) => passesFilter(row[f.col], f))
  }

  // Filtros sobre colunas embutidas ("accounts.is_active") + poda de inner join.
  private matchesEmbeds(row: Row): boolean {
    for (const e of this.embeds) {
      if (e.inner && (row[e.name] === null || row[e.name] === undefined)) return false
    }
    for (const f of this.filters) {
      if (!f.col.includes('.')) continue
      const [embedName, col] = f.col.split('.')
      const embedded = row[embedName]
      if (!embedded || !passesFilter(embedded[col], f)) return false
    }
    return true
  }

  private attachEmbeds(row: Row): Row {
    if (this.embeds.length === 0) return { ...row }
    const out: Row = { ...row }
    for (const e of this.embeds) {
      const map = EMBED_FK[e.name]
      if (!map) continue
      const fkVal = row[map.fk]
      out[e.name] = this.store[map.table].find((r) => r.id === fkVal) ?? null
    }
    return out
  }

  private async exec(): Promise<QueryResult> {
    const table = this.store[this.table]

    if (this.mode === 'insert') {
      const inserted = this.payload.map((r: Row) => applyDefaults(this.table, r))
      table.push(...inserted)
      if (this.wantSingle || this.wantMaybe) return { data: inserted[0] ?? null, error: null }
      return { data: inserted, error: null }
    }

    if (this.mode === 'update') {
      const matched = table.filter((row) => this.matchesBase(row))
      for (const row of matched) Object.assign(row, this.payload)
      return { data: matched, error: null }
    }

    // select
    let rows = table.filter((row) => this.matchesBase(row)).map((row) => this.attachEmbeds(row))
    rows = rows.filter((row) => this.matchesEmbeds(row))

    if (this.orderCol) {
      const col = this.orderCol
      rows.sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av === bv) return 0
        const cmp = av > bv ? 1 : -1
        return this.orderAsc ? cmp : -cmp
      })
    }

    if (this.limitN != null) rows = rows.slice(0, this.limitN)

    if (this.wantSingle) {
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { message: 'no rows returned (single)' } }
    }
    if (this.wantMaybe) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }
}

function parseEmbeds(spec: string): EmbedSpec[] {
  const embeds: EmbedSpec[] = []
  const re = /(\w+)(!inner)?\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(spec)) !== null) {
    embeds.push({ name: m[1], inner: Boolean(m[2]) })
  }
  return embeds
}

/** Storage fake — o pipeline usa apenas upload() + getPublicUrl(). */
function fakeStorage() {
  return {
    from() {
      return {
        async upload() {
          return { data: { path: 'fake' }, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://dry-run.local/slides/${path}` } }
        },
      }
    },
  }
}

export interface FakeSupabase {
  from(table: TableName): QueryBuilder
  storage: ReturnType<typeof fakeStorage>
  __tables: Record<string, Row[]>
}

/**
 * Cria um cliente Supabase em memória. `seed` popula as tabelas iniciais
 * (accounts, brand_profiles, trends, ...). O objeto retornado expõe
 * `__tables` para o harness inspecionar o estado final de cada camada.
 */
export function createFakeSupabase(seed: Partial<Record<TableName, Row[]>> = {}): FakeSupabase {
  const store: Record<string, Row[]> = {}
  for (const t of TABLES) store[t] = [...(seed[t] ?? [])]

  return {
    from(table: TableName) {
      return new QueryBuilder(store, table)
    },
    storage: fakeStorage(),
    __tables: store,
  }
}
