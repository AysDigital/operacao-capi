import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Aviso, Carregando, Modal, Selo } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, BotaoExcluir, Campo, entrada } from '../../components/ui'
import { mensagemErro } from '../../lib/cadastros'
import { formatarDiaIso } from '../../lib/format'
import {
  buscarTestes,
  RESULTADOS,
  STATUS_TESTE,
  TIPOS_TESTE,
  type ResultadoTeste,
  type StatusTeste,
  type Teste,
  type TipoTeste,
} from '../../lib/oferta'
import { ops } from '../../lib/supabase'

const nomeTipo = (t: TipoTeste) => TIPOS_TESTE.find((x) => x.valor === t)?.nome ?? t

export function TestesOferta({ ofertaId, onMudou }: { ofertaId: string; onMudou: () => void }) {
  const toast = useToast()
  const [testes, setTestes] = useState<Teste[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<Teste | { status: StatusTeste } | null>(null)

  const carregar = useCallback(() => buscarTestes(ofertaId).then(setTestes, (e: Error) => setErro(e.message)), [ofertaId])
  useEffect(() => {
    carregar()
  }, [carregar])

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  async function soltar({ active, over }: DragEndEvent) {
    if (!over || !testes) return
    const t = testes.find((x) => x.id === active.id)
    const status = String(over.id) as StatusTeste
    if (!t || t.status === status) return
    const posicao = Math.max(0, ...testes.filter((x) => x.status === status).map((x) => x.posicao)) + 1024
    setTestes((ts) => ts!.map((x) => (x.id === t.id ? { ...x, status, posicao } : x)))
    const { error } = await ops().from('testes_oferta').update({ status, posicao }).eq('id', t.id)
    if (error) toast('ruim', mensagemErro(error))
    carregar()
    onMudou()
  }

  if (erro) return <Aviso tom="ruim">Não foi possível carregar os testes: {erro}</Aviso>
  if (!testes) return <Carregando linhas={3} altura="h-24" />

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Botao onClick={() => setEditando({ status: 'ideia' })}>Novo teste</Botao>
      </div>
      <DndContext sensors={sensores} onDragEnd={soltar}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_TESTE.map((s) => (
            <Coluna key={s.valor} status={s.valor} nome={s.nome} icone={s.icone} onNovo={() => setEditando({ status: s.valor })}>
              {testes
                .filter((t) => t.status === s.valor)
                .sort((a, b) => a.posicao - b.posicao)
                .map((t) => (
                  <CartaoTeste key={t.id} teste={t} ofertaId={ofertaId} onAbrir={() => setEditando(t)} />
                ))}
            </Coluna>
          ))}
        </div>
      </DndContext>

      {editando && (
        <ModalTeste
          ofertaId={ofertaId}
          teste={'id' in editando ? editando : null}
          statusInicial={editando.status}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
            onMudou()
          }}
        />
      )}
    </>
  )
}

