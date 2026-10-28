import { memo, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PilulaCor } from '../../components/ds'
import type { Etiqueta } from '../../lib/cadastros'
import { formatarData } from '../../lib/format'
import {
  diasDesde,
  STATUS_VEICULACAO,
  tempoDesde,
  type CardQuadro,
  type ContaQuadro,
  type OfertaQuadro,
  type StatusVeiculacao,
} from '../../lib/quadro'

/** O que o card precisa saber do quadro (mapas por id), igual para todos os cards. */
export type Contexto = {
  ofertas: Map<string, OfertaQuadro>
  contas: Map<string, ContaQuadro>
  etiquetas: Map<string, Etiqueta>
  mostrarOferta: boolean
  agora: number
}

const COR_CONTA: Record<Exclude<StatusVeiculacao, 'nao_subido'>, string> = {
  rodando: 'bg-good-soft text-good',
  em_analise: 'bg-warn-soft text-warn',
  rejeitado: 'bg-bad-soft text-bad',
  pausado: 'bg-surface-2 text-muted',
}

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export const CartaoFrente = memo(function CartaoFrente({
  card,
  ctx,
  semPrazo,
  arrastando,
}: {
  card: CardQuadro
  ctx: Contexto
  /** lista sem destaque de tempo parado */
  semPrazo: boolean
  arrastando?: boolean
}) {
  const oferta = ctx.ofertas.get(card.oferta_id)
  const dias = diasDesde(card.lista_desde, ctx.agora)
  const tomTempo = semPrazo ? 'text-muted' : dias > 5 ? 'bg-bad-soft text-bad' : dias > 2 ? 'bg-warn-soft text-warn' : 'text-muted'
  const contas = card.veiculacoes
    .filter((v) => v.status !== 'nao_subido' && ctx.contas.has(v.conta_id))
    .map((v) => ({ v, conta: ctx.contas.get(v.conta_id)! }))
    .sort((a, b) => a.conta.apelido.localeCompare(b.conta.apelido, 'pt-BR', { numeric: true }))
  const etiquetas = card.etiquetas.map((id) => ctx.etiquetas.get(id)).filter((e) => e !== undefined)

  return (
    <div
      className={`rounded-control border border-line bg-surface px-2.5 py-2 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
        arrastando ? 'rotate-2 shadow-lg ring-2 ring-accent/40' : 'hover:border-muted'
      } ${card.arquivado ? 'opacity-60' : ''}`}
    >
      {(etiquetas.length > 0 || (ctx.mostrarOferta && oferta)) && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {ctx.mostrarOferta && oferta && <PilulaCor pequena texto={oferta.codigo} cor={oferta.cor} title={`${oferta.nome} (${oferta.idioma})`} />}
          {etiquetas.map((e) => (
            <PilulaCor key={e.id} pequena texto={e.nome} cor={e.cor} />
          ))}
        </div>
      )}

      <p className={`text-sm leading-snug font-medium break-words ${card.tipo === 'ad' ? 'font-mono text-[13px]' : ''}`}>{card.nome}</p>

      {contas.length > 0 && (
        <div className="mt-1.5 flex gap-1 overflow-hidden">
          {contas.map(({ v, conta }) => {
            const s = STATUS_VEICULACAO[v.status]
            return (
              <span
                key={v.conta_id}
                title={`${conta.nome}${conta.bm_nome ? ` – ${conta.bm_nome}` : ''} · ${s.nome} em ${formatarData(v.data_status).slice(0, 5)}`}
                className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px font-mono text-[11px] leading-4 font-semibold ${COR_CONTA[v.status as keyof typeof COR_CONTA]}`}
              >
                <span aria-hidden className="text-[9px]">
                  {s.icone}
                </span>
                {conta.apelido}
                <span className="sr-only">: {s.nome}</span>
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-muted">
        <span
          title={`Nesta lista desde ${formatarData(card.lista_desde)}`}
          className={`rounded px-1 py-px tabular-nums ${tomTempo}`}
        >
          {tempoDesde(card.lista_desde, ctx.agora)}
        </span>
        {card.anexos > 0 && (
          <span className="inline-flex items-center gap-0.5" title={`${card.anexos} anexo(s)`}>
            <Icone>
              <path d="M10.5 5.5 6 10a1.4 1.4 0 0 0 2 2l4.6-4.6a2.8 2.8 0 0 0-4-4L4 8a4.2 4.2 0 0 0 6 6l3.5-3.5" />
            </Icone>
            {card.anexos}
          </span>
        )}
        {card.comentarios > 0 && (
          <span className="inline-flex items-center gap-0.5" title={`${card.comentarios} comentário(s)`}>
            <Icone>
              <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" />
            </Icone>
            {card.comentarios}
          </span>
        )}
        {card.checklist.total > 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded px-0.5 ${card.checklist.feitos === card.checklist.total ? 'bg-good-soft text-good' : ''}`}
            title="Checklist: feitos / total"
          >
            <Icone>
              <path d="M2.5 2.5h11v11h-11ZM5 8l2 2 4-4" />
            </Icone>
            {card.checklist.feitos}/{card.checklist.total}
          </span>
        )}
        {card.vencedor && (
          <span className="inline-flex items-center gap-0.5 text-warn" title="Vencedor">
            <Icone>
              <path d="M5 2.5h6v3a3 3 0 0 1-6 0Zm0 1H2.5a2 2 0 0 0 2.5 2.5M11 3.5h2.5A2 2 0 0 1 11 6M8 8.5v3m-2.5 2h5" />
            </Icone>
            <span className="sr-only">Vencedor</span>
          </span>
        )}
        {card.arquivado && <span className="ml-auto">Arquivado</span>}
      </div>
    </div>
  )
})

/** Card arrastável. O clique (sem arrastar) abre o card. */
export const CartaoArrastavel = memo(function CartaoArrastavel({
  card,
  ctx,
  semPrazo,
  onAbrir,
}: {
  card: CardQuadro
  ctx: Contexto
  semPrazo: boolean
  onAbrir: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { tipo: 'card' } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation ${isDragging ? 'opacity-30' : ''}`}
      onClick={() => onAbrir(card.id)}
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
    >
      <CartaoFrente card={card} ctx={ctx} semPrazo={semPrazo} />
    </div>
  )
})
