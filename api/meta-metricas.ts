import { autenticar, chaveMeta, diaBrasilia, erro, graphPaginado, json, ptax, type Ops } from './_lib/servidor.js'

/**
 * POST /api/meta-metricas   corpo opcional: { "completo": true }
 *
 * Busca na Meta (Marketing API, /insights com level=ad, por dia) as métricas de
 * cada anúncio das contas ativas de ops.contas_anuncio e grava em
 * ops.metricas_anuncio_dia (com o JWT do usuário, pelo RLS).
 *
 * Período: últimos 3 dias (a Meta ainda ajusta os números recentes). Na primeira
 * vez, ou com "completo", os últimos 90 dias. Contas em dólar: PTAX de venda do dia.
 */

const DIAS_HISTORICO = 90
const DIAS_RECENTES = 3
const CONTAS_POR_VEZ = 4

type Acao = { action_type: string; value: string }
type Insight = {
  ad_id: string
  ad_name?: string
  date_start: string
  account_currency?: string
  spend?: string
  impressions?: string
  clicks?: string
  inline_link_clicks?: string
  actions?: Acao[]
  video_thruplay_watched_actions?: Acao[]
}
type Conta = { id: string; apelido: string; meta_ad_account_id: string }

const numero = (v: string | undefined) => Number(v ?? 0) || 0
const acao = (lista: Acao[] | undefined, ...tipos: string[]) => {
  for (const t of tipos) {
    const a = lista?.find((x) => x.action_type === t)
    if (a) return numero(a.value)
  }
  return 0
}

async function insightsDaConta(conta: Conta, desde: string, ate: string, token: string, versao: string) {
  const params = new URLSearchParams({
    level: 'ad',
    fields: 'ad_id,ad_name,spend,impressions,clicks,inline_link_clicks,actions,video_thruplay_watched_actions,account_currency',
    time_increment: '1',
    time_range: JSON.stringify({ since: desde, until: ate }),
    limit: '500',
    access_token: token,
  })
  return graphPaginado<Insight>(`https://graph.facebook.com/${versao}/act_${conta.meta_ad_account_id}/insights?${params}`)
}

export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (auth instanceof Response) return auth
  const ops: Ops = auth.ops
  const meta = chaveMeta()
  if (meta instanceof Response) return meta

  const corpo = (await request.json().catch(() => ({}))) as { completo?: boolean }

  const { data: contas, error: e1 } = await ops
    .from('contas_anuncio')
    .select('id, apelido, meta_ad_account_id')
    .eq('ativa', true)
    .not('meta_ad_account_id', 'is', null)
  if (e1) return erro(`Não foi possível ler as contas: ${e1.message}`, 500)
  const lista = (contas ?? []) as Conta[]
  if (!lista.length) return erro('Nenhuma conta ativa com ID do Meta em Configurações → Contas de anúncio.', 404)

  const { data: algum } = await ops.from('metricas_anuncio_dia').select('dia').limit(1)
  const desde = corpo.completo || !algum?.length ? diaBrasilia(-DIAS_HISTORICO) : diaBrasilia(-DIAS_RECENTES)
  const ate = diaBrasilia()

  // Poucas contas por vez, para não esbarrar no limite de chamadas da Meta.
  const resultados: { conta: Conta; linhas: Insight[]; erro: string | null }[] = []
  for (let i = 0; i < lista.length; i += CONTAS_POR_VEZ) {
    resultados.push(
      ...(await Promise.all(
        lista.slice(i, i + CONTAS_POR_VEZ).map(async (conta) => {
          try {
            return { conta, linhas: await insightsDaConta(conta, desde, ate, meta.token, meta.versao), erro: null }
          } catch (e) {
            return { conta, linhas: [], erro: (e as Error).message }
          }
        }),
      )),
    )
  }

  let cotacao: (dia: string) => number = () => 1
  if (resultados.some((r) => r.linhas.some((l) => (l.account_currency ?? 'BRL') !== 'BRL'))) {
    try {
      cotacao = await ptax(desde, ate)
    } catch (e) {
      return erro(`Não foi possível buscar a cotação do dólar: ${(e as Error).message}`, 502)
    }
  }

  const agora = new Date().toISOString()
  const linhas = resultados.flatMap((r) =>
    r.linhas.map((l) => {
      const moeda = l.account_currency ?? 'BRL'
      const fx = moeda === 'BRL' ? 1 : cotacao(l.date_start)
      const gasto = numero(l.spend)
      return {
        meta_ad_id: l.ad_id,
        dia: l.date_start,
        conta_id: r.conta.id,
        nome_no_meta: l.ad_name ?? null,
        moeda,
        cotacao: Math.round(fx * 1e6) / 1e6,
        gasto,
        gasto_brl: Math.round(gasto * fx * 100) / 100,
        impressoes: numero(l.impressions),
        cliques: numero(l.clicks),
        cliques_link: numero(l.inline_link_clicks),
        // uma só fonte de compras, na ordem de preferência (somar duplicaria)
        compras_meta: acao(l.actions, 'omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'),
        visualizacoes_3s: acao(l.actions, 'video_view'),
        thruplays: acao(l.video_thruplay_watched_actions, 'video_view'),
        atualizado_em: agora,
      }
    }),
  )

  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await ops.from('metricas_anuncio_dia').upsert(linhas.slice(i, i + 500), { onConflict: 'meta_ad_id,dia' })
    if (error) return erro(`Não foi possível gravar as métricas: ${error.message}`, 500)
  }

  const falhas = resultados.filter((r) => r.erro).map((r) => ({ conta: r.conta.apelido, erro: r.erro }))
  await ops.from('metricas_buscas').insert({ desde, ate, contas: lista.length, linhas: linhas.length, falhas })

  return json({ periodo: { desde, ate }, contas: lista.length, linhas: linhas.length, falhas })
}
