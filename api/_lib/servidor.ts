import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Utilidades das funções serverless (pasta api/). Arquivos com "_" no início
 * não viram rota no Vercel.
 *
 * Segurança: nenhuma função usa a service role key. Toda chamada usa o JWT do
 * próprio usuário (cabeçalho Authorization), então as gravações passam pelo RLS
 * do schema ops, exatamente como no navegador. A chave da Meta fica só na
 * variável de ambiente META_ADS_TOKEN.
 */

export type Ops = ReturnType<SupabaseClient['schema']>

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function erro(mensagem: string, status: number): Response {
  return json({ erro: mensagem }, status)
}

/** Confere o JWT e se o usuário é membro da operação. Devolve o cliente do schema ops com o JWT dele. */
export async function autenticar(request: Request): Promise<{ ops: Ops } | Response> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return erro('Servidor sem VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.', 500)

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return erro('Sessão ausente.', 401)

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: usuario, error: e1 } = await supabase.auth.getUser(jwt)
  if (e1 || !usuario.user) return erro('Sessão inválida ou expirada. Entre de novo.', 401)

  const ops = supabase.schema('ops')
  const { data: membro, error: e2 } = await ops.rpc('is_membro')
  if (e2) return erro(`Não foi possível verificar o acesso: ${e2.message}`, 500)
  if (membro !== true) return erro('Acesso não autorizado.', 403)

  return { ops }
}

const FUSO = 'America/Sao_Paulo'

/** Dia em Brasília, somando `deslocamentoDias` ("2026-10-28"). */
export function diaBrasilia(deslocamentoDias = 0): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
  const d = new Date(`${hoje}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deslocamentoDias)
  return d.toISOString().slice(0, 10)
}

/** Chave da Meta e versão da API (variáveis de ambiente). */
export function chaveMeta(): { token: string; versao: string } | Response {
  const token = process.env.META_ADS_TOKEN
  if (!token) return erro('Servidor sem META_ADS_TOKEN (configure nas variáveis de ambiente do Vercel).', 500)
  return { token, versao: process.env.META_API_VERSION || 'v23.0' }
}

/** GET na Graph API seguindo a paginação. `maximo` limita o total de itens. */
export async function graphPaginado<T>(url: string, maximo = Infinity): Promise<T[]> {
  const itens: T[] = []
  let proxima: string | null = url
  while (proxima && itens.length < maximo) {
    const r: Response = await fetch(proxima)
    const corpo = (await r.json()) as { data?: T[]; paging?: { next?: string }; error?: { message: string } }
    if (!r.ok || corpo.error) throw new Error(corpo.error?.message ?? `HTTP ${r.status}`)
    itens.push(...(corpo.data ?? []))
    proxima = corpo.paging?.next ?? null
  }
  return itens
}

/** PTAX de venda por dia (Banco Central); dias sem cotação usam a anterior. */
export async function ptax(desde: string, ate: string): Promise<(dia: string) => number> {
  const fmt = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`
  // começa 7 dias antes para cobrir fins de semana e feriados no início do período
  const inicio = new Date(`${desde}T12:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 7)
  const url =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)' +
    `?@dataInicial='${fmt(inicio.toISOString().slice(0, 10))}'&@dataFinalCotacao='${fmt(ate)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`PTAX: HTTP ${r.status}`)
  const corpo = (await r.json()) as { value: { cotacaoVenda: number; dataHoraCotacao: string }[] }
  const cotacoes = corpo.value
    .map((c) => ({ dia: c.dataHoraCotacao.slice(0, 10), valor: c.cotacaoVenda }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
  return (dia: string) => {
    let v = cotacoes[0]?.valor ?? 0
    for (const c of cotacoes) if (c.dia <= dia) v = c.valor
    return v
  }
}
