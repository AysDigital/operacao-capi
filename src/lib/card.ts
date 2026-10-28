import { diaBrasilia } from './format'
import type { StatusVeiculacao, TipoCard } from './quadro'
import { ops } from './supabase'

export type Anexo = { id: string; titulo: string; url: string; ordem: number }
export type ItemChecklist = { id: string; checklist_id: string; texto: string; feito: boolean; ordem: number }
export type Checklist = { id: string; titulo: string; ordem: number; itens: ItemChecklist[] }
export type VeiculacaoDetalhe = {
  id: string
  conta_id: string
  status: StatusVeiculacao
  meta_ad_id: string | null
  data_status: string
  motivo_rejeicao: string | null
  categoria_rejeicao: string | null
}
export type Membro = { user_id: string; nome: string; cor: string | null }

export type CardDetalhe = {
  id: string
  oferta_id: string
  lista_id: string
  tipo: TipoCard
  formato: string | null
  ad_num: number | null
  hook_num: number | null
  var_num: number | null
  nome: string
  descricao: string | null
  vencedor: boolean
  arquivado: boolean
  prazo: string | null
  criado_em: string
  etiquetas: string[]
  membros: string[]
  anexos: Anexo[]
  veiculacoes: VeiculacaoDetalhe[]
  checklists: Checklist[]
}

const porOrdem = <T extends { ordem: number }>(a: T, b: T) => a.ordem - b.ordem

export async function buscarCardDetalhe(id: string): Promise<CardDetalhe | null> {
  const { data, error } = await ops()
    .from('cards')
    .select(
      `id, oferta_id, lista_id, tipo, formato, ad_num, hook_num, var_num, nome, descricao, vencedor, arquivado, prazo, criado_em,
       card_etiquetas(etiqueta_id), card_membros(user_id),
       anexos(id, titulo, url, ordem),
       veiculacoes(id, conta_id, status, meta_ad_id, data_status, motivo_rejeicao, categoria_rejeicao),
       checklists(id, titulo, ordem, checklist_itens(id, checklist_id, texto, feito, ordem))`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { card_etiquetas, card_membros, checklists, anexos, ...resto } = data as typeof data & {
    checklists: (Omit<Checklist, 'itens'> & { checklist_itens: ItemChecklist[] })[]
  }
  return {
    ...(resto as Omit<CardDetalhe, 'etiquetas' | 'membros' | 'anexos' | 'checklists'>),
    etiquetas: card_etiquetas.map((e: { etiqueta_id: string }) => e.etiqueta_id),
    membros: card_membros.map((m: { user_id: string }) => m.user_id),
    anexos: [...(anexos as Anexo[])].sort(porOrdem),
    checklists: checklists
      .map(({ checklist_itens, ...c }) => ({ ...c, itens: [...checklist_itens].sort(porOrdem) }))
      .sort(porOrdem),
  }
}

// ---------------------------------------------------------------------
// Veiculações
// ---------------------------------------------------------------------
export const CATEGORIAS_REJEICAO = [
  { valor: 'adulto', nome: 'Conteúdo adulto/sexual' },
  { valor: 'saude_corpo', nome: 'Saúde e corpo' },
  { valor: 'promessa_resultado', nome: 'Promessa de resultado' },
  { valor: 'atributos_pessoais', nome: 'Atributos pessoais' },
  { valor: 'sensacionalismo', nome: 'Sensacionalismo' },
  { valor: 'antes_depois', nome: 'Antes e depois' },
  { valor: 'outro', nome: 'Outro' },
] as const

/**
 * ID do anúncio a partir do que foi colado: só o número, ou um link do Gerenciador
 * de Anúncios (selected_ad_ids=, ad_id=...). Devolve null se não achar.
 * O "act=" do link é a conta, não o anúncio, e é ignorado.
 */
export function extrairIdAnuncio(texto: string): string | null {
  const t = texto.trim()
  if (/^\d+$/.test(t)) return t
  let decodificado = t
  try {
    decodificado = decodeURIComponent(t)
  } catch {
    // link com % solto: usa como veio
  }
  const m = decodificado.match(/(?:selected_ad_ids|ad_ids|ad_id|adId|ad)=(\d{6,})/)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------
// Prazo
// ---------------------------------------------------------------------
/** Tom do prazo: vencido (antes de hoje), perto (hoje ou amanhã) ou normal. */
export function situacaoPrazo(prazo: string): 'vencido' | 'perto' | 'normal' {
  const hoje = diaBrasilia()
  if (prazo < hoje) return 'vencido'
  return prazo <= diaBrasilia(1) ? 'perto' : 'normal'
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "2026-10-28" → "28 out". */
export const prazoCurto = (prazo: string) => `${Number(prazo.slice(8, 10))} ${MESES[Number(prazo.slice(5, 7)) - 1]}`

// ---------------------------------------------------------------------
// Anexos: ícone pelo domínio
// ---------------------------------------------------------------------
export function tipoDoLink(url: string): { rotulo: string; cor: string } {
  if (url.startsWith('storage:')) return { rotulo: 'Imagem', cor: '#b07a3e' }
  let host = ''
  let caminho = ''
  try {
    const u = new URL(url)
    host = u.hostname.replace(/^www\./, '')
    caminho = u.pathname
  } catch {
    return { rotulo: 'Link', cor: '#7d786f' }
  }
  if (host === 'docs.google.com') {
    if (caminho.startsWith('/document')) return { rotulo: 'Docs', cor: '#2e7bc4' }
    if (caminho.startsWith('/spreadsheets')) return { rotulo: 'Sheets', cor: '#0e8a6b' }
    if (caminho.startsWith('/presentation')) return { rotulo: 'Slides', cor: '#c98a00' }
    return { rotulo: 'Google', cor: '#2e7bc4' }
  }
  if (host === 'drive.google.com') return { rotulo: 'Drive', cor: '#17b890' }
  if (host.endsWith('figma.com')) return { rotulo: 'Figma', cor: '#a77fd6' }
  if (host.endsWith('canva.com')) return { rotulo: 'Canva', cor: '#22a6b3' }
  if (host.endsWith('youtube.com') || host === 'youtu.be') return { rotulo: 'YouTube', cor: '#c0352b' }
  if (host.endsWith('vimeo.com')) return { rotulo: 'Vimeo', cor: '#3d8fdb' }
  if (host.endsWith('loom.com')) return { rotulo: 'Loom', cor: '#6a5acd' }
  if (host.endsWith('dropbox.com')) return { rotulo: 'Dropbox', cor: '#3d8fdb' }
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return { rotulo: 'Meta', cor: '#2e7bc4' }
  if (host.endsWith('notion.so') || host.endsWith('notion.site')) return { rotulo: 'Notion', cor: '#2b2a28' }
  return { rotulo: host.split('.').slice(-2, -1)[0] || 'Link', cor: '#7d786f' }
}

/** Aceita link sem "https://". */
export const normalizarUrl = (url: string) => (/^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`)
