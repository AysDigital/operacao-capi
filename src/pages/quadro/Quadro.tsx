import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Aviso, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { mensagemErro, type Etiqueta } from '../../lib/cadastros'
import {
  buscarCards,
  gravarLocal,
  LISTAS_SEM_PRAZO,
  lerLocal,
  passaNoFiltro,
  posicaoEntre,
  renumerar,
  type CardQuadro,
  type ContaQuadro,
  type Filtros,
  type Lista,
  type OfertaQuadro,
} from '../../lib/quadro'
import { ops, supabase } from '../../lib/supabase'
import { BarraFiltros } from './BarraFiltros'
import { CartaoArrastavel, CartaoFrente, type Contexto } from './Cartao'
import { NovoCard } from './NovoCard'

const PREFIXO_LISTA = 'lista:'

export function Quadro({
  ofertaId,
  listas,
  ofertas,
  contas,
  etiquetas,
  filtros,
  onFiltros,
}: {
  /** null = todas as ofertas */
  ofertaId: string | null
  listas: Lista[]
  ofertas: OfertaQuadro[]
  contas: ContaQuadro[]
  etiquetas: Etiqueta[]
  filtros: Filtros
  onFiltros: (f: Filtros) => void
}) {
  const toast = useToast()
  const [cards, setCards] = useState<CardQuadro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aoVivo, setAoVivo] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [recolhidas, setRecolhidas] = useState<string[]>(() => lerLocal('listas_recolhidas', []))
  const [novoEm, setNovoEm] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  // durante o arrasto: a ordem provisória (ids por lista) e o card arrastado
  const [arrasto, setArrasto] = useState<Record<string, string[]> | null>(null)
  const [ativo, setAtivo] = useState<string | null>(null)
  const arrastando = useRef(false)
  const recargaPendente = useRef(false)
  const fimDoArrasto = useRef(0)

  // ---- carregar e manter atualizado --------------------------------------
  const carregar = useCallback(async () => {
    if (arrastando.current) {
      recargaPendente.current = true
      return
    }
    try {
      setCards(await buscarCards(ofertaId, filtros.arquivados))
      setErro(null)
    } catch (e) {
      setErro(String((e as Error).message))
    }
  }, [ofertaId, filtros.arquivados])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real: qualquer mudança em cards ou veiculações recarrega o quadro (agrupando rajadas).
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined
    const agendar = () => {
      clearTimeout(espera)
      espera = setTimeout(carregar, 400)
    }
    const canal = supabase
      .channel(`quadro-${ofertaId ?? 'todas'}`)
      .on('postgres_changes', { event: '*', schema: 'ops', table: 'cards' }, agendar)
      .on('postgres_changes', { event: '*', schema: 'ops', table: 'veiculacoes' }, agendar)
      .subscribe((status) => setAoVivo(status === 'SUBSCRIBED'))
    const aoVoltar = () => document.visibilityState === 'visible' && agendar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(espera)
      document.removeEventListener('visibilitychange', aoVoltar)
      supabase.removeChannel(canal)
    }
  }, [carregar, ofertaId])

  // relógio do "3d" nos cards
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  // ---- dados derivados -----------------------------------------------------
  const porId = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards])

  const colunas = useMemo(() => {
    const r: Record<string, string[]> = Object.fromEntries(listas.map((l) => [l.id, []]))
    const visiveis = (cards ?? []).filter((c) => passaNoFiltro(c, filtros)).sort((a, b) => a.posicao - b.posicao)
    for (const c of visiveis) r[c.lista_id]?.push(c.id)
    return r
  }, [cards, listas, filtros])

  const mostradas = arrasto ?? colunas
  const visiveis = Object.values(colunas).reduce((n, ids) => n + ids.length, 0)

  const ctx: Contexto = useMemo(
    () => ({
      ofertas: new Map(ofertas.map((o) => [o.id, o])),
      contas: new Map(contas.map((c) => [c.id, c])),
      etiquetas: new Map(etiquetas.map((e) => [e.id, e])),
      mostrarOferta: ofertaId === null,
      agora,
    }),
    [ofertas, contas, etiquetas, ofertaId, agora],
  )

  const ofertaFixa = ofertaId ? (ofertas.find((o) => o.id === ofertaId) ?? null) : null
  const ofertasParaCriar = useMemo(() => ofertas.filter((o) => o.status !== 'pausada'), [ofertas])

  function alternarRecolhida(id: string) {
    setRecolhidas((r) => {
      const novo = r.includes(id) ? r.filter((x) => x !== id) : [...r, id]
      gravarLocal('listas_recolhidas', novo)
      return novo
    })
  }

  // soltar um card logo depois de arrastar não conta como clique
  const abrir = useCallback((id: string) => Date.now() - fimDoArrasto.current > 250 && setAberto(id), [])

  /** Fim da lista, considerando todos os cards dela (inclusive os escondidos pelo filtro). */
  const proximaPosicao = (listaId: string) =>
    Math.max(0, ...(cards ?? []).filter((c) => c.lista_id === listaId).map((c) => c.posicao)) + 1024

  const aoCriar = useCallback((c: CardQuadro) => setCards((cs) => (cs && !cs.some((x) => x.id === c.id) ? [...cs, c] : cs)), [])

  // ---- arrastar e soltar ---------------------------------------------------
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const listaDe = (id: string, ordem: Record<string, string[]>) =>
    id.startsWith(PREFIXO_LISTA) ? id.slice(PREFIXO_LISTA.length) : Object.keys(ordem).find((l) => ordem[l].includes(id))

  function inicio({ active }: DragStartEvent) {
    arrastando.current = true
    setAtivo(String(active.id))
    setArrasto(Object.fromEntries(Object.entries(colunas).map(([l, ids]) => [l, [...ids]])))
  }

  // Passou para outra lista: move o card na ordem provisória.
  function sobre({ active, over }: DragOverEvent) {
    if (!over || !arrasto) return
    const de = listaDe(String(active.id), arrasto)
    const para = listaDe(String(over.id), arrasto)
    if (!de || !para || de === para) return
    setArrasto((a) => {
      if (!a) return a
      const origem = a[de].filter((x) => x !== active.id)
      const destino = [...a[para]]
      const i = destino.indexOf(String(over.id))
      destino.splice(i >= 0 ? i : destino.length, 0, String(active.id))
      return { ...a, [de]: origem, [para]: destino }
    })
  }

  function terminarArrasto() {
    arrastando.current = false
    fimDoArrasto.current = Date.now()
    setAtivo(null)
    setArrasto(null)
    if (recargaPendente.current) {
      recargaPendente.current = false
      carregar()
    }
  }

  async function fim({ active, over }: DragEndEvent) {
    const id = String(active.id)
    const ordem = arrasto
    const card = porId.get(id)
    terminarArrasto()
    if (!over || !ordem || !card) return

    const lista = listaDe(id, ordem)
    if (!lista) return
    let ids = ordem[lista]
    const alvo = String(over.id)
    if (!alvo.startsWith(PREFIXO_LISTA) && ids.includes(alvo)) ids = arrayMove(ids, ids.indexOf(id), ids.indexOf(alvo))
    const i = ids.indexOf(id)
    const vizinhoAntes = porId.get(ids[i - 1])?.posicao
    const vizinhoDepois = porId.get(ids[i + 1])?.posicao

    // Mesmo lugar de antes: nada a gravar.
    if (lista === card.lista_id && colunas[lista]?.indexOf(id) === i) return

    const posicao = posicaoEntre(vizinhoAntes, vizinhoDepois)
    const mudancas = posicao === null ? renumerar(ids) : [{ id, posicao }]
    const anteriores = new Map((cards ?? []).map((c) => [c.id, c]))

    // Otimista: a tela muda já; se o banco recusar, volta como estava.
    setCards((cs) =>
      (cs ?? []).map((c) => {
        const m = mudancas.find((x) => x.id === c.id)
        if (!m) return c
        return c.id === id
          ? { ...c, posicao: m.posicao, lista_id: lista, lista_desde: lista !== card.lista_id ? new Date().toISOString() : c.lista_desde }
          : { ...c, posicao: m.posicao }
      }),
    )

    const resultados = await Promise.all(
      mudancas.map((m) =>
        ops()
          .from('cards')
          .update(m.id === id ? { posicao: m.posicao, lista_id: lista } : { posicao: m.posicao })
          .eq('id', m.id),
      ),
    )
    const falha = resultados.find((r) => r.error)?.error
    if (falha) {
      setCards((cs) => (cs ?? []).map((c) => (mudancas.some((m) => m.id === c.id) ? (anteriores.get(c.id) ?? c) : c)))
      toast('ruim', `Não foi possível mover o card: ${mensagemErro(falha)}`)
    }
  }

  // ---- tela ----------------------------------------------------------------
  const cardAberto = aberto ? porId.get(aberto) : undefined
  const cardAtivo = ativo ? porId.get(ativo) : undefined

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        onFiltros={onFiltros}
        etiquetas={etiquetas}
        contas={contas}
        visiveis={cards ? visiveis : null}
        aoVivo={aoVivo}
      />

      {erro && (
        <div className="mb-3">
          <Aviso tom="ruim">Não foi possível carregar o quadro: {erro}</Aviso>
        </div>
      )}

      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={inicio} onDragOver={sobre} onDragEnd={fim} onDragCancel={terminarArrasto}>
        <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 md:-mx-10 md:px-10">
          {listas.map((l) => (
            <Coluna
              key={l.id}
              lista={l}
              ids={mostradas[l.id] ?? []}
              porId={porId}
              ctx={ctx}
              carregando={!cards && !erro}
              recolhida={recolhidas.includes(l.id)}
              onRecolher={alternarRecolhida}
              onAbrir={abrir}
              novoAberto={novoEm === l.id}
              onNovo={setNovoEm}
            >
              {novoEm === l.id && (
                <NovoCard
                  listaId={l.id}
                  ofertaFixa={ofertaFixa}
                  ofertas={ofertasParaCriar}
                  proximaPosicao={() => proximaPosicao(l.id)}
                  onCriado={aoCriar}
                  onFechar={() => setNovoEm(null)}
                />
              )}
            </Coluna>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {cardAtivo && (
            <div className="w-68">
              <CartaoFrente card={cardAtivo} ctx={ctx} semPrazo arrastando />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {cardAberto && (
        <Modal titulo={cardAberto.nome} onFechar={() => setAberto(null)}>
          <p className="text-sm text-muted">Detalhes na próxima etapa.</p>
        </Modal>
      )}
    </>
  )
}

const Coluna = memo(function Coluna({
  lista,
  ids,
  porId,
  ctx,
  carregando,
  recolhida,
  onRecolher,
  onAbrir,
  novoAberto,
  onNovo,
  children,
}: {
  lista: Lista
  ids: string[]
  porId: Map<string, CardQuadro>
  ctx: Contexto
  carregando: boolean
  recolhida: boolean
  onRecolher: (id: string) => void
  onAbrir: (id: string) => void
  novoAberto: boolean
  onNovo: (id: string | null) => void
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PREFIXO_LISTA + lista.id })
  const semPrazo = LISTAS_SEM_PRAZO.includes(lista.nome)

  if (recolhida) {
    return (
      <button
        ref={setNodeRef}
        onClick={() => onRecolher(lista.id)}
        title={`Abrir ${lista.nome}`}
        className={`flex w-10 shrink-0 flex-col items-center gap-2 self-stretch rounded-card border border-line py-3 text-sm ${isOver ? 'bg-accent-soft' : 'bg-surface-2 hover:bg-line/60'}`}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: lista.cor ?? undefined }} />
        <span className="text-xs text-muted tabular-nums">{ids.length}</span>
        <span className="font-medium [writing-mode:vertical-rl]">{lista.nome}</span>
      </button>
    )
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={lista.nome}
      className={`flex max-h-[calc(100dvh-15rem)] w-72 shrink-0 flex-col rounded-card border border-line ${isOver ? 'bg-accent-soft/60' : 'bg-surface-2'}`}
    >
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lista.cor ?? undefined }} />
        <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{lista.nome}</h2>
        <span className="text-xs text-muted tabular-nums">{ids.length}</span>
        <button
          onClick={() => onRecolher(lista.id)}
          title="Recolher a lista"
          aria-label={`Recolher ${lista.nome}`}
          className="rounded p-0.5 text-muted hover:bg-line/60 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-8 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {carregando ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-control bg-surface" />)
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {ids.map((id) => {
              const c = porId.get(id)
              return c ? <CartaoArrastavel key={id} card={c} ctx={ctx} semPrazo={semPrazo} onAbrir={onAbrir} /> : null
            })}
          </SortableContext>
        )}
        {children}
      </div>

      {!novoAberto && (
        <button onClick={() => onNovo(lista.id)} className="mx-2 mb-2 rounded-control px-2 py-1.5 text-left text-sm text-muted hover:bg-line/60 hover:text-ink">
          + Adicionar card
        </button>
      )}
    </section>
  )
})
