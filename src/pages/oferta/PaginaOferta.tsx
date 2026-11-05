import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Aviso, BolinhaCor, Carregando, Vazio } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao } from '../../components/ui'
import { mensagemErro, STATUS_OFERTA, type StatusOferta } from '../../lib/cadastros'
import { buscarOferta, type OfertaCompleta } from '../../lib/oferta'
import type { ContaQuadro, Lista, OfertaQuadro } from '../../lib/quadro'
import { ops } from '../../lib/supabase'
import { ModalOferta } from '../Ofertas'
import { ChecklistOferta } from './ChecklistOferta'
import { TestesOferta } from './TestesOferta'
import { VisaoGeral } from './VisaoGeral'

const ABAS = [
  { valor: 'geral', nome: 'Visão geral' },
  { valor: 'checklist', nome: 'Checklist' },
  { valor: 'testes', nome: 'Testes' },
] as const
type Aba = (typeof ABAS)[number]['valor']

type Base = { listas: Lista[]; ofertas: OfertaQuadro[]; contas: ContaQuadro[]; membros: { user_id: string; nome: string }[] }

async function buscarBase(): Promise<Base> {
  const [listas, ofertas, contas, membros] = await Promise.all([
    ops().from('listas').select('id, nome, ordem, cor, arquivada').order('ordem'),
    ops().from('ofertas').select('id, nome, codigo, idioma, cor, status').order('nome'),
    ops().from('contas_anuncio').select('id, apelido, nome, bm_nome, ativa, meta_ad_account_id'),
    ops().from('membros').select('user_id, nome'),
  ])
  const erro = listas.error ?? ofertas.error ?? contas.error ?? membros.error
  if (erro) throw new Error(erro.message)
  return { listas: listas.data ?? [], ofertas: ofertas.data as OfertaQuadro[], contas: contas.data as ContaQuadro[], membros: membros.data ?? [] }
}

export function PaginaOferta() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const aba = (ABAS.some((a) => a.valor === params.get('aba')) ? params.get('aba') : 'geral') as Aba
  const toast = useToast()
  const [oferta, setOferta] = useState<OfertaCompleta | null | 'nao_existe'>(null)
  const [base, setBase] = useState<Base | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const [editando, setEditando] = useState(false)
  const [cards, setCards] = useState(0)

  const carregar = useCallback(() => {
    buscarOferta(id).then((o) => setOferta(o ?? 'nao_existe'), (e: Error) => setErro(e.message))
    ops()
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('oferta_id', id)
      .then(({ count }) => setCards(count ?? 0))
  }, [id])

  useEffect(() => {
    carregar()
    buscarBase().then(setBase, (e: Error) => setErro(e.message))
  }, [carregar])

  const mudou = useCallback(() => {
    setVersao((v) => v + 1)
    carregar()
  }, [carregar])

  async function mudarStatus(status: StatusOferta) {
    if (!oferta || oferta === 'nao_existe') return
    setOferta({ ...oferta, status })
    const { error } = await ops().from('ofertas').update({ status }).eq('id', oferta.id)
    if (error) toast('ruim', mensagemErro(error))
    else toast('bom', `Status: ${STATUS_OFERTA[status].nome}.`)
    carregar()
  }

  if (erro) return <Aviso tom="ruim">Não foi possível carregar a oferta: {erro}</Aviso>
  if (oferta === 'nao_existe')
    return (
      <Vazio titulo="Esta oferta não existe mais">
        <Link to="/ofertas" className="text-accent-strong hover:underline">
          Voltar para ofertas
        </Link>
      </Vazio>
    )
  if (!oferta || !base) return <Carregando linhas={5} altura="h-12" />

  const s = STATUS_OFERTA[oferta.status]

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/ofertas" className="text-sm text-muted hover:text-ink">
          ← Ofertas
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <BolinhaCor cor={oferta.cor} tamanho="h-4 w-4" />
          <span className="font-mono text-sm font-semibold">
            {oferta.codigo}-{oferta.idioma}
          </span>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{oferta.nome}</h1>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Status</span>
          <span aria-hidden>{s.icone}</span>
          <select
            value={oferta.status}
            onChange={(e) => mudarStatus(e.target.value as StatusOferta)}
            className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
            aria-label="Status da oferta"
          >
            {(Object.keys(STATUS_OFERTA) as StatusOferta[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_OFERTA[k].nome}
              </option>
            ))}
          </select>
        </label>
        <Botao variante="secundario" onClick={() => setEditando(true)}>
          Editar oferta
        </Botao>
        <Link to={`/quadros/${oferta.id}`} className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-sm hover:brightness-105">
          Abrir quadro
        </Link>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-line" aria-label="Seções da oferta">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            onClick={() => setParams(a.valor === 'geral' ? {} : { aba: a.valor }, { replace: true })}
            aria-current={aba === a.valor ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              aba === a.valor ? 'border-accent font-medium text-accent-strong' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {a.nome}
          </button>
        ))}
      </nav>

      {aba === 'geral' && (
        <VisaoGeral oferta={oferta} listas={base.listas} ofertas={base.ofertas} contas={base.contas} membros={base.membros} versao={versao} onMudou={mudou} />
      )}
      {aba === 'checklist' && <ChecklistOferta ofertaId={oferta.id} membros={base.membros} onMudou={mudou} />}
      {aba === 'testes' && <TestesOferta ofertaId={oferta.id} onMudou={mudou} />}

      {editando && (
        <ModalOferta
          oferta={{ ...oferta, cards: [{ count: cards }] }}
          onFechar={() => setEditando(false)}
          onSalvo={() => {
            setEditando(false)
            carregar()
          }}
        />
      )}
    </>
  )
}
