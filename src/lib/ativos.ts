import type { Tom } from '../components/ds'
import { ops } from './supabase'

/** Tipos de ativo (cada um é uma aba da página Ativos). */
export type TipoAtivo = 'perfil' | 'bm' | 'conta' | 'pagina' | 'pixel' | 'dominio' | 'cartao' | 'fornecedor'
/** Ativos que entram em acessos (têm dona e compartilhamentos). */
export type TipoAcessavel = 'perfil' | 'bm' | 'conta' | 'pagina' | 'pixel'
/** Quem dá acesso: BM ou perfil. */
export type TipoTitular = 'bm' | 'perfil'
/** Ativos com status (e histórico de status). */
export type TipoComStatus = 'perfil' | 'bm' | 'conta' | 'pagina' | 'pixel'

export const ACESSAVEIS: TipoAcessavel[] = ['perfil', 'bm', 'conta', 'pagina', 'pixel']
export const COM_STATUS: TipoComStatus[] = ['perfil', 'bm', 'conta', 'pagina', 'pixel']
export const ehAcessavel = (t: TipoAtivo): t is TipoAcessavel => (ACESSAVEIS as string[]).includes(t)
export const temStatus = (t: TipoAtivo): t is TipoComStatus => (COM_STATUS as string[]).includes(t)
export const ehTitular = (t: TipoAtivo): t is TipoTitular => t === 'bm' || t === 'perfil'

export const TABELA: Record<TipoAtivo, string> = {
  perfil: 'perfis',
  bm: 'bms',
  conta: 'contas_anuncio',
  pagina: 'paginas',
  pixel: 'pixels',
  dominio: 'dominios',
  cartao: 'cartoes',
  fornecedor: 'fornecedores',
}

/** Nome de cada tipo (singular, plural, gênero para "Novo/Nova") e a aba na URL. */
export const TIPOS: Record<TipoAtivo, { um: string; varios: string; nova: boolean; aba: string }> = {
  perfil: { um: 'Perfil', varios: 'Perfis', nova: false, aba: 'perfis' },
  bm: { um: 'BM', varios: 'BMs', nova: true, aba: 'bms' },
  conta: { um: 'Conta', varios: 'Contas', nova: true, aba: 'contas' },
  pagina: { um: 'Página', varios: 'Páginas', nova: true, aba: 'paginas' },
  pixel: { um: 'Pixel', varios: 'Pixels', nova: false, aba: 'pixels' },
  dominio: { um: 'Domínio', varios: 'Domínios', nova: false, aba: 'dominios' },
  cartao: { um: 'Cartão', varios: 'Cartões', nova: false, aba: 'cartoes' },
  fornecedor: { um: 'Fornecedor', varios: 'Fornecedores', nova: false, aba: 'fornecedores' },
}
export const ORDEM_ABAS: TipoAtivo[] = ['perfil', 'bm', 'conta', 'pagina', 'pixel', 'dominio', 'cartao', 'fornecedor']
export const tipoDaAba = (aba: string | null): TipoAtivo => ORDEM_ABAS.find((t) => TIPOS[t].aba === aba) ?? 'perfil'

/**
 * Status com as mesmas cores em todo o sistema:
 * verde = ok, amarelo = atenção, vermelho = caído, cinza = morto.
 */
type InfoStatus = { nome: string; tom: Tom; icone: string; caido: boolean }
const OK = (nome: string): InfoStatus => ({ nome, tom: 'bom', icone: '✓', caido: false })
const ATENCAO = (nome: string): InfoStatus => ({ nome, tom: 'atencao', icone: '◐', caido: false })
const CAIDO = (nome: string): InfoStatus => ({ nome, tom: 'ruim', icone: '!', caido: true })
const MORTO = (nome: string): InfoStatus => ({ nome, tom: 'neutro', icone: '✕', caido: true })

const STATUS_BM = { ativa: OK('Ativa'), restrita: CAIDO('Restrita'), desativada: MORTO('Desativada') }

