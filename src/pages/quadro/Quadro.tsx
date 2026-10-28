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
import { Aviso } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { mensagemErro, type Etiqueta } from '../../lib/cadastros'
import {
  buscarCards,
  gravarLocal,
  LISTAS_SEM_PRAZO,
  lerLocal,
  ORDENACOES,
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
import { ConfirmarExclusaoCard } from './card/Exclusoes'
import { ModalCard } from './card/ModalCard'
import { ModalDuplicar, ModalGerarVariacoes, ModalNovaVersao } from './card/Versoes'
import { CartaoArrastavel, CartaoFrente, type Contexto } from './Cartao'
import { MenuLista, type AcaoLista } from './MenuLista'
import { NovaLista } from './NovaLista'
import { NovoCard } from './NovoCard'
import { PainelArquivados } from './PainelArquivados'

const PREFIXO_LISTA = 'lista:'

export function Quadro({
  ofertaId,
  listas,
  ofertas,
  contas,
  etiquetas,
  filtros,
  onFiltros,
  onListasMudaram,
  cardAberto,
  onAbrirCard,
}: {
  /** null = todas as ofertas */
  ofertaId: string | null
  listas: Lista[]
  ofertas: OfertaQuadro[]
  contas: ContaQuadro[]
  etiquetas: Etiqueta[]
  filtros: Filtros
  onFiltros: (f: Filtros) => void
  /** recarrega as listas (criou, arquivou ou restaurou uma) */
  onListasMudaram: () => void
  /** card aberto no modal (vem da URL: ?card=) */
  cardAberto: string | null
  onAbrirCard: (id: string | null) => void
}) {
  const toast = useToast()
  const [cards, setCards] = useState<CardQuadro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aoVivo, setAoVivo] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [recolhidas, setRecolhidas] = useState<string[]>(() => lerLocal('listas_recolhidas', []))
  const [novoEm, setNovoEm] = useState<string | null>(null)
  const [menuCard, setMenuCard] = useState<{ id: string; x: number; y: number } | null>(null)
  const [excluirCard, setExcluirCard] = useState<CardQuadro | null>(null)
  const [acaoVersao, setAcaoVersao] = useState<{ acao: 'versao' | 'variacoes' | 'duplicar'; cardId: string } | null>(null)
  const [verArquivados, setVerArquivados] = useState(false)
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

  // Recarga agrupada: várias gravações seguidas (no card aberto, por exemplo) viram uma só.
  const carregarRef = useRef(carregar)
  carregarRef.current = carregar
  const recarregarLogo = useMemo(() => {
    let espera: ReturnType<typeof setTimeout> | undefined
    return () => {
      clearTimeout(espera)
      espera = setTimeout(() => carregarRef.current(), 400)
    }
  }, [])

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
  const ativas = useMemo(() => listas.filter((l) => !l.arquivada), [listas])
  const porId = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards])

  const colunas = useMemo(() => {
    const r: Record<string, string[]> = Object.fromEntries(ativas.map((l) => [l.id, []]))
    const visiveis = (cards ?? []).filter((c) => passaNoFiltro(c, filtros)).sort((a, b) => a.posicao - b.posicao)
    for (const c of visiveis) r[c.lista_id]?.push(c.id)
    return r
  }, [cards, ativas, filtros])

  /** Cards não arquivados de cada lista neste quadro, ignorando os filtros (é sobre eles que as ações da lista agem). */
  const naLista = useMemo(() => {
    const r = new Map<string, CardQuadro[]>()
    for (const c of cards ?? []) if (!c.arquivado) r.set(c.lista_id, [...(r.get(c.lista_id) ?? []), c])
    return r
  }, [cards])

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
  const abrir = useCallback((id: string) => Date.now() - fimDoArrasto.current > 250 && onAbrirCard(id), [onAbrirCard])
  const abrirMenu = useCallback((id: string, x: number, y: number) => setMenuCard({ id, x, y }), [])

  /** Fim da lista, considerando todos os cards dela (inclusive os escondidos pelo filtro). */
  const proximaPosicao = (listaId: string) =>
    Math.max(0, ...(cards ?? []).filter((c) => c.lista_id === listaId).map((c) => c.posicao)) + 1024

  const aoCriar = useCallback((c: CardQuadro) => setCards((cs) => (cs && !cs.some((x) => x.id === c.id) ? [...cs, c] : cs)), [])

  // ---- ações da lista e do card -------------------------------------------
  const acaoLista = useCallback(
    async (listaId: string, acao: AcaoLista) => {
      const daLista = [...(naLista.get(listaId) ?? [])].sort((a, b) => a.posicao - b.posicao)
      const ids = daLista.map((c) => c.id)
      const nome = (id: string) => listas.find((l) => l.id === id)?.nome ?? ''
      const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
      let error
      if (acao.tipo === 'ordenar') {
        const ordenados = [...daLista].sort(ORDENACOES[acao.indice].comparar).map((c) => c.id)
        const nova = new Map(ordenados.map((id, i) => [id, (i + 1) * 1024]))
        setCards((cs) => (cs ?? []).map((c) => (nova.has(c.id) ? { ...c, posicao: nova.get(c.id)! } : c)))
        ;({ error } = await ops().rpc('ordenar_cards', { p_ids: ordenados }))
        if (!error) toast('bom', `${nome(listaId)} ordenada: ${ORDENACOES[acao.indice].nome.toLowerCase()}.`)
      } else if (acao.tipo === 'mover') {
        ;({ error } = await ops().rpc('mover_cards', { p_ids: ids, p_lista: acao.para }))
        if (!error) toast('bom', `${plural(ids.length, 'card movido', 'cards movidos')} para ${nome(acao.para)}.`)
      } else if (acao.tipo === 'arquivar_cards') {
        ;({ error } = await ops().from('cards').update({ arquivado: true }).in('id', ids))
        if (!error) toast('bom', `${plural(ids.length, 'card arquivado', 'cards arquivados')}.`)
      } else if (acao.tipo === 'lista_excluida') {
        onListasMudaram()
      } else {
        ;({ error } = await ops().from('listas').update({ arquivada: true }).eq('id', listaId))
        if (!error) {
          toast('bom', `Lista ${nome(listaId)} arquivada.`)
          onListasMudaram()
        }
      }
      if (error) toast('ruim', mensagemErro(error))
      carregar()
    },
    [naLista, listas, toast, carregar, onListasMudaram],
  )

  async function arquivarCard(c: CardQuadro, arquivado: boolean) {
    setCards((cs) => (cs ?? []).map((x) => (x.id === c.id ? { ...x, arquivado } : x)).filter((x) => filtros.arquivados || !x.arquivado))
    const { error } = await ops().from('cards').update({ arquivado }).eq('id', c.id)
    if (error) {
      toast('ruim', mensagemErro(error))
      carregar()
    } else toast('bom', arquivado ? `${c.nome} arquivado.` : `${c.nome} restaurado.`)
  }

  // ---- arrastar o quadro para o lado (clicando no fundo, fora dos cards) ----
  const trilho = useRef<HTMLDivElement>(null)
  const puxando = useRef<{ x: number; rolagem: number } | null>(null)

  function comecarPuxar(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, label, form, a, [data-card]')) return
    puxando.current = { x: e.clientX, rolagem: trilho.current!.scrollLeft }
    trilho.current!.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  function puxar(e: React.PointerEvent) {
    if (!puxando.current) return
    trilho.current!.scrollLeft = puxando.current.rolagem - (e.clientX - puxando.current.x)
  }
  function soltarPuxar() {
    puxando.current = null
  }

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
  const cardDoMenu = menuCard ? porId.get(menuCard.id) : undefined
  const depoisDeCriar = (novoId: string) => {
    setAcaoVersao(null)
    carregar()
    onAbrirCard(novoId)
  }
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
        onArquivados={() => setVerArquivados(true)}
      />

      {erro && (
        <div className="mb-3">
          <Aviso tom="ruim">Não foi possível carregar o quadro: {erro}</Aviso>
        </div>
      )}

      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragStart={inicio} onDragOver={sobre} onDragEnd={fim} onDragCancel={terminarArrasto}>
        <div
          ref={trilho}
          onPointerDown={comecarPuxar}
          onPointerMove={puxar}
          onPointerUp={soltarPuxar}
          onPointerCancel={soltarPuxar}
          className="-mx-4 flex min-h-[calc(100dvh-15rem)] cursor-grab items-start gap-3 overflow-x-auto px-4 pb-4 select-none active:cursor-grabbing md:-mx-10 md:px-10"
        >
          {ativas.map((l) => (
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
              onMenu={abrirMenu}
              novoAberto={novoEm === l.id}
              onNovo={setNovoEm}
              ativas={ativas}
              qtdNaLista={naLista.get(l.id)?.length ?? 0}
              onAcao={acaoLista}
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
          <NovaLista listas={listas} onCriada={onListasMudaram} />
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
        <ModalCard
          key={cardAberto}
          cardId={cardAberto}
          listas={listas}
          ofertas={ofertas}
          contas={contas}
          etiquetas={etiquetas}
          mostrarOferta={ofertaId === null}
          onFechar={() => onAbrirCard(null)}
          onMudou={recarregarLogo}
          onBaseMudou={onListasMudaram}
          onAbrirCard={onAbrirCard}
        />
      )}

      {menuCard && cardDoMenu && (
        <MenuCard
          x={menuCard.x}
          y={menuCard.y}
          arquivado={cardDoMenu.arquivado}
          ehAd={cardDoMenu.tipo === 'ad'}
          onVersao={(acao) => setAcaoVersao({ acao, cardId: cardDoMenu.id })}
          onFechar={() => setMenuCard(null)}
          onAbrir={() => onAbrirCard(cardDoMenu.id)}
          onArquivar={() => arquivarCard(cardDoMenu, !cardDoMenu.arquivado)}
          onExcluir={() => setExcluirCard(cardDoMenu)}
        />
      )}

      {acaoVersao?.acao === 'versao' && (
        <ModalNovaVersao cardId={acaoVersao.cardId} ctx={{ listas, ofertas, contas }} onFechar={() => setAcaoVersao(null)} onCriado={depoisDeCriar} />
      )}
      {acaoVersao?.acao === 'variacoes' && (
        <ModalGerarVariacoes
          cardId={acaoVersao.cardId}
          ctx={{ listas, ofertas, contas }}
          onFechar={() => setAcaoVersao(null)}
          onCriados={() => {
            setAcaoVersao(null)
            carregar()
          }}
        />
      )}
      {acaoVersao?.acao === 'duplicar' && (
        <ModalDuplicar cardId={acaoVersao.cardId} ctx={{ listas, ofertas, contas }} onFechar={() => setAcaoVersao(null)} onCriado={depoisDeCriar} />
      )}

      {excluirCard && (
        <ConfirmarExclusaoCard
          card={excluirCard}
          temIdAnuncio={excluirCard.veiculacoes.some((v) => v.meta_ad_id)}
          onArquivar={
            excluirCard.arquivado
              ? undefined
              : () => {
                  arquivarCard(excluirCard, true)
                  setExcluirCard(null)
                }
          }
          onFechar={() => setExcluirCard(null)}
          onExcluido={() => {
            setCards((cs) => cs?.filter((c) => c.id !== excluirCard.id) ?? null)
            setExcluirCard(null)
          }}
        />
      )}

      {verArquivados && (
        <PainelArquivados
          ofertaId={ofertaId}
          listas={listas}
          ofertas={ofertas}
          onFechar={() => setVerArquivados(false)}
          onListasMudaram={onListasMudaram}
          onCardsMudaram={carregar}
        />
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
  onMenu,
  novoAberto,
  onNovo,
  ativas,
  qtdNaLista,
  onAcao,
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
  onMenu: (id: string, x: number, y: number) => void
  novoAberto: boolean
  onNovo: (id: string | null) => void
  ativas: Lista[]
  qtdNaLista: number
  onAcao: (listaId: string, acao: AcaoLista) => void
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
        <MenuLista lista={lista} listas={ativas} qtdCards={qtdNaLista} onAcao={onAcao} />
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
              return c ? <CartaoArrastavel key={id} card={c} ctx={ctx} semPrazo={semPrazo} onAbrir={onAbrir} onMenu={onMenu} /> : null
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

/** Menu do clique-direito no card. */
function MenuCard({
  x,
  y,
  arquivado,
  ehAd,
  onVersao,
  onFechar,
  onAbrir,
  onArquivar,
  onExcluir,
}: {
  x: number
  y: number
  arquivado: boolean
  ehAd: boolean
  onVersao: (acao: 'versao' | 'variacoes' | 'duplicar') => void
  onFechar: () => void
  onAbrir: () => void
  onArquivar: () => void
  onExcluir: () => void
}) {
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && onFechar()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', onFechar, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', onFechar, true)
    }
  }, [onFechar])

  const item = 'block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface-2'
  const fazer = (f: () => void) => () => {
    onFechar()
    f()
  }

  return (
    <div
      ref={caixa}
      role="menu"
      style={{ top: Math.min(y, window.innerHeight - 260), left: Math.min(x, window.innerWidth - 200) }}
      className="fixed z-40 w-48 rounded-card border border-line bg-surface p-1.5 shadow-lg"
    >
      <button role="menuitem" className={item} onClick={fazer(onAbrir)}>
        Abrir card
      </button>
      {ehAd && (
        <>
          <button role="menuitem" className={item} onClick={fazer(() => onVersao('versao'))}>
            Nova versão…
          </button>
          <button role="menuitem" className={item} onClick={fazer(() => onVersao('variacoes'))}>
            Gerar variações…
          </button>
        </>
      )}
      <button role="menuitem" className={item} onClick={fazer(() => onVersao('duplicar'))}>
        Duplicar…
      </button>
      <div className="my-1 border-t border-line" />
      <button role="menuitem" className={item} onClick={fazer(onArquivar)}>
        {arquivado ? 'Restaurar' : 'Arquivar'}
      </button>
      <div className="my-1 border-t border-line" />
      <button role="menuitem" className={`${item} text-bad`} onClick={fazer(onExcluir)}>
        Excluir…
      </button>
    </div>
  )
}
