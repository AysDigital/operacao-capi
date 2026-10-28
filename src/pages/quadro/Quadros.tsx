import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, BolinhaCor, Carregando, Vazio } from '../../components/ds'
import { Botao } from '../../components/ui'
import type { Etiqueta } from '../../lib/cadastros'
import { gravarFiltros, gravarLocal, lerFiltros, lerLocal, type ContaQuadro, type Filtros, type Lista, type OfertaQuadro } from '../../lib/quadro'
import { manterMetricasFrescas } from '../../lib/metricas'
import { ops } from '../../lib/supabase'
import { Quadro } from './Quadro'

const CHAVE_ULTIMO = 'ultimo_quadro'

/** "/" e "/quadros" abrem o último quadro usado. */
export function IrParaUltimoQuadro() {
  return <Navigate to={`/quadros/${lerLocal(CHAVE_ULTIMO, 'todas')}`} replace />
}

type Base = { listas: Lista[]; ofertas: OfertaQuadro[]; contas: ContaQuadro[]; etiquetas: Etiqueta[] }

async function buscarBase(): Promise<Base> {
  const [listas, ofertas, contas, etiquetas] = await Promise.all([
    ops().from('listas').select('id, nome, ordem, cor, arquivada').order('ordem'),
    ops().from('ofertas').select('id, nome, codigo, idioma, cor, status').order('nome'),
    ops().from('contas_anuncio').select('id, apelido, nome, bm_nome, ativa, meta_ad_account_id'),
    ops().from('etiquetas').select('id, nome, cor').order('nome'),
  ])
  const erro = listas.error ?? ofertas.error ?? contas.error ?? etiquetas.error
  if (erro) throw new Error(erro.message)
  return {
    listas: listas.data ?? [],
    ofertas: ofertas.data as OfertaQuadro[],
    contas: (contas.data as ContaQuadro[]).sort(
      (a, b) => Number(b.ativa) - Number(a.ativa) || a.apelido.localeCompare(b.apelido, 'pt-BR', { numeric: true }),
    ),
    etiquetas: etiquetas.data ?? [],
  }
}

export function Quadros() {
  const { id = 'todas' } = useParams()
  const [params, setParams] = useSearchParams()
  const cardAberto = params.get('card')
  // filtros sem o card aberto (é isso que acompanha a troca de quadro)
  const busca = useMemo(() => {
    const p = new URLSearchParams(params)
    p.delete('card')
    return p.toString()
  }, [params])
  const filtros = useMemo(() => lerFiltros(new URLSearchParams(busca)), [busca])

  const mudarFiltros = useCallback(
    (f: Filtros) =>
      setParams(
        (atual) => {
          const p = gravarFiltros(f)
          const card = atual.get('card')
          if (card) p.set('card', card)
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const abrirCard = useCallback(
    (cardId: string | null) =>
      setParams((atual) => {
        const p = new URLSearchParams(atual)
        if (cardId) p.set('card', cardId)
        else p.delete('card')
        return p
      }),
    [setParams],
  )
  const navegar = useNavigate()
  const [base, setBase] = useState<Base | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregarBase = useCallback(() => {
    buscarBase().then(setBase, (e: Error) => setErro(e.message))
  }, [])

  useEffect(() => {
    recarregarBase()
    manterMetricasFrescas()
  }, [recarregarBase])

  const ofertaId = id === 'todas' ? null : id
  const existe = !ofertaId || !base || base.ofertas.some((o) => o.id === ofertaId)

  useEffect(() => {
    if (base) gravarLocal(CHAVE_ULTIMO, existe ? id : 'todas')
  }, [base, id, existe])

  if (erro) return <Aviso tom="ruim">Não foi possível carregar os quadros: {erro}</Aviso>
  if (!base) return <Carregando linhas={4} altura="h-10" />

  if (base.ofertas.length === 0) {
    return (
      <Vazio titulo="Nenhuma oferta cadastrada ainda">
        <Botao className="mt-3" onClick={() => navegar('/ofertas')}>
          Cadastrar oferta
        </Botao>
      </Vazio>
    )
  }

  return (
    <>
      <SeletorQuadro ofertas={base.ofertas} atual={id} busca={busca} />
      {existe ? (
        <Quadro
          key={id}
          ofertaId={ofertaId}
          listas={base.listas}
          ofertas={base.ofertas}
          contas={base.contas}
          etiquetas={base.etiquetas}
          filtros={filtros}
          onFiltros={mudarFiltros}
          onListasMudaram={recarregarBase}
          cardAberto={cardAberto}
          onAbrirCard={abrirCard}
        />
      ) : (
        <Vazio titulo="Este quadro não existe mais">
          <Link to="/quadros/todas" className="text-accent-strong hover:underline">
            Ver todas as ofertas
          </Link>
        </Vazio>
      )}
    </>
  )
}

const aba = (ativa: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-3 py-1.5 text-sm transition-colors ${
    ativa ? 'bg-accent-soft font-medium text-accent-strong' : 'text-muted hover:bg-surface-2 hover:text-ink'
  }`

function SeletorQuadro({ ofertas, atual, busca }: { ofertas: OfertaQuadro[]; atual: string; busca: string }) {
  const ativas = ofertas.filter((o) => o.status !== 'pausada')
  const pausadas = ofertas.filter((o) => o.status === 'pausada')
  const pausadaAtual = pausadas.find((o) => o.id === atual)
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()
  const destino = (id: string) => ({ pathname: `/quadros/${id}`, search: busca })

  useEffect(() => {
    if (!menu) return
    const fechar = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [menu])

  return (
    <nav aria-label="Quadros" className="mb-4 flex items-center gap-1 border-b border-line pb-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <NavLink to={destino('todas')} className={({ isActive }) => aba(isActive)}>
          Todas as ofertas
        </NavLink>
        {ativas.map((o) => (
          <NavLink key={o.id} to={destino(o.id)} className={({ isActive }) => aba(isActive)} title={`${o.nome} (${o.idioma})`}>
            <BolinhaCor cor={o.cor} tamanho="h-2.5 w-2.5" />
            <span className="font-mono text-xs font-semibold">{o.codigo}</span>
            <span>{o.nome}</span>
          </NavLink>
        ))}
      </div>
      {pausadas.length > 0 && (
        <div ref={ref} className="relative shrink-0">
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} className={aba(Boolean(pausadaAtual))}>
            {pausadaAtual ? (
              <>
                <BolinhaCor cor={pausadaAtual.cor} tamanho="h-2.5 w-2.5" />
                <span className="font-mono text-xs font-semibold">{pausadaAtual.codigo}</span>
                {pausadaAtual.nome}
              </>
            ) : (
              `Pausadas (${pausadas.length})`
            )}
            <span aria-hidden className="text-xs">
              ▾
            </span>
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-card border border-line bg-surface p-1 shadow-lg">
              {pausadas.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setMenu(false)
                    navegar(destino(o.id))
                  }}
                  className={`${aba(o.id === atual)} w-full`}
                >
                  <BolinhaCor cor={o.cor} tamanho="h-2.5 w-2.5" />
                  <span className="font-mono text-xs font-semibold">{o.codigo}</span>
                  <span className="truncate">{o.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
