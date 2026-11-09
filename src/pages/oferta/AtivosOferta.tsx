import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Aviso, Carregando, Secao } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { TIPOS } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { ops } from '../../lib/supabase'
import { SeloStatusAtivo, SeloVencimento } from '../ativos/campos'

type ContaUso = { id: string; apelido: string; nome: string; status: string; bm_nome: string | null; rodando: number; total: number }
type Ligado = { id: string; tipo: 'pagina' | 'pixel' | 'dominio'; alvo: string; nome: string; status?: string; vencimento?: string | null }
type Opcao = { id: string; nome: string }

const linkAtivo = (tipo: keyof typeof TIPOS, id: string) => `/ativos?aba=${TIPOS[tipo].aba}&id=${id}`

async function buscar(ofertaId: string) {
  const [veic, liga, pags, pixs, doms] = await Promise.all([
    ops()
      .from('veiculacoes')
      .select('status, conta:contas_anuncio(id, apelido, nome, status, bm_nome), cards!inner(oferta_id, arquivado)')
      .eq('cards.oferta_id', ofertaId)
      .eq('cards.arquivado', false),
    ops()
      .from('ofertas_ativos')
      .select('id, pagina:paginas(id, nome, status), pixel:pixels(id, nome), dominio:dominios(id, dominio, vencimento)')
      .eq('oferta_id', ofertaId),
    ops().from('paginas').select('id, nome').order('nome'),
    ops().from('pixels').select('id, nome').order('nome'),
    ops().from('dominios').select('id, nome:dominio').order('dominio'),
  ])
  const erro = veic.error ?? liga.error ?? pags.error ?? pixs.error ?? doms.error
  if (erro) throw new Error(erro.message)

  const contas = new Map<string, ContaUso>()
  for (const v of (veic.data ?? []) as unknown as { status: string; conta: Omit<ContaUso, 'rodando' | 'total'> }[]) {
    const c = contas.get(v.conta.id) ?? { ...v.conta, rodando: 0, total: 0 }
    c.total++
    if (v.status === 'rodando') c.rodando++
    contas.set(c.id, c)
  }

  type Linha = {
    id: string
    pagina: { id: string; nome: string; status: string } | null
    pixel: { id: string; nome: string } | null
    dominio: { id: string; dominio: string; vencimento: string | null } | null
  }
  const ligados: Ligado[] = ((liga.data ?? []) as unknown as Linha[]).map((l) =>
    l.pagina
      ? { id: l.id, tipo: 'pagina', alvo: l.pagina.id, nome: l.pagina.nome, status: l.pagina.status }
      : l.pixel
        ? { id: l.id, tipo: 'pixel', alvo: l.pixel.id, nome: l.pixel.nome }
        : { id: l.id, tipo: 'dominio', alvo: l.dominio!.id, nome: l.dominio!.dominio, vencimento: l.dominio!.vencimento },
  )

  return {
    contas: [...contas.values()].sort((a, b) => b.rodando - a.rodando || a.apelido.localeCompare(b.apelido, 'pt-BR', { numeric: true })),
    ligados,
    opcoes: { pagina: (pags.data ?? []) as Opcao[], pixel: (pixs.data ?? []) as Opcao[], dominio: (doms.data ?? []) as Opcao[] },
  }
}

export function AtivosOferta({ ofertaId }: { ofertaId: string }) {
  const toast = useToast()
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscar>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => buscar(ofertaId).then(setDados, (e: Error) => setErro(e.message)), [ofertaId])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function ligar(tipo: Ligado['tipo'], id: string) {
    const { error } = await ops()
      .from('ofertas_ativos')
      .insert({ oferta_id: ofertaId, [`${tipo}_id`]: id })
    if (error) return toast('ruim', mensagemErro(error))
    carregar()
  }
  async function desligar(l: Ligado) {
    const { error } = await ops().from('ofertas_ativos').delete().eq('id', l.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Tirado da oferta.')
    carregar()
  }

  if (erro) return <Aviso tom="ruim">Não foi possível carregar os ativos: {erro}</Aviso>
  if (!dados) return <Carregando linhas={4} altura="h-10" />

  return (
    <div className="space-y-8">
      <Secao titulo="Contas" ajuda="Contas de anúncio onde os cards desta oferta têm veiculação. Vêm sozinhas das veiculações dos cards.">
        {dados.contas.length === 0 ? (
          <p className="text-sm text-muted">Nenhum card desta oferta tem veiculação ainda.</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {dados.contas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-xs font-semibold text-info">{c.apelido}</span>
                <Link to={linkAtivo('conta', c.id)} className="font-medium hover:text-accent-strong hover:underline">
                  {c.nome}
                </Link>
                {c.bm_nome && <span className="text-muted">{c.bm_nome}</span>}
                <SeloStatusAtivo tipo="conta" status={c.status} />
                <span className="ml-auto text-xs text-muted tabular-nums">
                  {c.rodando} rodando · {c.total} veiculações
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {(['pagina', 'pixel', 'dominio'] as const).map((tipo) => {
        const meus = dados.ligados.filter((l) => l.tipo === tipo)
        const livres = dados.opcoes[tipo].filter((o) => !meus.some((m) => m.alvo === o.id))
        return (
          <Secao
            key={tipo}
            titulo={TIPOS[tipo].varios}
            acoes={
              <select
                value=""
                onChange={(e) => e.target.value && ligar(tipo, e.target.value)}
                aria-label={`Adicionar ${TIPOS[tipo].um.toLowerCase()}`}
                className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
                disabled={!livres.length}
              >
                <option value="">{livres.length ? `+ ${TIPOS[tipo].um}` : `Cadastre em Ativos → ${TIPOS[tipo].varios}`}</option>
                {livres.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            }
          >
            {meus.length === 0 ? (
              <p className="text-sm text-muted">Nenhum{TIPOS[tipo].nova ? 'a' : ''} ligad{TIPOS[tipo].nova ? 'a' : 'o'} a esta oferta.</p>
            ) : (
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {meus.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <Link to={linkAtivo(tipo, l.alvo)} className="font-medium hover:text-accent-strong hover:underline">
                      {l.nome}
                    </Link>
                    {l.status && <SeloStatusAtivo tipo="pagina" status={l.status} />}
                    {tipo === 'dominio' && l.vencimento && <SeloVencimento dia={l.vencimento} />}
                    <button onClick={() => desligar(l)} className="ml-auto rounded-control px-2 py-0.5 text-xs text-muted hover:bg-bad-soft hover:text-bad">
                      Tirar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        )
      })}
    </div>
  )
}