export const STATUS_ATIVO: Record<TipoComStatus, Record<string, InfoStatus>> = {
  perfil: {
    aquecendo: ATENCAO('Aquecendo'),
    pronto: OK('Pronto'),
    em_uso: OK('Em uso'),
    checkpoint: CAIDO('Checkpoint'),
    restrito: CAIDO('Restrito'),
    morto: MORTO('Morto'),
  },
  bm: STATUS_BM,
  conta: STATUS_BM,
  pagina: STATUS_BM,
  pixel: { ativo: OK('Ativo'), desativado: MORTO('Desativado') },
}

export function infoStatus(tipo: TipoAtivo, status: string | null | undefined): InfoStatus | null {
  if (!temStatus(tipo) || !status) return null
  return STATUS_ATIVO[tipo][status] ?? { nome: status, tom: 'neutro', icone: '•', caido: false }
}
export const caido = (tipo: TipoAtivo, status: string | null | undefined) => Boolean(infoStatus(tipo, status)?.caido)

export const ORIGENS = [
  { valor: 'comprado', nome: 'Comprado' },
  { valor: 'proprio', nome: 'Pessoal' },
  { valor: 'aquecido', nome: 'Aquecido por nós' },
]
export const NIVEIS = [
  { valor: 'admin', nome: 'Admin' },
  { valor: 'anunciante', nome: 'Anunciante' },
  { valor: 'analista', nome: 'Analista' },
]
export const nomeNivel = (n: string) => NIVEIS.find((x) => x.valor === n)?.nome ?? n

/** Linha genérica de qualquer tabela de ativos. */
export type Registro = { id: string; [campo: string]: unknown }

export type Acesso = {
  id: string
  ativo_tipo: TipoAcessavel
  ativo_id: string
  titular_tipo: TipoTitular
  titular_id: string
  papel: 'dona' | 'compartilhado'
  nivel: string
  desde: string
  ativo: boolean
  inativado_em: string | null
  motivo_inativo: string | null
}

export type OfertaAtivo = { id: string; oferta_id: string; pagina_id: string | null; pixel_id: string | null; dominio_id: string | null }

export type Inventario = Record<TipoAtivo, Registro[]> & { acessos: Acesso[]; ofertasAtivos: OfertaAtivo[] }

export async function buscarInventario(): Promise<Inventario> {
  const r = await Promise.all([
    ...ORDEM_ABAS.map((t) => ops().from(TABELA[t]).select(t === 'conta' ? '*, veiculacoes(count)' : '*')),
    ops().from('acessos').select('id, ativo_tipo, ativo_id, titular_tipo, titular_id, papel, nivel, desde, ativo, inativado_em, motivo_inativo'),
    ops().from('ofertas_ativos').select('id, oferta_id, pagina_id, pixel_id, dominio_id'),
  ])
  const erro = r.find((x) => x.error)?.error
  if (erro) throw new Error(erro.message)
  const inv = {} as Inventario
  ORDEM_ABAS.forEach((t, i) => (inv[t] = (r[i].data ?? []) as unknown as Registro[]))
  inv.acessos = (r[ORDEM_ABAS.length].data ?? []) as Acesso[]
  inv.ofertasAtivos = (r[ORDEM_ABAS.length + 1].data ?? []) as OfertaAtivo[]
  return inv
}

const texto = (v: unknown) => (v == null ? '' : String(v))

/** Nome de exibição de qualquer ativo. */
export function nomeDe(tipo: TipoAtivo, r: Registro | undefined): string {
  if (!r) return '(excluído)'
  if (tipo === 'conta') return `${texto(r.apelido)} · ${texto(r.nome)}`
  if (tipo === 'dominio') return texto(r.dominio)
  if (tipo === 'cartao') return `${texto(r.apelido)} ••${texto(r.ultimos4)}`
  return texto(r.nome)
}

export const acharAtivo = (inv: Inventario, tipo: TipoAtivo, id: string) => inv[tipo].find((r) => r.id === id)
export const nomeAtivo = (inv: Inventario, tipo: TipoAtivo, id: string) => nomeDe(tipo, acharAtivo(inv, tipo, id))

