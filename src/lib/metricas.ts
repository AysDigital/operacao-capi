import { diaBrasilia } from './format'
import { ops, supabase } from './supabase'

/**
 * Métricas por anúncio:
 *  - Meta (gasto, impressões, cliques, vídeo): ops.metricas_anuncio_dia, gravada pela
 *    função api/meta-metricas;
 *  - vendas: lidas do dashboard (public.purchases) por ops.vendas_por_anuncio, só agregadas.
 * O casamento é sempre pelo ID do anúncio (veiculacoes.meta_ad_id), nunca pelo nome.
 */

async function chamarApi<T>(caminho: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const r = await fetch(caminho, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}`, ...init?.headers },
  })
  const corpo = (await r.json().catch(() => ({}))) as T & { erro?: string }
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`)
  return corpo
}

export type ResultadoBusca = { periodo: { desde: string; ate: string }; contas: number; linhas: number; falhas: { conta: string; erro: string }[] }

/** Busca as métricas na Meta e grava no banco. `completo`: últimos 90 dias. */
export const atualizarMetricas = (completo = false) =>
  chamarApi<ResultadoBusca>('/api/meta-metricas', { method: 'POST', body: JSON.stringify({ completo }) })

export async function ultimaBusca(): Promise<string | null> {
  const { data } = await ops().from('metricas_buscas').select('feita_em').order('feita_em', { ascending: false }).limit(1).maybeSingle()
  return data?.feita_em ?? null
}

const UMA_HORA = 3_600_000
let buscando: Promise<unknown> | null = null

/** Se a última busca tem mais de 1 hora, busca de novo em segundo plano (uma de cada vez). */
export async function manterMetricasFrescas() {
  if (buscando) return buscando
  const ultima = await ultimaBusca()
  if (ultima && Date.now() - new Date(ultima).getTime() < UMA_HORA) return
  buscando = atualizarMetricas()
    .catch((e) => console.warn('Métricas da Meta:', (e as Error).message))
    .finally(() => (buscando = null))
  return buscando
}

export type AnuncioMeta = { id: string; nome: string; status: string; criado_em: string }

export const listarAnunciosDaConta = (contaId: string) =>
  chamarApi<{ anuncios: AnuncioMeta[] }>(`/api/meta-anuncios?conta=${encodeURIComponent(contaId)}`).then((r) => r.anuncios)

// ---------------------------------------------------------------------
// Números de um card
// ---------------------------------------------------------------------
export type Numeros = {
  gasto: number
  impressoes: number
  cliques: number
  cliquesLink: number
  comprasMeta: number
  views3s: number
  thruplays: number
  vendas: number // aprovadas, produto principal
  vendasExtras: number // upsell e downsell aprovados
  faturamento: number // aprovado, com upsell e downsell
  faturamentoLiquido: number
  reembolsos: number // reembolso + chargeback (quantidade)
  valorReembolsado: number
}

const zero = (): Numeros => ({
  gasto: 0,
  impressoes: 0,
  cliques: 0,
  cliquesLink: 0,
  comprasMeta: 0,
  views3s: 0,
  thruplays: 0,
  vendas: 0,
  vendasExtras: 0,
  faturamento: 0,
  faturamentoLiquido: 0,
  reembolsos: 0,
  valorReembolsado: 0,
})

export const PERIODOS = [
  { valor: 7, nome: '7 dias' },
  { valor: 30, nome: '30 dias' },
  { valor: 0, nome: 'Tudo' },
] as const

/** Totais por ID de anúncio no período (`dias` = 0: tudo). Inclui hoje. */
export async function numerosPorAnuncio(ids: string[], dias: number): Promise<Map<string, Numeros>> {
  const desde = dias ? diaBrasilia(-(dias - 1)) : null
  let consulta = ops()
    .from('metricas_anuncio_dia')
    .select('meta_ad_id, gasto_brl, impressoes, cliques, cliques_link, compras_meta, visualizacoes_3s, thruplays')
    .in('meta_ad_id', ids)
  if (desde) consulta = consulta.gte('dia', desde)
  const [meta, vendas] = await Promise.all([consulta, ops().rpc('vendas_por_anuncio', { p_ids: ids, p_desde: desde })])
  if (meta.error) throw new Error(meta.error.message)
  if (vendas.error) throw new Error(vendas.error.message)

  const r = new Map(ids.map((id) => [id, zero()]))
  for (const l of meta.data ?? []) {
    const n = r.get(l.meta_ad_id)!
    n.gasto += Number(l.gasto_brl)
    n.impressoes += Number(l.impressoes)
    n.cliques += Number(l.cliques)
    n.cliquesLink += Number(l.cliques_link)
    n.comprasMeta += Number(l.compras_meta)
    n.views3s += Number(l.visualizacoes_3s)
    n.thruplays += Number(l.thruplays)
  }
  for (const v of (vendas.data ?? []) as { ad_id: string; tipo_oferta: string; status: string; vendas: number; valor: number; valor_liquido: number }[]) {
    const n = r.get(v.ad_id)
    if (!n) continue
    if (v.status === 'approved') {
      if (v.tipo_oferta === 'principal') n.vendas += Number(v.vendas)
      else n.vendasExtras += Number(v.vendas)
      n.faturamento += Number(v.valor)
      n.faturamentoLiquido += Number(v.valor_liquido)
    } else {
      n.reembolsos += Number(v.vendas)
      n.valorReembolsado += Number(v.valor)
    }
  }
  return r
}

export function somar(lista: Numeros[]): Numeros {
  const t = zero()
  for (const n of lista) for (const k of Object.keys(t) as (keyof Numeros)[]) t[k] += n[k]
  return t
}

/** Indicadores derivados (null quando não dá para calcular). */
export function indicadores(n: Numeros) {
  const div = (a: number, b: number) => (b ? a / b : null)
  return {
    roas: div(n.faturamento, n.gasto),
    cpa: div(n.gasto, n.vendas),
    cpm: n.impressoes ? (n.gasto / n.impressoes) * 1000 : null,
    ctr: div(n.cliquesLink, n.impressoes),
    hookRate: div(n.views3s, n.impressoes),
    holdRate: div(n.thruplays, n.views3s),
  }
}
