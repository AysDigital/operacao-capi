import type { Tom } from '../components/ds'
import { diaBrasilia } from './format'
import type { Numeros } from './metricas'
import { ops } from './supabase'

/**
 * Classificação automática dos cards Ad e ranking. A regra fica no banco
 * (ops.classificar, chamada por ops.ranking), para o quadro e o ranking concordarem.
 */
export type Classe = 'vencedor' | 'promissor' | 'perdedor' | 'em_teste' | 'sem_dados'

export const CLASSES: Record<Classe, { nome: string; icone: string; tom: Tom; selo: boolean }> = {
  vencedor: { nome: 'Vencedor', icone: '🔥', tom: 'bom', selo: true },
  promissor: { nome: 'Promissor', icone: '✨', tom: 'info', selo: true },
  perdedor: { nome: 'Perdedor', icone: '⚠️', tom: 'ruim', selo: true },
  em_teste: { nome: 'Em teste', icone: '◐', tom: 'neutro', selo: false },
  sem_dados: { nome: 'Sem dados', icone: '○', tom: 'neutro', selo: false },
}

export const AJUDA_CLASSES = (
  'Calculada pelas regras de performance da oferta (Ofertas → editar), no período de avaliação dela, somando todas as contas. ' +
  'Vencedor: gasto mínimo atingido e ROAS ≥ mínimo (ou CPA ≤ alvo). Promissor: tem vendas, mas ainda não gastou o mínimo. ' +
  'Perdedor: gastou 2× o CPA alvo sem venda. Em teste: gastando, sem dados suficientes. Sem dados: sem gasto. ' +
  'O troféu é separado: é o vencedor confirmado por vocês.'
)

export type Nivel = 'anuncio' | 'hook' | 'familia'

export const NIVEIS: { valor: Nivel; nome: string }[] = [
  { valor: 'anuncio', nome: 'Anúncio (M)' },
  { valor: 'hook', nome: 'Hook (H)' },
  { valor: 'familia', nome: 'Família (AD)' },
]

export type LinhaRanking = Numeros & {
  ofertaId: string
  adNum: number
  hookNum: number | null
  varNum: number | null
  cards: string[]
  classe: Classe
}

type LinhaBanco = {
  oferta_id: string
  ad_num: number
  hook_num: number | null
  var_num: number | null
  cards: string[]
  gasto: number
  impressoes: number
  cliques: number
  cliques_link: number
  compras_meta: number
  visualizacoes_3s: number
  thruplays: number
  vendas: number
  vendas_extras: number
  faturamento: number
  faturamento_liquido: number
  reembolsos: number
  valor_reembolsado: number
  classificacao: Classe
}

/** `dias`: null = período de avaliação de cada oferta; 0 = tudo. */
export async function buscarRanking(ofertaId: string | null, dias: number | null, nivel: Nivel): Promise<LinhaRanking[]> {
  const { data, error } = await ops().rpc('ranking', { p_oferta: ofertaId, p_dias: dias, p_nivel: nivel })
  if (error) throw new Error(error.message)
  return ((data ?? []) as LinhaBanco[]).map((l) => ({
    ofertaId: l.oferta_id,
    adNum: l.ad_num,
    hookNum: l.hook_num,
    varNum: l.var_num,
    cards: l.cards,
    classe: l.classificacao,
    gasto: Number(l.gasto),
    impressoes: Number(l.impressoes),
    cliques: Number(l.cliques),
    cliquesLink: Number(l.cliques_link),
    comprasMeta: Number(l.compras_meta),
    views3s: Number(l.visualizacoes_3s),
    thruplays: Number(l.thruplays),
    vendas: Number(l.vendas),
    vendasExtras: Number(l.vendas_extras),
    faturamento: Number(l.faturamento),
    faturamentoLiquido: Number(l.faturamento_liquido),
    reembolsos: Number(l.reembolsos),
    valorReembolsado: Number(l.valor_reembolsado),
  }))
}

/** Números e classificação de cada card no período de avaliação da oferta (para o quadro). */
export async function metricasDosCards(ofertaId: string | null): Promise<Map<string, LinhaRanking>> {
  const linhas = await buscarRanking(ofertaId, null, 'anuncio')
  return new Map(linhas.map((l) => [l.cards[0], l]))
}

export const roasDe = (n: Numeros) => (n.gasto ? n.faturamento / n.gasto : null)

const reaisInteiros = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`

/** Linha compacta do card: "R$ 320 · 2,4x · 5v". */
export function resumoCurto(n: Numeros) {
  const roas = roasDe(n)
  return `${reaisInteiros(n.gasto)} · ${roas === null ? '—' : `${roas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`} · ${n.vendas}v`
}

// ---------------------------------------------------------------------
// Alertas de dados
// ---------------------------------------------------------------------
export type Alertas = {
  /** gasto nas últimas 24 h sem venda registrada nesse tempo: data/hora da última venda */
  semVendasDesde: string | null
  /** falhas da última busca na Meta */
  falhasMeta: { em: string; falhas: { conta: string; erro: string }[] } | null
}

export async function buscarAlertas(): Promise<Alertas> {
  const [venda, gasto, busca] = await Promise.all([
    ops().rpc('ultima_venda'),
    ops().from('metricas_anuncio_dia').select('gasto_brl').gte('dia', diaBrasilia(-1)).gt('gasto_brl', 0).limit(1),
    ops().from('metricas_buscas').select('feita_em, falhas').order('feita_em', { ascending: false }).limit(1).maybeSingle(),
  ])
  const ultima = (venda.data as string | null) ?? null
  const gastou = (gasto.data?.length ?? 0) > 0
  const semVendas = gastou && (!ultima || Date.now() - new Date(ultima).getTime() > 24 * 3_600_000)
  const falhas = (busca.data?.falhas ?? []) as { conta: string; erro: string }[]
  return {
    semVendasDesde: semVendas ? (ultima ?? '') : null,
    falhasMeta: busca.data && falhas.length ? { em: busca.data.feita_em, falhas } : null,
  }
}
