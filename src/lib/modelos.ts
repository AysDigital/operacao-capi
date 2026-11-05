import type { OfertaQuadro, TipoCard } from './quadro'
import { ops } from './supabase'

export const FORMATOS = ['VD', 'IMG', 'CAR', 'GIF']

export type AnexoModelo = { titulo: string; url: string }
export type ChecklistModelo = { titulo: string; itens: string[] }

export type Modelo = {
  id: string
  nome: string
  /** null = vale para todas as ofertas */
  oferta_id: string | null
  tipo: TipoCard
  formato: string | null
  /** lista padrão onde o card nasce */
  lista_id: string | null
  descricao: string | null
  anexos: AnexoModelo[]
  checklists: ChecklistModelo[]
  /** prazo = dia da criação + N dias (null = sem prazo) */
  prazo_dias: number | null
  etiquetas: string[]
}

type ModeloBanco = Omit<Modelo, 'etiquetas'> & { modelos_card_etiquetas: { etiqueta_id: string }[] }

const CAMPOS = 'id, nome, oferta_id, tipo, formato, lista_id, descricao, anexos, checklists, prazo_dias, modelos_card_etiquetas(etiqueta_id)'

const converter = ({ modelos_card_etiquetas, ...m }: ModeloBanco): Modelo => ({
  ...m,
  anexos: Array.isArray(m.anexos) ? m.anexos : [],
  checklists: Array.isArray(m.checklists) ? m.checklists : [],
  etiquetas: modelos_card_etiquetas.map((e) => e.etiqueta_id),
})

export async function buscarModelos(): Promise<Modelo[]> {
  const { data, error } = await ops().from('modelos_card').select(CAMPOS).order('nome')
  if (error) throw new Error(error.message)
  return (data as unknown as ModeloBanco[]).map(converter)
}

/** Modelos que valem para a oferta (os gerais e os dela). */
export const modelosDaOferta = (modelos: Modelo[], ofertaId: string | null) =>
  modelos.filter((m) => !m.oferta_id || m.oferta_id === ofertaId)

/** Prévia dos nomes dos ADs novos: os próximos AD livres, cada um com H1-M1. */
export function previaAds(oferta: OfertaQuadro | null | undefined, formato: string | null, primeiroAd: number, quantidade: number) {
  return Array.from(
    { length: quantidade },
    (_, i) => `${oferta?.codigo ?? '?'}-${oferta?.idioma ?? '?'}-AD${primeiroAd + i}-H1-M1-${formato ?? '?'}`,
  )
}

export const textoPrazo = (dias: number | null) =>
  dias === null ? 'Sem prazo' : dias === 0 ? 'No mesmo dia' : `+${dias} ${dias === 1 ? 'dia' : 'dias'}`

/** Cria os cards pelo banco (numa transação só). Devolve os ids novos. */
export async function criarDeModelo(p: {
  modelo: string
  oferta: string
  lista: string
  quantidade?: number
  ad?: number | null
  hook?: number | null
  variacao?: number | null
  nome?: string | null
}) {
  return ops().rpc('criar_de_modelo', {
    p_modelo: p.modelo,
    p_oferta: p.oferta,
    p_lista: p.lista,
    p_quantidade: p.quantidade ?? 1,
    p_ad: p.ad ?? null,
    p_hook: p.hook ?? null,
    p_var: p.variacao ?? null,
    p_nome: p.nome ?? null,
  })
}
