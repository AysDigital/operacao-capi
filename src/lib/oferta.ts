import type { Tom } from '../components/ds'
import type { Oferta } from './cadastros'
import { diaBrasilia } from './format'
import { buscarRanking, type LinhaRanking } from './ranking'
import { ops } from './supabase'

// ---------------------------------------------------------------------
// Oferta e links
// ---------------------------------------------------------------------
export type OfertaCompleta = Oferta & { anotacoes: string | null }

export async function buscarOferta(id: string): Promise<OfertaCompleta | null> {
  const { data, error } = await ops()
    .from('ofertas')
    .select('id, nome, codigo, idioma, cor, status, cpa_alvo, roas_minimo, gasto_minimo, periodo_avaliacao, anotacoes')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as OfertaCompleta | null
}

export type TipoLink = 'vendas' | 'checkout' | 'drive' | 'membros' | 'outro'
export const TIPOS_LINK: { valor: TipoLink; nome: string }[] = [
  { valor: 'vendas', nome: 'Página de vendas / VSL' },
  { valor: 'checkout', nome: 'Checkout' },
  { valor: 'drive', nome: 'Pasta do Drive' },
  { valor: 'membros', nome: 'Área de membros' },
  { valor: 'outro', nome: 'Outro' },
]
export type LinkOferta = { id: string; tipo: TipoLink; titulo: string; url: string; ordem: number }

export async function buscarLinks(ofertaId: string): Promise<LinkOferta[]> {
  const { data, error } = await ops().from('ofertas_links').select('id, tipo, titulo, url, ordem').eq('oferta_id', ofertaId).order('ordem')
  if (error) throw new Error(error.message)
  return (data ?? []) as LinkOferta[]
}

// ---------------------------------------------------------------------
// Checklist de lançamento
// ---------------------------------------------------------------------
export type ItemOferta = {
  id: string
  checklist_id: string
  texto: string
  feito: boolean
  ordem: number
  feito_em: string | null
  feito_por: string | null
  prazo: string | null
  nota: string | null
}
export type SecaoOferta = { id: string; titulo: string; ordem: number; itens: ItemOferta[] }

export async function buscarChecklistOferta(ofertaId: string): Promise<SecaoOferta[]> {
  const { data, error } = await ops()
    .from('checklists')
    .select('id, titulo, ordem, checklist_itens(id, checklist_id, texto, feito, ordem, feito_em, feito_por, prazo, nota)')
    .eq('oferta_id', ofertaId)
    .order('ordem')
  if (error) throw new Error(error.message)
  return ((data ?? []) as (Omit<SecaoOferta, 'itens'> & { checklist_itens: ItemOferta[] })[]).map(({ checklist_itens, ...s }) => ({
    ...s,
    itens: [...checklist_itens].sort((a, b) => a.ordem - b.ordem),
  }))
}

export type SecaoModelo = { titulo: string; itens: string[] }

// ---------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------
export type StatusTeste = 'ideia' | 'em_producao' | 'rodando' | 'concluido'
export type ResultadoTeste = 'venceu' | 'perdeu' | 'inconclusivo'
export type TipoTeste = 'lead_vsl' | 'micro_lead' | 'headline' | 'preco' | 'checkout' | 'upsell_downsell' | 'pagina' | 'outro'

export const STATUS_TESTE: { valor: StatusTeste; nome: string; icone: string }[] = [
  { valor: 'ideia', nome: 'Ideia', icone: '💡' },
  { valor: 'em_producao', nome: 'Em produção', icone: '✎' },
  { valor: 'rodando', nome: 'Rodando', icone: '▶' },
  { valor: 'concluido', nome: 'Concluído', icone: '✓' },
]
export const RESULTADOS: Record<ResultadoTeste, { nome: string; tom: Tom; icone: string }> = {
  venceu: { nome: 'Venceu', tom: 'bom', icone: '✓' },
  perdeu: { nome: 'Perdeu', tom: 'ruim', icone: '✕' },
  inconclusivo: { nome: 'Inconclusivo', tom: 'neutro', icone: '?' },
}
export const TIPOS_TESTE: { valor: TipoTeste; nome: string }[] = [
  { valor: 'lead_vsl', nome: 'Lead da VSL' },
  { valor: 'micro_lead', nome: 'Micro lead' },
  { valor: 'headline', nome: 'Headline' },
  { valor: 'preco', nome: 'Preço' },
  { valor: 'checkout', nome: 'Checkout' },
  { valor: 'upsell_downsell', nome: 'Upsell / downsell' },
  { valor: 'pagina', nome: 'Página' },
  { valor: 'outro', nome: 'Outro' },
]

export type Teste = {
  id: string
  oferta_id: string
  titulo: string
  tipo: TipoTeste
  hipotese: string | null
  status: StatusTeste
  inicio: string | null
  fim: string | null
  resultado: ResultadoTeste | null
  aprendizado: string | null
  card_id: string | null
  posicao: number
  card: { id: string; nome: string } | null
}

export async function buscarTestes(ofertaId: string): Promise<Teste[]> {
  const { data, error } = await ops()
    .from('testes_oferta')
    .select('id, oferta_id, titulo, tipo, hipotese, status, inicio, fim, resultado, aprendizado, card_id, posicao, card:card_id(id, nome)')
    .eq('oferta_id', ofertaId)
    .order('posicao')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Teste[]
}

// ---------------------------------------------------------------------
// Histórico da oferta
// ---------------------------------------------------------------------
export type EventoOferta = { id: string; autor_id: string | null; tipo: string; texto: string; criado_em: string }

