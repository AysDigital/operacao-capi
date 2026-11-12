import { autenticar, chaveMeta, erro, graphPaginado, json } from './_lib/servidor.js'

/**
 * POST /api/meta-casar   corpo: { oferta?: id da oferta }   (sem oferta = todas)
 *
 * Preenche sozinho o ID do anúncio nas veiculações que ainda não têm ID.
 * Para cada conta com veiculação pendente, lista os anúncios da conta na Meta e
 * casa pelo nome: o nome do anúncio tem "ad{n}-h{n}-m{n}" (ex.: ad12-h1-m2), igual
 * ao AD/H/M do card. Se a conta tem cards de ofertas diferentes com o mesmo AD/H/M,
 * usa o código da oferta no nome (ex.: "PC-EN"). Na dúvida, não preenche e avisa.
 *
 * Também atualiza o status das veiculações que estavam "Não subido", pelo status
 * do anúncio na Meta (o anúncio já existe lá, então não está mais "não subido").
 * Grava com o JWT do usuário (RLS do schema ops).
 */

type Anuncio = { id: string; name: string; effective_status: string }
type Pendente = {
  id: string
  conta_id: string
  status: string
  cards: { id: string; nome: string; tipo: string; ad_num: number | null; hook_num: number | null; var_num: number | null; oferta_id: string; ofertas: { codigo: string; idioma: string } }
  contas_anuncio: { apelido: string; meta_ad_account_id: string | null }
}

const RE = /ad\s*0*(\d+)[\W_]{0,3}h\s*0*(\d+)[\W_]{0,3}m\s*0*(\d+)/i

function statusDaMeta(s: string): string | null {
  if (s === 'ACTIVE') return 'rodando'
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'pausado'
  if (s === 'DISAPPROVED') return 'rejeitado'
  if (s === 'PENDING_REVIEW' || s === 'IN_PROCESS' || s === 'PREAPPROVED' || s === 'WITH_ISSUES') return 'em_analise'
  return null
}

export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (auth instanceof Response) return auth
  const meta = chaveMeta()
  if (meta instanceof Response) return meta

  const corpo = (await request.json().catch(() => ({}))) as { oferta?: string }
  let q = auth.ops
    .from('veiculacoes')
    .select(
      'id, conta_id, status, cards!inner(id, nome, tipo, ad_num, hook_num, var_num, oferta_id, arquivado, ofertas(codigo, idioma)), contas_anuncio(apelido, meta_ad_account_id)',
    )
    .is('meta_ad_id', null)
    .eq('cards.arquivado', false)
    .eq('cards.tipo', 'ad')
  if (corpo.oferta) q = q.eq('cards.oferta_id', corpo.oferta)
  const { data, error } = await q
  if (error) return erro(error.message, 500)
  const pendentes = (data ?? []) as unknown as Pendente[]

  const { data: usados, error: e2 } = await auth.ops.from('veiculacoes_anuncios').select('meta_ad_id')
  if (e2) return erro(e2.message, 500)
  const jaUsados = new Set((usados ?? []).map((u) => u.meta_ad_id as string))

  let preenchidas = 0
  const naoAchados: string[] = []
  const duvidas: string[] = []
  const falhas: { conta: string; erro: string }[] = []
  const semIdConta: string[] = []

  const porConta = new Map<string, Pendente[]>()
  for (const p of pendentes) porConta.set(p.conta_id, [...(porConta.get(p.conta_id) ?? []), p])

  for (const [, lista] of porConta) {
    const conta = lista[0].contas_anuncio
    if (!conta.meta_ad_account_id) {
      semIdConta.push(conta.apelido)
      continue
    }
    let anuncios: Anuncio[]
    try {
      const params = new URLSearchParams({ fields: 'id,name,effective_status', limit: '500', access_token: meta.token })
      anuncios = await graphPaginado<Anuncio>(`https://graph.facebook.com/${meta.versao}/act_${conta.meta_ad_account_id}/ads?${params}`, 5000)
    } catch (e) {
      falhas.push({ conta: conta.apelido, erro: (e as Error).message })
      continue
    }

    // anúncios da conta por AD/H/M
    const porChave = new Map<string, Anuncio[]>()
    for (const a of anuncios) {
      if (jaUsados.has(a.id)) continue
      const m = RE.exec(a.name)
      if (!m) continue
      const k = `${+m[1]}-${+m[2]}-${+m[3]}`
      porChave.set(k, [...(porChave.get(k) ?? []), a])
    }

    for (const p of lista) {
      const c = p.cards
      const k = `${c.ad_num}-${c.hook_num}-${c.var_num}`
      let candidatos = porChave.get(k) ?? []
      // mesma conta com o mesmo AD/H/M em outra oferta pendente: usa o código da oferta no nome
      const outrasOfertas = lista.some((o) => o.id !== p.id && `${o.cards.ad_num}-${o.cards.hook_num}-${o.cards.var_num}` === k)
      if (candidatos.length > 1 || outrasOfertas) {
        const cod = `${c.ofertas.codigo}-${c.ofertas.idioma}`.toLowerCase()
        const comCodigo = candidatos.filter((a) => a.name.toLowerCase().includes(cod))
        if (comCodigo.length) candidatos = comCodigo
        else if (outrasOfertas) candidatos = []
      }
      const rotulo = `${c.nome} em ${conta.apelido}`
      if (candidatos.length === 0) {
        naoAchados.push(rotulo)
        continue
      }
      if (candidatos.length > 1) {
        duvidas.push(`${rotulo} (${candidatos.length} anúncios com esse nome)`)
        continue
      }
      const a = candidatos[0]
      const mudancas: Record<string, unknown> = { meta_ad_id: a.id, nome_no_meta: a.name }
      const st = statusDaMeta(a.effective_status)
      if (p.status === 'nao_subido' && st) mudancas.status = st
      const { error: e3 } = await auth.ops.from('veiculacoes').update(mudancas).eq('id', p.id)
      if (e3) {
        falhas.push({ conta: rotulo, erro: e3.message })
        continue
      }
      jaUsados.add(a.id)
      porChave.set(k, (porChave.get(k) ?? []).filter((x) => x.id !== a.id))
      preenchidas++
    }
  }

  return json({ pendentes: pendentes.length, preenchidas, nao_achados: naoAchados, duvidas, falhas, contas_sem_id: semIdConta })
}
