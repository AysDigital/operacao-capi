import type { Tom } from '../components/ds'
import type { Idioma, StatusOferta } from './cadastros'
import { ops } from './supabase'

export type Lista = { id: string; nome: string; ordem: number; cor: string | null; arquivada: boolean }
export type OfertaQuadro = { id: string; nome: string; codigo: string; idioma: Idioma; cor: string | null; status: StatusOferta }
export type ContaQuadro = { id: string; apelido: string; nome: string; bm_nome: string | null; ativa: boolean; meta_ad_account_id: string | null }
export type TipoCard = 'ad' | 'vsl' | 'outro'
export type StatusVeiculacao = 'nao_subido' | 'em_analise' | 'rodando' | 'rejeitado' | 'pausado'

export type Veiculacao = { conta_id: string; status: StatusVeiculacao; data_status: string; meta_ad_id: string | null }

export type CardQuadro = {
  id: string
  oferta_id: string
  lista_id: string
  posicao: number
  tipo: TipoCard
  nome: string
  vencedor: boolean
  arquivado: boolean
  lista_desde: string
  criado_em: string
  prazo: string | null
  etiquetas: string[]
  veiculacoes: Veiculacao[]
  anexos: number
  comentarios: number
  checklist: { feitos: number; total: number }
}

export const TIPOS: { valor: TipoCard; nome: string }[] = [
  { valor: 'ad', nome: 'Ad' },
  { valor: 'vsl', nome: 'VSL' },
  { valor: 'outro', nome: 'Outro' },
]

export const STATUS_VEICULACAO: Record<StatusVeiculacao, { nome: string; tom: Tom; icone: string }> = {
  nao_subido: { nome: 'Não subido', tom: 'neutro', icone: '○' },
  em_analise: { nome: 'Em análise', tom: 'atencao', icone: '◔' },
  rodando: { nome: 'Rodando', tom: 'bom', icone: '▶' },
  rejeitado: { nome: 'Rejeitado', tom: 'ruim', icone: '✕' },
  pausado: { nome: 'Pausado', tom: 'neutro', icone: '‖' },
}

/** Opções de "Ordenar por" de uma lista. */
export const ORDENACOES: { nome: string; comparar: (a: CardQuadro, b: CardQuadro) => number }[] = [
  { nome: 'Nome (A–Z)', comparar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }) },
  { nome: 'Mais novos primeiro', comparar: (a, b) => b.criado_em.localeCompare(a.criado_em) },
  { nome: 'Mais antigos primeiro', comparar: (a, b) => a.criado_em.localeCompare(b.criado_em) },
  { nome: 'Há mais tempo na lista', comparar: (a, b) => a.lista_desde.localeCompare(b.lista_desde) },
]

/** Listas onde o tempo parado não é problema (sem destaque amarelo/vermelho). */
export const LISTAS_SEM_PRAZO = ['Standby', 'Em veiculação', 'Rejeitado']

const CAMPOS_CARD = `id, oferta_id, lista_id, posicao, tipo, nome, vencedor, arquivado, lista_desde, criado_em, prazo,
  card_etiquetas(etiqueta_id), veiculacoes(conta_id, status, data_status, meta_ad_id),
  anexos(count), comentarios(count), checklists(checklist_itens(feito))`

type CardBanco = Omit<CardQuadro, 'etiquetas' | 'veiculacoes' | 'anexos' | 'comentarios' | 'checklist'> & {
  card_etiquetas: { etiqueta_id: string }[]
  veiculacoes: Veiculacao[]
  anexos: { count: number }[]
  comentarios: { count: number }[]
  checklists: { checklist_itens: { feito: boolean }[] }[]
}

function converter(c: CardBanco): CardQuadro {
  const itens = c.checklists.flatMap((l) => l.checklist_itens)
  return {
    id: c.id,
    oferta_id: c.oferta_id,
    lista_id: c.lista_id,
    posicao: c.posicao,
    tipo: c.tipo,
    nome: c.nome,
    vencedor: c.vencedor,
    arquivado: c.arquivado,
    lista_desde: c.lista_desde,
    criado_em: c.criado_em,
    prazo: c.prazo,
    etiquetas: c.card_etiquetas.map((e) => e.etiqueta_id),
    veiculacoes: c.veiculacoes,
    anexos: c.anexos[0]?.count ?? 0,
    comentarios: c.comentarios[0]?.count ?? 0,
    checklist: { feitos: itens.filter((i) => i.feito).length, total: itens.length },
  }
}

