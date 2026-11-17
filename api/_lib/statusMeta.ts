import type { Ops } from './servidor.js'

/** Status da veiculação a partir do effective_status do anúncio na Meta. */
export function statusDaMeta(s: string): string | null {
  if (s === 'ACTIVE') return 'rodando'
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'pausado'
  if (s === 'DISAPPROVED') return 'rejeitado'
  if (s === 'PENDING_REVIEW' || s === 'IN_PROCESS' || s === 'PREAPPROVED' || s === 'WITH_ISSUES') return 'em_analise'
  return null
}

const POR_VEZ = 50

/**
 * Acompanha o status dos anúncios na Meta (pelo ID principal da veiculação):
 *  - "Não subido" ou "Em análise" → "Rodando" (ativo), "Pausado" ou "Em análise";
 *  - "Rodando" → "Pausado" quando o anúncio foi pausado na Meta.
 * Rejeição fica de fora: é registrada à mão (motivo e categoria) no card.
 * Pausado no app não volta sozinho para Rodando (a pausa pode ter sido decisão nossa).
 */
export async function sincronizarStatus(ops: Ops, token: string, versao: string): Promise<{ mudadas: number; falha: string | null }> {
  const { data, error } = await ops
    .from('veiculacoes')
    .select('id, status, meta_ad_id, cards!inner(arquivado)')
    .not('meta_ad_id', 'is', null)
    .in('status', ['nao_subido', 'em_analise', 'rodando'])
    .eq('cards.arquivado', false)
  if (error) return { mudadas: 0, falha: error.message }
  const lista = (data ?? []) as unknown as { id: string; status: string; meta_ad_id: string }[]

  const naMeta = new Map<string, string>()
  let falha: string | null = null
  for (let i = 0; i < lista.length; i += POR_VEZ) {
    const ids = lista.slice(i, i + POR_VEZ).map((v) => v.meta_ad_id)
    const params = new URLSearchParams({ ids: ids.join(','), fields: 'effective_status', access_token: token })
    try {
      const r = await fetch(`https://graph.facebook.com/${versao}/?${params}`)
      const corpo = (await r.json()) as Record<string, { effective_status?: string }> & { error?: { message: string } }
      if (!r.ok || corpo.error) throw new Error(corpo.error?.message ?? `HTTP ${r.status}`)
      for (const id of ids) {
        const s = corpo[id]?.effective_status
        if (s) naMeta.set(id, s)
      }
    } catch (e) {
      falha = (e as Error).message
    }
  }

  let mudadas = 0
  for (const v of lista) {
    const efetivo = naMeta.get(v.meta_ad_id)
    const st = efetivo ? statusDaMeta(efetivo) : null
    if (!st || st === 'rejeitado' || st === v.status) continue
    if (v.status === 'rodando' && st !== 'pausado') continue
    const { error: e } = await ops.from('veiculacoes').update({ status: st }).eq('id', v.id).eq('status', v.status)
    if (e) falha = e.message
    else mudadas++
  }
  return { mudadas, falha }
}
