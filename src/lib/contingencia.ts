import { caido, type Inventario, type Registro } from './ativos'
import { diaBrasilia } from './format'
import { ops } from './supabase'

/**
 * Contingência (etapas 12 e 032): roteiros padrão de aquecimento, quadro por dia,
 * reserva mínima e quedas.
 * Cadastrou um perfil/BM/conta/página → entra sozinho no aquecimento (roteiro padrão do tipo).
 * Marcou todo o checklist → o banco conclui o aquecimento e o ativo fica "Pronto".
 */

export type TipoAquecivel = 'perfil' | 'bm' | 'pagina' | 'conta'
export const TIPOS_AQUECIVEIS: TipoAquecivel[] = ['perfil', 'bm', 'conta', 'pagina']
export const NOME_TIPO: Record<TipoAquecivel, { um: string; varios: string }> = {
  perfil: { um: 'Perfil', varios: 'Perfis' },
  bm: { um: 'BM', varios: 'BMs' },
  conta: { um: 'Conta', varios: 'Contas' },
  pagina: { um: 'Página', varios: 'Páginas' },
}
export const ehAquecivel = (t: string): t is TipoAquecivel => (TIPOS_AQUECIVEIS as string[]).includes(t)

/** Situação do ativo na contingência (coluna "aquecimento" de perfis, BMs, contas e páginas). */
export type SituacaoAquecimento = 'a_classificar' | 'aquecendo' | 'pronto'
export const SITUACAO_AQUECIMENTO: Record<SituacaoAquecimento, { nome: string; icone: string; tom: 'bom' | 'atencao' | 'neutro' }> = {
  a_classificar: { nome: 'A classificar', icone: '?', tom: 'neutro' },
  aquecendo: { nome: 'Aquecendo', icone: '◐', tom: 'atencao' },
  pronto: { nome: 'Pronto', icone: '✓', tom: 'bom' },
}
export const situacaoDe = (r: { [k: string]: unknown } | undefined): SituacaoAquecimento => (r?.aquecimento as SituacaoAquecimento) ?? 'a_classificar'

export type Rotina = { id: string; nome: string; tipo: TipoAquecivel; duracao_dias: number; ativa: boolean; descricao: string | null; padrao: boolean }
export type TarefaRotina = { id: string; rotina_id: string; dia: number | null; texto: string; ordem: number }

export type StatusAquecimento = 'andamento' | 'concluido' | 'interrompido'
export const STATUS_AQUECIMENTO: { valor: StatusAquecimento; nome: string; icone: string }[] = [
  { valor: 'andamento', nome: 'Em andamento', icone: '◐' },
  { valor: 'concluido', nome: 'Concluído', icone: '✓' },
  { valor: 'interrompido', nome: 'Interrompido', icone: '✕' },
]

export type TarefaAquecimento = { id: string; aquecimento_id: string; dia: number; texto: string; diaria: boolean; ordem: number; feito: boolean; feito_em: string | null }
export type Aquecimento = {
  id: string
  ativo_tipo: TipoAquecivel
  ativo_id: string
  rotina_id: string | null
  rotina_nome: string
  duracao_dias: number
  inicio: string
  status: StatusAquecimento
  fim: string | null
  motivo: string | null
  observacoes: string | null
  tarefas: TarefaAquecimento[]
}

export async function buscarRotinas() {
  const [r, t] = await Promise.all([
    ops().from('rotinas_aquecimento').select('id, nome, tipo, duracao_dias, ativa, descricao, padrao').order('nome'),
    ops().from('rotinas_tarefas').select('id, rotina_id, dia, texto, ordem'),
  ])
  const erro = r.error ?? t.error
  if (erro) throw new Error(erro.message)
  return { rotinas: (r.data ?? []) as Rotina[], tarefas: (t.data ?? []) as TarefaRotina[] }
}

