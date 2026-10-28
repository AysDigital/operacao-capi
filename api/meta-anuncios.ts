import { autenticar, chaveMeta, erro, graphPaginado, json } from './_lib/servidor.js'

/**
 * GET /api/meta-anuncios?conta={id da conta em ops.contas_anuncio}
 *
 * Lista os anúncios da conta na Meta (id, nome, status, criação), do mais novo
 * para o mais antigo, para escolher o anúncio na veiculação em vez de colar o ID.
 */

type Anuncio = { id: string; name: string; effective_status: string; created_time: string }

export async function GET(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (auth instanceof Response) return auth
  const meta = chaveMeta()
  if (meta instanceof Response) return meta

  const contaId = new URL(request.url).searchParams.get('conta')
  if (!contaId) return erro('Informe a conta.', 400)
  const { data: conta, error } = await auth.ops.from('contas_anuncio').select('meta_ad_account_id').eq('id', contaId).maybeSingle()
  if (error) return erro(error.message, 500)
  if (!conta?.meta_ad_account_id) return erro('Esta conta não tem o ID do Meta cadastrado.', 404)

  const params = new URLSearchParams({
    fields: 'id,name,effective_status,created_time',
    limit: '200',
    access_token: meta.token,
  })
  try {
    const anuncios = await graphPaginado<Anuncio>(
      `https://graph.facebook.com/${meta.versao}/act_${conta.meta_ad_account_id}/ads?${params}`,
      1000,
    )
    anuncios.sort((a, b) => b.created_time.localeCompare(a.created_time))
    return json({
      anuncios: anuncios.map((a) => ({ id: a.id, nome: a.name, status: a.effective_status, criado_em: a.created_time })),
    })
  } catch (e) {
    return erro(`A Meta recusou a consulta: ${(e as Error).message}`, 502)
  }
}
