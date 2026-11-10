import { autenticar, chaveMeta, erro, json } from './_lib/servidor.js'

/**
 * POST /api/meta-contas
 *
 * Busca na Meta o nome (e a moeda) de cada conta de anúncio que tem o ID
 * cadastrado e grava em ops.contas_anuncio. O apelido (C1, C22...) não muda.
 * Grava com o JWT do usuário, então passa pelo RLS do schema ops.
 */

type ContaMeta = { id: string; name?: string; currency?: string }

export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (auth instanceof Response) return auth
  const meta = chaveMeta()
  if (meta instanceof Response) return meta

  const { data: contas, error } = await auth.ops
    .from('contas_anuncio')
    .select('id, apelido, nome, moeda, meta_ad_account_id')
    .not('meta_ad_account_id', 'is', null)
  if (error) return erro(error.message, 500)

  let atualizadas = 0
  const falhas: { conta: string; erro: string }[] = []

  // A Graph API aceita até 50 IDs por chamada (?ids=act_1,act_2...).
  for (let i = 0; i < contas.length; i += 50) {
    const lote = contas.slice(i, i + 50)
    const params = new URLSearchParams({
      ids: lote.map((c) => `act_${c.meta_ad_account_id}`).join(','),
      fields: 'name,currency',
      access_token: meta.token,
    })
    let resposta: Record<string, ContaMeta>
    try {
      const r = await fetch(`https://graph.facebook.com/${meta.versao}/?${params}`)
      const corpo = (await r.json()) as Record<string, ContaMeta> & { error?: { message: string } }
      if (!r.ok || corpo.error) {
        // Se uma conta do lote falha, a Meta recusa o lote inteiro: tenta uma por uma.
        resposta = {}
        for (const c of lote) {
          const p = new URLSearchParams({ fields: 'name,currency', access_token: meta.token })
          const r1 = await fetch(`https://graph.facebook.com/${meta.versao}/act_${c.meta_ad_account_id}?${p}`)
          const c1 = (await r1.json()) as ContaMeta & { error?: { message: string } }
          if (!r1.ok || c1.error) falhas.push({ conta: c.apelido, erro: c1.error?.message ?? `HTTP ${r1.status}` })
          else resposta[`act_${c.meta_ad_account_id}`] = c1
        }
      } else resposta = corpo
    } catch (e) {
      return erro(`A Meta recusou a consulta: ${(e as Error).message}`, 502)
    }

    for (const c of lote) {
      const m = resposta[`act_${c.meta_ad_account_id}`]
      if (!m?.name) continue
      const nome = m.name.trim()
      const moeda = m.currency?.toUpperCase() ?? c.moeda
      if (nome === c.nome && moeda === c.moeda) continue
      const { error: e2 } = await auth.ops.from('contas_anuncio').update({ nome, moeda }).eq('id', c.id)
      if (e2) falhas.push({ conta: c.apelido, erro: e2.message })
      else atualizadas++
    }
  }

  const semId = await auth.ops.from('contas_anuncio').select('apelido').is('meta_ad_account_id', null).order('apelido')
  return json({
    atualizadas,
    falhas,
    sem_id: (semId.data ?? []).map((c) => c.apelido as string),
  })
}