/** Cards do quadro (todas as ofertas ou uma). O banco devolve no máximo 1000 por vez, então busca em páginas. */
export async function buscarCards(ofertaId: string | null, comArquivados: boolean): Promise<CardQuadro[]> {
  const pagina = 1000
  const todos: CardQuadro[] = []
  for (let inicio = 0; ; inicio += pagina) {
    let q = ops().from('cards').select(CAMPOS_CARD).order('posicao').order('id').range(inicio, inicio + pagina - 1)
    if (ofertaId) q = q.eq('oferta_id', ofertaId)
    if (!comArquivados) q = q.eq('arquivado', false)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    todos.push(...(data as unknown as CardBanco[]).map(converter))
    if (data.length < pagina) return todos
  }
}

export async function buscarCard(id: string): Promise<CardQuadro | null> {
  const { data, error } = await ops().from('cards').select(CAMPOS_CARD).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? converter(data as unknown as CardBanco) : null
}

const PASSO = 1024

/**
 * Posição para um card que vai ficar entre `antes` e `depois` (vizinhos na lista).
 * Usa o meio do intervalo, então só o card movido é gravado. `null` quando o
 * intervalo ficou pequeno demais e a lista precisa ser renumerada.
 */
export function posicaoEntre(antes: number | undefined, depois: number | undefined): number | null {
  if (antes === undefined && depois === undefined) return PASSO
  if (antes === undefined) return depois! - PASSO
  if (depois === undefined) return antes + PASSO
  const meio = (antes + depois) / 2
  return depois - antes > 1e-6 ? meio : null
}

/** Posições novas e espaçadas para uma lista inteira (raro: só quando `posicaoEntre` esgota). */
export const renumerar = (ids: string[]) => ids.map((id, i) => ({ id, posicao: (i + 1) * PASSO }))

/** "agora", "5h", "3d". */
export function tempoDesde(iso: string, agora: number) {
  const horas = (agora - new Date(iso).getTime()) / 3_600_000
  if (horas < 1) return 'agora'
  if (horas < 24) return `${Math.floor(horas)}h`
  return `${Math.floor(horas / 24)}d`
}

export const diasDesde = (iso: string, agora: number) => (agora - new Date(iso).getTime()) / 86_400_000

// ---------------------------------------------------------------------
// Filtros (guardados na URL)
// ---------------------------------------------------------------------
export type Filtros = {
  busca: string
  etiqueta: string
  tipo: TipoCard | ''
  conta: string
  status: StatusVeiculacao | ''
  vencedores: boolean
  arquivados: boolean
}

export function lerFiltros(p: URLSearchParams): Filtros {
  return {
    busca: p.get('q') ?? '',
    etiqueta: p.get('etiqueta') ?? '',
    tipo: (p.get('tipo') as TipoCard | null) ?? '',
    conta: p.get('conta') ?? '',
    status: (p.get('status') as StatusVeiculacao | null) ?? '',
    vencedores: p.get('vencedores') === '1',
    arquivados: p.get('arquivados') === '1',
  }
}

export function gravarFiltros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams()
  if (f.busca) p.set('q', f.busca)
  if (f.etiqueta) p.set('etiqueta', f.etiqueta)
  if (f.tipo) p.set('tipo', f.tipo)
  if (f.conta) p.set('conta', f.conta)
  if (f.status) p.set('status', f.status)
  if (f.vencedores) p.set('vencedores', '1')
  if (f.arquivados) p.set('arquivados', '1')
  return p
}

export const temFiltro = (f: Filtros) => Boolean(f.busca || f.etiqueta || f.tipo || f.conta || f.status || f.vencedores || f.arquivados)

export function passaNoFiltro(c: CardQuadro, f: Filtros): boolean {
  if (f.busca && !c.nome.toLowerCase().includes(f.busca.trim().toLowerCase())) return false
  if (f.etiqueta && !c.etiquetas.includes(f.etiqueta)) return false
  if (f.tipo && c.tipo !== f.tipo) return false
  if (f.vencedores && !c.vencedor) return false
  if (f.conta || f.status) {
    const ok = c.veiculacoes.some((v) => (!f.conta || v.conta_id === f.conta) && (!f.status || v.status === f.status))
    if (!ok) return false
  }
  return true
}

// ---------------------------------------------------------------------
// Preferências guardadas no navegador
// ---------------------------------------------------------------------
export function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}

export function gravarLocal(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // sem armazenamento local: só não lembra
  }
}