export async function buscarAquecimentos(): Promise<Aquecimento[]> {
  const { data, error } = await ops()
    .from('aquecimentos')
    .select('id, ativo_tipo, ativo_id, rotina_id, rotina_nome, duracao_dias, inicio, status, fim, motivo, observacoes, tarefas:aquecimento_tarefas(id, aquecimento_id, dia, texto, diaria, ordem, feito, feito_em)')
    .order('inicio', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Aquecimento[]
}

/** Dias entre duas datas "AAAA-MM-DD". */
export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de.slice(0, 10)}T12:00:00Z`)) / 86_400_000)
}

/** Em que dia do aquecimento estamos (D1 = dia do início). Antes do início devolve 0. */
export function diaAtual(a: Aquecimento, hoje = diaBrasilia()) {
  return Math.max(0, diasEntre(a.inicio, hoje) + 1)
}

export function progresso(a: Aquecimento) {
  const total = a.tarefas.length
  const feitas = a.tarefas.filter((t) => t.feito).length
  return { total, feitas, pct: total ? Math.round((feitas / total) * 100) : 0 }
}

/**
 * Coluna do quadro: o primeiro dia que ainda tem tarefa por marcar.
 * Tudo marcado = 0 (coluna "Pronto").
 */
export function diaDoQuadro(a: Aquecimento) {
  const pendentes = a.tarefas.filter((t) => !t.feito).map((t) => t.dia)
  return pendentes.length ? Math.min(...pendentes) : 0
}

/** Atrasado: o calendário já passou do dia em que o card está. */
export const atrasado = (a: Aquecimento) => a.status === 'andamento' && diaDoQuadro(a) > 0 && diaAtual(a) > diaDoQuadro(a)

export const ordenarTarefas = (ts: TarefaAquecimento[]) => [...ts].sort((x, y) => x.dia - y.dia || x.ordem - y.ordem)

// ---------------------------------------------------------------------
// Reserva mínima
// ---------------------------------------------------------------------
export type Reserva = Record<TipoAquecivel, number>

export async function buscarReserva(): Promise<Reserva> {
  const { data, error } = await ops().from('reserva_minima').select('tipo, minimo')
  if (error) throw new Error(error.message)
  const r: Reserva = { perfil: 0, bm: 0, conta: 0, pagina: 0 }
  for (const x of data ?? []) r[x.tipo as TipoAquecivel] = x.minimo
  return r
}

/**
 * Reserva = prontos e sem uso no momento (não caídos):
 * perfil fora de "Em uso"; conta na coluna "Sem uso" do quadro de uso; página sem oferta ligada; BM pronta.
 */
export function prontos(inv: Inventario, tipo: TipoAquecivel): Registro[] {
  return inv[tipo].filter((r) => {
    if (caido(tipo, r.status as string) || situacaoDe(r) !== 'pronto') return false
    if (tipo === 'perfil') return r.status !== 'em_uso'
    if (tipo === 'conta') return (r.uso ?? 'parada') === 'parada'
    if (tipo === 'pagina') return !inv.ofertasAtivos.some((o) => o.pagina_id === r.id)
    return true
  })
}

export type SituacaoReserva = { tipo: TipoAquecivel; prontos: number; minimo: number; abaixo: boolean }

export function situacaoReserva(inv: Inventario, reserva: Reserva): SituacaoReserva[] {
  return TIPOS_AQUECIVEIS.map((tipo) => {
    const n = prontos(inv, tipo).length
    return { tipo, prontos: n, minimo: reserva[tipo], abaixo: n < reserva[tipo] }
  })
}

// ---------------------------------------------------------------------
// Quedas
// ---------------------------------------------------------------------
export type EventoLog = { id: string; ativo_tipo: string; ativo_id: string; de: string | null; para: string; data: string; motivo: string | null }

/** Mudanças de status reais (sem as linhas das importações). */
export async function buscarHistoricoReal(): Promise<EventoLog[]> {
  const { data, error } = await ops()
    .from('ativos_status_log')
    .select('id, ativo_tipo, ativo_id, de, para, data, motivo')
    .eq('importacao', false)
    .order('data', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EventoLog[]
}