function Coluna({ status, nome, icone, onNovo, children }: { status: StatusTeste; nome: string; icone: string; onNovo: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} aria-label={nome} className={`flex min-h-40 flex-col rounded-card border border-line p-2 ${isOver ? 'bg-accent-soft/60' : 'bg-surface-2'}`}>
      <header className="flex items-center gap-2 px-1 pb-2">
        <span aria-hidden>{icone}</span>
        <h2 className="flex-1 text-sm font-semibold">{nome}</h2>
        <button onClick={onNovo} className="rounded px-1.5 text-sm text-muted hover:bg-line/60 hover:text-ink" aria-label={`Novo teste em ${nome}`}>
          +
        </button>
      </header>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

function CartaoTeste({ teste, ofertaId, onAbrir }: { teste: Teste; ofertaId: string; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: teste.id })
  const r = teste.resultado ? RESULTADOS[teste.resultado] : null
  const borda = r ? (r.tom === 'bom' ? 'border-l-good' : r.tom === 'ruim' ? 'border-l-bad' : 'border-l-line') : 'border-l-transparent'
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={`cursor-pointer rounded-control border border-line border-l-4 bg-surface p-2.5 text-sm shadow-sm hover:border-muted ${borda} ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      <p className="font-medium break-words">{teste.titulo}</p>
      <p className="mt-0.5 text-xs text-muted">
        {nomeTipo(teste.tipo)}
        {(teste.inicio || teste.fim) && ` · ${teste.inicio ? formatarDiaIso(teste.inicio) : '?'}${teste.fim ? ` → ${formatarDiaIso(teste.fim)}` : ''}`}
      </p>
      {(r || teste.card) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {r && (
            <Selo tom={r.tom}>
              <span aria-hidden>{r.icone}</span>
              {r.nome}
            </Selo>
          )}
          {teste.card && (
            <Link
              to={`/quadros/${ofertaId}?card=${teste.card.id}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="truncate font-mono text-xs text-accent-strong hover:underline"
            >
              {teste.card.nome}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function ModalTeste({
  ofertaId,
  teste,
  statusInicial,
  onFechar,
  onSalvo,
}: {
  ofertaId: string
  teste: Teste | null
  statusInicial: StatusTeste
  onFechar: () => void
  onSalvo: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState(teste?.titulo ?? '')
  const [tipo, setTipo] = useState<TipoTeste>(teste?.tipo ?? 'lead_vsl')
  const [hipotese, setHipotese] = useState(teste?.hipotese ?? '')
  const [status, setStatus] = useState<StatusTeste>(teste?.status ?? statusInicial)
  const [inicio, setInicio] = useState(teste?.inicio ?? '')
  const [fim, setFim] = useState(teste?.fim ?? '')
  const [resultado, setResultado] = useState<ResultadoTeste | ''>(teste?.resultado ?? '')
  const [aprendizado, setAprendizado] = useState(teste?.aprendizado ?? '')
  const [cardId, setCardId] = useState(teste?.card_id ?? '')
  const [cards, setCards] = useState<{ id: string; nome: string }[]>([])
  const [salvando, setSalvando] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => {
    ops()
      .from('cards')
      .select('id, nome')
      .eq('oferta_id', ofertaId)
      .eq('arquivado', false)
      .order('nome')
      .then(({ data }) => setCards(data ?? []))
  }, [ofertaId])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!titulo.trim()) return
    setSalvando(true)
    const campos = {
      titulo: titulo.trim(),
      tipo,
      hipotese: hipotese.trim() || null,
      status,
      inicio: inicio || null,
      fim: fim || null,
      resultado: resultado || null,
      aprendizado: aprendizado.trim() || null,
      card_id: cardId || null,
      ...(teste && teste.status !== status ? { posicao: 0 } : {}),
    }
    const { error } = teste
      ? await ops().from('testes_oferta').update(campos).eq('id', teste.id)
      : await ops().from('testes_oferta').insert({ ...campos, oferta_id: ofertaId })
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', teste ? 'Teste salvo.' : 'Teste criado.')
    onSalvo()
  }

  async function excluir() {
    if (!teste) return
    const { error } = await ops().from('testes_oferta').delete().eq('id', teste.id)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Teste excluído.')
    onSalvo()
  }

  return (
    <Modal
      titulo={teste ? 'Editar teste' : 'Novo teste'}
      largura="max-w-2xl"
      onFechar={onFechar}
      rodape={
        <>
          {teste && !confirmar && (
            <BotaoExcluir onClick={() => setConfirmar(true)} disabled={salvando}>
              Excluir
            </BotaoExcluir>
          )}
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-teste" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-teste" onSubmit={salvar} className="space-y-4">
        {confirmar && (
          <Aviso
            tom="ruim"
            acao={
              <Botao onClick={excluir} className="shrink-0">
                Confirmar exclusão
              </Botao>
            }
            onFechar={() => setConfirmar(false)}
          >
            Excluir o teste {teste?.titulo}?
          </Aviso>
        )}
        <Campo rotulo="Título" erro={tentou && !titulo.trim() ? 'Informe o título.' : null}>
          <input autoFocus={!teste} value={titulo} onChange={(e) => setTitulo(e.target.value)} className={entrada} placeholder="Ex.: Lead com história da avó" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTeste)} className={entrada}>
              {TIPOS_TESTE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusTeste)} className={entrada}>
              {STATUS_TESTE.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.icone} {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Hipótese">
          <textarea value={hipotese} onChange={(e) => setHipotese(e.target.value)} rows={2} className={`${entrada} resize-y`} placeholder="Se fizermos X, esperamos Y, porque Z." />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Início">
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={entrada} />
          </Campo>
          <Campo rotulo="Fim">
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={entrada} />
          </Campo>
          <Campo rotulo="Resultado">
            <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoTeste | '')} className={entrada}>
              <option value="">—</option>
              {(Object.keys(RESULTADOS) as ResultadoTeste[]).map((k) => (
                <option key={k} value={k}>
                  {RESULTADOS[k].icone} {RESULTADOS[k].nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Aprendizado">
          <textarea value={aprendizado} onChange={(e) => setAprendizado(e.target.value)} rows={3} className={`${entrada} resize-y`} placeholder="O que aprendemos com este teste?" />
        </Campo>
        <Campo rotulo="Card ligado (opcional)">
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={entrada}>
            <option value="">Nenhum</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      </form>
    </Modal>
  )
}