/** Um acesso conta se está ativo e quem dá o acesso (BM ou perfil) não está caído. */
export function acessoValido(inv: Inventario, a: Acesso) {
  return a.ativo && !caido(a.titular_tipo, acharAtivo(inv, a.titular_tipo, a.titular_id)?.status as string)
}

export const acessosDoAtivo = (inv: Inventario, tipo: TipoAtivo, id: string) =>
  inv.acessos.filter((a) => a.ativo_tipo === tipo && a.ativo_id === id)
export const acessosDoTitular = (inv: Inventario, tipo: TipoAtivo, id: string) =>
  inv.acessos.filter((a) => a.titular_tipo === tipo && a.titular_id === id)

/** Dona ativa de um ativo (se houver). */
export const donaDe = (inv: Inventario, tipo: TipoAtivo, id: string) =>
  acessosDoAtivo(inv, tipo, id).find((a) => a.ativo && a.papel === 'dona')

/**
 * Ativos que hoje dependem de uma única BM ou perfil: o ativo não está caído e só
 * tem um acesso valendo. São os que se perdem numa queda.
 */
export function dependentesUnicos(inv: Inventario) {
  const r: { tipo: TipoAcessavel; id: string; nome: string; via: Acesso }[] = []
  for (const tipo of ACESSAVEIS) {
    for (const at of inv[tipo]) {
      if (caido(tipo, at.status as string)) continue
      const validos = acessosDoAtivo(inv, tipo, at.id).filter((a) => acessoValido(inv, a))
      if (validos.length === 1) r.push({ tipo, id: at.id, nome: nomeDe(tipo, at), via: validos[0] })
    }
  }
  return r
}

/**
 * Tudo o que uma BM ou perfil alcança pelos acessos ativos (em cascata: o que as BMs
 * e perfis que ela acessa alcançam também). Usado para achar contas, ofertas e ads.
 */
export function alcance(inv: Inventario, tipo: TipoTitular, id: string) {
  const vistos = new Set<string>([`${tipo}:${id}`])
  const fila: [TipoTitular, string][] = [[tipo, id]]
  const r: { tipo: TipoAcessavel; id: string }[] = []
  while (fila.length) {
    const [t, i] = fila.shift()!
    for (const a of acessosDoTitular(inv, t, i)) {
      const k = `${a.ativo_tipo}:${a.ativo_id}`
      if (!a.ativo || vistos.has(k)) continue
      vistos.add(k)
      r.push({ tipo: a.ativo_tipo, id: a.ativo_id })
      if (a.ativo_tipo === 'bm' || a.ativo_tipo === 'perfil') fila.push([a.ativo_tipo, a.ativo_id])
    }
  }
  return r
}

/**
 * Posse e acesso de uma BM ou perfil, descendo pela cadeia.
 * possui: o que ele tem como dona, mais o que as BMs dele têm como dona (e assim por diante).
 * acessa: o resto do que ele alcança (compartilhado com ele ou com as BMs dele).
 */
export function posseEAcesso(inv: Inventario, tipo: TipoTitular, id: string) {
  const vistos = new Set<string>([`${tipo}:${id}`])
  const fila: [TipoTitular, string][] = [[tipo, id]]
  const possui: { tipo: TipoAcessavel; id: string }[] = []
  while (fila.length) {
    const [t, i] = fila.shift()!
    for (const a of acessosDoTitular(inv, t, i)) {
      const k = `${a.ativo_tipo}:${a.ativo_id}`
      if (!a.ativo || a.papel !== 'dona' || vistos.has(k)) continue
      vistos.add(k)
      possui.push({ tipo: a.ativo_tipo, id: a.ativo_id })
      if (a.ativo_tipo === 'bm' || a.ativo_tipo === 'perfil') fila.push([a.ativo_tipo, a.ativo_id])
    }
  }
  const acessa = alcance(inv, tipo, id).filter((x) => !vistos.has(`${x.tipo}:${x.id}`))
  return { possui, acessa }
}