export async function buscarHistoricoOferta(ofertaId: string, limite = 40): Promise<EventoOferta[]> {
  const { data, error } = await ops()
    .from('atividades')
    .select('id, autor_id, tipo, texto, criado_em')
    .eq('oferta_id', ofertaId)
    .is('card_id', null)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------
export const PERIODOS_OFERTA = [
  { valor: 7, nome: '7 dias' },
  { valor: 14, nome: '14 dias' },
  { valor: 30, nome: '30 dias' },
  { valor: 0, nome: 'Tudo' },
] as const

/** Primeiro dia do período (null = tudo). */
export const desdeDe = (dias: number) => (dias ? diaBrasilia(-(dias - 1)) : null)

export type Totais = {
  gasto: number
  faturamento: number
  vendas: number
  vendasExtras: number
  reembolsos: number
  valorReembolsado: number
}

export type PontoDia = { dia: string; gasto: number; faturamento: number }

export type MetricasOferta = {
  linhas: LinhaRanking[]
  totais: Totais
  serie: PontoDia[]
  cobertura: { gastoTotal: number; gastoSemCard: number; anunciosSemCard: number }
}

/** Todos os dias de `desde` até hoje (para o gráfico não pular dias sem gasto). */
function diasAte(desde: string): string[] {
  const r: string[] = []
  const fim = diaBrasilia()
  const d = new Date(`${desde}T12:00:00Z`)
  while (d.toISOString().slice(0, 10) <= fim) {
    r.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return r
}

export async function buscarMetricasOferta(ofertaId: string, dias: number): Promise<MetricasOferta> {
  const desde = desdeDe(dias)
  const [linhas, ids, cob] = await Promise.all([
    buscarRanking(ofertaId, dias, 'anuncio'),
    ops().from('veiculacoes_anuncios').select('meta_ad_id').eq('oferta_id', ofertaId),
    ops().rpc('cobertura_oferta', { p_oferta: ofertaId, p_desde: desde }),
  ])
  if (ids.error) throw new Error(ids.error.message)
  if (cob.error) throw new Error(cob.error.message)
  const anuncios = (ids.data ?? []).map((v) => v.meta_ad_id as string)

  const totais: Totais = { gasto: 0, faturamento: 0, vendas: 0, vendasExtras: 0, reembolsos: 0, valorReembolsado: 0 }
  for (const l of linhas) {
    totais.gasto += l.gasto
    totais.faturamento += l.faturamento
    totais.vendas += l.vendas
    totais.vendasExtras += l.vendasExtras
    totais.reembolsos += l.reembolsos
    totais.valorReembolsado += l.valorReembolsado
  }

  // Série diária: gasto da Meta e faturamento aprovado, por dia de Brasília.
  const porDia = new Map<string, PontoDia>()
  if (anuncios.length) {
    let q = ops().from('metricas_anuncio_dia').select('dia, gasto_brl').in('meta_ad_id', anuncios)
    if (desde) q = q.gte('dia', desde)
    const [meta, vendas] = await Promise.all([q, ops().rpc('vendas_por_dia', { p_ids: anuncios, p_desde: desde })])
    if (meta.error) throw new Error(meta.error.message)
    if (vendas.error) throw new Error(vendas.error.message)
    const ponto = (dia: string) => {
      if (!porDia.has(dia)) porDia.set(dia, { dia, gasto: 0, faturamento: 0 })
      return porDia.get(dia)!
    }
    for (const m of meta.data ?? []) ponto(m.dia).gasto += Number(m.gasto_brl)
    for (const v of (vendas.data ?? []) as { dia: string; status: string; valor: number }[]) {
      if (v.status === 'approved') ponto(v.dia).faturamento += Number(v.valor)
    }
  }
  const primeiro = desde ?? [...porDia.keys()].sort()[0]
  const serie = primeiro ? diasAte(primeiro).map((dia) => porDia.get(dia) ?? { dia, gasto: 0, faturamento: 0 }) : []

  const c = ((cob.data ?? []) as { gasto_total: number; gasto_sem_card: number; anuncios_sem_card: number }[])[0]
  return {
    linhas,
    totais,
    serie,
    cobertura: {
      gastoTotal: Number(c?.gasto_total ?? 0),
      gastoSemCard: Number(c?.gasto_sem_card ?? 0),
      anunciosSemCard: Number(c?.anuncios_sem_card ?? 0),
    },
  }
}

// ---------------------------------------------------------------------
// Produção
// ---------------------------------------------------------------------
export type Rejeicao = { criado_em: string; conta_apelido: string | null; categoria_rejeicao: string | null }

export async function buscarProducao(ofertaId: string, dias: number) {
  const desde = desdeDe(dias)
  let rej = ops().from('v_rejeicoes').select('criado_em, conta_apelido, categoria_rejeicao').eq('oferta_id', ofertaId)
  if (desde) rej = rej.gte('criado_em', `${desde}T03:00:00Z`)
  const [cards, rejeicoes] = await Promise.all([
    ops().from('cards').select('id, lista_id, tipo, vencedor, veiculacoes(status)').eq('oferta_id', ofertaId).eq('arquivado', false),
    rej,
  ])
  if (cards.error) throw new Error(cards.error.message)
  if (rejeicoes.error) throw new Error(rejeicoes.error.message)
  const lista = (cards.data ?? []) as { id: string; lista_id: string; tipo: string; vencedor: boolean; veiculacoes: { status: string }[] }[]
  return {
    porLista: lista.reduce((m, c) => m.set(c.lista_id, (m.get(c.lista_id) ?? 0) + 1), new Map<string, number>()),
    rodando: lista.filter((c) => c.veiculacoes.some((v) => v.status === 'rodando')).length,
    trofeus: lista.filter((c) => c.vencedor).length,
    rejeicoes: (rejeicoes.data ?? []) as Rejeicao[],
  }
}

export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 })
export const vezes = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`)
