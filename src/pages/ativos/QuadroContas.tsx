import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { BolinhaCor, Dica, Modal } from '../../components/ds'
import { useToast } from '../../components/Toast'
import { Botao, Campo, entrada } from '../../components/ui'
import { donaDe, nomeAtivo, type Inventario, type Registro, type TipoAtivo } from '../../lib/ativos'
import { mensagemErro } from '../../lib/cadastros'
import { diaBrasilia, formatarDiaIso } from '../../lib/format'
import { ops } from '../../lib/supabase'
import { PAPEIS_CONTA, type PapelConta } from '../../lib/quadro'
import { SeloAquecimento, SeloPapel, SeloStatusAtivo } from './campos'

/**
 * Quadro de uso das contas, controlado à mão: arrastar a conta entre
 * Veiculando ads, Aquecimento e Sem uso. Contas desativadas não aparecem.
 */

type Uso = 'veiculando' | 'aquecimento' | 'parada'
/** Coluna do quadro: as três de uso + a de contas caídas (pelo status). */
type ColunaUso = Uso | 'caida'
type Oferta = { id: string; nome: string; codigo: string; idioma: string; cor: string | null }

const COLUNAS: { uso: ColunaUso; nome: string; icone: string; dica: string }[] = [
  { uso: 'veiculando', nome: 'Veiculando ads', icone: '▶', dica: 'Contas rodando anúncios de verdade de alguma oferta.' },
  {
    uso: 'aquecimento',
    nome: 'Aquecimento',
    icone: '◐',
    dica: 'Contas aquecendo. Colocar uma conta aqui inicia o aquecimento (Dia 1) na Contingência; e toda conta que começa a aquecer pela Contingência aparece aqui. Quando o aquecimento termina, ela vai para "Sem uso".',
  },
  { uso: 'parada', nome: 'Sem uso', icone: '○', dica: 'Contas ativas que não estão rodando nada agora.' },
  {
    uso: 'caida',
    nome: 'Restrito / Desativado',
    icone: '!',
    dica: 'Contas com status Restrita ou Desativada. Arrastar uma conta para cá marca como Restrita (vai para o histórico de status); tirar daqui marca como Ativa de novo.',
  },
]

const usoDe = (c: Registro): Uso => (c.uso as Uso) ?? 'parada'
const colunaDe = (c: Registro): ColunaUso => ((c.status ?? 'ativa') !== 'ativa' ? 'caida' : usoDe(c))

