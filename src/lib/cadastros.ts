import type { PostgrestError } from '@supabase/supabase-js'
import type { Tom } from '../components/ds'

export const IDIOMAS = ['EN', 'ES', 'FR', 'IT', 'PT'] as const
export type Idioma = (typeof IDIOMAS)[number]

export const STATUS_OFERTA = {
  em_producao: { nome: 'Em produção', tom: 'info', icone: '✎' },
  testando: { nome: 'Testando', tom: 'atencao', icone: '◐' },
  validada: { nome: 'Validada', tom: 'bom', icone: '✓' },
  escalando: { nome: 'Escalando', tom: 'bom', icone: '▲' },
  saturando: { nome: 'Saturando', tom: 'ruim', icone: '▼' },
  pausada: { nome: 'Pausada', tom: 'neutro', icone: '‖' },
} as const satisfies Record<string, { nome: string; tom: Tom; icone: string }>
export type StatusOferta = keyof typeof STATUS_OFERTA

/** Cores prontas para ofertas e etiquetas (o coral fica de fora: é a cor de ação). */
export const PALETA = [
  { hex: '#3d8fdb', nome: 'Azul' },
  { hex: '#22a6b3', nome: 'Ciano' },
  { hex: '#17b890', nome: 'Teal' },
  { hex: '#5fa82e', nome: 'Verde' },
  { hex: '#ffd23f', nome: 'Amarelo' },
  { hex: '#f08a24', nome: 'Laranja' },
  { hex: '#c0352b', nome: 'Vermelho' },
  { hex: '#d55181', nome: 'Rosa' },
  { hex: '#a77fd6', nome: 'Lilás' },
  { hex: '#6a5acd', nome: 'Roxo' },
  { hex: '#b07a3e', nome: 'Pelagem' },
  { hex: '#7d786f', nome: 'Cinza' },
] as const

export type Oferta = {
  id: string
  nome: string
  codigo: string
  idioma: Idioma
  cor: string | null
  status: StatusOferta
}

export type ContaAnuncio = {
  id: string
  nome: string
  apelido: string
  bm_nome: string | null
  meta_ad_account_id: string | null
  ativa: boolean
}

export type Etiqueta = { id: string; nome: string; cor: string | null }

/** Contagem embutida do PostgREST (`cards(count)`) → número. */
export const contagem = (v: { count: number }[] | null | undefined) => v?.[0]?.count ?? 0

/** Sigla e apelido: só maiúsculas e números, sem espaço. */
export const soSigla = (s: string, max: number) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max)

/** ID da conta no Meta: aceita "act_123" ou "123" e devolve só o número ('' se vazio). */
export const normalizarIdConta = (s: string) => s.trim().replace(/^act_/i, '')

/**
 * Traduz o erro do banco para português. `porRestricao` dá a mensagem certa para
 * cada restrição (o nome dela aparece na mensagem original).
 */
export function mensagemErro(e: PostgrestError, porRestricao: Record<string, string> = {}) {
  for (const [restricao, texto] of Object.entries(porRestricao)) {
    if (e.message.includes(restricao) || e.details?.includes(restricao)) return texto
  }
  switch (e.code) {
    case '23505':
      return 'Já existe um cadastro com esses dados.'
    case '23503':
      return 'Este cadastro está em uso e não pode ser excluído.'
    case '23514':
      return 'Algum valor não é aceito. Confira os campos.'
    case '42501':
      return 'Sem permissão para esta ação.'
  }
  return e.message
}