/** "1 BM · 3 contas · 2 páginas" */
export function resumoPorTipo(itens: { tipo: TipoAcessavel }[]) {
  return ACESSAVEIS.map((t) => {
    const q = itens.filter((x) => x.tipo === t).length
    const nome = q === 1 ? TIPOS[t].um : TIPOS[t].varios
    return q ? `${q} ${t === 'bm' ? nome : nome.toLowerCase()}` : null
  })
    .filter(Boolean)
    .join(' · ')
}

/** Quantas ligações impedem excluir o ativo (acessos, ofertas, veiculações, uso por outros cadastros). */
export function ligacoes(inv: Inventario, tipo: TipoAtivo, r: Registro): string[] {
  const l: string[] = []
  const n = (q: number, um: string, varios: string) => q > 0 && l.push(`${q} ${q === 1 ? um : varios}`)
  if (ehAcessavel(tipo)) n(acessosDoAtivo(inv, tipo, r.id).length, 'acesso a ele', 'acessos a ele')
  if (ehTitular(tipo)) n(acessosDoTitular(inv, tipo, r.id).length, 'acesso que ele dá', 'acessos que ele dá')
  if (tipo === 'pagina' || tipo === 'pixel' || tipo === 'dominio')
    n(inv.ofertasAtivos.filter((o) => o[`${tipo}_id`] === r.id).length, 'oferta', 'ofertas')
  if (tipo === 'conta') n((r.veiculacoes as { count: number }[] | undefined)?.[0]?.count ?? 0, 'veiculação', 'veiculações')
  if (tipo === 'cartao') n(inv.conta.filter((c) => c.cartao_id === r.id).length, 'conta usando', 'contas usando')
  if (tipo === 'fornecedor')
    n(inv.perfil.filter((p) => p.fornecedor_id === r.id).length + inv.bm.filter((b) => b.fornecedor_id === r.id).length, 'perfil/BM comprado', 'perfis/BMs comprados')
  return l
}

/** Resultado de "E se cair?" (ops.simular_queda). */
export type ItemQueda = { tipo: TipoAcessavel; id: string; nome: string; status: string | null }
export type ResultadoQueda = {
  perdidos: ItemQueda[]
  seguros: (ItemQueda & { via: { tipo: TipoTitular; id: string; nome: string; papel: string }[] | null })[]
  ofertas: { id: string; nome: string; codigo: string; idioma: string; cor: string | null; por: string[] }[]
  ads: { card_id: string; nome: string; oferta_id: string; status: string; conta: string }[]
}

export async function simularQueda(tipo: TipoTitular, id: string): Promise<ResultadoQueda> {
  const { data, error } = await ops().rpc('simular_queda', { p_tipo: tipo, p_id: id })
  if (error) throw new Error(error.message)
  return data as ResultadoQueda
}

export type EventoStatus = { id: string; de: string | null; para: string; data: string; motivo: string | null; autor_id: string | null }

export async function buscarHistoricoStatus(tipo: TipoComStatus, id: string): Promise<EventoStatus[]> {
  const { data, error } = await ops()
    .from('ativos_status_log')
    .select('id, de, para, data, motivo, autor_id')
    .eq('ativo_tipo', tipo)
    .eq('ativo_id', id)
    .order('data', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Ads rodando (ou em análise) nas contas informadas, com a oferta. */
export type AdRodando = { card_id: string; nome: string; oferta_id: string; status: string; conta_id: string }

export async function buscarAdsNasContas(contas: string[]): Promise<AdRodando[]> {
  if (!contas.length) return []
  const { data, error } = await ops()
    .from('veiculacoes')
    .select('card_id, conta_id, status, cards!inner(nome, oferta_id, arquivado)')
    .in('conta_id', contas)
    .in('status', ['rodando', 'em_analise'])
    .eq('cards.arquivado', false)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as { card_id: string; conta_id: string; status: string; cards: { nome: string; oferta_id: string } }[]).map((v) => ({
    card_id: v.card_id,
    conta_id: v.conta_id,
    status: v.status,
    nome: v.cards.nome,
    oferta_id: v.cards.oferta_id,
  }))
}