export function QuadroContas({ inv, onMudou, onAbrir }: { inv: Inventario; onMudou: () => void; onAbrir: (tipo: TipoAtivo, id: string) => void }) {
  const toast = useToast()
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [editando, setEditando] = useState<Registro | null>(null)
  // cópia local para o cartão mudar de coluna na hora, antes de o banco responder
  const [movidos, setMovidos] = useState<Record<string, { uso: Uso; uso_posicao: number; status?: string }>>({})

  useEffect(() => {
    ops()
      .from('ofertas')
      .select('id, nome, codigo, idioma, cor')
      .order('codigo')
      .order('idioma')
      .then(({ data }) => setOfertas((data ?? []) as Oferta[]))
  }, [])
  useEffect(() => setMovidos({}), [inv])

  const contas = inv.conta.map((c) => (movidos[c.id] ? { ...c, ...movidos[c.id] } : c))

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  async function soltar({ active, over }: DragEndEvent) {
    if (!over) return
    const c = contas.find((x) => x.id === active.id)
    const destino = String(over.id) as ColunaUso
    if (!c || colunaDe(c) === destino) return
    const posicao = Math.max(0, ...contas.filter((x) => colunaDe(x) === destino).map((x) => Number(x.uso_posicao) || 0)) + 1024
    const mudarStatus = (status: string, motivo: string) =>
      ops().rpc('mudar_status_ativo', { p_tipo: 'conta', p_id: c.id, p_status: status, p_motivo: motivo, p_data: diaBrasilia() })

    // para a coluna das caídas: muda o status para Restrita (o uso fica como estava)
    if (destino === 'caida') {
      setMovidos((m) => ({ ...m, [c.id]: { uso: usoDe(c), uso_posicao: posicao, status: 'restrita' } }))
      const { error } = await mudarStatus('restrita', 'Movida para Restrito / Desativado no quadro de uso')
      if (error) toast('ruim', mensagemErro(error))
      else toast('bom', `${String(c.apelido)} marcada como Restrita.`)
      return onMudou()
    }
    // saindo da coluna das caídas: volta a ficar Ativa
    if (colunaDe(c) === 'caida') {
      const { error } = await mudarStatus('ativa', 'Voltou a ser usada (quadro de uso)')
      if (error) {
        toast('ruim', mensagemErro(error))
        return onMudou()
      }
    }
    const uso = destino
    if (usoDe(c) === uso) {
      setMovidos((m) => ({ ...m, [c.id]: { uso, uso_posicao: posicao, status: 'ativa' } }))
      return onMudou()
    }
    const uso_posicao = posicao
    setMovidos((m) => ({ ...m, [c.id]: { uso, uso_posicao, status: 'ativa' } }))
    const mudancas: Record<string, unknown> = { uso, uso_posicao, uso_desde: diaBrasilia() }
    if (uso === 'parada') mudancas.uso_oferta_id = null
    const { error } = await ops().from('contas_anuncio').update(mudancas).eq('id', c.id)
    if (error) toast('ruim', mensagemErro(error))
    else if (uso === 'aquecimento') toast('bom', `${String(c.apelido)} entrou no aquecimento (Dia 1) da Contingência.`)
    onMudou()
  }

  return (
    <>
      <DndContext sensors={sensores} onDragEnd={soltar}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const daColuna = contas.filter((c) => colunaDe(c) === col.uso).sort((a, b) => (Number(a.uso_posicao) || 0) - (Number(b.uso_posicao) || 0))
            return (
              <Coluna key={col.uso} uso={col.uso} titulo={col.nome} icone={col.icone} dica={col.dica} total={daColuna.length}>
                {daColuna.map((c) => (
                  <CartaoConta key={c.id} conta={c} inv={inv} oferta={ofertas.find((o) => o.id === c.uso_oferta_id)} onAbrir={() => setEditando(c)} />
                ))}
              </Coluna>
            )
          })}
        </div>
      </DndContext>

      {editando && (
        <ModalUso
          conta={editando}
          ofertas={ofertas}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            onMudou()
          }}
          onDetalhes={() => {
            setEditando(null)
            onAbrir('conta', editando.id)
          }}
        />
      )}
    </>
  )
}

