import type { Veiculacao } from './quadro'
import { ops } from './supabase'

/** Atalhos de motivo de uma versão. */
export const MOTIVOS = ['Rejeitado', 'Ajuste de edição', 'Teste de variação', 'Escala de vencedor'] as const

/** "AD1-H2-M3" (ou "H2-M3" com `semAd`). */
export function nomeCurto(c: { ad_num: number | null; hook_num: number | null; var_num: number | null }, semAd = false) {
  return `${semAd ? '' : `AD${c.ad_num}-`}H${c.hook_num}-M${c.var_num}`
}

/** Próximo H livre do AD e próximo M livre do H (contando arquivados). Só para a prévia: quem decide é o banco. */
export async function proximosNumeros(ofertaId: string, ad: number, hook: number) {
  const { data } = await ops().from('cards').select('hook_num, var_num').eq('oferta_id', ofertaId).eq('tipo', 'ad').eq('ad_num', ad)
  const linhas = data ?? []
  return {
    proxHook: Math.max(0, ...linhas.map((l) => l.hook_num ?? 0)) + 1,
    proxVar: Math.max(0, ...linhas.filter((l) => l.hook_num === hook).map((l) => l.var_num ?? 0)) + 1,
  }
}

/** Próximo AD livre da oferta (contando arquivados). */
export async function proximoAd(ofertaId: string) {
  const { data } = await ops()
    .from('cards')
    .select('ad_num')
    .eq('oferta_id', ofertaId)
    .eq('tipo', 'ad')
    .order('ad_num', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.ad_num ?? 0) + 1
}

export type MembroFamilia = {
  id: string
  hook_num: number
  var_num: number
  lista_id: string
  vencedor: boolean
  arquivado: boolean
  veiculacoes: Veiculacao[]
}

/** Todos os cards Ad da oferta com este AD (inclusive arquivados), em ordem de H e M. */
export async function buscarFamilia(ofertaId: string, ad: number): Promise<MembroFamilia[]> {
  const { data, error } = await ops()
    .from('cards')
    .select('id, hook_num, var_num, lista_id, vencedor, arquivado, veiculacoes(conta_id, status, data_status, meta_ad_id)')
    .eq('oferta_id', ofertaId)
    .eq('tipo', 'ad')
    .eq('ad_num', ad)
    .order('hook_num')
    .order('var_num')
  if (error) throw new Error(error.message)
  return data as MembroFamilia[]
}

/** As funções do banco devolvem a lista de ids (às vezes como objetos de uma coluna). */
export const idsDaResposta = (data: unknown): string[] =>
  (Array.isArray(data) ? data : [data]).map((x) => (typeof x === 'string' ? x : (Object.values(x as object)[0] as string)))
