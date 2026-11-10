import { caido, type Inventario, type Registro } from './ativos'
import { diaBrasilia } from './format'
import { ops } from './supabase'

/**
 * Contingência (etapa 12): rotinas de aquecimento, aquecimentos, reserva mínima e quedas.
 * Nada aqui muda status de ativo nem coluna do quadro de uso: isso é sempre a usuária.
 */

export type TipoAquecivel = 'perfil' | 'pagina' | 'conta'
export const TIPOS_AQUECIVEIS: TipoAquecivel[] = ['perfil', 'conta', 'pagina']
export const NOME_TIPO: Record<TipoAquecivel, { um: string; varios: string }> = {
  perfil: { um: 'Perfil', varios: 'Perfis' },
  conta: { um: 'Conta', varios: 'Contas' },
  pagina: { um: 'Página', varios: 'Páginas' },
}

export type Rotina = { id: string; nome: string; tipo: TipoAquecivel; duracao_dias: number; ativa: boolean; descricao: string | null }
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
    ops().from('rotinas_aquecimento').select('id, nome, tipo, duracao_dias, ativa, descricao').order('nome'),
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

export const ordenarTarefas = (ts: TarefaAquecimento[]) => [...ts].sort((x, y) => x.dia - y.dia || x.ordem - y.ordem)

// ---------------------------------------------------------------------
// Reserva mínima
// ---------------------------------------------------------------------
export type Reserva = Record<TipoAquecivel, number>

export async function buscarReserva(): Promise<Reserva> {
  const { data, error } = await ops().from('reserva_minima').select('tipo, minimo')
  if (error) throw new Error(error.message)
  const r: Reserva = { perfil: 0, conta: 0, pagina: 0 }
  for (const x of data ?? []) r[x.tipo as TipoAquecivel] = x.minimo
  return r
}

/**
 * "Pronto" = não caído, com aquecimento concluído e sem uso no momento:
 * perfil com status "pronto"; conta na coluna "Sem uso" do quadro de uso; página sem oferta ligada.
 */
export function prontos(inv: Inventario, aquecimentos: Aquecimento[], tipo: TipoAquecivel): Registro[] {
  const aquecidos = new Set(aquecimentos.filter((a) => a.ativo_tipo === tipo && a.status === 'concluido').map((a) => a.ativo_id))
  return inv[tipo].filter((r) => {
    if (caido(tipo, r.status as string) || !aquecidos.has(r.id)) return false
    if (tipo === 'perfil') return r.status === 'pronto'
    if (tipo === 'conta') return (r.uso ?? 'parada') === 'parada'
    return !inv.ofertasAtivos.some((o) => o.pagina_id === r.id)
  })
}

export type SituacaoReserva = { tipo: TipoAquecivel; prontos: number; minimo: number; abaixo: boolean }

export function situacaoReserva(inv: Inventario, aquecimentos: Aquecimento[], reserva: Reserva): SituacaoReserva[] {
  return TIPOS_AQUECIVEIS.map((tipo) => {
    const n = prontos(inv, aquecimentos, tipo).length
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