function Coluna({ uso, titulo, icone, dica, total, children }: { uso: ColunaUso; titulo: string; icone: string; dica: string; total: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: uso })
  return (
    <section ref={setNodeRef} aria-label={titulo} className={`flex min-h-48 flex-col rounded-card border border-line p-2 ${isOver ? 'bg-accent-soft/60' : 'bg-surface-2'}`}>
      <header className="flex items-center gap-2 px-1 pb-2">
        <span aria-hidden>{icone}</span>
        <h2 className="flex-1 text-sm font-semibold">
          <Dica conteudo={dica} lado="esquerda">
            {titulo}
          </Dica>
        </h2>
        <span className="text-xs text-muted tabular-nums">{total}</span>
      </header>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

function CartaoConta({ conta, inv, oferta, onAbrir }: { conta: Registro; inv: Inventario; oferta?: Oferta; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: conta.id })
  const dona = donaDe(inv, 'conta', conta.id)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={`cursor-pointer rounded-control border border-line bg-surface p-2.5 text-sm shadow-sm hover:border-muted ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-xs font-semibold text-info">{String(conta.apelido)}</span>
        {conta.status !== 'ativa' && <SeloStatusAtivo tipo="conta" status={conta.status} />}
        <SeloAquecimento r={conta} soPendente />
        {conta.papel && conta.papel !== 'nenhum' ? <SeloPapel papel={conta.papel} /> : null}
        {conta.uso_desde ? <span className="ml-auto text-xs text-muted">desde {formatarDiaIso(conta.uso_desde as string)}</span> : null}
      </div>
      <p className="mt-1 font-medium break-words">{String(conta.nome)}</p>
      {dona && <p className="text-xs text-muted">{nomeAtivo(inv, dona.titular_tipo, dona.titular_id)}</p>}
      {oferta && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs">
          <BolinhaCor cor={oferta.cor} tamanho="h-2.5 w-2.5" />
          <span className="font-mono">
            {oferta.codigo}-{oferta.idioma}
          </span>
          <span className="truncate text-muted">{oferta.nome}</span>
        </p>
      )}
      {conta.uso_nota ? <p className="mt-1 text-xs whitespace-pre-wrap text-muted">{String(conta.uso_nota)}</p> : null}
    </div>
  )
}

function ModalUso({
  conta,
  ofertas,
  onFechar,
  onSalvo,
  onDetalhes,
}: {
  conta: Registro
  ofertas: Oferta[]
  onFechar: () => void
  onSalvo: () => void
  onDetalhes: () => void
}) {
  const toast = useToast()
  const [uso, setUso] = useState<Uso>(usoDe(conta))
  const [ofertaId, setOfertaId] = useState((conta.uso_oferta_id as string) ?? '')
  const [desde, setDesde] = useState((conta.uso_desde as string) ?? '')
  const [nota, setNota] = useState((conta.uso_nota as string) ?? '')
  const [papel, setPapel] = useState<PapelConta>((conta.papel as PapelConta) ?? 'nenhum')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const mudouColuna = uso !== usoDe(conta)
    const { error } = await ops()
      .from('contas_anuncio')
      .update({
        uso,
        uso_oferta_id: uso === 'parada' ? null : ofertaId || null,
        uso_desde: desde || (mudouColuna ? diaBrasilia() : null),
        uso_nota: nota.trim() || null,
        papel,
        ...(mudouColuna ? { uso_posicao: Date.now() } : {}),
      })
      .eq('id', conta.id)
    setSalvando(false)
    if (error) return toast('ruim', mensagemErro(error))
    toast('bom', 'Conta atualizada.')
    onSalvo()
  }

  return (
    <Modal
      titulo={`${String(conta.apelido)} · ${String(conta.nome)}`}
      largura="max-w-lg"
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={onDetalhes}>
            Ver detalhes da conta
          </Botao>
          <Botao variante="secundario" onClick={onFechar} className="ml-auto">
            Cancelar
          </Botao>
          <Botao type="submit" form="form-uso" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="form-uso" onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Situação">
            <select value={uso} onChange={(e) => setUso(e.target.value as Uso)} className={entrada}>
              {COLUNAS.map((c) => (
                <option key={c.uso} value={c.uso}>
                  {c.icone} {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Desde">
            <input type="date" value={desde} max={diaBrasilia()} onChange={(e) => setDesde(e.target.value)} className={entrada} />
          </Campo>
        </div>
        {uso !== 'parada' && (
          <Campo rotulo="Oferta (opcional)">
            <select value={ofertaId} onChange={(e) => setOfertaId(e.target.value)} className={entrada}>
              <option value="">Nenhuma</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo}-{o.idioma} · {o.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="Papel no manual de tráfego">
          <select value={papel} onChange={(e) => setPapel(e.target.value as PapelConta)} className={entrada}>
            {PAPEIS_CONTA.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Anotação (opcional)">
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} className={`${entrada} resize-y`} placeholder="Ex.: aquecendo com R$ 30/dia desde segunda" />
        </Campo>
      </form>
    </Modal>
  )
}
